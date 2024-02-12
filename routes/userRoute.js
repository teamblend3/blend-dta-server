const express = require("express");
const User = require("../models/User");
const { verifyToken } = require("../middlewares/authMiddleware");
const { login } = require("../controllers/userController");

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

route.get("/validate", verifyToken, async (req, res, next) => {
  try {
    if (req.user) {
      const user = await User.findById(req.user);

      const userInfo = {
        userName: user.userName,
        userId: req.user,
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
