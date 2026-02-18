const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode ? res.statusCode : 500;

  // Log error details
  logger.error({
    message: err.message,
    stack: err.stack,
    statusCode: statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  return res.status(statusCode).json({
    message: err.message,
  });
};

module.exports = errorHandler;
