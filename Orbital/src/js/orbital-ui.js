/* exported OrbitalUI */
/**
 * OrbitalUI - Interaction Manager
 * Handles Toolbar, Keyboard Shortcuts, and DOM Events.
 */
class OrbitalUI {
    constructor(manager) {
        this.manager = manager;
        this.bindControls();
        this.bindKeyboard();
    }
    bindControls() {
        // Hook into canvas events for Chain Tool
        // Use container to ensure we catch events even if canvas is replaced
        const container = document.getElementById('molpad-container');
        const canvas = container ? container.querySelector('canvas') : null;
        
        if (container && canvas) {
            const toWorld = (e) => {
                if (!this.manager.molpad) return {x:0, y:0};
                const mp = this.manager.molpad;
                const rect = canvas.getBoundingClientRect();
                // Use MolPad's stored pixel ratio for consistency
                const dpr = mp.devicePixelRatio || window.devicePixelRatio || 1;
                
                const x = (e.clientX - rect.left) * dpr;
                const y = (e.clientY - rect.top) * dpr;
                
                const m = mp.matrix;
                // Inverse transform: world = (screen - translate) / scale
                // m = [scale, 0, 0, scale, tx, ty]
                return {
                    x: (x - m[4]) / m[0],
                    y: (y - m[5]) / m[3]
                };
            };

            // Capture mousedown to handle chain tool before MolPad
            container.addEventListener('mousedown', (e) => {
                if (this.manager.chainTool && this.manager.chainTool.isChainMode) {
                    console.log('⛓️ Chain Tool Mousedown');
                    const p = toWorld(e);
                    // If chain tool handles the event, stop propagation to MolPad
                    if (this.manager.chainTool.onMouseDown(p.x, p.y)) {
                        e.stopImmediatePropagation(); 
                        e.preventDefault(); // Prevent selection/drag
                    }
                }
            }, true); // Capture phase

            // PROBLEM FIX: Restore atom placement for native atom tool
            canvas.addEventListener('mousedown', e => {
                if (
                    this.manager.molpad &&
                    this.manager.molpad.tool &&
                    this.manager.molpad.tool.type === 'atom' &&
                    (!this.manager.chainTool || !this.manager.chainTool.isChainMode)
                ) {
                    const handler = this.manager.molpad.getHandler();
                    if (handler && typeof handler.onPointerDown === 'function') {
                        handler.onPointerDown(e, this.manager.molpad);
                        if (typeof this.manager.molpad.requestRedraw === 'function') {
                            this.manager.molpad.requestRedraw();
                        }
                    }
                }
            });

            container.addEventListener('mousemove', (e) => {
                if (this.manager.chainTool && this.manager.chainTool.isChainMode) {
                    const p = toWorld(e);
                    this.manager.chainTool.onMouseMove(p.x, p.y);
                }
            }, true);

            container.addEventListener('mouseup', (e) => {
                if (this.manager.chainTool && this.manager.chainTool.isChainMode) {
                    console.log('⛓️ Chain Tool Mouseup');
                    const p = toWorld(e);
                    this.manager.chainTool.onMouseUp(p.x, p.y);
                }
            }, true);
        }

        // Display Toggles (Single Source of Truth)
        this.bindToggle('show-lone-pairs', (active) => {
            this.manager.renderer.options.lonePairs = active;
            this.manager.renderer.render();
        });

        this.bindToggle('show-charges', (active) => {
            this.manager.renderer.options.charges = active;
            this.manager.renderer.render();
        });

        this.bindToggle('show-valence-errors', (active) => {
            this.manager.renderer.options.valenceWarnings = active;
            this.manager.renderer.render();
        });

        this.bindToggle('toggle-skeletal', (active) => {
            // "Active" button = Skeletal ON = setSkeletalDisplay(true)
            this.manager.molpad.setSkeletalDisplay(active); 
            this.manager.renderer.render();
        });

        // Tool Selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.setTool(tool);
                
                // UI Feedback
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Element Selection: Ensure new element is applied instantly if atom tool is active
        document.querySelectorAll('.element-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const element = btn.dataset.element;
                if (this.manager.toolbar) {
                    this.manager.toolbar.setElement(element);
                }
                document.querySelectorAll('.element-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const statusElement = document.getElementById('status-element');
                if (statusElement) statusElement.textContent = element;
                // If atom tool is active, sync molpad tool data immediately
                if (this.manager.molpad && this.manager.molpad.tool && this.manager.molpad.tool.type === 'atom') {
                    this.manager.molpad.setTool('atom', { element });
                }
            });
        });
    }

    bindToggle(id, callback) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const isActive = btn.classList.toggle('active');
            callback(isActive);
        });
    }

    setTool(tool) {
        // Handle Chain Tool
        if (tool === 'chain') {
            if (this.manager.chainTool) {
                this.manager.chainTool.startChainMode();
                // Disable MolPad internal tools while in chain mode by setting to null/unknown
                this.manager.molpad.setTool('null'); 
            } else {
                console.warn('Chain tool not initialized');
            }
            return;
        } else {
            // Stop chain mode if switching to another tool
            if (this.manager.chainTool) {
                this.manager.chainTool.stopChainMode();
            }
        }

        // Map UI tool names to MolPad tools
        const toolMap = {
            'erase': 'erase',
            'bond': 'bond',
            'atom': 'atom',
            'select': 'select'
        };
        if (toolMap[tool]) {
            const mpTool = toolMap[tool];
            const element = (this.manager.toolbar && this.manager.toolbar.getElement) ? this.manager.toolbar.getElement() : 'C';
            this.manager.molpad.setTool(mpTool, { element });
        }
    }

    bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.target.matches('input, textarea')) return;

            // Undo/Redo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                e.shiftKey ? this.manager.molpad.redo() : this.manager.molpad.undo();
                this.manager.renderer.render();
            }
        });
    }

    updateMoleculeStats(mol) {
        const count = mol ? mol.atoms.length : 0;
        const el = document.getElementById('mol-atoms');
        if (el) el.textContent = count;
    }
}
// Expose OrbitalUI globally for instantiation via other modules
if (typeof window !== 'undefined') window.OrbitalUI = OrbitalUI;