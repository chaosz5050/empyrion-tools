/**
 * Simple logger that captures console output to file
 */

// Simple function to send logs to server
function logToFile(level, message) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: level,
        message: message,
        url: window.location.pathname
    };
    
    // Send immediately, don't queue
    fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: [logEntry] })
    }).catch(err => {
        // Ignore logging errors to avoid recursion
    });
}

// Store original console methods
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

// Override console methods
console.log = function(...args) {
    origLog.apply(console, args);
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logToFile('info', message);
};

console.warn = function(...args) {
    origWarn.apply(console, args);
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logToFile('warn', message);
};

console.error = function(...args) {
    origError.apply(console, args);
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logToFile('error', message);
};

// Capture unhandled errors
window.addEventListener('error', (event) => {
    logToFile('error', `Unhandled error: ${event.message} at ${event.filename}:${event.lineno}`);
});

console.log('Simple logger initialized');