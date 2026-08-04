const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

dotenv.config();
connectDB();

const app = express();

// Security and utility middlewares
app.use(helmet());
const allowedOrigins = [
  'http://localhost:5173',
  'https://qr-studio-frontend-3nmi.vercel.app',
  'https://qr-studio-frontend-3nmi-git-main-aftabmumtaz123s-projects.vercel.app'
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const qrRoutes = require('./routes/qrRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const { dynamicRedirect } = require('./controllers/qrController');

// Routing setup
app.get('/api/health', (req, res) => {
  res.json({ message: 'API is running... 🚀' });
});

app.use('/api/qr', qrRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/media', mediaRoutes);
app.get('/d/:code', dynamicRedirect);

// Advanced Error Handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
