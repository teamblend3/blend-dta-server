const express = require("express");
const multer = require("multer");

const { verifyToken } = require("../middlewares/authMiddleware");
const {
  login,
  getUserProfile,
  editUserProfile,
  getUserProjects,
  validateUser,
  getUserProjectsLogs,
  logout,
} = require("../controllers/userController");
const { onlyPublic, onlyPrivate } = require("../middlewares/protectRoute");

const route = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

route.post("/login", onlyPublic, login);
route.get("/projects", verifyToken, onlyPrivate, getUserProjects);
route.get("/projects/logs", verifyToken, onlyPrivate, getUserProjectsLogs);
route.get("/:id/profile", verifyToken, onlyPrivate, getUserProfile);
route.post(
  "/:id/profile",
  verifyToken,
  onlyPrivate,
  upload.single("avatarUrl"),
  editUserProfile,
);
route.get("/validate", verifyToken, onlyPrivate, validateUser);
route.get("/logout", verifyToken, onlyPrivate, logout);

module.exports = route;
