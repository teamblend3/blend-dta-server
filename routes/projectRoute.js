const express = require("express");

const route = express.Router();

route.get("/", (req, res, next) => {
  try {
    res.send("Project router");
  } catch (error) {
    next(error);
  }
});

module.exports = route;
