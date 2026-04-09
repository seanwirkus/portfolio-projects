/**
 * Orbital App using MolView's MolPad
 * 
 * GPLv3 License Notice:
 * This file integrates MolPad from MolView (http://molview.org)
 * Copyright (c) 2014-2023 Herman Bergwerf
 * Licensed under GPLv3
 */

class OrbitalAppMolView {
    constructor() {
        this.molpad = null;
        this.clipboard = null; // For copy/paste
        this.keyboardManager = null; // Keyboard shortcuts
        this.chemIntelligence = null; // Chemistry calculation engine
        this.initialize();
    }

    initialize() {
        // Initialize Chemistry Intelligence if available
        if (typeof ChemistryIntelligence !== 'undefined') {
            try {
                this.chemIntelligence = new ChemistryIntelligence();
                console.log('✅ ChemistryIntelligence initialized');
            } catch (e) {
                console.warn('⚠️ Failed to initialize ChemistryIntelligence:', e);
            }
        } else {
            console.warn('⚠️ ChemistryIntelligence class not found');
        }

        // Wait for DOM and MolPad to be ready
        if (typeof jQuery === 'undefined') {
            console.error('jQuery is required for MolPad');
            return;
        }

        if (typeof MolPad === 'undefined') {
            console.error('MolPad not loaded');
            return;
        }

        // Wait for molpad container
        const container = document.getElementById('molpad-container');
        if (!container) {
            console.error('MolPad container not found');
            return;
        }

        // Clear container
        container.innerHTML = '';

        // Initialize MolPad
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.molpad = new MolPad(container, devicePixelRatio, {
            undo: null,
            redo: null
        });

        // Initialize fragments (required for template insertion)
        if (typeof MPFragments !== 'undefined' && MPFragments.init) {
            MPFragments.init();
        }

        // Set skeletal display (hide carbon labels, hide implicit H by default)
        // setSkeletalDisplay(true) = hide hydrogens, setSkeletalDisplay(false) = show hydrogens
        this.molpad.setSkeletalDisplay(true);
        
        // Ensure button state matches: unchecked = hydrogens hidden
        const showImplicitHButton = document.getElementById('show-implicit-h');
        if (showImplicitHButton && showImplicitHButton.classList.contains('active')) {
            showImplicitHButton.classList.remove('active');
        }

        // Setup custom touch gestures: 2-finger pan, 3-finger zoom
        this.setupTouchGestures();

        // Hook into MolPad's draw cycle to render lone pairs
        this.hookLonePairRendering();

        // Setup UI controls
        this.setupUIControls();
        
        // Setup keyboard shortcuts for MolPad
        this.setupKeyboardShortcuts();

        // Setup change callback
        this.molpad.onChange(() => {
            console.log('🔄 MolPad onChange triggered');
            // CRITICAL: Ensure undo stack is updated when molecule changes
            if (this.molpad.mol && typeof this.molpad.mol.updateCopy === 'function') {
                this.molpad.mol.updateCopy();
                console.log('✅ Undo stack updated (stack length:', this.molpad.mol.stack ? this.molpad.mol.stack.length : 0, ')');
            }
            this.updateProperties();
            // Recalculate charges and lone pairs when molecule changes
            this.updateChargesAndLonePairs();
        });

        console.log('✅ Orbital App initialized with MolPad');
    }
    
    setupKeyboardShortcuts() {
        console.log('🔍 Setting up keyboard shortcuts for MolPad...');
        
        // Remove any existing listener to avoid duplicates
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler, true);
        }
        
        // Create bound handler with proper context
        const self = this;
        this.keyboardHandler = function(e) {
            self.handleKeyboardShortcut(e);
        };
        
        // Add event listener with capture phase and ensure it's not passive
        document.addEventListener('keydown', this.keyboardHandler, { capture: true, passive: false });
        
        console.log('✅ Keyboard shortcuts setup for MolPad');
    }
    
    handleKeyboardShortcut(e) {
        // Debug: Always log to see if handler is called
        console.log('🔍 Keyboard handler called', {
            key: e.key,
            ctrl: e.ctrlKey,
            shift: e.shiftKey,
            target: e.target.tagName
        });
        
        // Only handle shortcuts when on draw tab
        const activeTab = document.querySelector('.tab-btn.active');
        let tabName = 'draw';
        if (activeTab) {
            tabName = activeTab.dataset.tab || activeTab.textContent.toLowerCase().trim() || 'draw';
        }
        
        console.log(`📍 Current tab: ${tabName}`);
        
        if (tabName !== 'draw') {
            console.log(`⏭️ Skipping shortcut (not on draw tab, current: ${tabName})`);
            return;
        }
        
        // Don't intercept if typing in text input
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
            console.log('⏭️ Skipping shortcut (in text input)');
            return;
        }
        
        const hasCtrl = e.ctrlKey || e.metaKey;
        const hasShift = e.shiftKey;
        const hasAlt = e.altKey;
        const key = e.key;
        const keyLower = key.toLowerCase();
        
        console.log(`⌨️ Processing shortcut: ${key} (Ctrl: ${hasCtrl}, Shift: ${hasShift}, Alt: ${hasAlt})`);
        
        // Delete/Backspace
        if ((key === 'Delete' || key === 'Backspace') && !hasCtrl && !hasShift && !hasAlt) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('🗑️ Delete/Backspace pressed');
            if (this.molpad && this.molpad.mol && this.molpad.sel) {
                // Update selection cache first
                this.molpad.sel.update();
                const selectedAtoms = this.molpad.sel.cache ? this.molpad.sel.cache.atoms : [];
                console.log('📍 Selected atoms:', selectedAtoms);
                if (selectedAtoms && selectedAtoms.length > 0) {
                    // Use sel.remove() which handles deletion properly
                    this.molpad.sel.remove();
                    this.molpad.requestRedraw();
                    console.log(`🗑️ Deleted ${selectedAtoms.length} selected atoms`);
                } else {
                    console.log('ℹ️ No atoms selected to delete');
                }
            }
            return;
        }
        
        // Ctrl+A: Select all
        if (hasCtrl && keyLower === 'a' && !hasShift && !hasAlt) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('✓ Ctrl+A pressed - Select all');
            if (this.molpad && this.molpad.mol && this.molpad.sel) {
                // Clear current selection first
                this.molpad.sel.clear();
                
                // Select all atoms
                for (let i = 0; i < this.molpad.mol.atoms.length; i++) {
                    const atom = this.molpad.mol.atoms[i];
                    if (atom && typeof atom.select === 'function') {
                        atom.select(true);
                    }
                }
                
                // Update selection cache
                this.molpad.sel.update();
                this.molpad.requestRedraw();
                console.log(`✓ Selected all ${this.molpad.mol.atoms.length} atoms`);
            } else {
                console.warn('⚠️ MolPad or selection not available');
            }
            return;
        }
        
        // Ctrl+C: Copy
        if (hasCtrl && keyLower === 'c' && !hasShift && !hasAlt) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('📋 Ctrl+C pressed - Copy');
            if (this.molpad) {
                try {
                    const smiles = this.molpad.getSMILES();
                    if (smiles) {
                        navigator.clipboard.writeText(smiles).then(() => {
                            console.log('✓ Copied SMILES to clipboard:', smiles);
                        }).catch(err => {
                            console.error('❌ Copy failed:', err);
                        });
                    } else {
                        console.log('ℹ️ No molecule to copy');
                    }
                } catch (err) {
                    console.error('❌ Copy failed:', err);
                }
            }
            return;
        }
        
        // Ctrl+V: Paste
        if (hasCtrl && keyLower === 'v' && !hasShift && !hasAlt) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('📌 Ctrl+V pressed - Paste');
            if (this.molpad) {
                navigator.clipboard.readText().then(text => {
                    try {
                        this.molpad.setSMILES(text);
                        this.molpad.requestRedraw();
                        console.log('✓ Pasted SMILES:', text);
                    } catch (err) {
                        console.error('❌ Paste failed:', err);
                    }
                }).catch(err => {
                    console.error('❌ Clipboard read failed:', err);
                });
            }
            return;
        }
        
        // Ctrl+X: Cut
        if (hasCtrl && keyLower === 'x' && !hasShift && !hasAlt) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('✂️ Ctrl+X pressed - Cut');
            if (this.molpad && this.molpad.mol && this.molpad.sel) {
                // Update selection cache first
                this.molpad.sel.update();
                const selectedAtoms = this.molpad.sel.cache ? this.molpad.sel.cache.atoms : [];
                if (selectedAtoms && selectedAtoms.length > 0) {
                    // Copy first
                    const smiles = this.molpad.getSMILES();
                    if (smiles) {
                        navigator.clipboard.writeText(smiles).then(() => {
                            // Then delete using sel.remove()
                            this.molpad.sel.remove();
                            this.molpad.requestRedraw();
                            console.log(`✂️ Cut ${selectedAtoms.length} atoms to clipboard`);
                        });
                    }
                } else {
                    console.log('ℹ️ No atoms selected to cut');
                }
            }
            return;
        }
        
        // Ctrl+Z: Undo
        if (hasCtrl && keyLower === 'z' && !hasShift && !hasAlt) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('↶ Ctrl+Z pressed - Undo');
            if (this.molpad) {
                // Check if undo function exists
                if (typeof this.molpad.undo === 'function') {
                    // Check if there's anything to undo
                    const stackLength = this.molpad.mol && this.molpad.mol.stack ? this.molpad.mol.stack.length : 0;
                    console.log(`📍 Undo stack length: ${stackLength}`);
                    
                    if (stackLength > 0) {
                        // MolPad's undo() returns undefined, not a boolean
                        // It calls mol.undo() which returns true/false, but molpad.undo() itself returns undefined
                        // So we should check the stack length before and after
                        const beforeLength = this.molpad.mol.stack.length;
                        this.molpad.undo();
                        const afterLength = this.molpad.mol.stack ? this.molpad.mol.stack.length : 0;
                        
                        if (afterLength < beforeLength) {
                            console.log(`✅ Undo executed successfully (${beforeLength} → ${afterLength})`);
                            // Force redraw
                            this.molpad.requestRedraw();
                        } else {
                            console.log(`ℹ️ Undo called but stack unchanged (${beforeLength} → ${afterLength})`);
                        }
                    } else {
                        console.log('ℹ️ Nothing to undo (stack is empty)');
                    }
                } else {
                    console.warn('⚠️ molpad.undo is not a function');
                    console.log('Available methods:', Object.keys(this.molpad).filter(k => typeof this.molpad[k] === 'function'));
                }
            } else {
                console.warn('⚠️ MolPad not available');
            }
            return;
        }
        
        // Ctrl+Shift+Z or Ctrl+Y: Redo
        if (hasCtrl && (keyLower === 'z' || keyLower === 'y') && hasShift && !hasAlt) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('↷ Ctrl+Shift+Z/Ctrl+Y pressed - Redo');
            if (this.molpad) {
                if (typeof this.molpad.redo === 'function') {
                    // Check if there's anything to redo
                    const redoStackLength = this.molpad.mol && this.molpad.mol.reverseStack ? this.molpad.mol.reverseStack.length : 0;
                    console.log(`📍 Redo stack length: ${redoStackLength}`);
                    
                    if (redoStackLength > 0) {
                        const result = this.molpad.redo();
                        if (result) {
                            console.log('↷ Redo executed successfully');
                            // Force redraw
                            this.molpad.requestRedraw();
                        } else {
                            console.warn('⚠️ Redo returned false');
                        }
                    } else {
                        console.log('ℹ️ Nothing to redo (redo stack is empty)');
                    }
                } else {
                    console.warn('⚠️ molpad.redo is not a function');
                }
            } else {
                console.warn('⚠️ MolPad not available');
            }
            return;
        }
        
        // Tool shortcuts (only if no modifiers)
        if (!hasCtrl && !hasShift && !hasAlt) {
            const toolMap = {
                'a': 'atom',
                'b': 'bond',
                'c': 'chain',
                'e': 'erase'
            };
            
            if (toolMap[keyLower]) {
                e.preventDefault();
                e.stopPropagation();
                const toolName = toolMap[keyLower];
                console.log(`🔧 Tool shortcut: ${keyLower} -> ${toolName}`);
                const toolButton = document.getElementById(`tool-${toolName}`);
                if (toolButton) {
                    toolButton.click();
                    console.log(`✓ Switched to ${toolName} tool`);
                } else {
                    console.warn(`⚠️ Tool button not found: tool-${toolName}`);
                }
                return;
            }
        }
    }

    setupUIControls() {
        // Element selection
        document.querySelectorAll('.element-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const element = btn.dataset.element;
                this.setElement(element);
                
                // Update UI
                document.querySelectorAll('.element-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update status bar
                const statusElement = document.getElementById('status-element');
                if (statusElement) {
                    statusElement.textContent = element;
                }
            });
        });

        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const toolName = btn.id.replace('tool-', '');
                this.setTool(toolName);
                
                // Update UI
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update status bar
                const statusTool = document.getElementById('status-tool');
                if (statusTool) {
                    statusTool.textContent = toolName.charAt(0).toUpperCase() + toolName.slice(1);
                }
            });
        });

        // Bond order selection
        document.querySelectorAll('.bond-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const order = parseInt(btn.dataset.bond, 10) || 1;
                this.setBondOrder(order);
                
                // Update UI
                document.querySelectorAll('.bond-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update status bar
                const statusBond = document.getElementById('status-bond');
                if (statusBond) {
                    const bondNames = { 1: 'Single', 2: 'Double', 3: 'Triple' };
                    statusBond.textContent = bondNames[order] || 'Single';
                }
            });
        });

        // Template buttons
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const template = btn.dataset.template;
                this.insertTemplate(template);
            });
        });

        // Group buttons (functional groups)
        document.querySelectorAll('.group-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.dataset.group;
                this.setGroup(group);
                
                // Update UI
                document.querySelectorAll('.group-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Clear canvas
        const clearBtn = document.getElementById('clear-canvas');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (this.molpad) {
                    this.molpad.clear();
                    this.updateProperties();
                }
            });
        }

        // Auto organize
        const autoOrganizeBtn = document.getElementById('auto-organize');
        if (autoOrganizeBtn) {
            autoOrganizeBtn.addEventListener('click', () => {
                // MolPad doesn't have auto-organize, but we can center
                if (this.molpad) {
                    this.molpad.center();
                }
            });
        }

        // Display options - FIXED: Handle button clicks, not checkbox changes
        console.log('🎨 Setting up display options...');
        
        // Initialize display state
        this.displayOptions = {
            skeletal: true,
            implicitH: true,
            lonePairs: false,
            charges: false,
            hybridization: false,
            valenceWarnings: true
        };
        
        // Skeletal notation toggle
        const toggleSkeletal = document.getElementById('toggle-skeletal');
        console.log('📍 toggle-skeletal button:', !!toggleSkeletal);
        if (toggleSkeletal) {
            toggleSkeletal.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isActive = toggleSkeletal.classList.contains('active');
                toggleSkeletal.classList.toggle('active');
                this.displayOptions.skeletal = !isActive;
                console.log(`🎨 Skeletal notation: ${!isActive}`);
                if (this.molpad) {
                    // MolPad uses setSkeletalDisplay
                    if (typeof this.molpad.setSkeletalDisplay === 'function') {
                        this.molpad.setSkeletalDisplay(!isActive);
                    } else {
                        console.warn('⚠️ molpad.setSkeletalDisplay not available');
                    }
                    this.molpad.requestRedraw();
                } else {
                    console.error('❌ molpad not available');
                }
            });
            console.log('✅ Skeletal toggle connected');
        } else {
            console.error('❌ toggle-skeletal button not found');
        }

        // Implicit hydrogens toggle
        // INVERTED: When checked (active), show hydrogens explicitly (setSkeletalDisplay(false))
        // When unchecked, hide hydrogens (setSkeletalDisplay(true))
        const showImplicitH = document.getElementById('show-implicit-h');
        console.log('📍 show-implicit-h button:', !!showImplicitH);
        if (showImplicitH) {
            showImplicitH.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isActive = showImplicitH.classList.contains('active');
                showImplicitH.classList.toggle('active');
                const newState = !isActive; // New state after toggle
                this.displayOptions.implicitH = newState;
                console.log(`🎨 Show hydrogens: ${newState} (will ${newState ? 'show' : 'hide'} hydrogens)`);
                if (this.molpad) {
                    // INVERTED LOGIC: 
                    // When newState is true (checked/active), we want to SHOW hydrogens explicitly
                    // setSkeletalDisplay(false) adds implicit hydrogens as explicit atoms
                    // When newState is false (unchecked), we want to HIDE hydrogens
                    // setSkeletalDisplay(true) removes implicit hydrogens
                    if (typeof this.molpad.setSkeletalDisplay === 'function') {
                        this.molpad.setSkeletalDisplay(!newState); // Inverted: false shows, true hides
                    }
                    this.molpad.requestRedraw();
                } else {
                    console.error('❌ molpad not available');
                }
            });
            console.log('✅ Implicit H toggle connected');
        } else {
            console.error('❌ show-implicit-h button not found');
        }

        // Lone pairs display
        const showLonePairs = document.getElementById('show-lone-pairs');
        console.log('📍 show-lone-pairs button:', !!showLonePairs);
        if (showLonePairs) {
            showLonePairs.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isActive = showLonePairs.classList.contains('active');
                showLonePairs.classList.toggle('active');
                this.displayOptions.lonePairs = !isActive;
                this.showLonePairs = !isActive;
                console.log(`🎨 Lone pairs: ${!isActive}`);
                if (this.molpad) {
                    this.molpad.requestRedraw();
                } else {
                    console.error('❌ molpad not available');
                }
            });
            console.log('✅ Lone pairs toggle connected');
        } else {
            console.error('❌ show-lone-pairs button not found');
        }
        this.showLonePairs = false; // Default off

        // Charges display
        const showCharges = document.getElementById('show-charges');
        console.log('📍 show-charges button:', !!showCharges);
        if (showCharges) {
            showCharges.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isActive = showCharges.classList.contains('active');
                showCharges.classList.toggle('active');
                this.displayOptions.charges = !isActive;
                console.log(`🎨 Charges: ${!isActive}`);
                if (this.molpad) {
                    // MolPad should show charges if available
                    this.molpad.requestRedraw();
                } else {
                    console.error('❌ molpad not available');
                }
            });
            console.log('✅ Charges toggle connected');
        } else {
            console.error('❌ show-charges button not found');
        }

        // Hybridization display
        const showHybridization = document.getElementById('show-hybridization');
        console.log('📍 show-hybridization button:', !!showHybridization);
        if (showHybridization) {
            showHybridization.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isActive = showHybridization.classList.contains('active');
                showHybridization.classList.toggle('active');
                this.displayOptions.hybridization = !isActive;
                console.log(`🎨 Hybridization: ${!isActive}`);
                if (this.molpad) {
                    this.molpad.requestRedraw();
                } else {
                    console.error('❌ molpad not available');
                }
            });
            console.log('✅ Hybridization toggle connected');
        } else {
            console.error('❌ show-hybridization button not found');
        }

        // Valence warnings display
        const showValenceErrors = document.getElementById('show-valence-errors');
        console.log('📍 show-valence-errors button:', !!showValenceErrors);
        if (showValenceErrors) {
            showValenceErrors.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isActive = showValenceErrors.classList.contains('active');
                showValenceErrors.classList.toggle('active');
                this.displayOptions.valenceWarnings = !isActive;
                console.log(`🎨 Valence warnings: ${!isActive}`);
                if (this.molpad) {
                    this.molpad.requestRedraw();
                } else {
                    console.error('❌ molpad not available');
                }
            });
            console.log('✅ Valence warnings toggle connected');
        } else {
            console.error('❌ show-valence-errors button not found');
        }
        
        console.log('✅ All display options setup complete');

        // Zoom controls
        console.log('🔍 Setting up zoom controls in OrbitalAppMolView');
        const zoomIn = document.getElementById('zoom-in');
        if (zoomIn) {
            console.log('✅ Found zoom-in button');
            // Remove any existing listeners to be safe (clone node)
            const newZoomIn = zoomIn.cloneNode(true);
            zoomIn.parentNode.replaceChild(newZoomIn, zoomIn);
            newZoomIn.addEventListener('click', (e) => {
                console.log('🔍+ Zoom In clicked');
                e.preventDefault();
                e.stopPropagation();
                this.zoomIn();
            });
        } else {
            console.error('❌ zoom-in button not found');
        }

        const zoomOut = document.getElementById('zoom-out');
        if (zoomOut) {
            console.log('✅ Found zoom-out button');
            const newZoomOut = zoomOut.cloneNode(true);
            zoomOut.parentNode.replaceChild(newZoomOut, zoomOut);
            newZoomOut.addEventListener('click', (e) => {
                console.log('🔍- Zoom Out clicked');
                e.preventDefault();
                e.stopPropagation();
                this.zoomOut();
            });
        } else {
            console.error('❌ zoom-out button not found');
        }

        const zoomReset = document.getElementById('zoom-reset');
        if (zoomReset) {
            console.log('✅ Found zoom-reset button');
            const newZoomReset = zoomReset.cloneNode(true);
            zoomReset.parentNode.replaceChild(newZoomReset, zoomReset);
            newZoomReset.addEventListener('click', (e) => {
                console.log('⌂ Zoom Reset clicked');
                e.preventDefault();
                e.stopPropagation();
                this.zoomReset();
            });
        } else {
            console.error('❌ zoom-reset button not found');
        }

        const zoomFit = document.getElementById('zoom-fit');
        if (zoomFit) {
            console.log('✅ Found zoom-fit button');
            const newZoomFit = zoomFit.cloneNode(true);
            zoomFit.parentNode.replaceChild(newZoomFit, zoomFit);
            newZoomFit.addEventListener('click', (e) => {
                console.log('⛶ Zoom Fit clicked');
                e.preventDefault();
                e.stopPropagation();
                this.zoomFit();
            });
        } else {
            console.error('❌ zoom-fit button not found');
        }

        // Enable space+drag for panning
        this.isSpacePressed = false;
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                this.isSpacePressed = true;
                if (this.molpad) {
                    // Temporarily switch to drag tool
                    this.previousTool = this.molpad.tool.type;
                    this.molpad.setTool('drag', {});
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.isSpacePressed = false;
                if (this.molpad && this.previousTool) {
                    // Restore previous tool
                    const tool = this.previousTool;
                    this.previousTool = null;
                    if (tool === 'bond') {
                        const activeBondBtn = document.querySelector('.bond-btn.active');
                        const order = activeBondBtn ? parseInt(activeBondBtn.dataset.bond, 10) : 1;
                        const bondTypeMap = {
                            1: MP_BOND_SINGLE,
                            2: MP_BOND_DOUBLE,
                            3: MP_BOND_TRIPLE
                        };
                        this.molpad.setTool('bond', { type: bondTypeMap[order] || MP_BOND_SINGLE });
                    } else {
                        this.molpad.setTool(tool, {});
                    }
                }
            }
        });

        // Comprehensive keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't intercept if user is typing in input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
            const shift = e.shiftKey;

            // Cmd/Ctrl + A: Select all
            if (cmdOrCtrl && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                this.selectAll();
                return;
            }

            // Cmd/Ctrl + C: Copy
            if (cmdOrCtrl && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                this.copySelection();
                return;
            }

            // Cmd/Ctrl + V: Paste
            if (cmdOrCtrl && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                this.pasteSelection();
                return;
            }

            // Cmd/Ctrl + X: Cut
            if (cmdOrCtrl && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                this.cutSelection();
                return;
            }

            // Cmd/Ctrl + Plus/Equal: Zoom in
            if (cmdOrCtrl && (e.key === '+' || e.key === '=')) {
                e.preventDefault();
                this.zoomIn();
                return;
            }

            // Cmd/Ctrl + Minus: Zoom out
            if (cmdOrCtrl && e.key === '-') {
                e.preventDefault();
                this.zoomOut();
                return;
            }

            // Cmd/Ctrl + 0: Reset zoom
            if (cmdOrCtrl && e.key === '0') {
                e.preventDefault();
                this.zoomReset();
                return;
            }

            // Cmd/Ctrl + Z: Undo
            if (cmdOrCtrl && e.key.toLowerCase() === 'z' && !shift) {
                e.preventDefault();
                if (this.molpad) {
                    // Check if undo function exists and verify success
                    if (typeof this.molpad.undo === 'function') {
                        const stackLength = this.molpad.mol && this.molpad.mol.stack ? this.molpad.mol.stack.length : 0;
                        if (stackLength > 0) {
                            const beforeLength = this.molpad.mol.stack.length;
                            this.molpad.undo();
                            const afterLength = this.molpad.mol.stack ? this.molpad.mol.stack.length : 0;
                            if (afterLength < beforeLength) {
                                // Undo successful - update and redraw
                                this.updateProperties();
                                this.molpad.requestRedraw();
                            }
                        }
                    }
                }
                return;
            }

            // Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y: Redo
            if (cmdOrCtrl && (e.key.toLowerCase() === 'z' && shift || e.key.toLowerCase() === 'y')) {
                e.preventDefault();
                if (this.molpad) {
                    this.molpad.redo();
                    this.updateProperties();
                }
                return;
            }

            // Delete or Backspace: Remove selection
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.molpad && this.molpad.sel) {
                    e.preventDefault();
                    this.molpad.sel.remove();
                    this.updateProperties();
                }
                return;
            }

            // Tool shortcuts (only if no modifier keys)
            if (!cmdOrCtrl && !shift && !e.altKey) {
                switch(e.key.toLowerCase()) {
                    case 'a':
                        e.preventDefault();
                        document.getElementById('tool-atom')?.click();
                        break;
                    case 'b':
                        e.preventDefault();
                        document.getElementById('tool-bond')?.click();
                        break;
                    case 'c':
                        e.preventDefault();
                        document.getElementById('tool-chain')?.click();
                        break;
                    case 'e':
                        e.preventDefault();
                        document.getElementById('tool-erase')?.click();
                        break;
                    case 's':
                        e.preventDefault();
                        document.getElementById('tool-select')?.click();
                        break;
                }
            }
        });
    }

    setTool(toolType) {
        if (!this.molpad) return;

        // Map our tool names to MolPad tool types
        const toolMap = {
            'atom': 'atom',
            'bond': 'bond',
            'chain': 'chain',
            'erase': 'erase',
            'select': 'select'
        };

        const mpToolType = toolMap[toolType] || 'bond';
        
        // Set tool with appropriate data
        if (mpToolType === 'bond') {
            // Get current bond order from UI
            const activeBondBtn = document.querySelector('.bond-btn.active');
            const order = activeBondBtn ? parseInt(activeBondBtn.dataset.bond, 10) : 1;
            const bondTypeMap = {
                1: MP_BOND_SINGLE,
                2: MP_BOND_DOUBLE,
                3: MP_BOND_TRIPLE
            };
            this.molpad.setTool('bond', { type: bondTypeMap[order] || MP_BOND_SINGLE });
        } else if (mpToolType === 'select') {
            // Set select tool with lasso type
            this.molpad.setTool('select', { type: 'lasso' });
        } else {
            this.molpad.setTool(mpToolType, {});
        }
    }

    setElement(element) {
        if (!this.molpad) return;
        this.molpad.setTool('atom', { element: element });
    }

    setBondOrder(order) {
        if (!this.molpad) return;
        
        const bondTypeMap = {
            1: MP_BOND_SINGLE,
            2: MP_BOND_DOUBLE,
            3: MP_BOND_TRIPLE
        };
        
        this.molpad.setTool('bond', { type: bondTypeMap[order] || MP_BOND_SINGLE });
    }

    insertTemplate(template) {
        if (!this.molpad || typeof MPFragments === 'undefined') return;
        
        // MolPad has fragment insertion
        // Templates: benzene, cyclohexane, cyclopentane
        const fragmentMap = {
            'benzene': MPFragments.benzene,
            'cyclohexane': MPFragments.cyclohexane,
            'cyclopentane': MPFragments.cyclopentane
        };
        
        const fragment = fragmentMap[template];
        if (fragment) {
            // Set tool to fragment - user clicks to place it
            this.molpad.setTool('fragment', { frag: fragment });
            
            // Update status message
            const statusMessage = document.getElementById('status-message');
            if (statusMessage) {
                statusMessage.textContent = `Click on canvas to place ${template} ring`;
            }
        }
    }

    setGroup(group) {
        if (!this.molpad) return;
        
        // Create functional group fragments
        const groupFragments = this.createGroupFragment(group);
        if (groupFragments) {
            // Set tool to fragment mode with the group
            this.molpad.setTool('fragment', { frag: groupFragments });
            this.currentGroup = group;
            
            // Update status message
            const statusMessage = document.getElementById('status-message');
            if (statusMessage) {
                statusMessage.textContent = `Click on an atom to attach ${group} group`;
            }
        }
    }

    createGroupFragment(group) {
        if (typeof MPFragments === 'undefined' || typeof MPPoint === 'undefined') {
            return null;
        }

        // Create fragment data for functional groups using MPFragments API
        const bondLength = MPFragments.length || 1;
        
        switch(group) {
            case 'OH':
                // OH group: O-H single bond
                // First atom (O) will connect to the target atom
                const ohFrag = {
                    atoms: [
                        { center: new MPPoint(0, 0), element: 'O' },
                        { center: new MPPoint(bondLength, 0), element: 'H' }
                    ],
                    bonds: [
                        { from: 0, to: 1, type: MP_BOND_SINGLE }
                    ]
                };
                return {
                    full: ohFrag,
                    toAtom: ohFrag // Same structure for attaching to atom
                };
            
            case 'NH2':
                // NH2 group: N with 2 H atoms at ~120 degree angles
                const nh2Angle = (2 * Math.PI) / 3; // 120 degrees
                const nh2Frag = {
                    atoms: [
                        { center: new MPPoint(0, 0), element: 'N' },
                        { center: new MPPoint(bondLength * Math.cos(nh2Angle), bondLength * Math.sin(nh2Angle)), element: 'H' },
                        { center: new MPPoint(bondLength * Math.cos(-nh2Angle), bondLength * Math.sin(-nh2Angle)), element: 'H' }
                    ],
                    bonds: [
                        { from: 0, to: 1, type: MP_BOND_SINGLE },
                        { from: 0, to: 2, type: MP_BOND_SINGLE }
                    ]
                };
                return {
                    full: nh2Frag,
                    toAtom: nh2Frag
                };
            
            case 'COOH':
                // COOH group: C=O double bond, C-O single bond, O-H single bond
                const coohFrag = {
                    atoms: [
                        { center: new MPPoint(0, 0), element: 'C' },
                        { center: new MPPoint(bondLength, 0), element: 'O' },
                        { center: new MPPoint(-bondLength * 0.7, bondLength * 0.7), element: 'O' },
                        { center: new MPPoint(-bondLength * 0.7 + bondLength * 0.8, bondLength * 0.7), element: 'H' }
                    ],
                    bonds: [
                        { from: 0, to: 1, type: MP_BOND_DOUBLE },
                        { from: 0, to: 2, type: MP_BOND_SINGLE },
                        { from: 2, to: 3, type: MP_BOND_SINGLE }
                    ]
                };
                return {
                    full: coohFrag,
                    toAtom: coohFrag
                };
            
            case 'CHO':
                // CHO group: C=O double bond, C-H single bond
                const choFrag = {
                    atoms: [
                        { center: new MPPoint(0, 0), element: 'C' },
                        { center: new MPPoint(bondLength, 0), element: 'O' },
                        { center: new MPPoint(-bondLength, 0), element: 'H' }
                    ],
                    bonds: [
                        { from: 0, to: 1, type: MP_BOND_DOUBLE },
                        { from: 0, to: 2, type: MP_BOND_SINGLE }
                    ]
                };
                return {
                    full: choFrag,
                    toAtom: choFrag
                };
            
            default:
                return null;
        }
    }

    selectAll() {
        if (!this.molpad || !this.molpad.mol) return;
        
        const mol = this.molpad.mol;
        
        // Select all atoms and bonds
        for (let i = 0; i < mol.atoms.length; i++) {
            mol.atoms[i].select(true);
        }
        for (let i = 0; i < mol.bonds.length; i++) {
            mol.bonds[i].select(true);
        }
        
        // Update selection cache
        if (this.molpad.sel) {
            this.molpad.sel.update();
            // Update rotation center for selection
            this.molpad.sel.updateRotationCenter();
        }
        
        // Request redraw
        this.molpad.requestRedraw();
    }

    copySelection() {
        if (!this.molpad || !this.molpad.mol) return;
        
        const mol = this.molpad.mol;
        const selectedAtoms = [];
        const selectedBonds = [];
        
        // Get selected atoms and bonds
        for (let i = 0; i < mol.atoms.length; i++) {
            if (mol.atoms[i].isSelected()) {
                selectedAtoms.push(i);
            }
        }
        for (let i = 0; i < mol.bonds.length; i++) {
            if (mol.bonds[i].isSelected()) {
                selectedBonds.push(i);
            }
        }
        
        if (selectedAtoms.length === 0 && selectedBonds.length === 0) {
            // If nothing selected, copy entire molecule
            try {
                const molfile = this.molpad.getMOL();
                if (molfile) {
                    this.clipboard = { type: 'molfile', data: molfile };
                    console.log('Copied entire molecule');
                }
            } catch (e) {
                console.warn('Could not copy molecule:', e);
            }
            return;
        }
        
        // Copy selected portion as MOL file
        // For now, store selection info - full copy would require creating a sub-molecule
        this.clipboard = {
            type: 'selection',
            atoms: selectedAtoms,
            bonds: selectedBonds,
            molfile: this.molpad.getMOL() // Store full molfile for now
        };
        console.log('Copied selection:', selectedAtoms.length, 'atoms,', selectedBonds.length, 'bonds');
    }

    pasteSelection() {
        if (!this.molpad || !this.clipboard) return;
        
        if (this.clipboard.type === 'molfile') {
            try {
                // Paste at center of canvas
                const container = document.getElementById('molpad-container');
                if (container) {
                    const centerX = container.offsetWidth / 2;
                    const centerY = container.offsetHeight / 2;
                    
                    // Load MOL file - MolPad will handle positioning
                    // For now, append to existing molecule
                    // Note: Full paste implementation would require creating a new molecule
                    // and merging it at the paste location
                    console.log('Paste functionality - would paste molecule at center');
                }
            } catch (e) {
                console.warn('Could not paste:', e);
            }
        }
    }

    cutSelection() {
        if (!this.molpad) return;
        
        // Copy first
        this.copySelection();
        
        // Then delete selection
        if (this.molpad.sel) {
            this.molpad.sel.remove();
            this.updateProperties();
        }
    }

    zoomIn() {
        if (!this.molpad) return;
        
        // Get canvas center for zoom origin
        const container = document.getElementById('molpad-container');
        if (!container) return;
        
        const centerX = container.offsetWidth / 2;
        const centerY = container.offsetHeight / 2;
        
        // Zoom in by 20%
        const zoomFactor = 1.2;
        
        if (typeof this.molpad.scaleAbsolute === 'function') {
            this.molpad.scaleAbsolute(zoomFactor, centerX, centerY);
        } else if (typeof this.molpad.scale === 'function') {
            this.molpad.scale(zoomFactor, centerX, centerY);
        }

        // Ensure molecule stays in view after zoom
        this.ensureMoleculeInView();
        this.molpad.redraw(true);
    }

    zoomOut() {
        if (!this.molpad) return;
        
        // Get canvas center for zoom origin
        const container = document.getElementById('molpad-container');
        if (!container) return;
        
        const centerX = container.offsetWidth / 2;
        const centerY = container.offsetHeight / 2;
        
        // Zoom out by 20%
        const zoomFactor = 1 / 1.2;
        const currentScale = this.molpad.getScale ? this.molpad.getScale() : 1;
        const minZoom = (this.molpad.s && this.molpad.s.minZoom) ? this.molpad.s.minZoom : 0.01;
        
        // Don't zoom below minimum
        if (currentScale * zoomFactor >= minZoom) {
            if (typeof this.molpad.scaleAbsolute === 'function') {
                this.molpad.scaleAbsolute(zoomFactor, centerX, centerY);
            } else if (typeof this.molpad.scale === 'function') {
                this.molpad.scale(zoomFactor, centerX, centerY);
            }
        } else {
            return; // Can't zoom out further
        }

        // Ensure molecule stays in view after zoom
        this.ensureMoleculeInView();
        this.molpad.redraw(true);
    }

    zoomReset() {
        if (!this.molpad) return;
        
        // Reset to default scale (1.0) and center
        if (typeof this.molpad.resetMatrix === 'function') {
            this.molpad.resetMatrix();
        }
        
        if (this.molpad.mol && this.molpad.mol.atoms.length > 0) {
            if (typeof this.molpad.center === 'function') {
                this.molpad.center();
            }
        }

        // Ensure molecule is fully visible
        this.ensureMoleculeInView();
        this.molpad.redraw(true);
    }

    zoomFit() {
        if (!this.molpad) return;
        
        // Center and fit molecule to view
        if (this.molpad.mol && this.molpad.mol.atoms.length > 0) {
            this.molpad.center();
            this.ensureMoleculeInView();
            this.molpad.redraw(true);
        } else {
            // If no molecule, just reset
            this.zoomReset();
        }
    }

    getZoomOrigin() {
        if (!this.molpad) {
            return { x: 0, y: 0 };
        }

        const canvasWidth = typeof this.molpad.width === 'function'
            ? this.molpad.width()
            : (this.molpad.canvas?.width || 0);
        const canvasHeight = typeof this.molpad.height === 'function'
            ? this.molpad.height()
            : (this.molpad.canvas?.height || 0);

        if (!this.molpad.mol || this.molpad.mol.atoms.length === 0) {
            return {
                x: canvasWidth / 2,
                y: canvasHeight / 2
            };
        }

        const bbox = this.molpad.mol.getBBox();
        const matrix = this.molpad.matrix || [1, 0, 0, 1, 0, 0];
        const centerX = (bbox.x + bbox.width / 2) * matrix[0] + matrix[4];
        const centerY = (bbox.y + bbox.height / 2) * matrix[3] + matrix[5];

        if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
            return {
                x: canvasWidth / 2,
                y: canvasHeight / 2
            };
        }

        return { x: centerX, y: centerY };
    }

    ensureMoleculeInView(padding = 80) {
        if (!this.molpad || !this.molpad.mol || this.molpad.mol.atoms.length === 0) {
            return;
        }

        const bbox = this.molpad.mol.getBBox();
        if (!bbox || !Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.width === 0 || bbox.height === 0) {
            return;
        }

        const matrix = this.molpad.matrix || [1, 0, 0, 1, 0, 0];
        const scale = matrix[0]; // Use uniform scale
        const translateX = matrix[4];
        const translateY = matrix[5];

        const canvasWidth = typeof this.molpad.width === 'function'
            ? this.molpad.width()
            : (this.molpad.canvas?.width || 0);
        const canvasHeight = typeof this.molpad.height === 'function'
            ? this.molpad.height()
            : (this.molpad.canvas?.height || 0);

        if (!canvasWidth || !canvasHeight) {
            return;
        }

        // Calculate molecule bounds in screen space
        const molLeft = bbox.x * scale + translateX;
        const molRight = (bbox.x + bbox.width) * scale + translateX;
        const molTop = bbox.y * scale + translateY;
        const molBottom = (bbox.y + bbox.height) * scale + translateY;

        const molWidth = molRight - molLeft;
        const molHeight = molBottom - molTop;
        const viewWidth = canvasWidth - padding * 2;
        const viewHeight = canvasHeight - padding * 2;

        let dx = 0;
        let dy = 0;

        // Center molecule if it's larger than viewport
        if (molWidth > viewWidth) {
            dx = (canvasWidth / 2) - ((molLeft + molRight) / 2);
        } else {
            // Keep molecule within bounds with padding
            if (molLeft < padding) {
                dx = padding - molLeft;
            } else if (molRight > canvasWidth - padding) {
                dx = (canvasWidth - padding) - molRight;
            }
        }

        if (molHeight > viewHeight) {
            dy = (canvasHeight / 2) - ((molTop + molBottom) / 2);
        } else {
            // Keep molecule within bounds with padding
            if (molTop < padding) {
                dy = padding - molTop;
            } else if (molBottom > canvasHeight - padding) {
                dy = (canvasHeight - padding) - molBottom;
            }
        }

        // Apply translation if needed
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
            this.molpad.matrix[4] += dx;
            this.molpad.matrix[5] += dy;
        }
    }

    hookLonePairRendering() {
        console.log('🔗 Hooking into MolPad draw cycle for custom rendering...');
        if (!this.molpad) {
            console.error('❌ Cannot hook rendering: molpad not available');
            return;
        }

        // Override MolPad's draw method to add custom rendering
        const originalDraw = this.molpad.draw.bind(this.molpad);
        
        let drawCallCount = 0;
        this.molpad.draw = () => {
            try {
                drawCallCount++;
                // Call original draw
                originalDraw();
                
                // Draw lone pairs if enabled
                if (this.showLonePairs) {
                    try {
                        this.drawLonePairs();
                    } catch (e) {
                        console.error('❌ Error drawing lone pairs:', e);
                    }
                }
                
                // Draw charges if enabled
                if (this.displayOptions && this.displayOptions.charges) {
                    try {
                        this.drawCharges();
                    } catch (e) {
                        console.error('❌ Error drawing charges:', e);
                    }
                }
                
                // Draw hybridization if enabled
                if (this.displayOptions && this.displayOptions.hybridization) {
                    try {
                        this.drawHybridization();
                    } catch (e) {
                        console.error('❌ Error drawing hybridization:', e);
                    }
                }

                // Draw valence warnings if enabled
                if (this.displayOptions && this.displayOptions.valenceWarnings) {
                    try {
                        this.drawValenceWarnings();
                    } catch (e) {
                        console.error('❌ Error drawing valence warnings:', e);
                    }
                }
                
                // ALWAYS draw OH labels for single-bonded oxygen to carbon (regardless of hydrogen toggle)
                try {
                    this.drawOHLabels();
                } catch (e) {
                    console.error('❌ Error drawing OH labels:', e);
                }
            } catch (e) {
                console.error('❌ Critical error in draw cycle:', e);
                // Still call original draw to ensure MolPad renders
                try {
                    originalDraw();
                } catch (e2) {
                    console.error('❌ Error in original draw:', e2);
                }
            }
        };
    }
    
    drawValenceWarnings() {
        if (!this.molpad || !this.molpad.mol || !this.molpad.ctx) {
            return;
        }

        const mol = this.molpad.mol;
        const ctx = this.molpad.ctx;
        const molWrapper = this.createMolWrapper(mol);
        
        ctx.save();
        ctx.transform(
            this.molpad.matrix[0], this.molpad.matrix[1],
            this.molpad.matrix[2], this.molpad.matrix[3],
            this.molpad.matrix[4], this.molpad.matrix[5]
        );

        for (let i = 0; i < mol.atoms.length; i++) {
            const atom = mol.atoms[i];
            if (!atom) continue;
            if (!atom.center || atom.center.x === undefined || atom.center.y === undefined) continue;
            
            // Skip if we don't have chemistry intelligence
            if (!this.chemIntelligence) continue;
            
            try {
                // Create temp atom for check
                const atomIdx = atom.index !== undefined ? atom.index : i;
                const tempAtom = {
                    id: atomIdx,
                    element: atom.element,
                    charge: atom.charge || 0
                };
                
                if (!this.chemIntelligence.isValenceSatisfied(tempAtom, molWrapper)) {
                    const x = atom.center.x;
                    const y = atom.center.y;
                    
                    // Draw warning background
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    ctx.beginPath();
                    ctx.arc(x, y, 12, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Draw warning icon/text
                    ctx.fillStyle = '#FF0000';
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    // Small exclamation mark top-right
                    ctx.fillText('!', x + 8, y - 8);
                }
            } catch (e) {
                // Silent fail for individual atoms
            }
        }
        
        ctx.restore();
    }

    drawOHLabels() {
        if (!this.molpad || !this.molpad.mol || !this.molpad.ctx) {
            return;
        }

        const mol = this.molpad.mol;
        const ctx = this.molpad.ctx;
        
        if (!mol.atoms || !mol.bonds) return;
        
        // Create wrapper once for reuse if needed by chemIntelligence
        const molWrapper = this.chemIntelligence ? this.createMolWrapper(mol) : null;
        
        ctx.save();
        
        // Apply MolPad's transformation matrix
        ctx.transform(
            this.molpad.matrix[0], this.molpad.matrix[1],
            this.molpad.matrix[2], this.molpad.matrix[3],
            this.molpad.matrix[4], this.molpad.matrix[5]
        );

        for (let i = 0; i < mol.atoms.length; i++) {
            const atom = mol.atoms[i];
            if (!atom) continue;
            
            // Only process oxygen atoms
            if (atom.element !== 'O') continue;
            
            // Check if atom has center coordinates
            if (!atom.center || atom.center.x === undefined || atom.center.y === undefined) continue;
            
            // Check if single-bonded to carbon
            // OH label only makes sense if it has 1 implicit H
            
            // Calculate implicit hydrogens
            let implicitH = 0;
            try {
                if (this.chemIntelligence) {
                    const atomIdx = atom.index !== undefined ? atom.index : i;
                    const tempAtom = {
                        id: atomIdx,
                        element: atom.element,
                        charge: atom.charge || 0
                    };
                    implicitH = this.chemIntelligence.calculateImplicitHydrogens(tempAtom, molWrapper);
                } else {
                    implicitH = this.calculateImplicitHForMolPadAtom(atom, mol);
                }
                
                if (implicitH !== 1) continue;
            } catch (e) {
                // console.warn('Error calculating implicit H for OH label:', e);
                continue;
            }
            
            // Further checks to ensure it's connected to Carbon (optional but good for style)
            // ... existing logic checks this ...
            if (!atom.bonds || !Array.isArray(atom.bonds) || atom.bonds.length !== 1) continue;
            
            const bondIdx = atom.bonds[0];
            if (bondIdx === undefined || bondIdx === null) continue;
            
            const bond = mol.bonds[bondIdx];
            if (!bond) continue;
            
            const atomIdx = atom.index !== undefined ? atom.index : i;
            const otherAtomIdx = bond.from === atomIdx ? bond.to : bond.from;
            
            if (otherAtomIdx === undefined || otherAtomIdx === null || otherAtomIdx < 0 || otherAtomIdx >= mol.atoms.length) continue;
            
            const otherAtom = mol.atoms[otherAtomIdx];
            if (!otherAtom || otherAtom.element !== 'C') continue;
            
            if (!otherAtom.center || otherAtom.center.x === undefined || otherAtom.center.y === undefined) continue;
            
            // Draw OH label
            const x = atom.center.x;
            const y = atom.center.y;
            
            // Calculate angle FROM oxygen TO carbon
            const dx = otherAtom.center.x - x;
            const dy = otherAtom.center.y - y;
            // Negative dy because canvas y-axis is flipped
            const bondAngle = Math.atan2(-dy, dx);
            
            // Position OH label on the opposite side (180° away) from the bond
            const labelAngle = bondAngle + Math.PI;
            const labelDistance = 12; // Distance from atom center
            const labelX = x + Math.cos(labelAngle) * labelDistance;
            const labelY = y + Math.sin(labelAngle) * labelDistance;
            
            // Draw "OH" label
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#333';
            ctx.fillText('OH', labelX, labelY);
        }
        
        ctx.restore();
    }

    drawLonePairs() {
        if (!this.molpad || !this.molpad.mol || !this.molpad.ctx) {
            return;
        }

        // Ensure charges and lone pairs are calculated first (real-time update)
        this.updateChargesAndLonePairs();

        const mol = this.molpad.mol;
        const ctx = this.molpad.ctx;
        
        // Save context state
        ctx.save();
        
        // Apply MolPad's transformation matrix
        ctx.transform(
            this.molpad.matrix[0], this.molpad.matrix[1],
            this.molpad.matrix[2], this.molpad.matrix[3],
            this.molpad.matrix[4], this.molpad.matrix[5]
        );

        // Calculate and draw lone pairs for each atom
        let atomsProcessed = 0;
        let lonePairsDrawn = 0;
        const debugInfo = [];
        
        for (let i = 0; i < mol.atoms.length; i++) {
            const atom = mol.atoms[i];
            if (!atom) continue;
            
            // Check if atom has center coordinates
            if (!atom.center || atom.center.x === undefined || atom.center.y === undefined) continue;
            
            // Skip hydrogen and carbon atoms - carbons don't have lone pairs in normal organic molecules
            if (atom.element === 'H' || atom.element === 'C') continue;
            
            atomsProcessed++;
            // Always recalculate for real-time updates (don't use cache)
            try {
                const lonePairs = this.calculateLonePairs(atom, mol);
                atom.lonePairs = lonePairs; // Update cache
                
                if (lonePairs > 0) {
                    debugInfo.push(`${atom.element}${i}: ${lonePairs} LP`);
                    try {
                        this.drawLonePairsForAtom(atom, lonePairs, ctx, i);
                        lonePairsDrawn += lonePairs;
                    } catch (e) {
                        console.error(`❌ Error drawing lone pairs for atom ${i} (${atom.element}):`, e, e.stack);
                    }
                }
            } catch (e) {
                console.error(`❌ Error calculating lone pairs for atom ${i} (${atom.element}):`, e);
            }
        }
        
        // Debug info available in debugInfo array if needed

        ctx.restore();
    }

    drawCharges() {
        if (!this.molpad || !this.molpad.mol || !this.molpad.ctx) {
            return;
        }

        // Ensure charges are calculated first (real-time update)
        this.updateChargesAndLonePairs();

        const mol = this.molpad.mol;
        const ctx = this.molpad.ctx;
        
        ctx.save();
        ctx.transform(
            this.molpad.matrix[0], this.molpad.matrix[1],
            this.molpad.matrix[2], this.molpad.matrix[3],
            this.molpad.matrix[4], this.molpad.matrix[5]
        );

        let chargeCount = 0;
        const debugInfo = [];
        
        for (let i = 0; i < mol.atoms.length; i++) {
            const atom = mol.atoms[i];
            if (!atom) continue;
            
            // Check if atom has center coordinates
            if (!atom.center || atom.center.x === undefined || atom.center.y === undefined) continue;
            
            // Use stored charge (should be set by updateChargesAndLonePairs)
            // Only use formal charge (integers), ignore partial charges with decimals
            let charge = atom.charge;
            if (charge === undefined || charge === null || isNaN(charge)) {
                try {
                    // Recalculate if not set
                    const formalCharge = this.calculateFormalChargeFallback(atom, mol);
                    // Round to integer - only show formal charges
                    const roundedFormal = Math.round(formalCharge);
                    charge = Math.abs(formalCharge - roundedFormal) < 0.01 ? roundedFormal : 0;
                    atom.charge = charge;
                    atom.formalCharge = formalCharge;
                } catch (e) {
                    console.warn(`Error calculating charge for atom ${i}:`, e);
                    charge = 0;
                }
            }
            
            // Ensure charge is a number
            charge = Number(charge) || 0;
            
            // Only show charges if they're significant formal charges (integers, not decimals)
            // Round to nearest integer to check if it's a formal charge
            const roundedToInt = Math.round(charge);
            const isFormalCharge = Math.abs(charge - roundedToInt) < 0.01;
            
            // Only display if it's a formal charge (integer)
            if (isFormalCharge && Math.abs(roundedToInt) > 0) {
                chargeCount++;
                const x = atom.center.x;
                const y = atom.center.y;
                
                // Format charge - only show integer formal charges
                let chargeText;
                const absCharge = Math.abs(roundedToInt);
                if (absCharge === 1) {
                    chargeText = charge > 0 ? '+' : '−';
                } else {
                    chargeText = charge > 0 ? `${absCharge}+` : `${absCharge}−`;
                }
                
                debugInfo.push(`${atom.element}${i}: ${chargeText}`);
                
                // Draw charge label with better visibility
                ctx.save();
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Measure text for background
                const metrics = ctx.measureText(chargeText);
                const textWidth = metrics.width;
                const textHeight = 14;
                const padding = 4;
                
                // Add white background with rounded corners effect
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(
                    x + 12 - textWidth/2 - padding, 
                    y - 20 - textHeight/2, 
                    textWidth + padding * 2, 
                    textHeight + padding
                );
                
                // Draw charge text
                ctx.fillStyle = charge > 0 ? '#0066FF' : '#A61F24';
                ctx.fillText(chargeText, x + 12, y - 15);
                ctx.restore();
            }
        }
        
        ctx.restore();
        
        if (chargeCount > 0) {
            console.log(`✅ Drew charges on ${chargeCount} atoms:`, debugInfo.join(', '));
        } else {
            console.log(`ℹ️ No charges to draw (checked ${mol.atoms.length} atoms)`);
        }
    }

    drawHybridization() {
        if (!this.molpad || !this.molpad.mol) {
            return;
        }

        const mol = this.molpad.mol;
        const ctx = this.molpad.ctx;
        
        ctx.save();
        ctx.transform(
            this.molpad.matrix[0], this.molpad.matrix[1],
            this.molpad.matrix[2], this.molpad.matrix[3],
            this.molpad.matrix[4], this.molpad.matrix[5]
        );

        let hybridCount = 0;
        for (let i = 0; i < mol.atoms.length; i++) {
            const atom = mol.atoms[i];
            if (!atom) continue;
            
            // Check if atom has center coordinates
            if (!atom.center || atom.center.x === undefined || atom.center.y === undefined) continue;
            
            // Calculate hybridization based on bonds
            const bondCount = atom.bonds ? atom.bonds.length : 0;
            let hybridization = 'unknown';
            
            if (bondCount === 0) {
                hybridization = 'none';
            } else if (bondCount === 1) {
                // Check for triple bond
                const bond = mol.bonds[atom.bonds[0]];
                if (bond && bond.type === 3) {
                    hybridization = 'sp';
                } else {
                    hybridization = 'sp';
                }
            } else if (bondCount === 2) {
                // Check for double bond
                let hasDouble = false;
                for (let j = 0; j < atom.bonds.length; j++) {
                    const bond = mol.bonds[atom.bonds[j]];
                    if (bond && bond.type >= 2) {
                        hasDouble = true;
                        break;
                    }
                }
                hybridization = hasDouble ? 'sp2' : 'sp';
            } else if (bondCount === 3) {
                hybridization = 'sp2';
            } else if (bondCount >= 4) {
                hybridization = 'sp3';
            }
            
            if (hybridization !== 'unknown' && hybridization !== 'none') {
                hybridCount++;
                const x = atom.center.x;
                const y = atom.center.y;
                
                // Draw hybridization label below atom
                ctx.fillStyle = '#666';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(hybridization, x, y + 15);
            }
        }
        
        ctx.restore();
    }

    createMolWrapper(mol) {
        return {
            getAtomBonds: (atomId) => {
                // MolPad uses array index as ID usually, but let's handle both
                const targetAtom = mol.atoms[atomId];
                if (!targetAtom || !targetAtom.bonds) return [];
                
                return targetAtom.bonds.map(bondIdx => {
                    const bond = mol.bonds[bondIdx];
                    if (!bond) return null;
                    return {
                        id: bondIdx,
                        atom1: bond.from,
                        atom2: bond.to,
                        order: bond.type || 1
                    };
                }).filter(b => b !== null);
            },
            getAtomById: (atomId) => {
                const a = mol.atoms[atomId];
                if (!a) return null;
                return {
                    id: atomId,
                    element: a.element,
                    charge: a.charge || 0
                };
            }
        };
    }

    calculateLonePairs(atom, mol) {
        // Try to use ChemistryIntelligence if available
        if (this.chemIntelligence) {
            try {
                const atomIdx = atom.index !== undefined ? atom.index : 
                               (atom.id !== undefined ? atom.id : -1);
                               
                if (atomIdx !== -1) {
                    // Create compatible atom object
                    const tempAtom = {
                        id: atomIdx,
                        element: atom.element,
                        charge: atom.charge || 0
                    };
                    
                    // Create compatible molecule wrapper
                    const molWrapper = this.createMolWrapper(mol);
                    
                    return this.chemIntelligence.calculateLonePairs(tempAtom, molWrapper);
                }
            } catch (e) {
                console.warn('⚠️ ChemistryIntelligence.calculateLonePairs failed, using fallback:', e);
            }
        }

        // Fallback to inline calculation if ChemistryIntelligence fails
        // OCTET RULE: Most atoms want 8 electrons around them (4 electron pairs)
        // Hydrogen wants 2 electrons (1 electron pair)
        
        // Standard valence electrons for common elements
        const valenceElectrons = {
            'H': 1, 'C': 4, 'N': 5, 'O': 6, 'F': 7,
            'P': 5, 'S': 6, 'Cl': 7, 'Br': 7, 'I': 7,
            'B': 3, 'Si': 4, 'Li': 1, 'Na': 1, 'K': 1,
            'Mg': 2, 'Ca': 2, 'Al': 3
        };
        
        const element = atom.element;
        const V = valenceElectrons[element] || 0;
        if (V === 0) return 0;
        
        // Get atom index (MolPad uses index property)
        const atomIdx = atom.index !== undefined ? atom.index : 
                        (atom.id !== undefined ? atom.id : -1);
        if (atomIdx === -1) return 0;
        
        // Calculate bonding electrons and explicit hydrogens
        let bondingElectrons = 0; // Total shared electrons
        let explicitH = 0; // Explicit H atoms bonded
        
        if (atom.bonds && atom.bonds.length > 0) {
            for (let i = 0; i < atom.bonds.length; i++) {
                const bondIdx = atom.bonds[i];
                const bond = mol.bonds[bondIdx];
                if (!bond) continue;
                
                const bondOrder = bond.type || 1;
                // Each bond contributes 2 shared electrons (one per atom)
                bondingElectrons += bondOrder * 2;
                
                // Count explicit hydrogen atoms
                const otherAtomIdx = bond.from === atomIdx ? bond.to : bond.from;
                const otherAtom = mol.atoms[otherAtomIdx];
                if (otherAtom && otherAtom.element === 'H') {
                    explicitH++;
                }
            }
        }
        
        // Account for formal charge
        // Positive charge = fewer electrons available
        // Negative charge = more electrons available
        const charge = atom.charge || 0;
        const effectiveElectrons = V - charge;
        
        // OCTET RULE CALCULATION:
        // Electrons used = (bonding electrons / 2) + explicit H electrons
        // Remaining electrons = effective electrons - used electrons
        // Lone pairs = remaining electrons / 2
        
        const usedElectrons = (bondingElectrons / 2) + explicitH;
        const remainingElectrons = effectiveElectrons - usedElectrons;
        
        // Ensure non-negative
        const lonePairs = Math.max(0, Math.floor(remainingElectrons / 2));
        
        return lonePairs;
    }
    
    updateChargesAndLonePairs() {
        console.log('🔍 updateChargesAndLonePairs() called');
        if (!this.molpad || !this.molpad.mol) {
            console.warn('⚠️ updateChargesAndLonePairs: Missing molpad/mol');
            return;
        }
        
        const mol = this.molpad.mol;
        let ci = null;
        
        // Try to get ChemistryIntelligence, but don't fail if it's not available
        if (typeof ChemistryIntelligence !== 'undefined') {
            try {
                ci = new ChemistryIntelligence();
                console.log('✅ ChemistryIntelligence available');
            } catch (e) {
                console.warn('⚠️ Failed to create ChemistryIntelligence:', e);
            }
        } else {
            console.log('ℹ️ ChemistryIntelligence not available, using fallback');
        }
        
        const debugUpdates = [];
        
        // Update charges and lone pairs on all atoms (real-time)
        for (let i = 0; i < mol.atoms.length; i++) {
            const atom = mol.atoms[i];
            if (!atom) continue;
            
            try {
                // Calculate formal charge
                let formalCharge = 0;
                if (ci && typeof ci.calculateFormalCharge === 'function') {
                try {
                    // Create a temporary atom object compatible with ChemistryIntelligence
                    const tempAtom = {
                        id: atom.index !== undefined ? atom.index : i,
                        element: atom.element,
                        charge: atom.charge || 0
                    };
                    
                    // Create a temporary molecule wrapper for ChemistryIntelligence
                    const tempMolecule = {
                        getAtomBonds: (atomId) => {
                            const targetAtom = mol.atoms[atomId];
                            if (!targetAtom || !targetAtom.bonds) return [];
                            
                            return targetAtom.bonds.map(bondIdx => {
                                const bond = mol.bonds[bondIdx];
                                return {
                                    id: bondIdx,
                                    atom1: bond.from,
                                    atom2: bond.to,
                                    order: bond.type || 1
                                };
                            });
                        },
                        getAtomById: (atomId) => {
                            const a = mol.atoms[atomId];
                            if (!a) return null;
                            return {
                                id: atomId,
                                element: a.element,
                                charge: a.charge || 0
                            };
                        }
                    };
                    
                    formalCharge = ci.calculateFormalCharge(tempAtom, tempMolecule);
                } catch (e) {
                    console.warn(`⚠️ Failed to calculate charge for atom ${i} (${atom.element}):`, e);
                    formalCharge = this.calculateFormalChargeFallback(atom, mol);
                }
            } else {
                // Fallback calculation
                formalCharge = this.calculateFormalChargeFallback(atom, mol);
            }
                
                // REMOVED: Partial charge calculations - they're inaccurate without quantum chemistry
                // ChemAxon Marvin uses sophisticated QM calculations we can't replicate
                // Only use formal charges (integers) which are reliable
                
                // Use formal charge for display (only integers, no decimals)
                const oldCharge = atom.charge;
                
                // Round formal charge to integer
                const roundedFormalCharge = Math.round(formalCharge * 100) / 100;
                const integerFormalCharge = Math.round(roundedFormalCharge);
                
                // Only use formal charge if it's an integer (not a calculation artifact)
                let displayCharge = Math.abs(roundedFormalCharge - integerFormalCharge) < 0.01 ? integerFormalCharge : 0;
                
                // Suppress charges on neutral atoms in normal bonding situations
                // Only show charges when there's a clear formal charge violation
                if (atom.element === 'C') {
                    // Carbon should rarely have formal charges in normal organic molecules
                    const neighbors = (atom.bonds || []).map(bondIdx => {
                        const bond = mol.bonds[bondIdx];
                        if (!bond) return null;
                        const otherIdx = bond.from === i ? bond.to : bond.from;
                        return mol.atoms[otherIdx];
                    }).filter(Boolean);
                    
                    const allNeighborsAreCH = neighbors.length > 0 && neighbors.every(nb => nb.element === 'C' || nb.element === 'H');
                    
                    // Suppress charges on carbons with only C/H neighbors (normal organic chains)
                    if (allNeighborsAreCH && Math.abs(displayCharge) < 1.5) {
                        displayCharge = 0;
                    }
                }
                
                // For other elements, only show if formal charge is clearly non-zero
                if (Math.abs(displayCharge) < 0.5) {
                    displayCharge = 0;
                }
                
                atom.charge = displayCharge;
                atom.formalCharge = formalCharge; // Store formal charge
                atom.partialCharge = 0; // Always 0 - we don't calculate partial charges
            
                // Store lone pairs count for drawing
                const oldLonePairs = atom.lonePairs;
                try {
                    atom.lonePairs = this.calculateLonePairs(atom, mol);
                } catch (e) {
                    console.warn(`Error calculating lone pairs for atom ${i}:`, e);
                    atom.lonePairs = 0;
                }
                
                // Debug logging for changes (only significant formal charges)
                const roundedFormal = Math.round(formalCharge);
                if (Math.abs(roundedFormal) > 0 && Math.abs(formalCharge - roundedFormal) < 0.01) {
                    if (oldCharge !== displayCharge || oldLonePairs !== atom.lonePairs) {
                        debugUpdates.push(`${atom.element}${i}: charge=${roundedFormal > 0 ? '+' : ''}${roundedFormal}, LP=${atom.lonePairs}`);
                    }
                } else if (atom.lonePairs > 0 && oldLonePairs !== atom.lonePairs) {
                    debugUpdates.push(`${atom.element}${i}: LP=${atom.lonePairs}`);
                }
            } catch (e) {
                console.error(`Error updating charges/lone pairs for atom ${i}:`, e);
            }
        }
        
        // Only log if there are significant charges or if explicitly debugging
        const hasSignificantCharges = debugUpdates.some(update => {
            const match = update.match(/charge=([\d.]+)/);
            return match && Math.abs(parseFloat(match[1])) > 0.01;
        });
        
        if (hasSignificantCharges && debugUpdates.length > 0) {
            console.log(`📊 Updated charges/lone pairs:`, debugUpdates.join(', '));
        }
    }
    
    calculateFormalChargeFallback(atom, mol) {
        // Fallback formal charge calculation without ChemistryIntelligence
        // Use valence electrons (not bonding capacity)
        const valenceElectrons = {
            'H': 1, 'C': 4, 'N': 5, 'O': 6, 'F': 7,
            'P': 5, 'S': 6, 'Cl': 7, 'Br': 7, 'I': 7,
            'B': 3, 'Si': 4, 'Li': 1, 'Na': 1, 'K': 1,
            'Mg': 2, 'Ca': 2, 'Al': 3
        };
        
        const element = atom.element;
        const V = valenceElectrons[element] || 0;
        if (V === 0) return 0;
        
        // Get atom index (MolPad uses index property)
        const atomIdx = atom.index !== undefined ? atom.index : 
                        (atom.id !== undefined ? atom.id : -1);
        if (atomIdx === -1) return 0;
        
        // Calculate bonding electrons (each bond contributes 2 shared electrons)
        let bondingElectrons = 0;
        let explicitH = 0;
        
        if (atom.bonds && atom.bonds.length > 0) {
            for (let i = 0; i < atom.bonds.length; i++) {
                const bondIdx = atom.bonds[i];
                const bond = mol.bonds[bondIdx];
                if (!bond) continue;
                
                const bondOrder = bond.type || 1;
                bondingElectrons += bondOrder * 2;
                
                // Count explicit hydrogen atoms
                const otherAtomIdx = bond.from === atomIdx ? bond.to : bond.from;
                const otherAtom = mol.atoms[otherAtomIdx];
                if (otherAtom && otherAtom.element === 'H') {
                    explicitH++;
                }
            }
        }
        
        // Calculate lone pairs
        const usedForBonding = (bondingElectrons / 2) + explicitH;
        const remainingElectrons = V - usedForBonding;
        const lonePairs = Math.max(0, Math.floor(remainingElectrons / 2));
        const nonbondingElectrons = lonePairs * 2;
        
        // Formal charge = V - (N + B/2)
        // V = valence electrons
        // N = nonbonding electrons (lone pairs)
        // B = bonding electrons (shared)
        const formalCharge = V - nonbondingElectrons - (bondingElectrons / 2);
        
        // Round to avoid floating point errors
        return Math.round(formalCharge * 100) / 100;
    }

    calculateImplicitHForMolPadAtom(atom, mol) {
        // Calculate implicit hydrogens for MolPad atom
        const element = atom.element;
        
        // Standard valences
        const valences = {
            'H': 1, 'C': 4, 'N': 3, 'O': 2, 'F': 1,
            'P': 3, 'S': 2, 'Cl': 1, 'Br': 1, 'I': 1,
            'B': 3, 'Si': 4
        };
        
        const valence = valences[element] || 0;
        if (valence === 0) return 0;
        
        // Calculate bond sum
        let bondSum = 0;
        if (atom.bonds && Array.isArray(atom.bonds)) {
            for (let i = 0; i < atom.bonds.length; i++) {
                const bondIdx = atom.bonds[i];
                if (bondIdx === undefined || bondIdx === null) continue;
                const bond = mol.bonds[bondIdx];
                if (!bond) continue;
                bondSum += bond.type || 1;
            }
        }
        
        // Account for charge
        const charge = atom.charge || 0;
        
        // Implicit H = valence - bondSum - charge
        return Math.max(0, valence - bondSum - charge);
    }
    
    calculatePartialCharge(atom, mol) {
        // REMOVED: Partial charge calculations are inaccurate without quantum chemistry
        // ChemAxon Marvin uses sophisticated QM calculations (Mulliken, NPA, etc.) - we can't replicate that
        // Simple electronegativity-based approximations are often wrong and misleading
        // Return 0 to suppress partial charges - only show formal charges (integers) which are reliable
        return 0;
    }

    drawLonePairsForAtom(atom, lonePairs, ctx, atomIndex) {
        const DEBUG = false; // Set to true for debugging
        const x = atom.center.x;
        const y = atom.center.y;
        
        if (DEBUG) console.log(`🎨 drawLonePairsForAtom: ${atom.element}${atomIndex}, ${lonePairs} lone pairs at (${x.toFixed(1)}, ${y.toFixed(1)})`);
        
        // Visualization parameters - increased radius for better separation
        const radius = 18; // Increased from 15 for better separation from bonds
        const dotRadius = 2.5; // Slightly larger dots
        const spacing = 4.5; // Space between the two dots in a pair
        
        // Get bond angles to position lone pairs away from bonds
        const bondAngles = [];
        const atomIdx = atom.index !== undefined ? atom.index : atomIndex;
        
        if (atom.bonds && atom.bonds.length > 0) {
            if (DEBUG) console.log(`  📍 Atom has ${atom.bonds.length} bonds`);
            for (let i = 0; i < atom.bonds.length; i++) {
                const bondIdx = atom.bonds[i];
                const bond = this.molpad.mol.bonds[bondIdx];
                if (!bond) {
                    if (DEBUG) console.warn(`  ⚠️ Bond ${bondIdx} not found`);
                    continue;
                }
                
                const otherAtomIdx = bond.from === atomIdx ? bond.to : bond.from;
                const otherAtom = this.molpad.mol.atoms[otherAtomIdx];
                if (otherAtom && otherAtom.center) {
                    const dx = otherAtom.center.x - x;
                    const dy = otherAtom.center.y - y;
                    // CRITICAL: Angle FROM atom TO bonded atom (for positioning lone pairs opposite)
                    // Negative dy because canvas y is flipped
                    const angle = Math.atan2(-dy, dx);
                    bondAngles.push(angle);
                    if (DEBUG) console.log(`  📍 Bond ${i} to ${otherAtom.element}${otherAtomIdx}: angle=${(angle * 180 / Math.PI).toFixed(1)}°`);
                } else {
                    if (DEBUG) console.warn(`  ⚠️ Other atom ${otherAtomIdx} not found or has no center`);
                }
            }
        }
        
        // Calculate positions for lone pairs - opposite to bonds
        const positions = this.calculateLonePairPositionsGrouped(
            lonePairs,
            bondAngles,
            radius
        );
        
        if (DEBUG) console.log(`  ✅ Calculated ${positions.length} positions for ${lonePairs} lone pairs`);
        
        // Draw lone pairs
        ctx.save();
        ctx.fillStyle = '#A61F24'; // Red color for lone pairs (matches renderer.js)
        ctx.strokeStyle = '#A61F24';
        ctx.lineWidth = 1;
        
        positions.forEach((pos, index) => {
            const pairX = x + pos.x;
            const pairY = y + pos.y;
            
            // Draw two dots for each lone pair
            const angle = pos.angle !== undefined ? pos.angle : Math.atan2(pos.y, pos.x);
            const perpAngle = angle + Math.PI / 2; // Perpendicular to radial direction
            const offsetX = Math.cos(perpAngle) * (spacing / 2);
            const offsetY = Math.sin(perpAngle) * (spacing / 2);
            
            // First dot
            ctx.beginPath();
            ctx.arc(pairX - offsetX, pairY - offsetY, dotRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Second dot
            ctx.beginPath();
            ctx.arc(pairX + offsetX, pairY + offsetY, dotRadius, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();
        if (DEBUG) console.log(`  ✅ Drew ${positions.length} lone pairs for ${atom.element}${atomIndex}`);
    }
    
    calculateLonePairPositionsGrouped(count, bondAngles, radius) {
        const DEBUG = false; // Set to true for debugging
        if (DEBUG) console.log(`🔍 calculateLonePairPositionsGrouped: count=${count}, bondAngles=`, bondAngles.map(a => (a * 180 / Math.PI).toFixed(1) + '°'));
        
        if (count === 0) {
            if (DEBUG) console.log('⏭️ No lone pairs to position');
            return [];
        }
        
        const positions = [];
        
        // Normalize bond angles to [0, 2π)
        const normalizedBondAngles = bondAngles.map(a => {
            let normalized = a;
            while (normalized < 0) normalized += Math.PI * 2;
            while (normalized >= Math.PI * 2) normalized -= Math.PI * 2;
            return normalized;
        }).sort((a, b) => a - b);
        
        if (DEBUG) console.log(`📍 Normalized bond angles:`, normalizedBondAngles.map(a => (a * 180 / Math.PI).toFixed(1) + '°'));
        
        // Minimum angle separation from bonds (in radians) - 60 degrees minimum
        const MIN_SEPARATION_FROM_BONDS = Math.PI / 3; // 60 degrees
        const MIN_SEPARATION_BETWEEN_LPS = Math.PI / 4; // 45 degrees between lone pairs
        
        const finalAngles = [];
        
        // SPECIAL CASE: Single bond - spread lone pairs symmetrically around opposite side
        // CRITICAL: bondAngles point TOWARD bonded atoms, so add PI to get opposite direction
        if (normalizedBondAngles.length === 1) {
            const bondAngle = normalizedBondAngles[0];
            // Add PI (180°) to get opposite direction from bond
            let oppositeAngle = bondAngle + Math.PI;
            // Normalize to 0-2π range
            while (oppositeAngle >= Math.PI * 2) oppositeAngle -= Math.PI * 2;
            while (oppositeAngle < 0) oppositeAngle += Math.PI * 2;
            
            if (count === 1) {
                // One lone pair: directly opposite (180° from bond)
                finalAngles.push(oppositeAngle);
            } else if (count === 2) {
                // Two lone pairs: spread ±30° around opposite side
                const lp1 = (oppositeAngle - Math.PI / 6 + Math.PI * 2) % (Math.PI * 2);
                const lp2 = (oppositeAngle + Math.PI / 6) % (Math.PI * 2);
                finalAngles.push(lp1);
                finalAngles.push(lp2);
            } else if (count === 3) {
                // Three lone pairs: spread ±45° around opposite side
                const lp1 = (oppositeAngle - Math.PI / 4 + Math.PI * 2) % (Math.PI * 2);
                const lp2 = oppositeAngle;
                const lp3 = (oppositeAngle + Math.PI / 4) % (Math.PI * 2);
                finalAngles.push(lp1);
                finalAngles.push(lp2);
                finalAngles.push(lp3);
            } else {
                // More than 3: distribute evenly around opposite hemisphere (180° arc)
                const spread = Math.PI; // 180 degrees
                for (let i = 0; i < count; i++) {
                    const offset = (spread * (i - (count - 1) / 2)) / Math.max(1, count - 1);
                    const angle = (oppositeAngle + offset + Math.PI * 2) % (Math.PI * 2);
                    finalAngles.push(angle);
                }
            }
            
            // CRITICAL: Convert to positions and RETURN immediately - don't fall through to gap calculation!
            const positions = finalAngles.map(angle => {
                return {
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius,
                    angle: angle
                };
            });
            
            return positions;
        } else {
            // MULTIPLE BONDS: Place in largest gaps between bonds
            // Calculate gaps between consecutive bonds
            const gaps = [];
            for (let i = 0; i < normalizedBondAngles.length; i++) {
                const current = normalizedBondAngles[i];
                const next = normalizedBondAngles[(i + 1) % normalizedBondAngles.length];
                
                let gapSize = next - current;
                if (gapSize < 0) gapSize += Math.PI * 2;
                
                gaps.push({
                    start: current,
                    end: next,
                    size: gapSize,
                    center: (current + gapSize / 2) % (Math.PI * 2)
                });
            }
            
            // Sort gaps by size (largest first)
            gaps.sort((a, b) => b.size - a.size);
            
            // Place lone pairs in largest gaps, ensuring separation
            for (let i = 0; i < count && i < gaps.length; i++) {
                const gap = gaps[i];
                
                // Check if gap is large enough
                if (gap.size >= MIN_SEPARATION_FROM_BONDS * 2) {
                    let angle = gap.center;
                    
                    // Ensure minimum separation from bonds
                    const tooCloseToBond = false;
                    for (const bondAngle of normalizedBondAngles) {
                        let dist = Math.abs(angle - bondAngle);
                        if (dist > Math.PI) dist = Math.PI * 2 - dist;
                        if (dist < MIN_SEPARATION_FROM_BONDS) {
                            // Push away from bond
                            const direction = (angle - bondAngle + Math.PI) % (Math.PI * 2) < Math.PI ? 1 : -1;
                            angle = (bondAngle + direction * MIN_SEPARATION_FROM_BONDS + Math.PI * 2) % (Math.PI * 2);
                        }
                    }
                    
                    // Ensure minimum separation from other lone pairs
                    let tooCloseToLP = false;
                    for (const lpAngle of finalAngles) {
                        let dist = Math.abs(angle - lpAngle);
                        if (dist > Math.PI) dist = Math.PI * 2 - dist;
                        if (dist < MIN_SEPARATION_BETWEEN_LPS) {
                            tooCloseToLP = true;
                            break;
                        }
                    }
                    
                    if (!tooCloseToLP) {
                        finalAngles.push(angle);
                        if (DEBUG) console.log(`✅ Placed LP ${finalAngles.length} at ${(angle * 180 / Math.PI).toFixed(1)}° (in gap)`);
                    }
                }
            }
            
            // If still need more, distribute evenly in remaining space
            if (finalAngles.length < count) {
                const remaining = count - finalAngles.length;
                // Find best positions that maximize distance from bonds and existing LPs
                for (let i = 0; i < remaining; i++) {
                    let bestAngle = 0;
                    let maxMinDist = -1;
                    
                    // Try angles around the circle
                    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 18) { // 10 degree steps
                        let minDist = Infinity;
                        
                        // Distance to bonds
                        for (const bondAngle of normalizedBondAngles) {
                            let dist = Math.abs(angle - bondAngle);
                            if (dist > Math.PI) dist = Math.PI * 2 - dist;
                            minDist = Math.min(minDist, dist);
                        }
                        
                        // Distance to existing LPs
                        for (const lpAngle of finalAngles) {
                            let dist = Math.abs(angle - lpAngle);
                            if (dist > Math.PI) dist = Math.PI * 2 - dist;
                            minDist = Math.min(minDist, dist);
                        }
                        
                        if (minDist > maxMinDist && minDist >= MIN_SEPARATION_FROM_BONDS) {
                            maxMinDist = minDist;
                            bestAngle = angle;
                        }
                    }
                    
                    if (maxMinDist >= MIN_SEPARATION_FROM_BONDS) {
                        finalAngles.push(bestAngle);
                        if (DEBUG) console.log(`✅ Placed LP ${finalAngles.length} at ${(bestAngle * 180 / Math.PI).toFixed(1)}° (optimized)`);
                    }
                }
            }
        }
        
        // Convert angles to positions
        finalAngles.slice(0, count).forEach((angle, idx) => {
            positions.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
                angle: angle
            });
            if (DEBUG) console.log(`📍 LP ${idx + 1} position: angle=${(angle * 180 / Math.PI).toFixed(1)}°`);
        });
        
        if (DEBUG) console.log(`✅ Calculated ${positions.length} lone pair positions`);
        return positions;
    }

    calculateLonePairPositions(count, bondAngles, radius) {
        if (count === 0) return [];
        
        const positions = [];
        
        // Normalize all angles to [0, 2π)
        const normalizedBondAngles = bondAngles.map(a => {
            let normalized = a;
            while (normalized < 0) normalized += Math.PI * 2;
            while (normalized >= Math.PI * 2) normalized -= Math.PI * 2;
            return normalized;
        }).sort((a, b) => a - b);
        
        // Calculate total electron domains (bonds + lone pairs)
        const totalDomains = normalizedBondAngles.length + count;
        
        // Ideal angles for electron domains (VSEPR theory)
        let idealAngles = [];
        if (totalDomains === 2) {
            idealAngles = [0, Math.PI];
        } else if (totalDomains === 3) {
            idealAngles = [0, Math.PI * 2/3, Math.PI * 4/3];
        } else if (totalDomains === 4) {
            idealAngles = [0, Math.PI/2, Math.PI, Math.PI * 3/2];
        } else if (totalDomains === 5) {
            // Trigonal bipyramidal
            idealAngles = [0, Math.PI * 2/5, Math.PI * 4/5, Math.PI * 6/5, Math.PI * 8/5];
        } else {
            // Octahedral or more - distribute evenly
            for (let i = 0; i < totalDomains; i++) {
                idealAngles.push((Math.PI * 2 * i) / totalDomains);
            }
        }
        
        // Find positions for lone pairs (avoid bond angles)
        const usedAngles = [...normalizedBondAngles];
        const lonePairAngles = [];
        
        for (let i = 0; i < count; i++) {
            // Find the best angle that's furthest from bonds
            let bestAngle = 0;
            let maxMinDistance = -1;
            
            for (const candidateAngle of idealAngles) {
                // Skip if too close to a bond
                let minDistance = Infinity;
                for (const bondAngle of usedAngles) {
                    let dist = Math.abs(candidateAngle - bondAngle);
                    if (dist > Math.PI) dist = Math.PI * 2 - dist;
                    minDistance = Math.min(minDistance, dist);
                }
                
                if (minDistance > maxMinDistance) {
                    maxMinDistance = minDistance;
                    bestAngle = candidateAngle;
                }
            }
            
            // If no good angle found, use evenly spaced
            if (maxMinDistance < Math.PI / 6) {
                bestAngle = (Math.PI * 2 * i) / count;
            }
            
            lonePairAngles.push(bestAngle);
            usedAngles.push(bestAngle);
            usedAngles.sort((a, b) => a - b);
        }
        
        // Convert angles to positions
        lonePairAngles.forEach(angle => {
            positions.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        });
        
        return positions;
    }

    setupTouchGestures() {
        if (!this.molpad) return;

        const container = this.molpad.container[0] || document.getElementById('molpad-container');
        if (!container) return;

        // Store touch gesture state
        this.touchGestureState = {
            active: false,
            type: null, // 'pan' or 'zoom'
            startData: null
        };

        // Helper to get touch center point
        const getTouchCenter = (touches) => {
            let x = 0, y = 0;
            for (let i = 0; i < touches.length; i++) {
                x += touches[i].clientX;
                y += touches[i].clientY;
            }
            return {
                x: x / touches.length,
                y: y / touches.length
            };
        };

        // Helper to get distance between first two touches
        const getTouchDistance = (touches) => {
            if (touches.length < 2) return 0;
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        // Override MolPad's touch handling for 2-finger pan and 3-finger zoom
        // We need to intercept before MolPad processes it
        const originalOnPointerDown = this.molpad.onPointerDown.bind(this.molpad);
        
        // Create a custom handler that intercepts multi-touch
        const handleTouchStart = (e) => {
            const touches = e.originalEvent ? e.originalEvent.touches : e.touches;
            
            if (touches && touches.length === 2) {
                // 2 fingers = pan only
                e.preventDefault();
                e.stopImmediatePropagation();
                
                this.touchGestureState.active = true;
                this.touchGestureState.type = 'pan';
                
                const center = getTouchCenter(touches);
                const rect = container.getBoundingClientRect();
                
                this.touchGestureState.startData = {
                    lastX: center.x - rect.left,
                    lastY: center.y - rect.top
                };
                
                // Prevent MolPad from handling this
                return false;
            } else if (touches && touches.length === 3) {
                // 3 fingers = zoom only
                e.preventDefault();
                e.stopImmediatePropagation();
                
                this.touchGestureState.active = true;
                this.touchGestureState.type = 'zoom';
                
                const distance = getTouchDistance(touches);
                const center = getTouchCenter(touches);
                const rect = container.getBoundingClientRect();
                
                this.touchGestureState.startData = {
                    lastDistance: distance,
                    centerX: center.x - rect.left,
                    centerY: center.y - rect.top
                };
                
                // Prevent MolPad from handling this
                return false;
            }
            
            // Single touch or other - let MolPad handle normally
            return true;
        };

        // Intercept touchstart events before MolPad
        container.addEventListener('touchstart', (e) => {
            const touches = e.touches;
            
            if (touches.length === 2 || touches.length === 3) {
                handleTouchStart(e);
            }
        }, { capture: true, passive: false });

        // Handle touchmove for pan and zoom
        container.addEventListener('touchmove', (e) => {
            if (!this.touchGestureState.active) return;
            
            const touches = e.touches;
            
            if (this.touchGestureState.type === 'pan' && touches.length === 2) {
                // 2-finger pan
                e.preventDefault();
                e.stopImmediatePropagation();
                
                const center = getTouchCenter(touches);
                const rect = container.getBoundingClientRect();
                const currentX = center.x - rect.left;
                const currentY = center.y - rect.top;
                
                const dx = (currentX - this.touchGestureState.startData.lastX) * this.molpad.devicePixelRatio;
                const dy = (currentY - this.touchGestureState.startData.lastY) * this.molpad.devicePixelRatio;
                
                this.molpad.translate(dx, dy);
                this.molpad.requestRedraw();
                
                this.touchGestureState.startData.lastX = currentX;
                this.touchGestureState.startData.lastY = currentY;
            } else if (this.touchGestureState.type === 'zoom' && touches.length === 3) {
                // 3-finger zoom
                e.preventDefault();
                e.stopImmediatePropagation();
                
                const distance = getTouchDistance(touches);
                const center = getTouchCenter(touches);
                const rect = container.getBoundingClientRect();
                
                const scaleFactor = distance / this.touchGestureState.startData.lastDistance;
                const centerX = center.x - rect.left;
                const centerY = center.y - rect.top;
                
                // Apply zoom
                this.molpad.scaleAbsolute(scaleFactor, centerX, centerY);
                this.molpad.requestRedraw();
                
                this.touchGestureState.startData.lastDistance = distance;
                this.touchGestureState.startData.centerX = centerX;
                this.touchGestureState.startData.centerY = centerY;
            } else {
                // Finger count changed - cancel gesture
                this.touchGestureState.active = false;
                this.touchGestureState.type = null;
                this.touchGestureState.startData = null;
            }
        }, { capture: true, passive: false });

        // Handle touchend
        container.addEventListener('touchend', (e) => {
            if (this.touchGestureState.active) {
                const touches = e.touches;
                
                if ((this.touchGestureState.type === 'pan' && touches.length < 2) ||
                    (this.touchGestureState.type === 'zoom' && touches.length < 3)) {
                    // Gesture ended
                    this.touchGestureState.active = false;
                    this.touchGestureState.type = null;
                    this.touchGestureState.startData = null;
                }
            }
        }, { capture: true, passive: false });

        container.addEventListener('touchcancel', () => {
            this.touchGestureState.active = false;
            this.touchGestureState.type = null;
            this.touchGestureState.startData = null;
        }, { capture: true, passive: false });
    }

    updateProperties() {
        if (!this.molpad || !this.molpad.mol) return;

        const mol = this.molpad.mol;
        const atomCount = mol.atoms.length;

        // Get formula from MolPad
        let formula = '-';
        try {
            // Check if molecule has atoms before trying to get SMILES
            if (mol && mol.atoms && mol.atoms.length > 0) {
                const smiles = this.molpad.getSMILES();
                if (smiles) {
                    // Simple formula calculation from atoms
                    const elementCounts = {};
                    mol.atoms.forEach(atom => {
                        elementCounts[atom.element] = (elementCounts[atom.element] || 0) + 1;
                    });
                    
                    // Build formula string
                    const parts = [];
                    if (elementCounts['C']) parts.push('C' + (elementCounts['C'] > 1 ? elementCounts['C'] : ''));
                    if (elementCounts['H']) parts.push('H' + (elementCounts['H'] > 1 ? elementCounts['H'] : ''));
                    Object.keys(elementCounts).forEach(el => {
                        if (el !== 'C' && el !== 'H') {
                            parts.push(el + (elementCounts[el] > 1 ? elementCounts[el] : ''));
                        }
                    });
                    formula = parts.join('');
                }
            }
        } catch (e) {
            // Silently handle empty molecule case - this is expected when no atoms exist
            if (e.message && e.message.includes('No atoms found')) {
                // Expected error when molecule is empty, don't log
            } else {
                console.warn('Could not get formula:', e);
            }
        }

        // Update UI
        const formulaEl = document.getElementById('mol-formula');
        const atomsEl = document.getElementById('mol-atoms');
        
        if (formulaEl) formulaEl.textContent = formula || '-';
        if (atomsEl) atomsEl.textContent = atomCount;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for all scripts to load
    setTimeout(() => {
        window.app = new OrbitalAppMolView();
    }, 100);
});

// Global function for tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const activePane = document.getElementById(`${tabName}-tab`);
    
    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.classList.add('active');
}

// Global function stubs
function moveToSimulation() {
    if (window.app && window.app.molpad) {
        const atomCount = window.app.molpad.mol ? window.app.molpad.mol.atoms.length : 0;
        if (atomCount === 0) {
            alert('Please draw a molecule first!');
            return;
        }
        switchTab('simulate');
    }
}

function showHelp() {
    alert('Help: Use Atom tool to place atoms, Bond tool to connect them, Chain tool to draw chains, and Erase tool to remove.');
}

function showAbout() {
    alert('Orbital v2.0 - Powered by MolView (GPLv3)');
}


