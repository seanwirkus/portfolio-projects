/**
 * OrbitalManager - Core Coordinator
 * Manages lifecycle, tools, and state coordination.
 */
class OrbitalManager {
    constructor() {
        this.molpad = null;
        this.renderer = null; // OrbitalRenderer instance
        this.ui = null;       // OrbitalUI instance
        this.chemIntelligence = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        // 1. Initialize Chemistry Intelligence
        if (typeof ChemistryIntelligence !== 'undefined') {
            this.chemIntelligence = new ChemistryIntelligence();
            console.log('✅ Chemistry Intelligence loaded');
        }

        // 2. Initialize MolPad
        const container = document.getElementById('molpad-container');
        if (!container) throw new Error('MolPad container missing');
        
        container.innerHTML = '';
        this.molpad = new MolPad(container, window.devicePixelRatio || 1, {
            undo: null, redo: null
        });
        this.molpad.setSkeletalDisplay(true);

        // 3. Initialize Subsystems
        this.renderer = new OrbitalRenderer(this.molpad, this.chemIntelligence);
        
        // Initialize Toolbar State Manager
        if (typeof ToolbarStateManager !== 'undefined') {
            this.toolbar = new ToolbarStateManager();
            // Listen for element changes to set MolPad atom element and chain tool element
            this.toolbar.on('element:changed', ({ element }) => {
                if (this.molpad) this.molpad.setTool('atom', { element });
                if (this.chainTool) this.chainTool.setElement(element);
            });
            // Listen for tool changes to toggle chain mode or set MolPad tool
            this.toolbar.on('tool:changed', ({ tool }) => {
                if (tool === 'chain') {
                    if (this.chainTool) this.chainTool.startChainMode();
                    if (this.molpad) this.molpad.setTool('null');
                } else {
                    if (this.chainTool) this.chainTool.stopChainMode();
                    if (this.molpad) {
                        const element = this.toolbar.getElement() || 'C';
                        const toolMap = { atom: 'atom', bond: 'bond', erase: 'erase', select: 'select' };
                        const mpTool = toolMap[tool] || 'atom';
                        this.molpad.setTool(mpTool, { element });
                    }
                }
            });
            // Set initial element/tool to match toolbar
            if (this.molpad) this.molpad.setTool('atom', { element: this.toolbar.getElement() });
        }

        // Initialize Chain Tool
        if (typeof SmartChainTool !== 'undefined') {
            this.chainTool = new SmartChainTool(this.molpad, this.renderer, {
                saveState: (mol) => {
                    if (this.molpad && typeof this.molpad.requestRedraw === 'function') {
                        this.molpad.requestRedraw();
                    }
                }
            });
            // Sync element from toolbar if available
            if (this.toolbar && typeof this.toolbar.getElement === 'function') {
                this.chainTool.setElement(this.toolbar.getElement());
            }
        } else {
            console.warn('⚠️ SmartChainTool not found');
        }

        this.ui = new OrbitalUI(this);

        // 4. Hook Lifecycle
        this.molpad.onChange(() => this.handleMoleculeChange());
        
        this.initialized = true;
        console.log('🚀 Orbital Manager initialized');
    }

    handleMoleculeChange() {
        // Ensure Chain Tool has latest molecule reference
        if (this.chainTool && this.molpad) {
            this.chainTool.molpad = this.molpad;
        }

        // Trigger Re-render (Charges, Lone Pairs)
        this.renderer.render();
    }
}

// Export global instance
window.orbital = new OrbitalManager();
document.addEventListener('DOMContentLoaded', () => window.orbital.initialize());
