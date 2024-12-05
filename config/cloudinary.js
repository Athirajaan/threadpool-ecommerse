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

// Use CloudinaryStorage with Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'products', // Specify the folder in Cloudinary
    format: async (req, file) => {
      const mimeType = file.mimetype.split('/')[1];

      if (mimeType === 'jpeg') return 'jpeg';
      if (mimeType === 'png') return 'png';
      if (mimeType === 'webp') return 'webp';

      // Default to jpeg if the format isn't recognized
      return 'jpeg';
    },
    quality: '100', // This will automatically optimize the quality (you can use 'auto', 'good', 'best' etc.)
    public_id: (req, file) => `${Date.now()}-${file.originalname}`,
  },
});

// Initialize Multer
const upload = multer({ storage });

module.exports = upload;
