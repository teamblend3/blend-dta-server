const { google } = require("googleapis");
const { GOOGLE_SHEET_SCOPES } = require("./constants");

const createMongoDbUrl = (id, password, url, tableName) => {
  return `mongodb+srv://${id}:${password}@${url}${tableName ? `/${tableName}` : ""}`;
};

const fetchFromDatabase = async selectedDatabase => {
  const collections = await selectedDatabase.listCollections().toArray();
  const fetchDataPromises = collections.map(async collection => {
    const collectionName = collection.name;

    return selectedDatabase.collection(collectionName).find().toArray();
  });

  return Promise.all(fetchDataPromises);
};

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
  collectionNames,
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

    const requests = collectionNames.map(name => ({
      addSheet: {
        properties: {
          title: name,
        },
      },
    }));

    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: 0,
          hidden: true,
        },
        fields: "hidden",
      },
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadSheetId,
      resource: { requests },
    });

    data.forEach(async (values, i) => {
      const range = `${collectionNames[i]}!A1`;

      await sheets.spreadsheets.values.append({
        spreadsheetId: spreadSheetId,
        range,
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

const getDataPreview = (collectionNames, fetchedData) => {
  const firstData = fetchedData.map(collection => collection[0]);
  const dataPreview = collectionNames.map((collectionName, index) => ({
    [collectionName]: firstData[index],
  }));

  return dataPreview;
};

module.exports = {
  createMongoDbUrl,
  fetchFromDatabase,
  formatDbData,
  appendToSheet,
  getDataPreview,
};
