const { google } = require("googleapis");
const { GOOGLE_SHEET_SCOPES } = require("./constants");
const User = require("../models/User");
const { configureOAuthClient } = require("./authUtils");
const Project = require("../models/Project");
const CustomError = require("./customError");
const { decryptPassword } = require("./typeConversionUtils");

const createMongoURI = (id, password, url, tableName) => {
  return `mongodb+srv://${id}:${password}@${url}${tableName ? `/${tableName}` : ""}`;
};

const createMongoDbUrl = project => {
  const { dbId, dbUrl, dbPassword, creator, title } = project;
  const isMock = creator.toString() === process.env.MOCK_AUTH_ID;
  const tableName = isMock ? "sample" : title;
  const password = decryptPassword(dbPassword);

  return `mongodb+srv://${dbId}:${password}@${dbUrl}${tableName ? `/${tableName}` : ""}`;
};

const checkForExistingProject = async (dbUrl, dbTableName, user) => {
  const isExistingProject = await Project.findOne({
    dbUrl,
    title: dbTableName,
    creator: user,
  });

  if (isExistingProject) {
    throw new CustomError(
      "You already have selected Table already exists.",
      400,
    );
  }
};

const generateSheetUrl = async user => {
  const findUser = await User.findById(user);
  const auth = configureOAuthClient();
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

  return sheetUrl;
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

const createProtectionRequest = (spreadsheetId, sheetId) => {
  return {
    spreadsheetId,
    resource: {
      requests: [
        {
          addProtectedRange: {
            protectedRange: {
              range: {
                sheetId,
              },
            },
          },
        },
      ],
    },
  };
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
    const addSheetRequests = collectionNames.map(name => ({
      addSheet: {
        properties: {
          title: name,
        },
      },
    }));

    addSheetRequests.push({
      updateSheetProperties: {
        properties: {
          sheetId: 0,
          hidden: true,
        },
        fields: "hidden",
      },
    });

    const batchUpdateResponse = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadSheetId,
      resource: { requests: addSheetRequests },
    });

    const updatedSpreadSheetId = batchUpdateResponse.data.spreadsheetId;

    await Promise.all(
      data.map(async (values, i) => {
        const range = `${collectionNames[i]}!A1`;

        await sheets.spreadsheets.values.append({
          spreadsheetId: updatedSpreadSheetId,
          range,
          valueInputOption: "RAW",
          resource: { values },
        });

        const sheetsInfo = await sheets.spreadsheets.get({
          spreadsheetId: updatedSpreadSheetId,
          ranges: collectionNames.map(name => name),
          includeGridData: false,
        });

        const { sheetId } = sheetsInfo.data.sheets.find(
          sheet => sheet.properties.title === collectionNames[i],
        ).properties;
        const protectionRequest = createProtectionRequest(
          updatedSpreadSheetId,
          sheetId,
        );

        await sheets.spreadsheets.batchUpdate(protectionRequest);
      }),
    );
  } catch (error) {
    console.error("에러", error);

    if (error.response && error.response.data && error.response.data.error) {
      console.error("Google API 응답 에러:", error.response.data.error);
      throw error;
    }
  }
};

const getDataPreview = (collectionNames, fetchedData) => {
  const firstData = fetchedData.map(collection =>
    collection.length > 1 ? [collection[0], collection[1]] : [collection[0]],
  );
  const dataPreview = {};

  collectionNames.forEach((collectionName, index) => {
    const ObjToArr = firstData[index].map(data => Object.entries(data));
    dataPreview[collectionName] = ObjToArr;
  });

  return dataPreview;
};

module.exports = {
  createMongoURI,
  createMongoDbUrl,
  checkForExistingProject,
  generateSheetUrl,
  fetchFromDatabase,
  formatDbData,
  appendToSheet,
  getDataPreview,
};
