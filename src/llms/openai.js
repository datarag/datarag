const _ = require('lodash');
const { OpenAI } = require('openai');
const config = require('../config');
const logger = require('../logger');
const md5 = require('../helpers/md5');
const registry = require('../registry');

const OPENAI_API_KEY = config.get('secrets:openai_api_key');
const PROMPT_CACHE_SEC = config.get('prompt:caching:sec');
const MODELS = [
  {
    model: 'gpt-4o-mini',
    cost_input_token: 0.15 / 1000000,
    cost_output_token: 0.6 / 1000000,
    max_retries: 10,
  },
  {
    model: 'gpt-3.5-turbo',
    cost_input_token: 0.5 / 1000000,
    cost_output_token: 1.5 / 1000000,
    max_retries: 10,
  },
  {
    model: 'gpt-4o',
    cost_input_token: 5 / 1000000,
    cost_output_token: 15 / 1000000,
    max_retries: 10,
  },
  {
    model: 'gpt-4-turbo',
    cost_input_token: 10 / 1000000,
    cost_output_token: 30 / 1000000,
    max_retries: 10,
  },
  {
    model: 'gpt-4',
    cost_input_token: 30 / 1000000,
    cost_output_token: 60 / 1000000,
    max_retries: 10,
  },
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
async function completionBackoff(payload) {
  for (let i = 0; i < MODELS.length; i += 1) {
    const model = MODELS[i];
    try {
      const completion = await client.chat.completions.create({
        ...payload,
        model: model.model,
      }, {
        maxRetries: model.max_retries,
      });
      const { content } = completion.choices[0].message;
      if (!content) {
        throw new Error(completion);
      }
      return {
        content,
        costUSD:
          completion.usage.prompt_tokens * model.cost_input_token
          + completion.usage.completion_tokens * model.cost_output_token,
      };
    } catch (err) {
      logger.error('openai', err);
    }
  }
  throw new Error('Could not do OpenAI completion');
}

/**
 * Summarize
 *
 * @param {*} { text, maxWords }
 * @return {String}
 */
async function summarize({ text, maxWords }) {
  if (process.env.NODE_ENV === 'test') {
    return {
      summary: text,
      context: text,
      costUSD: 0,
    };
  }

  if (!client) throw new Error('No OpenAI key is defined');

  const promptPayload = {
    messages: [{
      role: 'user',
      content: `
## Instructions

1. You are provided with a document that needs to be summarized.
2. Your task is to create a concise summary of the document, capturing its key points and main ideas in up to ${maxWords} words.
3. This summary will be used for embeddings and similarity search purposes.
4. Ensure that the summary is clear, accurate, and retains the essence of the original document.
5. After the summary is generated, also create a sort couple of sentences text that summarizes the summary, called context.

Response in JSON format.

Example response:
{
  "summary": "This is summary of the document",
  "context": "This is a short summary of the summary"
}

## Document:
${text}
      `,
    }],
    temperature: 0.0,
    response_format: { type: 'json_object' },
  };

  // Check if we have a response in Redis
  const cacheKey = `prompt:${md5(JSON.stringify(promptPayload))}`;
  let content = await registry.get(cacheKey);
  if (content) {
    return {
      ...content,
      costUSD: 0,
    };
  }

  // No cache, recreate it
  const completion = await completionBackoff(promptPayload);
  content = completion.content;

  const json = JSON.parse(content);

  const response = {
    summary: json.summary,
    context: json.context,
    costUSD: completion.costUSD,
  };

  // Cache it
  await registry.set(cacheKey, response, PROMPT_CACHE_SEC);

  return response;
}

/**
 * Question bank
 *
 * @param {*} { text }
 * @return {String}
 */
async function questionBank({ text }) {
  if (process.env.NODE_ENV === 'test') {
    return {
      questions: [],
      costUSD: 0,
    };
  }

  if (!client) throw new Error('No OpenAI key is defined');

  const promptPayload = {
    messages: [{
      role: 'user',
      content: `
You are an AI designed to create a knowledge base by generating questions based on the provided document.
Given the document below, return questions that can be directly answered using the information from the document.
Ensure the questions are clear, concise, and relevant to the key details in the document, and return them in a JSON array format.

# Instructions:
1. Read the provided document carefully.
2. Identify key details, facts, and concepts.
3. Formulate questions based on these key details. Each question should be answerable using the available information from the document only.
4. Ensure the questions cover a range of information from the text, including but not limited to definitions, explanations, dates, names, events, processes, and relationships.
5. Do not refer to the "document" or "text" in the generated questions. Do not use these words.
6. Return questions in a JSON array format.

Example JSON reponse:
{
  "questions": [
    "Question 1",
    "Question 2",
    "Question 3"
  ]
}

Now, generate questions from the provided document:

${text}
      `,
    }],
    temperature: 0.0,
    response_format: { type: 'json_object' },
  };

  // Check if we have a response in Redis
  const cacheKey = `prompt:${md5(JSON.stringify(promptPayload))}`;
  let content = await registry.get(cacheKey);
  if (content) {
    return {
      ...content,
      costUSD: 0,
    };
  }

  // No cache, recreate it
  const completion = await completionBackoff(promptPayload);
  content = completion.content;

  const response = {
    questions: JSON.parse(content).questions,
    costUSD: completion.costUSD,
  };

  // Cache it
  await registry.set(cacheKey, response, PROMPT_CACHE_SEC);

  return response;
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

  const model = _.find(MODELS, (m) => m.model === 'gpt-4o');

  let text = '';
  const messages = [...(chatHistory || [])];
  messages.push({ role: 'user', content: query });

  const runner = await client.beta.chat.completions.runTools({
    model: model.model,
    temperature: 0.0,
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
    costUSD: res.usage
      ? (res.usage.prompt_tokens * model.cost_input_token)
        + (res.usage.completion_tokens * model.cost_output_token)
      : 0,
    text,
    chatHistory: messages,
  };
}

module.exports = {
  summarize,
  questionBank,
  chatStream,
};
