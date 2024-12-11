module.exports = ({
  query,
}) => {
  return `
Given a user query, generate a hypothetical paragraph of text that answers the question.

Question:
${query}

Paragraph:
  `;
};
