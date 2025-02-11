const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');

const orderInfo = async (req, res) => {
  try {
    const { page = 1, limit = 4 } = req.query;

    // First, get total count (excluding failed payments)
    const totalOrders = await Order.countDocuments({
      paymentStatus: { $ne: 'Failed' },
    });

    // Then get orders with proper sorting (excluding failed payments)
    const orders = await Order.find({ paymentStatus: { $ne: 'Failed' } })
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage',
      })
      .populate({
        path: 'user',
        select: 'name email phone',
      })
      .populate({
        path: 'address',
        model: 'Address',
        select: 'address',
      })
      .select(
        'orderId orderedItems paymentMethod paymentStatus finalAmount createdAt updatedAt address phoneNumber user appliedCoupon couponDiscount couponApplied'
      )
      .sort({ _id: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const formattedOrders = orders.map((order) => {

      let formattedAddress = 'N/A';
      if (
        order.address &&
        order.address.address &&
        order.address.address.length > 0
      ) {
        const addr =
          order.address.address.find((a) => a.isDefault) ||
          order.address.address[0];
        if (addr) {
          formattedAddress = `${addr.name}, ${addr.landMark}, ${addr.city}, ${addr.state} - ${addr.pincode}`;
        }
      }

      return {
        _id: order._id,
        orderId: order.orderId,
        items: order.orderedItems.map((item) => ({
          _id: item._id,
          productId: item.product._id,
          productName: item.product.productName,
          productImage: item.product.productImage[0],
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          status: item.status,
        })),
        customer: {
          name: order.user?.name || 'N/A',
          email: order.user?.email || 'N/A',
          phone: order.phoneNumber || order.user?.phone || 'N/A',
        },
        address: formattedAddress,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        finalAmount: order.finalAmount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        couponApplied: Boolean(order.appliedCoupon || order.couponApplied),
        appliedCoupon: order.appliedCoupon || null,
        couponDiscount: order.couponDiscount || 0,
      };
    });

    res.render('order', {
      orders: formattedOrders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrders / limit),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('Error in orderInfo:', error);
    res.redirect('/admin/pageerror');
  }
};

const updateStatus = async (req, res) => {
  const { orderId, productId, size, status } = req.body;

  try {
    // Find the order by its _id
    const order = await Order.findById(orderId)
      .populate('orderedItems.product')
      .populate('user');

    if (!order) {
      return res.status(404).render('error', { message: 'Order not found' });
    }

    // Find the specific order item matching both product ID and size
    const orderedItem = order.orderedItems.find(
      (item) => item.product._id.toString() === productId && item.size === size
    );

    if (!orderedItem) {
      return res.status(404).render('error', {
        message: 'Specific product variant not found in this order',
      });
    }

    const validStatuses = [
      'Pending',
      'Shipped',
      'out for delivery',
      'Delivered',
      'Cancelled',
      'Returned',
    ];
    const currentStatus = orderedItem.status;

    // Prevent backward transitions
    if (validStatuses.indexOf(status) < validStatuses.indexOf(currentStatus)) {
      return res
        .status(400)
        .render('error', { message: 'Backward transitions are not allowed' });
    }

    // Update status
    orderedItem.status = status;

    await order.save();

    // Redirect to the admin orders page or use your existing route for rendering orders
    res.redirect('/admin/order');
  } catch (error) {
    console.error(error);
    res.redirect('/admin/pageerror');
  }
};

module.exports = {
  orderInfo,
  updateStatus,
};
