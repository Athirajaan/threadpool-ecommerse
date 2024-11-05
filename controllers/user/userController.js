
const User=require("../../models/userSchema")
const env=require('dotenv').config();
const nodemailer=require('nodemailer');
const bcrypt=require('bcrypt')

const loadSignup=async (req,res)=>{
    try {
         return res.render("signup");
    }
    catch(error) {
        console.log("homepage not found")
        res.status(500).send("server error")
    }
}
const loadHomepage=async (req,res)=>{
    try {
         return res.render("homepage");
    }
    catch(error) {
        console.log("homepage not found")
        res.status(500).send("server error")
    }
}


function generateOtp(){
    return Math.floor(1000 + Math.random()*9000).toString();
}

async function sendVerificationEmail(email,otp){
    try {
    const transporter=nodemailer.createTransport({
        service:'gmail',
        port:587,
        secure:false,
        auth:{
            user:process.env.NODEMAILER_EMAIL,
            pass:process.env.NODEMAILER_PASSWORD
        }
    })
    const info = await transporter.sendMail({
        from:process.env.NODEMAILER_EMAIL,
        to:email,
        subject: "Verify Your Account - OTP Inside",
        text:`Hello! Use the following OTP to verify your account: ${otp}. It expires in 1 minute.`,
        html: `<div style="font-family: Arial, sans-serif;">
        <p>Hi,</p>
        <p>Use the following OTP to verify your account:</p>
        <h2 style="color: #4CAF50;">${otp}</h2>
        <p>This OTP is valid for 1 minute. If you didn't request this, please ignore this email.</p>
        <p>Thanks,<br/>ThreadPool online shopping</p>
    </div>`,
    })
    return info.accepted.length > 0
    }
    catch(error){
        console.error("Error sending email",error);
        return false;
    }
}


const signup=async (req,res)=>{
    try {
       const {name,phone,email,password,cpassword}=req.body;
       if(password!==cpassword){
        return res.render("signup",{message:"passwords donot match"});
       }
       const findUser=await User.findOne({email});
       if(findUser){
        return res.render("signup",{message:"User with this emailalready exists"});
       }

       const otp=generateOtp();

       const emailSent=await sendVerificationEmail(email,otp);
       if(!emailSent){
        return res.json("Email-error");
       }

       req.session.userOtp=otp;
       req.session.userData={name,phone,email,password};

       res.render("verify-otp");
       console.log("OTP send",otp)
    }
    catch(error){
       console.error("signup error",error);
       res.redirect("/pageNotFound")
    }
}

const securePassword =async (password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10)

        return passwordHash;
         
        } catch (error) {
        
    }
}
const varifyOtp = async (req,res)=>{
    try {
        
        const {otp}=req.body;
        console.log(otp)

        if(req.session.userOtp && otp===req.session.userOtp){
            const user=req.session.userData;
            const passwordHash =await securePassword(user.password);
            
            const saveUserData=new User({
              name:user.name,
              email:user.email,
              phone:user.phone,
              
              password:passwordHash,
            })

            await saveUserData.save();
            req.session.user=saveUserData._id;
            res.json({success:true,redirectUrl:"/"})
        } else{
            res.status(400).json({success:false,message:"Invalid OTP,Please try again"})
        }
    } catch (error) {
        console.error("Error verifing OTP",error);
        res.status(500).json({success:false,message:"An error occured"})
    }
}
const resendOtp = async (req, res) => {
    try {
        const newOtp = generateOtp();
        req.session.userOtp = newOtp;

        const emailSent = await sendVerificationEmail(req.session.userData.email, newOtp);

        if (emailSent) {
            res.json({ success: true, message: 'OTP resent successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send OTP' });
        }
    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ success: false, message: 'Error resending OTP' });
    }
};

module.exports={
    loadHomepage,
    loadSignup,
    signup,
    varifyOtp,
    resendOtp
}