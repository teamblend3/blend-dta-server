const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  userName: {
    type: String,
    required: true,
  },
  googleId: {
    type: String,
    required: true,
    unique: true,
  },
  avatarUrl: {
    type: String,
    required: true,
  },
  projects: [
    {
      type: mongoose.Types.ObjectId,
      ref: "Project",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  refreshToken: {
    type: String,
    unique: true,
  },
});

module.exports = mongoose.model("User", userSchema);
