const { uploadBufferToCloudinary } = require("../services/cloudinary");

const uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const file = req.file;

    const uploadOptions = {
      resource_type: "image",
      public_id: `${Date.now()}_${file.originalname.replace(/\.[^.]+$/, "")}`,
    };

    const result = await uploadBufferToCloudinary(file.buffer, uploadOptions);

    res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      resourceType: result.resource_type,
      bytes: result.bytes,
      format: result.format,
      originalName: file.originalname,
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
};

module.exports = {
  uploadMedia,
};