const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/adressScheme');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const Wallet = require('../../models/walletSchema');

const getOrder = async (req, res) => {
  try {
    const user = req.session.user;
    const orders = await Order.find({ user: user._id })
      .populate('orderedItems.product')
      .sort({ createdOn: -1 });

    // Even if no orders found, render the page with empty orders array
    const orderDetails = orders
      ? orders.map((order) => {
          return {
            orderId: order.orderId,
            orderDate: order.createdOn,
            orderedItems: order.orderedItems.map((item) => {
              return {
                product: item.product,
                productName: item.product?.productName,
                productImage: item.product?.productImage[0],
                price: item.price,
                size: item.size,
                quantity: item.quantity,
                status: item.status,
              };
            }),
            finalAmount: order.finalAmount,
          };
        })
      : [];

    // Always render the page, whether orders exist or not
    res.render('orderList', {
      orders: orderDetails,
      user,
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    // In case of error, still render the page but with empty orders
    res.render('orderList', {
      orders: [],
      user: req.session.user,
      error: 'Failed to fetch order details',
    });
  }
};

const CancelOrder = async (req, res) => {
  try {
    const { orderId, productId, quantity, size } = req.body;
    const userId = req.session.user._id;

    // Find the order by orderId
    const order = await Order.findOne({ orderId: orderId }).populate(
      'orderedItems.product'
    );
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Find the item in the order to cancel
    const item = order.orderedItems.find(
      (item) => item.product._id.toString() === productId && item.size === size
    );
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in the order',
      });
    }

  

    // Update product stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Convert both values to numbers before addition
    product.stock[size] = Number(product.stock[size]) + Number(quantity);
    product.totalQuantity = Number(product.totalQuantity) + Number(quantity);

    // If order was paid, process refund to wallet
    if (order.paymentStatus === 'Completed') {
      // Calculate refund amount
      let refundAmount = Math.floor(item.price * quantity);

      // If coupon was applied, adjust refund amount
      if (order.couponDiscount > 0) {
        const totalItems = order.orderedItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
        const perItemDiscount = Math.floor(order.couponDiscount / totalItems);
        refundAmount = Math.floor(refundAmount - perItemDiscount * quantity);
      }

      // Find or create wallet
      let wallet = await Wallet.findOne({ userId: userId });
      if (!wallet) {
        wallet = new Wallet({
          userId: userId,
          balance: 0,
          transactions: [],
        });
      }

      // Add refund to wallet
      wallet.balance += refundAmount;
      wallet.transactions.push({
        type: 'credit',
        amount: refundAmount,
        description: 'order_cancelled',
        date: new Date(),
      });

      await wallet.save();
    }

    // Update the order item status to 'Cancelled'
    item.status = 'Cancelled';

    // Save the changes
    await Promise.all([order.save(), product.save()]);

    // Send response
    res.json({
      success: true,
      message:
        order.paymentStatus === 'Paid'
          ? 'Order cancelled and refund added to wallet'
          : 'Order cancelled successfully',
      updatedItem: item,
      updatedProductStock: product.stock,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while cancelling the order',
    });
  }
};

const trackOrder = async (req, res) => {
  try {
    const orderId = decodeURIComponent(req.params.orderId);
    const productId = decodeURIComponent(req.params.productId);

    console.log('Track Order Request:', { orderId, productId });

    const order = await Order.findOne({ orderId }).populate(
      'orderedItems.product'
    );

    if (!order) {
      console.log('Order not found:', orderId);
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const orderedItem = order.orderedItems.find(
      (item) => item.product._id.toString() === productId
    );

    if (!orderedItem) {
      console.log('Product not found in order:', productId);
      return res.status(404).json({
        success: false,
        message: 'Product not found in order',
      });
    }

    const response = {
      success: true,
      productName: orderedItem.product.productName,
      orderDate: order.createdOn,
      status: orderedItem.status,
    };

    console.log('Sending response:', response);
    return res.json(response);
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking order',
    });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log('Received request for order:', orderId);

    // Find the order in your database
    const order = await Order.findOne({ orderId: orderId }).populate(
      'orderedItems.product'
    );

    if (!order) {
      console.log('Order not found:', orderId);
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Format the response
    const formattedOrder = {
      orderId: order.orderId,
      orderDate: order.orderDate,
      totalAmount: order.totalAmount,
      status: order.status,
      items: order.orderedItems.map((item) => ({
        productName: item.product.name,
        productImage: item.product.images[0], // Assuming first image
        quantity: item.quantity,
        size: item.size,
        price: item.price,
        status: item.status,
      })),
    };
    res.json(formattedOrder);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order details',
    });
  }
};

const returnOrder = async (req, res) => {
  try {
    const { orderId, productId, quantity, size, returnReason } = req.body;
    const userId = req.session.user._id;

    // Find the order
    const order = await Order.findOne({ orderId: orderId }).populate(
      'orderedItems.product'
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Find the specific item in the order
    const item = order.orderedItems.find(
      (item) => item.product._id.toString() === productId && item.size === size
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in the order',
      });
    }

    // Calculate refund amount (ensuring whole numbers)
    let refundAmount = Math.floor(item.price * quantity);

    // If coupon was applied to the order, adjust refund amount
    if (order.couponDiscount > 0) {
      // Calculate total number of items in order
      const totalItems = order.orderedItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      // Calculate per-item coupon discount (rounded down to ensure whole number)
      const perItemDiscount = Math.floor(order.couponDiscount / totalItems);

      // Subtract coupon discount from refund amount
      refundAmount = Math.floor(refundAmount - perItemDiscount * quantity);
    }

    // Ensure final amount is a whole number
    refundAmount = Math.floor(refundAmount);

    // Find or create user's wallet
    let wallet = await Wallet.findOne({ userId: userId });
    if (!wallet) {
      wallet = new Wallet({
        userId: userId,
        balance: 0,
        transactions: [],
      });
    }

    // Add refund to wallet
    wallet.balance += refundAmount;
    wallet.transactions.push({
      type: 'credit',
      amount: refundAmount,
      description: 'order_returned',
      date: new Date(),
    });

    // Update the item status to 'Returned'
    item.status = 'Returned';

    // Update product stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Increase product stock
    product.stock[size] = Number(product.stock[size]) + Number(quantity);
    product.totalQuantity = Number(product.totalQuantity) + Number(quantity);

    // Save all changes
    await Promise.all([order.save(), product.save(), wallet.save()]);

    // Send success response
    res.json({
      success: true,
      message: 'Return processed and refund added to wallet',
      updatedItem: item,
      updatedProductStock: product.stock,
      refundAmount: refundAmount,
    });
  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing the return request',
    });
  }
};

module.exports = {
  getOrder,
  CancelOrder,
  trackOrder,
  getOrderDetails,
  returnOrder,
};
