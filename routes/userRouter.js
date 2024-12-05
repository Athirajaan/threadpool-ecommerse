const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const productController = require("../controllers/user/productController");
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
router.get('/logout', userController.logoutUser)


//shopping page
router.get('/womenShop',userAuth,userController.loadWomenShopping);
router.get('/menShop',userAuth,userController.loadMenShopping);

//product management 
router.get('/productDetails',userAuth,productController.productDetails);
router.post('/getPrice',userAuth,productController.getPrice);

router.get('/profile',userAuth,userController.loadProfile);


//cart management
router.get('/cart',userAuth,productController.getCart);



module.exports = router;
