// Molecular Geometry and Structure Generation
// Generates proper 2D structures based on real organic chemistry bonding

class MoleculeGeometry {
    // Bond angles for different hybridizations
    static ANGLES = {
        'sp': 180,      // Linear (alkynes, nitriles)
        'sp2': 120,     // Trigonal planar (alkenes, aromatics)
        'sp3': 109.5    // Tetrahedral (alkanes, single bonds)
    };
    
    // Bond length in SVG units
    static BOND_LENGTH = 40;
    
    /**
     * Generate a linear carbon chain
     * @param {number} length - Number of carbons
     * @param {number} startX - Starting X position
     * @param {number} startY - Starting Y position
     * @param {number} angleStart - Starting angle in degrees
     * @returns {object} {atoms, bonds}
     */
    static createLinearChain(length, startX = 50, startY = 100, angleStart = 0) {
        const atoms = [];
        const bonds = [];
        let currentX = startX;
        let currentY = startY;
        let currentAngle = angleStart;
        
        for (let i = 0; i < length; i++) {
            const atomId = `C${i + 1}`;
            atoms.push({
                id: atomId,
                element: 'C',
                position: { x: Math.round(currentX), y: Math.round(currentY) },
                charge: 0
            });
            
            if (i > 0) {
                bonds.push({
                    atom1: `C${i}`,
                    atom2: atomId,
                    order: 1
                });
            }
            
            // Move to next position along chain (zigzag for readability)
            const angleRad = (currentAngle * Math.PI) / 180;
            currentX += this.BOND_LENGTH * Math.cos(angleRad);
            currentY += this.BOND_LENGTH * Math.sin(angleRad);
            
            // Alternate angle for zigzag appearance
            currentAngle = currentAngle === 0 ? 30 : 0;
        }
        
        return { atoms, bonds };
    }
    
    /**
     * Create an alkene (C=C double bond)
     * @param {number} startX
     * @param {number} startY
     * @returns {object} {atoms, bonds}
     */
    static createAlkene(startX = 50, startY = 100) {
        return {
            atoms: [
                { id: 'C1', element: 'C', position: { x: startX, y: startY }, charge: 0 },
                { id: 'C2', element: 'C', position: { x: startX + 40, y: startY }, charge: 0 },
                { id: 'C3', element: 'C', position: { x: startX + 80, y: startY }, charge: 0 }
            ],
            bonds: [
                { atom1: 'C1', atom2: 'C2', order: 2 },
                { atom1: 'C2', atom2: 'C3', order: 1 }
            ]
        };
    }
    
    /**
     * Create an alcohol (carbon with OH group)
     * @param {number} startX
     * @param {number} startY
     * @returns {object} {atoms, bonds}
     */
    static createAlcohol(startX = 50, startY = 100) {
        return {
            atoms: [
                { id: 'C1', element: 'C', position: { x: startX, y: startY }, charge: 0 },
                { id: 'C2', element: 'C', position: { x: startX + 40, y: startY }, charge: 0 },
                { id: 'O', element: 'O', position: { x: startX + 40, y: startY - 35 }, charge: 0 }
            ],
            bonds: [
                { atom1: 'C1', atom2: 'C2', order: 1 },
                { atom1: 'C2', atom2: 'O', order: 1 }
            ]
        };
    }
    
    /**
     * Create a carbonyl (C=O)
     * @param {number} startX
     * @param {number} startY
     * @returns {object} {atoms, bonds}
     */
    static createCarbonyl(startX = 50, startY = 100) {
        return {
            atoms: [
                { id: 'C1', element: 'C', position: { x: startX, y: startY }, charge: 0 },
                { id: 'C', element: 'C', position: { x: startX + 40, y: startY }, charge: 0 },
                { id: 'O', element: 'O', position: { x: startX + 40, y: startY - 35 }, charge: 0 }
            ],
            bonds: [
                { atom1: 'C1', atom2: 'C', order: 1 },
                { atom1: 'C', atom2: 'O', order: 2 }
            ]
        };
    }
    
    /**
     * Create a benzene ring
     * @param {number} centerX
     * @param {number} centerY
     * @returns {object} {atoms, bonds}
     */
    static createBenzene(centerX = 100, centerY = 100) {
        const radius = 30;
        const atoms = [];
        const bonds = [];
        
        // Create 6 carbons in a hexagon
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            atoms.push({
                id: `C${i + 1}`,
                element: 'C',
                position: { x: Math.round(x), y: Math.round(y) },
                charge: 0
            });
            
            // Create bonds (alternating single/double)
            bonds.push({
                atom1: `C${i + 1}`,
                atom2: `C${(i + 1) % 6 + 1}`,
                order: i % 2 === 0 ? 2 : 1
            });
        }
        
        return { atoms, bonds };
    }
    
    /**
     * Create a cyclopentane (5-membered saturated ring)
     * @param {number} centerX
     * @param {number} centerY
     * @returns {object} {atoms, bonds}
     */
    static createCyclopentane(centerX = 100, centerY = 100) {
        const radius = 28;
        const atoms = [];
        const bonds = [];
        
        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            atoms.push({
                id: `C${i + 1}`,
                element: 'C',
                position: { x: Math.round(x), y: Math.round(y) },
                charge: 0
            });
            
            bonds.push({
                atom1: `C${i + 1}`,
                atom2: `C${(i + 1) % 5 + 1}`,
                order: 1
            });
        }
        
        return { atoms, bonds };
    }
    
    /**
     * Create a cyclohexane (6-membered saturated ring)
     * @param {number} centerX
     * @param {number} centerY
     * @returns {object} {atoms, bonds}
     */
    static createCyclohexane(centerX = 100, centerY = 100) {
        const radius = 32;
        const atoms = [];
        const bonds = [];
        
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            atoms.push({
                id: `C${i + 1}`,
                element: 'C',
                position: { x: Math.round(x), y: Math.round(y) },
                charge: 0
            });
            
            bonds.push({
                atom1: `C${i + 1}`,
                atom2: `C${(i + 1) % 6 + 1}`,
                order: 1
            });
        }
        
        return { atoms, bonds };
    }
    
    /**
     * Add a substituent to an atom
     * @param {object} atoms
     * @param {object} bonds
     * @param {string} targetAtomId
     * @param {string} substituent - 'Br', 'OH', 'CH3', etc.
     * @param {number} angle - angle for substituent
     */
    static addSubstituent(atoms, bonds, targetAtomId, substituent, angle = -90) {
        const targetAtom = atoms.find(a => a.id === targetAtomId);
        if (!targetAtom) return;
        
        const angleRad = (angle * Math.PI) / 180;
        const x = targetAtom.position.x + this.BOND_LENGTH * Math.cos(angleRad);
        const y = targetAtom.position.y + this.BOND_LENGTH * Math.sin(angleRad);
        
        // Handle different substituents
        if (substituent === 'Br') {
            const brId = `Br_${targetAtomId}`;
            atoms.push({
                id: brId,
                element: 'Br',
                position: { x: Math.round(x), y: Math.round(y) },
                charge: 0
            });
            bonds.push({
                atom1: targetAtomId,
                atom2: brId,
                order: 1
            });
        } else if (substituent === 'OH') {
            const oId = `O_${targetAtomId}`;
            const hId = `H_${targetAtomId}`;
            atoms.push({
                id: oId,
                element: 'O',
                position: { x: Math.round(x), y: Math.round(y) },
                charge: 0
            });
            atoms.push({
                id: hId,
                element: 'H',
                position: { x: Math.round(x + 15), y: Math.round(y - 15) },
                charge: 0
            });
            bonds.push({
                atom1: targetAtomId,
                atom2: oId,
                order: 1
            });
            bonds.push({
                atom1: oId,
                atom2: hId,
                order: 1
            });
        } else if (substituent === 'CN') {
            const cId = `C_${targetAtomId}`;
            const nId = `N_${targetAtomId}`;
            atoms.push({
                id: cId,
                element: 'C',
                position: { x: Math.round(x), y: Math.round(y) },
                charge: 0
            });
            atoms.push({
                id: nId,
                element: 'N',
                position: { x: Math.round(x + 35), y: Math.round(y) },
                charge: -1
            });
            bonds.push({
                atom1: targetAtomId,
                atom2: cId,
                order: 1
            });
            bonds.push({
                atom1: cId,
                atom2: nId,
                order: 3
            });
        }
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MoleculeGeometry };
}
