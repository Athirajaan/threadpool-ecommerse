const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Calculate = require('../../models/categorySchema');
const Address = require('../../models/adressScheme');
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

//pageNotFound
const pageNotFound = async (req, res) => {
  try {
    res.render('pageNotFound');
  } catch (error) {
    res.status(500).send('server error');
  }
};

//loadSignUp
const loadSignup = async (req, res) => {
  try {
    return res.render('signup');
  } catch (error) {
    console.log('homepage not found');
    res.status(500).send('server error');
  }
};

//load verify otp page
const loadVerifyOtpPage = async (req, res) => {
  try {
    return res.render('verify-otp');
  } catch (error) {
    console.log('homepage not found');
    res.status(500).send('server error');
  }
};

// load home page
const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user;
    const categories = await Category.find({ isListed: true });

    let productData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
      totalQuantity: { $gt: 0 },
    });

    productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

    productData = productData.slice(0, 4);

    if (user) {
      const userData = await User.findOne({ _id: user._id });
      return res.render('homepage', {
        user: userData,
        products: productData,
        isLoggedIn: true,
      });
    } else {
      return res.render('homepage', {
        products: productData,
        isLoggedIn: false,
      });
    }
  } catch (error) {
    console.error('Error loading homepage:', error);
    res.status(500).send('Server error');
  }
};

//load login page
const loadLoginPage = async (req, res) => {
  try {
    return res.render('login');
  } catch (error) {
    console.log('login page not found');
    res.status(500).send('server error');
  }
};

// function to generate otp
function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
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
      subject: 'Verify Your Account - OTP Inside',
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
    console.error('Error sending email', error);
    return false;
  }
}

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, cpassword } = req.body;
    if (password !== cpassword) {
      return res.render('signup', { message: 'passwords donot match' });
    }
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render('signup', {
        message: 'User with this email already exists',
      });
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json('Email-error');
    }

    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password };

    res.render('verify-otp', { message: '' });
    console.log('OTP sent', otp);
  } catch (error) {
    console.error('signup error', error);
    res.redirect('/pageNotFound');
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
      res.json({ success: true, redirectUrl: '/' });
    } else {
      res
        .status(400)
        .json({ success: false, message: 'Invalid OTP,Please try again' });
    }
  } catch (error) {
    console.error('Error verifing OTP', error);
    res.status(500).json({ success: false, message: 'An error occured' });
  }
};

const resendOtp = async (req, res) => {
  try {
    const newOtp = generateOtp();
    req.session.userOtp = newOtp;

    const emailSent = await sendVerificationEmail(
      req.session.userData.email,
      newOtp
    );

    if (emailSent) {
      console.log('Resent otp:', newOtp);
      res.json({ success: true, message: 'OTP resent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ success: false, message: 'Error resending OTP' });
  }
};

const login = async (req, res) => {
  try {
    console.log(req.body);
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: false, email: email });

    if (!findUser) {
      console.log('User not found');
      return res.render('login', { message: 'User not found' });
    }
    if (findUser.isBlocked) {
      return res.render('login', { message: 'User is blocked by admin' });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render('login', { message: 'Incorrect password' });
    }

    req.session.userId = findUser._id;
    req.session.user = findUser;
    res.redirect('/');
  } catch (error) {
    console.error('login error');
    res.render('login', { message: 'Please try again later' });
  }
};

const logOutUser = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Unable to log out');
    }
    res.redirect('/logIn'); // Redirect to home page after logging out
  });
};

const loadProfile = async (req, res) => {
  try {
    const userId = req.session.userId; // Get user ID from the session
    const user = await User.findById(userId); // Fetch user from the database
    if (user) {
      // Fetch addresses for the user
      const addresses = await Address.find({ UserId: userId }); // Multiple addresses for the user
      console.log(addresses); // Log the addresses array before rendering the page

      // Render the profile page and pass user details and address data
      res.render('userProfile', {
        user,
        addresses: addresses.length > 0 ? addresses : [], // Pass addresses to the template
      });
    } else {
      res.redirect('/login'); // Redirect if the user doesn't exist
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    res.redirect('/pageNotFound');
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.userId;

    const { addressType, name, city, landMark, state, pincode, isDefault } =
      req.body;

    if (isDefault) {
      const existingDefaultAddress = await Address.findOne({
        UserId: userId,
        'address.isDefault': true,
      });

      if (existingDefaultAddress) {
        await Address.updateOne(
          { UserId: userId, 'address.isDefault': true },
          { $set: { 'address.$.isDefault': false } }
        );
      }
    }

    const address = {
      addressType,
      name,
      city,
      landMark,
      state,
      pincode,
      isDefault,
    };

    if (!userId || !address) {
      return res
        .status(400)
        .json({ message: 'User ID and address are required' });
    }

    const newAddress = new Address({
      UserId: userId,
      address: address,
    });

    await newAddress.save();
    res.status(200).json({ message: 'Address added successfully' });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Something went wrong', error: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { name, phone } = req.body;

    // Validate input
    if (!name || name.length < 2) {
      return res.status(400).json({ message: 'Invalid name' });
    }

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, phone },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const handleGoogleLogin = async (req, res) => {
  try {
    // The user data will be available in req.user after successful Google authentication
    const user = req.user;

    if (user.isBlocked) {
      req.logout(); // Logout if user is blocked
      return res.render('login', { message: 'User is blocked by admin' });
    }

    // Set session variables
    req.session.userId = user._id;
    req.session.user = user;

    // Redirect to home page
    res.redirect('/');
  } catch (error) {
    console.error('Google login error:', error);
    res.render('login', { message: 'Error during Google login' });
  }
};

const updatePhone = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.session.user;

    // Validate phone number
    if (!/^\d{10}$/.test(phoneNumber)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid phone number' });
    }

    // Update user's phone number
    await User.findByIdAndUpdate(userId, { phone: phoneNumber });

    res.json({ success: true, message: 'Phone number updated successfully' });
  } catch (error) {
    console.error('Error updating phone number:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to update phone number' });
  }
};

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
  logOutUser,
  loadProfile,
  addAddress,
  updateProfile,
  changePassword,
  handleGoogleLogin,
  updatePhone,
};
