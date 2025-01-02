const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Order = require('../../models/orderSchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

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
    doc
      .fontSize(8)
      .text('Threadpool - Your Fashion Destination', 30, 780, {
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

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  logout,
  pageerror,
  exportToExcel,
  exportToPDF,
  filterOrders,
};
