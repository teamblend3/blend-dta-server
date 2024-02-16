const { google } = require("googleapis");
const mongoose = require("mongoose");

const User = require("../models/User");
const Project = require("../models/Project");
const TaskStatus = require("../models/TaskStatus");
const { getSheetIdIndex, isInvalidSheet } = require("../utils/validate");
const {
  createMongoDbUrl,
  fetchFromDatabase,
  formatDbData,
  appendToSheet,
} = require("../utils/synchronizeUtils");
const { hashPassword } = require("../utils/typeConversionUtils");
const { updateTaskStatus } = require("../utils/modelUtils");
const { STATUS_MESSAGE } = require("../utils/constants");
const CustomError = require("../utils/customError");

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

    databaseConnection.once("error", error => {
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
    const response = await sheets.spreadsheets.get({ sheetId });

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
    throw new CustomError(error.message, 500);
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

    const URL = createMongoDbUrl(dbId, dbPassword, dbUrl, dbTableName);
    const databaseConnection = mongoose.createConnection(URL);

    databaseConnection.on("connected", async () => {
      try {
        const spreadSheetId = sheetUrl.split("/d/")[1].split("/")[0];

        const { _id: taskId } = await TaskStatus.create({
          statusId: spreadSheetId,
          message: STATUS_MESSAGE.CONNECT,
        });

        const selectedDatabase = databaseConnection.db;
        const fetchedData = await fetchFromDatabase(selectedDatabase);

        await updateTaskStatus(taskId, STATUS_MESSAGE.FETCH);

        const formattedData = await formatDbData(fetchedData);

        await updateTaskStatus(taskId, STATUS_MESSAGE.FORMAT);

        const { oauthAccessToken, oauthRefreshToken } =
          await User.findById(user);
        const { collectionCount } = await appendToSheet(
          sheetUrl,
          formattedData,
          oauthAccessToken,
          oauthRefreshToken,
        );

        const projectData = {
          title: dbTableName,
          dbUrl,
          dbId,
          dbPassword: await hashPassword(dbPassword),
          sheetUrl,
          collectionCount,
          createdAt: new Date().toISOString(),
          creator: user,
        };

        const project = await Project.create(projectData);

        await User.findByIdAndUpdate(
          user,
          { $push: { projects: project._id } },
          { new: true },
        );

        await updateTaskStatus(taskId, STATUS_MESSAGE.TRANSFER, {
          project: project._id,
          createdAt: new Date().toISOString(),
        });

        res.json({ success: true });
      } catch (error) {
        if (error instanceof CustomError) {
          res.status(error.status).json({
            success: false,
            message: error.message,
          });
        } else {
          throw error;
        }
      }
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
