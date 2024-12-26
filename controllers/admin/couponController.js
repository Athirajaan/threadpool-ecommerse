const Coupon = require('../../models/couponSchema');

const loadCoupons = async (req, res) => {
  try {
    res.render('coupon');
  } catch (error) {
    console.error('Error in loadCoupons:', error);
    res.status(500).send('Internal Server Error');
  }
};

const addCoupon = async (req, res) => {
  try {
    const {
      name,
      minPurchase,
      couponType,
      discountPrice,
      maximumPrice,
      expireOn,
    } = req.body;

    // Check if coupon with same name exists
    const existingCoupon = await Coupon.findOne({ name });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon with this name already exists',
      });
    }

    // Create new coupon
    const newCoupon = new Coupon({
      name,
      minPurchase,
      couponType,
      discountPrice,
      maximumPrice,
      expireOn,
      isActive: true,
    });

    await newCoupon.save();

    res.status(200).json({
      success: true,
      message: 'Coupon added successfully',
    });
  } catch (error) {
    console.error('Error in addCoupon:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

module.exports = {
  loadCoupons,
  addCoupon,
};
