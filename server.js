const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

dotenv.config();

const app = express();

const allowedOrigins = [
  'https://qr-studio-xi-three.vercel.app',
  'http://localhost:5173',
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(helmet());

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(morgan('dev'));

// Health checks
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'QR Studio API is running',
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    message: 'API is running',
  });
});

// Routes
const qrRoutes = require('./routes/qrRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const shortURLRoutes = require('./routes/shortURLRoutes');

const { dynamicRedirect } = require('./controllers/qrController');
const { shortRedirect } = require('./controllers/shortURLController');

app.use('/api/qr', qrRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/short-urls', shortURLRoutes);

app.get('/d/:code', dynamicRedirect);
app.get('/s/:code', shortRedirect);

// Error handling must remain last
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, () => {
  console.log(`Server running in ${ process.env.NODE_ENV || 'development' } mode on port ${ PORT } `);
});