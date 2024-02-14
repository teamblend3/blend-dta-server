const User = require("../models/User");
const { makeAccessToken, makeRefreshToken } = require("../utils/jwtUtils");
const { COOKIE_MAX_AGE, ITEMS_PER_PAGE } = require("../utils/constants");
const CustomError = require("../utils/customError");
const { uploadFileToS3 } = require("../utils/aws");

const login = async (req, res, next) => {
  try {
    const {
      email,
      displayName: userName,
      photoURL: avatarUrl,
      uid: googleId,
      oauthAccessToken,
      oauthRefreshToken,
    } = req.body;
    const findUser = await User.findOne({ email }).lean();

    if (findUser) {
      const accessToken = makeAccessToken(findUser._id);
      const refreshToken = makeRefreshToken(findUser._id);
      await User.findByIdAndUpdate(findUser._id, {
        refreshToken,
        oauthAccessToken,
        oauthRefreshToken,
      });

      res
        .cookie("accessToken", accessToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
          secure: true,
        })
        .cookie("refreshToken", refreshToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
          secure: true,
        })
        .json({
          success: true,
          userInfo: {
            email: findUser.email,
            userName: findUser.userName,
            avatarUrl: findUser.avatarUrl,
            userId: findUser._id,
          },
        });
    } else {
      const newUser = await User.create({
        email,
        userName,
        avatarUrl,
        googleId,
        oauthAccessToken,
        oauthRefreshToken,
      });
      const accessToken = makeAccessToken(newUser._id);
      const refreshToken = makeRefreshToken(newUser._id);

      await User.findByIdAndUpdate(newUser._id, { refreshToken });

      res
        .cookie("accessToken", accessToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
          secure: true,
        })
        .cookie("refreshToken", refreshToken, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
          secure: true,
        })
        .json({
          success: true,
          userInfo: {
            email: newUser.email,
            userName: newUser.userName,
            avatarUrl: newUser.avatarUrl,
            userId: newUser._id,
          },
        });
    }
  } catch (error) {
    console.log(error);
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

    return res.json({ success: true, findUser });
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
      return res.json({ success: true, updatedUser });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        email,
        userName,
      },
      { new: true },
    );

    console.log(updatedUser);

    return res.json({ success: true, updatedUser });
  } catch (error) {
    next(error);
  }
};

const getUserProjects = async (req, res, next) => {
  try {
    const {
      user,
      query: { page },
    } = req;

    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const findUser = await User.findById(user).populate({
      path: "projects",
      select: "title collectionCount createdAt",
      options: { sort: { createdAt: -1 } },
    });

    res.json({
      success: true,
      projectsLength: findUser.projects.length,
      projects: findUser.projects.slice(
        startIndex,
        startIndex + ITEMS_PER_PAGE,
      ),
    });
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
  getUserProfile,
  editUserProfile,
  getUserProjects,
  validateUser,
};
