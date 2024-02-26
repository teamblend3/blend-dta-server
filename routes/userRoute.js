const express = require("express");
const multer = require("multer");

const { verifyToken } = require("../middlewares/authMiddleware");
const {
  mockLogin,
  login,
  getUserProfile,
  editUserProfile,
  getUserProjects,
  validateUser,
  getUserProjectsLogs,
  logout,
} = require("../controllers/userController");

const route = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

route.post("/mock-login", mockLogin);
route.post("/login", login);
route.get("/projects", verifyToken, getUserProjects);
route.get("/projects/logs", verifyToken, getUserProjectsLogs);
route.get("/:id/profile", verifyToken, getUserProfile);
route.post(
  "/:id/profile",
  verifyToken,
  upload.single("avatarUrl"),
  editUserProfile,
);
route.get("/validate", verifyToken, validateUser);
route.get("/logout", verifyToken, logout);

module.exports = route;
