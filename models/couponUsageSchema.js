const mongoose = require('mongoose');
const User = require('../models/userSchema');
const Coupon = require('../models/couponSchema');
const { Schema } = mongoose;

const couponUsageSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  couponId: {
    type: Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true,
  },
  usageCount: {
    type: Number,
    default: 1,
    required: true,
  },
  lastUsed: {
    type: Date,
    default: Date.now,
    required: true,
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
});

// Compound index to ensure unique combination of userId and couponId
couponUsageSchema.index({ userId: 1, couponId: 1 }, { unique: true });

const CouponUsage = mongoose.model('CouponUsage', couponUsageSchema);
module.exports = CouponUsage;
