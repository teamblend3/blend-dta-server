const createHttpError = require("http-errors");
const User = require("../models/User");
const { COOKIE_MAX_AGE } = require("../utils/constants");
const {
  makeAccessToken,
  jwtVerifyToken,
  makeRefreshToken,
} = require("../utils/jwtUtils");

const verifyToken = async (req, res, next) => {
  try {
    const { accessToken, refreshToken } = req.cookies;

    if (!accessToken && !refreshToken) {
      req.user = null;

      return next();
    }

    const decodedAccessToken = jwtVerifyToken(accessToken);
    const decodedRefreshToken = jwtVerifyToken(refreshToken);

    if (!accessToken && refreshToken) {
      if (decodedRefreshToken.type) {
        const findUser = await User.findById(decodedRefreshToken.id);

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

    if (
      !decodedAccessToken.type ||
      decodedAccessToken.message === "jwt expired"
    ) {
      if (decodedRefreshToken.type) {
        const findUser = await User.findById(decodedRefreshToken.id);

        req.user = findUser._id;

        const newAccessToken = makeAccessToken(findUser._id);

        res.status(201).cookie("accessToken", newAccessToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
        });

        return next();
      }

      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");

      return next(createHttpError(401, "Unauthorized"));
    }

    if (
      !decodedRefreshToken.type ||
      decodedRefreshToken.message === "expired jwt"
    ) {
      if (decodedAccessToken.type) {
        const findUser = await User.findById(decodedAccessToken.id);
        const newRefreshToken = makeRefreshToken(findUser._id);

        await User.findByIdAndUpdate(findUser._id, {
          refreshToken: newRefreshToken,
        });

        req.user = findUser._id;
        res.status(201).cookie("refreshToken", newRefreshToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
        });

        return next();
      }

      req.user = null;
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");

      return next(createHttpError(401, "Unauthorized"));
    }

    req.user = decodedAccessToken.id;

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { verifyToken };
