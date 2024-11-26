const Category = require('../../models/categorySchema');

// Display category
const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5; 
    const skip = (page - 1) * limit; 

    const categoryData = await Category.find({})
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(); // Total number of categories
    const totalPages = Math.ceil(totalCategories / limit); // Calculate total pages

    // Render the EJS page
    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
    });
  } catch (error) {
    console.error("Error in fetching categories:", error);
    res.redirect("/pageerror"); // Redirect to error page on failure
  }
};

// Add category function
const addCategory = async (req, res) => {
  const { name, description, gender } = req.body;

  try {
    // Check if the category already exists
    const existingCategory = await Category.findOne({ name, gender });
    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }

    // Create a new category
    const newCategory = new Category({
      name,
      description,
      gender,
    });
    await newCategory.save();

    // Respond with success message
    return res.json({ message: "Category added successfully" });
  } catch (error) {
    console.error("Error in adding category:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  categoryInfo,
  addCategory,
};
































/*const Category = require('../../models/categorySchema');

// Get all categories (For fetching categories from DB)
const categoryInfo = async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('category', { categories }); // Render 'category' view and pass categories
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send('Unable to fetch categories.');
    }
};



// Add a new category
const addCategory = async (req, res) => {
    try {
        const { name, description, parentCategory } = req.body;
        console.log("Received category data:", req.body); // Log received data
        
        if (!name || !description || !parentCategory) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const category = new Category({ name, description, parentCategory });
        await category.save();

        console.log("Category saved:", category); // Log the saved category
        res.status(201).json({ message: 'Category added successfully.', category });
    } catch (error) {
        console.error('Error adding category:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Category name must be unique.' });
        }
        res.status(500).json({ message: 'Error adding category.', error: error.message });
    }
};




// Update a category
const updateCategory = async (req, res) => {
    try {
        const { id, name, description, parentCategory } = req.body;

        // Validate required fields
        if (!id || !name || !description || !parentCategory) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Update the category
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name, description, parentCategory },
            { new: true } // Return the updated document
        );

        if (!updatedCategory) {
            return res.status(404).json({ message: 'Category not found.' });
        }

        res.status(200).json({ message: 'Category updated successfully.', category: updatedCategory });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ message: 'An error occurred while updating the category.' });
    }
};


module.exports={
    categoryInfo,
    addCategory,
    updateCategory,
}   */