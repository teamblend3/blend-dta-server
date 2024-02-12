const User = require("../models/User");
const { makeAccessToken, makeRefreshToken } = require("../utils/jwtUtils");
const { COOKIE_MAX_AGE } = require("../utils/constants");

const login = async (req, res, next) => {
  try {
    const {
      email,
      displayName: userName,
      photoURL: avatarUrl,
      uid: googleId,
      oauthAccessToken,
      oauthRefreshToken,
    } = req.body;
    const findUser = await User.findOne({ email }).lean();

    if (findUser) {
      const accessToken = makeAccessToken(findUser._id);
      const refreshToken = makeRefreshToken(findUser._id);
      await User.findByIdAndUpdate(findUser._id, {
        refreshToken,
        oauthAccessToken,
        oauthRefreshToken,
      });

      res
        .cookie("accessToken", accessToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
          secure: true,
        })
        .cookie("refreshToken", refreshToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
          secure: true,
        })
        .json({
          success: true,
          userInfo: {
            email: findUser.email,
            userName: findUser.userName,
            avatarUrl: findUser.avatarUrl,
            userId: findUser._id,
          },
        });
    } else {
      const newUser = await User.create({
        email,
        userName,
        avatarUrl,
        googleId,
        oauthAccessToken,
        oauthRefreshToken,
      });
      const accessToken = makeAccessToken(newUser._id);
      const refreshToken = makeRefreshToken(newUser._id);

      await User.findByIdAndUpdate(newUser._id, { refreshToken });

      res
        .cookie("accessToken", accessToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
          secure: true,
        })
        .cookie("refreshToken", refreshToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
          secure: true,
        })
        .json({
          success: true,
          userInfo: {
            email: newUser.email,
            userName: newUser.userName,
            avatarUrl: newUser.avatarUrl,
            userId: newUser._id,
          },
        });
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = { login };
