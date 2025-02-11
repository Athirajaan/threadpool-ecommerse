const Category = require('../../models/categorySchema');
const Produtc = require('../../models/productSchema');

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
      cat: categoryData,
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
      return res
        .status(400)
        .json({ error: `This Category already exists for ${gender}` });
    }
    const newCategory = new Category({
      name,
      description,
      gender,
    });
    await newCategory.save();
    return res.json({ message: 'Category added successfully' });
  } catch (error) {
    console.error('Error in adding category:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        error: 'Duplicate category found. Please check the name and gender.',
      });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.redirect('/admin/category');
  } catch (error) {
    res.redirect('/admin/pageerror');
  }
};

const getUnListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect('/admin/category');
  } catch (error) {
    res.redirect('/admin/pageerror');
  }
};

const EditCategory = async (req, res) => {
  const { categoryId, name, description, gender } = req.body;

  // Validate incoming data
  if (!categoryId) {
    return res.status(400).json({
      success: false,
      message: 'Category ID is required',
    });
  }

  try {
    // Check if the category already exists
    const existingCategory = await Category.findOne({
      name,
      gender,
      _id: { $ne: categoryId },
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists for this gender',
      });
    }

    // Update the category
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { name, description, gender },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      redirectUrl: '/admin/category', // Add redirect URL
    });
  } catch (error) {
    console.error('Error updating category:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating category',
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


