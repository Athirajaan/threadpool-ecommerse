const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Wishlist = require('../../models/wishlistSchema');
const { calculatePrice } = require('../../utils/priceCalculator');
const { StatusCode, Messages } = require('../../utils/statusCodes');

const loadWomenShopping = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const totalProducts = await Product.countDocuments({
      gender: 'Women',
      isBlocked: false,
    }).populate({
      path: 'category',
      match: { isListed: true },
    });
    const products = await Product.find({
      gender: 'Women',
      isBlocked: false,
    })
      .populate({
        path: 'category',
        match: { isListed: true },
      })
      .sort({ createdAt: -1 });

    const filteredProducts = products.filter((product) => product.category);

    const paginatedProducts = filteredProducts.slice(skip, skip + limit);
    const totalPages = Math.ceil(filteredProducts.length / limit);

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
      paginatedProducts.map(async (product) => {
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
      category: categories,
    });
  } catch (error) {
    console.error('Error loading women shopping:', error);
    res.status(StatusCode.INTERNAL_SERVER).redirect('/pageNotFound');
  }
};

const loadMenShopping = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    // Get total count for pagination - updated to include category check
    const totalProducts = await Product.countDocuments({
      gender: 'Men',
      isBlocked: false,
    }).populate({
      path: 'category',
      match: { isListed: true },
    });

    // Fetch products with category check
    const products = await Product.find({
      gender: 'Men',
      isBlocked: false,
    })
      .populate({
        path: 'category',
        match: { isListed: true },
      })
      .sort({ createdAt: -1 });

    const filteredProducts = products.filter((product) => product.category);

    const paginatedProducts = filteredProducts.slice(skip, skip + limit);

    // Recalculate total pages based on filtered products
    const totalPages = Math.ceil(filteredProducts.length / limit);

    const categories = await Category.find({
      gender: 'Men',
      isListed: true,
    });

    let wishlistProducts = [];
    if (req.session.user) {
      const wishlist = await Wishlist.findOne({ userId: req.session.user });
      wishlistProducts = wishlist
        ? wishlist.products.map((item) => item.productId.toString())
        : [];
    }

    // Calculate prices with offers
    const productsWithOffers = await Promise.all(
      paginatedProducts.map(async (product) => {
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
      category: categories,
    });
  } catch (error) {
    console.error('Error loading men shopping:', error);
    res.status(StatusCode.INTERNAL_SERVER).redirect('/pageNotFound');
  }
};

const searchProducts = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(StatusCode.UNAUTHORIZED).redirect('/login');
    }

    // Sanitize search query
    let searchQuery = req.query.q || '';

    // Check for invalid or dangerous search patterns
    if (searchQuery.match(/^[*?+]$/) || searchQuery.length < 1) {
      if (req.xhr) {
        return res.status(StatusCode.BAD_REQUEST).json({
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

  
    if (isAjax) {
      return res.status(StatusCode.OK).json({
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
      return res.status(StatusCode.INTERNAL_SERVER).json({
        error: Messages.INTERNAL_ERROR,
      });
    }
    res.status(StatusCode.INTERNAL_SERVER).redirect('/pageNotFound');
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

  
    let query = {
      isBlocked: false,
      gender: gender, 
    };

    // Add category filter if selected
    if (categories && categories.length > 0) {
      query.category = { $in: categories };
    }


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

    const products = await Product.find(query).sort(sortCriteria);

    
    res.status(StatusCode.OK).json({
      success: true,
      products: products.map((product) => ({
        _id: product._id,
        productName: product.productName,
        productImage: product.productImage,
        regularPrice: product.regularPrice,
        salePrice: product.salePrice,
        offer: product.offer,
      })),
    });
  } catch (error) {
    console.error('Filter error:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
    });
  }
};

const filterSearchResults = async (req, res) => {
  try {
    const { categories, sizes, priceRanges, sort, searchQuery } = req.body;
    const user = req.session.user;

    
    let query = {
      isBlocked: false,
      $or: [
        { productName: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
      ],
    };

    if (categories && categories.length > 0) {
      query.category = { $in: categories };
    }

  
    if (sizes && sizes.length > 0) {
      const sizeQueries = sizes.map((size) => ({
        [`stock.${size}`]: { $gt: 0 },
      }));
      query.$and = query.$and || [];
      query.$and.push({ $or: sizeQueries });
    }

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
    switch (sort) {
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
        sortCriteria = { createdAt: -1 };
    }

    // Fetch filtered products
    const products = await Product.find(query).sort(sortCriteria);

    let wishlistProducts = [];
    if (user) {
      const wishlist = await Wishlist.findOne({ userId: user });
      wishlistProducts = wishlist
        ? wishlist.products.map((item) => item.productId.toString())
        : [];
    }

    res.json({
      success: true,
      products: products.map((product) => ({
        ...product.toObject(),
        inWishlist: wishlistProducts.includes(product._id.toString()),
      })),
    });
  } catch (error) {
    console.error('Search filter error:', error);
    res.status(500).json({
      success: false,
      message: 'Error filtering search results',
    });
  }
};

module.exports = {
  loadMenShopping,
  loadWomenShopping,
  searchProducts,
  getFilteredProducts,
  filterSearchResults,
};
