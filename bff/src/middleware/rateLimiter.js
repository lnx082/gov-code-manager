/**
 * 速率限制中间件（登录限流/API 限流）
 */
import rateLimit from 'express-rate-limit';

// 登录限流：每分钟5次
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 5, // 5次
  message: {
    code: 429,
    message: '登录尝试过于频繁，请稍后再试',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API 限流：每分钟100次
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
