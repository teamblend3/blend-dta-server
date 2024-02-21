const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: new Date(),
  },
  collectionName: {
    type: String,
    required: true,
    default: "all",
  },
  project: {
    type: mongoose.Types.ObjectId,
    ref: "Project",
  },
});

module.exports = mongoose.model("Log", logSchema);
