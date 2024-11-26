const Product=require('../../models/productSchema');
const Category=require('../../models/categorySchema');
const User=require('../../models/userSchema');
const fs=require('fs');
const path=require('path');
const sharp=require('sharp')


// product listing

const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || '';
        const gender = req.query.gender || ''; 
        const page = req.query.page || 1;
        const limit = 5;

        const query = {
            $or: [
                { productName: { $regex: new RegExp('.*' + search + '.*', 'i') } },
                { gender: { $regex: new RegExp('.*' + search + '.*', 'i') } }
            ]
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
            res.render('productlist', {
                data: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
                gender: gender
            });
        } else {
            res.render('page-404');
        }
    } catch (error) {
        res.redirect('/pageerror');
    }
};



// addProduct


 const getProductAddPage = async (req,res)=>{
    try {
        
        const category = await Category.find({isListed:true});
        res.render('addProducts',{
            cat:category
        });
    } catch (error) {
        res.redirect('/pageerror')
    }
 }


module.exports ={
    getAllProducts,
    getProductAddPage,
}