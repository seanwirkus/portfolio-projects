// Molecule Layout Engine
// Smart automatic positioning for molecules with proper spacing

class MoleculeLayoutEngine {
    constructor() {
        this.MIN_DISTANCE = 50; // Minimum distance between atoms
        this.CANVAS_PADDING = 40;
        this.iterations = 3; // Reduced from 5 for less aggressive layout
        this.enabled = false; // Disabled by default - user can enable
    }

    /**
     * Enable/disable automatic layout
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Auto-layout a molecule to fit properly on canvas
     * @param {Molecule} molecule
     * @param {HTMLCanvasElement} canvas
     * @returns {void} Modifies molecule in place
     */
    layout(molecule, canvas) {
        if (!this.enabled || !molecule || !molecule.atoms || molecule.atoms.length === 0) {
            return;
        }

        // Only apply layout if molecule is too small or too large
        const bounds = this.getMoleculeBounds(molecule);
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        
        // Skip layout if molecule is already reasonably sized
        if (width > 50 && width < canvas.width * 0.8 && height > 50 && height < canvas.height * 0.8) {
            this.centerInCanvas(molecule, canvas);
            return;
        }

        // Step 1: Center the molecule
        this.centerMolecule(molecule);

        // Step 2: Apply force-directed layout to uncrowded atoms
        this.applyForceLayout(molecule, canvas);

        // Step 3: Scale to fit canvas
        this.scaleToCanvas(molecule, canvas);

        // Step 4: Center in canvas
        this.centerInCanvas(molecule, canvas);
    }

    /**
     * Center molecule around origin
     * @private
     */
    centerMolecule(molecule) {
        if (molecule.atoms.length === 0) return;

        // Calculate center
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        molecule.atoms.forEach(atom => {
            minX = Math.min(minX, atom.x);
            maxX = Math.max(maxX, atom.x);
            minY = Math.min(minY, atom.y);
            maxY = Math.max(maxY, atom.y);
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Translate to origin
        molecule.atoms.forEach(atom => {
            atom.x -= centerX;
            atom.y -= centerY;
        });
    }

    /**
     * Apply force-directed layout to fix overlapping atoms
     * @private
     */
    applyForceLayout(molecule, canvas) {
        // Simple force-directed layout
        for (let iter = 0; iter < this.iterations; iter++) {
            const forces = {};

            // Initialize forces
            molecule.atoms.forEach(atom => {
                forces[atom.id] = { x: 0, y: 0 };
            });

            // Repulsive forces between all atom pairs
            for (let i = 0; i < molecule.atoms.length; i++) {
                for (let j = i + 1; j < molecule.atoms.length; j++) {
                    const a1 = molecule.atoms[i];
                    const a2 = molecule.atoms[j];

                    const dx = a2.x - a1.x;
                    const dy = a2.y - a1.y;
                    const dist = Math.hypot(dx, dy) || 0.1;

                    if (dist < this.MIN_DISTANCE) {
                        // Repulsive force
                        const force = (this.MIN_DISTANCE - dist) / dist * 0.5;
                        forces[a1.id].x -= (dx / dist) * force;
                        forces[a1.id].y -= (dy / dist) * force;
                        forces[a2.id].x += (dx / dist) * force;
                        forces[a2.id].y += (dy / dist) * force;
                    }
                }
            }

            // Attractive forces for bonded atoms (spring model)
            molecule.bonds.forEach(bond => {
                const a1 = molecule.atoms.find(a => a.id === bond.atom1);
                const a2 = molecule.atoms.find(a => a.id === bond.atom2);

                if (!a1 || !a2) return;

                const dx = a2.x - a1.x;
                const dy = a2.y - a1.y;
                const dist = Math.hypot(dx, dy) || 0.1;
                const targetDist = 50; // Target bond length

                if (Math.abs(dist - targetDist) > 1) {
                    const force = (dist - targetDist) / dist * 0.1;
                    forces[a1.id].x += (dx / dist) * force;
                    forces[a1.id].y += (dy / dist) * force;
                    forces[a2.id].x -= (dx / dist) * force;
                    forces[a2.id].y -= (dy / dist) * force;
                }
            });

            // Apply forces
            molecule.atoms.forEach(atom => {
                const force = forces[atom.id];
                atom.x += force.x;
                atom.y += force.y;
            });
        }
    }

    /**
     * Scale molecule to fit canvas
     * @private
     */
    scaleToCanvas(molecule, canvas) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        molecule.atoms.forEach(atom => {
            minX = Math.min(minX, atom.x);
            maxX = Math.max(maxX, atom.x);
            minY = Math.min(minY, atom.y);
            maxY = Math.max(maxY, atom.y);
        });

        const width = maxX - minX || 100;
        const height = maxY - minY || 100;

        const availableWidth = canvas.width - (2 * this.CANVAS_PADDING);
        const availableHeight = canvas.height - (2 * this.CANVAS_PADDING);

        const scaleX = availableWidth / width;
        const scaleY = availableHeight / height;
        const scale = Math.min(scaleX, scaleY, 2.5); // Cap scaling

        molecule.atoms.forEach(atom => {
            atom.x *= scale;
            atom.y *= scale;
        });
    }

    /**
     * Center molecule in canvas
     * @private
     */
    centerInCanvas(molecule, canvas) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        molecule.atoms.forEach(atom => {
            minX = Math.min(minX, atom.x);
            maxX = Math.max(maxX, atom.x);
            minY = Math.min(minY, atom.y);
            maxY = Math.max(maxY, atom.y);
        });

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const molCenterX = (minX + maxX) / 2;
        const molCenterY = (minY + maxY) / 2;

        const offsetX = centerX - molCenterX;
        const offsetY = centerY - molCenterY;

        molecule.atoms.forEach(atom => {
            atom.x += offsetX;
            atom.y += offsetY;
        });
    }

    /**
     * Position multiple molecules horizontally (for reactions: reactants -> products)
     * @param {Array<Molecule>} molecules
     * @param {HTMLCanvasElement} canvas
     * @param {number} spacing - Space between molecules
     */
    layoutMultiple(molecules, canvas, spacing = 80) {
        if (molecules.length === 0) return;

        // Layout each molecule individually first
        molecules.forEach(mol => {
            this.centerMolecule(mol);
            this.applyForceLayout(mol, canvas);
        });

        // Calculate dimensions of each molecule
        const bounds = molecules.map(mol => this.getMoleculeBounds(mol));

        // Position molecules horizontally with arrow space in middle
        let currentX = this.CANVAS_PADDING;
        const centerY = canvas.height / 2;

        molecules.forEach((mol, idx) => {
            const bound = bounds[idx];
            const molWidth = bound.maxX - bound.minX;
            const molHeight = bound.maxY - bound.minY;

            // Translate molecule
            const offsetX = currentX - bound.minX;
            const offsetY = centerY - (bound.minY + molHeight / 2);

            mol.atoms.forEach(atom => {
                atom.x += offsetX;
                atom.y += offsetY;
            });

            currentX += molWidth + spacing;
        });
    }

    /**
     * Get bounding box of molecule
     * @private
     */
    getMoleculeBounds(molecule) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        molecule.atoms.forEach(atom => {
            minX = Math.min(minX, atom.x);
            maxX = Math.max(maxX, atom.x);
            minY = Math.min(minY, atom.y);
            maxY = Math.max(maxY, atom.y);
        });

        return { minX, maxX, minY, maxY };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MoleculeLayoutEngine;
}
