const express = require("express");
const multer = require("multer");

const User = require("../models/User");
const { verifyToken } = require("../middlewares/authMiddleware");
const {
  login,
  getUserProfile,
  editUserProfile,
} = require("../controllers/userController");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const route = express.Router();

route.get("/", (req, res, next) => {
  try {
    console.log(req);
    res.send("User router");
  } catch (error) {
    next(error);
  }
});

route.post("/login", login);

route.get("/:id/profile", verifyToken, getUserProfile);
route.post(
  "/:id/profile",
  verifyToken,
  upload.single("avatarUrl"),
  editUserProfile,
);

route.get("/validate", verifyToken, async (req, res, next) => {
  try {
    if (req.user) {
      const user = await User.findById(req.user);
      const userInfo = {
        userName: user.userName,
        userId: req.user,
        email: user.email,
        avatarUrl: user.avatarUrl,
      };

      res.json({ success: true, userInfo });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    next(error);
  }
});

route.get("/logout", async (req, res, next) => {
  try {
    res.clearCookie("AccessToken", { httpOnly: true });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = route;
