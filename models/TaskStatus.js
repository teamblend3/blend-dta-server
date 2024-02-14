const mongoose = require("mongoose");

const taskStatusSchema = new mongoose.Schema({
  statusId: {
    type: String,
    required: true,
    unique: true,
  },
  project: {
    type: mongoose.Types.ObjectId,
    ref: "Project",
  },
  message: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
  },
});

module.exports = mongoose.model("TaskStatus", taskStatusSchema);
