/**
 * Client-side logging system that sends logs to server for file storage
 */

class Logger {
    constructor() {
        this.logQueue = [];
        this.isOnline = true;
        this.batchSize = 5;  // Smaller batches
        this.flushInterval = 1000; // 1 second - faster flushing
        
        // Start periodic flushing
        setInterval(() => this.flush(), this.flushInterval);
        
        // Flush on page unload
        window.addEventListener('beforeunload', () => this.flush());
        
        this.info('Logger initialized');
    }
    
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data: data ? JSON.stringify(data) : null,
            url: window.location.pathname,
            userAgent: navigator.userAgent.substring(0, 100)
        };
        
        // Also log to console for immediate feedback
        const consoleMethod = level === 'error' ? 'error' : 
                             level === 'warn' ? 'warn' : 'log';
        console[consoleMethod](`[${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
        
        this.logQueue.push(logEntry);
        
        // Auto-flush if queue is getting full
        if (this.logQueue.length >= this.batchSize) {
            this.flush();
        }
    }
    
    info(message, data = null) {
        this.log('info', message, data);
    }
    
    warn(message, data = null) {
        this.log('warn', message, data);
    }
    
    error(message, data = null) {
        this.log('error', message, data);
    }
    
    debug(message, data = null) {
        this.log('debug', message, data);
    }
    
    async flush() {
        if (this.logQueue.length === 0 || !this.isOnline) {
            return;
        }
        
        const logsToSend = [...this.logQueue];
        this.logQueue = [];
        
        try {
            const response = await fetch('/api/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ logs: logsToSend })
            });
            
            if (!response.ok) {
                console.warn('Failed to send logs to server:', response.status);
                // Put logs back in queue to retry later
                this.logQueue.unshift(...logsToSend);
            }
        } catch (error) {
            console.warn('Error sending logs to server:', error);
            this.isOnline = false;
            // Put logs back in queue
            this.logQueue.unshift(...logsToSend);
            
            // Try to reconnect after a delay
            setTimeout(() => {
                this.isOnline = true;
            }, 10000);
        }
    }
}

// Create global logger instance
window.logger = new Logger();

// Override console methods to also log to file
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
};

console.log = function(...args) {
    originalConsole.log.apply(console, args);
    // Convert all arguments to strings and capture objects
    const message = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return '[Object: ' + Object.prototype.toString.call(arg) + ']';
            }
        }
        return String(arg);
    }).join(' ');
    window.logger.info(message);
};

console.warn = function(...args) {
    originalConsole.warn.apply(console, args);
    const message = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return '[Object: ' + Object.prototype.toString.call(arg) + ']';
            }
        }
        return String(arg);
    }).join(' ');
    window.logger.warn(message);
};

console.error = function(...args) {
    originalConsole.error.apply(console, args);
    const message = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return '[Object: ' + Object.prototype.toString.call(arg) + ']';
            }
        }
        return String(arg);
    }).join(' ');
    window.logger.error(message);
};

// Capture unhandled errors
window.addEventListener('error', (event) => {
    window.logger.error(`Unhandled error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
    });
});

// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    window.logger.error(`Unhandled promise rejection: ${event.reason}`, {
        promise: event.promise
    });
});