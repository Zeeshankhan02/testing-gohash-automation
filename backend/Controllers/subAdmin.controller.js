import { subAdminModel } from "../Models/subAdmin.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios"
import { createNewsModel } from "../Models/createNews.model.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.util.js";
export const loginPost = async function (req, res) {
  try {
    const { email, password } = req.body;


    // 1. Find user
    const subAdmin = await subAdminModel.findOne({ email });
    if (!subAdmin) {
      return res.status(404).json({ msg: "SubAdmin not found" });
    }

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, subAdmin.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Incorrect password" });
    }

    // 3. Generate JWT
    const token = jwt.sign(
      { id: subAdmin._id, },
      process.env.JWT_SECRET, // use .env
    );

    // 4. Sending response
    return res.status(200).json({
      msg: "Login successful",
      token,
      user: {
        id: subAdmin._id,
        email: subAdmin.email,
        fullname: subAdmin.fullname,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ msg: "Internal Server Error" });

  }
};

export const uploadMedia = async (req, res) => {
  let uploadedPublicId = null
  try {
    const file = req.files?.media
    if (!file) {
      return res.status(400).json({ success: false, msg: "Video file not selected" });
    }

    // Upload to Cloudinary
    const cloudinaryResponse = await uploadOnCloudinary(file.data);
    if (!cloudinaryResponse) {
      return res.status(500).json({ success: false, msg: "Upload to Cloudinary failed" });
    }

    console.log("uploaded to cloud", cloudinaryResponse.secure_url);
    uploadedPublicId = cloudinaryResponse.public_id
    const videoUrl = cloudinaryResponse.secure_url;
    const payload = {
      title: req.body.title || "Untitled Video",
      description: req.body.description || "No description",
      videoUrl,
      type: req.body.type
    };

    // Call Make.com
    let makeResponse;
    try {
      makeResponse = await axios.post(process.env.MAKE_WEBHOOK_URL, payload, {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Make.com request failed:", err.response?.data || err.message);
      return res.status(502).json({ success: false, msg: "Make.com webhook failed", details: err.response?.data });
    }

    // Check if Make returned success
    if (!makeResponse.data.success) {
      await deleteOnCloudinary(uploadedPublicId, "video");
      return res.status(500).json({
        success: false,
        msg: `Failed to upload on ${makeResponse.data.platform || "socials"}`,
        details: makeResponse.data.message || "Unknown error",
      });
    }

    // Safe fallback for YouTube videoId
    const youtubeId = makeResponse.data.youtube?.videoId || null;

    // Save to DB
    const news = new createNewsModel({
      title: payload.title,
      description: payload.description,
      youtubeIframe: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null,
      type: payload.type,
      createdBy: req.user.id, // Use JWT user
      cloudinaryUrl: videoUrl,
      public_id: cloudinaryResponse.public_id // Store for deletion later
    });

    await news.save();

    return res.status(201).json({
      msg:
        payload.type === "ads"
          ? "Ad created successfully and uploaded to all socials"
          : "News created successfully and uploaded to all socials",
      news
    });

  } catch (error) {
   console.error("Upload Error:", error);

    // Cleanup on unexpected error
    if (uploadedPublicId) {
            try {
        await deleteOnCloudinary(uploadedPublicId, "video");
        console.log("Deleted from Cloudinary after unexpected error");
      } catch (cleanupErr) {
        console.error("Cloudinary cleanup failed:", cleanupErr);
      }
    }

    res.status(500).json({ success: false, msg: "Something went wrong during upload" });
  }
};


export const viewNewsCreated = async (req, res) => {

  try {

    const allNewsArticles = await createNewsModel.find({
      createdBy: req.user.id,
      type: { $in: ["dailyBulletin", "general"] }
    })

    if (!allNewsArticles) return res.json({
      msg: "No articles found"
    })

    res.json({
      msg: "All news articles Fetched successfully",
      articlesCreated: allNewsArticles
    })

  } catch (error) {
    return res.josn({
      msg: "internal server error"
    })
  }


}


export const deleteNews = async (req, res) => {
  const { articleId } = req.params
  try {
    const deleteNews = await createNewsModel.findByIdAndDelete(articleId)

    if (!deleteNews) return res.status(400).json({
      msg: "Failed to delete"
    })

    res.status(200).json({
      msg: "deleted successfully",
      news: deleteNews
    })

  } catch (error) {
    res.status(500).json({
      msg: "Internal server error"
    })
  }
}