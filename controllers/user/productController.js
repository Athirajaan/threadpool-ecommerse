const Product = require('../../models/productSchema');
const { calculatePrice } = require('../../utils/priceCalculator');
const { StatusCode, Messages } = require('../../utils/statusCodes');
const Wishlist = require('../../models/wishlistSchema');

const productDetails = async (req, res) => {
  try {
    const productId = req.query.id;
    const userId = req.session.user;

    const product = await Product.findById(productId).populate('category');

    // Check wishlist status
    let inWishlist = false;
    if (userId) {
      const wishlist = await Wishlist.findOne({
        userId,
        'products.productId': productId,
      });
      inWishlist = !!wishlist;
    }

    if (!product) {
      return res.status(StatusCode.NOT_FOUND).redirect('/pageNotFound');
    }

    const priceDetails = await calculatePrice(product, product.category);

    const productWithOffer = {
      ...product.toObject(),
      finalPrice: priceDetails.finalPrice,
      totalDiscount: priceDetails.totalDiscount,
      offer: priceDetails.offer,
      regularPrice: product.regularPrice,
    };

    const similarProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
    }).limit(4);

    res.render('product-details', {
      product: productWithOffer,
      similarProducts,
      inWishlist,
      user: req.session.user,
    });
  } catch (error) {
    console.error('Error in product details:', error);
    res.status(StatusCode.INTERNAL_SERVER).redirect('/pageNotFound');
  }
};

const getPrice = async (req, res) => {
  try {
    const { productId, size } = req.body;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(StatusCode.NOT_FOUND).json({
        error: 'Product not found',
      });
    }

    // Calculate price with any applicable offers
    const priceDetails = await calculatePrice(product, product.category);

    let finalPrice = priceDetails.finalPrice;
    if (size === 'L' || size === 'XL') {
      finalPrice = Math.round(finalPrice + 0.1 * product.regularPrice);
    }

    res.status(StatusCode.OK).json({
      success: true,
      price: finalPrice,
      offer: priceDetails.offer,
    });
  } catch (error) {
    console.error('Error getting price:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      error: Messages.INTERNAL_ERROR,
    });
  }
};

module.exports = {
  productDetails,
  getPrice,
};
