const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const crypto = require('crypto');
const razorpay = require('../../config/razorpay');
const { StatusCode, Messages } = require('../../utils/statusCodes');

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
    res.status(StatusCode.INTERNAL_SERVER).render('pageNotFound', {
      message: Messages.INTERNAL_ERROR,
      error: error,
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { payment, order } = req.body;
    const userId = req.session.user._id;

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(order.id + '|' + payment.razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

  
    if (generated_signature === payment.razorpay_signature) {
      
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

      
      wallet.transactions.push({
        type: 'credit',
        amount: amount,
        description: 'money_added',
        date: new Date(),
      });

      await wallet.save();

      res.status(StatusCode.OK).json({
        success: true,
        message: Messages.SUCCESS,
      });
    } else {
      throw new Error('Payment verification failed');
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(StatusCode.BAD_REQUEST).json({
      success: false,
      message: Messages.INVALID_REQUEST,
    });
  }
};

const initiateAddMoney = async (req, res) => {
  try {
    const { amount } = req.body;

    // Validate amount
    if (!amount || amount < 5) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: Messages.VALIDATION_ERROR,
      });
    }

    // Create Razorpay order
    const options = {
      amount: amount * 100, 
      currency: 'INR',
      receipt: 'wallet_' + Date.now(),
    };

    const order = await razorpay.orders.create(options);

    res.status(StatusCode.OK).json({
      success: true,
      order,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Error initiating add money:', error);
    res.status(StatusCode.INTERNAL_SERVER).json({
      success: false,
      message: Messages.INTERNAL_ERROR,
    });
  }
};

module.exports = {
  getWallet,
  initiateAddMoney,
  verifyPayment,
};
