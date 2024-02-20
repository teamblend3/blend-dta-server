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
} = require("../utils/synchronizeUtils");
const { hashPassword } = require("../utils/typeConversionUtils");
const { STATUS_MESSAGE } = require("../utils/constants");
const CustomError = require("../utils/customError");

const getProject = async (req, res, next) => {
  try {
    const {
      user,
      params: { id },
    } = req;
    const findProject = await Project.findById(id);

    res.json({ success: true, project: findProject });
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
      throw new CustomError("Connection Fail", 400);
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.log("Unhandled Rejection at:", promise, "reason:", reason);
    });
  } catch (error) {
    throw new CustomError(error.message, 500);
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

const generateSheetUrl = async (req, res, next) => {
  try {
    const findUser = await User.findById(req.user);
    const auth = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
    );

    auth.forceRefreshOnFailure = true;
    auth.setCredentials({
      access_token: findUser.oauthAccessToken,
      refresh_token: findUser.oauthRefreshToken,
    });

    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.create({
      resource: {
        properties: {
          title: `${new Date().toISOString()} 스프레드시트`,
        },
      },
    });
    const {
      data: { spreadsheetUrl: sheetUrl },
    } = response;

    res.json({ success: true, sheetUrl });
  } catch (error) {
    next(new CustomError(error.message, 500));
  }
};

const synchronize = async (req, res, next) => {
  try {
    const {
      user,
      body: { dbUrl, dbId, dbPassword, dbTableName, sheetUrl },
    } = req;
    const URL = createMongoDbUrl(dbId, dbPassword, dbUrl, dbTableName);
    const databaseConnection = mongoose.createConnection(URL);
    const spreadSheetId = sheetUrl.split("/d/")[1].split("/")[0];
    const isExistingProject = await Project.findOne({
      title: dbTableName,
      creator: user._id,
    });

    if (isExistingProject) {
      return res.status(400).json({ error: "Selected Table already exists." });
    }

    databaseConnection.on("connected", async () => {
      const taskStatus = await TaskStatus.create({
        statusId: spreadSheetId,
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
      const { collectionCount } = await appendToSheet(
        sheetUrl,
        dataToGoogle,
        oauthAccessToken,
        oauthRefreshToken,
        collectionNames,
      );

      const dataPreview = getDataPreview(collectionNames, fetchedData);

      const project = await Project.create({
        title: dbTableName,
        dbUrl,
        dbId,
        dbPassword: await hashPassword(dbPassword),
        sheetUrl,
        collectionCount,
        collectionNames,
        dataPreview,
        createdAt: new Date().toISOString(),
        creator: user,
      });

      findUser.projects.push(project._id);

      await findUser.save();

      await TaskStatus.findByIdAndUpdate(taskStatus._id, {
        message: STATUS_MESSAGE.TRANSFERRED,
        project: project._id,
        createdAt: new Date().toISOString(),
      });

      await Log.create({
        type: "CREATE",
        message: "Project created successfully",
        project: project._id,
      });

      databaseConnection.close();

      res.json({ success: true });
    });

    databaseConnection.on("error", async err => {
      await TaskStatus.findByIdAndUpdate(spreadSheetId, {
        message: STATUS_MESSAGE.FAIL,
      });

      res.status(400).json({
        success: false,
        message: err.message,
      });

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
      params: { id },
    } = req;
    const taskStatus = await TaskStatus.findOne({ statusId: id });

    res.json({ success: true, status: taskStatus?.message });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProject,
  generateSheetUrl,
  validateDb,
  validateSheet,
  synchronize,
  getTaskStatus,
};
