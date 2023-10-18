async function getCountByFilter(model, filter) {
  const count = await model.countDocuments(filter);
  return count;
}

async function getOneByFilter(name, model, filter, message = undefined) {
  const document = await model.findOne(filter);

  if (!document) {
    return {
      success: false,
      message: message == undefined ? `${name} not found.` : message,
    };
  }
  return {
    success: true,
    document: document,
  };
}

async function getAllByFilter(name, model, filter, message = undefined) {
  const document = await model.find(filter);

  if (!document || document.length === 0) {
    return {
      success: false,
      message: message == undefined ? `${name} not found.` : message,
    };
  }
  return {
    success: true,
    document: document,
  };
}

module.exports = {
  getCountByFilter,
  getAllByFilter,
  getOneByFilter,
};
