const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController');
const orderController = require('../controllers/admin/orderController');
const couponController = require('../controllers/admin/couponController');
const upload = require('../config/cloudinary');
const { userAuth, adminAuth } = require('../middlewares/auth');
const { route } = require('./userRouter');

router.get('/pageerror', adminController.pageerror);
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/', adminAuth, adminController.loadDashboard);
router.get('/logout', adminController.logout);

router.get('/customers', adminAuth, customerController.coustomerInfo);
router.get('/blockCustomer', adminAuth, customerController.customerBlocked);
router.get('/unblockCustomer', adminAuth, customerController.customerunBlocked);

router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.get('/listCategory', adminAuth, categoryController.getListCategory);
router.get('/UnlistCategory', adminAuth, categoryController.getUnListCategory);
router.post('/editCategory', adminAuth, categoryController.EditCategory);

router.get('/Products', adminAuth, productController.getAllProducts);
router.get(
  '/products/:productId/variants',
  adminAuth,
  productController.getVarients
);
router.get('/addProducts', adminAuth, productController.getProductAddPage);
router.post(
  '/addProducts',
  adminAuth,
  upload.array('images', 5),
  productController.addProducts
);
router.get(
  '/editProduct/:id',
  adminAuth,
  upload.array('images', 5),
  productController.getProductForEdit
);
router.post(
  '/editProduct/:id',
  adminAuth,
  upload.array('images', 5),
  productController.editProduct
);
router.patch('/blockProduct', adminAuth, productController.blockProduct);
router.patch('/unblockProduct', adminAuth, productController.unblockProduct);

router.get('/order', adminAuth, orderController.orderInfo);
router.post('/update-status', adminAuth, orderController.updateStatus);

// router.get('/coupon',adminAuth,couponController.loadCoupon);

// Coupon routes
router.get('/coupons', adminAuth, couponController.loadCoupons);
router.post('/coupon/add', adminAuth, couponController.addCoupon);
// router.post(
//   '/coupons/toggle-status',
//   adminAuth,
//   couponController.toggleCouponStatus
// );
// router.post('/coupons/edit', adminAuth,couponController.editCoupon);

module.exports = router;
