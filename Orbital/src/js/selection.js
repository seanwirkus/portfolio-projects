// Selection Manager
// Handles atom and bond selection, highlighting, and multi-selection operations

class SelectionManager {
    constructor(molecule, renderer) {
        this.molecule = molecule;
        this.renderer = renderer;
        this.selectedAtoms = new Set();
        this.selectedBonds = new Set();
        this.selectionColor = '#fbbf24'; // Amber highlight
        this.selectionBorderWidth = 3;
        this.isSelecting = false;
        this.selectionStart = null;
    }

    /**
     * Select a single atom, optionally deselecting others
     * @param {number} atomId - The atom ID to select
     * @param {boolean} addToSelection - If true, add to existing selection
     */
    selectAtom(atomId, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }
        this.selectedAtoms.add(atomId);
        console.log(`✓ Selected atom ${atomId}`);
        
        // Mark atom as selected in the molecule for rendering
        const atom = this.molecule.getAtomById(atomId);
        if (atom) {
            atom.isSelected = true;
        }
        
        this.renderSelection();
    }

    /**
     * Deselect a specific atom
     * @param {number} atomId
     */
    deselectAtom(atomId) {
        this.selectedAtoms.delete(atomId);
        console.log(`✗ Deselected atom ${atomId}`);
        this.renderSelection();
    }

    /**
     * Toggle selection of an atom
     * @param {number} atomId
     */
    toggleAtom(atomId) {
        if (this.selectedAtoms.has(atomId)) {
            this.deselectAtom(atomId);
        } else {
            this.selectAtom(atomId, true);
        }
    }

    /**
     * Select all atoms in the molecule
     */
    selectAll() {
        this.selectedAtoms.clear();
        this.selectedBonds.clear();
        
        // Select all atoms
        this.molecule.atoms.forEach(atom => {
            this.selectedAtoms.add(atom.id);
        });
        
        console.log(`✓ Selected all ${this.selectedAtoms.size} atoms`);
        
        // Mark atoms as selected in the molecule for rendering
        this.molecule.atoms.forEach(atom => {
            atom.isSelected = this.selectedAtoms.has(atom.id);
        });
        
        // Force immediate render with selection
        if (this.renderer) {
            // Cancel any pending debounced renders
            if (this.renderer._renderTimeout) {
                clearTimeout(this.renderer._renderTimeout);
            }
            // Render immediately
            this.renderer._doRender(this.molecule);
        }
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        // Clear selection flags on atoms
        this.molecule.atoms.forEach(atom => {
            atom.isSelected = false;
        });
        
        this.selectedAtoms.clear();
        this.selectedBonds.clear();
        console.log('Clear selection');
        this.renderSelection();
    }

    /**
     * Check if an atom is selected
     * @param {number} atomId
     * @returns {boolean}
     */
    isAtomSelected(atomId) {
        return this.selectedAtoms.has(atomId);
    }

    /**
     * Get all selected atoms
     * @returns {Array<Object>} Array of atom objects
     */
    getSelectedAtoms() {
        return this.molecule.atoms.filter(atom => this.selectedAtoms.has(atom.id));
    }

    /**
     * Get all selected bonds
     * @returns {Array<Object>} Array of bond objects
     */
    getSelectedBonds() {
        return this.molecule.bonds.filter(bond => {
            const atom1Selected = this.selectedAtoms.has(bond.atom1);
            const atom2Selected = this.selectedAtoms.has(bond.atom2);
            return atom1Selected && atom2Selected;
        });
    }

    /**
     * Delete all selected atoms and their bonds
     */
    deleteSelected() {
        // If nothing is selected, check if there's a selected atom in molecule
        if (this.selectedAtoms.size === 0) {
            if (this.molecule.selectedAtom) {
                this.molecule.removeAtom(this.molecule.selectedAtom.id);
                this.molecule.selectedAtom = null;
                console.log('🗑️ Deleted selected atom');
                return;
            }
            return;
        }

        try {
            // Get IDs to delete (make a copy since we'll be modifying the set)
            const idsToDelete = Array.from(this.selectedAtoms);
            const deleteCount = idsToDelete.length;

            // Clear selection first to avoid issues during deletion
            this.selectedAtoms.clear();
            this.selectedBonds.clear();

            // Delete all atoms - removeAtom handles bond cleanup
            // Filter to only existing atoms first
            const existingAtomIds = idsToDelete.filter(atomId => {
                return this.molecule.getAtomById(atomId) !== null;
            });

            // Delete all existing atoms
            existingAtomIds.forEach(atomId => {
                try {
                    this.molecule.removeAtom(atomId);
                } catch (err) {
                    console.warn(`Failed to delete atom ${atomId}:`, err);
                }
            });

            const deletedCount = existingAtomIds.length;
            console.log(`🗑️ Deleted ${deletedCount} of ${deleteCount} selected atoms and connected bonds`);
        } catch (error) {
            console.error('Error deleting selected atoms:', error);
            // Clear selection even on error
            this.clearSelection();
        }
    }

    /**
     * Get JSON representation of selected atoms and bonds
     * @returns {Object} {atoms, bonds}
     */
    getSelectedAsJSON() {
        return {
            atoms: this.getSelectedAtoms().map(atom => ({
                element: atom.element,
                charge: atom.charge || 0
            })),
            bonds: this.getSelectedBonds().map(bond => ({
                atom1: this.getSelectedAtoms().findIndex(a => a.id === bond.atom1),
                atom2: this.getSelectedAtoms().findIndex(a => a.id === bond.atom2),
                order: bond.order || 1
            }))
        };
    }

    /**
     * Render selection highlights on canvas
     * NOTE: This triggers a full re-render to ensure selection highlights are drawn properly
     */
    renderSelection() {
        if (!this.renderer) return;

        // Mark all selected atoms for rendering
        this.molecule.atoms.forEach(atom => {
            atom.isSelected = this.selectedAtoms.has(atom.id);
        });

        // Trigger full re-render (this will draw selection highlights in the paint pass)
        if (this.renderer._renderTimeout) {
            clearTimeout(this.renderer._renderTimeout);
        }
        this.renderer._doRender(this.molecule);
    }

    /**
     * Select atom at canvas position
     * @param {number} canvasX
     * @param {number} canvasY
     * @param {boolean} addToSelection
     * @returns {boolean} True if atom was selected
     */
    selectAtomAtPosition(canvasX, canvasY, addToSelection = false) {
        const atom = this.molecule.getAtomAtPosition(canvasX, canvasY, 25);
        if (atom) {
            this.selectAtom(atom.id, addToSelection);
            return true;
        }
        return false;
    }

    /**
     * Get selection count
     * @returns {Object} {atoms, bonds}
     */
    getSelectionCount() {
        return {
            atoms: this.selectedAtoms.size,
            bonds: this.getSelectedBonds().length
        };
    }

    /**
     * Get selection summary for display
     * @returns {string}
     */
    getSelectionSummary() {
        const count = this.getSelectionCount();
        if (count.atoms === 0) return '';
        return `${count.atoms} atom${count.atoms !== 1 ? 's' : ''}, ${count.bonds} bond${count.bonds !== 1 ? 's' : ''}`;
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelectionManager;
}
