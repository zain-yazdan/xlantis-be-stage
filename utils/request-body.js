function checkMissingAttributes(requestBody, attributes) {
  for (let i = 0; i < attributes.length; i++) {
    if (requestBody[attributes[i]] == undefined) return attributes[i];
  }
  return null;
}

function checkEmptyAttributes(requestBody, attributes) {
  for (let i = 0; i < attributes.length; i++) {
    if (requestBody[attributes[i]] === "") {
      return attributes[i];
    }
  }
  return null;
}
function constructObject(requestBody, attributes) {
  let object = {};
  for (let i = 0; i < attributes.length; i++) {
    if (requestBody[attributes[i]] != undefined) {
      object[attributes[i]] = requestBody[attributes[i]];
    }
  }
  return object;
}
function validatePaginationParams(start, end) {
  if (!start)
    return { success: false, message: "start not found in the params" };
  else if (!end)
    return { success: false, message: "end not found in the params" };
  else if (start < 0)
    return {
      success: false,
      message: "Starting index must be greater than or equal to 0",
    };
  else if (end <= 0)
    return { success: false, message: "Ending index must be greater than 0" };
  else if (start > end)
    return {
      success: false,
      message: "Ending index must be greater than starting index",
    };
  else if (start == end)
    return {
      success: false,
      message: "Starting index and ending index must not be same",
    };
  else return { success: true, message: "Validated passed" };
}

const validateTxHash = (txHash) => {
  if (txHash.length !== 66) {
    return {
      success: false,
      message: "Invalid txHash sent in request body!",
    };
  }

  return { success: true, message: "validation successful" };
};

function isTimeValid(_startTime, _endTime) {
  const startTime = new Date(_startTime);
  const endTime = new Date(_endTime);
  if (startTime.getTime() < Date.now())
    return {
      success: false,
      message: "Start time should not be from the past.",
    };
  else if (startTime.getTime() >= endTime.getTime())
    return {
      success: false,
      message: "Start time should be less than the end time.",
    };
  else return { success: true, message: "Validation passed" };
}

module.exports.validatePaginationParams = validatePaginationParams;
module.exports.constructObject = constructObject;
module.exports.checkMissingAttributes = checkMissingAttributes;
module.exports.checkEmptyAttributes = checkEmptyAttributes;
module.exports.validateTxHash = validateTxHash;
module.exports.isTimeValid = isTimeValid;
