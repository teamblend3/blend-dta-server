const mongoose = require("mongoose");
const Project = require("../models/Project");
const { createMongoDbUrl } = require("./synchronizeUtils");
const { decryptPassword } = require("./typeConversionUtils");
const Log = require("../models/Log");

const observerDbs = async () => {
  const allProjects = await Project.find();

  allProjects.forEach(async project => {
    const { title, dbId, dbPassword, dbUrl } = project;
    const password = decryptPassword(dbPassword);
    const URL = createMongoDbUrl(dbId, password, dbUrl, title);

    const databaseConnection = mongoose.createConnection(URL);

    databaseConnection.once("connected", () => {
      const changeStream = databaseConnection.watch();
      changeStream.on("change", async change => {
        const {
          operationType,
          operationDescription,
          ns: { coll },
          documentKey: { _id },
        } = change;
        console.log(change);
        const type = operationType.toUpperCase();

        await Log.create({
          type,
          message: `${type}${operationDescription ? ` ${operationDescription}` : ""} ${_id.toString()} WHERE: ${coll}`,
          collectionName: coll,
          project: project._id,
        });
      });
    });

    databaseConnection.on("error", error => {
      console.error(`Error in DB connection to ${title}: ${error}`);
    });

    databaseConnection.on("disconnected", () => {
      console.log(`Disconnected from ${title}`);
    });
  });
};

module.exports = observerDbs;
