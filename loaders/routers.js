const { swaggerUi, specs } = require("../modules/swagger");
const userRoute = require("../routes/userRoute");
const projectRoute = require("../routes/projectRoute");

const routerLoader = async app => {
  app.use("/api/users", userRoute);
  app.use("/api/projects", projectRoute);
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
};

module.exports = routerLoader;
