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
    default: "CONNECTED_DB_DONE",
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

module.exports = mongoose.model("TaskStatus", taskStatusSchema);
