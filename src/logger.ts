import * as winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, stack }) => {
            if (stack) {
                return `${timestamp} [${level}]: ${message}\n${stack}`;
            }
            return `${timestamp} [${level}]: ${message}`;
        })
    ),
    transports: [
        // Console transport for development
        new winston.transports.Console({
            handleExceptions: true,
            handleRejections: true
        }),
        
        // File transport for persistent logging
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            handleExceptions: true,
            handleRejections: true
        }),
        
        // Combined log file
        new winston.transports.File({
            filename: 'logs/combined.log',
            handleExceptions: true,
            handleRejections: true
        })
    ]
});

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Add request logging middleware
const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 400 ? 'error' : 'info';
        
        logger.log(logLevel, `${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
};

// Extend logger with request middleware
const extendedLogger = logger as winston.Logger & {
    requestLogger: (req: Request, res: Response, next: NextFunction) => void;
};

extendedLogger.requestLogger = requestLogger;

export default extendedLogger;