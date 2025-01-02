const Coupon = require('../../models/couponSchema');

const loadCoupons = async (req, res) => {
  try {
    // Fetch all coupons with complete details
    const coupons = await Coupon.find()
      .sort({ createdOn: -1 })
      .select({
        name: 1,
        minPurchase: 1,
        couponType: 1,
        discountPrice: 1,
        maximumPrice: 1,
        usagePerUser: 1,
        expireOn: 1,
        isActive: 1,
        createdOn: 1,
        userId: 1,
      })
      .populate('userId', 'name email'); // If you need user details who used the coupon

    console.log('Fetched coupons:', coupons); // For debugging

    res.render('coupon', {
      coupons,
      title: 'Coupon Management', // Optional: for page title
    });
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
      usagePerUser,
    } = req.body;

    // Validate the request body
    if (
      !name ||
      !minPurchase ||
      !couponType ||
      !discountPrice ||
      !maximumPrice ||
      !expireOn ||
      !usagePerUser
    ) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

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
      usagePerUser,
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

const getCouponById = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    res.status(200).json({
      success: true,
      coupon,
    });
  } catch (error) {
    console.error('Error in getCouponById:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const {
      name,
      minPurchase,
      couponType,
      discountPrice,
      maximumPrice,
      expireOn,
      usagePerUser,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !minPurchase ||
      !couponType ||
      !discountPrice ||
      !maximumPrice ||
      !expireOn ||
      !usagePerUser
    ) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Check if another coupon exists with the same name (excluding current coupon)
    const existingCoupon = await Coupon.findOne({
      name: name,
      _id: { $ne: couponId },
    });

    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon with this name already exists',
      });
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        name,
        minPurchase,
        couponType,
        discountPrice,
        maximumPrice,
        expireOn: new Date(expireOn),
        usagePerUser,
      },
      { new: true, runValidators: true }
    );

    if (!updatedCoupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error('Error in updateCoupon:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId, currentStatus } = req.body;

    const coupon = await Coupon.findByIdAndUpdate(
      couponId,
      { isActive: !currentStatus },
      { new: true }
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: coupon.isActive,
    });
  } catch (error) {
    console.error('Error in toggleCouponStatus:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

module.exports = {
  loadCoupons,
  addCoupon,
  getCouponById,
  updateCoupon,
  toggleCouponStatus,
};
