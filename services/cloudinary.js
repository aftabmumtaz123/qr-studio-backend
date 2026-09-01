const cloudinary = require('cloudinary').v2;

const CLOUDINARY_URL = process.env.CLOUDINARY_URL || 'cloudinary://788944256347799:a_LYPnSxihBojBrHjhHaF6Do78w@oxyhybmn';


// CLOUDINARY_URL = cloudinary://788944256347799:a_LYPnSxihBojBrHjhHaF6Do78w@oxyhybmn


console.log({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  has_secret: !!process.env.CLOUDINARY_API_SECRET,
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a buffer file (Image or PDF) to Cloudinary
 * @param {Buffer} fileBuffer
 * @param {Object} options
 * @returns {Promise<Object>}
 */
const uploadBufferToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "dynamic_qr_assets",
        resource_type: options.resource_type || "auto",
        public_id: options.public_id,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

module.exports = {
  cloudinary,
  uploadBufferToCloudinary,
};
