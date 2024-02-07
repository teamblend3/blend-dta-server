const jwt = require("jsonwebtoken");
const createHttpError = require("http-errors");
const User = require("../models/User");

const {
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} = require("../utils/constants");

const { jwtVerifyToken } = require("../utils/jwtUtils");

const verifyToken = async (req, res, next) => {
  try {
    const { accessToken, refreshToken } = req.cookies;
    const decodedAccessToken = jwtVerifyToken(accessToken);
    const decodedRefreshToken = jwtVerifyToken(refreshToken);

    if (!accessToken && !refreshToken) {
      req.user = null;

      return next();
    }

    if (!accessToken && refreshToken) {
      if (decodedRefreshToken.type) {
        const findUser = await User.findById(decodedRefreshToken.id);

        req.user = findUser._id;

        const newAccessToken = jwt.sign(
          { id: findUser._id },
          process.env.SECRET_KEY,
        );

        res.status(201).cookie("accessToken", newAccessToken, {
          maxAge: ACCESS_TOKEN_MAX_AGE,
          httpOnly: true,
        });

        return next();
      }
      return next(createHttpError(401, "Unauthorized"));
    }

    if (
      !decodedAccessToken.type &&
      decodedAccessToken.message === "jwt expired"
    ) {
      if (!decodedRefreshToken.type) {
        return next(createHttpError(401, "Unauthorized"));
      }

      const findUser = await User.findById(decodedRefreshToken.id);

      if (findUser.refreshToken === refreshToken) {
        req.user = findUser._id;

        const newAccessToken = jwt.sign(
          { id: findUser._id },
          process.env.SECRET_KEY,
        );

        res.status(201).cookie("accessToken", newAccessToken, {
          maxAge: ACCESS_TOKEN_MAX_AGE,
          httpOnly: true,
        });

        return next();
      }

      return next();
    }

    if (
      !decodedRefreshToken.type &&
      decodedRefreshToken.message === "jwt expired"
    ) {
      const findUser = await User.findById(decodedAccessToken.id);

      req.user = findUser.id;

      const newRefreshToken = jwt.sign(
        { id: findUser._id },
        process.env.SECRET_KEY,
      );

      await User.findByIdAndUpdate(decodedAccessToken.id, {
        refreshToken: newRefreshToken,
      });

      res.cookie("refreshToken", newRefreshToken, {
        maxAge: REFRESH_TOKEN_MAX_AGE,
        httpOnly: true,
      });

      return next();
    }

    req.user = decodedAccessToken.id;

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { verifyToken };
