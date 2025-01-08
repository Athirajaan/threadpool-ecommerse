const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Wishlist = require('../../models/wishlistSchema');
const { calculatePrice } = require('../../utils/priceCalculator');

const loadWomenShopping = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12; // Products per page
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalProducts = await Product.countDocuments({
      gender: 'Women',
      isBlocked: false,
    });
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch products
    const products = await Product.find({
      gender: 'Women',
      isBlocked: false,
    })
      .populate('category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Fetch categories for women
    const categories = await Category.find({
      gender: 'Women',
      isListed: true,
    });

    // Get user's wishlist
    let wishlistProducts = [];
    if (req.session.user) {
      const wishlist = await Wishlist.findOne({ userId: req.session.user });
      wishlistProducts = wishlist
        ? wishlist.products.map((item) => item.productId.toString())
        : [];
    }

    // Calculate prices with offers
    const productsWithOffers = await Promise.all(
      products.map(async (product) => {
        const priceDetails = await calculatePrice(product, product.category);
        return {
          ...product.toObject(),
          finalPrice: priceDetails.finalPrice,
          inWishlist: wishlistProducts.includes(product._id.toString()),
        };
      })
    );

    res.render('womenShop', {
      products: productsWithOffers,
      currentPage: page,
      totalPages: totalPages,
      wishlistProducts,
      category: categories, // Pass categories to the view
    });
  } catch (error) {
    console.error('Error loading women shopping:', error);
    res.status(500).redirect('/pageNotFound');
  }
};

const loadMenShopping = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12; // Products per page
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalProducts = await Product.countDocuments({
      gender: 'Men',
      isBlocked: false,
    });
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch products
    const products = await Product.find({
      gender: 'Men',
      isBlocked: false,
    })
      .populate('category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Fetch categories for women
    const categories = await Category.find({
      gender: 'Men',
      isListed: true,
    });

    // Get user's wishlist
    let wishlistProducts = [];
    if (req.session.user) {
      const wishlist = await Wishlist.findOne({ userId: req.session.user });
      wishlistProducts = wishlist
        ? wishlist.products.map((item) => item.productId.toString())
        : [];
    }

    // Calculate prices with offers
    const productsWithOffers = await Promise.all(
      products.map(async (product) => {
        const priceDetails = await calculatePrice(product, product.category);
        return {
          ...product.toObject(),
          finalPrice: priceDetails.finalPrice,
          inWishlist: wishlistProducts.includes(product._id.toString()),
        };
      })
    );

    res.render('menShope', {
      products: productsWithOffers,
      currentPage: page,
      totalPages: totalPages,
      wishlistProducts,
      category: categories, // Pass categories to the view
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

    // Sanitize search query
    let searchQuery = req.query.q || '';

    // Check for invalid or dangerous search patterns
    if (searchQuery.match(/^[*?+]$/) || searchQuery.length < 1) {
      if (req.xhr) {
        return res.json({
          products: [],
          hasMore: false,
          message: 'Please enter a valid search term',
        });
      }
      return res.render('searchResults', {
        user: await User.findOne({ _id: user }),
        products: [],
        category: await Category.find({ isListed: true }),
        searchQuery: searchQuery,
        sortOption: 'newest',
        hasMore: false,
        message: 'Please enter a valid search term',
      });
    }

    // Escape special regex characters
    searchQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const isAjax = req.xhr;
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;
    const { categories, sizes, priceRanges } = req.body;
    const sortOption = req.query.sort || 'newest';

    // Base search query
    let query = {
      isBlocked: false,
      $or: [
        { productName: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
      ],
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
        sortCriteria = { createdAt: -1 }; // newest first
    }

    // Get products with filters and sort
    const products = await Product.find(query)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit + 1); // Get one extra to check if there are more

    const hasMore = products.length > limit;
    const productsToSend = products.slice(0, limit);

    // Get user's wishlist
    let wishlistProducts = [];
    if (req.session.user) {
      const wishlist = await Wishlist.findOne({ userId: req.session.user });
      wishlistProducts = wishlist
        ? wishlist.products.map((item) => item.productId.toString())
        : [];
    }

    // Calculate prices with offers
    const productsWithOffers = await Promise.all(
      productsToSend.map(async (product) => {
        const priceDetails = await calculatePrice(product, product.category);
        return {
          ...product.toObject(),
          finalPrice: priceDetails.finalPrice,
          inWishlist: wishlistProducts.includes(product._id.toString()),
        };
      })
    );

    // If AJAX request, return JSON
    if (isAjax) {
      return res.json({
        products: productsWithOffers,
        hasMore: hasMore,
      });
    }

    // For initial page load
    const categoryList = await Category.find({ isListed: true });
    const userData = await User.findOne({ _id: user });

    res.render('searchResults', {
      user: userData,
      products: productsWithOffers,
      category: categoryList,
      searchQuery: searchQuery,
      sortOption: sortOption,
      hasMore: hasMore,
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

    // Get the gender from the referer URL
    const referer = req.headers.referer;
    const gender = referer.includes('women') ? 'Women' : 'Men';

    // Base query with gender filter
    let query = {
      isBlocked: false,
      gender: gender, // Dynamically set based on the page
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

    // Send only the data, no HTML
    res.json({
      success: true,
      products: products.map((product) => ({
        _id: product._id,
        productName: product.productName,
        productImage: product.productImage,
        regularPrice: product.regularPrice,
        salePrice: product.salePrice,
        offer: product.offer,
        // Add any other necessary product data
      })),
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
