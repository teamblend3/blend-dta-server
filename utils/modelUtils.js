const TaskStatus = require("../models/TaskStatus");

const updateTaskStatus = async (taskId, message, additionalFields = {}) => {
  const updateFields = {
    message,
    ...additionalFields,
  };

  await TaskStatus.findByIdAndUpdate(taskId, updateFields);
};

module.exports = { updateTaskStatus };
