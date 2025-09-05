require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const translateRoutes = require('./routes/translate');
const generatorRoutes = require('./routes/generator');
const progressRoutes  = require('./routes/progress');

const app = express();

app.set('trust proxy', 1);
app.disable('etag'); // Disable 304 caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store'); // Force fresh body
  next();
});

app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));

// CORS: allowlist without trailing slashes
const allowed = (process.env.CORS_ORIGINS || 'http://localhost:4200')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowed.some(a => origin.startsWith(a))) return cb(null, true);
    return cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
app.options('*', cors());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() });
});

// Route mounting
app.use('/translate', translateRoutes);
app.use('/generator', generatorRoutes);
app.use('/progress', progressRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.originalUrl }));

// Error handler
app.use((err, req, res, next) => {
  console.error('ERROR', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
