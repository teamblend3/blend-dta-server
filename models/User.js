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
  avatarUrl: {
    type: String,
    required: true,
  },
  googleId: {
    type: String,
    required: true,
    unique: true,
  },
  projects: [
    {
      type: mongoose.Types.ObjectId,
      ref: "Project",
    },
  ],
  refreshToken: {
    type: String,
  },
  oauthAccessToken: {
    type: String,
    required: true,
  },
  oauthRefreshToken: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("User", userSchema);
