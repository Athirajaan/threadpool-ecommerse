const User = require('../../models/userSchema');
const { StatusCode, Messages } = require('../../utils/statusCodes');

const coustomerInfo = async (req, res) => {
  try {
    let search = '';
    if (req.query.search) {
      search = req.query.search;
    }

    let page = parseInt(req.query.page) || 1;
    if (req.query.page) {
      page = req.query.page;
    }

    const limit = 8;
    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: '.*' + search + '.* ' } },
        { email: { $regex: '.*' + search + '.*' } },
      ],
    })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: '.*' + search + '.* ' } },
        { email: { $regex: '.*' + search + '.*' } },
      ],
    }).countDocuments();

    res.render('customers', {
      data: userData,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(StatusCode.INTERNAL_SERVER).redirect('/admin/pageerror');
  }
};

const customerBlocked = async (req, res) => {
  try {
    let userId = req.query.id;
    await User.updateOne({ _id: userId }, { $set: { isBlocked: true } });
    res.redirect('/admin/customers');
  } catch (error) {
    res.status(StatusCode.INTERNAL_SERVER).redirect('/admin/pageerror');
  }
};

const customerunBlocked = async (req, res) => {
  try {
    let userId = req.query.id;
    await User.updateOne({ _id: userId }, { $set: { isBlocked: false } });
    res.redirect('/admin/customers');
  } catch (error) {
    res.status(StatusCode.INTERNAL_SERVER).redirect('/admin/pageerror');
  }
};

module.exports = {
  coustomerInfo,
  customerBlocked,
  customerunBlocked,
};
