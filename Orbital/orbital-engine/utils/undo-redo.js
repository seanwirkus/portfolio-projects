// Undo/Redo History Manager
// Tracks molecule state changes and allows navigation through history

class UndoRedoManager {
    constructor(maxHistorySize = 50) {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = maxHistorySize;
        this.isApplyingState = false; // Prevent recursive saves while restoring state
    }

    /**
     * Saves current molecule state to history
     * @param {Molecule} molecule - The molecule to save
     */
    saveState(molecule) {
        // Don't save while we're applying a state from history
        if (this.isApplyingState) return;

        try {
            // Deep clone the molecule state
            const state = {
                atoms: molecule.atoms.map(atom => ({
                    id: atom.id,
                    element: atom.element,
                    x: atom.x,
                    y: atom.y,
                    charge: atom.charge || 0,
                    implicit_h: atom.implicit_h || 0
                })),
                bonds: molecule.bonds.map(bond => ({
                    atom1: bond.atom1,
                    atom2: bond.atom2,
                    order: bond.order || 1
                }))
            };

            // Remove any redo states if we're not at the end of history
            if (this.currentIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.currentIndex + 1);
            }

            // Add new state
            this.history.push(state);
            this.currentIndex++;

            // Maintain max history size
            if (this.history.length > this.maxHistorySize) {
                this.history.shift();
                this.currentIndex--;
            }

            console.log(`📍 State saved (${this.currentIndex + 1}/${this.history.length})`);
        } catch (error) {
            console.error('Error saving state:', error);
        }
    }

    /**
     * Undo to previous state
     * @returns {Object|null} Previous state or null if at beginning
     */
    undo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            const state = this.history[this.currentIndex];
            console.log(`↶ Undo to state ${this.currentIndex + 1}/${this.history.length}`);
            return this.cloneState(state);
        }
        console.log('⚠️ Cannot undo: at beginning of history');
        return null;
    }

    /**
     * Redo to next state
     * @returns {Object|null} Next state or null if at end
     */
    redo() {
        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            const state = this.history[this.currentIndex];
            console.log(`↷ Redo to state ${this.currentIndex + 1}/${this.history.length}`);
            return this.cloneState(state);
        }
        console.log('⚠️ Cannot redo: at end of history');
        return null;
    }

    /**
     * Apply a saved state to a molecule
     * @param {Molecule} molecule - The molecule to update
     * @param {Object} state - The state to apply
     */
    applyState(molecule, state) {
        if (!state) return;

        this.isApplyingState = true;
        try {
            // Clear existing molecule completely
            molecule.atoms = [];
            molecule.bonds = [];
            molecule.nextAtomId = 0;

            // Restore atoms using proper addAtom method
            state.atoms.forEach(atomData => {
                const newAtom = molecule.addAtom(atomData.element, atomData.x, atomData.y);
                newAtom.charge = atomData.charge || 0;
                newAtom.implicit_h = atomData.implicit_h || 0;
            });

            // Restore bonds
            state.bonds.forEach(bondData => {
                molecule.addBond(bondData.atom1, bondData.atom2, bondData.order || 1);
            });

            console.log('✓ State applied successfully');
        } catch (error) {
            console.error('Error applying state:', error);
        } finally {
            this.isApplyingState = false;
        }
    }

    /**
     * Get current state (for debugging/inspection)
     * @returns {Object|null}
     */
    getCurrentState() {
        if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
            return this.cloneState(this.history[this.currentIndex]);
        }
        return null;
    }

    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
        return this.currentIndex > 0;
    }

    /**
     * Check if redo is available
     * @returns {boolean}
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Clear entire history
     */
    clear() {
        this.history = [];
        this.currentIndex = -1;
        console.log('🗑️ History cleared');
    }

    /**
     * Get history status for UI
     * @returns {Object} {current, total, canUndo, canRedo}
     */
    getStatus() {
        return {
            current: this.currentIndex + 1,
            total: this.history.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }

    /**
     * Deep clone a state object
     * @private
     */
    cloneState(state) {
        return JSON.parse(JSON.stringify(state));
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UndoRedoManager;
}
