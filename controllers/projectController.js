const { google } = require("googleapis");
const mongoose = require("mongoose");

const User = require("../models/User");
const Project = require("../models/Project");
const TaskStatus = require("../models/TaskStatus");
const { formatDbData, appendToSheet } = require("../utils/synchronizeUtils");
const {
  hashPassword,
  formatCurrentDate,
} = require("../utils/typeConversionUtils");

const getProject = async (req, res, next) => {
  try {
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const validateDb = async (req, res, next) => {
  try {
    const {
      body: { dbUrl, dbId, dbPassword },
    } = req;
    const URL = `mongodb+srv://${dbId}:${dbPassword}@${dbUrl}`;
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

    databaseConnection.once("error", err => {
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
    res.status(500).json({
      success: false,
      message: "내부 서버 오류",
    });
  }
};

const validateSheet = async (req, res, next) => {
  try {
    console.log("validation sheet");
  } catch (error) {
    next(error);
  }
};

const generateSheetUrl = async (req, res, next) => {
  try {
    const findUser = await User.findById(req.user);
    const auth = new google.auth.OAuth2();

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
    next(error);
  }
};

const synchronize = async (req, res, next) => {
  try {
    const {
      user,
      body: {
        dbUrl: { value: dbUrl },
        dbId: { value: dbId },
        dbPassword: { value: dbPassword },
        dbTableName: { value: dbTableName },
        sheetUrl: { value: sheetUrl },
      },
    } = req;

    const URL = `mongodb+srv://${dbId}:${dbPassword}@${dbUrl}/${dbTableName}`;
    const databaseConnection = mongoose.createConnection(URL);

    databaseConnection.on("connected", async () => {
      const spreadSheetId = sheetUrl.match(/\/d\/(.+?)\//)[1];
      const taskStatus = await TaskStatus.create({
        statusId: spreadSheetId,
        message: "CONNECTED_DB_DONE",
      });

      const selectedDatabase = databaseConnection.db;
      const collections = await selectedDatabase.listCollections().toArray();

      const fetchDataPromises = collections.map(async collection => {
        const collectionName = collection.name;
        return selectedDatabase.collection(collectionName).find().toArray();
      });

      const fetchedData = await Promise.all(fetchDataPromises);

      await TaskStatus.findByIdAndUpdate(taskStatus._id, {
        message: "FETCH_DATA_DONE",
      });

      const dataToGoogle = await formatDbData(fetchedData);

      await TaskStatus.findByIdAndUpdate(taskStatus._id, {
        message: "DATA_FORMATTING_DONE",
      });

      const findUser = await User.findById(req.user);
      const { oauthAccessToken, oauthRefreshToken } = findUser;

      const { collectionCount } = await appendToSheet(
        sheetUrl,
        dataToGoogle,
        oauthAccessToken,
        oauthRefreshToken,
      );

      const project = await Project.create({
        title: dbTableName,
        dbUrl,
        dbId,
        dbPassword: await hashPassword(dbPassword),
        sheetUrl,
        collectionCount,
        createdAt: formatCurrentDate(),
        creator: user,
      });

      findUser.projects.push(project._id);
      await findUser.save();

      await TaskStatus.findByIdAndUpdate(taskStatus._id, {
        message: "TRANSFER_DATA_DONE",
        project: project._id,
        createdAt: new Date().toISOString(),
      });

      res.json({ success: true });
    });
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
};
