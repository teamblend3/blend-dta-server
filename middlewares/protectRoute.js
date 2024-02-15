const CustomError = require("../utils/customError");

const onlyPublic = (req, res, next) => {
  if (req.user) {
    const error = new CustomError("Forbidden", 403);
    next(error);
  } else {
    next();
  }
};

const onlyPrivate = (req, res, next) => {
  if (req.user) {
    next();
  } else {
    const error = new CustomError("Forbidden", 403);
    next(error);
  }
};

module.exports = {
  onlyPublic,
  onlyPrivate,
};
