const { google } = require("googleapis");

const User = require("../models/User");
const { makeAccessToken, makeRefreshToken } = require("./jwtUtils");
const { COOKIE_MAX_AGE } = require("./constants");

const configureOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.CLIENT_URL,
  );
};

const getOAuthTokens = async (code, auth) => {
  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);
  return tokens;
};

const fetchGoogleUserInfo = async auth => {
  const userAuth = google.oauth2({ auth, version: "v2" });
  const { data } = await userAuth.userinfo.get();
  return data;
};
const createUser = async (userInfo, tokens) => {
  const newUser = await User.create({
    email: userInfo.email,
    userName: userInfo.name,
    avatarUrl: userInfo.picture,
    googleId: userInfo.id,
    oauthAccessToken: tokens.access_token,
    oauthRefreshToken: tokens.refresh_token,
  });
  return newUser;
};
const updateUserTokens = async (userId, tokens) => {
  await User.findByIdAndUpdate(userId, {
    oauthAccessToken: tokens.access_token,
    oauthRefreshToken: tokens.refresh_token,
  });
};

const generateTokens = userId => {
  return {
    accessToken: makeAccessToken(userId),
    refreshToken: makeRefreshToken(userId),
  };
};

const sendAuthCookies = (res, accessToken, refreshToken) => {
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
    });
};

const sendUserInfoResponse = (res, user) => {
  res.json({
    success: true,
    userInfo: {
      email: user.email,
      userName: user.userName || user.name,
      avatarUrl: user.avatarUrl || user.picture,
      userId: user._id,
    },
  });
};

function clearCookies(res) {
  res
    .clearCookie("accessToken", {
      httpOnly: true,
    })
    .clearCookie("refreshToken", {
      httpOnly: true,
    });
}

module.exports = {
  configureOAuthClient,
  getOAuthTokens,
  fetchGoogleUserInfo,
  createUser,
  updateUserTokens,
  generateTokens,
  sendAuthCookies,
  sendUserInfoResponse,
  clearCookies,
};
