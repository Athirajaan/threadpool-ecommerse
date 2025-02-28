const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const { StatusCode, Messages } = require('../../utils/statusCodes');

// Display category
const categoryInfo = async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const filter = searchQuery
      ? { name: { $regex: searchQuery, $options: 'i' } }
      : {};

    const categoryData = await Category.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(filter);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render('category', {
      categoryData: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
    });
  } catch (error) {
    console.error('Error in fetching categories:', error);
    res.redirect('/admin/pageerror');
  }
};

// Add category function
const addCategory = async (req, res) => {
  const { name, description, gender } = req.body;

  try {
    const existingCategory = await Category.findOne({ name, gender });
    if (existingCategory) {
      return res.status(StatusCode.CONFLICT).json({
        error: 'Category already exists',
      });
    }
    const newCategory = new Category({
      name,
      description,
      gender,
    });
    await newCategory.save();
    return res.status(StatusCode.CREATED).json({
      message: Messages.CREATED,
    });
  } catch (error) {
    console.error('Error in adding category:', error);
    if (error.code === 11000) {
      return res.status(StatusCode.CONFLICT).json({
        error: Messages.DUPLICATE_ENTRY,
      });
    }
    return res.status(StatusCode.INTERNAL_SERVER).json({
      error: Messages.INTERNAL_ERROR,
    });
  }
};
const getListCategory = async (req, res) => {
  try {
    const categoryId = req.query.id;
    await Category.updateOne({ _id: categoryId }, { $set: { isListed: false } });
    res.redirect('/admin/category');
  } catch (error) {
    res.status(StatusCode.INTERNAL_SERVER).redirect('/admin/pageerror');
  }
};

const getUnListCategory = async (req, res) => {
  try {
    const categoryId = req.query.id;
    await Category.updateOne({ _id: categoryId }, { $set: { isListed: true } });
    res.redirect('/admin/category');
  } catch (error) {
    res.status(StatusCode.INTERNAL_SERVER).redirect('/admin/pageerror');
  }
};

const EditCategory = async (req, res) => {
  const { categoryId, name, description, gender } = req.body;

  if (!categoryId) {
    return res.status(StatusCode.BAD_REQUEST).json({
      success: false,
      message: 'Invalid category ID',
    });
  }

  try {
    const existingCategory = await Category.findOne({
      name,
      gender,
      _id: { $ne: categoryId },
    });

    if (existingCategory) {
      return res.status(StatusCode.CONFLICT).json({
        success: false,
        message: 'Category with this name already exists',
      });
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { name, description, gender },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(StatusCode.NOT_FOUND).json({
        success: false,
        message: 'Category not found',
      });
    }

    return res.status(StatusCode.OK).json({
      success: true,
      message: Messages.UPDATED,
      redirectUrl: '/admin/category',
    });
  } catch (error) {
    console.error('Error updating category:', error);
    return res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
    });
  }
};

module.exports = {
  categoryInfo,
  addCategory,
  getListCategory,
  getUnListCategory,
  EditCategory,
};
