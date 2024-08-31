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
  };
}

module.exports = {
  serializeDatasource,
  serializeAgent,
  serializeDocument,
  serializeConnector,
};
