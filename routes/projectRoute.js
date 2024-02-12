const express = require("express");
const { verifyToken } = require("../middlewares/authMiddleware");
const {
  generateSheetUrl,
  validateDb,
  validateSheet,
  getProject,
  synchronizeController,
} = require("../controllers/projectController");

const route = express.Router();

route.get("/:id", getProject);
route.post("/validation/db", validateDb);
route.post("/validation/sheet", validateSheet);
route.get("/generation/sheet", verifyToken, generateSheetUrl);
route.post("/sync", verifyToken, synchronizeController);

module.exports = route;
