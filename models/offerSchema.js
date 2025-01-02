const mongoose = require('mongoose');
const { Schema } = mongoose;

const offerSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[A-Za-z\s]+$/, // Only letters and spaces allowed
  },
  offerType: {
    type: String,
    required: true,
    enum: ['Product', 'Category'],
  },
  gender: {
    type: String,
    required: true,
    enum: ['Men', 'Women'],
  },
  applicableFor: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'offerType',
  },
  percentage: {
    type: Number,
    required: true,
    min: 1,
    max: 70,
  },
  endDate: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const Offer = mongoose.model('Offer', offerSchema);
module.exports = Offer;
