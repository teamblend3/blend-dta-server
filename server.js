require("dotenv").config();
const express = require("express");
const appLoader = require("./loaders/index");

const app = express();

(async () => {
  await appLoader(app);
})();

module.exports = app;
