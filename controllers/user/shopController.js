const Product = require('../../models/productSchema');
const Category =require('../../models/categorySchema');
const User =require('../../models/userSchema');



const loadWomenShopping = async (req,res)=>{
    try {
      const user = req.session.user;
      const userData = await User.findOne({ _id:user})
      const category = await Category.find({isListed:true,gender:women})
      const categoryIds = category.map((categories)=>categories._id.toString())
      const page = parseInt(req.query.page) || 1;
      const limit = 9;
      const skip = (page-1)*limit;
      const products =await Product.find({ 
        isBlocked:false,
        category:{$in:categoryIds},
        totalQuantity:{$gt:0}
      }).sort({createdOn:-1}).skip(skip).limit(limit);
      const totalProducts = await Product.countDocuments({
        isBlocked:false,
        category:{$in:categoryIds},
        totalQuantity:{$gt:0}
      });
      const totalPages = Math.ceil(totalProducts/limit);
      const categoryWithIds = category.map((categories)=>({_id:categories,name:categories.name}))
  
       res.render('womenShop',{
        user : userData,
        products:products,
        category:categoryWithIds,
        totalProducts:totalProducts,
        currentPage:page,
        totalPages:totalPages
       })
       
    } catch (error) {
      res.redirect('/pageNotFound')
    }
  }
  
  
  const loadMenShopping = async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.redirect('/login'); // Redirect to login if user is not found
      }
  
      const userData = await User.findOne({ _id: user });
      const categories = await Category.find({ isListed: true, gender: 'Men'});
      console.log('Categories:', categories);
      if (!categories.length) {
        return res.render('menShope', {
          user: userData,
          products: [],
          category: [],
          totalProducts: 0,
          currentPage: 1,
          totalPages: 1,
        });
      }
  
      const categoryIds = categories.map(category => category._id.toString());
      const page = parseInt(req.query.page) || 1;
      const limit = 9;
      const skip = (page - 1) * limit;
  
      const products = await Product.find({
        isBlocked: false,
        category: { $in: categoryIds },
        totalQuantity: { $gt: 0 },
      })
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(limit);
  
      const totalProducts = await Product.countDocuments({
        isBlocked: false,
        category: { $in: categoryIds },
        totalQuantity: { $gt: 0 },
      });
  
      const totalPages = Math.ceil(totalProducts / limit);
      const categoriesList = categories.map(category => ({
        _id: category._id,
        name: category.name,
      }));
  
      res.render('menshope', {
        user: userData,
        products: products,
        category: categoriesList,
        totalProducts: totalProducts,
        currentPage: page,
        totalPages: totalPages,
      });
      console.log(products);  
    } catch (error) {
      console.error(error);
      res.redirect('/pageNotFound');
    }
  
  };
  
  

  module.exports={
    loadMenShopping,
    loadWomenShopping,
  }