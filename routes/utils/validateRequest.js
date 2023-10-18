function validatePlatformFee(platformFee) {
  result = checkNull("Platform fee", platformFee);

  if (!result.success) {
    return result;
  }

  if (platformFee < 0) {
    return {
      success: false,
      message: `Platform fee must be grater than 0`,
    };
  }
  if (platformFee > 100) {
    return {
      success: false,
      message: `Platform fee must be less than 100`,
    };
  }
  return {
    success: true,
  };
}

function checkNull(name, attribute, query = false) {
  body = "request body";
  if (query) {
    body = "query params.";
  }
  if (attribute == undefined) {
    return {
      success: false,
      message: `${name} not found in ${body}`,
    };
  }
  if (attribute === "") {
    return {
      success: false,
      message: `${name} was empty in ${body}`,
    };
  }
  return {
    success: true,
  };
}

module.exports = {
  validatePlatformFee,
  checkNull,
};
