const createHttpError = require("http-errors");
const User = require("../models/User");
const { COOKIE_MAX_AGE } = require("../utils/constants");
const {
  makeAccessToken,
  makeRefreshToken,
  jwtVerifyToken,
} = require("../utils/jwtUtils");

const verifyToken = async (req, res, next) => {
  try {
    const { accessToken, refreshToken } = req.cookies;
    const decodedAccessToken = jwtVerifyToken(accessToken);
    const decodedRefreshToken = jwtVerifyToken(refreshToken);

    if (!accessToken && !refreshToken) {
      req.user = null;

      return next(createHttpError(401, "Unauthorized"));
    }

    if (!accessToken || !decodedAccessToken.type) {
      if (decodedRefreshToken.type) {
        const findUser = await User.findById(decodedRefreshToken.id);

        if (findUser.refreshToken === refreshToken) {
          req.user = findUser._id;

          const newAccessToken = makeAccessToken(findUser._id);

          res.status(201).cookie("accessToken", newAccessToken, {
            maxAge: COOKIE_MAX_AGE,
            httpOnly: true,
          });

          return next();
        }

        return next(createHttpError(401, "Unauthorized"));
      }

      return next(createHttpError(401, "Unauthorized"));
    }

    if (decodedAccessToken.message === "jwt expired") {
      if (decodedRefreshToken.type) {
        const findUser = await User.findById(decodedRefreshToken.id);
        const newAccessToken = makeAccessToken(findUser._id);

        res.status(201).cookie("accessToken", newAccessToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
        });

        return next();
      }

      return next(createHttpError(401, "Unauthorized"));
    }

    if (!decodedRefreshToken.type) {
      const findUser = await User.findById(decodedAccessToken.id);

      req.user = findUser.id;

      if (findUser.refreshToken === refreshToken) {
        const newRefreshToken = makeRefreshToken(findUser._id);

        res.cookie("refreshToken", newRefreshToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
        });

        return next();
      }

      return next(createHttpError(401, "Unauthorized"));
    }

    if (decodedRefreshToken.message === "jwt expired") {
      const newRefreshToken = makeRefreshToken(decodedRefreshToken.id);

      await User.findByIdAndUpdate(decodedAccessToken.id, {
        refreshToken: newRefreshToken,
      });

      res.cookie("refreshToken", newRefreshToken, {
        maxAge: COOKIE_MAX_AGE,
        httpOnly: true,
      });

      return next();
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { verifyToken };
