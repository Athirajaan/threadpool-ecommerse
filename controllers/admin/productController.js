const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const cloudinary = require('cloudinary').v2; 
const upload = require('../../config/cloudinary');
const multer = require('multer');
const { deleteModel } = require("mongoose");


// product listing

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const gender = req.query.gender || "";
    const page = req.query.page || 1;
    const limit = 5;

    const query = {
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { gender: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ], 
    };
    if (gender) {
      query.gender = gender;
    }

    const productData = await Product.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await Product.find(query).countDocuments();
    const category = await Category.find({ isListed: true });

    if (category.length > 0) {
      res.render("productlist", {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        gender: gender,
      });
    } else {
      res.render("page-404");
    }
  } catch (error) {
    res.redirect("/pageerror");
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
          variantPrice = product.salePrice + (product.regularPrice * 0.1); 
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
    res.render("addProducts", {
      cat: category,
    });
  } catch (error) {
    res.redirect("/pageerror");
  }
};


// addProduct
const addProducts = async (req, res) => {
  try {
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
      sizeXLQty 
    } = req.body;

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

    
    const stock = {
      S: parseInt(sizeSQty, 10) || 0,
      M: parseInt(sizeMQty, 10) || 0,
      L: parseInt(sizeLQty, 10) || 0,
      XL: parseInt(sizeXLQty, 10) || 0,
    };

    if (Object.values(stock).every(qty => qty === 0)) {
      validationErrors.push('At least one size must have a quantity');
    }

    
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      validationErrors.push('Invalid category ID');
    }
    const productExists = await Product.findOne({ 
      productName: { $regex: new RegExp(`^${productName}$`, 'i') } 
    });

    if (productExists) {
      return res.status(400).json({
        success: false, 
        message: "Product already exists, please try with another name"
      });
    }

    
    if (!req.files || req.files.length < 3 || req.files.length > 5) {
      return res.status(400).json({
        success: false, 
        message: "Please upload between 3 and 5 images."
      });
    }
    const images = [];
    try {
      for (let file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "product-images",
          transformation: [{ width: 440, height: 440, crop: "fill", quality: "100" }]
        });
        images.push(result.secure_url);
      }
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload images'
      });
    }
    const totalQuantity = Object.values(stock).reduce((a, b) => a + b, 0);

  
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
      status: 'Available'
    });

    await newProduct.save();
    return res.status(200).json({
      success: true,
      redirectUrl: '/admin/products'
    });

  } catch (error) {
    console.error("Error saving product", error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// edit product 

const getEditProduct = async (req,res)=>{
 try { 

  const id = req.query.id;
  const product = await Product.findOne({_id:id});
  const category = await Category.find({});
  res.render("edit-product", {
    product:product,
    cat:category,

  })
  
 } catch (error) {
     res.redirect("/pageerror");
 }
}
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


module.exports = {
  getAllProducts,
  getProductAddPage,
  addProducts,
  getVarients,
  getEditProduct,
  blockProduct,
  unblockProduct,
};
