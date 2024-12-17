const _ = require('lodash');

module.exports = ({
  conversationHistory,
  query,
}) => {
  const prompt = [];

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

  return prompt.join('\n');
};
