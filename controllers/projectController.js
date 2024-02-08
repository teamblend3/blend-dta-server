const { google } = require("googleapis");
const User = require("../models/User");

const generateSheetUrl = async (req, res, next) => {
  try {
    const findUser = await User.findById(req.user);
    const auth = new google.auth.OAuth2();
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

    res.json({ success: true, sheetUrl });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports = { generateSheetUrl };
