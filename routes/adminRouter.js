const express=require('express')
const router=express.Router();
const adminController=require('../controllers/admin/adminController');
const customerController=require('../controllers/admin/customerController');
const categoryController=require('../controllers/admin/categoryController');
const productController=require('../controllers/admin/productController')
const {userAuth,adminAuth}=require('../middlewares/auth');
const { route } = require('./userRouter');

router.get('/pageerror',adminController.pageerror);
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login);
router.get('/', adminAuth,adminController.loadDashboard);
router.get('/logout',adminController.logout);

router.get('/customers',adminAuth,customerController.coustomerInfo);
router.get('/blockCustomer',adminAuth,customerController.customerBlocked);
router.get('/unblockCustomer',adminAuth,customerController.customerunBlocked);

router.get('/category',adminAuth,categoryController.categoryInfo);
router.post('/addCategory',adminAuth,categoryController.addCategory);
// router.post('/updateCategory', adminAuth, categoryController.updateCategory);



router.get('/Products',adminAuth,productController.getAllProducts);


router.get('/addProducts',adminAuth,productController.getProductAddPage)
module.exports=router;