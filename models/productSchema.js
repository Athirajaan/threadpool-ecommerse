const mongoose = require('mongoose');
const {Schema} = mongoose;

const productSchema =new Schema({
    productName:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    gender:{
        type:String,
        required:true
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true,
    },
    regularPrice:{
        type:Number,
        required:true,
    },
    sellingPrice:{
        type:Number,
        required:true,
    },
    productOffer:{
        type:Number,
        default:0
    },
    stock: {
        small: {
            type: Number,
            default: 0,
            min: 0
        },
        medium: {
            type: Number,
            default: 0,
            min: 0
        },
        large: {
            type: Number,
            default: 0,
            min: 0
        },
        extraLarge: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    productImage:{
        type:[String],
        required:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    status:{
        type:String,
        enum:["Available","out of stock"],
        default:"Available"
    }
},{timestamps:true});

const Product=mongoose.model("Product",productSchema);

module.exports=Product;