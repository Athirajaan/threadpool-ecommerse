const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Order = require('../../models/orderSchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const { StatusCode, Messages } = require('../../utils/statusCodes');

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
    const admin = await User.findOne({ email });

    if (!admin) {
      return res.render('admin-login', { message: 'Invalid email address' });
    }

    if (!admin.isAdmin) {
      return res.status(StatusCode.FORBIDDEN).render('admin-login', {
        message: 'Access denied. Not an admin account',
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(StatusCode.UNAUTHORIZED).render('admin-login', {
        message: 'Incorrect password',
      });
    }

    req.session.admin = admin;
    return res.redirect('/admin');
  } catch (error) {
    console.log('Login error:', error);
    return res.status(StatusCode.INTERNAL_SERVER).render('admin-login', {
      message: Messages.INTERNAL_ERROR,
    });
  }
};

//load Dashboard
const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      const { period, startDate, endDate } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;

      let dateFilter = {};

      // Handle date range filter
      if (startDate && endDate) {
        dateFilter = {
          createdOn: {
            $gte: new Date(startDate),
            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
          },
        };
      }
      // Handle period filter
      else if (period) {
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
        }
      }

      // Get filtered orders count for pagination
      const totalOrders = await Order.countDocuments(dateFilter);

      // Calculate totals based on filtered orders
      const allFilteredOrders = await Order.find(dateFilter);
      const totalSales = allFilteredOrders.length;
      const totalAmount = allFilteredOrders.reduce(
        (sum, order) => sum + (order.finalAmount || 0),
        0
      );
      const totalDiscount = allFilteredOrders.reduce(
        (sum, order) =>
          sum + (order.discount || 0) + (order.couponDiscount || 0),
        0
      );

      const averageOrderValue =
        totalSales > 0 ? (totalAmount / totalSales).toFixed(2) : '0.00';

      if (totalOrders === 0) {
        return res.render('dashboard', {
          orders: [],
          totalSales: 0,
          totalAmount: 0,
          totalDiscount: 0,
          averageOrderValue: '0.00',
          currentPeriod: period || 'all',
          dateRange: {
            startDate: startDate || '',
            endDate: endDate || '',
          },
          pagination: {
            currentPage: 1,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
            nextPage: 1,
            prevPage: 1,
          },
        });
      }

      const totalPages = Math.ceil(totalOrders / limit);

      const orders = await Order.find(dateFilter)
        .populate('orderedItems.product')
        .populate('user')
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(limit);

      res.render('dashboard', {
        orders,
        totalSales,
        totalAmount,
        totalDiscount,
        averageOrderValue,
        currentPeriod: period || 'all',
        dateRange: {
          startDate: startDate || '',
          endDate: endDate || '',
        },
        pagination: {
          currentPage: page,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          nextPage: page + 1,
          prevPage: page - 1,
        },
      });
    } catch (error) {
      console.log('Dashboard error:', error);
      res.status(StatusCode.INTERNAL_SERVER).redirect('/admin/pageerror');
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
    res.status(StatusCode.INTERNAL_SERVER).redirect('/admin/pageerror');
  }
};

//pageerror
const pageerror = async (req, res) => {
  try {
    res.status(StatusCode.INTERNAL_SERVER).render('error', {
      title: 'Error Page',
      message: Messages.INTERNAL_ERROR,
      error: {
        status: StatusCode.INTERNAL_SERVER,
        stack: process.env.NODE_ENV === 'development' ? err?.stack : '',
      },
    });
  } catch (error) {
    console.error('Error rendering error page:', error);
    res.status(StatusCode.INTERNAL_SERVER).send(Messages.INTERNAL_ERROR);
  }
};

// Export to Excel
const exportToExcel = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    let dateFilter = {};

    if (startDate && endDate) {
      dateFilter = {
        createdOn: {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        },
      };
    } else if (period) {
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
      }
    }

    const orders = await Order.find(dateFilter)
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
    res.redirect('/admin/pageerror');
  }
};

// Export to PDF
const exportToPDF = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    let dateFilter = {};

    // Handle date range filter
    if (startDate && endDate) {
      dateFilter = {
        createdOn: {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        },
      };
    }
    // Handle period filter
    else if (period) {
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
      }
    }

    const orders = await Order.find(dateFilter)
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
      .fontSize(20)
      .text('Threadpool', 30, 40)
      .fontSize(16)
      .text(`Generated on: ${new Date().toLocaleString()}`, 350, 40)
      .moveDown(2);

    // Filter information
    if (period || (startDate && endDate)) {
      doc
        .fontSize(10)
        .text(
          `Filter: ${
            startDate && endDate
              ? `Date Range (${new Date(startDate).toLocaleDateString()} - ${new Date(
                  endDate
                ).toLocaleDateString()})`
              : period === 'today'
                ? 'Today'
                : period === 'week'
                  ? 'This Week'
                  : period === 'month'
                    ? 'This Month'
                    : 'All Orders'
          }`,
          30,
          doc.y
        )
        .moveDown();
    }

    // Summary section
    const totalAmount = orders.reduce(
      (sum, order) => sum + order.finalAmount,
      0
    );
    const totalDiscount = orders.reduce(
      (sum, order) => sum + (order.discount || 0) + (order.couponDiscount || 0),
      0
    );

    doc
      .fontSize(12)
      .text(`Total Orders: ${orders.length}`, 30, doc.y)
      .text(`Total Revenue: ₹${Math.round(totalAmount)}`, 200, doc.y - 15)
      .text(`Total Discount: ₹${Math.round(totalDiscount)}`, 400, doc.y - 15)
      .moveDown(2);

    // Table headers
    const startY = doc.y;
    doc.fillColor('#f0f0f0').rect(30, startY, 535, 20).fill().fillColor('#000');

    doc
      .fontSize(10)
      .text('Order ID', 35, startY + 5)
      .text('Customer', 105, startY + 5)
      .text('Products', 205, startY + 5)
      .text('Amount', 385, startY + 5)
      .text('Discount', 455, startY + 5);

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
          .rect(30, y - 5, 535, 25)
          .fill()
          .fillColor('#000');
      }

      // Format products string
      const productsText = order.orderedItems
        .map(
          (item) => `${item.product.productName}(${item.size}x${item.quantity})`
        )
        .join(', ');

      const orderDiscount = (order.discount || 0) + (order.couponDiscount || 0);

      doc
        .fontSize(9)
        .text(order.orderId, 35, y)
        .text(order.user.name, 105, y)
        .text(productsText, 205, y, { width: 170 })
        .text(`₹${Math.round(order.finalAmount)}`, 385, y)
        .text(`₹${Math.round(orderDiscount)}`, 455, y);

      y += 25;
    });

    // Footer
    doc.fontSize(8).text('Threadpool - Your Fashion Destination', 30, 780, {
      align: 'center',
    });

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(StatusCode.INTERNAL_SERVER).redirect('/admin/pageerror');
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

    // Fetch filtered orders for the table only
    const filteredOrders = await Order.find(dateFilter)
      .populate('orderedItems.product')
      .populate('user')
      .sort({ createdOn: -1 });

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

const loadProductList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalProducts = await Product.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit);

    // Populate the category field to get category name
    const data = await Product.find()
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render('productlist', {
      data,
      currentPage: page,
      totalPages,
      title: 'Product Management',
    });
  } catch (error) {
    console.error('Error loading product list:', error);
    res.status(500).redirect('/admin/error');
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
  loadProductList,
};
