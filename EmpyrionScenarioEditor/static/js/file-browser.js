/**
 * File Browser JavaScript
 * Handles directory navigation and scenario loading
 */

// Global state
let currentPath = '';
let currentScenario = null;

// Utility functions for API calls
async function apiCall(endpoint, params = {}) {
    const url = new URL(endpoint, window.location.origin);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
}

// Directory navigation functions
async function navigateToDirectory(path) {
    try {
        console.log(`Navigating to directory: ${path}`);
        showLoading();
        const data = await apiCall('/api/browse', { path });
        
        console.log('Directory API call successful:', data);
        
        currentPath = data.path;
        displayDirectoryContents(data);
        hideScenarioPreview();
        
    } catch (error) {
        console.error(`Error browsing directory: ${error.message}`, error);
        showError(`Error browsing directory: ${error.message}`);
    }
}

function displayDirectoryContents(data) {
    const listing = document.getElementById('directory-listing');
    const pathElement = document.getElementById('current-path');
    const parentBtn = document.getElementById('parent-dir-btn');
    
    // Update UI elements
    pathElement.textContent = data.path;
    parentBtn.disabled = !data.parent;
    
    // Clear and populate directory listing
    listing.innerHTML = '';
    
    if (data.contents.length === 0) {
        listing.innerHTML = '<div class="loading">Directory is empty</div>';
        return;
    }
    
    data.contents.forEach(item => {
        const itemElement = createDirectoryItem(item);
        listing.appendChild(itemElement);
    });
    
    console.log(`Displayed ${data.contents.length} directory items`);
}

function createDirectoryItem(item) {
    const itemElement = document.createElement('div');
    itemElement.className = `directory-item ${item.is_scenario ? 'scenario' : ''}`;
    
    // Set click handler
    itemElement.onclick = () => {
        if (item.is_scenario) {
            loadScenario(item.path);
        } else {
            navigateToDirectory(item.path);
        }
    };
    
    // Set content
    const icon = item.is_scenario ? '🚀' : '📁';
    const type = item.is_scenario ? 'scenario' : 'directory';
    
    itemElement.innerHTML = `
        <div class="directory-icon ${type}">${icon}</div>
        <div class="directory-name">${escapeHtml(item.name)}</div>
        <div class="directory-type">${type}</div>
    `;
    
    return itemElement;
}

// Scenario loading functions
async function loadScenario(path) {
    try {
        console.log(`Starting to load scenario: ${path}`);
        // Don't call showLoading() here - it clears the directory listing
        const data = await apiCall('/api/scenario/load', { path });
        
        console.log('Scenario API call successful:', data);
        
        currentScenario = data;
        displayScenarioPreview(data);
        showSuccess(`Loaded scenario: ${data.metadata.name}`);
        
    } catch (error) {
        console.error(`Error loading scenario: ${error.message}`, error);
        showError(`Error loading scenario: ${error.message}`);
        hideScenarioPreview();
    }
}

function displayScenarioPreview(data) {
    console.log('Displaying scenario preview');
    
    const preview = document.getElementById('scenario-preview');
    const browser = document.querySelector('.file-browser');
    const metadata = data.metadata;
    
    // Update metadata section
    updateScenarioMetadata(metadata);
    
    // Update tab content
    updateDescriptionTab(metadata.description);
    updateGameOptionsTab(data.files);
    updateStructureTab(data.structure);
    updateGalaxyTab(data);
    updateFilesTab(data.files);
    
    // Hide directory browser and show scenario preview
    if (browser) browser.style.display = 'none';
    preview.style.display = 'block';
    
    // Reset to first tab
    showTab('description');
}

function updateScenarioMetadata(metadata) {
    // Use SafeDOM for robust metadata updates
    const success = SafeDOM.updateScenarioMetadata(metadata);
    
    if (!success) {
        safeLogger.warn('Some scenario metadata could not be updated', { metadata });
        // Show partial failure message to user
        showError('Some scenario information could not be displayed');
    }
}

function updateDescriptionTab(description) {
    const descElement = document.getElementById('scenario-description');
    
    if (description) {
        // Parse BBCode and set as HTML
        const formattedDescription = formatScenarioDescription(description);
        descElement.innerHTML = formattedDescription;
        
        // Remove the code-block class and add description-content class for better styling
        descElement.className = 'description-content';
    } else {
        descElement.textContent = 'No description available';
        descElement.className = 'code-block';
    }
}

function updateGameOptionsTab(files) {
    // Initialize the game options manager with scenario data
    if (typeof updateGameOptionsManager === 'function' && files['Game Options']) {
        updateGameOptionsManager({ files: files });
    } else {
        console.log('Game options manager not available or no game options data found');
    }
}

function updateStructureTab(structure) {
    document.getElementById('structure-playfields').textContent = structure.playfields_count || 0;
    document.getElementById('structure-prefabs').textContent = structure.prefabs_count || 0;
    document.getElementById('structure-content').textContent = structure.has_content ? 'Yes' : 'No';
    document.getElementById('structure-configs').textContent = structure.has_custom_configs ? 'Yes' : 'No';
    
    const directoriesElement = document.getElementById('structure-directories');
    directoriesElement.textContent = structure.directories?.join('\n') || 'No subdirectories';
}

function updateFilesTab(files) {
    const filesElement = document.getElementById('scenario-files');
    
    if (Object.keys(files).length === 0) {
        filesElement.innerHTML = '<div class="loading">No configuration files loaded</div>';
        return;
    }
    
    let filesHtml = '';
    Object.entries(files).forEach(([name, file]) => {
        filesHtml += `<h4>${escapeHtml(name)}</h4>`;
        
        if (file.type === 'error') {
            filesHtml += `<div class="error">Error: ${escapeHtml(file.error)}</div>`;
        } else {
            const content = typeof file.content === 'object' 
                ? JSON.stringify(file.content, null, 2)
                : file.content;
            filesHtml += `<div class="code-block">${escapeHtml(content)}</div>`;
        }
    });
    
    filesElement.innerHTML = filesHtml;
}

function updateGalaxyTab(scenarioData) {
    // Load galaxy data into the 3D viewer
    console.log('SCENARIO DATA FILES:', Object.keys(scenarioData.files || {}));
    
    if (typeof loadGalaxyData === 'function') {
        loadGalaxyData(scenarioData);
    } else {
        console.log('Galaxy viewer not loaded yet - will initialize when tab is shown');
    }
}

// Navigation helper functions
function navigateToParent() {
    if (currentPath && currentPath !== '/') {
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
        navigateToDirectory(parentPath);
    }
}

function refreshCurrentDirectory() {
    if (currentPath) {
        navigateToDirectory(currentPath);
    }
}

// Tab management
function showTab(tabName, buttonElement) {
    console.log(`Switching to tab: ${tabName}`);
    
    // Hide all tab panes
    const tabs = document.querySelectorAll('.tab-pane');
    tabs.forEach(tab => tab.style.display = 'none');
    
    // Remove active class from all buttons
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    const selectedTab = document.getElementById(`tab-${tabName}`);
    if (selectedTab) {
        selectedTab.style.display = 'block';
        
        // Initialize galaxy viewer if galaxy tab is shown for the first time
        if (tabName === 'galaxy') {
            console.log('Galaxy tab selected, checking initialization');
            
            if (typeof initGalaxyViewer === 'function') {
                console.log('initGalaxyViewer function found, calling it');
                // Longer delay to ensure the tab is fully visible and has dimensions
                setTimeout(() => {
                    try {
                        // Check container dimensions before initializing
                        const container = document.getElementById('galaxy-viewer-container');
                        if (container) {
                            const rect = container.getBoundingClientRect();
                            console.log('Container dimensions:', rect.width, 'x', rect.height);
                            
                            if (rect.width === 0 || rect.height === 0) {
                                console.warn('Container has zero dimensions, forcing layout');
                                container.style.width = '100%';
                                container.style.height = '600px';
                            }
                        }
                        
                        initGalaxyViewer();
                        
                        // Force resize after initialization
                        setTimeout(() => {
                            if (typeof galaxyViewer !== 'undefined' && galaxyViewer && galaxyViewer.onWindowResize) {
                                console.log('Forcing galaxy viewer resize');
                                galaxyViewer.onWindowResize();
                            }
                        }, 100);
                        
                        // Load current scenario data if available
                        if (currentScenario) {
                            console.log('Loading scenario data into galaxy viewer');
                            updateGalaxyTab(currentScenario);
                        } else {
                            console.log('No scenario data available yet');
                        }
                    } catch (error) {
                        console.error('Error initializing galaxy viewer', error);
                    }
                }, 300); // Increased delay
            } else {
                console.error('initGalaxyViewer function not found! Galaxy viewer JS may not be loaded');
            }
        }
    } else {
        console.error(`Tab element not found: tab-${tabName}`);
    }
    
    // Add active class to clicked button (if provided) or find it by tab name
    if (buttonElement) {
        buttonElement.classList.add('active');
    } else {
        // Find the button by matching the tab name
        const targetButton = Array.from(buttons).find(btn => 
            btn.textContent.includes(getTabDisplayName(tabName))
        );
        if (targetButton) {
            targetButton.classList.add('active');
        }
    }
}

// Helper function to get display name for tab
function getTabDisplayName(tabName) {
    const tabNames = {
        'description': 'Description',
        'gameoptions': 'Game Options', 
        'structure': 'Structure',
        'galaxy': 'Galaxy View',
        'files': 'All Files'
    };
    return tabNames[tabName] || tabName;
}

// UI state management
function hideScenarioPreview() {
    document.getElementById('scenario-preview').style.display = 'none';
}

function showDirectoryBrowser() {
    const preview = document.getElementById('scenario-preview');
    const browser = document.querySelector('.file-browser');
    
    preview.style.display = 'none';
    if (browser) browser.style.display = 'block';
}

function showLoading() {
    const listing = document.getElementById('directory-listing');
    listing.innerHTML = '<div class="loading">Loading...</div>';
}

function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const successElement = document.getElementById('success-message');
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    setTimeout(() => {
        successElement.style.display = 'none';
    }, 3000);
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting app');
    
    // Setup event listeners
    setupEventListeners();
    
    // Start in the current directory (where the app is running) or specified path
    const startPath = new URLSearchParams(window.location.search).get('path') || '.';
    console.log(`Starting navigation to: ${startPath}`);
    navigateToDirectory(startPath);
});

function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Parent directory button
    const parentBtn = document.getElementById('parent-dir-btn');
    if (parentBtn) {
        parentBtn.addEventListener('click', navigateToParent);
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshCurrentDirectory);
    }
    
    // Back to directory button
    const backBtn = document.getElementById('back-to-directory-btn');
    if (backBtn) {
        backBtn.addEventListener('click', showDirectoryBrowser);
    }
    
    // Tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    console.log(`Found ${tabButtons.length} tab buttons`);
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            if (tabName) {
                showTab(tabName, this);
            }
        });
    });
    
    console.log('Event listeners setup complete');
}