const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const productController = require("../controllers/user/productController");
const shopController = require("../controllers/user/shopController");
const cartController = require("../controllers/user/cartController");
const passport = require("passport");
const { userAuth } = require("../middlewares/auth");

router.get("/pageNotFound", userController.pageNotFound);
router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.get("/verify-otp", userController.loadVerifyOtpPage);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get( "/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }),);
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/signup" }),(req, res) => {res.redirect("/"); },);

router.get("/login",  userController.loadLoginPage);
router.post("/login", userController.login);
router.get('/logout', userController.logOutUser)


//shopping page
router.get('/womenShop',userAuth,shopController.loadWomenShopping);
router.get('/menShop',userAuth,shopController.loadMenShopping);

//product management 
router.get('/productDetails',userAuth,productController.productDetails);
router.post('/getPrice',userAuth,productController.getPrice);

//user profile and adrress mananegment
router.get('/profile',userAuth,userController.loadProfile);
router.post("/add-address",userAuth,userController.addAddress);



//cart management
router.get('/cart',userAuth,cartController.getCart);
router.post('/addToCart',userAuth,cartController.addToCart);
router.post('/update-cart-quantity',userAuth,cartController.updateCartquantity);
router.get('/get-stock/:itemId/:size',userAuth, cartController.getStock)

router.get('/checkout',userAuth,cartController.getCheckOut);
router.post('/create-order',userAuth,cartController.createOrder);




module.exports = router;
