const COOKIE_MAX_AGE = 4 * 60 * 60 * 1000;
const ACCESS_TOKEN_EXPIRES_IN = "1h";
const REFRESH_TOKEN_EXPIRES_IN = "2h";
const GOOGLE_SHEET_SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const SALT_ROUNDS = 10;

module.exports = {
  COOKIE_MAX_AGE,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  GOOGLE_SHEET_SCOPES,
  SALT_ROUNDS,
};
