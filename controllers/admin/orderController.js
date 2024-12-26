const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");



const orderInfo = async (req, res) => {
    try {
        const { page = 1, limit = 6 } = req.query;
        
        const orders = await Order.find()
            .populate({
                path: "orderedItems.product",
                select: "productName productImage",
            })
            .select("orderId orderedItems paymentMethod paymentStatus finalAmount")
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const formattedOrders = orders.map(order => ({
            _id: order._id, // Add order's MongoDB _id
            orderId: order.orderId,
            items: order.orderedItems.map(item => ({
                _id: item._id, // Add orderItem's MongoDB _id
                productId: item.product._id, // Add product's MongoDB _id
                productName: item.product.productName,
                productImage: item.product.productImage[0], // Assuming the first image
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                status: item.status, // Add item's status
            })),
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            finalAmount: order.finalAmount,
        }));
        
        const totalOrders = await Order.countDocuments();
        
        res.render('order', {
            orders: formattedOrders,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalOrders / limit),
            limit: parseInt(limit), // Pass the limit to EJS for pagination
        }); 
    } catch (error) {
        console.error(error);
        res.status(500).send("Failed to fetch orders");
    } 
};

const updateStatus = async (req, res) => {
    console.log("Request Body:", req.body);
    const { orderId, productId, size, status } = req.body;

    try {
        // Find the order by its _id
        const order = await Order.findById(orderId).populate("orderedItems.product").populate("user");

        if (!order) {
            return res.status(404).render("error", { message: "Order not found" });
        }

        // Find the specific order item matching both product ID and size
        const orderedItem = order.orderedItems.find(
            (item) => 
                item.product._id.toString() === productId && 
                item.size === size
        );

        if (!orderedItem) {
            return res.status(404).render("error", { message: "Specific product variant not found in this order" });
        }

        const validStatuses = ["Pending", "Shipped", "out for delivery", "Delivered", "Cancelled", "Returned"];
        const currentStatus = orderedItem.status;

        // Prevent backward transitions
        if (validStatuses.indexOf(status) < validStatuses.indexOf(currentStatus)) {
            return res.status(400).render("error", { message: "Backward transitions are not allowed" });
        }

        // Update status
        orderedItem.status = status;

        await order.save();

        // Redirect to the admin orders page or use your existing route for rendering orders
        res.redirect('/admin/order');

    } catch (error) {
        console.error(error);
        res.status(500).render("error", { message: "Server error" });
    }
};

module.exports = {
    orderInfo, 
    updateStatus,
}