const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/adressScheme');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');

const getOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    const orders = await Order.find({ user: userId })
      .sort({ createdOn: -1 })
      .populate('orderedItems.product');

    console.log('First order sample:', JSON.stringify(orders[0], null, 2)); // Debug log

    if (!orders || orders.length === 0) {
      return res
        .status(404)
        .json({ message: 'No orders found for this user.' });
    }

    const orderDetails = orders.map((order) => {
      console.log('Processing order:', order.orderId); // Debug log
      return {
        orderId: order.orderId,
        orderDate: order.createdOn,
        orderedItems: order.orderedItems.map((item) => {
          console.log('Processing item:', item.product?._id); // Debug log
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
    });

    console.log(
      'Sample processed order:',
      JSON.stringify(orderDetails[0], null, 2)
    ); // Debug log

    res.render('orderList', {
      orders: orderDetails,
      user,
      debug: true, // Add this to enable detailed console logs in the template
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Failed to fetch order details.' });
  }
};

const getOrderedProductDtl = async (req, res) => {
  const { orderId, productId } = req.params;

  try {
    // Find the order by orderId
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Find the product in the orderedItems array by productId
    const product = order.orderedItems.find(
      (item) => item.productId === productId
    );

    if (!product) {
      return res
        .status(404)
        .json({ message: 'Product not found in this order' });
    }

    // Prepare the response with the necessary details
    const productDetails = {
      orderId: order.orderId,
      productId: product.productId,
      productName: product.productName,
      price: product.price,
      status: product.status,
      orderDate: order.orderDate, // Assuming 'orderDate' exists in your Order model
    };

    // Send the product details as the response
    return res.json(productDetails);
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const CancelOrder = async (req, res) => {
  try {
    const { orderId, productId, quantity, size } = req.body;

    // Find the order by orderId
    const order = await Order.findOne({ orderId: orderId }).populate(
      'orderedItems.product'
    );
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    // Find the item in the order to cancel
    const item = order.orderedItems.find(
      (item) => item.product._id.toString() === productId && item.size === size
    );
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: 'Item not found in the order' });
    }

    // Check if cancellation is possible based on the item status
    if (item.status !== 'Pending') {
      return res
        .status(400)
        .json({ success: false, message: 'This item cannot be cancelled' });
    }

    // Update product stock in the Product collection
    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' });
    }

    // Convert both values to numbers before addition
    product.stock[size] = Number(product.stock[size]) + Number(quantity);
    product.totalQuantity = Number(product.totalQuantity) + Number(quantity);

    // Save the product after updating stock
    await product.save();

    // Update the order item status to 'Cancelled'
    item.status = 'Cancelled';

    // Save the order after updating the item status
    await order.save();

    // Respond back with the updated order and product details
    res.json({
      success: true,
      message: 'Order cancelled successfully!',
      updatedItem: item, // Send updated item status
      updatedProductStock: product.stock, // Send updated product stock
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

module.exports = {
  getOrder,
  getOrderedProductDtl,
  CancelOrder,
  trackOrder,
};
