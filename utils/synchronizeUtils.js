const { google } = require("googleapis");
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

  const stringifiedData = data.map(outerArray =>
    outerArray.map(innerArray =>
      innerArray.map(value =>
        typeof value === "object" ? JSON.stringify(value) : String(value),
      ),
    ),
  );

  return stringifiedData;
};

const appendToSheet = async (
  sheetUrl,
  data,
  oauthAccessToken,
  oauthRefreshToken,
  scopes,
) => {
  try {
    const spreadSheetId = sheetUrl.match(/\/spreadsheets\/d\/(.*?)(\/|$)/)[1];
    const auth = new google.auth.OAuth2({
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      scopes,
    });

    auth.setCredentials({
      access_token: oauthAccessToken,
      refresh_token: oauthRefreshToken,
    });

    const sheets = google.sheets({ version: "v4", auth });
    const tabCounts = data.length;

    const requests = Array.from(
      { length: Math.max(tabCounts - 1, 1) },
      (_, index) => {
        return {
          addSheet: {
            properties: {
              title: `시트${index + 2}`,
            },
          },
        };
      },
    );

    const batchUpdateRequest = { requests };

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadSheetId,
      resource: batchUpdateRequest,
    });

    for (let i = 0; i < tabCounts; i += 1) {
      sheets.spreadsheets.values.append({
        spreadsheetId: spreadSheetId,
        range: `시트${i + 1}!A1`,
        valueInputOption: "RAW",
        resource: {
          values: data[i],
        },
      });
    }
  } catch (error) {
    console.error("에러", error);

    if (error.response && error.response.data && error.response.data.error) {
      console.error("Google API 응답 에러:", error.response.data.error);
      throw error;
    }
  }
};

module.exports = { formatDbData, appendToSheet };
