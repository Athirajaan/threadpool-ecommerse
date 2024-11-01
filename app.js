const express=require('express');
const app=express();
const env=require('dotenv').config();
const connectDb=require('./config/databse');


const port=process.env.PORT || 8080;

connectDb()
.then(()=>{
    console.log("database connection established..");
    app.listen(port, ()=>{
        console.log("Server running on port", port);
    })
})
.catch((err)=>{
    console.error("databse canot be connected",err);
})