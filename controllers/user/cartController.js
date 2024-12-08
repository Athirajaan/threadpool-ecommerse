const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");



const getCart = async (req, res) => {
  try {
    const userId = req.session.user; // Retrieve the user ID from the session
    if (!userId) {
      return res.redirect('/login'); // Redirect if the user is not logged in
    }

    // Fetch the user's cart
    const cart = await Cart.findOne({ userId }).populate('items.productId'); // Populate product details

    const items = cart ? cart.items : []; // If no cart, use an empty array
    res.render('cart', { items }); // Pass items to the cart template
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};



const addToCart = async (req, res) => {
  try {
    const userId = req.session.user; // Assuming you're using session for user authentication
    const { productId, quantity } = req.body; // Assuming you're sending the product ID and quantity in the request
    console.log(productId)
    const parsedQuantity = parseInt(quantity, 10);

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send("Product not found");
    }

    // Find the user's cart
    let cart = await Cart.findOne({ userId });

    // If cart doesn't exist, create a new one
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if the product is already in the cart
    const existingItem = cart.items.find(item => item.productId.toString() === productId);
    
    if (existingItem) {
      // Product is already in cart, just update the quantity
      existingItem.quantity +=  parsedQuantity;
      existingItem.totalPrice = existingItem.quantity * existingItem.salePrice;
      await cart.save();
      return res.send("Product already in the cart, quantity updated.");
    } else {
      // Product is not in cart, add it
      cart.items.push({
        productId,
        quantity: parsedQuantity,
        salePrice: product.salePrice,
        totalPrice: product.salePrice *  parsedQuantity,
      });
      await cart.save();
      return res.send("Product added to cart.");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};



module.exports = {
    getCart,
    addToCart, 
}