const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
  orderId: {
    type: String,
    unique: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderedItems: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
      size: {
        type: String,
        enum: ['S', 'M', 'L', 'XL'],
        default: 'M',
      },
      status: {
        type: String,
        required: true,
        enum: [
          'Pending',
          'Shipped',
          'out for delivery',
          'Delivered',
          'Cancelled',
          'Returned',
        ],
        default: 'Pending',
      },
    },
  ],
  phoneNumber: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: (props) => `${props.value} is not a valid phone number!`,
    },
  },
  discount: {
    type: Number,
    default: 0,
  },
  finalAmount: {
    type: Number,
    required: true,
  },
  address: {
    type: Schema.Types.ObjectId,
    ref: 'Address',
    required: true,
  },
  invoice: {
    invoiceId: {
      type: String,
      required: true,
    }, // Unique Invoice ID
    dateGenerated: {
      type: Date,
      default: Date.now,
    }, // Date Invoice was created
    invoiceURL: {
      type: String,
      required: false,
    }, // Link to the invoice (PDF or digital copy)
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
  appliedCoupon: {
    type: Schema.Types.ObjectId,
    ref: 'Coupon',
  },
  couponDiscount: {
    type: Number,
    default: 0,
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending',
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['Cash on Delivery', 'Wallet', 'Razorpay'],
  },
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
