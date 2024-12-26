const mongoose = require('mongoose');
const User = require('../models/userSchema');
const { Schema } = mongoose;

const couponSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  expireOn: {
    type: Date,
    required: true,
    validate: {
      validator: function (value) {
        return value > this.createdOn;
      },
      message: 'Expiry date must be after creation date',
    },
  },
  couponType: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed,'],
  },
  minPurchase: {
    type: Number,
    required: true,
    min: [0, 'Minimum price cannot be negative'],
  },
  discountPrice: {
    type: Number,
    required: true,
    min: [0, 'Offer price cannot be negative'],
  },
  maximumPrice: {
    type: Number,
    required: true,
    min: [0, 'Minimum price cannot be negative'],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  userId: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
});

couponSchema.index({ expireOn: 1 });

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
