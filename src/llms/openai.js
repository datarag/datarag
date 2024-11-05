const _ = require('lodash');
const { OpenAI } = require('openai');
const config = require('../config');
const logger = require('../logger');
const {
  LLM_CREATIVITY_HIGH,
  LLM_CREATIVITY_MEDIUM,
  LLM_CREATIVITY_LOW,
  LLM_CREATIVITY_NONE,
  LLM_QUALITY_HIGH,
  LLM_QUALITY_MEDIUM,
} = require('../constants');

const OPENAI_API_KEY = config.get('secrets:openai_api_key');
const MAX_RETRIES = 10;

// Model order for summarizing and
const PROCESSING_MODELS = [
  'gpt-4o-mini',
  'gpt-3.5-turbo',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-4',
];

const REASONING_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'gpt-4',
];

let client;

if (OPENAI_API_KEY) {
  client = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
}

/**
 * OpenAI retry strategy with model backoff
 *
 * @param {*} payload
 * @return {*}
 */
async function completionBackoff(payload, models) {
  for (let i = 0; i < models.length; i += 1) {
    const model = models[i];
    try {
      const completion = await client.chat.completions.create({
        ...payload,
        model,
      }, {
        maxRetries: MAX_RETRIES,
      });
      const { content } = completion.choices[0].message;
      if (!content) {
        throw new Error(completion);
      }
      return {
        model,
        content,
        costUSD:
          completion.usage.prompt_tokens * config.get(`llm:pricing:${model}:input`)
          + completion.usage.completion_tokens * config.get(`llm:pricing:${model}:output`),
      };
    } catch (err) {
      logger.error('openai', err);
    }
  }
  throw new Error('Could not do OpenAI completion');
}

/**
 * Raw prompt over LLM
 *
 * @param {*} { text, instructions, creativity, quality, json }
 * @return {*}
 */
async function inference({
  text, instructions, creativity, quality, json,
}) {
  if (process.env.NODE_ENV === 'test') {
    return {
      model: 'gpt-test',
      output: text,
      costUSD: 0,
    };
  }

  if (!client) throw new Error('No OpenAI key is defined');

  // Prepare messages
  const messages = [];
  if (instructions) {
    messages.push({
      role: 'system',
      content: instructions,
    });
  }
  messages.push({
    role: 'user',
    content: text,
  });

  // Prepare temperature
  let temperature;
  switch (creativity) {
    case LLM_CREATIVITY_HIGH:
      temperature = 1;
      break;
    case LLM_CREATIVITY_MEDIUM:
      temperature = 0.5;
      break;
    case LLM_CREATIVITY_LOW:
      temperature = 0.25;
      break;
    case LLM_CREATIVITY_NONE:
    default:
      temperature = 0;
      break;
  }

  // Prepare models
  let models;
  switch (quality) {
    case LLM_QUALITY_HIGH:
      models = REASONING_MODELS;
      break;
    case LLM_QUALITY_MEDIUM:
    default:
      models = PROCESSING_MODELS;
      break;
  }

  const openaiPayload = {
    messages,
    temperature,
  };

  if (json) {
    openaiPayload.response_format = { type: 'json_object' };
  }
  const completion = await completionBackoff(openaiPayload, models);

  return {
    model: completion.model,
    output: json ? JSON.parse(completion.content) : completion.content,
    costUSD: completion.costUSD,
  };
}

/**
 * Create a chat request
 *
 * @param {*} {
 *   chatHistory, query, tools, streamFn,
 * }
 * @return {*}
 */
async function chatStream({
  chatHistory, query, tools, streamFn,
}) {
  if (process.env.NODE_ENV === 'test') {
    return {
      costUSD: 0,
      text: query,
      chatHistory,
    };
  }

  const model = _.first(REASONING_MODELS);

  let text = '';
  const messages = [...(chatHistory || [])];
  messages.push({ role: 'user', content: query });

  const runner = await client.beta.chat.completions.runTools({
    model,
    temperature: 0.1,
    stream: true,
    stream_options: {
      include_usage: true,
    },
    tools,
    messages,
  }).on('message', (message) => {
    messages.push(message);
  });

  for await (const chunk of runner) {
    if (chunk.choices[0]
      && chunk.choices[0].delta
      && chunk.choices[0].delta.content
    ) {
      text += chunk.choices[0].delta.content;
      streamFn(chunk.choices[0].delta.content);
    }
  }

  const res = await runner.finalChatCompletion();

  if (
    res.choices
    && res.choices[0]
    && res.choices[0].message
    && res.choices[0].message.content
    && res.choices[0].message.content !== text
  ) {
    logger.error('chatStream', 'Chunked text with final text are not the same');
  }

  return {
    model,
    costUSD: res.usage
      ? (res.usage.prompt_tokens * config.get(`llm:pricing:${model}:input`))
        + (res.usage.completion_tokens * config.get(`llm:pricing:${model}:output`))
      : 0,
    text,
    chatHistory: messages,
  };
}

module.exports = {
  inference,
  chatStream,
};
