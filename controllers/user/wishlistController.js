const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');
const { calculatePrice } = require('../../utils/priceCalculator');

// Load Wishlist Page
const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    // Fetch wishlist with populated product details including category for offer calculation
    const wishlist = await Wishlist.findOne({ userId }).populate({
      path: 'products.productId',
      select: 'productName productImage salePrice regularPrice stock category',
      populate: {
        path: 'category', // Populate category for offer calculation
      },
    });

    // Format products for display with offer prices
    const wishlistProducts = await Promise.all(
      wishlist
        ? wishlist.products.map(async (item) => {
            // Calculate price with offers
            const priceDetails = await calculatePrice(
              item.productId,
              item.productId.category
            );

            return {
              _id: item.productId._id,
              productName: item.productId.productName,
              productImage: item.productId.productImage[0],
              salePrice: priceDetails.finalPrice, // Use offer price
              regularPrice: item.productId.regularPrice,
              stock: item.productId.stock,
              addedAt: item.addedAt,
            };
          })
        : []
    );

    res.render('wishlist', {
      user: user,
      products: wishlistProducts,
    });
  } catch (error) {
    console.error('Error in loadWishlist:', error);
    res.status(500).redirect('/pageNotFound');
  }
};

// Add this method to your wishlistController
const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login first',
      });
    }

    // Find user's wishlist
    let wishlist = await Wishlist.findOne({ userId });

    // If no wishlist exists, create one
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    // Check if product is already in wishlist
    const existingProduct = wishlist.products.find(
      (item) => item.productId.toString() === productId
    );

    if (existingProduct) {
      // Remove product if it exists
      wishlist.products = wishlist.products.filter(
        (item) => item.productId.toString() !== productId
      );
    } else {
      // Add product if it doesn't exist
      wishlist.products.push({ productId });
    }

    await wishlist.save();

    res.json({
      success: true,
      action: existingProduct ? 'removed' : 'added',
      message: `Product ${existingProduct ? 'removed from' : 'added to'} wishlist`,
    });
  } catch (error) {
    console.error('Wishlist toggle error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating wishlist',
    });
  }
};

// Add this new method to check wishlist status
const checkWishlistStatus = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.params.productId;

    const wishlist = await Wishlist.findOne({
      userId,
      'products.productId': productId,
    });

    res.json({
      success: true,
      inWishlist: !!wishlist,
    });
  } catch (error) {
    console.error('Error checking wishlist status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check wishlist status',
    });
  }
};

module.exports = {
  loadWishlist,

  toggleWishlist,
  checkWishlistStatus,
};
