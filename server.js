require("dotenv").config();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const logger = require("morgan");
const path = require("path");
require("./db");
const { swaggerUi, specs } = require("./modules/swagger");
const projectRoute = require("./routes/projectRoute");
const userRoute = require("./routes/userRoute");
// const observerDb = require("./utils/observerDb");

const app = express();
const PORT = process.env.PORT || 3001;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "./views"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(`${__dirname}/node_modules`));
app.use(cookieParser());
app.use(cors());
app.use(logger("dev"));

app.use("/api/users", userRoute);
app.use("/api/projects", projectRoute);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

app.use((req, res, next) => {
  next();
});

app.use("/*", (req, res, next) => {
  try {
    res.json({ code: 404 });
  } catch (error) {
    next(error);
  }
});

app.use((err, req, res) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.json({ success: false, error: err.message });
});

// observerDb();

app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`),
);

module.exports = app;
