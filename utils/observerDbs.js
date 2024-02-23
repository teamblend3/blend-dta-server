const { google } = require("googleapis");
const mongoose = require("mongoose");
const User = require("../models/User");
const Project = require("../models/Project");
const Log = require("../models/Log");
const { createMongoDbUrl } = require("./synchronizeUtils");
const { decryptPassword } = require("./typeConversionUtils");
const { GOOGLE_SHEET_SCOPES } = require("./constants");

const observerDbs = async () => {
  const allProjects = await Project.find();

  allProjects.forEach(async project => {
    const { title, dbId, dbPassword, dbUrl, sheetUrl } = project;
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
          updateDescription: { updatedFields },
        } = change;
        console.log(change);
        const type = operationType.toUpperCase();

        const findUser = await User.findOne({ projects: project._id });
        const { oauthAccessToken, oauthRefreshToken } = findUser;
        const spreadSheetId = sheetUrl.split("/d/")[1].split("/")[0];

        const auth = new google.auth.OAuth2({
          clientId: process.env.CLIENT_ID,
          clientSecret: process.env.CLIENT_SECRET,
          GOOGLE_SHEET_SCOPES,
        });

        auth.setCredentials({
          access_token: oauthAccessToken,
          refresh_token: oauthRefreshToken,
        });

        const sheetsClient = google.sheets({ version: "v4", auth });

        const sheetsResponse = await sheetsClient.spreadsheets.values.get({
          spreadsheetId: spreadSheetId,
          range: coll,
          valueRenderOption: "UNFORMATTED_VALUE",
        });

        const { values } = sheetsResponse.data;
        const updatedRow = Object.keys(updatedFields)[0];
        const updatedColumn = `"${_id.toString()}"`;
        const updatedRowIndex = String.fromCharCode(
          65 + values[0].indexOf(updatedRow),
        );
        const updatedColumnIndex =
          values.findIndex(value => value[0] === updatedColumn) + 1;

        const updateCellValue = async (
          sheets,
          spreadsheetId,
          rowIndex,
          columnIndex,
          value,
        ) => {
          const range = `${coll}!${rowIndex}${columnIndex}`;

          try {
            const response = await sheets.spreadsheets.values.update({
              spreadsheetId,
              range,
              valueInputOption: "RAW",
              resource: {
                values: [[value]],
              },
            });

            console.log("셀 업데이트 완료:", response.data);
          } catch (error) {
            console.error("셀 업데이트 에러:", error);
          }
        };

        const newData = Object.values(updatedFields)[0];
        updateCellValue(
          sheetsClient,
          spreadSheetId,
          updatedRowIndex,
          updatedColumnIndex,
          newData,
        );

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
