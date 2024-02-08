const User = require("../models/User");
const { makeAccessToken, makeRefreshToken } = require("../utils/jwtUtils");
const { COOKIE_MAX_AGE } = require("../utils/constants");

const registrationController = async (req, res, next) => {
  try {
    const {
      email,
      displayName: userName,
      photoURL: avatarUrl,
      uid: googleId,
      oauthAccessToken,
      oauthRefreshToken,
    } = req.body;

    const findUser = await User.findOne({ email });

    if (findUser) {
      const accessToken = makeAccessToken(findUser._id);
      const refreshToken = makeRefreshToken(findUser._id);

      await User.findByIdAndUpdate(findUser._id, {
        $set: {
          refreshToken,
          oauthAccessToken,
          oauthRefreshToken,
        },
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
          userInfo: { email: findUser.email, userName: findUser.userName },
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
          userInfo: { email: newUser.email, userName: newUser.userName },
        });
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = { registrationController };
