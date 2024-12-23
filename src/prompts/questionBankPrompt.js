module.exports = ({
  text,
}) => {
  return `
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
  `;
};
