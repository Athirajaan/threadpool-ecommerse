const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const cloudinary = require('cloudinary').v2;
const upload = require('../../config/cloudinary');
const multer = require('multer');
const { deleteModel } = require('mongoose');
const { StatusCode, Messages } = require('../../utils/statusCodes');

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
      return res.status(StatusCode.NOT_FOUND).render('page-404', {
        message: Messages.NOT_FOUND,
      });
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(StatusCode.INTERNAL_SERVER).render('error', {
      message: Messages.INTERNAL_ERROR,
    });
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
    res.redirect('/admin/pageerror');
  }
};

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    res.render('addProducts', {
      cat: category,
    });
  } catch (error) {
    res.redirect('/admin/pageerror');
  }
};

const addProducts = async (req, res) => {
  try {
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

    const stock = {
      S: parseInt(sizeSQty, 10) || 0,
      M: parseInt(sizeMQty, 10) || 0,
      L: parseInt(sizeLQty, 10) || 0,
      XL: parseInt(sizeXLQty, 10) || 0,
    };

    if (Object.values(stock).every((qty) => qty === 0)) {
      validationErrors.push('At least one size must have a quantity');
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      validationErrors.push('Invalid category ID');
    }

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

    if (validationErrors.length > 0) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: validationErrors.join(', '),
      });
    }

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

    return res.status(StatusCode.CREATED).json({
      success: true,
      message: Messages.CREATED,
      redirectUrl: '/admin/products',
    });
  } catch (error) {
    console.error('Error saving product:', error);
    return res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
      error: error.message,
    });
  }
};

const getProductForEdit = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId).populate('category');

    if (!product) {
      return res.status(404).render('error', {
        message: 'Product not found',
      });
    }

    const categories = await Category.find();
    res.render('edit-product', {
      title: 'Edit Product',
      product,
      categories,
      existingImages: product.productImage,
    });
  } catch (error) {
    console.error('Error fetching product for edit:', error);
    res.redirect('/admin/pageerror');
  }
};

const blockProduct = async (req, res) => {
  try {
    const { productId } = req.body;
    await Product.updateOne(
      { _id: productId },
      { $set: { isBlocked: true, status: 'Unavailable' } }
    );
    res.status(200).send({ message: 'Product blocked successfully' });
  } catch (error) {
    console.error('Error blocking product:', error);
    res.status(500).send({ error: 'Something went wrong' });
  }
};

const unblockProduct = async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findById(productId).populate('category');

    if (product.category.isBlocked) {
      await Product.updateOne(
        { _id: productId },
        { $set: { isBlocked: false } }
      );
      return res
        .status(200)
        .send({
          message:
            'Product unblocked, but category is blocked. Status remains Unavailable.',
        });
    }
    await Product.updateOne(
      { _id: productId },
      { $set: { isBlocked: false, status: 'Available' } }
    );
    res
      .status(200)
      .send({
        message:
          'Product unblocked successfully and status updated to Available.',
      });
  } catch (error) {
    console.error('Error unblocking product:', error);
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

    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(StatusCode.NOT_FOUND).json({
        success: false,
        message: Messages.NOT_FOUND,
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
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: validationErrors.join(', '),
      });
    }

    // Handle image updates
    let productImages = [...existingProduct.productImage];

    let deletedImagesList = [];
    if (deletedImages) {
      try {
        deletedImagesList = JSON.parse(deletedImages);
      } catch (e) {
        deletedImagesList = [deletedImages];
      }
    }

    if (deletedImagesList.length > 0) {
      for (const imageUrl of deletedImagesList) {
        try {
          const urlParts = imageUrl.split('/');
          const publicIdWithExtension = urlParts[urlParts.length - 1];
          const publicId = `product-images/${publicIdWithExtension.split('.')[0]}`;

          await cloudinary.uploader.destroy(publicId);

          productImages = productImages.filter((img) => img !== imageUrl);
        } catch (error) {
          console.error('Error deleting image from Cloudinary:', error);
        }
      }
    }

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

    return res.status(StatusCode.OK).json({
      success: true,
      message: Messages.UPDATED,
      redirectUrl: '/admin/products',
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
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
