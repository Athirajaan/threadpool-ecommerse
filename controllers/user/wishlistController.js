const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');
const { calculatePrice } = require('../../utils/priceCalculator');
const { StatusCode, Messages } = require('../../utils/statusCodes');

// Load Wishlist Page with Pagination
const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const page = parseInt(req.query.page) || 1;
    const limit = 8; 

  
    const wishlist = await Wishlist.findOne({ userId });
    const totalItems = wishlist ? wishlist.products.length : 0;
    const totalPages = Math.ceil(totalItems / limit);

    // Fetch wishlist with pagination and populated product details
    const paginatedWishlist = await Wishlist.findOne({ userId })
      .populate({
        path: 'products.productId',
        select:
          'productName productImage salePrice regularPrice stock category',
        populate: {
          path: 'category',
        },
      })
      .slice('products', [(page - 1) * limit, limit]);

    // Format products for display with offer prices
    const wishlistProducts = await Promise.all(
      paginatedWishlist
        ? paginatedWishlist.products.map(async (item) => {
            const priceDetails = await calculatePrice(
              item.productId,
              item.productId.category
            );

            return {
              _id: item.productId._id,
              productName: item.productId.productName,
              productImage: item.productId.productImage[0],
              salePrice: priceDetails.finalPrice,
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
      currentPage: page,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      lastPage: totalPages,
    });
  } catch (error) {
    console.error('Error in loadWishlist:', error);
    res.status(StatusCode.INTERNAL_SERVER).redirect('/pageNotFound');
  }
};

// Add this method to your wishlistController
const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(StatusCode.UNAUTHORIZED).json({
        success: false,
        message: Messages.UNAUTHORIZED,
      });
    }


    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    const existingProduct = wishlist.products.find(
      (item) => item.productId.toString() === productId
    );

    if (existingProduct) {
      wishlist.products = wishlist.products.filter(
        (item) => item.productId.toString() !== productId
      );
    } else {
      wishlist.products.push({ productId });
    }

    await wishlist.save();

    res.status(StatusCode.OK).json({
      success: true,
      action: existingProduct ? 'removed' : 'added',
      message: `Product ${existingProduct ? 'removed from' : 'added to'} wishlist`,
    });
  } catch (error) {
    console.error('Wishlist toggle error:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
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

    res.status(StatusCode.OK).json({
      success: true,
      inWishlist: !!wishlist,
    });
  } catch (error) {
    console.error('Error checking wishlist status:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
    });
  }
};

module.exports = {
  loadWishlist,
  toggleWishlist,
  checkWishlistStatus,
};
