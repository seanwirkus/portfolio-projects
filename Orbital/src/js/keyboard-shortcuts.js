// Comprehensive Keyboard Shortcuts System
// Handles all keyboard interactions with visual feedback

class KeyboardShortcutManager {
    constructor(molecule, renderer, undoRedo, selection, chainTool, clipboard) {
        this.molecule = molecule;
        this.renderer = renderer;
        this.undoRedo = undoRedo;
        this.selection = selection;
        this.chainTool = chainTool;
        this.clipboard = clipboard;
        this.shortcuts = new Map();
        this.activeModifiers = {
            ctrl: false,
            shift: false,
            alt: false,
            cmd: false
        };
        this.currentTool = 'atom'; // atom, bond, chain, erase
        this.currentTab = 'draw'; // Track current tab
        this.setupShortcuts();
        this.setupKeyListener();
        this.setupTabTracking();
    }
    
    setupTabTracking() {
        // Track tab changes by listening to global currentTab or button clicks
        const updateTab = () => {
            // Try to get current tab from global variable or active tab button
            if (typeof currentTab !== 'undefined') {
                this.currentTab = currentTab;
            } else {
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab) {
                    this.currentTab = activeTab.dataset.tab || activeTab.textContent.toLowerCase().trim() || 'draw';
                }
            }
        };
        
        // Update on tab button clicks
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                updateTab();
            });
        });

        // Initial update
        updateTab();
    }

    setupShortcuts() {
        // Tool selection shortcuts
        this.registerShortcut('a', [], () => this.setTool('atom'), '🔵 Atom Tool (A)');
        this.registerShortcut('b', [], () => this.setTool('bond'), '🔗 Bond Tool (B)');
        this.registerShortcut('c', [], () => this.setTool('chain'), '⛓️ Chain Tool (C)');
        this.registerShortcut('s', [], () => this.setTool('select'), '👆 Select Tool (S)');
        this.registerShortcut('e', [], () => this.setTool('erase'), '🗑️ Erase Tool (E)');
        
        // Editing shortcuts
        this.registerShortcut('a', ['ctrl'], () => this.handleSelectAll(), '✓ Select All (Ctrl+A)');
        this.registerShortcut('c', ['ctrl'], () => this.handleCopy(), '📋 Copy (Ctrl+C)');
        this.registerShortcut('v', ['ctrl'], () => this.handlePaste(), '📌 Paste (Ctrl+V)');
        this.registerShortcut('x', ['ctrl'], () => this.handleCut(), '✂️ Cut (Ctrl+X)');
        this.registerShortcut('z', ['ctrl'], () => this.handleUndo(), '↶ Undo (Ctrl+Z)');
        this.registerShortcut('z', ['ctrl', 'shift'], () => this.handleRedo(), '↷ Redo (Ctrl+Shift+Z)');
        this.registerShortcut('Delete', [], () => this.handleDelete(), '🗑️ Delete');
        this.registerShortcut('Backspace', [], () => this.handleDelete(), '🗑️ Delete');
    }
    
    setTool(toolName) {
        this.currentTool = toolName;
        console.log(`🔧 Tool switched to: ${toolName}`);
        
        // Update toolbar UI by clicking the button
        const toolButton = document.getElementById(`tool-${toolName}`);
        if (toolButton) {
            toolButton.click();
        } else {
            // Fallback: manual UI update
            const toolButtons = document.querySelectorAll('.tool-btn');
            toolButtons.forEach(btn => {
                const btnTool = btn.id.replace('tool-', '');
                if (btnTool === toolName) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
        
        // Handle chain tool activation
        if (toolName === 'chain' && this.chainTool) {
            this.chainTool.startChainMode();
        } else if (toolName !== 'chain' && this.chainTool) {
            this.chainTool.stopChainMode();
        }
    }
    
    handleSelectAll() {
        if (this.selection) {
            this.selection.selectAll();
            // Trigger render to show selection highlights
            if (this.renderer) {
                this.renderer.render(this.molecule);
            }
            console.log(`✓ All ${this.selection.selectedAtoms.size} atoms selected`);
        }
    }
    
    handleCopy() {
        if (this.selection && this.clipboard) {
            const selectedAtoms = this.selection.getSelectedAtoms();
            if (selectedAtoms.length === 0) {
                console.log('⚠️ No atoms selected to copy');
                return;
            }
            try {
                this.clipboard.handleCopy(this.molecule);
                console.log('✓ Copied to clipboard');
            } catch (error) {
                console.error('Error copying:', error);
            }
        }
    }
    
    handlePaste() {
        if (this.clipboard) {
            try {
                this.clipboard.handlePaste(this.molecule);
                console.log('✓ Pasted from clipboard');
                if (this.renderer) {
                    this.renderer.render(this.molecule);
                }
            } catch (error) {
                console.error('Error pasting:', error);
            }
        }
    }
    
    handleCut() {
        if (this.selection && this.clipboard) {
            const selectedAtoms = this.selection.getSelectedAtoms();
            if (selectedAtoms.length === 0) {
                console.log('⚠️ No atoms selected to cut');
                return;
            }
            try {
                this.handleCopy();
                this.handleDelete();
                console.log('✓ Cut to clipboard');
            } catch (error) {
                console.error('Error cutting:', error);
            }
        }
    }
    
    handleUndo() {
        if (this.undoRedo) {
            const previousState = this.undoRedo.undo();
            if (previousState) {
                this.undoRedo.applyState(this.molecule, previousState);
                if (this.renderer) {
                    this.renderer.render(this.molecule);
                }
                console.log('↶ Undo applied');
            }
        }
    }
    
    handleRedo() {
        if (this.undoRedo) {
            const nextState = this.undoRedo.redo();
            if (nextState) {
                this.undoRedo.applyState(this.molecule, nextState);
                if (this.renderer) {
                    this.renderer.render(this.molecule);
                }
                console.log('↷ Redo applied');
            }
        }
    }
    
    handleDelete() {
        if (this.selection) {
            this.selection.deleteSelected();
            if (this.renderer) {
                this.renderer.render(this.molecule);
            }
            console.log('🗑️ Deleted selected atoms');
        }
    }
    
    setupKeyListener() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }
    
    handleKeyDown(event) {
        // Only handle shortcuts when on draw tab
        if (this.currentTab !== 'draw') {
            return;
        }
        
        // Don't intercept if typing in text input (allow normal text editing)
        if (this.isTextInputActive(event.target)) {
            return;
        }
        
        // Update modifier keys
        const hasCtrl = event.ctrlKey || event.metaKey;
        const hasShift = event.shiftKey;
        const hasAlt = event.altKey;
        
        this.activeModifiers.ctrl = hasCtrl;
        this.activeModifiers.shift = hasShift;
        this.activeModifiers.alt = hasAlt;
        this.activeModifiers.cmd = event.metaKey;
        
        // Handle Delete and Backspace specially (no modifiers)
        const key = event.key;
        const keyLower = key.toLowerCase();
        
        // Check for Delete/Backspace first (these are special keys, no modifiers)
        if ((key === 'Delete' || key === 'Backspace') && !hasCtrl && !hasShift && !hasAlt) {
            const shortcut = this.getShortcutKey(key, this.activeModifiers);
            if (this.shortcuts.has(shortcut)) {
                event.preventDefault();
                event.stopPropagation();
                const action = this.shortcuts.get(shortcut);
                action.callback();
                this.showShortcutFeedback(action.label);
            }
            return;
        }
        
        // For letter keys, prioritize modifier combinations over single keys
        // This ensures Ctrl+A (select all) works instead of just 'a' (atom tool)
        if (hasCtrl || hasShift || hasAlt) {
            // Check for modifier combinations first
            const shortcut = this.getShortcutKey(keyLower, this.activeModifiers);
            if (this.shortcuts.has(shortcut)) {
                event.preventDefault();
                event.stopPropagation();
                const action = this.shortcuts.get(shortcut);
                action.callback();
                this.showShortcutFeedback(action.label);
                return;
            }
        } else {
            // No modifiers - check for single key shortcuts (tool selection)
            // Only if it's a single letter and no modifiers
            if (keyLower.length === 1 && /[a-z]/.test(keyLower)) {
                const shortcut = this.getShortcutKey(keyLower, this.activeModifiers);
                if (this.shortcuts.has(shortcut)) {
                    event.preventDefault();
                    event.stopPropagation();
                    const action = this.shortcuts.get(shortcut);
                    action.callback();
                    this.showShortcutFeedback(action.label);
                    return;
                }
            }
        }
    }
    
    handleKeyUp(event) {
        this.activeModifiers.ctrl = event.ctrlKey || event.metaKey;
        this.activeModifiers.shift = event.shiftKey;
        this.activeModifiers.alt = event.altKey;
        this.activeModifiers.cmd = event.metaKey;
    }
    
    isTextInputActive(element) {
        return element.tagName === 'INPUT' || 
               element.tagName === 'TEXTAREA' ||
               element.contentEditable === 'true';
    }
    
    getShortcutKey(key, modifiers) {
        const parts = [];
        if (modifiers.ctrl || modifiers.cmd) parts.push('ctrl');
        if (modifiers.shift) parts.push('shift');
        if (modifiers.alt) parts.push('alt');
        parts.push(key);
        return parts.join('+');
    }
    
    registerShortcut(key, modifiers, callback, label = '') {
        const shortcutKey = this.buildShortcutKey(key, modifiers);
        this.shortcuts.set(shortcutKey, { callback, label });
    }
    
    buildShortcutKey(key, modifiers) {
        const parts = [];
        if (modifiers.includes('ctrl') || modifiers.includes('cmd')) parts.push('ctrl');
        if (modifiers.includes('shift')) parts.push('shift');
        if (modifiers.includes('alt')) parts.push('alt');
        parts.push(key.toLowerCase());
        return parts.join('+');
    }
    
    showShortcutFeedback(label) {
        const feedback = document.createElement('div');
        feedback.className = 'keyboard-feedback';
        feedback.textContent = label || 'Shortcut executed';
        feedback.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 16px;
            background: #374151;
            color: white;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            z-index: 9999;
            animation: slideUp 0.3s ease-out;
            pointer-events: none;
        `;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.style.animation = 'slideDown 0.3s ease-in';
            setTimeout(() => feedback.remove(), 300);
        }, 1500);
    }
}

// Add animation styles (check if not already present)
if (!document.querySelector('style[data-keyboard-shortcuts]')) {
    const keyboardStyle = document.createElement('style');
    keyboardStyle.setAttribute('data-keyboard-shortcuts', 'true');
    keyboardStyle.textContent = `
        @keyframes slideUp {
            from { transform: translateX(-50%) translateY(40px); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes slideDown {
            from { transform: translateX(-50%) translateY(0); opacity: 1; }
            to { transform: translateX(-50%) translateY(40px); opacity: 0; }
        }
    `;
    document.head.appendChild(keyboardStyle);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyboardShortcutManager;
}
