import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 login attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
});

export const importLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 import requests per 5 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many company import requests. Please slow down and try again shortly.' },
});
