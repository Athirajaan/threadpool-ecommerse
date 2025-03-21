const express = require('express');
const app = express();
const env = require('dotenv').config();
const session = require('express-session');
const passport = require('./config/passport');
const connectDb = require('./config/databse');
const path = require('path');
const { cartQuantityMiddleware } = require('./middlewares/cart');

const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');

const port = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, 
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.set('cache-control', 'no-store');
  next();
});

app.set('view engine', 'ejs');
app.set('views', [
  path.join(__dirname, 'views/user'),
  path.join(__dirname, 'views/admin'),
  path.join(__dirname, 'views/partials'),
]);

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.locals.isLoggedIn = req.session && req.session.userId ? true : false;
  next();
});

app.use(cartQuantityMiddleware);

app.use('/', userRouter);
app.use('/admin', adminRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(err.status || 500);
  res.render('error', { 
    message: err.message || 'Internal Server Error',
    status: err.status || 500
  });
});


connectDb()
  .then(() => {
    console.log('database connection established..');
    app.listen(port, '0.0.0.0', () => {
      console.log('Server running on port', port);
    });
  })
  .catch((err) => {
    console.error('databse canot be connected', err);
  });
