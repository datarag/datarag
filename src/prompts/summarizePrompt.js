module.exports = ({
  maxWords,
  text,
}) => {
  return `
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
  `;
};
