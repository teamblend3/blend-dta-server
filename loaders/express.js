const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

async function expressLoader(app) {
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

  app.listen(PORT, () =>
    console.log(`Server listening on http://localhost:${PORT}`),
  );
}

module.exports = expressLoader;
