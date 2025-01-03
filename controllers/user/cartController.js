const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/adressScheme');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const razorpay = require('../../config/razorpay');
const Coupon = require('../../models/couponSchema');
const CouponUsage = require('../../models/couponUsageSchema');
const { calculatePrice } = require('../../utils/priceCalculator');
const Wallet = require('../../models/walletSchema');

const getCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: {
          path: 'category',
        },
      })
      .populate('items.offer')
      .populate('appliedCoupon');

    // If no cart exists, render empty cart with default values
    if (!cart) {
      return res.render('cart', {
        items: [],
        totalAmount: 0,
        totalMRP: 0,
        discountOnMRP: 0,
        cart: {
          appliedCoupon: null,
          couponDiscount: 0,
        }, // Provide default cart object
        hasOutOfStockItems: false,
        finalAmount: 0,
      });
    }

    // Check stock and calculate prices
    let hasOutOfStockItems = false;
    let totalMRP = 0;

    for (let item of cart.items) {
      // Check stock
      const product = await Product.findById(item.productId._id);
      const stockAvailable = product.stock[item.size] || 0;
      if (stockAvailable < item.quantity) {
        hasOutOfStockItems = true;
        item.isOutOfStock = true;
      } else {
        item.isOutOfStock = false;
      }

      // Calculate price with offers
      const priceDetails = await calculatePrice(
        item.productId,
        item.productId.category
      );

      // Set price without size adjustment
      item.salePrice = priceDetails.finalPrice;
      item.totalPrice = priceDetails.finalPrice * item.quantity;
      item.offer = priceDetails.offer;

      // Add to total MRP
      totalMRP += item.productId.regularPrice * item.quantity;
    }

    // Calculate all totals
    cart.totalCartPrice = cart.items.reduce((total, item) => {
      return total + item.totalPrice;
    }, 0);

    const discountOnMRP = totalMRP - cart.totalCartPrice;
    cart.finalAmount = cart.totalCartPrice - (cart.couponDiscount || 0);

    await cart.save();

    res.render('cart', {
      items: cart.items,
      totalAmount: cart.totalCartPrice,
      finalAmount: cart.finalAmount,
      cart: cart, // cart object is now guaranteed to exist
      totalMRP: totalMRP,
      discountOnMRP: discountOnMRP,
      couponDiscount: cart.couponDiscount || 0,
      appliedCoupon: cart.appliedCoupon,
      hasOutOfStockItems: hasOutOfStockItems,
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).redirect('/pageNotFound');
  }
};

const addToCart = async (req, res) => {
  try {
    const { productId, selectedSize, quantity = 1 } = req.body;
    const userId = req.session.user;

    // Find the product and calculate price with offers
    const product = await Product.findById(productId).populate('category');
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' });
    }

    // Check if the product has stock information
    if (!product.stock || !product.stock[selectedSize]) {
      return res.status(400).json({
        success: false,
        message: 'Size not available',
      });
    }

    // Check stock availability with proper stock access
    const availableStock = product.stock[selectedSize];
    if (availableStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} items available in this size`,
      });
    }

    // Calculate price with offers
    const priceDetails = await calculatePrice(product, product.category);
    const finalPrice = priceDetails.finalPrice; // Remove size-based adjustment

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // Create new cart if it doesn't exist
      cart = new Cart({
        userId,
        items: [
          {
            productId,
            quantity,
            size: selectedSize,
            salePrice: finalPrice,
            totalPrice: finalPrice * quantity,
            offer: priceDetails.offer ? priceDetails.offer._id : null,
          },
        ],
        totalCartPrice: finalPrice * quantity,
        finalAmount: finalPrice * quantity,
      });
    } else {
      // Check if product with same size exists
      const existingItemIndex = cart.items.findIndex(
        (item) =>
          item.productId.toString() === productId && item.size === selectedSize
      );

      if (existingItemIndex > -1) {
        // Check if new quantity exceeds stock
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;
        if (availableStock < newQuantity) {
          return res.status(400).json({
            success: false,
            message: `Cannot add more items. Only ${availableStock} available in stock.`,
          });
        }

        // Update existing item
        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].salePrice = finalPrice;
        cart.items[existingItemIndex].totalPrice = finalPrice * newQuantity;
        cart.items[existingItemIndex].offer = priceDetails.offer
          ? priceDetails.offer._id
          : null;
      } else {
        // Add new item
        cart.items.push({
          productId,
          quantity,
          size: selectedSize,
          salePrice: finalPrice,
          totalPrice: finalPrice * quantity,
          offer: priceDetails.offer ? priceDetails.offer._id : null,
        });
      }

      // Recalculate total cart price
      cart.totalCartPrice = cart.items.reduce((total, item) => {
        return total + item.totalPrice;
      }, 0);

      cart.finalAmount = cart.totalCartPrice - (cart.couponDiscount || 0);
    }

    await cart.save();

    res.json({
      success: true,
      message: 'Product added to cart successfully',
      cartCount: cart.items.length,
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding product to cart',
    });
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

    // Fetch user's phone number and wallet
    const user = await User.findById(userId).select('phone');
    const wallet = await Wallet.findOne({ userId });

    if (!user) {
      return res.status(404).send('User not found');
    }

    const addressData = await Address.find({ UserId: userId });
    const addresses = addressData.flatMap((data) => data.address);

    // Fetch cart details and populate product details and coupon
    const cart = await Cart.findOne({ userId })
      .populate('items.productId')
      .populate('appliedCoupon');
    const items = cart ? cart.items : [];

    // Map cart items with offer prices
    const cartItems = await Promise.all(
      items.map(async (item) => {
        const priceDetails = await calculatePrice(
          item.productId,
          item.productId.category
        );
        return {
          productImage: item.productId.productImage[0],
          salePrice: priceDetails.finalPrice,
          quantity: item.quantity,
          totalPrice: priceDetails.finalPrice * item.quantity,
        };
      })
    );

    // Calculate price details with offers
    const totalMRP = items.reduce(
      (total, item) => total + item.productId.regularPrice * item.quantity,
      0
    );
    const totalCartPrice = cartItems.reduce(
      (total, item) => total + item.totalPrice,
      0
    );
    const discountOnMRP = totalMRP - totalCartPrice;
    const shippingFee = 0;

    // Calculate final amount considering coupon discount
    let finalAmount = totalCartPrice;
    if (cart && cart.appliedCoupon && cart.couponDiscount) {
      finalAmount = totalCartPrice - cart.couponDiscount;
    }
    finalAmount += shippingFee;

    // Check if wallet balance is sufficient
    const walletBalance = wallet ? wallet.balance : 0;
    const isWalletSufficient = walletBalance >= finalAmount;

    res.render('checkOut', {
      phoneNumber: user.phone,
      addresses,
      cartItems,
      totalMRP,
      discountOnMRP,
      totalCartPrice,
      shippingFee,
      finalAmount,
      appliedCoupon: cart?.appliedCoupon,
      couponDiscount: cart?.couponDiscount || 0,
      walletBalance,
      isWalletSufficient,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

async function generateOrderId() {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let orderId;
  let isUnique = false;

  while (!isUnique) {
    // Generate random part
    let randomPart = '';
    const randomLength = Math.floor(Math.random() * 4) + 3;
    for (let i = 0; i < randomLength; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Add timestamp part
    const timestampPart = Date.now().toString(36).slice(-2);

    // Combine parts
    orderId = `#${randomPart}${timestampPart}`;

    // Check if this orderId already exists in database
    const existingOrder = await Order.findOne({ orderId });
    if (!existingOrder) {
      isUnique = true;
    }
  }

  return orderId;
}

// function generateOrderId() {
//   const chars =
//     'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
//   let randomPart = '';
//   const randomLength = Math.floor(Math.random() * 4) + 3;
//   for (let i = 0; i < randomLength; i++) {
//     randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
//   }
//   const timestampPart = Date.now().toString(36).slice(-2);

//   const orderId = `#${randomPart}${timestampPart}`;
//   return orderId;
// }

const generateInvoiceId = () => {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000000);
  return `${timestamp}-${randomNum}`;
};

const createOrder = async (req, res) => {
  try {
    const { phoneNumber, address, paymentMethod } = req.body;

    if (!req.session.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = req.session.user;
    const userCart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: {
          path: 'category',
        },
      })
      .populate('appliedCoupon');

    if (!userCart || userCart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty or not found' });
    }

    // Handle wallet payment
    if (paymentMethod === 'Wallet') {
      try {
        const wallet = await Wallet.findOne({ userId: req.session.user });

        if (!wallet) {
          return res.status(400).json({
            success: false,
            message: 'Wallet not found',
          });
        }

        if (wallet.balance < userCart.finalAmount) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient wallet balance',
          });
        }

        // Deduct from wallet
        wallet.balance -= userCart.finalAmount;
        wallet.transactions.push({
          type: 'debit',
          amount: userCart.finalAmount,
          description: 'order_placed',
          date: new Date(),
        });

        await wallet.save();

        // Create order with all required fields
        const newOrder = new Order({
          user: req.session.user,
          orderId: await generateOrderId(),
          orderedItems: userCart.items.map((item) => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.salePrice,
            size: item.size,
            status: 'Pending',
          })),
          phoneNumber: phoneNumber,
          finalAmount: userCart.finalAmount,
          address: address,
          paymentMethod: 'Wallet',
          status: 'Pending',
          paymentStatus: 'Completed',
          invoice: {
            invoiceId: generateInvoiceId(),
            dateGenerated: Date.now(),
          },
          couponApplied: userCart.appliedCoupon ? true : false,
          appliedCoupon: userCart.appliedCoupon || null,
          couponDiscount: userCart.couponDiscount || 0,
        });

        await newOrder.save();

        // Clear cart
        await Cart.findOneAndUpdate(
          { userId: req.session.user },
          {
            items: [],
            totalCartPrice: 0,
            finalAmount: 0,
            appliedCoupon: null,
            couponDiscount: 0,
          }
        );

        return res.status(200).json({
          success: true,
          message: 'Order placed successfully',
          orderId: newOrder.orderId,
        });
      } catch (error) {
        console.error('Wallet payment error:', error);
        return res.status(500).json({
          success: false,
          message: 'Error processing wallet payment',
        });
      }
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

    // Calculate final prices with offers for each item
    const orderedItems = await Promise.all(
      userCart.items.map(async (item) => {
        const priceDetails = await calculatePrice(
          item.productId,
          item.productId.category
        );
        return {
          product: item.productId._id,
          quantity: item.quantity,
          price: priceDetails.finalPrice,
          size: item.size,
          status: 'Pending',
        };
      })
    );

    // Calculate total amount with offers
    const finalAmount =
      orderedItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      ) - (userCart.couponDiscount || 0);

    // Create new order with the calculated prices
    const newOrder = new Order({
      user: userId,
      orderId: await generateOrderId(),
      orderedItems,
      phoneNumber,
      finalAmount: userCart.finalAmount,
      address,
      paymentMethod,
      status: 'Pending',
      paymentStatus:
        paymentMethod === 'wallet'
          ? 'Completed'
          : paymentMethod === 'Razorpay'
            ? 'Completed'
            : 'Pending',
      invoice: {
        invoiceId: generateInvoiceId(),
        dateGenerated: Date.now(),
      },
      couponApplied: userCart.appliedCoupon ? true : false,
      appliedCoupon: userCart.appliedCoupon || null,
      couponDiscount: userCart.couponDiscount || 0,
      ...(paymentMethod === 'Razorpay' && {
        razorpayDetails: {
          orderId: req.body.razorpay_order_id,
          paymentId: req.body.razorpay_payment_id,
        },
      }),
    });

    await newOrder.save();

    // Keep all existing stock update logic
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
      } catch (error) {
        console.error(
          `Error updating stock for product ${item.productId._id}:`,
          error
        );
        throw error;
      }
    });

    await Promise.all(stockUpdatePromises);

    // Keep existing coupon usage logic
    if (userCart.appliedCoupon) {
      // Find or create coupon usage record
      let couponUsage = await CouponUsage.findOne({
        userId: userId,
        couponId: userCart.appliedCoupon,
      });

      if (couponUsage) {
        // Increment existing usage
        await CouponUsage.findByIdAndUpdate(couponUsage._id, {
          $inc: { usageCount: 1 },
          lastUsed: Date.now(),
          orderId: newOrder._id,
        });
      } else {
        // Create first usage record
        couponUsage = new CouponUsage({
          userId: userId,
          couponId: userCart.appliedCoupon,
          usageCount: 1,
          lastUsed: Date.now(),
          orderId: newOrder._id,
        });
        await couponUsage.save();
      }
    }

    // Clear the cart
    await Cart.findOneAndUpdate(
      { userId },
      {
        items: [],
        totalCartPrice: 0,
        finalAmount: 0,
        appliedCoupon: null,
        couponDiscount: 0,
      }
    );

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
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

    const order = await razorpay.orders.create(options);

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

const getEligibleCoupons = async (req, res) => {
  try {
    const cartTotal = req.body.cartTotal; // Total cart amount

    // Fetch active coupons where minPurchase is less than or equal to cart total
    const eligibleCoupons = await Coupon.find({
      isActive: true,
      minPurchase: { $lte: cartTotal },
      expireOn: { $gt: new Date() }, // Only get non-expired coupons
    }).select('name couponType discountPrice maximumPrice');

    res.json({
      success: true,
      coupons: eligibleCoupons,
    });
  } catch (error) {
    console.error('Error fetching eligible coupons:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupons',
    });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, cartTotal } = req.body;
    const userId = req.session.user;

    // Find the cart and coupon
    const cart = await Cart.findOne({ userId });
    const coupon = await Coupon.findOne({
      name: couponCode,
      isActive: true,
      minPurchase: { $lte: cartTotal },
      expireOn: { $gt: new Date() },
    });

    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired coupon',
      });
    }

    let discountAmount = 0;

    if (coupon.couponType === 'percentage') {
      discountAmount = Math.round((cartTotal * coupon.discountPrice) / 100);
      if (discountAmount > coupon.maximumPrice) {
        discountAmount = Math.round(coupon.maximumPrice);
      }
    } else {
      discountAmount = Math.round(coupon.discountPrice);
    }

    const finalAmount = Math.round(cartTotal - discountAmount);

    // Update cart with coupon details and final amount
    await Cart.findOneAndUpdate(
      { userId },
      {
        appliedCoupon: coupon._id,
        couponDiscount: discountAmount,
        finalAmount: finalAmount,
        totalCartPrice: cartTotal,
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      discountAmount: discountAmount,
      finalAmount: finalAmount,
    });
  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply coupon',
    });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    // Reset cart's coupon-related fields
    const updatedCart = await Cart.findOneAndUpdate(
      { userId },
      {
        $unset: { appliedCoupon: '' },
        $set: {
          couponDiscount: 0,
          finalAmount: cart.totalCartPrice, // Reset to original total
        },
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Coupon removed successfully',
      finalAmount: updatedCart.totalCartPrice,
    });
  } catch (error) {
    console.error('Error removing coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove coupon',
    });
  }
};

const loadCart = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId })
      .populate('items.productId')
      .populate('appliedCoupon');

    // ... your existing cart calculations ...

    res.render('cart', {
      items: cart.items,
      totalMRP,
      discountOnMRP,
      finalAmount,
      hasOutOfStockItems,
      appliedCoupon: cart.appliedCoupon,
      couponDiscount: cart.couponDiscount,
    });
  } catch (error) {
    console.error('Error loading cart:', error);
    res.status(500).send('Internal Server Error');
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
  getEligibleCoupons,
  applyCoupon,
  removeCoupon,
  loadCart,
};
