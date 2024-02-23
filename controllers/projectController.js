const { google } = require("googleapis");
const mongoose = require("mongoose");

const User = require("../models/User");
const Project = require("../models/Project");
const TaskStatus = require("../models/TaskStatus");
const Log = require("../models/Log");

const { getSheetIdIndex, isInvalidSheet } = require("../utils/validate");
const {
  createMongoDbUrl,
  formatDbData,
  appendToSheet,
  getDataPreview,
  generateSheetUrl,
  checkForExistingProject,
} = require("../utils/synchronizeUtils");
const {
  hashPassword,
  decryptPassword,
} = require("../utils/typeConversionUtils");
const { STATUS_MESSAGE, CREATE_LOG_MESSAGE } = require("../utils/constants");
const CustomError = require("../utils/customError");
const observerDbs = require("../utils/observerDbs");

const getProject = async (req, res, next) => {
  try {
    const {
      params: { id },
    } = req;

    const findProject = await Project.findById(id);
    const { title, dbId, dbUrl, dbPassword } = findProject;
    const password = decryptPassword(dbPassword);
    const URL = createMongoDbUrl(dbId, password, dbUrl, title);
    const databaseConnection = mongoose.createConnection(URL);

    databaseConnection.once("connected", async () => {
      const selectedDatabase = databaseConnection.db;
      const collections = await selectedDatabase.listCollections().toArray();
      const keys = collections.map(async ({ name }) => {
        const nameCollection = selectedDatabase.collection(name);
        const collectionDataTypes = await nameCollection
          .aggregate([
            {
              $project: {
                arrayOfKeyValues: {
                  $objectToArray: "$$ROOT",
                },
              },
            },
            { $unwind: "$arrayOfKeyValues" },
            {
              $group: {
                _id: "$arrayOfKeyValues.k",
                types: {
                  $addToSet: {
                    $type: "$arrayOfKeyValues.v",
                  },
                },
              },
            },
          ])
          .toArray();
        return { [name]: collectionDataTypes };
      });

      const schema = await Promise.all(keys);
      const collectionNames = collections.map(collection => collection.name);
      const fetchDataPromises = collections.map(async collection => {
        const collectionName = collection.name;
        return selectedDatabase.collection(collectionName).find().toArray();
      });
      const fetchedData = await Promise.all(fetchDataPromises);
      const dataPreview = getDataPreview(collectionNames, fetchedData);
      databaseConnection.close();

      res.json({ success: true, project: findProject, schema, dataPreview });
    });

    databaseConnection.on("error", error => {
      next(error);
      databaseConnection.close();
    });
  } catch (error) {
    next(error);
  }
};

const getProjectLogs = async (req, res, next) => {
  try {
    const {
      params: { id },
    } = req;

    const findLogs = await Log.find({ project: id }).sort({ createdAt: -1 });
    res.json({ success: true, logs: findLogs });
  } catch (error) {
    next(error);
  }
};

const validateDb = async (req, res, next) => {
  try {
    const {
      body: { dbId, dbPassword, dbUrl },
    } = req;
    const URL = createMongoDbUrl(dbId, dbPassword, dbUrl);
    const databaseConnection = mongoose.createConnection(URL);

    databaseConnection.once("connected", async () => {
      const databases = await databaseConnection.db.admin().listDatabases();

      res.json({
        success: true,
        message: "Connected to database successfully",
        databaseList: databases.databases,
      });
      databaseConnection.close();
    });

    databaseConnection.on("error", error => {
      next(error);
      databaseConnection.close();
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.log("Unhandled Rejection at:", promise, "reason:", reason);
    });
  } catch (error) {
    next(error);
  }
};

const validateSheet = async (req, res, next) => {
  try {
    const {
      body: { sheetUrl },
    } = req;
    const splitBySlash = sheetUrl.split("/");
    const sheetIdIndex = getSheetIdIndex(splitBySlash);
    const invalidSheet = isInvalidSheet(sheetIdIndex, splitBySlash);

    if (invalidSheet) {
      throw new CustomError("Invalid Google Spread Sheet URl", 400);
    }

    const sheetId = splitBySlash[sheetIdIndex];
    const sheets = google.sheets({ version: "v4" });
    const response = sheets.spreadsheets.get({ sheetId });

    if (!response || !response.data) {
      throw new CustomError("Spreadsheet not found", 404);
    }

    res.json({
      success: true,
      message: "Valid Google Spread Sheet URL",
      spreadsheetInfo: response.data,
    });
  } catch (error) {
    next(error);
  }
};

const synchronize = async (req, res, next) => {
  try {
    const { user, body } = req;
    const { dbUrl, dbId, dbPassword, dbTableName, sheetUrl } = body;

    await checkForExistingProject(dbUrl, dbTableName, user);

    const URL = createMongoDbUrl(dbId, dbPassword, dbUrl, dbTableName);
    const databaseConnection = mongoose.createConnection(URL);

    databaseConnection.on("connected", async () => {
      let sheetURI = sheetUrl;

      if (sheetURI === "https://www.AUTO_GENERATE.com") {
        sheetURI = await generateSheetUrl(user);
      }

      const taskStatus = await TaskStatus.create({
        statusId: `${dbUrl}-${dbTableName}-${user}`,
        message: STATUS_MESSAGE.CONNECTED,
      });

      const selectedDatabase = databaseConnection.db;
      const collections = await selectedDatabase.listCollections().toArray();
      const collectionNames = collections.map(collection => collection.name);
      const fetchDataPromises = collections.map(async collection => {
        const collectionName = collection.name;
        return selectedDatabase.collection(collectionName).find().toArray();
      });

      await TaskStatus.findByIdAndUpdate(taskStatus._id, {
        message: STATUS_MESSAGE.FETCHED,
      });

      const fetchedData = await Promise.all(fetchDataPromises);
      const dataToGoogle = await formatDbData(fetchedData);

      await TaskStatus.findByIdAndUpdate(taskStatus._id, {
        message: STATUS_MESSAGE.FORMATTED,
      });

      const findUser = await User.findById(req.user);
      const { oauthAccessToken, oauthRefreshToken } = findUser;

      await appendToSheet(
        sheetURI,
        dataToGoogle,
        oauthAccessToken,
        oauthRefreshToken,
        collectionNames,
      );

      const project = await Project.create({
        title: dbTableName,
        dbUrl,
        dbId,
        dbPassword: hashPassword(dbPassword),
        sheetUrl: sheetURI,
        collectionNames,
        createdAt: new Date().toISOString(),
        creator: user,
      });

      findUser.projects.push(project._id);

      await findUser.save();

      observerDbs();

      await TaskStatus.findByIdAndUpdate(taskStatus._id, {
        message: STATUS_MESSAGE.TRANSFERRED,
        project: project._id,
        createdAt: new Date().toISOString(),
      });

      await Log.create({
        type: "CREATE",
        message: CREATE_LOG_MESSAGE,
        project: project._id,
      });

      res.json({ success: true, project });
    });

    databaseConnection.on("error", async error => {
      await TaskStatus.findByIdAndUpdate(`${dbUrl}-${dbTableName}-${user}`, {
        message: STATUS_MESSAGE.FAIL,
      });

      next(error);

      databaseConnection.close();
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.log("Unhandled Rejection at:", promise, "reason:", reason);
    });
  } catch (error) {
    next(error);
  }
};

const getTaskStatus = async (req, res, next) => {
  try {
    const {
      query: { db, table },
      user,
    } = req;

    const taskStatus = await TaskStatus.findOne({
      statusId: `${db}-${table}-${user}`,
    });
    res.json({ success: true, status: taskStatus?.message });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProject,
  getProjectLogs,
  generateSheetUrl,
  validateDb,
  validateSheet,
  synchronize,
  getTaskStatus,
};
