const Offer = require('../../models/offerSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

const getOffers = async (req, res) => {
  try {
    // Fetch all offers and populate the applicableFor field
    const offers = await Offer.find()
      .populate({
        path: 'applicableFor',
        select: 'productName name', // 'productName' for Product, 'name' for Category
      })
      .sort({ createdAt: -1 }); // Sort by newest first

    // Fetch products and categories for the modal dropdowns
    const products = await Product.find({ isBlocked: false }).select(
      'productName _id gender'
    );
    const categories = await Category.find({ isListed: true }).select(
      'name _id gender'
    );

    console.log('Fetched offers:', offers); // For debugging

    res.render('offer', {
      offers: offers,
      products: products,
      categories: categories,
    });
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).send('Server Error');
  }
};

const createOffer = async (req, res) => {
  try {
    const { name, offerType, gender, applicableFor, percentage, endDate } =
      req.body;

    // Check if offer name already exists
    const existingOffer = await Offer.findOne({ name: name });
    if (existingOffer) {
      return res.status(400).json({
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

    res.status(201).json({
      success: true,
      message: 'Offer created successfully',
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating offer',
    });
  }
};

const toggleOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.body;

    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    // Toggle the status
    offer.isActive = !offer.isActive;
    await offer.save();

    res.status(200).json({
      success: true,
      message: `Offer ${offer.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: offer.isActive,
    });
  } catch (error) {
    console.error('Error toggling offer status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating offer status',
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
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    res.status(200).json({
      success: true,
      offer,
    });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching offer details',
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
      return res.status(400).json({
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
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Offer updated successfully',
    });
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating offer',
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
