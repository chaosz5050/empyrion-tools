/**
 * Game Options Manager - Interactive form for editing Empyrion game settings
 */

class GameOptionsManager {
    constructor() {
        this.currentScenarioOptions = {};
        this.validForGroups = []; // Array of ValidFor groups from scenario
        this.activeValidForIndex = 0; // Currently selected ValidFor group
        this.searchTimeout = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderOptionsForm();
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('options-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.filterOptions(e.target.value);
                }, 300);
            });
        }

        // Close tooltips when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.help-btn') && !e.target.closest('.option-tooltip')) {
                document.querySelectorAll('.option-tooltip').forEach(tooltip => {
                    tooltip.style.display = 'none';
                });
            }
        });
    }


    renderOptionsForm() {
        const container = document.getElementById('game-options-content');
        if (!container) return;

        container.innerHTML = '';
        
        // Add ValidFor tabs if we have multiple groups
        if (this.validForGroups.length > 1) {
            const tabsContainer = this.createValidForTabs();
            container.appendChild(tabsContainer);
        }

        // Add category sections
        Object.entries(GAME_OPTIONS_CONFIG).forEach(([categoryKey, category]) => {
            const categorySection = this.createCategorySection(categoryKey, category);
            container.appendChild(categorySection);
        });
    }

    createCategorySection(categoryKey, category) {
        const section = document.createElement('div');
        section.className = 'game-options-category';
        section.dataset.category = categoryKey;

        // Use all options from this category (no profile filtering with ValidFor tabs)
        const visibleOptions = category.options;
        
        if (Object.keys(visibleOptions).length === 0) {
            section.style.display = 'none';
            return section;
        }

        // Category header
        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `
            <div class="category-title">
                <span class="category-icon">${category.icon}</span>
                <h3>${category.title}</h3>
                <span class="category-count">${Object.keys(visibleOptions).length} options</span>
            </div>
            <button class="category-toggle" data-category="${categoryKey}">
                <span class="toggle-icon">▼</span>
            </button>
        `;

        // Category content
        const content = document.createElement('div');
        content.className = 'category-content';

        Object.entries(visibleOptions).forEach(([optionKey, option]) => {
            const optionElement = this.createOptionElement(optionKey, option);
            content.appendChild(optionElement);
        });

        // Toggle functionality
        header.querySelector('.category-toggle').addEventListener('click', () => {
            const isExpanded = content.style.display !== 'none';
            content.style.display = isExpanded ? 'none' : 'block';
            header.querySelector('.toggle-icon').textContent = isExpanded ? '▶' : '▼';
            section.classList.toggle('collapsed', isExpanded);
        });

        section.appendChild(header);
        section.appendChild(content);

        return section;
    }


    createOptionElement(optionKey, option) {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'game-option';
        optionDiv.dataset.option = optionKey;

        // Get effective value (scenario or default)
        const effectiveValue = GameOptionsHelper.getEffectiveValue(optionKey, this.currentScenarioOptions);
        
        // Debug logging for the first few options
        if (Object.keys(this.currentScenarioOptions).length > 0) {
            console.log(`Option ${optionKey}: scenario=${this.currentScenarioOptions[optionKey]}, default=${option.exampleValue}, effective=${JSON.stringify(effectiveValue)}`);
        }

        // Create form control based on option type
        const control = this.createOptionControl(optionKey, option, effectiveValue);

        // Build the complete option element
        optionDiv.innerHTML = `
            <div class="option-header">
                <label class="option-label" for="${optionKey}">
                    ${option.name}
                    ${option.unit ? `<span class="option-unit">(${option.unit})</span>` : ''}
                </label>
                <div class="option-control">
                    ${control}
                </div>
                <div class="option-meta">
                    <span class="value-source ${effectiveValue.source}" title="${effectiveValue.source === 'scenario' ? 'Value from scenario' : 'Default value'}">
                        ${effectiveValue.source === 'scenario' ? '📋' : '⚙️'}
                    </span>
                    <button class="help-btn" data-option="${optionKey}" title="Show help">?</button>
                </div>
            </div>
            <div class="option-tooltip" style="display: none;">
                <div class="tooltip-content">
                    ${option.note}
                    <div class="tooltip-meta">
                        <strong>Default:</strong> ${option.exampleValue}
                        ${option.validFor ? `<br><strong>Valid for:</strong> ${option.validFor.join(', ')}` : ''}
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        this.setupOptionEventListeners(optionDiv, optionKey, option);

        return optionDiv;
    }

    createOptionControl(optionKey, option, effectiveValue) {
        const value = effectiveValue.value;
        const isDefault = effectiveValue.isDefault;

        if (Array.isArray(option.allowedValues)) {
            // Dropdown for predefined values
            let selectHtml = `<select id="${optionKey}" class="option-select ${isDefault ? 'default-value' : 'custom-value'}">`;
            
            option.allowedValues.forEach(allowed => {
                const selected = value == allowed ? 'selected' : '';
                selectHtml += `<option value="${allowed}" ${selected}>${allowed}</option>`;
            });
            
            selectHtml += '</select>';
            return selectHtml;

        } else if (option.allowedValues === 'number') {
            // Number input
            const min = option.allowedRange ? option.allowedRange[0] : '';
            const max = option.allowedRange ? option.allowedRange[1] : '';
            
            return `
                <input type="number" 
                       id="${optionKey}" 
                       class="option-input ${isDefault ? 'default-value' : 'custom-value'}"
                       value="${value}"
                       ${min !== '' ? `min="${min}"` : ''}
                       ${max !== '' ? `max="${max}"` : ''}
                >
            `;

        } else if (option.allowedValues === 'range') {
            // Range input with number display
            const min = option.allowedRange[0];
            const max = option.allowedRange[1];
            
            return `
                <div class="range-control">
                    <input type="range" 
                           id="${optionKey}" 
                           class="option-range ${isDefault ? 'default-value' : 'custom-value'}"
                           value="${value}"
                           min="${min}"
                           max="${max}"
                    >
                    <input type="number" 
                           id="${optionKey}_display" 
                           class="range-display"
                           value="${value}"
                           min="${min}"
                           max="${max}"
                           readonly
                    >
                </div>
            `;

        } else {
            // Text input for other types
            return `
                <input type="text" 
                       id="${optionKey}" 
                       class="option-input ${isDefault ? 'default-value' : 'custom-value'}"
                       value="${value}"
                >
            `;
        }
    }

    setupOptionEventListeners(optionDiv, optionKey, option) {
        // Help button toggle
        const helpBtn = optionDiv.querySelector('.help-btn');
        const tooltip = optionDiv.querySelector('.option-tooltip');
        
        helpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isVisible = tooltip.style.display === 'block';
            
            // Hide all other tooltips
            document.querySelectorAll('.option-tooltip').forEach(t => t.style.display = 'none');
            
            // Toggle current tooltip
            tooltip.style.display = isVisible ? 'none' : 'block';
        });

        // Value change handlers
        const control = optionDiv.querySelector(`#${optionKey}`);
        if (control) {
            control.addEventListener('change', (e) => {
                this.onOptionChanged(optionKey, e.target.value, option);
            });

            // Special handling for range controls
            if (control.type === 'range') {
                const display = optionDiv.querySelector(`#${optionKey}_display`);
                control.addEventListener('input', (e) => {
                    display.value = e.target.value;
                });
            }
        }
    }

    onOptionChanged(optionKey, newValue, option) {
        // Update the scenario options
        this.currentScenarioOptions[optionKey] = newValue;

        // Update visual state
        const control = document.getElementById(optionKey);
        const isDefault = GameOptionsHelper.isDefaultValue(optionKey, newValue);
        
        control.classList.toggle('default-value', isDefault);
        control.classList.toggle('custom-value', !isDefault);

        // Update source indicator
        const sourceIndicator = control.closest('.game-option').querySelector('.value-source');
        sourceIndicator.className = `value-source ${isDefault ? 'default' : 'scenario'}`;
        sourceIndicator.textContent = isDefault ? '⚙️' : '📋';
        sourceIndicator.title = isDefault ? 'Default value' : 'Custom value';

        console.log(`Option ${optionKey} changed to: ${newValue} (${isDefault ? 'default' : 'custom'})`);

        // Emit change event for external listeners
        this.emitOptionsChanged();
    }

    filterOptions(searchTerm) {
        const categories = document.querySelectorAll('.game-options-category');
        const lowerSearch = searchTerm.toLowerCase();

        categories.forEach(category => {
            const options = category.querySelectorAll('.game-option');
            let visibleCount = 0;

            options.forEach(option => {
                const optionName = option.querySelector('.option-label').textContent.toLowerCase();
                const optionNote = option.querySelector('.tooltip-content').textContent.toLowerCase();
                const optionKey = option.dataset.option.toLowerCase();

                const matches = optionName.includes(lowerSearch) || 
                              optionNote.includes(lowerSearch) || 
                              optionKey.includes(lowerSearch);

                option.style.display = matches ? 'block' : 'none';
                if (matches) visibleCount++;
            });

            // Hide category if no visible options
            category.style.display = visibleCount > 0 ? 'block' : 'none';
            
            // Update category count
            const countSpan = category.querySelector('.category-count');
            if (countSpan) {
                countSpan.textContent = `${visibleCount} options`;
            }
        });
    }

    loadScenarioOptions(gameOptionsData) {
        console.log('Loading scenario game options:', gameOptionsData);
        
        if (gameOptionsData && gameOptionsData.content) {
            const content = gameOptionsData.content;
            
            // Handle Empyrion's game options structure which is an array of option sets
            if (content.Options && Array.isArray(content.Options)) {
                // Parse all ValidFor groups from the scenario
                this.validForGroups = content.Options.map((optionSet, index) => ({
                    index: index,
                    validFor: optionSet.ValidFor || ['Unknown'],
                    options: optionSet,
                    displayName: this.createValidForDisplayName(optionSet.ValidFor || ['Unknown'])
                }));
                
                console.log('Found ValidFor groups:', this.validForGroups);
                
                // Set current options to first group
                this.activeValidForIndex = 0;
                this.currentScenarioOptions = this.validForGroups[0]?.options || {};
                
            } else if (typeof content === 'object') {
                // Handle scenarios with direct option structure (no ValidFor groups)
                this.validForGroups = [{
                    index: 0,
                    validFor: ['All'],
                    options: content,
                    displayName: 'All Options'
                }];
                this.activeValidForIndex = 0;
                this.currentScenarioOptions = content;
            } else {
                this.validForGroups = [];
                this.currentScenarioOptions = {};
            }
        } else {
            // No scenario loaded - use empty state
            this.validForGroups = [];
            this.currentScenarioOptions = {};
        }

        // Re-render the form with new data
        this.renderOptionsForm();
    }

    createValidForDisplayName(validForArray) {
        if (!validForArray || validForArray.length === 0) {
            return 'Unknown';
        }
        
        // Create a readable display name from ValidFor array
        return validForArray.join(', ');
    }

    createValidForTabs() {
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'validfor-tabs-container';
        
        const tabsList = document.createElement('div');
        tabsList.className = 'validfor-tabs';
        
        this.validForGroups.forEach((group, index) => {
            const tab = document.createElement('button');
            tab.className = `validfor-tab ${index === this.activeValidForIndex ? 'active' : ''}`;
            tab.textContent = group.displayName;
            tab.dataset.groupIndex = index;
            
            tab.addEventListener('click', () => {
                this.switchValidForGroup(index);
            });
            
            tabsList.appendChild(tab);
        });
        
        tabsContainer.appendChild(tabsList);
        return tabsContainer;
    }

    switchValidForGroup(groupIndex) {
        if (groupIndex < 0 || groupIndex >= this.validForGroups.length) {
            return;
        }
        
        console.log(`Switching to ValidFor group ${groupIndex}: ${this.validForGroups[groupIndex].displayName}`);
        
        // Update active group
        this.activeValidForIndex = groupIndex;
        this.currentScenarioOptions = this.validForGroups[groupIndex].options;
        
        // Update tab active states
        document.querySelectorAll('.validfor-tab').forEach((tab, index) => {
            tab.classList.toggle('active', index === groupIndex);
        });
        
        // Re-render only the category sections (not the tabs)
        this.renderCategorySections();
    }

    renderCategorySections() {
        // Find and update only the category sections, leaving tabs intact
        const container = document.getElementById('game-options-content');
        if (!container) return;
        
        // Remove existing category sections
        container.querySelectorAll('.game-options-category').forEach(section => {
            section.remove();
        });
        
        // Add updated category sections
        Object.entries(GAME_OPTIONS_CONFIG).forEach(([categoryKey, category]) => {
            const categorySection = this.createCategorySection(categoryKey, category);
            container.appendChild(categorySection);
        });
    }

    exportOptions() {
        const currentGroup = this.validForGroups[this.activeValidForIndex];
        const exportData = {
            gameOptions: this.currentScenarioOptions,
            timestamp: new Date().toISOString(),
            validForGroup: currentGroup ? currentGroup.displayName : 'None',
            validFor: currentGroup ? currentGroup.validFor : []
        };

        return exportData;
    }

    emitOptionsChanged() {
        const event = new CustomEvent('gameOptionsChanged', {
            detail: {
                options: this.currentScenarioOptions,
                exportData: this.exportOptions()
            }
        });
        document.dispatchEvent(event);
    }

    resetToDefaults() {
        if (confirm('Reset all options to their default values? This cannot be undone.')) {
            this.currentScenarioOptions = {};
            this.renderOptionsForm();
            this.emitOptionsChanged();
        }
    }
}

// Global instance
let gameOptionsManager = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    gameOptionsManager = new GameOptionsManager();
});

// Function to update game options when scenario is loaded
function updateGameOptionsManager(scenarioData) {
    if (gameOptionsManager && scenarioData.files && scenarioData.files['Game Options']) {
        gameOptionsManager.loadScenarioOptions(scenarioData.files['Game Options']);
    }
}