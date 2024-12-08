const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    UserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    address: [
      {
        addressType: {
          type: String,
          required: true,
          enum: ["Home", "Work", "Office", "Other"],
        },
        name: {
          type: String,
          required: true,
          minlength: 3,
          maxlength: 50,
        },
        city: {
          type: String,
          required: true,
          minlength: 2,
          maxlength: 100,
        },
        landMark: {
          type: String,
          required: true,
          maxlength: 100,
        },
        state: {
          type: String,
          required: true,
        },
        pincode: {
          type: Number,
          required: true,
          min: 100000,
          max: 999999,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
       
      },
    ],
  },
  { timestamps: true },
);

const Address = mongoose.model("Address", addressSchema);

module.exports = Address;
