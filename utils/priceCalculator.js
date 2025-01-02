const Offer = require('../models/offerSchema');

const calculatePrice = async (product, category) => {
  try {
    // Find active offers for this product and its category
    const activeOffers = await Offer.find({
      $and: [
        { isActive: true },
        { endDate: { $gt: new Date() } }, // Only valid offers
        {
          $or: [
            { offerType: 'Product', applicableFor: product._id },
            { offerType: 'Category', applicableFor: category },
          ],
        },
      ],
    });

    if (!activeOffers || activeOffers.length === 0) {
      // No active offers, return original prices
      return {
        finalPrice: product.salePrice,
        regularPrice: product.regularPrice,
        offer: null,
        totalDiscount: product.regularPrice - product.salePrice,
        discountPercentage: null,
      };
    }

    // If multiple offers exist, find the one with highest discount
    let bestOffer = null;
    let maxDiscount = product.regularPrice - product.salePrice; // Initial discount
    let finalPrice = product.salePrice;

    activeOffers.forEach((offer) => {
      const potentialPrice =
        product.salePrice - (product.salePrice * offer.percentage) / 100;
      const potentialDiscount = product.regularPrice - potentialPrice;

      if (potentialDiscount > maxDiscount) {
        maxDiscount = potentialDiscount;
        finalPrice = potentialPrice;
        bestOffer = offer;
      }
    });

    return {
      finalPrice: Math.round(finalPrice), // Round to avoid decimal issues
      regularPrice: product.regularPrice,
      offer: bestOffer,
      totalDiscount: Math.round(maxDiscount),
      discountPercentage: bestOffer ? bestOffer.percentage : null,
    };
  } catch (error) {
    console.error('Error in price calculation:', error);
    // Return original prices if calculation fails
    return {
      finalPrice: product.salePrice,
      regularPrice: product.regularPrice,
      offer: null,
      totalDiscount: product.regularPrice - product.salePrice,
      discountPercentage: null,
    };
  }
};

module.exports = {
  calculatePrice,
};
