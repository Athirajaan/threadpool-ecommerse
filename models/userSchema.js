const mongoose=require("mongoose");
const {Schema}=mongoose;

const userSchema = new Schema({
    name : {
        type:String,
        required:true
    },
    email: {
        type:String,
        required:true,
        unique:true
    },
    phone : {
        type:String,
        unique:true,
        sparse:true,
        default:undefined,
    },
    password : {
        type:String,
        required: function () {
            return !this.googleId;
          }, 
    },
    googleId: {
        type: String,
        sparse: true,
        index: {
          unique: true,
          partialFilterExpression: { googleId: { $exists: true } }
        }
    },
    isBlocked : {
        type:Boolean,
        default:false
    },
    referralCode : {
        type:String,
    },
    redeemed : {
        type:Boolean,
        default:false
    },
    redeemedUsers : [{
        type:Schema.Types.ObjectId,
        ref:"User"
    }],


}, { timestamps: true });

const User=mongoose.model("User",userSchema);

module.exports=User;
