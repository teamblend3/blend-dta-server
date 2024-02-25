const mongoose = require("mongoose");

const { createMongoDbUrl } = require("./synchronizeUtils");
const { decryptPassword } = require("./typeConversionUtils");

async function fetchDataFromDatabase(collection, columns, dbConfig) {
  const { dbId, dbPassword, dbUrl, title } = dbConfig;
  const passwordDecrypted = decryptPassword(dbPassword);
  const URL = createMongoDbUrl(dbId, passwordDecrypted, dbUrl, title);
  const connection = mongoose.createConnection(URL);

  return new Promise((resolve, reject) => {
    connection.once("connected", async () => {
      try {
        const { db } = connection;
        const projection = columns.reduce(
          (acc, field) => ({ ...acc, [field]: 1 }),
          { _id: 0 },
        );
        const data = await db
          .collection(collection)
          .find({}, { projection })
          .toArray();
        resolve(data);
      } catch (error) {
        reject(error);
      } finally {
        connection.close();
      }
    });

    connection.on("error", error => {
      reject(error);
      connection.close();
    });
  });
}

function transformData(data) {
  return data.map(record =>
    Object.keys(record).reduce(
      (acc, key) => ({
        ...acc,
        [key]:
          typeof record[key] === "object"
            ? JSON.stringify(record[key])
            : record[key],
      }),
      {},
    ),
  );
}

module.exports = { fetchDataFromDatabase, transformData };
