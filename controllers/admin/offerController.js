const Offer = require('../../models/offerSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const { StatusCode, Messages } = require('../../utils/statusCodes');

const getOffers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const totalOffers = await Offer.countDocuments();
    const totalPages = Math.ceil(totalOffers / limit);

    const offers = await Offer.find()
      .populate({
        path: 'applicableFor',
        select: 'productName name',
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const products = await Product.find({ isBlocked: false }).select(
      'productName _id gender'
    );
    const categories = await Category.find({ isListed: true }).select(
      'name _id gender'
    );

    res.render('offer', {
      offers,
      products,
      categories,
      pagination: {
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(StatusCode.INTERNAL_SERVER).send(Messages.INTERNAL_ERROR);
  }
};

const createOffer = async (req, res) => {
  try {
    const { name, offerType, gender, applicableFor, percentage, endDate } =
      req.body;

    // Check if offer name already exists
    const existingOffer = await Offer.findOne({ name: name });
    if (existingOffer) {
      return res.status(StatusCode.CONFLICT).json({
        success: false,
        message: 'An offer with this name already exists',
      });
    }

    // Create new offer
    const newOffer = new Offer({
      name,
      offerType,
      gender,
      applicableFor,
      percentage: Number(percentage),
      endDate: new Date(endDate),
    });

    await newOffer.save();

    res.status(StatusCode.CREATED).json({
      success: true,
      message: Messages.CREATED,
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
    });
  }
};

const toggleOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.body;

    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(StatusCode.NOT_FOUND).json({
        success: false,
        message: 'Offer not found',
      });
    }

  
    offer.isActive = !offer.isActive;
    await offer.save();

    res.status(StatusCode.OK).json({
      success: true,
      message: `Offer ${offer.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: offer.isActive,
    });
  } catch (error) {
    console.error('Error toggling offer status:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
    });
  }
};

const getOfferById = async (req, res) => {
  try {
    const { offerId } = req.params;
    const offer = await Offer.findById(offerId).populate(
      'applicableFor',
      'productName name gender'
    );

    if (!offer) {
      return res.status(StatusCode.NOT_FOUND).json({
        success: false,
        message: 'Offer not found',
      });
    }

    res.status(StatusCode.OK).json({
      success: true,
      offer,
    });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
    });
  }
};

const updateOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { name, offerType, gender, applicableFor, percentage, endDate } =
      req.body;

    // Check if new name already exists for other offers
    const existingOffer = await Offer.findOne({
      name: name,
      _id: { $ne: offerId },
    });

    if (existingOffer) {
      return res.status(StatusCode.CONFLICT).json({
        success: false,
        message: 'An offer with this name already exists',
      });
    }

    const updatedOffer = await Offer.findByIdAndUpdate(
      offerId,
      {
        name,
        offerType,
        gender,
        applicableFor,
        percentage: Number(percentage),
        endDate: new Date(endDate),
      },
      { new: true }
    );

    if (!updatedOffer) {
      return res.status(StatusCode.NOT_FOUND).json({
        success: false,
        message: 'Offer not found',
      });
    }

    res.status(StatusCode.OK).json({
      success: true,
      message: Messages.UPDATED,
    });
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
    });
  }
};

module.exports = {
  getOffers,
  createOffer,
  toggleOfferStatus,
  getOfferById,
  updateOffer,
};
