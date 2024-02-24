const express = require("express");
const { verifyToken } = require("../middlewares/authMiddleware");
const {
  getProject,
  getProjectLogs,
  validateDb,
  validateSheet,
  generateSheetUrl,
  getTaskStatus,
  synchronize,
  downloadExcel,
} = require("../controllers/projectController");

const route = express.Router();

route.get("/taskstatus", verifyToken, getTaskStatus);
route.get("/:id", verifyToken, getProject);
route.get("/:id/logs", verifyToken, getProjectLogs);
route.post("/validation/db", verifyToken, validateDb);
route.post("/validation/sheet", verifyToken, validateSheet);
route.get("/generation/sheet", verifyToken, generateSheetUrl);
route.post("/sync", verifyToken, synchronize);
route.post("/:id/download", verifyToken, downloadExcel);

module.exports = route;
