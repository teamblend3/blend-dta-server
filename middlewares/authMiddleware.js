const createHttpError = require("http-errors");
const User = require("../models/User");
const { COOKIE_MAX_AGE } = require("../utils/constants");
const { makeAccessToken, jwtVerifyToken } = require("../utils/jwtUtils");

const updateAccessToken = async (userId, res) => {
  const newAccessToken = makeAccessToken(userId);
  res.status(201).cookie("accessToken", newAccessToken, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
  });
};

const verifyToken = async (req, res, next) => {
  try {
    const { accessToken, refreshToken } = req.cookies;

    if (!accessToken && !refreshToken) {
      return next();
    }

    const decodedAccessToken = accessToken ? jwtVerifyToken(accessToken) : null;
    const decodedRefreshToken = refreshToken
      ? jwtVerifyToken(refreshToken)
      : null;

    if (
      (!decodedAccessToken || decodedAccessToken.message === "jwt expired") &&
      decodedRefreshToken?.type
    ) {
      const user = await User.findById(decodedRefreshToken.id);
      if (!user) {
        return next(createHttpError(401, "Unauthorized - User not found"));
      }

      req.user = user._id;
      await updateAccessToken(user._id, res);
      return next();
    }

    if (decodedAccessToken?.type) {
      req.user = decodedAccessToken.id;
      return next();
    }

    if (!decodedRefreshToken || decodedRefreshToken.message === "jwt expired") {
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      return next(createHttpError(401, "Unauthorized - Invalid Refresh Token"));
    }

    // 모든 검증 실패 시
    return next(createHttpError(401, "Unauthorized"));
  } catch (error) {
    return next(
      createHttpError(500, "Server Error - Token verification failed"),
    );
  }
};

module.exports = { verifyToken };
