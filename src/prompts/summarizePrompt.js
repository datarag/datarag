module.exports = ({
  text,
}) => {
  return `
## Instructions

You are provided with a document that needs to be summarized.
Your task is to create a concise summary of the document, capturing its key points and main ideas.
Ensure that the summary is clear, accurate, and retains the essence of the original document.

After the summary is generated, also create a sort couple of sentences text that summarizes the summary, called context.

Additionally, generate a comprehensive list of frequently asked questions (FAQ) that can be answered by this document.
The generated questions should refer to the context of the document and not be generic or vague.

The summary, context and the FAQ should be in the language of the original document.

Response in JSON format.

Example response:
{
  "summary": "This is summary of the document",
  "context": "This is a short summary of the summary",
  "faq": [
    "question": "What is this document about?"
    "answer": "It is about this and that."
  ]
}

## Document:
${text}
  `;
};
