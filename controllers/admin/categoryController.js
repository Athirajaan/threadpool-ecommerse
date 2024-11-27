const Category = require("../../models/categorySchema");

// Display category
const categoryInfo = async (req, res) => {
  try {
    const searchQuery = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const filter = searchQuery
      ? { name: { $regex: searchQuery, $options: "i" } }
      : {};

    const categoryData = await Category.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(filter);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
    });
  } catch (error) {
    console.error("Error in fetching categories:", error);
    res.redirect("/pageerror");
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
    return res.json({ message: "Category added successfully" });
  } catch (error) {
    console.error("Error in adding category:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        error: "Duplicate category found. Please check the name and gender.",
      });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  categoryInfo,
  addCategory,
};
