const express = require("express");
const { makeAccessToken, makeRefreshToken } = require("../utils/jwtUtils");
const {
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} = require("../utils/constants");

const User = require("../models/User");
const { verifyToken } = require("../middlewares/authMiddleware");

const route = express.Router();

route.get("/", (req, res, next) => {
  try {
    console.log(req);
    res.send("User router");
  } catch (error) {
    next(error);
  }
});

route.post("/login", async (req, res, next) => {
  try {
    console.log(req);
    const {
      email,
      displayName: username,
      photoURL: avatarUrl,
      uid: googleId,
    } = req.body;

    const findUser = await User.findOne({ email });
    if (findUser) {
      const accessToken = makeAccessToken(findUser._id);
      const refreshToken = makeRefreshToken(findUser._id);

      await User.findByIdAndUpdate(findUser._id, { refreshToken });

      res
        .cookie("accessToken", accessToken, {
          maxAge: ACCESS_TOKEN_MAX_AGE,
          httpOnly: true,
          secure: true,
        })
        .cookie("refreshToken", refreshToken, {
          maxAge: REFRESH_TOKEN_MAX_AGE,
          httpOnly: true,
          secure: true,
        })
        .json({
          success: true,
          userInfo: { email: findUser.email, username: findUser.username },
        });
    } else {
      const newUser = await User.create({
        email,
        username,
        avatarUrl,
        googleId,
      });

      const accessToken = makeAccessToken(newUser._id);
      const refreshToken = makeRefreshToken(newUser._id);

      await User.findByIdAndUpdate(newUser._id, { refreshToken });
      res
        .cookie("accessToken", accessToken, {
          maxAge: ACCESS_TOKEN_MAX_AGE,
          httpOnly: true,
          secure: true,
        })
        .cookie("refreshToken", refreshToken, {
          maxAge: REFRESH_TOKEN_MAX_AGE,
          httpOnly: true,
          secure: true,
        })
        .json({
          success: true,
          userInfo: { email: newUser.email, username: newUser.username },
        });
    }
  } catch (error) {
    console.log(error);
  }
});

route.get("/validate", verifyToken, async (req, res, next) => {
  try {
    if (req.user) {
      const user = await User.findById(req.user);

      const userInfo = {
        username: user.username,
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
