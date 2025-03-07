const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    gender: {
      type: String,
      required: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    regularPrice: {
      type: Number,
      required: true,
    },
    salePrice: {
      type: Number,
      required: true,
    },
    createdOn: {
      type: Date,
      default: Date.now,
    },
    // Size Quantities
    stock: {
      S: {
        type: Number,
        default: 0,
        min: 0,
      },
      M: {
        type: Number,
        default: 0,
        min: 0,
      },
       L: {
        type: Number,
        default: 0,
        min: 0,
      },
       XL: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    totalQuantity: {
      type: Number,
      default: 0,
    },
    
    productImage: {
      type: [String], // Array of image URLs
      required: true,
    },
    status: {
      type: String,
      enum: ["Available", "out of stock","limited stock","Unavailable"],
      default: "Available",
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    addToCartCount: {
      type: Number,
      default: 0,
    },
    salesCount: {
      type: Number,
      default: 0,
    },
    wishlistCount: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
