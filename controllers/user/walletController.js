const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const crypto = require('crypto');
const razorpay = require('../../config/razorpay');

const getWallet = async (req, res) => {
  try {
    const user = req.session.user;
    const wallet = await Wallet.findOne({ userId: user._id });

    res.render('wallet', {
      user,
      wallet: wallet || { balance: 0, transactions: [] },
    });
  } catch (error) {
    console.error('Error in getWallet controller:', error);
    res.status(500).render('pageNotFound', {
      message: 'Error loading wallet page',
      error: error,
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { payment, order } = req.body;
    const userId = req.session.user._id;

    // Create signature hash to verify payment
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(order.id + '|' + payment.razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    // Verify signature
    if (generated_signature === payment.razorpay_signature) {
      // Find or create wallet for the user
      let wallet = await Wallet.findOne({ userId: userId });

      if (!wallet) {
        wallet = new Wallet({
          userId: userId,
          balance: 0,
          transactions: [],
        });
      }

      // Add amount to wallet
      const amount = order.amount / 100; // Convert from paise to rupees
      wallet.balance += amount;

      // Add transaction record
      wallet.transactions.push({
        type: 'credit',
        amount: amount,
        description: 'money_added',
        date: new Date(),
      });

      await wallet.save();

      res.json({
        success: true,
        message: 'Payment verified and wallet updated successfully',
      });
    } else {
      throw new Error('Payment verification failed');
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Payment verification failed',
    });
  }
};

const initiateAddMoney = async (req, res) => {
  try {
    const { amount } = req.body;

    // Validate amount
    if (!amount || amount < 5) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least ₹5',
      });
    }

    // Create Razorpay order
    const options = {
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: 'wallet_' + Date.now(),
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Error initiating add money:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
    });
  }
};

module.exports = {
  getWallet,
  initiateAddMoney,
  verifyPayment,
};
