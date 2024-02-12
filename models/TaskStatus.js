const mongoose = require("mongoose");

const taskStatusSchema = new mongoose.Schema({
  statusId: {
    type: String,
    required: true,
    unique: true,
  },
  message: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("TaskStatus", taskStatusSchema);
