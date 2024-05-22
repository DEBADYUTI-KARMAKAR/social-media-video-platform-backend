import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js" 

const registerUser = asyncHandler(async(req,res)=>{
    //take data from user
    const {username,fullName,email,password}=req.body;
    console.log(req.body);
    console.log(email);
    // empty validation
    if([username,fullName,email,password].some((field)=>field?.trim()==="")){
        throw new ApiError(400,"All fields are required")
    }
    //  already exist or not
    const existUser = await User.findOne({
        $or:[{username},{email}]
    })

    if(existUser){
        throw new ApiError(409,"User already exist");
    }
    // check image and avatar
    const avaterLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    if(!avaterLocalPath){
        throw new ApiError(400,"avatar is required")
    }
    // add cloudinary
    const avatar = await uploadOnCloudinary(avaterLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!avatar){
        throw new ApiError(400,"Avatar is required");
    }

    // create entry in db
    const user = await User.create({
        username:username.toLowerCase(),
        fullName,
        email,
        password,
        avatar:avatar.url,
        coverImage:coverImage.url || "",

    });

    // remove password & refreshToken from response 
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if(!createdUser){
        throw new ApiError(500,"Something is wrong")
    }

    res.status(201).json(new ApiResponse(200,createdUser,"User Created Successfully"))
})

export{
    registerUser
}