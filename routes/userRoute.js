const express = require("express");
const multer = require("multer");

const { verifyToken } = require("../middlewares/authMiddleware");
const {
  login,
  getUserProfile,
  editUserProfile,
  getUserProjects,
  validateUser,
} = require("../controllers/userController");

const route = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

route.post("/login", login);
route.get("/projects", verifyToken, getUserProjects);
route.get("/:id/profile", verifyToken, getUserProfile);
route.post(
  "/:id/profile",
  verifyToken,
  upload.single("avatarUrl"),
  editUserProfile,
);
route.get("/validate", verifyToken, validateUser);
route.get("/logout", async (req, res, next) => {
  try {
    res.clearCookie("AccessToken", { httpOnly: true });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = route;
