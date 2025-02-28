const Coupon = require('../../models/couponSchema');
const { StatusCode, Messages } = require('../../utils/statusCodes');

const loadCoupons = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5; 
    const skip = (page - 1) * limit;

    const totalCoupons = await Coupon.countDocuments();
    const totalPages = Math.ceil(totalCoupons / limit);

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
      .populate('userId', 'name email')
      .skip(skip)
      .limit(limit);

    res.render('coupon', {
      coupons,
      title: 'Coupon Management',
      pagination: {
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error in loadCoupons:', error);
    res.status(StatusCode.INTERNAL_SERVER).send(Messages.INTERNAL_ERROR);
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

    if (
      !name ||
      !minPurchase ||
      !couponType ||
      !discountPrice ||
      !maximumPrice ||
      !expireOn ||
      !usagePerUser
    ) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Check if coupon with same name exists
    const existingCoupon = await Coupon.findOne({ name });
    if (existingCoupon) {
      return res.status(StatusCode.CONFLICT).json({
        success: false,
        message: 'Coupon with this name already exists',
      });
    }

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

    res.status(StatusCode.CREATED).json({
      success: true,
      message: Messages.CREATED,
    });
  } catch (error) {
    console.error('Error in addCoupon:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
    });
  }
};

const getCouponById = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(StatusCode.NOT_FOUND).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    res.status(StatusCode.OK).json({
      success: true,
      coupon,
    });
  } catch (error) {
    console.error('Error in getCouponById:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
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

    
    if (
      !name ||
      !minPurchase ||
      !couponType ||
      !discountPrice ||
      !maximumPrice ||
      !expireOn ||
      !usagePerUser
    ) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Check if another coupon exists with the same name 
    const existingCoupon = await Coupon.findOne({
      name: name,
      _id: { $ne: couponId },
    });

    if (existingCoupon) {
      return res.status(StatusCode.CONFLICT).json({
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
      return res.status(StatusCode.NOT_FOUND).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    res.status(StatusCode.OK).json({
      success: true,
      message: Messages.UPDATED,
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error('Error in updateCoupon:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
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
      return res.status(StatusCode.NOT_FOUND).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    res.status(StatusCode.OK).json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: coupon.isActive,
    });
  } catch (error) {
    console.error('Error in toggleCouponStatus:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
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
