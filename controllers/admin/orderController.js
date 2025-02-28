const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const { StatusCode, Messages } = require('../../utils/statusCodes');

const orderInfo = async (req, res) => {
  try {
    const { page = 1, limit = 4 } = req.query;

    const totalOrders = await Order.countDocuments({
      paymentStatus: { $ne: 'Failed' },
    });

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
    res.status(StatusCode.INTERNAL_SERVER).redirect('/admin/pageerror');
  }
};

const updateStatus = async (req, res) => {
  const { orderId, productId, size, status } = req.body;

  try {
    const order = await Order.findById(orderId)
      .populate('orderedItems.product')
      .populate('user');

    if (!order) {
      return res.status(StatusCode.NOT_FOUND).render('error', {
        message: 'Order not found',
      });
    }

    const orderedItem = order.orderedItems.find(
      (item) => item.product._id.toString() === productId && item.size === size
    );

    if (!orderedItem) {
      return res.status(StatusCode.NOT_FOUND).render('error', {
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

    if (validStatuses.indexOf(status) < validStatuses.indexOf(currentStatus)) {
      return res.status(StatusCode.BAD_REQUEST).render('error', {
        message: 'Backward transitions are not allowed',
      });
    }

    orderedItem.status = status;
    await order.save();

    res.redirect('/admin/order');
  } catch (error) {
    console.error(error);
    res.status(StatusCode.INTERNAL_SERVER).redirect('/admin/pageerror');
  }
};

module.exports = {
  orderInfo,
  updateStatus,
};
