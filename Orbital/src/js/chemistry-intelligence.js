// Advanced Chemistry Intelligence Module
// Handles implicit hydrogens, valence, aromaticity, resonance, and stereochemistry

class ChemistryIntelligence {
    constructor() {
        // Standard valences for common elements (bonding capacity)
        this.standardValence = {
            'H': 1, 'C': 4, 'N': 3, 'O': 2, 'F': 1,
            'P': 3, 'S': 2, 'Cl': 1, 'Br': 1, 'I': 1,
            'B': 3, 'Si': 4, 'Li': 1, 'Na': 1, 'K': 1,
            'Mg': 2, 'Ca': 2, 'Al': 3, 'Fe': 2, 'Cu': 2,
            'Zn': 2, 'Se': 2, 'Te': 2, 'As': 3, 'Sb': 3,
            'He': 0, 'Ne': 0, 'Ar': 0, 'Kr': 0, 'Xe': 0,
            'Be': 2, 'Sc': 3, 'Ti': 4, 'V': 5, 'Cr': 6,
            'Mn': 7, 'Co': 3, 'Ni': 2, 'Ga': 3, 'Ge': 4,
            'Rb': 1, 'Sr': 2, 'Y': 3, 'Zr': 4, 'Nb': 5,
            'Mo': 6, 'Tc': 7, 'Ru': 4, 'Rh': 3, 'Pd': 2,
            'Ag': 1, 'Cd': 2, 'In': 3, 'Sn': 4, 'Ba': 2
        };
        
        // Valence electrons (for formal charge calculations)
        this.valenceElectrons = {
            'H': 1, 'C': 4, 'N': 5, 'O': 6, 'F': 7,
            'P': 5, 'S': 6, 'Cl': 7, 'Br': 7, 'I': 7,
            'B': 3, 'Si': 4, 'Li': 1, 'Na': 1, 'K': 1,
            'Mg': 2, 'Ca': 2, 'Al': 3, 'Fe': 8, 'Cu': 11,
            'Zn': 12, 'Se': 6, 'Te': 6, 'As': 5, 'Sb': 5,
            'He': 2, 'Ne': 8, 'Ar': 8, 'Kr': 8, 'Xe': 8,
            'Be': 2, 'Sc': 3, 'Ti': 4, 'V': 5, 'Cr': 6,
            'Mn': 7, 'Co': 9, 'Ni': 10, 'Ga': 3, 'Ge': 4,
            'Rb': 1, 'Sr': 2, 'Y': 3, 'Zr': 4, 'Nb': 5,
            'Mo': 6, 'Tc': 7, 'Ru': 8, 'Rh': 9, 'Pd': 10,
            'Ag': 11, 'Cd': 12, 'In': 3, 'Sn': 4, 'Ba': 2
        };
        
        // Expanded valences (with d-orbitals) - elements that can exceed octet
        this.expandedValence = {
            'P': [3, 5], 'S': [2, 4, 6], 'Cl': [1, 3, 5, 7],
            'Br': [1, 3, 5, 7], 'I': [1, 3, 5, 7],
            'Se': [2, 4, 6], 'Te': [2, 4, 6], 'As': [3, 5],
            'Sb': [3, 5], 'Xe': [2, 4, 6, 8]
        };
        
        // Maximum valences (including expanded octet)
        this.maxValence = {
            'P': 5, 'S': 6, 'Cl': 7, 'Br': 7, 'I': 7,
            'Se': 6, 'Te': 6, 'As': 5, 'Sb': 5, 'Xe': 8
        };
        
        // Electronegativity values (Pauling scale) - enhanced
        this.electronegativity = {
            'H': 2.20, 'C': 2.55, 'N': 3.04, 'O': 3.44, 'F': 3.98,
            'P': 2.19, 'S': 2.58, 'Cl': 3.16, 'Br': 2.96, 'I': 2.66,
            'B': 2.04, 'Si': 1.90, 'Li': 0.98, 'Na': 0.93, 'K': 0.82,
            'Mg': 1.31, 'Ca': 1.00, 'Al': 1.61, 'Fe': 1.83, 'Cu': 1.90,
            'Zn': 1.65, 'Se': 2.55, 'Te': 2.10, 'As': 2.18, 'Sb': 2.05,
            'He': 0.0, 'Ne': 0.0, 'Ar': 0.0, 'Kr': 3.00, 'Xe': 2.60,
            'Be': 1.57, 'Sc': 1.36, 'Ti': 1.54, 'V': 1.63, 'Cr': 1.66,
            'Mn': 1.55, 'Co': 1.88, 'Ni': 1.91, 'Ga': 1.81, 'Ge': 2.01,
            'Rb': 0.82, 'Sr': 0.95, 'Y': 1.22, 'Zr': 1.33, 'Nb': 1.6,
            'Mo': 2.16, 'Tc': 1.9, 'Ru': 2.2, 'Rh': 2.28, 'Pd': 2.20,
            'Ag': 1.93, 'Cd': 1.69, 'In': 1.78, 'Sn': 1.96, 'Ba': 0.89
        };
        
        // Atomic radii (pm) for bond length estimation
        this.atomicRadius = {
            'H': 53, 'C': 67, 'N': 56, 'O': 48, 'F': 42,
            'P': 98, 'S': 88, 'Cl': 79, 'Br': 94, 'I': 115,
            'B': 87, 'Si': 111, 'Li': 152, 'Na': 186, 'K': 227,
            'Mg': 160, 'Ca': 197, 'Al': 143
        };

        // Correct valences for common atoms that historically had bad data
        this.correctValences = {
            'O': 2, 'N': 3, 'S': 2, 'P': 3, 'F': 1, 'Cl': 1, 'Br': 1, 'I': 1,
            'C': 4, 'H': 1, 'B': 3, 'Si': 4
        };
        
        // Elements that commonly form radicals (unpaired electrons)
        this.canFormRadical = new Set(['C', 'N', 'O', 'S', 'P', 'Cl', 'Br', 'I']);
    }
    
    // Calculate implicit hydrogens for an atom
    calculateImplicitHydrogens(atom, molecule) {
        const elementSymbol = atom.element;
        
        // Hydrogens don't have implicit hydrogens
        if (elementSymbol === 'H') return 0;
        
        // CRITICAL FIX: Use correct chemistry valences (periodic table JSON has wrong values!)
        let valence = this.correctValences[elementSymbol];
        
        if (!valence) {
            if (typeof getElement !== 'undefined') {
                const elementData = getElement(elementSymbol);
                if (elementData && elementData.valence !== undefined) {
                    valence = elementData.valence;
                    // Fix wrong values from periodic table
                    if (this.correctValences[elementSymbol] && valence !== this.correctValences[elementSymbol]) {
                        valence = this.correctValences[elementSymbol];
                    }
                }
            }
        }
        
        // Fallback to standardValence if still not found
        if (!valence || valence === 0) {
            valence = this.standardValence[elementSymbol];
        }
        
        if (!valence || valence === 0) return 0;
        
        const bondSum = this.getAtomBondOrder(molecule, atom);
        
        // Account for formal charge
        const charge = atom.charge || 0;
        
        // Calculate: implicitH = valence - bondSum - charge
        // This is the correct chemistry formula
        const implicitH = valence - bondSum - charge;
        
        // Can't have negative hydrogens
        return Math.max(0, implicitH);
    }

    getAtomBondOrder(molecule, atom) {
        if (!molecule || !atom) return 0;
        const bonds = molecule.getAtomBonds(atom.id) || [];
        return bonds.reduce((sum, bond) => sum + (bond?.order || 1), 0);
    }

    canAddBond(molecule, atom, additionalOrder = 1) {
        if (!atom) return false;
        const maxValence = this.getMaxValence(atom.element);
        if (!maxValence) return true;
        const currentOrder = this.getAtomBondOrder(molecule, atom);
        return currentOrder + additionalOrder <= maxValence;
    }
    
    // Calculate formal charge on an atom (Enhanced with proper chemistry formula)
    // Formula: FC = V - (N + B/2)
    // V = valence electrons, N = nonbonding electrons, B = bonding electrons
    calculateFormalCharge(atom, molecule) {
        const elementSymbol = atom.element;
        
        // Get valence electrons (not bonding capacity)
        const V = this.valenceElectrons[elementSymbol];
        if (V === undefined || V === 0) {
            // Fallback for unknown elements
            return 0;
        }
        
        const bonds = molecule.getAtomBonds(atom.id);
        let bondSum = 0;

        // Calculate total bond order (includes hydrogens)
        bonds.forEach(bond => {
            const bondOrder = bond.order || 1;
            bondSum += bondOrder;
        });
        
        // Account for formal charge in implicit H calculation
        const currentCharge = atom.charge || 0;
        
        // Calculate implicit hydrogens
        const standardValence = this.standardValence[elementSymbol] || 0;
        const implicitH = Math.max(0, standardValence - bondSum - currentCharge);
        
        // Calculate nonbonding electrons (lone pairs)
        // Available electrons = V - charge
        // Used for bonding = one electron per bond order unit (bondSum already
        // includes hydrogens through their bonds)
        // Remaining = (V - charge) - bondSum
        const effectiveElectrons = V - currentCharge;
        const usedForBonding = bondSum;
        const remainingElectrons = effectiveElectrons - usedForBonding;
        const lonePairs = Math.max(0, Math.floor(remainingElectrons / 2));
        const nonbondingElectrons = lonePairs * 2;
        
        // Bonding electrons: each bond contributes 2 shared electrons (half per atom)
        const bondingElectrons = bondSum * 2;
        
        // Formal charge = V - (N + B/2)
        const formalCharge = V - nonbondingElectrons - (bondingElectrons / 2);
        
        // Round to avoid floating point errors
        return Math.round(formalCharge * 100) / 100;
    }
    
    // Calculate lone pairs more accurately
    calculateLonePairs(atom, molecule) {
        const elementSymbol = atom.element;
        const V = this.valenceElectrons[elementSymbol];
        if (V === undefined || V === 0) return 0;
        
        const bonds = molecule.getAtomBonds(atom.id);
        let bondSum = 0;

        bonds.forEach(bond => {
            const bondOrder = bond.order || 1;
            bondSum += bondOrder;
        });
        
        const charge = atom.charge || 0;
        const effectiveElectrons = V - charge;
        const remainingElectrons = effectiveElectrons - bondSum;
        
        return Math.max(0, Math.floor(remainingElectrons / 2));
    }
    
    // Detect radicals (atoms with unpaired electrons)
    detectRadical(atom, molecule) {
        const elementSymbol = atom.element;
        if (!this.canFormRadical.has(elementSymbol)) {
            return false;
        }
        
        const V = this.valenceElectrons[elementSymbol];
        if (V === undefined) return false;
        
        const bonds = molecule.getAtomBonds(atom.id);
        let bondSum = 0;
        let explicitH = 0;
        
        bonds.forEach(bond => {
            bondSum += (bond.order || 1);
            const otherId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
            const otherAtom = molecule.getAtomById(otherId);
            if (otherAtom && otherAtom.element === 'H') {
                explicitH++;
            }
        });
        
        const charge = atom.charge || 0;
        const effectiveElectrons = V - charge;
        const usedForBonding = bondSum + explicitH;
        const remainingElectrons = effectiveElectrons - usedForBonding;
        
        // Radical if odd number of remaining electrons
        return remainingElectrons % 2 === 1;
    }
    
    // Check if atom valence is satisfied (enhanced with expanded octet support)
    isValenceSatisfied(atom, molecule) {
        const element = atom.element;
        const standardValence = this.standardValence[element];
        if (!standardValence) return true;
        
        const bonds = molecule.getAtomBonds(atom.id);
        let bondSum = 0;
        
        bonds.forEach(bond => {
            bondSum += (bond.order || 1);
        });
        
        const implicitH = this.calculateImplicitHydrogens(atom, molecule);
        const totalValence = bondSum + implicitH;
        
        // Check standard valence first
        if (totalValence <= standardValence) {
            return true;
        }
        
        // Check if element can have expanded octet
        const maxValence = this.maxValence[element];
        if (maxValence && totalValence <= maxValence) {
            // Check if expanded valence is reasonable (e.g., S can have 6, P can have 5)
            return true;
        }
        
        return false;
    }
    
    // Get maximum allowed valence for an element
    getMaxValence(element) {
        return this.maxValence[element] || this.standardValence[element] || 0;
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
        const sigmaBonds = bonds.length;
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
