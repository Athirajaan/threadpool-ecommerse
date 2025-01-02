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
        if (this.isNew) {
          return value > this.createdOn || value > new Date();
        }
        return value > new Date();
      },
      message: 'Expiry date must be a future date',
    },
  },
  couponType: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed'],
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
  usagePerUser: {
    type: Number,
    required: true,
    min: [1, 'Usage per user must be at least 1'],
    default: 1,
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
