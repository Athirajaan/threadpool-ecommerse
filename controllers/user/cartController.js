const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Address = require('../../models/adressScheme');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require("uuid");  




const getCart = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect('/login'); 
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId'); 
    const items = cart ? cart.items : []; 
    const totalMRP = items.reduce(
      (total, item) => total + item.productId.regularPrice * item.quantity,
      0
    );
    const totalCartPrice = cart ? cart.totalCartPrice : 0;
    const discountOnMRP = totalMRP - totalCartPrice;

    const platformFee = 5;
    const shippingFee = 0; 
    const  finalAmount = totalCartPrice + platformFee 
    
    res.render('cart', {items, totalMRP, discountOnMRP, totalCartPrice, platformFee, shippingFee,finalAmount });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};




const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity, selectedSize } = req.body;

    const parsedQuantity = parseInt(quantity, 10);
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    if (!product.stock[selectedSize]) {
      return res.status(400).send(`Size ${selectedSize} is not available for this product.`);
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check existing cart item for the same product and size
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId && item.size === selectedSize
    );

    if (existingItem) {
      // Total quantity including new addition
      const newQuantity = existingItem.quantity + parsedQuantity;

      // Check stock and max quantity constraints
      if (newQuantity > 5) {
        return res.status(400).send("Cannot add more than 5 of the same product to the cart.");
      }
      if (newQuantity > product.stock[selectedSize]) {
        return res
          .status(400)
          .send(`Only ${product.stock[selectedSize] - existingItem.quantity} items left in stock for size ${selectedSize}.`);
      }

      existingItem.quantity = newQuantity;
      existingItem.totalPrice = existingItem.quantity * product.salePrice;
    } else {
      // For new cart item
      if (parsedQuantity > product.stock[selectedSize]) {
        return res
          .status(400)
          .send(`Only ${product.stock[selectedSize]} items available in stock for size ${selectedSize}.`);
      }
      if (parsedQuantity > 5) {
        return res.status(400).send("Cannot add more than 5 of the same product to the cart.");
      }

      cart.items.push({
        productId,
        size: selectedSize,
        quantity: parsedQuantity,
        salePrice: product.salePrice,
        totalPrice: product.salePrice * parsedQuantity,
      });
    }

    // Update total cart price
    cart.totalCartPrice = cart.items.reduce(
      (total, item) => total + item.totalPrice,
      0
    );

    await cart.save();
    res.send("Cart updated successfully.");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};





const getStock = async (req,res)=>{
  const { itemId, size } = req.params;

  const product = await Product.findById(itemId);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  res.json({ stock: product.stock[size] });
}



const updateCartquantity = async (req, res) => {
  try {
    const { itemId, itemSize, quantity } = req.body;
    console.log("Request Data:", { itemId, itemSize, quantity });

    // Convert itemId to ObjectId to ensure consistent comparison
    const itemObjectId = new mongoose.Types.ObjectId(itemId);

    const cart = await Cart.findOne({ userId: req.session.user }).populate('items.productId');
    if (!cart) {
      console.error("Cart not found for user:", req.session.user);
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const item = cart.items.find(
      (i) => i.productId._id.equals(itemObjectId) && i.size === itemSize
    );
    if (!item) {
      console.error("Item not found in cart:", { itemId, itemSize });
      return res.status(404).json({ success: false, message: "Item not found in cart" });
    }

    const product = item.productId;
    if (!product) {
      console.error("Product not found:", itemId);
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    console.log("Product Details:", {
      id: product._id,
      regularPrice: product.regularPrice,
      stock: product.stock
    });

    console.log("Product Stock for size:", product.stock[itemSize]);
    const availableStock = product.stock[itemSize];
    if (quantity > availableStock) {
      console.error("Quantity exceeds available stock:", { quantity, availableStock });
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} available`,
      });
    }

    item.quantity = quantity;
    item.totalPrice = item.salePrice * quantity;
    await cart.save();
    console.log("Cart updated successfully for item:", item);

    const totalMRP = cart.items.reduce((total, cartItem) => {
      const regularPrice = cartItem.productId.regularPrice;
      const itemQuantity = cartItem.quantity;
    
      console.log("Item MRP Calculation:", {
        productId: cartItem.productId._id,
        regularPrice,
        quantity: itemQuantity
      });

      if (typeof regularPrice !== 'number' || typeof itemQuantity !== 'number') {
        console.error("Invalid price or quantity:", { regularPrice, itemQuantity });
        return total; // Skip this item if invalid
      }
    
      return total + (regularPrice * itemQuantity);
    }, 0);
    
    const totalCartPrice = typeof cart.totalCartPrice === 'number' ? cart.totalCartPrice : 0;
    const discountOnMRP = totalMRP - totalCartPrice;
    
    const platformFee = 5;
    const finalAmount = totalCartPrice + platformFee;
    
    console.log("Total MRP:", totalMRP);
    console.log("Discount on MRP:", discountOnMRP);
    console.log("Final Amount:", finalAmount);

    res.json({ 
      success: true, 
      message: "Cart updated successfully",
      totalPrice: item.totalPrice,
      regularPrice: product.regularPrice,
      totalMRP,
      discountOnMRP,
      finalAmount
    });
  } catch (error) {
    console.error("Error in updating cart quantity:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const getCheckOut = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect('/login'); 
    }

    // Fetch user's phone number
    const user = await User.findById(userId).select('phone');
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Fetch all addresses
    const addressData = await Address.find({ UserId: userId });
    const addresses = addressData.flatMap(data => data.address);
    
   
    // Fetch cart details and populate product details
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const items = cart ? cart.items : [];

    // Map cart items for required details, including the product image
    const cartItems = items.map(item => ({
      productImage: item.productId.productImage[0],  // Get the first image in the array
      salePrice: item.productId.salePrice,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
    }));

    // Calculate price details
    const totalMRP = items.reduce(
      (total, item) => total + item.productId.regularPrice * item.quantity,
      0
    );
    const totalCartPrice = cart ? cart.totalCartPrice : 0;
    const discountOnMRP = totalMRP - totalCartPrice; 
    const platformFee = 5; // Static platform fee
    const shippingFee = 0; // Static shipping fee
    const finalAmount = totalCartPrice + platformFee + shippingFee; 

    // Render checkout page
    res.render("checkOut", {
      phoneNumber: user.phone,
      addresses ,
      cartItems,
      totalMRP,
      discountOnMRP,
      totalCartPrice,
      platformFee,
      shippingFee,
      finalAmount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};


const createOrder = async (req, res) => {
  try {
    const { orderedItems, phoneNumber, finalAmount, address, paymentMethod } = req.body;
    
    // Validate user authentication
    if (!req.session.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Generate invoice details
    const invoiceDetails = {
      invoiceId: uuidv4(),
      dateGenerated: new Date(),
    };

    // Create new order
    const newOrder = new Order({
      user: req.session.user._id,
      orderedItems,
      phoneNumber,
      finalAmount,
      address,
      paymentMethod,
      status: 'Pending',
      paymentStatus: 'Pending',
      invoice: invoiceDetails,
      couponApplied: false
    });

    await newOrder.save();

    // Optional: Clear cart after successful order
    await Cart.findOneAndUpdate(
      { userId: req.session.user._id },
      { items: [], totalCartPrice: 0 }
    );

    res.status(201).json({
      message: 'Order placed successfully',
      orderId: newOrder._id
    });
  } catch (error) {
    console.error('Order creation error:', error);
    
    res.status(500).json({ 
      message: 'Error creating order', 
      error: error.message,
      details: error.errors ? Object.keys(error.errors).map(key => error.errors[key].message) : []
    });
  }
};

module.exports = {
    getCart,
    addToCart,
    getStock,
    updateCartquantity,
    getCheckOut,
    createOrder, 
}