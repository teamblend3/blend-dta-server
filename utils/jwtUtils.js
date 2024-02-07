const jwt = require("jsonwebtoken");

const makeAccessToken = id => {
  try {
    const token = jwt.sign(
      {
        id,
      },
      process.env.SECRET_KEY,
      { expiresIn: "1h" },
    );

    return token;
  } catch (error) {
    console.log(error);
    return null;
  }
};
const makeRefreshToken = id => {
  try {
    const token = jwt.sign(
      {
        id,
      },
      process.env.SECRET_KEY,
      {
        expiresIn: "14d",
      },
    );
    return token;
  } catch (error) {
    console.log(error);
    return null;
  }
};
const jwtVerifyToken = token => {
  try {
    const user = jwt.verify(token, process.env.SECRET_KEY);
    return {
      type: true,
      id: user.id,
    };
  } catch (error) {
    return {
      type: false,
      message: error.message,
    };
  }
};

module.exports = {
  jwtVerifyToken,
  makeAccessToken,
  makeRefreshToken,
};
