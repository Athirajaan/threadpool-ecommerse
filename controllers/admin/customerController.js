const User = require("../../models/userSchema");

const coustomerInfo = async (req, res) => {
  try {
    let search = "";
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
        { name: { $regex: ".*" + search + ".* " } },
        { email: { $regex: ".*" + search + ".*" } },
      ],
    })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".* " } },
        { email: { $regex: ".*" + search + ".*" } },
      ],
    }).countDocuments();

    res.render("customers", {
      data: userData,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const customerBlocked = async (req, res) => {
  try {
    let id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/customers");
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const customerunBlocked = async (req, res) => {
  try {
    let id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/customers");
  } catch (error) {
    res.redirect("/pageerror");
  }
};

module.exports = {
  coustomerInfo,
  customerBlocked,
  customerunBlocked,
};
