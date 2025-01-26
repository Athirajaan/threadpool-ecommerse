const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const cloudinary = require('cloudinary').v2;
const upload = require('../../config/cloudinary');
const multer = require('multer');
const { deleteModel } = require('mongoose');

// product listing

const getAllProducts = async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    const gender = req.query.gender || '';
    const page = req.query.page || 1;
    const limit = 5;

    const query = {
      $or: [
        { productName: { $regex: new RegExp('.*' + searchQuery + '.*', 'i') } },
        { gender: { $regex: new RegExp('.*' + searchQuery + '.*', 'i') } },
      ],
    };
    if (gender) {
      query.gender = gender;
    }

    const productData = await Product.find(query)
      .populate('category', 'name')
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await Product.find(query).countDocuments();
    const category = await Category.find({ isListed: true });

    if (category.length > 0) {
      res.render('productlist', {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        gender: gender,
        searchQuery: searchQuery,
      });
    } else {
      res.render('page-404');
    }
  } catch (error) {
    res.redirect('/pageerror');
  }
};

// varients display
const getVarients = async (req, res) => {
  try {
    const productId = req.params.productId;
    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const stock = product.stock;
    const availableVariants = [];

    for (let size in stock) {
      if (stock[size] > 0) {
        let variantPrice = product.salePrice;
        if (size === 'L' || size === 'XL') {
          variantPrice = product.salePrice + product.regularPrice * 0.1;
        }

        // Create the variant object
        const variant = {
          size,
          quantity: stock[size],
          price: variantPrice.toFixed(2),
        };

        availableVariants.push(variant);
      }
    }

    if (availableVariants.length === 0) {
      return res.status(200).json([]);
    }

    res.status(200).json(availableVariants);
  } catch (error) {
    console.error('Error fetching product variants:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    res.render('addProducts', {
      cat: category,
    });
  } catch (error) {
    res.redirect('/pageerror');
  }
};

const addProducts = async (req, res) => {
  try {
    // First validate if files exist
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload product images',
      });
    }

    const {
      productName,
      description,
      gender,
      category,
      regularPrice,
      salePrice,
      sizeSQty,
      sizeMQty,
      sizeLQty,
      sizeXLQty,
    } = req.body;

    // Input validation
    const validationErrors = [];
    const MAX_PRICE = 100000;
    const regularPriceNum = parseFloat(regularPrice);
    const salePriceNum = parseFloat(salePrice);

    // Price validation
    if (
      isNaN(regularPriceNum) ||
      regularPriceNum <= 0 ||
      regularPriceNum > MAX_PRICE
    ) {
      validationErrors.push('Invalid regular price');
    }

    if (isNaN(salePriceNum) || salePriceNum <= 0 || salePriceNum > MAX_PRICE) {
      validationErrors.push('Invalid sale price');
    }

    if (regularPriceNum <= salePriceNum) {
      validationErrors.push('Regular price must be greater than sale price');
    }

    // Stock validation
    const stock = {
      S: parseInt(sizeSQty, 10) || 0,
      M: parseInt(sizeMQty, 10) || 0,
      L: parseInt(sizeLQty, 10) || 0,
      XL: parseInt(sizeXLQty, 10) || 0,
    };

    if (Object.values(stock).every((qty) => qty === 0)) {
      validationErrors.push('At least one size must have a quantity');
    }

    // Category validation
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      validationErrors.push('Invalid category ID');
    }

    // Check if product already exists
    const productExists = await Product.findOne({
      productName: { $regex: new RegExp(`^${productName}$`, 'i') },
    });

    if (productExists) {
      return res.status(400).json({
        success: false,
        message: 'Product already exists, please try with another name',
      });
    }

    // Image validation
    if (!req.files || req.files.length < 3 || req.files.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Please upload between 3 and 5 images.',
      });
    }

    // Return if there are validation errors
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join(', '),
      });
    }

    // Image upload section
    const images = [];
    try {
      for (const file of req.files) {
        if (!file.path) {
          throw new Error('File path is missing');
        }

        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'product-images',
          transformation: [
            {
              width: 800,
              height: 800,
              crop: 'fill',
              quality: 'auto:best',
              format: 'webp',
            },
          ],
        });

        if (!result || !result.secure_url) {
          throw new Error('Failed to get secure URL from Cloudinary');
        }

        images.push(result.secure_url);
      }
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload images',
        error: uploadError.message,
      });
    }

    // Calculate total quantity
    const totalQuantity = Object.values(stock).reduce((a, b) => a + b, 0);

    // Create new product
    const newProduct = new Product({
      productName,
      description,
      gender,
      category,
      regularPrice: regularPriceNum,
      salePrice: salePriceNum,
      createdOn: new Date(),
      stock,
      totalQuantity,
      productImage: images,
      status: 'Available',
    });

    await newProduct.save();

    return res.status(200).json({
      success: true,
      message: 'Product added successfully',
      redirectUrl: '/admin/products',
    });
  } catch (error) {
    console.error('Error saving product:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

const getProductForEdit = async (req, res) => {
  try {
    const productId = req.params.id;

    // Find the product by ID and populate its category
    const product = await Product.findById(productId).populate('category');

    // Check if the product exists
    if (!product) {
      return res.status(404).render('error', {
        message: 'Product not found',
      });
    }

    // Render the edit page and pass the product details
    const categories = await Category.find();
    res.render('edit-product', {
      title: 'Edit Product',
      product,
      categories,
      existingImages: product.productImage,
    });
  } catch (error) {
    console.error('Error fetching product for edit:', error);

    // Render an error page in case of a server error
    res.status(500).render('error', {
      message: 'Error retrieving product details',
    });
  }
};

const blockProduct = async (req, res) => {
  try {
    const { productId } = req.body; // Retrieve productId from request body
    await Product.updateOne({ _id: productId }, { $set: { isBlocked: true } });
    res.status(200).send({ message: 'Product blocked successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Something went wrong' });
  }
};

const unblockProduct = async (req, res) => {
  try {
    const { productId } = req.body; // Retrieve productId from request body
    await Product.updateOne({ _id: productId }, { $set: { isBlocked: false } });
    res.status(200).send({ message: 'Product unblocked successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Something went wrong' });
  }
};

const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const {
      productName,
      description,
      gender,
      category,
      regularPrice,
      salePrice,
      sizeSQty,
      sizeMQty,
      sizeLQty,
      sizeXLQty,
      deletedImages,
    } = req.body;

    // Find existing product
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Validate inputs
    const validationErrors = [];
    const MAX_PRICE = 100000;
    const regularPriceNum = parseFloat(regularPrice);
    const salePriceNum = parseFloat(salePrice);

    if (regularPriceNum <= 0 || regularPriceNum > MAX_PRICE) {
      validationErrors.push('Invalid regular price');
    }
    if (salePriceNum <= 0 || salePriceNum > MAX_PRICE) {
      validationErrors.push('Invalid sale price');
    }
    if (regularPriceNum <= salePriceNum) {
      validationErrors.push('Regular price must be greater than sale price');
    }

    // Handle stock updates
    const stock = {
      S: parseInt(sizeSQty, 10) || 0,
      M: parseInt(sizeMQty, 10) || 0,
      L: parseInt(sizeLQty, 10) || 0,
      XL: parseInt(sizeXLQty, 10) || 0,
    };

    if (Object.values(stock).every((qty) => qty === 0)) {
      validationErrors.push('At least one size must have a quantity');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join(', '),
      });
    }

    // Handle image updates
    let productImages = [...existingProduct.productImage]; // Start with existing images

    // Remove deleted images from Cloudinary and the array
    if (deletedImages) {
      const deletedImageUrls = Array.isArray(deletedImages)
        ? deletedImages
        : [deletedImages];

      for (const imageUrl of deletedImageUrls) {
        // Extract public_id from Cloudinary URL
        const publicId = imageUrl.split('/').slice(-1)[0].split('.')[0];
        try {
          await cloudinary.uploader.destroy(`product-images/${publicId}`);
          productImages = productImages.filter((img) => img !== imageUrl);
        } catch (error) {
          console.error('Error deleting image from Cloudinary:', error);
        }
      }
    }

    // Upload new images
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'product-images',
            transformation: [
              {
                width: 800,
                height: 800,
                crop: 'fill',
                quality: 'auto:best',
                format: 'webp',
              },
            ],
          });
          productImages.push(result.secure_url);
        } catch (error) {
          console.error('Error uploading new image:', error);
        }
      }
    }

    // Validate final image count
    if (productImages.length < 3 || productImages.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Product must have between 3 and 5 images',
      });
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        productName,
        description,
        gender,
        category,
        regularPrice: regularPriceNum,
        salePrice: salePriceNum,
        stock,
        totalQuantity: Object.values(stock).reduce((a, b) => a + b, 0),
        productImage: productImages,
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      redirectUrl: '/admin/products',
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

const searchProducts = async (req, res) => {
  try {
    const search = req.query.search || '';
    const searchRegex = new RegExp(
      search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'),
      'i'
    );

    const products = await Product.find({
      $or: [
        { productName: { $regex: searchRegex } },
        { gender: { $regex: searchRegex } },
        { 'category.name': { $regex: searchRegex } },
      ],
    })
      .populate('category', 'name')
      .lean();

    res.json({
      success: true,
      products: products,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing search',
    });
  }
};

module.exports = {
  getAllProducts,
  getProductAddPage,
  addProducts,
  getVarients,
  getProductForEdit,
  blockProduct,
  unblockProduct,
  editProduct,
  searchProducts,
};
