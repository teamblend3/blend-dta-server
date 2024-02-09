const express = require("express");

const User = require("../models/User");
const { verifyToken } = require("../middlewares/authMiddleware");
const {
  generateSheetUrl,
  validateDb,
  validateSheet,
  getProject,
} = require("../controllers/projectController");

const route = express.Router();

route.get("/:id", getProject);
route.post("/validation/db", validateDb);
route.post("/validation/sheet", validateSheet);
route.get("/generation/sheet", verifyToken, generateSheetUrl);

module.exports = route;
