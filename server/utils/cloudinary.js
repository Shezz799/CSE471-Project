const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (buffer, mimeType, folder) => {
  const base64 = `data:${mimeType};base64,${buffer.toString("base64")}`;

  return cloudinary.uploader.upload(base64, {
    folder,
    resource_type: "auto",
  });
};

module.exports = { uploadToCloudinary, cloudinary };
