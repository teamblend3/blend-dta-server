const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  dbUrl: {
    type: String,
    required: true,
  },
  dbId: {
    type: String,
    required: true,
  },
  dbPassword: {
    type: String,
    required: true,
  },
  sheetUrl: {
    type: String,
    required: true,
  },
  collectionNames: [
    {
      type: String,
      default: [],
    },
  ],
  createdAt: {
    type: Date,
    default: new Date(),
  },
  creator: {
    type: mongoose.Types.ObjectId,
    ref: "User",
  },
});

module.exports = mongoose.model("Project", projectSchema);
