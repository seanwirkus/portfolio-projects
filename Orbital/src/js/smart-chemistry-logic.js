// Smart Chemistry Logic - Intelligent atom/bond addition with context awareness

class SmartChemistryLogic {
    constructor(chemistryIntelligence, molecule = null) {
        this.chemIntelligence = chemistryIntelligence;
        this.molecule = molecule; // Store molecule reference for position prediction
    }
    
    // Update molecule reference
    setMolecule(molecule) {
        this.molecule = molecule;
    }

    /**
     * Intelligently add an atom based on context
     * - If clicking on a bond: convert to functional group if appropriate
     * - If clicking on an atom: add with proper bond order
     * - If adding O to C-C: create carbonyl
     * - If adding H: place based on valence
     */
    smartAddAtom(element, target, molecule, x, y, bondOrder = 1) {
        // Case 1: Adding to a bond (insert atom into bond)
        if (target && target.atom1 && target.atom2) {
            return this.insertAtomIntoBond(element, target, molecule, x, y, bondOrder);
        }
        
        // Case 2: Adding to an atom
        if (target && target.element) {
            return this.addAtomToAtom(element, target, molecule, x, y, bondOrder);
        }
        
        // Case 3: Adding standalone atom
        return molecule.addAtom(element, x, y);
    }

    /**
     * Insert atom into a bond (e.g., O into C-C to make C=O)
     */
    insertAtomIntoBond(element, bond, molecule, x, y, bondOrder) {
        const atom1 = molecule.getAtomById(bond.atom1);
        const atom2 = molecule.getAtomById(bond.atom2);
        
        if (!atom1 || !atom2) return null;

        // Special case: Adding O to C-C bond → Create carbonyl
        if (element === 'O' && atom1.element === 'C' && atom2.element === 'C') {
            return this.createCarbonyl(atom1, atom2, bond, molecule, x, y);
        }
        
        // Special case: Adding H to bond → Usually not valid, but handle gracefully
        if (element === 'H') {
            // H can't be inserted into bonds, add to one of the atoms instead
            return this.addHydrogenToAtom(atom1, molecule, x, y);
        }
        
        // Default: Insert atom between the two atoms
        // Remove old bond
        molecule.removeBond(bond.id);
        
        // Add new atom
        const newAtom = molecule.addAtom(element, x, y);
        
        // Create bonds to both original atoms
        molecule.addBond(atom1.id, newAtom.id, bondOrder);
        molecule.addBond(atom2.id, newAtom.id, bondOrder);
        
        // Update properties
        molecule.updateAtomProperties(atom1);
        molecule.updateAtomProperties(atom2);
        molecule.updateAtomProperties(newAtom);
        
        return newAtom;
    }

    /**
     * Create carbonyl group (C=O) from C-C bond
     */
    createCarbonyl(carbon1, carbon2, bond, molecule, x, y) {
        // Determine which carbon becomes the carbonyl carbon
        // Use the one closer to click position
        const dist1 = Math.sqrt(
            Math.pow(carbon1.position.x - x, 2) + 
            Math.pow(carbon1.position.y - y, 2)
        );
        const dist2 = Math.sqrt(
            Math.pow(carbon2.position.x - x, 2) + 
            Math.pow(carbon2.position.y - y, 2)
        );
        
        const carbonylCarbon = dist1 < dist2 ? carbon1 : carbon2;
        const otherCarbon = dist1 < dist2 ? carbon2 : carbon1;
        
        // Remove old C-C bond
        molecule.removeBond(bond.id);
        
        // Add oxygen atom
        const oxygen = molecule.addAtom('O', x, y);
        
        // Create C=O double bond
        molecule.addBond(carbonylCarbon.id, oxygen.id, 2);
        
        // Keep connection to other carbon (single bond)
        molecule.addBond(carbonylCarbon.id, otherCarbon.id, 1);
        
        // Update properties
        molecule.updateAtomProperties(carbonylCarbon);
        molecule.updateAtomProperties(otherCarbon);
        molecule.updateAtomProperties(oxygen);
        
        console.log('✨ Carbonyl group created: C=O');
        return oxygen;
    }

    /**
     * Add atom to existing atom with intelligent bond order
     */
    addAtomToAtom(element, targetAtom, molecule, x, y, requestedBondOrder) {
        // Update molecule reference
        this.molecule = molecule;
        
        // Predict optimal position
        const bonds = molecule.getAtomBonds(targetAtom.id);
        const optimalPos = this.predictOptimalPosition(targetAtom, bonds, x, y);
        
        // Determine bond order intelligently
        let bondOrder = requestedBondOrder;
        
        // Special cases for common functional groups
        if (element === 'O' && targetAtom.element === 'C') {
            // Check if we should create carbonyl or alcohol
            const carbonBonds = bonds.filter(b => {
                const otherId = b.atom1 === targetAtom.id ? b.atom2 : b.atom1;
                const otherAtom = molecule.getAtomById(otherId);
                return otherAtom && otherAtom.element === 'C';
            });
            
            // If carbon already has double bond or is highly substituted, make alcohol (single bond)
            // Otherwise, could be carbonyl - but default to single for now (user can change)
            if (bonds.some(b => b.order > 1)) {
                bondOrder = 1; // Alcohol
            }
        }
        
        if (element === 'H' && targetAtom.element === 'C') {
            // Always single bond for H
            bondOrder = 1;
        }
        
        // FIXED: Pre-validate before creating atom (more efficient)
        if (!molecule.canAddBond(targetAtom, bondOrder)) {
            console.warn(`Cannot add ${element} to ${targetAtom.element} - valence would be exceeded`);
            return null;
        }
        
        // Add atom
        const newAtom = molecule.addAtom(element, optimalPos.x, optimalPos.y);
        const bond = molecule.addBond(targetAtom.id, newAtom.id, bondOrder);
        
        if (!bond) {
            // Shouldn't happen if canAddBond passed, but handle gracefully
            molecule.removeAtom(newAtom.id);
            console.warn('Bond creation failed after atom creation - removing atom');
            return null;
        }
        
        // Update properties
        molecule.updateAtomProperties(targetAtom);
        molecule.updateAtomProperties(newAtom);
        
        // Auto-calculate formal charges
        if (this.chemIntelligence) {
            targetAtom.charge = this.chemIntelligence.calculateFormalCharge(targetAtom, molecule);
            newAtom.charge = this.chemIntelligence.calculateFormalCharge(newAtom, molecule);
        }
        
        return newAtom;
    }

    /**
     * Add hydrogen to atom (intelligent placement based on valence)
     */
    addHydrogenToAtom(atom, molecule, x, y) {
        const bonds = molecule.getAtomBonds(atom.id);
        const bondSum = bonds.reduce((sum, b) => sum + (b.order || 1), 0);
        
        // Check if atom can accept more H
        const element = getElement(atom.element);
        if (!element) return null;
        
        const maxValence = element.valence || 4;
        const availableSlots = maxValence - bondSum;
        
        if (availableSlots <= 0) {
            console.warn('Atom cannot accept more hydrogens - valence full');
            return null;
        }
        
        // Predict optimal position for H
        const optimalPos = this.predictOptimalPosition(atom, bonds, x, y);
        const hydrogen = molecule.addAtom('H', optimalPos.x, optimalPos.y);
        molecule.addBond(atom.id, hydrogen.id, 1);
        
        molecule.updateAtomProperties(atom);
        molecule.updateAtomProperties(hydrogen);
        
        return hydrogen;
    }

    /**
     * Predict optimal position for new atom based on existing bonds
     */
    predictOptimalPosition(atom, existingBonds, mouseX, mouseY) {
        const x = atom.position.x;
        const y = atom.position.y;
        
        // Need molecule reference - store it in constructor
        if (!this.molecule) {
            // Fallback if molecule not available
            const angle = Math.atan2(mouseY - y, mouseX - x);
            const distance = 50;
            return {
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance
            };
        }
        
        if (existingBonds.length === 0) {
            // No bonds - place in direction of mouse
            const angle = Math.atan2(mouseY - y, mouseX - x);
            const distance = 50;
            return {
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance
            };
        }
        
        // Calculate angles of existing bonds
        const bondAngles = existingBonds.map(bond => {
            const otherId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
            const otherAtom = this.molecule.getAtomById(otherId);
            if (!otherAtom) return null;
            return Math.atan2(otherAtom.position.y - y, otherAtom.position.x - x);
        }).filter(a => a !== null);
        
        // Find largest gap
        bondAngles.sort((a, b) => a - b);
        let maxGap = 0;
        let bestAngle = 0;
        
        for (let i = 0; i < bondAngles.length; i++) {
            const next = (i + 1) % bondAngles.length;
            let gap = bondAngles[next] - bondAngles[i];
            if (gap < 0) gap += Math.PI * 2;
            
            if (gap > maxGap) {
                maxGap = gap;
                bestAngle = bondAngles[i] + gap / 2;
            }
        }
        
        // If no good gap found, use mouse direction
        if (maxGap < Math.PI / 3) {
            bestAngle = Math.atan2(mouseY - y, mouseX - x);
        }
        
        const distance = 50;
        return {
            x: x + Math.cos(bestAngle) * distance,
            y: y + Math.sin(bestAngle) * distance
        };
    }

    /**
     * Detect if we should create a functional group
     */
    shouldCreateFunctionalGroup(element, targetAtom, molecule) {
        if (element === 'O' && targetAtom.element === 'C') {
            const bonds = molecule.getAtomBonds(targetAtom.id);
            // If carbon has available valence, could be alcohol or carbonyl
            return true;
        }
        
        if (element === 'N' && targetAtom.element === 'C') {
            // Could be amine
            return true;
        }
        
        return false;
    }

    /**
     * Get suggested bond order for element pair
     */
    getSuggestedBondOrder(element1, element2) {
        // Common patterns
        if ((element1 === 'C' && element2 === 'O') || (element1 === 'O' && element2 === 'C')) {
            // Could be 1 (alcohol) or 2 (carbonyl) - default to 1, user can change
            return 1;
        }
        
        if ((element1 === 'C' && element2 === 'N') || (element1 === 'N' && element2 === 'C')) {
            return 1; // Usually single, but can be double/triple
        }
        
        if (element1 === 'H' || element2 === 'H') {
            return 1; // Always single for H
        }
        
        if (element1 === 'C' && element2 === 'C') {
            return 1; // Default single, user can cycle
        }
        
        return 1; // Default
    }
}

