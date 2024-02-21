const COOKIE_MAX_AGE = 4 * 60 * 60 * 1000;
const ACCESS_TOKEN_EXPIRES_IN = "1h";
const REFRESH_TOKEN_EXPIRES_IN = "15d";
const ITEMS_PER_PAGE = 5;
const GOOGLE_SHEET_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];
const STATUS_MESSAGE = {
  CONNECTED: "CONNECTED_DB_DONE",
  FETCHED: "FETCH_DATA_DONE",
  FORMATTED: "DATA_FORMATTING_DONE",
  TRANSFERRED: "TRANSFER_DATA_DONE",
};
const CREATE_LOG_MESSAGE = "CREATE PROJECT SUCCESSFUL";

module.exports = {
  COOKIE_MAX_AGE,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  GOOGLE_SHEET_SCOPES,
  ITEMS_PER_PAGE,
  STATUS_MESSAGE,
  CREATE_LOG_MESSAGE,
};
