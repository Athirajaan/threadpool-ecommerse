const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const productController = require('../controllers/user/productController');
const shopController = require('../controllers/user/shopController');
const cartController = require('../controllers/user/cartController');
const orderController = require('../controllers/user/orderController');
const wishlistController = require('../controllers/user/wishlistController');
const passport = require('passport');
const { userAuth } = require('../middlewares/auth');
const razorpay = require('../config/razorpay');
const crypto = require('crypto');

router.get('/pageNotFound', userController.pageNotFound);
router.get('/', userController.loadHomepage);
router.get('/signup', userController.loadSignup);
router.post('/signup', userController.signup);
router.get('/verify-otp', userController.loadVerifyOtpPage);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);
router.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);
router.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
    failureFlash: true,
  }),
  userController.handleGoogleLogin
);

router.get('/login', userController.loadLoginPage);
router.post('/login', userController.login);
router.get('/logout', userController.logOutUser);

//shopping page
router.get('/womenShop', userAuth, shopController.loadWomenShopping);
router.get('/menShop', userAuth, shopController.loadMenShopping);
router.get('/search', userAuth, shopController.searchProducts);

//product management
router.get('/productDetails', userAuth, productController.productDetails);
router.post('/getPrice', userAuth, productController.getPrice);

//user profile and adrress mananegment
router.get('/profile', userAuth, userController.loadProfile);
router.post('/update-profile', userAuth, userController.updateProfile);
router.post('/change-password', userAuth, userController.changePassword);
router.post('/add-address', userAuth, userController.addAddress);

//cart management
router.get('/cart', userAuth, cartController.getCart);
router.post('/addToCart', userAuth, cartController.addToCart);
router.post(
  '/update-cart-quantity',
  userAuth,
  cartController.updateCartquantity
);
router.get('/get-stock/:itemId/:size', userAuth, cartController.getStock);
router.delete('/cart/remove', userAuth, cartController.removeOne);

router.get('/checkout', userAuth, cartController.getCheckOut);
router.post('/create-order', userAuth, cartController.createOrder);
router.post('/clear-cart', userAuth, cartController.clearCart);

router.get('/order', userAuth, orderController.getOrder);
router.get('/product-details/:id',userAuth,orderController.getOrderedProductDtl);
router.post('/cancel-order', userAuth, orderController.CancelOrder);
router.get('/track-order/:orderId/:productId',userAuth,orderController.trackOrder);

router.get('/wishlist', userAuth, wishlistController.loadWishlist);
router.post('/wishlist/toggle', userAuth, wishlistController.toggleWishlist);
router.get('/check-wishlist/:productId',wishlistController.checkWishlistStatus);

router.post('/filter-products', userAuth, shopController.getFilteredProducts);

// Create Razorpay order
router.post('/create-razorpay-order',userAuth,cartController.createRazorpayOrder);

// Verify Razorpay payment
router.post('/verify-payment', userAuth, cartController.verifyRazorpayPayment);


module.exports = router;
