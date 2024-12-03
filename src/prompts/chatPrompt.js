const _ = require('lodash');

module.exports = ({
  knowledgeBase,
  conversationHistory,
  query,
}) => {
  const prompt = [];

  if (!_.isEmpty(knowledgeBase)) {
    prompt.push('# Knowledge base documents\n');
    _.each(knowledgeBase, (entry) => {
      prompt.push('"""');
      prompt.push(`Document id: ${entry.id}\n`);
      _.each(entry.metadata, (value, key) => {
        prompt.push(`${key}: ${_.isString(value) ? value : JSON.stringify(value)}`);
      });
      prompt.push(`\n${entry.text}`);
      prompt.push('"""\n');
    });
    prompt.push('-------\n');
  }

  if (!_.isEmpty(conversationHistory)) {
    prompt.push('# Conversation history\n');
    _.each(conversationHistory, (entry) => {
      prompt.push('User:');
      prompt.push(`${entry.user}\n`);
      prompt.push('Assistant:');
      prompt.push(`${entry.assistant}\n`);
    });
    prompt.push('-------\n');
  }

  prompt.push('Now answer this user query by following your instructions:');
  prompt.push(query);

  return {
    prompt: prompt.join('\n'),
  };
};
