const rateLimit = require('express-rate-limit');

/**
 * Standard API rate limiter.
 * 100 requests per 15-minute window per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});

/**
 * Stricter rate limiter for authentication routes.
 * 20 requests per 15-minute window per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
});

/**
 * Rate limiter for location updates (high frequency).
 * 300 requests per 5-minute window per IP.
 */
const locationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many location updates, please reduce update frequency.',
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  locationLimiter,
};
