const _ = require('lodash');

const CANNED_RESPONSES = [
  'I\'m sorry, I don\'t have enough information to answer that. Could you please provide more details?',
  'It looks like I need more context to give a proper response. Could you elaborate on your question?',
  'I\'m not quite sure how to answer that with the information I have. Can you clarify or provide additional details?',
  'To give you a better answer, I need more information about your question. Could you be more specific?',
  'I need a bit more context to help with your query. Could you give me some more details?',
  'I\'m having trouble understanding your question fully. Could you explain a bit more?',
  'It seems like I don\'t have enough context to provide a good answer. Can you tell me more?',
  'I want to make sure I give you the best answer possible. Could you provide more information?',
  'I\'m not sure I understand the question completely. Could you please clarify?',
  'I need more details to provide an accurate response. Could you elaborate on what you\'re asking?',
  'Your question is a bit too vague for me to answer accurately. Can you provide more context?',
  'I want to help, but I need more information to do so. Can you tell me more about what you\'re asking?',
  'Could you please give me more details so I can better understand your question?',
  'To answer your question properly, I need more context. Could you provide additional information?',
  'I\'m not sure how to respond with the information I have. Can you clarify or give more details?',
  'Could you elaborate on your question? I need more context to give a useful answer.',
  'It seems like I need additional details to answer your question accurately. Can you provide more information?',
  'I\'m having difficulty understanding your query fully. Could you explain in more detail?',
  'I need more context to answer that effectively. Could you give me some additional information?',
  'To assist you better, I need a bit more information. Could you clarify your question?',
];

/**
 * Generate a random canned response when LLM has no context
 *
 * @return {String}
 */
function getCannedResponse() {
  return CANNED_RESPONSES[_.random(0, CANNED_RESPONSES.length - 1)];
}

module.exports = {
  getCannedResponse,
};
