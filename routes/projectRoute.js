const express = require("express");
const { verifyToken } = require("../middlewares/authMiddleware");
const {
  generateSheetUrl,
  validateDb,
  validateSheet,
  getProject,
  synchronize,
} = require("../controllers/projectController");

const route = express.Router();

route.get("/:id", verifyToken, getProject);
route.post("/validation/db", verifyToken, validateDb);
route.post("/validation/sheet", verifyToken, validateSheet);
route.get("/generation/sheet", verifyToken, generateSheetUrl);
route.post("/sync", verifyToken, synchronize);

module.exports = route;
