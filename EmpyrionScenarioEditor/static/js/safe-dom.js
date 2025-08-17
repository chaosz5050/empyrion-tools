/**
 * Safe DOM Manipulation Utilities
 * 
 * Provides null-safe DOM manipulation with comprehensive error handling,
 * graceful degradation, and performance safeguards for the Empyrion Scenario Editor.
 */

/**
 * Enhanced logging utility for client-side error tracking
 */
class SafeLogger {
    constructor() {
        this.errorCount = 0;
        this.warningCount = 0;
        this.maxErrors = 100; // Prevent log spam
        this.startTime = performance.now();
    }
    
    /**
     * Log error with context and optional user notification
     */
    error(message, context = {}, showToUser = false) {
        if (this.errorCount >= this.maxErrors) return;
        
        this.errorCount++;
        const errorData = {
            level: 'ERROR',
            message,
            context,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent.substring(0, 100),
            stack: new Error().stack
        };
        
        console.error('SafeDOM Error:', message, context);
        
        // Send to server logging if available
        this.sendToServer(errorData);
        
        // Show user-friendly message if requested
        if (showToUser) {
            this.showUserError(message);
        }
    }
    
    /**
     * Log warning with context
     */
    warn(message, context = {}) {
        if (this.warningCount >= this.maxErrors) return;
        
        this.warningCount++;
        console.warn('SafeDOM Warning:', message, context);
        
        this.sendToServer({
            level: 'WARNING',
            message,
            context,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * Log info message
     */
    info(message, context = {}) {
        console.log('SafeDOM Info:', message, context);
    }
    
    /**
     * Send log data to server endpoint
     */
    sendToServer(logData) {
        try {
            // Only send if server logging endpoint exists
            if (typeof fetch !== 'undefined') {
                fetch('/api/logs/client', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(logData)
                }).catch(() => {}); // Silent fail - don't break UI for logging
            }
        } catch (e) {
            // Silent fail - logging shouldn't break the application
        }
    }
    
    /**
     * Show user-friendly error message
     */
    showUserError(message) {
        try {
            // Try to show in existing error container
            const errorContainer = document.getElementById('error-message');
            if (errorContainer) {
                errorContainer.textContent = `Error: ${message}`;
                errorContainer.style.display = 'block';
                
                // Auto-hide after 5 seconds
                setTimeout(() => {
                    errorContainer.style.display = 'none';
                }, 5000);
            }
        } catch (e) {
            // Fallback to alert if DOM manipulation fails
            alert(`Error: ${message}`);
        }
    }
}

// Global safe logger instance
const safeLogger = new SafeLogger();

/**
 * Safe DOM manipulation utilities with comprehensive error handling
 */
class SafeDOM {
    /**
     * Safely get element by ID with null checking
     * @param {string} elementId - Element ID to find
     * @param {boolean} required - Whether element is required (logs error if missing)
     * @returns {HTMLElement|null} Element or null if not found
     */
    static getElementById(elementId, required = false) {
        try {
            if (!elementId || typeof elementId !== 'string') {
                safeLogger.warn('Invalid element ID provided', { elementId, type: typeof elementId });
                return null;
            }
            
            const element = document.getElementById(elementId);
            
            if (!element && required) {
                safeLogger.error(`Required element not found: ${elementId}`, { elementId });
            }
            
            return element;
        } catch (error) {
            safeLogger.error('Error getting element by ID', { elementId, error: error.message });
            return null;
        }
    }
    
    /**
     * Safely set text content with validation and fallback
     * @param {string} elementId - Element ID
     * @param {any} text - Text content to set
     * @param {string} fallback - Fallback text if value is invalid
     * @returns {boolean} True if successful
     */
    static setTextContent(elementId, text, fallback = 'N/A') {
        const element = this.getElementById(elementId);
        if (!element) {
            safeLogger.warn('Cannot set text content - element not found', { elementId });
            return false;
        }
        
        try {
            // Validate and sanitize text content
            let safeText = text;
            
            if (text === null || text === undefined) {
                safeText = fallback;
            } else if (typeof text !== 'string') {
                safeText = String(text);
            }
            
            // Limit text length to prevent UI issues
            if (safeText.length > 10000) {
                safeText = safeText.substring(0, 10000) + '...';
                safeLogger.warn('Text content truncated due to length', { 
                    elementId, 
                    originalLength: text.length 
                });
            }
            
            element.textContent = safeText;
            return true;
            
        } catch (error) {
            safeLogger.error('Error setting text content', { 
                elementId, 
                error: error.message 
            });
            
            // Fallback: try to set fallback text
            try {
                element.textContent = fallback;
                return true;
            } catch (fallbackError) {
                safeLogger.error('Failed to set fallback text', { 
                    elementId, 
                    fallbackError: fallbackError.message 
                });
                return false;
            }
        }
    }
    
    /**
     * Safely set HTML content with XSS protection
     * @param {string} elementId - Element ID
     * @param {string} html - HTML content to set
     * @param {boolean} allowUnsafe - Whether to allow potentially unsafe HTML
     * @returns {boolean} True if successful
     */
    static setInnerHTML(elementId, html, allowUnsafe = false) {
        const element = this.getElementById(elementId);
        if (!element) {
            safeLogger.warn('Cannot set innerHTML - element not found', { elementId });
            return false;
        }
        
        try {
            if (!html) {
                element.innerHTML = '';
                return true;
            }
            
            let safeHTML = html;
            
            // Basic XSS protection unless explicitly allowed
            if (!allowUnsafe) {
                safeHTML = this.sanitizeHTML(html);
            }
            
            // Limit HTML length
            if (safeHTML.length > 50000) {
                safeHTML = safeHTML.substring(0, 50000) + '<!-- Content truncated -->';
                safeLogger.warn('HTML content truncated due to length', { 
                    elementId, 
                    originalLength: html.length 
                });
            }
            
            element.innerHTML = safeHTML;
            return true;
            
        } catch (error) {
            safeLogger.error('Error setting innerHTML', { 
                elementId, 
                error: error.message 
            });
            
            // Fallback: set as text content
            try {
                element.textContent = 'Content could not be displayed safely';
                return false;
            } catch (fallbackError) {
                return false;
            }
        }
    }
    
    /**
     * Basic HTML sanitization to prevent XSS
     * @param {string} html - HTML string to sanitize
     * @returns {string} Sanitized HTML
     */
    static sanitizeHTML(html) {
        // Basic sanitization - remove script tags and event handlers
        let sanitized = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+="[^"]*"/gi, '')
            .replace(/on\w+='[^']*'/gi, '')
            .replace(/on\w+=\w+/gi, '');
        
        return sanitized;
    }
    
    /**
     * Safely add event listener with error handling
     * @param {string} elementId - Element ID
     * @param {string} eventType - Event type (click, change, etc.)
     * @param {function} handler - Event handler function
     * @param {string} description - Description for logging
     * @returns {boolean} True if successful
     */
    static addEventListener(elementId, eventType, handler, description = '') {
        const element = this.getElementById(elementId);
        if (!element) {
            safeLogger.warn('Cannot add event listener - element not found', { 
                elementId, 
                eventType, 
                description 
            });
            return false;
        }
        
        try {
            if (typeof handler !== 'function') {
                safeLogger.error('Event handler is not a function', { 
                    elementId, 
                    eventType, 
                    handlerType: typeof handler 
                });
                return false;
            }
            
            // Wrap handler with error handling
            const safeHandler = (event) => {
                try {
                    handler(event);
                } catch (error) {
                    safeLogger.error('Error in event handler', {
                        elementId,
                        eventType,
                        description,
                        error: error.message,
                        stack: error.stack
                    }, true); // Show to user
                }
            };
            
            element.addEventListener(eventType, safeHandler);
            
            safeLogger.info('Event listener added successfully', {
                elementId,
                eventType,
                description
            });
            
            return true;
            
        } catch (error) {
            safeLogger.error('Error adding event listener', {
                elementId,
                eventType,
                description,
                error: error.message
            });
            return false;
        }
    }
    
    /**
     * Safely update multiple elements with scenario metadata
     * @param {Object} metadata - Scenario metadata object
     * @returns {boolean} True if all updates successful
     */
    static updateScenarioMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object') {
            safeLogger.error('Invalid metadata object provided', { metadata });
            return false;
        }
        
        const updates = [
            { id: 'scenario-name', value: metadata.name, required: true },
            { id: 'scenario-game-mode', value: metadata.game_mode, fallback: 'Unknown' },
            { id: 'scenario-multiplayer', value: metadata.multiplayer_ready ? 'Yes' : 'No' },
            { id: 'scenario-path', value: metadata.path, fallback: 'Unknown path' }
        ];
        
        let allSuccessful = true;
        const results = [];
        
        updates.forEach(({ id, value, fallback, required }) => {
            const success = this.setTextContent(id, value, fallback);
            results.push({ id, success });
            
            if (!success) {
                allSuccessful = false;
                if (required) {
                    safeLogger.error(`Failed to update required metadata field: ${id}`, { id, value });
                }
            }
        });
        
        safeLogger.info('Scenario metadata update completed', {
            allSuccessful,
            results: results.filter(r => !r.success)
        });
        
        return allSuccessful;
    }
    
    /**
     * Safely show/hide elements with validation
     * @param {string} elementId - Element ID
     * @param {boolean} visible - Whether element should be visible
     * @returns {boolean} True if successful
     */
    static setVisibility(elementId, visible) {
        const element = this.getElementById(elementId);
        if (!element) {
            return false;
        }
        
        try {
            element.style.display = visible ? 'block' : 'none';
            return true;
        } catch (error) {
            safeLogger.error('Error setting element visibility', {
                elementId,
                visible,
                error: error.message
            });
            return false;
        }
    }
    
    /**
     * Safely add CSS class to element
     * @param {string} elementId - Element ID
     * @param {string} className - CSS class name to add
     * @returns {boolean} True if successful
     */
    static addClass(elementId, className) {
        const element = this.getElementById(elementId);
        if (!element || !className) {
            return false;
        }
        
        try {
            element.classList.add(className);
            return true;
        } catch (error) {
            safeLogger.error('Error adding CSS class', {
                elementId,
                className,
                error: error.message
            });
            return false;
        }
    }
    
    /**
     * Safely remove CSS class from element
     * @param {string} elementId - Element ID
     * @param {string} className - CSS class name to remove
     * @returns {boolean} True if successful
     */
    static removeClass(elementId, className) {
        const element = this.getElementById(elementId);
        if (!element || !className) {
            return false;
        }
        
        try {
            element.classList.remove(className);
            return true;
        } catch (error) {
            safeLogger.error('Error removing CSS class', {
                elementId,
                className,
                error: error.message
            });
            return false;
        }
    }
    
    /**
     * Performance monitoring for DOM operations
     * @param {string} operationName - Name of the operation
     * @param {function} operation - Function to execute
     * @returns {any} Result of the operation
     */
    static withPerformanceMonitoring(operationName, operation) {
        const startTime = performance.now();
        
        try {
            const result = operation();
            
            const duration = performance.now() - startTime;
            if (duration > 100) { // Log slow operations
                safeLogger.warn('Slow DOM operation detected', {
                    operationName,
                    duration: `${duration.toFixed(2)}ms`
                });
            }
            
            return result;
            
        } catch (error) {
            const duration = performance.now() - startTime;
            safeLogger.error('DOM operation failed', {
                operationName,
                duration: `${duration.toFixed(2)}ms`,
                error: error.message
            });
            throw error;
        }
    }
}

/**
 * Batch DOM operations for better performance
 */
class BatchDOMUpdater {
    constructor() {
        this.updates = [];
        this.isScheduled = false;
    }
    
    /**
     * Schedule a DOM update to be batched
     * @param {function} updateFunction - Function that performs DOM updates
     */
    schedule(updateFunction) {
        this.updates.push(updateFunction);
        
        if (!this.isScheduled) {
            this.isScheduled = true;
            requestAnimationFrame(() => this.flush());
        }
    }
    
    /**
     * Execute all batched updates
     */
    flush() {
        try {
            this.updates.forEach((update, index) => {
                try {
                    update();
                } catch (error) {
                    safeLogger.error('Error in batched DOM update', {
                        updateIndex: index,
                        error: error.message
                    });
                }
            });
        } finally {
            this.updates = [];
            this.isScheduled = false;
        }
    }
}

// Global batch updater instance
const batchDOMUpdater = new BatchDOMUpdater();

// Export for use in other modules
window.SafeDOM = SafeDOM;
window.safeLogger = safeLogger;
window.batchDOMUpdater = batchDOMUpdater;