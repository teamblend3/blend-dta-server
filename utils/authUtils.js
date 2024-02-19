import { google } from "googleapis";
import { makeAccessToken, makeRefreshToken } from "./jwtUtils";
import { COOKIE_MAX_AGE } from "./constants";

export function configureOAuthClient() {
  return new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    "http://localhost:5173",
  );
}

export async function getOAuthTokens(code, auth) {
  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);
  return tokens;
}

export async function fetchGoogleUserInfo(auth) {
  const userAuth = google.oauth2({ auth, version: "v2" });
  const { data } = await userAuth.userinfo.get();
  return data;
}

export async function createUser(userInfo, tokens) {
  return await User.create({
    email: userInfo.email,
    userName: userInfo.name,
    avatarUrl: userInfo.picture,
    googleId: userInfo.id,
    oauthAccessToken: tokens.access_token,
    oauthRefreshToken: tokens.refresh_token,
  });
}

export async function updateUserTokens(userId, tokens) {
  await User.findByIdAndUpdate(userId, {
    oauthAccessToken: tokens.access_token,
    oauthRefreshToken: tokens.refresh_token,
  });
}

export function generateTokens(userId) {
  return {
    accessToken: makeAccessToken(userId),
    refreshToken: makeRefreshToken(userId),
  };
}

export function sendAuthCookies(res, accessToken, refreshToken) {
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
}

export function sendUserInfoResponse(res, user) {
  res.json({
    success: true,
    userInfo: {
      email: user.email,
      userName: user.userName || user.name,
      avatarUrl: user.avatarUrl || user.picture,
      userId: user._id,
    },
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
};
