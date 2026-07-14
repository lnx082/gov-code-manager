/**
 * 速率限制中间件（登录限流/API 限流）
 *
 * 【功能】登录接口限流（5次/分钟）、通用 API 限流（100次/分钟）
 * 【数据】不操作数据库，基于内存计数
 * 【来源】express-rate-limit 内存存储
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
