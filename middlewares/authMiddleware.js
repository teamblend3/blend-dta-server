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

    if (!accessToken && !refreshToken) {
      req.user = null;

      return next(createHttpError(401, "Unauthorized"));
    }

    const decodedAccessToken = jwtVerifyToken(accessToken);
    const decodedRefreshToken = jwtVerifyToken(refreshToken);

    if (!accessToken && refreshToken) {
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

    if (decodedAccessToken.message === "jwt expired") {
      if (decodedRefreshToken.type) {
        const newAccessToken = makeAccessToken(decodedRefreshToken._id);

        res.status(201).cookie("accessToken", newAccessToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
        });

        return next();
      }

      return next(createHttpError(401, "Unauthorized"));
    }

    if (!decodedAccessToken.type) {
      if (decodedRefreshToken.type) {
        const newAccessToken = makeAccessToken(decodedRefreshToken._id);

        res.status(201).cookie("accessToken", newAccessToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
        });

        return next();
      }

      return next(createHttpError(401, "Unauthorized"));
    }

    if (
      !decodedRefreshToken.type ||
      decodedRefreshToken.message === "jwt expired"
    ) {
      return next(createHttpError(401, "Unauthorized"));
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { verifyToken };
