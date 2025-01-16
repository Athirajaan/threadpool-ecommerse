const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/adressScheme');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const Wallet = require('../../models/walletSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const getOrder = async (req, res) => {
  try {
    const user = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // Orders per page
    const skip = (page - 1) * limit;

    // Get total count of orders
    const totalOrders = await Order.countDocuments({ user: user._id });
    const totalPages = Math.ceil(totalOrders / limit);

    // Fetch orders with pagination
    const orders = await Order.find({ user: user._id })
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage stock status',
      })
      .populate({
        path: 'address',
        model: 'Address',
        select: 'address UserId',
      })
      .populate('appliedCoupon')
      .populate('user', 'name email')
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    const orderDetails = orders
      ? orders.map((order) => {
          // Debug log
          console.log('Processing order address:', order.address);

          // Get the default address from the populated address document
          const deliveryAddress =
            order.address?.address?.find((addr) => addr.isDefault) ||
            order.address?.address?.[0];

          return {
            orderId: order.orderId,
            orderDate: order.createdOn,
            orderedItems: order.orderedItems.map((item) => ({
              product: item.product,
              productName: item.product?.productName,
              productImage: item.product?.productImage[0],
              price: item.price,
              size: item.size,
              quantity: item.quantity,
              status: item.status,
            })),
            // Format address data
            address: deliveryAddress
              ? {
                  name: deliveryAddress.name,
                  addressType: deliveryAddress.addressType,
                  city: deliveryAddress.city,
                  landMark: deliveryAddress.landMark,
                  state: deliveryAddress.state,
                  pincode: deliveryAddress.pincode,
                }
              : null,
            phoneNumber: order.phoneNumber,
            user: order.user,
            finalAmount: order.finalAmount,
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            couponApplied: order.couponApplied,
            couponDiscount: order.couponDiscount,
            appliedCoupon: order.appliedCoupon,
            invoice: order.invoice,
            createdAt: order.createdOn,
            updatedAt: order.updatedAt,
            discount: order.discount,
          };
        })
      : [];

    res.render('orderList', {
      orders: orderDetails,
      user,
      currentPage: page,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      lastPage: totalPages,
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.render('orderList', {
      orders: [],
      user: req.session.user,
      error: 'Failed to fetch order details',
      currentPage: 1,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
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

    const order = await Order.findOne({ orderId }).populate(
      'orderedItems.product'
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const orderedItem = order.orderedItems.find(
      (item) => item.product._id.toString() === productId
    );

    if (!orderedItem) {
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

    // Find order and populate necessary fields
    const order = await Order.findOne({ orderId })
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage', // Only select needed fields
      })
      .populate('address')
      .lean(); // Convert to plain JavaScript object

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Format the response
    const formattedOrder = {
      orderId: order.orderId,
      createdOn: order.createdOn,
      items: order.orderedItems.map((item) => ({
        productName: item.product.productName,
        productImage: item.product.productImage[0],
        quantity: item.quantity,
        size: item.size,
        price: item.price,
        status: item.status,
      })),
      address: order.address,
      phoneNumber: order.phoneNumber,
      finalAmount: order.finalAmount,
      discount: order.discount || 0,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
    };

    // Send the response
    return res.json({
      success: true,
      order: formattedOrder,
    });
  } catch (error) {
    console.error('Error in getOrderDetails:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
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

const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: orderId,
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      amount: options.amount,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
    });
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      orderId,
    } = req.body;

    // Only proceed if we have all required fields for verification
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification details',
      });
    }

    // Create the verification data string
    const body = razorpay_order_id + '|' + razorpay_payment_id;

    // Create the signature verification using crypto
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    // Compare the signatures
    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Payment is verified, update order status
      const order = await Order.findOne({ orderId: orderId });
      if (order) {
        order.paymentStatus = 'Completed';
        await order.save();
        console.log('Payment verified and order updated successfully');

        res.json({
          success: true,
          message: 'Payment verified and status updated successfully',
        });
      } else {
        console.log('Order not found:', orderId);
        res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }
    } else {
      console.log('Payment verification failed');
      res.status(400).json({
        success: false,
        message: 'Payment verification failed',
      });
    }
  } catch (error) {
    console.error('Error in payment verification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.body.orderId;
    console.log('Attempting to generate invoice for orderId:', orderId);

    const order = await Order.findOne({ orderId: orderId })
      .populate('orderedItems.product')
      .populate('address')
      .populate('user');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${orderId}.pdf`
    );
    doc.pipe(res);

    // Colors
    const primaryColor = '#2563eb'; // Blue
    const secondaryColor = '#1e293b'; // Slate
    const borderColor = '#e2e8f0'; // Light gray

    // Header
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .fillColor(primaryColor)
      .text('THREADPOOL', { align: 'center' })
      .fontSize(14)
      .fillColor(secondaryColor)
      .text('Premium Gym Clothing', { align: 'center' })
      .moveDown(1);

    // Invoice Title & Details
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('INVOICE', { align: 'right' })
      .fontSize(10)
      .font('Helvetica')
      .text(`Date: ${new Date(order.orderDate).toLocaleDateString()}`, {
        align: 'right',
      })
      .text(`Invoice No: #${order.orderId}`, { align: 'right' })
      .moveDown(1);

    // Customer Details Section
    const startY = doc.y;

    // Billing Info (Left Side)
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('BILL TO:', 40)
      .font('Helvetica')
      .fontSize(10)
      .text(order.user.name)
      .text(order.user.email)
      .text(`Phone: ${order.phoneNumber || 'N/A'}`);

    // Shipping Info (Right Side)
    if (order.address) {
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('SHIP TO:', 300, startY)
        .font('Helvetica')
        .fontSize(10)
        .text(
          [
            order.address.name,
            order.address.landMark,
            `${order.address.city}, ${order.address.state}`,
            `PIN: ${order.address.pincode}`,
          ]
            .filter(Boolean)
            .join('\n')
        );
    }

    doc.moveDown(3); // Increased spacing

    // Order Items Table
    const tableTop = doc.y;
    const tableHeaders = ['Product', 'Size', 'Qty', 'Price', 'Total'];
    const colWidths = [250, 60, 60, 80, 80];

    // Table Header Background
    doc
      .fillColor(primaryColor)
      .rect(40, tableTop - 5, 515, 25)
      .fill();

    // Table Headers
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);

    let xPos = 50;
    tableHeaders.forEach((header, i) => {
      doc.text(header, xPos, tableTop, {
        width: colWidths[i],
        align: i === 0 ? 'left' : 'right',
      });
      xPos += colWidths[i];
    });

    // Table Rows
    let yPos = tableTop + 30;
    doc.fillColor(secondaryColor).font('Helvetica').fontSize(10);

    order.orderedItems.forEach((item, i) => {
      // Zebra striping
      if (i % 2 === 0) {
        doc
          .fillColor('#f8fafc')
          .rect(40, yPos - 5, 515, 25)
          .fill();
      }

      doc.fillColor(secondaryColor);
      xPos = 50;

      // Format prices
      const price = Number(item.price).toFixed(2);
      const total = (Number(item.price) * item.quantity).toFixed(2);

      // Product details
      doc.text(item.product.productName, xPos, yPos, { width: colWidths[0] });
      doc.text(item.size, xPos + colWidths[0], yPos, {
        width: colWidths[1],
        align: 'right',
      });
      doc.text(
        item.quantity.toString(),
        xPos + colWidths[0] + colWidths[1],
        yPos,
        { width: colWidths[2], align: 'right' }
      );
      doc.text(
        `₹${price}`,
        xPos + colWidths[0] + colWidths[1] + colWidths[2],
        yPos,
        { width: colWidths[3], align: 'right' }
      );
      doc.text(
        `₹${total}`,
        xPos + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
        yPos,
        { width: colWidths[4], align: 'right' }
      );

      yPos += 25;
    });

    // Store the final y position of the table
    const tableEndY = yPos + 20; // Add some padding

    // Summary Section - Start from table end position
    const summaryX = 355;
    const summaryWidth = 200;

    // Calculate totals
    const subtotal =
      Number(order.finalAmount) + Number(order.couponDiscount || 0);
    const discount = Number(order.couponDiscount || 0);
    const total = Number(order.finalAmount);

    // Position summary box below the table
    doc
      .rect(summaryX - 10, tableEndY, summaryWidth + 20, 120)
      .fillColor('#f8fafc')
      .fill()
      .fillColor(secondaryColor);

    // Summary Content - Position relative to the box
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Payment Summary', summaryX, tableEndY + 10, {
        width: summaryWidth,
        align: 'left',
      })
      .moveDown(1);

    // Summary Items
    [
      { label: 'Subtotal:', value: `₹${subtotal.toFixed(2)}` },
      { label: 'Discount:', value: `₹${discount.toFixed(2)}` },
      { label: 'Total Amount:', value: `₹${total.toFixed(2)}`, bold: true },
      { label: 'Payment Method:', value: order.paymentMethod },
    ].forEach((item) => {
      if (item.bold) doc.font('Helvetica-Bold');
      else doc.font('Helvetica');
      doc
        .fontSize(10)
        .text(item.label, summaryX, doc.y, { continued: true })
        .text(item.value, { align: 'right' })
        .moveDown(0.5);
    });

    // Footer - Position relative to the summary end
    const footerY = tableEndY + 160; // Adjust based on summary height
    doc
      .fontSize(10)
      .fillColor(primaryColor)
      .text('Thank you for shopping with us!', { align: 'center' }, footerY)
      .moveDown(0.5)
      .fontSize(8)
      .fillColor('#64748b')
      .text(
        'This is a computer generated invoice and does not require signature.',
        { align: 'center' }
      );

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice');
  }
};

module.exports = {
  getOrder,
  CancelOrder,
  trackOrder,
  getOrderDetails,
  returnOrder,
  createRazorpayOrder,
  updatePaymentStatus,
  downloadInvoice,
};
