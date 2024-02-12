const { google } = require("googleapis");
const mongoose = require("mongoose");
const TaskStatus = require("../models/TaskStatus");
const User = require("../models/User");
const { GOOGLE_SHEET_SCOPES } = require("./constants");

const formatDbData = async collections => {
  const data = [];
  let columns = [];
  let columnCounts = 0;

  for (let i = 0; i < collections.length; i += 1) {
    const eachCollection = collections[i];
    const eachCollectionData = [];

    for (let j = 0; j < eachCollection.length; j += 1) {
      if (j === 0) {
        columns = Object.keys(eachCollection[j]);
        columnCounts = columns.length;

        eachCollectionData.push(columns);
      }

      const rowCells = Object.values(eachCollection[j]);
      const isCountsMatch = columnCounts === rowCells.length;

      if (isCountsMatch) {
        eachCollectionData.push(rowCells);
      } else {
        const eachRow = new Array(columnCounts).fill("");

        for (let k = 0; k < columns.length; k += 1) {
          const eachColumnCell = columns[k];

          if (eachCollection[j][eachColumnCell]) {
            eachRow[k] = eachCollection[j][eachColumnCell];
          }
        }

        eachCollectionData.push(eachRow);
      }
    }

    data.push(eachCollectionData);
  }

  return data;
};

const appendToSheet = async (
  sheetUrl,
  data,
  oauthAccessToken,
  oauthRefreshToken,
) => {
  function transformCellValue(value) {
    if (typeof value === "object" && value instanceof Date) {
      return value.toString();
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    return value;
  }

  function transformDataForSheets(value) {
    return value.map(row => row.map(cell => transformCellValue(cell)));
  }

  try {
    const spreadSheetId = sheetUrl.match(/\/spreadsheets\/d\/(.*?)(\/|$)/)[1];

    const auth = new google.auth.OAuth2({
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      scopes: GOOGLE_SHEET_SCOPES,
    });

    auth.setCredentials({
      access_token: oauthAccessToken,
      refresh_token: oauthRefreshToken,
    });

    const sheets = google.sheets({ version: "v4", auth });
    const transformedData = transformDataForSheets(data);

    sheets.spreadsheets.values.append({
      spreadsheetId: spreadSheetId,
      range: "A1",
      valueInputOption: "RAW",
      resource: {
        values: transformedData,
      },
    });
  } catch (error) {
    console.error("에러", error);

    if (error.response && error.response.data && error.response.data.error) {
      console.error("Google API 응답 에러:", error.response.data.error);
      throw error;
    }
  }
};

const synchronize = async (req, res) => {
  const {
    body: { dbUrl, dbId, dbPassword, dbTableName, sheetUrl },
  } = req;
  const URL = `mongodb+srv://${dbId}:${dbPassword}@${dbUrl}/${dbTableName}`;
  const databaseConnection = mongoose.createConnection(URL);
  const fetchedData = [];

  databaseConnection.on("connected", async () => {
    const spreadsheetId = sheetUrl.match(/\/d\/(.+?)\//)[1];
    const taskStatus = await TaskStatus.create({
      statusId: spreadsheetId,
      message: "CONNECTED_DB_DONE",
    });

    const selectedDatabase = databaseConnection.db;
    const collections = await selectedDatabase.listCollections().toArray();

    for (let i = 0; i < collections.length; i += 1) {
      const collection = collections[i];
      const collectionName = collection.name;
      const eachData = selectedDatabase
        .collection(collectionName)
        .find()
        .toArray();

      fetchedData.push(eachData);
    }

    await TaskStatus.findByIdAndUpdate(taskStatus._id, {
      message: "FETCH_DATA_DONE",
    });

    const collectionData = [...fetchedData];
    const dataToGoogle = formatDbData(collectionData);

    await TaskStatus.findByIdAndUpdate(taskStatus._id, {
      message: "DATA_FORMATTING_DONE",
    });

    const findUser = await User.findById(req.user);
    const { oauthAccessToken, oauthRefreshToken } = findUser;

    const result = await appendToSheet(
      sheetUrl,
      dataToGoogle,
      oauthAccessToken,
      oauthRefreshToken,
    );

    await TaskStatus.findByIdAndUpdate(taskStatus._id, {
      message: "TRANSFER_DATA_DONE",
    });

    res.json({ success: true, result });
  });
};

module.exports = { synchronize };
