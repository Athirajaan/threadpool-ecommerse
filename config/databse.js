const mongoose=require('mongoose');
const dotenv=require('dotenv').config();

const mongoUrl=process.env.MONGO_URL;

const connectDb=async ()=>{
    await mongoose.connect(mongoUrl);
}

module.exports=connectDb;