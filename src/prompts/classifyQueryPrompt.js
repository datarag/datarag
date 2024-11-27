module.exports = ({ query }) => {
  return {
    prompt: `
You are an advanced text classification system.
Your job is to analyze user queries and classify them into one of three categories:
1. "task": The query requests an action, creation, completion, or performance of a specific task.
2. "question": The query seeks information, clarification, or knowledge about a specific topic.
3. "other": The query does not fit into the above categories, such as casual conversation, ambiguous input, or anything else.

Respond in the following JSON format:
{
  "classification": "task|question|other"
}

Example:
Input: "Can you tell me the capital of France?"
Output:
{
  "classification": "question"
}

Now, classify the following input query:
---
${query}
---
    `,
  };
};
