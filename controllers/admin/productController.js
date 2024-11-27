const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const multer = require('multer');
const sharp = require("sharp");

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

// addProduct

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



const addProducts =async (req,res)=>{
  try {
    
    const products = req.body;
    const productExists =await Product.findOne({
      productName:products.productName,
    });

    if(!productExists){
      const images=[];

      if(req.files && req.files.length>0){
        for(let i=0;i<req.files.length;i++){
          const originalImagePath = req.files[i].path;

          const resizeImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);
          await sharp(originalImagePath).resize({
            width:440,height:440
          }).toFile(resizeImagePath);

          images.push(resizeImagePath);
        }
      }

      const category = await Category.findOne({name:products.category});

      if(!category){
        return res.status(400).json("Invalid Category Name");
      }

      let salePrice = products.salePrice;
      if (products.size === "L" || products.size === "XL") {
        salePrice += (products.regularPrice * 0.10);
      }
      
      const sizeQuantities = {
        sizeS: products.sizeSQty || 0,
        sizeM: products.sizeMQty || 0,
        sizeL: products.sizeLQty || 0,
        sizeXL: products.sizeXLQty || 0,
      };

      const totalQuantity = sizeQuantities.sizeS + sizeQuantities.sizeM + sizeQuantities.sizeL + sizeQuantities.sizeXL;

      const newProduct = new Product({
        productsName:products.productName,
        description:products.description,
        gender:products.gender,
        category:products.category,
        regularPrice:products.regularPrice,
        selePrice:products.salePrice,
        createdOn:new Date(),
        quantityS: sizeQuantities.sizeS,
        quantityM: sizeQuantities.sizeM,
        quantityL: sizeQuantities.sizeL,
        quantityXL: sizeQuantities.sizeXL,
        totalQuantity: totalQuantity,     
        size:products.size,
        productImage:images,
        status:'Available'
      })

      await newProduct.save();
      return res.redirect('/admin/addProducts?success=true');
    }
    else{
      return res.status(400).jsom("product alreday exist,please try with another name");
    }
  } catch (error) {
    console.error("Error saving produts",error)
    return res.redirect('/admin/pageerror')
  }
}

module.exports = {
  getAllProducts,
  getProductAddPage,
  addProducts,
};
