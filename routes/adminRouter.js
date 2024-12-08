const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const upload= require('../config/cloudinary');
const { userAuth, adminAuth } = require("../middlewares/auth");
const { route } = require("./userRouter");

router.get("/pageerror", adminController.pageerror);
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth, adminController.loadDashboard);
router.get("/logout", adminController.logout);

router.get("/customers", adminAuth, customerController.coustomerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerunBlocked);

router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
// router.post("/editCategory", adminAuth, categoryController.edi);
router.get('/listCategory',adminAuth,categoryController.getListCategory);
router.get('/UnlistCategory',adminAuth,categoryController.getUnListCategory);
router.get('/editCategory', adminAuth, categoryController.getEditCategory);

router.get("/Products", adminAuth, productController.getAllProducts);
router.get("/products/:productId/variants",adminAuth,productController.getVarients);
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts",adminAuth,upload.array("images",5),productController.addProducts);
router.get("/editProduct/:id",adminAuth,productController.getProductForEdit);
router.patch("/blockProduct",adminAuth,productController.blockProduct);
router.patch("/unblockProduct",adminAuth,productController.unblockProduct);


module.exports = router;
