const User = require('../models/userSchema');

const userAuth = (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user)
      .then((data) => {
        if (data && !data.isBlocked && !data.isAdmin) {
          next();
        } else {
          res.redirect('/login');
        }
      })
      .catch((error) => {
        console.log('error in user auth middleware');
        res.status(500).send('internal server error');
      });
  } else {
    res.redirect('/login');
  }
};

const adminAuth = (req, res, next) => {
  if (req.session.admin) {
    User.findById(req.session.admin)
      .then((data) => {
        if (data && data.isAdmin) {
          next();
        } else {
          res.redirect('/admin/login');
        }
      })
      .catch((error) => {
        console.log('Error in admin auth middleware:', error);
        res.status(500).send('internal server error');
      });
  } else {
    res.redirect('/admin/login');
  }
};

const preventCache = (req, res, next) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

module.exports = {
  userAuth,
  adminAuth,
  preventCache,
};
