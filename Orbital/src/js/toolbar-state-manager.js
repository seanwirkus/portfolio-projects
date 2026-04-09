// Toolbar State Manager - Single Source of Truth for UI State
// Professional event-driven architecture similar to MolView/Ketcher

class ToolbarStateManager {
    constructor() {
        // Single source of truth for all UI state
        this.state = {
            tool: 'atom',
            element: 'C',
            bondOrder: 1,
            template: null,
            group: null,
            options: {
                snap: true,
                preview: true
            },
            display: {
                implicitHydrogens: true,
                lonePairs: false,
                charges: false,
                hybridization: false,
                valenceWarnings: true
            }
        };

        // Event listeners registry
        this.listeners = new Map();

        // DOM cache
        this.dom = {};
        
        this.initialize();
    }

    initialize() {
        this.cacheDom();
        this.bindEvents();
        this.syncUI();
    }

    cacheDom() {
        // Tool buttons
        this.dom.toolButtons = Array.from(document.querySelectorAll('.tool-btn'));
        
        // Element buttons
        this.dom.elementButtons = Array.from(document.querySelectorAll('.element-btn'));
        
        // Bond buttons
        this.dom.bondButtons = Array.from(document.querySelectorAll('.bond-btn'));
        
        // Template buttons
        this.dom.templateButtons = Array.from(document.querySelectorAll('.template-btn'));
        
        // Group buttons
        this.dom.groupButtons = Array.from(document.querySelectorAll('.group-btn'));
        
        // Option buttons
        this.dom.optionButtons = {
            snap: document.getElementById('option-snap'),
            preview: document.getElementById('option-preview')
        };
        
        // Display toggle buttons (new button-based UI)
        this.dom.displayToggles = {
            skeletal: document.getElementById('toggle-skeletal'),
            implicitHydrogens: document.getElementById('show-implicit-h'),
            lonePairs: document.getElementById('show-lone-pairs'),
            charges: document.getElementById('show-charges'),
            hybridization: document.getElementById('show-hybridization'),
            valenceWarnings: document.getElementById('show-valence-errors')
        };
        
        // Legacy checkbox support (if any remain)
        this.dom.displayCheckboxes = {
            implicitHydrogens: document.getElementById('show-implicit-h'),
            lonePairs: document.getElementById('show-lone-pairs'),
            charges: document.getElementById('show-charges'),
            hybridization: document.getElementById('show-hybridization'),
            valenceWarnings: document.getElementById('show-valence-errors')
        };
        
        // Status bar elements
        this.dom.statusBar = {
            tool: document.getElementById('status-tool'),
            element: document.getElementById('status-element'),
            bond: document.getElementById('status-bond')
        };
    }

    bindEvents() {
        // Tool selection
        this.dom.toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool || btn.id.replace('tool-', '');
                this.setTool(tool);
            });
        });

        // Element selection
        this.dom.elementButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const element = btn.dataset.element;
                if (element) {
                    this.setElement(element);
                }
            });
        });

        // Bond order selection
        this.dom.bondButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const order = parseInt(btn.dataset.bond, 10) || 1;
                this.setBondOrder(order);
            });
        });

        // Template selection
        this.dom.templateButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const template = btn.dataset.template;
                if (template) {
                    this.setTemplate(template);
                }
            });
        });

        // Group selection
        this.dom.groupButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.dataset.group || btn.textContent.trim();
                if (group) {
                    this.setGroup(group);
                }
            });
        });

        // Option toggles
        Object.entries(this.dom.optionButtons).forEach(([key, btn]) => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.toggleOption(key);
                });
            }
        });

        // Display toggles (button-based) - Single source of truth
        Object.entries(this.dom.displayToggles).forEach(([key, button]) => {
            if (button) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const isActive = button.classList.contains('active');
                    const newValue = !isActive;
                    console.log(`🎛️ Display toggle clicked: ${key} = ${newValue}`);
                    this.setDisplayOption(key, newValue);
                });
            }
        });
        
        // Legacy checkbox support
        Object.entries(this.dom.displayCheckboxes).forEach(([key, checkbox]) => {
            if (checkbox && checkbox.tagName === 'INPUT') {
                checkbox.addEventListener('change', (e) => {
                    this.setDisplayOption(key, e.target.checked);
                });
            }
        });
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    // State getters (single source of truth)
    getTool() { return this.state.tool; }
    getElement() { return this.state.element; }
    getBondOrder() { return this.state.bondOrder; }
    getTemplate() { return this.state.template; }
    getGroup() { return this.state.group; }
    getOption(key) { return this.state.options[key]; }
    getDisplayOption(key) { return this.state.display[key]; }

    // State setters
    setTool(tool, silent = false) {
        if (this.state.tool === tool) return;
        
        this.state.tool = tool;
        this.state.template = null; // Clear template when switching tools
        this.state.group = null; // Clear group when switching tools
        
        this.syncToolUI();
        this.updateStatusBar();
        
        if (!silent) {
            this.emit('tool:changed', { tool, previous: this.state.tool });
        }
    }

    setElement(element, silent = false) {
        if (this.state.element === element) return;
        
        this.state.element = element;
        
        this.syncElementUI();
        this.updateStatusBar();
        
        if (!silent) {
            this.emit('element:changed', { element });
        }
    }

    setBondOrder(order, silent = false) {
        if (this.state.bondOrder === order) return;
        
        this.state.bondOrder = order;
        
        this.syncBondUI();
        this.updateStatusBar();
        
        if (!silent) {
            this.emit('bondOrder:changed', { order });
        }
    }

    setTemplate(template, silent = false) {
        this.state.template = template;
        this.state.tool = 'template';
        
        this.syncToolUI();
        
        if (!silent) {
            this.emit('template:selected', { template });
        }
    }

    setGroup(group, silent = false) {
        this.state.group = group;
        this.state.tool = 'group';
        
        this.syncToolUI();
        
        if (!silent) {
            this.emit('group:selected', { group });
        }
    }

    toggleOption(key) {
        this.state.options[key] = !this.state.options[key];
        
        const btn = this.dom.optionButtons[key];
        if (btn) {
            btn.classList.toggle('active', this.state.options[key]);
        }
        
        this.emit('option:toggled', { option: key, value: this.state.options[key] });
    }

    setDisplayOption(key, value) {
        this.state.display[key] = value;
        
        const checkbox = this.dom.displayCheckboxes[key];
        if (checkbox) {
            checkbox.checked = value;
        }
        
        this.emit('display:changed', { option: key, value });
    }

    // UI synchronization
    syncUI() {
        this.syncToolUI();
        this.syncElementUI();
        this.syncBondUI();
        this.syncOptionsUI();
        this.syncDisplayUI();
        this.updateStatusBar();
    }

    syncToolUI() {
        this.dom.toolButtons.forEach(btn => {
            const btnTool = btn.dataset.tool || btn.id.replace('tool-', '');
            btn.classList.toggle('active', btnTool === this.state.tool);
        });
    }

    syncElementUI() {
        this.dom.elementButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.element === this.state.element);
        });
    }

    syncBondUI() {
        this.dom.bondButtons.forEach(btn => {
            const btnOrder = parseInt(btn.dataset.bond, 10) || 1;
            btn.classList.toggle('active', btnOrder === this.state.bondOrder);
        });
    }

    syncOptionsUI() {
        Object.entries(this.dom.optionButtons).forEach(([key, btn]) => {
            if (btn) {
                btn.classList.toggle('active', !!this.state.options[key]);
            }
        });
    }

    syncDisplayUI() {
        Object.entries(this.dom.displayCheckboxes).forEach(([key, checkbox]) => {
            if (checkbox) {
                checkbox.checked = !!this.state.display[key];
            }
        });
    }

    updateStatusBar() {
        if (this.dom.statusBar.tool) {
            this.dom.statusBar.tool.textContent = this.getToolLabel(this.state.tool);
        }
        if (this.dom.statusBar.element) {
            this.dom.statusBar.element.textContent = this.state.element;
        }
        if (this.dom.statusBar.bond) {
            this.dom.statusBar.bond.textContent = this.getBondLabel(this.state.bondOrder);
        }
    }

    getToolLabel(tool) {
        const labels = {
            atom: 'Atom',
            bond: 'Bond',
            chain: 'Chain',
            erase: 'Erase',
            template: 'Template',
            group: 'Group'
        };
        return labels[tool] || tool.charAt(0).toUpperCase() + tool.slice(1);
    }

    getBondLabel(order) {
        switch (order) {
            case 2: return 'Double';
            case 3: return 'Triple';
            default: return 'Single';
        }
    }
}

// Export for use in other modules
window.ToolbarStateManager = ToolbarStateManager;
