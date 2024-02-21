const mongoose = require("mongoose");

const mongooseLoader = async () => {
  try {
    const dbUrl = process.env.MONGO_URL;
    await mongoose.connect(dbUrl);
    console.log(`Connected to database at ${dbUrl}`);
  } catch (error) {
    console.error("Database connection error:", error);
  }
};

module.exports = mongooseLoader;
