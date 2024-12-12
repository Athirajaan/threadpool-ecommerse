const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderedItems: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
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
        enum: ["S", "M", "L", "XL"],
        default: "M",
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
    ref: "Address",
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: [
      "Pending",
      "Shipped",
      "out for delivery",
      "Delivered",
      "Cancelled",
      "Returned",
    ],
  },
  invoice: {
    invoiceId: { 
      type: String, 
      required: true 
    }, // Unique Invoice ID
    dateGenerated: { 
      type: Date, 
      default: Date.now 
    }, // Date Invoice was created
    invoiceURL: { 
      type: String, 
      required: false 
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
  paymentStatus: {
    type: String,
    enum: ["Pending", "Completed", "Failed"],
    default: "Pending",
  },
  paymentMethod: {
    type: String,
    enum: ["Credit Card", "Debit Card", "PayPal", "Cash on Delivery"],
    default: "Credit Card",
  },
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
