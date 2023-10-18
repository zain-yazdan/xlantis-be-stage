const DropModel = require("../../models/DropModel");

const findDropById = async (dropId) => {
  try {
    const drop = await DropModel.findById({ _id: dropId });
    if (!drop) {
      return {
        success: false,
        message: "Drop not found against drop Id",
      };
    }

    return { success: true, drop };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = {
  findDropById,
};
