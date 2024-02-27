const { google } = require("googleapis");
const mongoose = require("mongoose");
const xlsx = require("xlsx");

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
  createMongoURI,
} = require("../utils/synchronizeUtils");
const { hashPassword } = require("../utils/typeConversionUtils");
const { STATUS_MESSAGE, CREATE_LOG_MESSAGE } = require("../utils/constants");
const CustomError = require("../utils/customError");
const observerDbs = require("../utils/observerDbs");
const {
  fetchDataFromDatabase,
  transformData,
} = require("../utils/exportExcelUtils");

const getProject = async (req, res, next) => {
  try {
    const {
      params: { id },
    } = req;

    const findProject = await Project.findById(id);
    const URL = createMongoDbUrl(findProject);
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

const deleteProject = async (req, res, next) => {
  try {
    const {
      user,
      params: { id },
    } = req;

    const findProject = await Project.findById(id);
    console.log(findProject);
    if (!findProject) {
      throw new CustomError("Project not found", 404);
    }

    if (findProject.creator.toString() !== user) {
      throw new CustomError("Unauthenticated", 401);
    }

    await TaskStatus.deleteMany({ project: id });
    await Log.deleteMany({ project: id });
    await User.findByIdAndUpdate(user, { $pull: { projects: id } });
    await Project.findByIdAndDelete(id);
    res.json({ success: true });
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
    const URL = createMongoURI(dbId, dbPassword, dbUrl);
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
    const { dbUrl, dbId, dbPassword, dbTableName, sheetUrl, statusId } = body;

    await checkForExistingProject(dbUrl, dbTableName, user);

    const URL = createMongoURI(dbId, dbPassword, dbUrl, dbTableName);
    const databaseConnection = mongoose.createConnection(URL);

    databaseConnection.on("connected", async () => {
      let sheetURI = sheetUrl;

      if (sheetURI === "https://www.AUTO_GENERATE.com") {
        sheetURI = await generateSheetUrl(user);
      }

      const taskStatus = await TaskStatus.create({
        statusId,
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

      await TaskStatus.findByIdAndUpdate(taskStatus._id, {
        message: STATUS_MESSAGE.TRANSFERRED,
        project: project._id,
        createdAt: new Date().toISOString(),
      });

      observerDbs();

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

const mockSynchronize = async (req, res, next) => {
  try {
    const { user, body } = req;
    const { dbUrl, dbId, dbPassword, dbTableName, statusId } = body;

    if (user !== process.env.MOCK_AUTH_ID) {
      throw new CustomError("Unauthenticated", 401);
    }

    if (!dbUrl || !dbId || !dbPassword || !dbTableName) {
      throw new CustomError(
        "The database information entered is incorrect.",
        400,
      );
    }

    const findUser = await User.findById(user);
    const URL = createMongoURI(dbId, dbPassword, dbUrl, dbTableName);
    const databaseConnection = mongoose.createConnection(URL);

    databaseConnection.on("connected", async () => {
      const taskStatus = await TaskStatus.create({
        statusId,
        message: STATUS_MESSAGE.CONNECTED,
      });

      const { db } = databaseConnection;
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(collection => collection.name);

      const workbook = xlsx.utils.book_new();

      const result = {};

      await Promise.all(
        collections.map(async collection => {
          const data = await db.collection(collection.name).find().toArray();
          result[collection.name] = data;
        }),
      );

      await TaskStatus.findByIdAndUpdate(taskStatus._id, {
        message: STATUS_MESSAGE.FETCHED,
      });

      await Promise.all(
        Object.keys(result).map(async collectionName => {
          const transformedData = transformData(result[collectionName]);
          const worksheet = xlsx.utils.json_to_sheet(transformedData);
          xlsx.utils.book_append_sheet(workbook, worksheet, collectionName);
        }),
      );

      await TaskStatus.findByIdAndUpdate(taskStatus._id, {
        message: STATUS_MESSAGE.FORMATTED,
      });

      const newProject = await Project.create({
        title: `${dbTableName}-${findUser.projects.length}`,
        dbUrl,
        dbId,
        dbPassword: hashPassword(dbPassword),
        sheetUrl: "MOCK",
        collectionNames,
        createdAt: new Date().toISOString(),
        creator: user,
      });

      findUser.projects.push(newProject._id);

      await findUser.save();

      await TaskStatus.findByIdAndUpdate(taskStatus._id, {
        message: STATUS_MESSAGE.TRANSFERRED,
        project: newProject._id,
        createdAt: new Date().toISOString(),
      });

      await Log.create({
        type: "CREATE",
        message: CREATE_LOG_MESSAGE,
        project: newProject._id,
      });

      const buffer = await xlsx.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      observerDbs();

      res
        .writeHead(200, {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${dbTableName}.xlsx"`,
        })
        .end(buffer);
    });

    databaseConnection.on("error", async error => {
      await TaskStatus.findByIdAndUpdate(`${dbUrl}-${dbTableName}-${user}`, {
        message: STATUS_MESSAGE.FAIL,
      });

      next(error);

      databaseConnection.close();
    });
  } catch (error) {
    next(error);
  }
};

const mockDownload = async (req, res, next) => {
  try {
    const {
      user,
      params: { id },
    } = req;

    if (user !== process.env.MOCK_AUTH_ID) {
      next(new CustomError("Unauthenticated", 401));
    }

    const findProject = await Project.findById(id);
    const { dbUrl, dbTableName } = findProject;
    await checkForExistingProject(dbUrl, dbTableName, user);
    const URL = createMongoDbUrl(findProject);
    const databaseConnection = mongoose.createConnection(URL);

    databaseConnection.on("connected", async () => {
      const { db } = databaseConnection;
      const collections = await db.listCollections().toArray();
      const workbook = xlsx.utils.book_new();

      await Promise.all(
        collections.map(async collection => {
          const data = await db.collection(collection.name).find().toArray();
          const transformedData = transformData(data);
          const worksheet = xlsx.utils.json_to_sheet(transformedData);
          xlsx.utils.book_append_sheet(workbook, worksheet, collection.name);
        }),
      );

      const buffer = await xlsx.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      res
        .writeHead(200, {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${dbTableName}.xlsx"`,
        })
        .end(buffer);
    });

    databaseConnection.on("error", async error => {
      next(error);

      databaseConnection.close();
    });
  } catch (error) {
    next(error);
  }
};

const getTaskStatus = async (req, res, next) => {
  try {
    const {
      query: { id },
    } = req;
    const taskStatus = await TaskStatus.findOne({
      statusId: id,
    });
    res.json({ success: true, status: taskStatus?.message });
  } catch (error) {
    next(error);
  }
};

const downloadExcel = async (req, res, next) => {
  try {
    const {
      user,
      body: { collection, columns },
      params: { id },
    } = req;

    const { title, dbId, dbUrl, dbPassword } = await Project.findById(id);
    const tableName = user === process.env.MOCK_AUTH_ID ? "sample" : title;
    const dbConfig = {
      title: tableName,
      dbId,
      dbUrl,
      dbPassword,
    };

    const rawData = await fetchDataFromDatabase(collection, columns, dbConfig);
    const transformedData = transformData(rawData);
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(transformedData);
    xlsx.utils.book_append_sheet(workbook, worksheet, collection);
    const buffer = await xlsx.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    res
      .writeHead(200, {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${collection}.xlsx"`,
      })
      .end(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProject,
  deleteProject,
  getProjectLogs,
  generateSheetUrl,
  validateDb,
  validateSheet,
  synchronize,
  mockSynchronize,
  getTaskStatus,
  mockDownload,
  downloadExcel,
};
