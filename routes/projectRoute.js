const express = require("express");
const { verifyToken } = require("../middlewares/authMiddleware");
const {
  generateSheetUrl,
  validateDb,
  validateSheet,
  getProject,
  synchronize,
} = require("../controllers/projectController");
const { onlyPrivate } = require("../middlewares/protectRoute");

const route = express.Router();

route.get("/:id", verifyToken, onlyPrivate, getProject);
route.get("/:id/logs", verifyToken, onlyPrivate, getProject);
route.post("/validation/db", verifyToken, onlyPrivate, validateDb);
route.post("/validation/sheet", verifyToken, onlyPrivate, validateSheet);
route.get("/generation/sheet", verifyToken, onlyPrivate, generateSheetUrl);
route.post("/sync", verifyToken, onlyPrivate, synchronize);

module.exports = route;
