const Product = require('../../models/productSchema');
const Category =require('../../models/categorySchema');
const User =require('../../models/userSchema');




const productDetails = async (req,res)=>{
    try {
        
        const userId= req.session.user;
        const isLoggedIn = req.session && req.session.user; 
        const userData = await User.findById(userId);
        const productId = req.query.id;
        const product = await Product.findById(productId).populate('category')
        const findCategory =product.category;
        res.render("product-details", { product, isLoggedIn })

    } catch (error) {
        res.redirect('/page-404')
    }
}


const getPrice = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).send('Product not found');
        res.render('product', { product });
    } catch (error) {
        res.status(500).send('Server Error');
    }
}







module.exports = {
    productDetails,
    getPrice,

}