const Cart = require('../models/cartSchema'); 

const cartQuantityMiddleware = async (req, res, next) => {
  if (req.session.user) {
    try {
      const userId = req.session.user;
      const cart = await Cart.findOne({ userId });

      // Calculate total quantity of items in the cart
      const cartQuantity = cart
        ? cart.items.reduce((total, item) => total + item.quantity, 0)
        : 0;

      // Make cartQuantity available to all views
      res.locals.cartQuantity = cartQuantity;
    } catch (error) {
      console.error('Error fetching cart quantity:', error);
      res.locals.cartQuantity = 0; // Default to 0 if there's an error
    }
  } else {
    res.locals.cartQuantity = 0; // Default to 0 if user is not logged in
  }
  next();
};

module.exports = {
  cartQuantityMiddleware,
 
};
