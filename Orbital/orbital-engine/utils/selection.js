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
        this.molecule.atoms.forEach(atom => {
            this.selectedAtoms.add(atom.id);
        });
        console.log(`✓ Selected all ${this.selectedAtoms.size} atoms`);
        this.renderSelection();
    }

    /**
     * Clear all selections
     */
    clearSelection() {
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
        if (this.selectedAtoms.size === 0) return;

        try {
            // Get IDs to delete
            const idsToDelete = Array.from(this.selectedAtoms);

            // Remove atoms
            this.molecule.atoms = this.molecule.atoms.filter(
                atom => !idsToDelete.includes(atom.id)
            );

            // Remove bonds connected to deleted atoms
            this.molecule.bonds = this.molecule.bonds.filter(
                bond => !idsToDelete.includes(bond.atom1) && !idsToDelete.includes(bond.atom2)
            );

            this.clearSelection();
            console.log(`🗑️ Deleted ${idsToDelete.length} atoms and connected bonds`);
        } catch (error) {
            console.error('Error deleting selected atoms:', error);
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
     */
    renderSelection() {
        if (!this.renderer || !this.renderer.canvas) return;

        const ctx = this.renderer.canvas.getContext('2d');
        if (!ctx) return;

        // Draw selection highlights for atoms
        this.selectedAtoms.forEach(atomId => {
            const atom = this.molecule.atoms.find(a => a.id === atomId);
            if (atom) {
                // Draw selection circle
                ctx.strokeStyle = this.selectionColor;
                ctx.lineWidth = this.selectionBorderWidth;
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.arc(atom.x, atom.y, 28, 0, Math.PI * 2);
                ctx.stroke();

                // Draw checkmark
                ctx.fillStyle = this.selectionColor;
                ctx.globalAlpha = 1;
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('✓', atom.x, atom.y - 22);

                ctx.globalAlpha = 1;
            }
        });
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
