import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth';
import companiesRoutes from './routes/companies';
import adminRoutes from './routes/admin';

const app = express();

// Middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CORS configuration: allow Vite local dev and production origin
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow localhost, vercel preview domains, and same-origin requests
      if (!origin || origin.startsWith('http://localhost') || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Company Career Directory API',
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/admin', adminRoutes);

// Global 404 handler for API routes
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'API route not found' });
  } else {
    res.status(404).send('Not Found');
  }
});

export default app;
