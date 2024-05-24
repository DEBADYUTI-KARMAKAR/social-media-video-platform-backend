import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBefore: false });
    return {
      accessToken,
      refreshToken,
    };
  } catch (error) {
    throw new ApiError(500, "Something is wrong while generate");
  }
};
//register user
const registerUser = asyncHandler(async (req, res) => {
  //take data from user
  const { username, fullName, email, password } = req.body;
  console.log(req.body);
  console.log(email);
  // empty validation
  if (
    [username, fullName, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }
  //  already exist or not
  const existUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existUser) {
    throw new ApiError(409, "User already exist");
  }
  // check image and avatar
  const avaterLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;
  if (!avaterLocalPath) {
    throw new ApiError(400, "avatar is required");
  }
  // add cloudinary
  const avatar = await uploadOnCloudinary(avaterLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Avatar is required");
  }

  // create entry in db
  const user = await User.create({
    username: username.toLowerCase(),
    fullName,
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage.url || "",
  });

  // remove password & refreshToken from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something is wrong");
  }

  res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Created Successfully"));
});
// login user
const loginUser = asyncHandler(async (req, res) => {
  //take data from user
  const { username, email, password } = req.body;
  // check username or email
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }
  //find user
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "user doesn't exist");
  }
  //check password
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Enter the correct password");
  }
  // generate accessToken and refreshToken
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );
  //send cookie
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

//logout user
const logoutUser = asyncHandler(async (req, res) => {
  User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );
  const options ={
    httpOnly:true,
    secure:true
  }

  return res.status(200).clearCookie("accessToken",options).clearCookie("refreshToken",options).json(
    new ApiResponse(200,{},"logout successfully")
  )
});

export { registerUser, loginUser, logoutUser };
