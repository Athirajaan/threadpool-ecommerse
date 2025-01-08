const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Order = require('../../models/orderSchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

//load login
const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect('/admin');
  }
  res.render('admin-login', { message: null });
};

//login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);

      if (passwordMatch) {
        req.session.admin = admin;
        return res.redirect('/admin');
      } else {
        return res.redirect('/admin/login');
      }
    } else {
      return res.redirect('/admin/login');
    }
  } catch (error) {
    console.log('Login error:', error);
    return res.redirect('/pageerror');
  }
};

//load Dashboard
const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      const { period } = req.query;
      let dateFilter = {};

      // Set date filter based on period
      if (period) {
        const now = new Date();
        switch (period) {
          case 'today':
            dateFilter = {
              createdAt: {
                $gte: new Date(now.setHours(0, 0, 0, 0)),
                $lt: new Date(now.setHours(23, 59, 59, 999)),
              },
            };
            break;
          case 'week':
            const weekStart = new Date(
              now.setDate(now.getDate() - now.getDay())
            );
            dateFilter = {
              createdAt: {
                $gte: new Date(weekStart.setHours(0, 0, 0, 0)),
                $lt: new Date(),
              },
            };
            break;
          case 'month':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter = {
              createdAt: {
                $gte: monthStart,
                $lt: new Date(),
              },
            };
            break;
        }
      }

      // Fetch orders with date filter
      const orders = await Order.find(dateFilter)
        .populate('orderedItems.product')
        .populate('user')
        .sort({ createdAt: -1 });

      // Calculate totals based on filtered orders
      const totalSales = orders.length;
      const totalAmount = orders.reduce(
        (sum, order) => sum + (order.finalAmount || 0),
        0
      );
      const totalDiscount = orders.reduce(
        (sum, order) =>
          sum + (order.discount || 0) + (order.couponDiscount || 0),
        0
      );
      const averageOrderValue = totalSales > 0 ? totalAmount / totalSales : 0;

      res.render('dashboard', {
        orders,
        totalSales,
        totalAmount,
        totalDiscount,
        averageOrderValue,
        currentPeriod: period || 'all',
      });
    } catch (error) {
      console.log('Dashboard error:', error);
      res.redirect('/pageerror');
    }
  }
};

//logout
const logout = async (req, res) => {
  try {
    delete req.session.admin;
    res.redirect('/admin/login');
  } catch (error) {
    console.log('unexpected error during logout', error);
    res.redirect('/pageerror');
  }
};

//pageerror
const pageerror = async (req, res) => {
  res.render('error');
};

// Export to Excel
const exportToExcel = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('orderedItems.product')
      .populate('user');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Orders');

    // Add headers
    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 15 },
      { header: 'Customer Name', key: 'customerName', width: 20 },
      { header: 'Products', key: 'products', width: 40 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Discount', key: 'discount', width: 15 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    // Add data
    orders.forEach((order) => {
      worksheet.addRow({
        orderId: order.orderId,
        customerName: order.user.name,
        products: order.orderedItems
          .map(
            (item) =>
              `${item.product.productName} (${item.size} x ${item.quantity})`
          )
          .join(', '),
        amount: order.finalAmount,
        discount: (order.discount || 0) + (order.couponDiscount || 0),
        date: new Date(order.createdOn).toLocaleDateString(),
        status: order.orderedItems[0]?.status || 'Pending',
      });
    });

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=orders.xlsx');

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
};

// Export to PDF
const exportToPDF = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('orderedItems.product')
      .populate('user')
      .sort({ createdOn: -1 });

    // Create PDF document
    const doc = new PDFDocument({
      margin: 30,
      size: 'A4',
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.pdf');
    doc.pipe(res);

    // Header
    doc
      .image('public/images/logo.jpg', 30, 30, { width: 40 })
      .fontSize(16)
      .text('Threadpool - Orders Report', 80, 40)
      .fontSize(10)
      .text(`Generated on: ${new Date().toLocaleString()}`, 350, 40)
      .moveDown(2);

    // Calculate summary data
    const totalAmount = orders.reduce(
      (sum, order) => sum + order.finalAmount,
      0
    );
    const totalDiscount = orders.reduce(
      (sum, order) => sum + (order.discount || 0) + (order.couponDiscount || 0),
      0
    );

    // Summary section
    doc
      .fontSize(12)
      .text(`Total Orders: ${orders.length}`, 30, doc.y)
      .text(`Total Revenue: ₹${Math.round(totalAmount)}`, 200, doc.y - 15)
      .text(`Total Discount: ₹${Math.round(totalDiscount)}`, 400, doc.y - 15)
      .moveDown(2);

    // Table headers
    const startY = doc.y;

    // Draw header background
    doc.fillColor('#f0f0f0').rect(30, startY, 565, 20).fill().fillColor('#000');

    // Add headers
    doc
      .fontSize(10)
      .text('Order ID', 35, startY + 5)
      .text('Customer', 105, startY + 5)
      .text('Products', 205, startY + 5)
      .text('Amount', 385, startY + 5)
      .text('Discount', 455, startY + 5)
      .text('Status', 525, startY + 5);

    let y = startY + 25;

    // Add order rows
    orders.forEach((order, i) => {
      // Add new page if needed
      if (y > 750) {
        doc.addPage();
        y = 30;
      }

      // Zebra striping
      if (i % 2 === 0) {
        doc
          .fillColor('#f9f9f9')
          .rect(30, y - 5, 565, 25)
          .fill()
          .fillColor('#000');
      }

      // Format products string to fit in cell
      const productsText = order.orderedItems
        .map((item) => `${item.product.productName}(${item.quantity})`)
        .join(', ');

      // Calculate order discount
      const orderDiscount = (order.discount || 0) + (order.couponDiscount || 0);

      doc
        .fontSize(9)
        .text(order.orderId, 35, y)
        .text(order.user.name, 105, y)
        .text(productsText, 205, y, { width: 170 })
        .text(`₹${Math.round(order.finalAmount)}`, 385, y)
        .text(`₹${Math.round(orderDiscount)}`, 455, y)
        .text(order.orderedItems[0]?.status || 'Pending', 525, y);

      y += 25;
    });

    // Footer
    doc.fontSize(8).text('Threadpool - Your Fashion Destination', 30, 780, {
      align: 'center',
    });

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
};

// Add this new function to handle order filtering
const filterOrders = async (req, res) => {
  try {
    const { period } = req.query;
    let dateFilter = {};
    const now = new Date();

    switch (period) {
      case 'today':
        dateFilter = {
          createdOn: {
            $gte: new Date(now.setHours(0, 0, 0, 0)),
            $lt: new Date(now.setHours(23, 59, 59, 999)),
          },
        };
        break;

      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);
        dateFilter = {
          createdOn: {
            $gte: weekStart,
            $lt: new Date(),
          },
        };
        break;

      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = {
          createdOn: {
            $gte: monthStart,
            $lt: new Date(),
          },
        };
        break;

      default:
        // 'all' - no date filter
        dateFilter = {};
    }

    // Add debug logging
    console.log('Date Filter:', dateFilter);

    // Fetch filtered orders for the table only
    const filteredOrders = await Order.find(dateFilter)
      .populate('orderedItems.product')
      .populate('user')
      .sort({ createdOn: -1 });

    // Debug log the results
    console.log('Filtered Orders Count:', filteredOrders.length);

    // Fetch total stats (unfiltered) for the stats strip
    const totalSales = await Order.countDocuments();
    const totalAmountResult = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$finalAmount' } } },
    ]);
    const totalDiscountResult = await Order.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $add: ['$discount', '$couponDiscount'] } },
        },
      },
    ]);

    const totalAmount = totalAmountResult[0]?.total || 0;
    const totalDiscount = totalDiscountResult[0]?.total || 0;

    res.render('dashboard', {
      orders: filteredOrders,
      totalSales: totalSales,
      totalAmount: totalAmount,
      totalDiscount: totalDiscount,
      currentPeriod: period,
    });
  } catch (error) {
    console.error('Filter orders error:', error);
    res.status(500).json({ error: 'Failed to filter orders' });
  }
};

const getSalesData = async (req, res) => {
  try {
    const { period } = req.query;
    const currentDate = new Date();
    let startDate;
    let labels;
    let groupByFormat;

    switch (period) {
      case 'weekly':
        // Get current day of week (0 = Sunday, 1 = Monday, etc.)
        const currentDay = currentDate.getDay();
        // Calculate days to subtract to get to last Monday
        const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;

        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - daysToMonday);
        startDate.setHours(0, 0, 0, 0);

        // Create labels for Monday to Sunday
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        groupByFormat = '%Y-%m-%d';
        break;

      case 'monthly':
        startDate = new Date(currentDate);
        startDate.setMonth(currentDate.getMonth() - 1);
        labels = Array.from({ length: 30 }, (_, i) => {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          return date.getDate().toString();
        });
        groupByFormat = '%Y-%m-%d';
        break;

      case 'yearly':
        startDate = new Date(currentDate);
        startDate.setFullYear(currentDate.getFullYear() - 1);
        labels = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        groupByFormat = '%Y-%m';
        break;

      default:
        return res.status(400).json({ error: 'Invalid period' });
    }

    // Aggregate sales data
    const salesData = await Order.aggregate([
      {
        $match: {
          createdOn: { $gte: startDate },
          'orderedItems.status': { $ne: 'Cancelled' },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupByFormat,
              date: '$createdOn',
            },
          },
          totalSales: { $sum: '$finalAmount' },
          orderCount: { $sum: 1 },
          totalItems: { $sum: { $size: '$orderedItems' } },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Format data for Chart.js
    const datasets = [
      {
        label: 'Sales Amount (₹)',
        data: new Array(labels.length).fill(0),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
      {
        label: 'Number of Orders',
        data: new Array(labels.length).fill(0),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1,
      },
    ];

    // Fill in the actual data
    salesData.forEach((data) => {
      let index;
      if (period === 'weekly') {
        const date = new Date(data._id);
        index = labels.indexOf(
          date.toLocaleDateString('en-US', { weekday: 'short' })
        );
      } else if (period === 'monthly') {
        const date = new Date(data._id);
        index = date.getDate() - 1;
      } else {
        const date = new Date(data._id + '-01'); // Add day for proper parsing
        index = date.getMonth();
      }

      if (index !== -1) {
        datasets[0].data[index] = data.totalSales;
        datasets[1].data[index] = data.orderCount;
      }
    });

    // For weekly view, ensure data aligns with Monday-Sunday
    if (period === 'weekly') {
      const filledData = new Array(7).fill(0);
      salesData.forEach((data) => {
        const date = new Date(data._id);
        const dayIndex = (date.getDay() + 6) % 7; // Convert Sunday(0) to 6, Monday(1) to 0, etc.
        filledData[dayIndex] = data.totalSales;
      });
      datasets[0].data = filledData;

      const orderData = new Array(7).fill(0);
      salesData.forEach((data) => {
        const date = new Date(data._id);
        const dayIndex = (date.getDay() + 6) % 7;
        orderData[dayIndex] = data.orderCount;
      });
      datasets[1].data = orderData;
    }

    res.json({
      labels,
      datasets,
      summary: {
        totalSales: datasets[0].data.reduce((a, b) => a + b, 0),
        totalOrders: datasets[1].data.reduce((a, b) => a + b, 0),
        averageOrderValue:
          datasets[0].data.reduce((a, b) => a + b, 0) /
          datasets[1].data.reduce((a, b) => a + b, 1),
      },
    });
  } catch (error) {
    console.error('Sales data error:', error);
    res.status(500).json({ error: 'Error fetching sales data' });
  }
};

const getTopSellers = async (req, res) => {
  try {
    // Get top 5 products for each gender
    const topWomenProducts = await Product.find({ gender: 'Women' })
      .sort({ salesCount: -1 })
      .limit(5)
      .select('productName salesCount salePrice productImage');

    const topMenProducts = await Product.find({ gender: 'Men' })
      .sort({ salesCount: -1 })
      .limit(5)
      .select('productName salesCount salePrice productImage');

    // Get top 5 categories
    const topCategories = await Category.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category',
          as: 'products',
        },
      },
      {
        $project: {
          name: 1,
          totalSales: { $sum: '$products.salesCount' },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      topWomenProducts,
      topMenProducts,
      topCategories,
    });
  } catch (error) {
    console.error('Error fetching top sellers:', error);
    res.status(500).json({ error: 'Error fetching top sellers' });
  }
};

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  logout,
  pageerror,
  exportToExcel,
  exportToPDF,
  filterOrders,
  getSalesData,
  getTopSellers,
};
