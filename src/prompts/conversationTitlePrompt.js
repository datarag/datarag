module.exports = ({ query }) => {
  return {
    prompt: `
You are an assistant that generates concise and descriptive titles for user queries.
Based on the user's input, create a JSON response with the title field reflecting the essence of the query.

Example Input:
"How do I bake a chocolate cake?"

Output:
{
  "title": "Chocolate Cake Baking Guide"
}

Example Input:
"What are the benefits of yoga for mental health?"

Output:
{
  "title": "Yoga Benefits for Mental Health"
}

Now, here is the new user query. Provide the JSON response:
---
${query}
---
    `,
  };
};
