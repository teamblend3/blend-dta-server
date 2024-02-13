const { google } = require("googleapis");
const { GOOGLE_SHEET_SCOPES } = require("./constants");

const formatDbData = async collections => {
  return collections.map(eachCollection => {
    const columns = Object.keys(eachCollection[0]);
    const columnCounts = columns.length;

    const eachCollectionData = [
      columns,
      ...eachCollection.map(rowData => {
        const rowCells = columns.map(columnName => rowData[columnName] || "");
        return columnCounts === rowCells.length
          ? rowCells
          : rowCells.map(String);
      }),
    ];

    const formattedData = eachCollectionData.map(row =>
      row.map(value =>
        typeof value === "object" ? JSON.stringify(value) : value,
      ),
    );

    return formattedData;
  });
};

const appendToSheet = async (
  sheetUrl,
  data,
  oauthAccessToken,
  oauthRefreshToken,
) => {
  try {
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

    const sheets = google.sheets({ version: "v4", auth });
    const tabCounts = Math.max(data.length, 1);

    const requests = Array.from({ length: tabCounts - 1 }, (_, index) => ({
      addSheet: { properties: { title: `시트${index + 2}` } },
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadSheetId,
      resource: { requests },
    });

    data.forEach((values, i) => {
      sheets.spreadsheets.values.append({
        spreadsheetId: spreadSheetId,
        range: `시트${i + 1}!A1`,
        valueInputOption: "RAW",
        resource: { values },
      });
    });

    return {
      message: true,
      collectionCount: tabCounts,
    };
  } catch (error) {
    console.error("에러", error);

    if (error.response && error.response.data && error.response.data.error) {
      console.error("Google API 응답 에러:", error.response.data.error);
      throw error;
    }

    return {
      message: false,
      error: "에러 발생",
    };
  }
};

module.exports = { formatDbData, appendToSheet };
