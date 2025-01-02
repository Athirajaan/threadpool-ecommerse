const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Wishlist = require('../../models/wishlistSchema');
const { calculatePrice } = require('../../utils/priceCalculator');

const loadWomenShopping = async (req, res) => {
  try {
    const products = await Product.find({
      gender: 'Women',
      isBlocked: false,
    }).populate('category');
    const category = await Category.find({ gender: 'Women', isListed: true });

    // Calculate prices with offers for each product
    const productsWithOffers = await Promise.all(
      products.map(async (product) => {
        const priceDetails = await calculatePrice(product, product.category);
        return {
          ...product.toObject(),
          finalPrice: priceDetails.finalPrice,
          totalDiscount: priceDetails.totalDiscount,
          offer: priceDetails.offer,
        };
      })
    );

    res.render('womenShop', {
      products: productsWithOffers,
      category,
      wishlistProducts: req.session.wishlist || [],
    });
  } catch (error) {
    console.error('Error loading women shopping:', error);
    res.status(500).redirect('/pageNotFound');
  }
};

const loadMenShopping = async (req, res) => {
  try {
    const products = await Product.find({
      gender: 'Men',
      isBlocked: false,
    }).populate('category');
    const category = await Category.find({ gender: 'Men', isListed: true });

    // Calculate prices with offers for each product
    const productsWithOffers = await Promise.all(
      products.map(async (product) => {
        const priceDetails = await calculatePrice(product, product.category);
        return {
          ...product.toObject(),
          finalPrice: priceDetails.finalPrice,
          totalDiscount: priceDetails.totalDiscount,
          offer: priceDetails.offer,
        };
      })
    );

    res.render('menShope', {
      products: productsWithOffers,
      category,
      wishlistProducts: req.session.wishlist || [],
    });
  } catch (error) {
    console.error('Error loading men shopping:', error);
    res.status(500).redirect('/pageNotFound');
  }
};

const searchProducts = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.redirect('/login');
    }

    const isAjax = req.xhr;
    const page = parseInt(req.query.page) || 1;
    const limit = 12; // Products per load
    const skip = (page - 1) * limit;
    const searchQuery = req.query.q;

    // Sorting logic
    const sortOption = req.query.sort || 'newest';
    let sortCriteria;

    switch (sortOption) {
      case 'priceAsc':
        sortCriteria = { salePrice: 1 };
        break;
      case 'priceDesc':
        sortCriteria = { salePrice: -1 };
        break;
      default:
        sortCriteria = { createdOn: -1 };
    }

    // Search query
    const searchFilter = {
      isBlocked: false,
      $or: [
        { productName: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
      ],
    };

    // Get products
    const products = await Product.find(searchFilter)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit + 1); // Get one extra to check if there are more

    const hasMore = products.length > limit;
    const productsToSend = products.slice(0, limit); // Remove the extra product

    // If it's an AJAX request, return JSON
    if (isAjax) {
      return res.json({
        products: productsToSend,
        hasMore: hasMore,
      });
    }

    // For initial page load
    const categories = await Category.find({ isListed: true });
    const userData = await User.findOne({ _id: user });

    res.render('searchResults', {
      user: userData,
      products: productsToSend,
      category: categories,
      searchQuery: searchQuery,
      sortOption: sortOption,
      hasMore: hasMore, // Make sure this is passed to the template
    });
  } catch (error) {
    console.error('Search error:', error);
    if (req.xhr) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.redirect('/pageNotFound');
  }
};

// Add this new method to handle filtered products
const getFilteredProducts = async (req, res) => {
  try {
    const { categories, sizes, priceRanges } = req.body;
    const user = req.session.user;
    const sortOption = req.query.sort || 'newest';

    // Base query
    let query = {
      isBlocked: false,
      gender: 'Men',
    };

    // Add category filter if selected
    if (categories && categories.length > 0) {
      query.category = { $in: categories };
    }

    // Add size filter if selected
    if (sizes && sizes.length > 0) {
      const sizeQueries = sizes.map((size) => ({
        [`stock.${size}`]: { $gt: 0 },
      }));
      if (sizeQueries.length > 0) {
        query.$and = query.$and || [];
        query.$and.push({ $or: sizeQueries });
      }
    }

    // Add price range filter if selected
    if (priceRanges && priceRanges.length > 0) {
      const priceQuery = priceRanges
        .map((range) => {
          switch (range) {
            case 'under500':
              return { salePrice: { $lt: 500 } };
            case '500to799':
              return { salePrice: { $gte: 500, $lte: 799 } };
            case '800to999':
              return { salePrice: { $gte: 800, $lte: 999 } };
            case '1000to1999':
              return { salePrice: { $gte: 1000, $lte: 1999 } };
            case '2000plus':
              return { salePrice: { $gte: 2000 } };
            default:
              return null;
          }
        })
        .filter((q) => q !== null);

      if (priceQuery.length > 0) {
        query.$and = query.$and || [];
        query.$and.push({ $or: priceQuery });
      }
    }

    // Sort criteria
    let sortCriteria = {};
    switch (sortOption) {
      case 'priceAsc':
        sortCriteria = { salePrice: 1 };
        break;
      case 'priceDesc':
        sortCriteria = { salePrice: -1 };
        break;
      case 'nameAsc':
        sortCriteria = { productName: 1 };
        break;
      case 'nameDesc':
        sortCriteria = { productName: -1 };
        break;
      default:
        sortCriteria = { createdOn: -1 };
    }

    // Fetch wishlist for the user
    const wishlist = await Wishlist.findOne({ userId: user });
    const wishlistProductIds = wishlist
      ? wishlist.products.map((item) => item.productId.toString())
      : [];

    // Fetch filtered products
    const products = await Product.find(query).sort(sortCriteria);

    // Return filtered products with HTML
    res.json({
      success: true,
      html: products
        .map(
          (product) => `
        <div class="group">
          <div class="relative bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
            <!-- Product Image with Hover Effect -->
            <a href="/productDetails?id=${product._id}" class="block">
              <div class="aspect-w-1 aspect-h-1 w-full relative overflow-hidden">
                <img 
                  src="${product.productImage[0]}" 
                  alt="${product.productName}" 
                  class="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-0">
                <img 
                  src="${product.productImage[1] || product.productImage[0]}" 
                  alt="${product.productName}" 
                  class="w-full h-full object-cover absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              </div>
            </a>
            
            <!-- Quick Actions -->
            <div class="absolute top-4 right-4 space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                class="wishlist-btn p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                data-product-id="${product._id}"
                data-in-wishlist="${wishlistProductIds.includes(product._id.toString()) ? 'true' : 'false'}"
              >
                <svg class="w-5 h-5 wishlist-icon ${wishlistProductIds.includes(product._id.toString()) ? 'text-red-500' : 'text-gray-400'}" 
                     fill="currentColor" 
                     viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              </button>
            </div>

            <!-- Product Info -->
            <div class="p-4">
              <h3 class="text-lg font-medium text-gray-900 mb-2">${product.productName}</h3>
              <div class="flex items-center justify-between">
                <div class="flex items-baseline">
                  <span class="text-lg font-bold text-gray-900">₹${product.salePrice}</span>
                  <span class="ml-2 text-sm text-gray-500 line-through">₹${product.regularPrice}</span>
                </div>
                <span class="text-sm font-medium text-green-600">
                  ${Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100)}% OFF
                </span>
              </div>
            </div>
          </div>
        </div>
      `
        )
        .join(''),
    });
  } catch (error) {
    console.error('Filter error:', error);
    res.status(500).json({
      success: false,
      message: 'Error filtering products',
    });
  }
};

module.exports = {
  loadMenShopping,
  loadWomenShopping,
  searchProducts,
  getFilteredProducts,
};
