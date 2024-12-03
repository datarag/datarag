const _ = require('lodash');

module.exports = ({ history, query }) => {
  let prompt = `
Given a chat history and the latest user query
which might reference context in the chat history,
formulate a standalone query which can be understood
without the chat history. Do NOT answer the query,
just reformulate it if needed and otherwise return it as is.

        `;

  _.each(history, (entry) => {
    prompt += `
User:
"""
${entry.user}
"""

Assistant:
"""
${entry.assistant}
"""

  `;
  });

  prompt += `
User query:
${query}
  `;

  return {
    prompt,
  };
};
