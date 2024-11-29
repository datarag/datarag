/**
 * Serialize datasource
 *
 * @param {*} model
 * @return {*}
 */
function serializeDatasource(model) {
  return {
    id: model.resId,
    name: model.name,
    purpose: model.purpose,
    date: model.createdAt.toISOString(),
  };
}

/**
 * Serialize agent
 *
 * @param {*} model
 * @return {*}
 */
function serializeAgent(model) {
  return {
    id: model.resId,
    name: model.name,
    purpose: model.purpose,
    date: model.createdAt.toISOString(),
  };
}

/**
 * Serialize document
 *
 * @param {*} model
 * @return {*}
 */
function serializeDocument(model) {
  return {
    id: model.resId,
    name: model.name,
    type: model.contentType,
    status: model.status,
    hash: model.contentHash,
    size: model.contentSize,
    date: model.createdAt.toISOString(),
    metadata: model.metadata,
  };
}

/**
 * Serialize connector
 *
 * @param {*} model
 * @return {*}
 */
function serializeConnector(model) {
  return {
    id: model.resId,
    name: model.name,
    purpose: model.purpose,
    endpoint: model.endpoint,
    method: model.method,
    payload: model.payload,
    metadata: model.metadata,
    date: model.createdAt.toISOString(),
  };
}

/**
 * Serialize conversation
 *
 * @param {*} model
 * @return {*}
 */
function serializeConversation(model) {
  return {
    id: model.resId,
    title: model.title,
    date: model.updatedAt.toISOString(),
  };
}

module.exports = {
  serializeDatasource,
  serializeAgent,
  serializeDocument,
  serializeConnector,
  serializeConversation,
};
