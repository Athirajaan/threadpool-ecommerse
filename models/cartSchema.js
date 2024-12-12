const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  items: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        default: 1,
      },
      size :{
        type: String,
        required: true,
      },
      salePrice: {
        type: Number,
        required: true,
      },
      totalPrice: {
        type: Number,
        required: true,
      },
    },
  ],
  totalCartPrice: {
    type: Number,
    default: 0,
  },
  finalAmount : {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

cartSchema.pre("save", function (next) {
  if (this.isModified("items")) {
    this.totalCartPrice = this.items.reduce(
      (total, item) => total + item.totalPrice,
      0
    );
  }
  next();
});

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;
