const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const observerDbs = require("../utils/observerDbs");

const expressLoader = async app => {
  const PORT = process.env.PORT || 3001;

  app.use(
    cors({
      origin: process.env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  observerDbs();

  app.listen(PORT, () =>
    console.log(`Server listening on http://localhost:${PORT}`),
  );
};

module.exports = expressLoader;
