require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const sessionRoutes = require('./routes/sessionRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded QR images as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'client')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', sessionRoutes);

// Catch-all: serve index.html for any unmatched route (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ─── Database + Server Start ──────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅  MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀  SplitPay server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  });
