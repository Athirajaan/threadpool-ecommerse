
const env = require('dotenv').config(); // Load environment variables
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const publicId = `${Date.now()}-${file.originalname
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_\.]/g, '')}`;
    return {
      folder: 'product-images', // Corrected folder name
      public_id: publicId, // Unique public ID for each image
      resource_type: 'image', // Ensure only images are uploaded
      format: 'webp', // Force conversion to WebP format
      transformation: [
        {
          width: 800,
          height: 800,
          crop: 'fill', // Ensure images fit within the dimensions
          quality: 'auto:best', // Automatically set best quality
        },
      ],
    };
  },
});

// Initialize Multer
const upload = multer({ storage });

module.exports = upload;
