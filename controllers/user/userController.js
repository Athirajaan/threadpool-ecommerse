const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Calculate = require('../../models/categorySchema');
const Address = require('../../models/adressScheme');
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const Wishlist = require('../../models/wishlistSchema');
const { StatusCode, Messages } = require('../../utils/statusCodes');

//pageNotFound
const pageNotFound = async (req, res) => {
  try {
    res.status(StatusCode.NOT_FOUND).render('pageNotFound');
  } catch (error) {
    res.status(StatusCode.INTERNAL_SERVER).send(Messages.INTERNAL_ERROR);
  }
};

//loadSignUp
const loadSignup = async (req, res) => {
  try {
    return res.render('signup');
  } catch (error) {
    console.log('homepage not found');
    res.status(StatusCode.INTERNAL_SERVER).send(Messages.INTERNAL_ERROR);
  }
};

//load verify otp page
const loadVerifyOtpPage = async (req, res) => {
  try {
    return res.render('verify-otp');
  } catch (error) {
    console.log('homepage not found');
    res.status(StatusCode.INTERNAL_SERVER).send(Messages.INTERNAL_ERROR);
  }
};

// Load Forgot Password Page
const loadForgotPassword = async (req, res) => {
  try {
    res.render('enterEmail');
  } catch (error) {
    console.error('Error loading forgot password page:', error);
    res.status(StatusCode.INTERNAL_SERVER).redirect('/pageNotFound');
  }
};

// load home page
const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user;
    const categories = await Category.find({ isListed: true });

    let newArrivals = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
      totalQuantity: { $gt: 0 },
    })
      .sort({ createdOn: -1 })
      .limit(4);

    let featuredProducts = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
      totalQuantity: { $gt: 0 },
    })
      .sort({ salesCount: -1 })
      .limit(15);

    if (user) {
      const userData = await User.findOne({ _id: user._id });
      const wishlist = await Wishlist.findOne({ userId: user._id });
      const wishlistProducts = wishlist
        ? wishlist.products.map((item) => item.productId.toString())
        : [];

  
      newArrivals = newArrivals.map((product) => ({
        ...product.toObject(),
        inWishlist: wishlistProducts.includes(product._id.toString()),
      }));

      
      featuredProducts = featuredProducts.map((product) => ({
        ...product.toObject(),
        inWishlist: wishlistProducts.includes(product._id.toString()),
      }));

      return res.render('homepage', {
        user: userData,
        newArrivals,
        featuredProducts,
        isLoggedIn: true,
      });
    } else {
      newArrivals = newArrivals.map((product) => product.toObject());
      featuredProducts = featuredProducts.map((product) => product.toObject());

      return res.render('homepage', {
        newArrivals,
        featuredProducts,
        isLoggedIn: false,
      });
    }
  } catch (error) {
    console.error('Error loading homepage:', error);
    res.status(StatusCode.INTERNAL_SERVER).send(Messages.INTERNAL_ERROR);
  }
};

//load login page
const loadLoginPage = async (req, res) => {
  try {
    const error = req.query.error || '';
    const blocked = req.query.blocked || false;

    res.render('login', {
      title: 'Login',
      message: error,
      error: error,
      blocked: blocked,
      user: null,
    });
  } catch (error) {
    console.error('Error loading login page:', error);
    res.status(StatusCode.INTERNAL_SERVER).render('login', {
      title: 'Login',
      message: Messages.INTERNAL_ERROR,
      error: Messages.INTERNAL_ERROR,
      blocked: false,
      user: null,
    });
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
      return res.status(StatusCode.BAD_REQUEST).render('signup', {
        message: 'passwords do not match',
      });
    }
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.status(StatusCode.CONFLICT).render('signup', {
        message: Messages.DUPLICATE_ENTRY,
      });
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json('Email-error');
    }

    
    req.session.userOtp = otp;
    req.session.otpTimestamp = Date.now();
    req.session.userData = { name, phone, email, password };


    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res
          .status(StatusCode.INTERNAL_SERVER)
          .send(Messages.INTERNAL_ERROR);
      }
      res.render('verify-otp', { message: '' });
      console.log('OTP sent', otp);
    });
  } catch (error) {
    console.error('signup error', error);
    res.status(StatusCode.INTERNAL_SERVER).redirect('/pageNotFound');
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

    // Check if OTP has expired (60 seconds)
    const currentTime = Date.now();
    const otpTimestamp = req.session.otpTimestamp;
    const timeDifference = currentTime - otpTimestamp;

    if (timeDifference > 60000) {
      // 60000 milliseconds = 60 seconds
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'OTP has expired. Please request a new one',
      });
    }

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
      res.status(StatusCode.OK).json({
        success: true,
        redirectUrl: '/login',
      });
    } else {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'Invalid OTP, Please try again',
      });
    }
  } catch (error) {
    console.error('Error verifying OTP', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
    });
  }
};

const resendOtp = async (req, res) => {
  try {
    // Check if user data exists in session
    if (!req.session.userData || !req.session.userData.email) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'Session expired. Please try signing up again.',
      });
    }

    const newOtp = generateOtp();
    req.session.userOtp = newOtp;
    req.session.otpTimestamp = Date.now();

    const emailSent = await sendVerificationEmail(
      req.session.userData.email,
      newOtp
    );

    if (emailSent) {
      console.log('Resent otp:', newOtp);
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(StatusCode.INTERNAL_SERVER).json({
            success: false,
            message: Messages.INTERNAL_ERROR,
          });
        }
        res.json({ success: true, message: 'OTP resent successfully' });
      });
    } else {
      res
        .status(StatusCode.INTERNAL_SERVER)
        .json({ success: false, message: 'Failed to send OTP' });
    }
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: 'Error resending OTP. Please try again.',
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: false, email: email });

    if (!findUser) {
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
      return res.status(StatusCode.INTERNAL_SERVER).send('Unable to log out');
    }
    res.redirect('/logIn');
  });
};

const loadProfile = async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId);
    if (user) {
      const addresses = await Address.find({ UserId: userId });

      res.render('userProfile', {
        user,
        addresses: addresses.length > 0 ? addresses : [],
      });
    } else {
      res.redirect('/login');
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
        .status(StatusCode.BAD_REQUEST)
        .json({ message: 'User ID and address are required' });
    }

    const newAddress = new Address({
      UserId: userId,
      address: address,
    });

    await newAddress.save();
    res.status(StatusCode.OK).json({ message: 'Address added successfully' });
  } catch (err) {
    res
      .status(StatusCode.INTERNAL_SERVER)
      .json({ message: 'Something went wrong', error: err.message });
  }
};

const editAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const {
      addressId,
      addressType,
      name,
      city,
      state,
      landMark,
      pincode,
      isDefault,
    } = req.body;

    if (isDefault) {
      await Address.updateMany(
        { UserId: userId, 'address.isDefault': true },
        { $set: { 'address.$.isDefault': false } }
      );
    }

    // Update the address in Address model
    const result = await Address.updateOne(
      {
        UserId: userId,
        'address._id': addressId,
      },
      {
        $set: {
          'address.$.addressType': addressType,
          'address.$.name': name,
          'address.$.city': city,
          'address.$.state': state,
          'address.$.landMark': landMark,
          'address.$.pincode': pincode,
          'address.$.isDefault': isDefault,
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(StatusCode.NOT_FOUND).json({
        success: false,
        message: 'Address not found',
      });
    }

    res.json({
      success: true,
      message: 'Address updated successfully',
    });
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: 'Failed to update address',
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { name, phone } = req.body;

    // Validate input
    if (!name || name.length < 2) {
      return res.status(StatusCode.BAD_REQUEST).json({
        message: 'Invalid name',
      });
    }

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(StatusCode.BAD_REQUEST).json({
        message: 'Invalid phone number',
      });
    }

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, phone },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(StatusCode.NOT_FOUND).json({
        message: Messages.NOT_FOUND,
      });
    }

    res.status(StatusCode.OK).json({
      message: Messages.UPDATED,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      message: Messages.INTERNAL_ERROR,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(StatusCode.NOT_FOUND)
        .json({ message: 'User not found' });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res
      .status(StatusCode.INTERNAL_SERVER)
      .json({ message: 'Internal server error' });
  }
};

const handleGoogleLogin = async (req, res, next) => {
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

    if (!/^\d{10}$/.test(phoneNumber)) {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: 'Invalid phone number' });
    }

    await User.findByIdAndUpdate(userId, { phone: phoneNumber });

    res.json({ success: true, message: 'Phone number updated successfully' });
  } catch (error) {
    console.error('Error updating phone number:', error);
    res
      .status(StatusCode.INTERNAL_SERVER)
      .json({ success: false, message: 'Failed to update phone number' });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.body;
    const userId = req.session.userId;

    // Find the address document that contains the address to be deleted
    const addressDoc = await Address.findOne({
      UserId: userId,
      'address._id': addressId,
    });

    if (!addressDoc) {
      return res
        .status(StatusCode.NOT_FOUND)
        .json({ success: false, message: 'Address not found' });
    }

    // Find the specific address in the array
    const addressIndex = addressDoc.address.findIndex(
      (addr) => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res
        .status(StatusCode.NOT_FOUND)
        .json({ success: false, message: 'Address not found' });
    }

    // Update the isDelete flag for the specific address
    addressDoc.address[addressIndex].isDelete = true;
    await addressDoc.save();

    res.json({ success: true, message: 'Address removed successfully' });
  } catch (error) {
    console.error('Error deleting address:', error);
    res
      .status(StatusCode.INTERNAL_SERVER)
      .json({ success: false, message: 'Internal server error' });
  }
};

const verifyOtpForgotPassword = async (req, res) => {
  try {
    const submittedOtp = req.body.otp;
    console.log('Submitted OTP:', submittedOtp);
    console.log('Session OTP:', req.session.userOtp);

    if (!submittedOtp) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'Please enter OTP',
      });
    }

    if (!req.session.userOtp || !req.session.userEmail) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'Session expired. Please try again.',
      });
    }

    // Check expiration
    const currentTime = Date.now();
    const timeDifference = currentTime - req.session.otpTimestamp;
    if (timeDifference > 60000) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    // Convert both to strings and compare
    const submittedOtpString = String(submittedOtp);
    const storedOtpString = String(req.session.userOtp);

    if (submittedOtpString === storedOtpString) {
      return res.json({
        success: true,
        message: 'OTP verified successfully',
        redirectUrl: '/reset-password',
      });
    }

    return res.status(StatusCode.BAD_REQUEST).json({
      success: false,
      message: 'Invalid OTP. Please try again.',
    });
  } catch (error) {
    console.error('Error in verifyOtpForgotPassword:', error);
    return res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const handleForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Email received:', email);

    const user = await User.findOne({ email });
    if (!user) {
      return res.render('enterEmail', {
        message: 'User with this email cannot be found.',
      });
    }

    const otp = generateOtp();
    console.log('Generated OTP:', otp);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render('enterEmail', {
        message: 'Failed to send OTP. Please try again.',
      });
    }

    // Store in session
    req.session.userOtp = otp;
    req.session.userEmail = email;
    req.session.otpTimestamp = Date.now();

    // Save session explicitly
    await new Promise((resolve) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
        }
        console.log('Session saved:', {
          otp: req.session.userOtp,
          email: req.session.userEmail,
        });
        resolve();
      });
    });

    res.render('otpVerification', { message: '' });
  } catch (error) {
    console.error('Error in handleForgotPassword:', error);
    res.render('enterEmail', {
      message: 'Something went wrong. Please try again.',
    });
  }
};

const resendOtpForgotPassword = async (req, res) => {
  try {
    // Check if email exists in session
    if (!req.session.userEmail) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'Session expired. Please restart the process.',
      });
    }

    const newOtp = generateOtp();
    const emailSent = await sendVerificationEmail(
      req.session.userEmail,
      newOtp
    );

    if (!emailSent) {
      return res.status(StatusCode.INTERNAL_SERVER).json({
        success: false,
        message: 'Failed to send OTP. Please try again.',
      });
    }
    req.session.userOtp = newOtp;
    req.session.otpTimestamp = Date.now();

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(StatusCode.INTERNAL_SERVER).json({
          success: false,
          message: Messages.INTERNAL_ERROR,
        });
      }
      console.log('Resent forgot password OTP:', newOtp);
      return res.json({
        success: true,
        message: 'OTP resent successfully',
      });
    });
  } catch (error) {
    console.error('Error in resendOtpForgotPassword:', error);
    return res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const loadResetPassword = async (req, res) => {
  try {
    // Check if user has verified OTP
    if (!req.session.userEmail) {
      return res.redirect('/forgot-password');
    }
    res.render('newPassword', { message: '' });
  } catch (error) {
    console.error('Error loading reset password page:', error);
    res.redirect('/pageNotFound');
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    // Check if user email exists in session
    if (!req.session.userEmail) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'Session expired. Please try again.',
      });
    }

    // Validate passwords
    if (password !== confirmPassword) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user's password in database
    await User.findOneAndUpdate(
      { email: req.session.userEmail },
      { password: hashedPassword }
    );

    // Clear session
    req.session.userEmail = null;
    req.session.userOtp = null;
    req.session.otpTimestamp = null;

    return res.json({
      success: true,
      message: 'Password reset successful',
      redirectUrl: '/login',
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const handleGoogleCallback = async (req, res, next) => {
  try {
    // Check if user is blocked before proceeding with login
    const user = req.user;
    if (user && user.isBlocked) {
      req.logout((err) => {
        if (err) {
          console.error('Logout error:', err);
        }
        // Redirect to login with query parameters instead of direct render
        return res.redirect(
          '/login?error=' +
            encodeURIComponent('Your account has been blocked by admin') +
            '&blocked=true'
        );
      });
    } else {
      // If user is not blocked, proceed with normal login handling
      return handleGoogleLogin(req, res, next);
    }
  } catch (error) {
    console.error('Google auth callback error:', error);
    return res.redirect(
      '/login?error=' + encodeURIComponent('An error occurred during login')
    );
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
  loadForgotPassword,
  login,
  logOutUser,
  loadProfile,
  addAddress,
  updateProfile,
  changePassword,
  handleGoogleLogin,
  updatePhone,
  deleteAddress,
  editAddress,
  handleForgotPassword,
  verifyOtpForgotPassword,
  resendOtpForgotPassword,
  loadResetPassword,
  resetPassword,
  handleGoogleCallback,
};
