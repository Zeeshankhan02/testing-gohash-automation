import { v2 as cloudinary } from "cloudinary"
import streamifier from "streamifier";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY
});

const uploadOnCloudinary = async (buffer) => {
  if (!buffer) return null;

  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "clientUploads",
          timeout: 120000
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      // Convert buffer → readable stream and pipe into upload stream
      streamifier.createReadStream(buffer).pipe(uploadStream);
    });

    return result;
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    return null;
  }
};

const deleteOnCloudinary = async (publicId) => {
  const response = await cloudinary.uploader.destroy(publicId, {
    resource_type: "video",
  })

  if (!response) {
    throw new Error(500, "Error while deleting")
  }
  console.log("deleted from cloudinary");
  
  return response
}

export { uploadOnCloudinary, deleteOnCloudinary }