const { google } = require("googleapis");
const mongoose = require("mongoose");
const User = require("../models/User");
const Project = require("../models/Project");
const Log = require("../models/Log");
const { createMongoDbUrl } = require("./synchronizeUtils");
const { GOOGLE_SHEET_SCOPES } = require("./constants");

const observerDbs = async () => {
  const allProjects = await Project.find();
  allProjects.forEach(async project => {
    const { title, sheetUrl, creator } = project;
    const URL = createMongoDbUrl(project);
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
        const type = operationType.toUpperCase();
        if (creator.toString() !== process.env.MOCK_AUTH_ID) {
          const { oauthAccessToken, oauthRefreshToken } =
            await User.findById(creator);

          const spreadsheetId = sheetUrl.split("/d/")[1].split("/")[0];

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
            spreadsheetId,
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
            spreadSheetId,
            rowIndex,
            columnIndex,
            value,
          ) => {
            const range = `${coll}!${rowIndex}${columnIndex}`;

            try {
              await sheets.spreadsheets.values.update({
                spreadSheetId,
                range,
                valueInputOption: "RAW",
                resource: {
                  values: [[value]],
                },
              });
            } catch (error) {
              console.error(error);
            }
          };

          const newData = Object.values(updatedFields)[0];

          updateCellValue(
            sheetsClient,
            spreadsheetId,
            updatedRowIndex,
            updatedColumnIndex,
            newData,
          );
        }

        const findLog = await Log.find({
          message: `${type}${operationDescription ? ` ${operationDescription}` : ""} ${_id.toString()} WHERE: ${coll}`,
          project: project._id,
        });

        if (!findLog.length) {
          await Log.create({
            type,
            message: `${type}${operationDescription ? ` ${operationDescription}` : ""} ${_id.toString()} WHERE: ${coll}`,
            collectionName: coll,
            project: project._id,
          });
        }
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
