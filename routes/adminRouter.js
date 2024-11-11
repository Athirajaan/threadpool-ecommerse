const express=require('express')
const router=express.Router();
const adminController=require('../controllers/admin/adminController');
const {userAuth,adminAuth}=require('../middlewares/auth');
const { route } = require('./userRouter');

router.get('/pageerror',adminController.pageerror);
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login);
router.get('/', adminAuth,adminController.loadDashboard);
router.get('/logout',adminController.logout);

router.get('/users',adminAuth,customerController.coustomerInfo);

module.exports=router;