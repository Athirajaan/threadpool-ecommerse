const Product = require('../../models/productSchema');
const { calculatePrice } = require('../../utils/priceCalculator');

const productDetails = async (req, res) => {
  try {
    const productId = req.query.id;
    const product = await Product.findById(productId).populate('category');

    if (!product) {
      return res.status(404).redirect('/pageNotFound');
    }

    // Calculate price with any applicable offers
    const priceDetails = await calculatePrice(product, product.category);

    // Add offer details to the product object
    const productWithOffer = {
      ...product.toObject(),
      finalPrice: priceDetails.finalPrice,
      totalDiscount: priceDetails.totalDiscount,
      offer: priceDetails.offer,
      regularPrice: product.regularPrice,
    };

    // Fetch similar products in the same category, excluding the current product
    const similarProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId }, // Exclude the current product
    }).limit(4); // Limit to 4 similar products

    res.render('product-details', {
      product: productWithOffer,
      similarProducts, // Pass similar products to the view
    });
  } catch (error) {
    console.error('Error in product details:', error);
    res.status(500).redirect('/pageNotFound');
  }
};

// Add the getPrice function
const getPrice = async (req, res) => {
  try {
    const { productId, size } = req.body;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Calculate price with any applicable offers
    const priceDetails = await calculatePrice(product, product.category);

    // Apply size-based pricing if needed
    let finalPrice = priceDetails.finalPrice;
    if (size === 'L' || size === 'XL') {
      finalPrice = Math.round(finalPrice + 0.1 * product.regularPrice);
    }

    res.json({
      success: true,
      price: finalPrice,
      offer: priceDetails.offer,
    });
  } catch (error) {
    console.error('Error getting price:', error);
    res.status(500).json({ error: 'Failed to get price' });
  }
};

module.exports = {
  productDetails,
  getPrice, // Export the getPrice function
};
