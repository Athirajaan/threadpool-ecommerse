const User = require("../../models/userSchema");
const Category =require("../../models/categorySchema");
const Product =require('../../models/productSchema');
const Calculate=require('../../models/categorySchema');
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");

//pageNotFound
const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

//loadSignUp
const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("homepage not found");
    res.status(500).send("server error");
  }
};

//load verify otp page
const loadVerifyOtpPage = async (req, res) => {
  try {
    return res.render("verify-otp");
  } catch (error) {
    console.log("homepage not found");
    res.status(500).send("server error");
  }
};

// load home page
const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user; 
    const categories = await Category.find({ isListed: true });
   
    let productData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map(category => category._id) },
      totalQuantity: { $gt: 0 }, 
    });


    productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

    productData = productData.slice(0, 4);

    if (user) {
      const userData = await User.findOne({ _id: user._id });
      return res.render("homepage", { 
        user: userData, 
        products: productData, 
        isLoggedIn: true 
      });
    } else {
      return res.render("homepage", { 
        products: productData, 
        isLoggedIn: false 
      });
    }

  } catch (error) {
    console.error("Error loading homepage:", error);
    res.status(500).send("Server error");
  }
};




//load login page
const loadLoginPage = async (req, res) => {
  try {
    return res.render("login");
  } catch (error) {
    console.log("login page not found");
    res.status(500).send("server error");
  }
};

// function to generate otp
function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify Your Account - OTP Inside",
      text: `Hello! Use the following OTP to verify your account: ${otp}. It expires in 1 minute.`,
      html: `<div style="font-family: Arial, sans-serif;">
        <p>Hi,</p>
        <p>Use the following OTP to verify your account:</p>
        <h2 style="color: #4CAF50;">${otp}</h2>
        <p>This OTP is valid for 1 minute. If you didn't request this, please ignore this email.</p>
        <p>Thanks,<br/>ThreadPool online shopping</p>
    </div>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, cpassword } = req.body;
    if (password !== cpassword) {
      return res.render("signup", { message: "passwords donot match" });
    }
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", {
        message: "User with this email already exists",
      });
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json("Email-error");
    }

    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password };

    res.render("verify-otp", { message: "" });
    console.log("OTP sent", otp);
  } catch (error) {
    console.error("signup error", error);
    res.redirect("/pageNotFound");
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);

    return passwordHash;
  } catch (error) {}
};
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log(otp);

    if (req.session.userOtp && otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);

      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
      });

      await saveUserData.save();
      req.session.user = saveUserData._id;
      res.json({ success: true, redirectUrl: "/" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Invalid OTP,Please try again" });
    }
  } catch (error) {
    console.error("Error verifing OTP", error);
    res.status(500).json({ success: false, message: "An error occured" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const newOtp = generateOtp();
    req.session.userOtp = newOtp;

    const emailSent = await sendVerificationEmail(
      req.session.userData.email,
      newOtp,
    );

    if (emailSent) {
      console.log("Resent otp:", newOtp);
      res.json({ success: true, message: "OTP resent successfully" });
    } else {
      res.status(500).json({ success: false, message: "Failed to send OTP" });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({ success: false, message: "Error resending OTP" });
  }
};

const login = async (req, res) => {
  try {
    console.log(req.body);
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: false, email: email });
    console.log("User found:", findUser);

    if (!findUser) {
      console.log("User not found");
      return res.render("login", { message: "User not found" });
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect password" });
    }

    req.session.userId = findUser._id;
    req.session.user = findUser;
    res.redirect("/");
  } catch (error) {
    console.error("login error");
    res.render("login", { message: "Please try again later" });
  }
};



const logoutUser= (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Unable to log out');
    }
    res.redirect('/logIn'); // Redirect to home page after logging out
  });
};


const loadWomenShopping = async (req,res)=>{
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id:user})
    const category = await Category.find({isListed:true,gender:women})
    const categoryIds = category.map((categories)=>categories._id.toString())
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page-1)*limit;
    const products =await Product.find({ 
      isBlocked:false,
      category:{$in:categoryIds},
      totalQuantity:{$gt:0}
    }).sort({createdOn:-1}).skip(skip).limit(limit);
    const totalProducts = await Product.countDocuments({
      isBlocked:false,
      category:{$in:categoryIds},
      totalQuantity:{$gt:0}
    });
    const totalPages = Math.ceil(totalProducts/limit);
    const categoryWithIds = category.map((categories)=>({_id:categories,name:categories.name}))

     res.render('womenShop',{
      user : userData,
      products:products,
      category:categoryWithIds,
      totalProducts:totalProducts,
      currentPage:page,
      totalPages:totalPages
     })
     
  } catch (error) {
    res.redirect('/pageNotFound')
  }
}


const loadMenShopping = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.redirect('/login'); // Redirect to login if user is not found
    }

    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true, gender: 'men'});
    if (!categories.length) {
      return res.render('menShope', {
        user: userData,
        products: [],
        category: [],
        totalProducts: 0,
        currentPage: 1,
        totalPages: 1,
      });
    }

    const categoryIds = categories.map(category => category._id.toString());
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const products = await Product.find({
      isBlocked: false,
      category: { $in: categoryIds },
      totalQuantity: { $gt: 0 },
    })
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      category: { $in: categoryIds },
      totalQuantity: { $gt: 0 },
    });

    const totalPages = Math.ceil(totalProducts / limit);
    const categoriesList = categories.map(category => ({
      _id: category._id,
      name: category.name,
    }));

    res.render('menshope', {
      user: userData,
      products: products,
      category: categoriesList,
      totalProducts: totalProducts,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    console.error(error);
    res.redirect('/pageNotFound');
  }
};


const loadProfile = async (req,res)=>{
  try {
    res.render('userProfile')
  } catch (error) {
    res.redirect('/pageNotFound')
  }
}


module.exports = {
  loadHomepage,
  loadSignup,
  loadLoginPage,
  signup,
  loadVerifyOtpPage,
  verifyOtp,
  resendOtp,
  pageNotFound,
  login,
  logoutUser,
  loadWomenShopping ,
  loadMenShopping,
  loadProfile,
};
