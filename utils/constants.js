const COOKIE_MAX_AGE = 4 * 60 * 60 * 1000;
const ACCESS_TOKEN_EXPIRES_IN = "1h";
const REFRESH_TOKEN_EXPIRES_IN = "15d";
const GOOGLE_SHEET_SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const SALT_ROUNDS = 10;
const ITEMS_PER_PAGE = 5;
const STATUS_MESSAGE = {
  CONNECT: "CONNECTED_DB_DONE",
  FETCH: "FETCH_DATA_DONE",
  FORMAT: "DATA_FORMATTING_DONE",
  TRANSFER: "TRANSFER_DATA_DONE",
  FAIL: "CONNECTED_DB_FALSE",
};

module.exports = {
  COOKIE_MAX_AGE,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  GOOGLE_SHEET_SCOPES,
  SALT_ROUNDS,
  ITEMS_PER_PAGE,
  STATUS_MESSAGE,
};
