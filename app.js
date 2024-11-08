const express=require('express');
const app=express();
const env=require('dotenv').config();
const session=require('express-session');
const connectDb=require('./config/databse');
const path=require('path');
const userRouter=require("./routes/userRouter");


const port=process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({extended:true}))
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))
app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next();
});


app.set("view engine","ejs");
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname,"public")));

app.use("/",userRouter);




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