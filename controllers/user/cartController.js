const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/adressScheme');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const razorpay = require('../../config/razorpay');

const getCart = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect('/login');
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    const items = cart ? cart.items : [];

    // Check stock availability for each item
    const itemsWithStockStatus = items.map((item) => ({
      ...item.toObject(),
      isOutOfStock:
        !item.productId.stock[item.size] ||
        item.productId.stock[item.size] < item.quantity,
    }));

    const hasOutOfStockItems = itemsWithStockStatus.some(
      (item) => item.isOutOfStock
    );

    const totalMRP = items.reduce(
      (total, item) => total + item.productId.regularPrice * item.quantity,
      0
    );
    const totalCartPrice = cart ? cart.totalCartPrice : 0;
    const discountOnMRP = totalMRP - totalCartPrice;

    const shippingFee = 0;
    const finalAmount = totalCartPrice;

    res.render('cart', {
      items: itemsWithStockStatus,
      totalMRP,
      discountOnMRP,
      totalCartPrice,
      shippingFee,
      finalAmount,
      hasOutOfStockItems,
    });
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
      return res.status(404).send('Product not found');
    }

    if (!product.stock[selectedSize]) {
      return res
        .status(400)
        .send(`Size ${selectedSize} is not available for this product.`);
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check existing cart item for the same product and size
    const existingItem = cart.items.find(
      (item) =>
        item.productId.toString() === productId && item.size === selectedSize
    );

    if (existingItem) {
      // Total quantity including new addition
      const newQuantity = existingItem.quantity + parsedQuantity;

      // Check stock and max quantity constraints
      if (newQuantity > 5) {
        return res
          .status(400)
          .send('Cannot add more than 5 of the same product to the cart.');
      }
      if (newQuantity > product.stock[selectedSize]) {
        return res
          .status(400)
          .send(
            `Only ${existingItem.quantity} items left in stock for size ${selectedSize}.`
          );
      }

      existingItem.quantity = newQuantity;
      existingItem.totalPrice = existingItem.quantity * product.salePrice;
    } else {
      // For new cart item
      if (parsedQuantity > product.stock[selectedSize]) {
        return res
          .status(400)
          .send(
            `Only ${product.stock[selectedSize]} items available in stock for size ${selectedSize}.`
          );
      }
      if (parsedQuantity > 5) {
        return res
          .status(400)
          .send('Cannot add more than 5 of the same product to the cart.');
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
    res.send('Cart updated successfully.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};

const getStock = async (req, res) => {
  const { itemId, size } = req.params;

  const product = await Product.findById(itemId);
  if (!product)
    return res
      .status(404)
      .json({ success: false, message: 'Product not found' });

  res.json({ stock: product.stock[size] });
};

const updateCartquantity = async (req, res) => {
  try {
    const { itemId, itemSize, quantity } = req.body;
    const itemObjectId = new mongoose.Types.ObjectId(itemId);

    const cart = await Cart.findOne({ userId: req.session.user }).populate(
      'items.productId'
    );
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: 'Cart not found' });
    }

    const item = cart.items.find(
      (i) => i.productId._id.equals(itemObjectId) && i.size === itemSize
    );
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: 'Item not found in cart' });
    }

    // Update quantity and calculate new total price
    item.quantity = quantity;
    item.totalPrice = item.salePrice * quantity;

    // Recalculate cart totals
    cart.totalCartPrice = cart.items.reduce(
      (total, item) => total + item.totalPrice,
      0
    );
    await cart.save();

    // Calculate updated values
    const totalMRP = cart.items.reduce(
      (total, item) => total + item.productId.regularPrice * item.quantity,
      0
    );
    const discountOnMRP = totalMRP - cart.totalCartPrice;
    const finalAmount = cart.totalCartPrice;

    res.json({
      success: true,
      totalPrice: item.totalPrice,
      regularPrice: item.productId.regularPrice,
      totalMRP,
      discountOnMRP,
      finalAmount,
    });
  } catch (error) {
    console.error('Error in updating cart quantity:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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
      return res.status(404).send('User not found');
    }

    const addressData = await Address.find({ UserId: userId });
    const addresses = addressData.flatMap((data) => data.address);

    // Fetch cart details and populate product details
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    const items = cart ? cart.items : [];

    // Map cart items for required details, including the product image
    const cartItems = items.map((item) => ({
      productImage: item.productId.productImage[0],
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
    const shippingFee = 0; // Static shipping fee
    const finalAmount = totalCartPrice + shippingFee;

    // Render checkout page
    res.render('checkOut', {
      phoneNumber: user.phone,
      addresses,
      cartItems,
      totalMRP,
      discountOnMRP,
      totalCartPrice,
      shippingFee,
      finalAmount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

function generateOrderId() {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  const randomLength = Math.floor(Math.random() * 4) + 3;
  for (let i = 0; i < randomLength; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const timestampPart = Date.now().toString(36).slice(-2);

  const orderId = `#${randomPart}${timestampPart}`;
  return orderId;
}

const generateInvoiceId = () => {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000000);
  return `${timestamp}-${randomNum}`;
};

const createOrder = async (req, res) => {
  try {
    const { phoneNumber, finalAmount, address, paymentMethod } = req.body;

    if (!req.session.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = req.session.user;
    const userCart = await Cart.findOne({ userId }).populate('items.productId');

    if (!userCart || userCart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty or not found' });
    }

    // Verify Razorpay payment if applicable
    if (paymentMethod === 'Razorpay') {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
        req.body;

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: 'Razorpay payment details are missing',
        });
      }

      const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSign = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(sign)
        .digest('hex');

      if (expectedSign !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment signature',
        });
      }
    }

    // First, verify stock availability for all items
    for (const cartItem of userCart.items) {
      const product = await Product.findById(cartItem.productId._id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${cartItem.productId.productName}`,
        });
      }

      const availableStock = product.stock[cartItem.size] || 0;

      if (availableStock < cartItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.productName} in size ${cartItem.size}. Available: ${availableStock}, Requested: ${cartItem.quantity}`,
        });
      }
    }

    // Generate order details
    const orderId = generateOrderId();
    const invoiceDetails = {
      invoiceId: generateInvoiceId(),
      dateGenerated: Date.now(),
    };

    // Create ordered items array
    const orderedItems = userCart.items.map((item) => ({
      product: item.productId._id,
      quantity: item.quantity,
      price: item.salePrice,
      size: item.size,
      status: 'Pending',
    }));

    // Create the order
    const newOrder = new Order({
      user: userId,
      orderId,
      orderedItems,
      phoneNumber,
      finalAmount,
      address,
      paymentMethod,
      status: 'Pending',
      paymentStatus: paymentMethod === 'Razorpay' ? 'Completed' : 'Pending',
      invoice: invoiceDetails,
      couponApplied: false,
      ...(paymentMethod === 'Razorpay' && {
        razorpayDetails: {
          orderId: req.body.razorpay_order_id,
          paymentId: req.body.razorpay_payment_id,
        },
      }),
    });

    // Save the order first
    await newOrder.save();

    // Update stock for each product
    const stockUpdatePromises = userCart.items.map(async (item) => {
      try {
        const product = await Product.findById(item.productId._id);

        // Reduce the stock for the specific size
        product.stock[item.size] -= item.quantity;

        // Recalculate total quantity
        product.totalQuantity = Object.values(product.stock).reduce(
          (sum, qty) => sum + qty,
          0
        );

        // Update product status based on new total quantity
        product.status =
          product.totalQuantity === 0
            ? 'out of stock'
            : product.totalQuantity < 5
              ? 'limited stock'
              : 'Available';

        await product.save();

        console.log(
          `Updated stock for product ${product._id}, size ${item.size}, new quantity: ${product.stock[item.size]}`
        );
      } catch (error) {
        console.error(
          `Error updating stock for product ${item.productId._id}:`,
          error
        );
        throw error;
      }
    });

    // Wait for all stock updates to complete
    await Promise.all(stockUpdatePromises);

    // Clear the cart
    await Cart.findOneAndUpdate(
      { userId },
      { items: [], totalCartPrice: 0, finalAmount: 0 }
    );

    // Send success response
    res.status(201).json({
      success: true,
      message: 'Order placed successfully and stock updated',
      orderId: newOrder.orderId,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message,
    });
  }
};

const removeOne = async (req, res) => {
  console.log(req.body);
  const { productId, size } = req.body;
  const userId = req.session.userId;

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    const filteredItems = cart.items.filter(
      (item) => !(item.productId.toString() === productId && item.size === size)
    );

    cart.items = filteredItems;
    await cart.save();

    res.status(200).json({ message: 'Item removed successfully', cart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to remove item from cart' });
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    const deletedCart = await Cart.findOneAndDelete({ userId });

    if (!deletedCart) {
      return res.status(404).json({ message: 'Cart not found for the user' });
    }

    res.status(200).json({ message: 'Cart cleared successfully', deletedCart });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res
      .status(500)
      .json({ message: 'An error occurred while clearing the cart' });
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 100) {
      // Minimum amount validation (in paise)
      return res.status(400).json({
        success: false,
        message: 'Invalid amount',
      });
    }

    const options = {
      amount: Math.round(amount), // amount in paise
      currency: 'INR',
      receipt: 'order_' + Date.now(),
    };

    console.log('Creating Razorpay order with options:', options);

    const order = await razorpay.orders.create(options);

    console.log('Razorpay order created:', order);

    res.json({
      success: true,
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Razorpay order',
      error: error.message,
    });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // Create the signature verification string
    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;

    // Create the expected signature using crypto
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest('hex');

    // Verify the signature
    const isAuthentic = expectedSign === razorpay_signature;

    if (isAuthentic) {
      // Payment verification successful
      res.json({
        success: true,
        message: 'Payment verified successfully',
      });
    } else {
      // Payment verification failed
      res.json({
        success: false,
        message: 'Payment verification failed',
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during payment verification',
      error: error.message,
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
  removeOne,
  clearCart,
  createRazorpayOrder,
  verifyRazorpayPayment,
};
