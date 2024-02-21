const User = require("../models/User");
const Project = require("../models/Project");
const Log = require("../models/Log");
const CustomError = require("../utils/customError");
const { uploadFileToS3 } = require("../utils/aws");
const {
  configureOAuthClient,
  getOAuthTokens,
  fetchGoogleUserInfo,
  createUser,
  updateUserTokens,
  sendAuthCookies,
  generateTokens,
  sendUserInfoResponse,
} = require("../utils/authUtils");

const login = async (req, res, next) => {
  try {
    const auth = configureOAuthClient();
    const tokens = await getOAuthTokens(req.body.code, auth);
    const userInfo = await fetchGoogleUserInfo(auth);
    let user = await User.findOne({ email: userInfo.email }).lean();
    if (!user) {
      user = await createUser(userInfo, tokens);
    } else {
      await updateUserTokens(user._id, tokens);
    }
    const { accessToken, refreshToken } = generateTokens(user._id);
    sendAuthCookies(res, accessToken, refreshToken);
    sendUserInfoResponse(res, user);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    res.clearCookie("AccessToken", { httpOnly: true });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const {
      params: { id },
      user,
    } = req;
    if (id !== user) {
      throw new CustomError("Unauthorized", 401);
    }
    const findUser = await User.findById(id);
    res.json({ success: true, findUser });
  } catch (error) {
    next(error);
  }
};

const editUserProfile = async (req, res, next) => {
  try {
    const {
      user,
      params: { id },
      body: { email, userName, fileName },
    } = req;
    if (user !== id) {
      throw new CustomError("Unauthorized", 401);
    }
    if (req.file) {
      const avatarFile = {
        name: `${new Date().toISOString()}-${userName}-${fileName}`,
        buffer: req.file.buffer,
      };
      const { Location } = await uploadFileToS3(avatarFile);
      const updatedUser = await User.findByIdAndUpdate(
        id,
        {
          email,
          userName,
          avatarUrl: Location,
        },
        { new: true },
      );
      res.json({ success: true, updatedUser });
    } else {
      const updatedUser = await User.findByIdAndUpdate(
        id,
        {
          email,
          userName,
        },
        { new: true },
      );
      res.json({ success: true, updatedUser });
    }
  } catch (error) {
    next(error);
  }
};

const getUserProjects = async (req, res, next) => {
  try {
    const { user } = req;
    const findUser = await User.findById(user).populate({
      path: "projects",
      select: "title dbUrl sheetUrl collectionNames createdAt",
      options: { sort: { createdAt: -1 } },
    });
    res.json({
      success: true,
      projectsLength: findUser.projects.length,
      projects: findUser.projects,
    });
  } catch (error) {
    next(error);
  }
};

const getUserProjectsLogs = async (req, res, next) => {
  try {
    const { user } = req;
    const findProjects = await Project.find({ creator: user });
    const projectIds = findProjects.map(project => project._id);
    const projectLogs = await Log.find({ project: { $in: projectIds } })
      .sort({
        createdAt: -1,
      })
      .populate({
        path: "project",
        select: "title",
      });
    res.json({ success: true, logs: projectLogs });
  } catch (error) {
    next(error);
  }
};

const validateUser = async (req, res, next) => {
  try {
    if (req.user) {
      const user = await User.findById(req.user);
      const userInfo = {
        userName: user.userName,
        userId: req.user,
        email: user.email,
        avatarUrl: user.avatarUrl,
      };
      res.json({ success: true, userInfo });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  logout,
  getUserProfile,
  editUserProfile,
  getUserProjects,
  getUserProjectsLogs,
  validateUser,
};
