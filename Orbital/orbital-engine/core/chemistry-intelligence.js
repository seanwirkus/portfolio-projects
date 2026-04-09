// Advanced Chemistry Intelligence Module
// Handles implicit hydrogens, valence, aromaticity, resonance, and stereochemistry

class ChemistryIntelligence {
    constructor() {
        // Standard valences for common elements
        this.standardValence = {
            'H': 1, 'C': 4, 'N': 3, 'O': 2, 'F': 1,
            'P': 3, 'S': 2, 'Cl': 1, 'Br': 1, 'I': 1,
            'B': 3, 'Si': 4
        };
        
        // Expanded valences (with d-orbitals)
        this.expandedValence = {
            'P': [3, 5], 'S': [2, 4, 6], 'Cl': [1, 3, 5, 7],
            'Br': [1, 3, 5], 'I': [1, 3, 5, 7]
        };
        
        // Electronegativity values (Pauling scale)
        this.electronegativity = {
            'H': 2.20, 'C': 2.55, 'N': 3.04, 'O': 3.44, 'F': 3.98,
            'P': 2.19, 'S': 2.58, 'Cl': 3.16, 'Br': 2.96, 'I': 2.66,
            'B': 2.04, 'Si': 1.90
        };
    }
    
    // Calculate implicit hydrogens for an atom
    calculateImplicitHydrogens(atom, molecule) {
        const element = atom.element;
        
        // Hydrogens don't have implicit hydrogens
        if (element === 'H') return 0;
        
        // Get standard valence
        const valence = this.standardValence[element];
        if (!valence) return 0;
        
        // Calculate current bond count (accounting for bond orders)
        const bonds = molecule.getAtomBonds(atom.id);
        let bondSum = 0;
        
        bonds.forEach(bond => {
            bondSum += bond.order;
        });
        
        // Account for formal charge
        const charge = atom.charge || 0;
        const availableValence = valence - bondSum;
        
        // Adjust for charge
        let implicitH = availableValence - charge;
        
        // Can't have negative hydrogens
        return Math.max(0, implicitH);
    }
    
    // Calculate formal charge on an atom
    calculateFormalCharge(atom, molecule) {
        const element = atom.element;
        const valence = this.standardValence[element];
        if (!valence) return 0;
        
        const bonds = molecule.getAtomBonds(atom.id);
        let bondCount = bonds.length;
        let bondSum = 0;
        
        bonds.forEach(bond => {
            bondSum += bond.order;
        });
        
        // Count lone pair electrons (assume filled to valence)
        const implicitH = this.calculateImplicitHydrogens(atom, molecule);
        const totalElectrons = bondSum + implicitH;
        
        // Formal charge = valence - (lone pairs + 1/2 bonding electrons)
        // Simplified: valence - bonds - implicit H
        return valence - totalElectrons;
    }
    
    // Check if atom valence is satisfied
    isValenceSatisfied(atom, molecule) {
        const element = atom.element;
        const valence = this.standardValence[element];
        if (!valence) return true;
        
        const bonds = molecule.getAtomBonds(atom.id);
        let bondSum = 0;
        
        bonds.forEach(bond => {
            bondSum += bond.order;
        });
        
        const implicitH = this.calculateImplicitHydrogens(atom, molecule);
        return (bondSum + implicitH) <= valence;
    }
    
    // Detect aromatic rings (Hückel's rule: 4n+2 π electrons)
    detectAromaticRings(molecule) {
        const rings = this.findRings(molecule);
        const aromaticRings = [];
        
        rings.forEach(ring => {
            if (this.isRingAromatic(ring, molecule)) {
                aromaticRings.push(ring);
            }
        });
        
        return aromaticRings;
    }
    
    // Check if a ring is aromatic
    isRingAromatic(ring, molecule) {
        // Must be planar (all sp2 or sp hybridized)
        // Must have 4n+2 π electrons
        
        let piElectrons = 0;
        let allPlanar = true;
        
        ring.forEach(atomId => {
            const atom = molecule.getAtomById(atomId);
            const bonds = molecule.getAtomBonds(atomId);
            
            // Check hybridization
            const hybridization = this.getHybridization(atom, molecule);
            if (hybridization !== 'sp2' && hybridization !== 'sp') {
                allPlanar = false;
            }
            
            // Count π electrons contribution
            // sp2 carbon with one double bond contributes 1 π electron
            const doubleBonds = bonds.filter(b => b.order === 2).length;
            if (doubleBonds > 0) {
                piElectrons += 1;
            }
            
            // Heteroatoms with lone pairs contribute 2
            if ((atom.element === 'N' || atom.element === 'O') && doubleBonds === 0) {
                piElectrons += 2;
            }
        });
        
        if (!allPlanar) return false;
        
        // Hückel's rule: 4n+2 π electrons
        const n = (piElectrons - 2) / 4;
        return Number.isInteger(n) && n >= 0;
    }
    
    // Determine hybridization of an atom
    getHybridization(atom, molecule) {
        const bonds = molecule.getAtomBonds(atom.id);
        
        if (bonds.length === 0) return 'sp3';
        
        // Count σ and π bonds
        let sigmaBonds = bonds.length;
        let piBonds = 0;
        
        bonds.forEach(bond => {
            if (bond.order === 2) piBonds += 1;
            if (bond.order === 3) piBonds += 2;
        });
        
        const totalBonds = sigmaBonds + piBonds;
        
        // Determine hybridization
        if (piBonds >= 2 || totalBonds === 2) return 'sp';
        if (piBonds === 1 || sigmaBonds === 3) return 'sp2';
        return 'sp3';
    }
    
    // Find all rings in molecule
    findRings(molecule) {
        const rings = [];
        const visited = new Set();
        
        molecule.atoms.forEach(startAtom => {
            if (visited.has(startAtom.id)) return;
            
            const ring = this.findRingFromAtom(startAtom.id, molecule, visited);
            if (ring && ring.length >= 3 && ring.length <= 8) {
                rings.push(ring);
            }
        });
        
        return rings;
    }
    
    // Find ring starting from an atom (DFS)
    findRingFromAtom(startId, molecule, visited) {
        const path = [startId];
        const pathSet = new Set([startId]);
        
        const dfs = (currentId, targetId, depth) => {
            if (depth > 8) return null; // Max ring size
            
            const bonds = molecule.getAtomBonds(currentId);
            
            for (const bond of bonds) {
                const nextId = bond.atom1 === currentId ? bond.atom2 : bond.atom1;
                
                if (nextId === targetId && depth >= 3) {
                    return path;
                }
                
                if (!pathSet.has(nextId)) {
                    path.push(nextId);
                    pathSet.add(nextId);
                    
                    const result = dfs(nextId, targetId, depth + 1);
                    if (result) return result;
                    
                    path.pop();
                    pathSet.delete(nextId);
                }
            }
            
            return null;
        };
        
        return dfs(startId, startId, 0);
    }
    
    // Detect conjugated systems
    detectConjugation(molecule) {
        const conjugated = [];
        const visited = new Set();
        
        molecule.atoms.forEach(atom => {
            if (visited.has(atom.id)) return;
            
            const hybridization = this.getHybridization(atom, molecule);
            if (hybridization === 'sp2' || hybridization === 'sp') {
                const system = this.traceConjugatedSystem(atom.id, molecule, visited);
                if (system.length >= 3) {
                    conjugated.push(system);
                }
            }
        });
        
        return conjugated;
    }
    
    // Trace a conjugated system
    traceConjugatedSystem(startId, molecule, visited) {
        const system = [startId];
        visited.add(startId);
        
        const queue = [startId];
        
        while (queue.length > 0) {
            const currentId = queue.shift();
            const atom = molecule.getAtomById(currentId);
            const bonds = molecule.getAtomBonds(currentId);
            
            bonds.forEach(bond => {
                const nextId = bond.atom1 === currentId ? bond.atom2 : bond.atom1;
                
                if (!visited.has(nextId)) {
                    const nextAtom = molecule.getAtomById(nextId);
                    const nextHyb = this.getHybridization(nextAtom, molecule);
                    
                    // Continue if sp or sp2
                    if (nextHyb === 'sp2' || nextHyb === 'sp') {
                        system.push(nextId);
                        visited.add(nextId);
                        queue.push(nextId);
                    }
                }
            });
        }
        
        return system;
    }
    
    // Suggest bond order change (for clicking bonds repeatedly)
    getNextBondOrder(currentOrder) {
        const orders = [1, 2, 3, 1]; // Cycle through single, double, triple
        const currentIndex = orders.indexOf(currentOrder);
        return orders[(currentIndex + 1) % orders.length];
    }
    
    // Check if molecule has any valence errors
    validateMolecule(molecule) {
        const errors = [];
        
        molecule.atoms.forEach(atom => {
            if (!this.isValenceSatisfied(atom, molecule)) {
                errors.push({
                    type: 'valence',
                    atomId: atom.id,
                    message: `${atom.element} exceeds valence at position (${Math.round(atom.x)}, ${Math.round(atom.y)})`
                });
            }
            
            const formalCharge = this.calculateFormalCharge(atom, molecule);
            if (Math.abs(formalCharge) > 0) {
                // Not an error, but worth noting
                atom.charge = formalCharge;
            }
        });
        
        return errors;
    }
    
    // Calculate dipole moment direction
    calculateDipoleMoment(molecule) {
        let dipoleX = 0;
        let dipoleY = 0;
        
        molecule.bonds.forEach(bond => {
            const atom1 = molecule.getAtomById(bond.atom1);
            const atom2 = molecule.getAtomById(bond.atom2);
            
            const en1 = this.electronegativity[atom1.element] || 2.5;
            const en2 = this.electronegativity[atom2.element] || 2.5;
            
            const enDiff = en2 - en1;
            const dx = atom2.x - atom1.x;
            const dy = atom2.y - atom1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            // Dipole points from less EN to more EN
            dipoleX += enDiff * dx / length;
            dipoleY += enDiff * dy / length;
        });
        
        const magnitude = Math.sqrt(dipoleX * dipoleX + dipoleY * dipoleY);
        
        return {
            x: dipoleX,
            y: dipoleY,
            magnitude: magnitude,
            angle: Math.atan2(dipoleY, dipoleX)
        };
    }
    
    // Detect chiral centers
    detectChiralCenters(molecule) {
        const chiralCenters = [];
        
        molecule.atoms.forEach(atom => {
            if (this.isChiralCenter(atom, molecule)) {
                chiralCenters.push(atom.id);
            }
        });
        
        return chiralCenters;
    }
    
    // Check if atom is a chiral center
    isChiralCenter(atom, molecule) {
        // Must be sp3 hybridized
        if (this.getHybridization(atom, molecule) !== 'sp3') return false;
        
        // Must have 4 different substituents
        const bonds = molecule.getAtomBonds(atom.id);
        if (bonds.length !== 4) return false;
        
        // Check if all substituents are different (simplified check)
        const substituents = bonds.map(bond => {
            const otherId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
            const otherAtom = molecule.getAtomById(otherId);
            return otherAtom.element;
        });
        
        const uniqueSubstituents = new Set(substituents);
        return uniqueSubstituents.size === 4;
    }
    
    // Smart bond incrementation - click bond to cycle order
    incrementBondOrder(bond, molecule) {
        const atom1 = molecule.getAtomById(bond.atom1);
        const atom2 = molecule.getAtomById(bond.atom2);
        
        // Check if atoms can support higher bond order
        const newOrder = this.getNextBondOrder(bond.order);
        
        // Calculate if valences would be satisfied
        const valence1 = this.standardValence[atom1.element] || 4;
        const valence2 = this.standardValence[atom2.element] || 4;
        
        const bonds1 = molecule.getAtomBonds(atom1.id);
        const bonds2 = molecule.getAtomBonds(atom2.id);
        
        let sum1 = 0, sum2 = 0;
        bonds1.forEach(b => sum1 += (b === bond ? newOrder : b.order));
        bonds2.forEach(b => sum2 += (b === bond ? newOrder : b.order));
        
        if (sum1 <= valence1 && sum2 <= valence2) {
            bond.order = newOrder;
            return true;
        }
        
        return false;
    }
    
    // Auto-complete structure (add implicit hydrogens as explicit)
    addExplicitHydrogens(molecule) {
        const newAtoms = [];
        const newBonds = [];
        
        molecule.atoms.forEach(atom => {
            const implicitH = this.calculateImplicitHydrogens(atom, molecule);
            
            if (implicitH > 0) {
                const angleIncrement = (2 * Math.PI) / implicitH;
                const bonds = molecule.getAtomBonds(atom.id);
                
                // Find starting angle that avoids existing bonds
                let startAngle = 0;
                if (bonds.length > 0) {
                    const firstBond = bonds[0];
                    const otherAtom = molecule.getAtomById(
                        firstBond.atom1 === atom.id ? firstBond.atom2 : firstBond.atom1
                    );
                    startAngle = Math.atan2(otherAtom.y - atom.y, otherAtom.x - atom.x) + Math.PI;
                }
                
                // Add hydrogen atoms
                for (let i = 0; i < implicitH; i++) {
                    const angle = startAngle + (i * angleIncrement);
                    const hx = atom.x + 30 * Math.cos(angle);
                    const hy = atom.y + 30 * Math.sin(angle);
                    
                    const hAtom = molecule.addAtom('H', hx, hy);
                    molecule.addBond(atom.id, hAtom.id, 1);
                }
            }
        });
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChemistryIntelligence;
}
