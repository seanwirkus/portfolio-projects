/**
 * Enhanced Atom Drawing System with PubChem Integration
 * Provides intelligent atom placement, validation, and suggestions
 */

class EnhancedAtomDrawing {
    constructor(molecule, pubchemService = null, chemistryIntelligence = null) {
        this.molecule = molecule;
        this.pubchemService = pubchemService;
        this.chemistryIntelligence = chemistryIntelligence || new ChemistryIntelligence();
        
        // Drawing configuration
        this.bondLength = 40;
        this.snapAngles = true;
        this.showGhostPreview = true;
        this.autoValidate = true;
        this.usePubChemValidation = !!pubchemService;
        
        // Angle presets based on hybridization
        this.idealAngles = {
            sp: 180,
            sp2: 120,
            sp3: 109.5
        };
        
        // Element-specific preferences from PubChem data
        this.elementPreferences = new Map();
    }
    
    /**
     * Place an atom with intelligent positioning and validation
     * @param {string} element - Element symbol
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {object} options - Additional options
     * @returns {object} Created atom or null if invalid
     */
    async placeAtom(element, x, y, options = {}) {
        const {
            connectToAtom = null,
            bondOrder = 1,
            validate = this.autoValidate,
            usePubChem = this.usePubChemValidation
        } = options;
        
        // Validate element
        if (!this.isValidElement(element)) {
            console.warn(`Invalid element: ${element}`);
            return null;
        }
        
        // Get element properties
        const elementData = getElement(element);
        if (!elementData) {
            console.warn(`Unknown element: ${element}`);
            return null;
        }
        
        // Check if connecting to existing atom
        if (connectToAtom) {
            return this.placeConnectedAtom(element, connectToAtom, x, y, bondOrder, validate);
        }
        
        // Place standalone atom
        const atom = this.molecule.addAtom(element, x, y);
        
        // Apply PubChem data if available
        if (usePubChem && this.pubchemService) {
            await this.enrichAtomWithPubChem(atom);
        }
        
        // Validate placement
        if (validate) {
            this.validateAtomPlacement(atom);
        }
        
        return atom;
    }
    
    /**
     * Place an atom connected to an existing atom
     */
    placeConnectedAtom(element, targetAtom, mouseX, mouseY, bondOrder, validate) {
        // Predict optimal position based on hybridization and existing bonds
        const predicted = this.predictOptimalPosition(targetAtom, mouseX, mouseY);
        
        // Create new atom at predicted position
        const newAtom = this.molecule.addAtom(element, predicted.x, predicted.y);
        
        // Create bond
        const bond = this.molecule.addBond(targetAtom.id, newAtom.id, bondOrder);
        
        if (!bond) {
            // Bond creation failed (valence exceeded), remove atom
            this.molecule.removeAtom(newAtom.id);
            console.warn('Cannot create bond - valence exceeded');
            return null;
        }
        
        // Update atom properties
        this.molecule.updateAtomProperties(targetAtom);
        this.molecule.updateAtomProperties(newAtom);
        
        // Validate
        if (validate) {
            this.validateAtomPlacement(newAtom);
            this.validateAtomPlacement(targetAtom);
        }
        
        return newAtom;
    }
    
    /**
     * Predict optimal position for new atom based on VSEPR theory
     */
    predictOptimalPosition(atom, mouseX, mouseY) {
        const bonds = this.molecule.getAtomBonds(atom.id);
        const bondCount = bonds.length;
        
        // Determine hybridization
        const hybridization = this.determineHybridization(atom, bonds);
        
        // Calculate existing bond angles
        const existingAngles = bonds.map(bond => {
            const otherAtom = this.molecule.getAtomById(
                bond.atom1 === atom.id ? bond.atom2 : bond.atom1
            );
            if (!otherAtom) return null;
            return Math.atan2(otherAtom.y - atom.y, otherAtom.x - atom.x);
        }).filter(a => a !== null);
        
        // Calculate mouse angle
        const mouseAngle = Math.atan2(mouseY - atom.y, mouseX - atom.x);
        
        // Find best angle based on hybridization
        const bestAngle = this.findBestAngle(existingAngles, mouseAngle, hybridization);
        
        return {
            x: atom.x + this.bondLength * Math.cos(bestAngle),
            y: atom.y + this.bondLength * Math.sin(bestAngle)
        };
    }
    
    /**
     * Determine hybridization from bonds
     */
    determineHybridization(atom, bonds) {
        let hasDouble = false;
        let hasTriple = false;
        
        bonds.forEach(bond => {
            if (bond.order === 2) hasDouble = true;
            if (bond.order === 3) hasTriple = true;
        });
        
        if (hasTriple) return 'sp';
        if (hasDouble) return 'sp2';
        if (bonds.length === 0) return 'sp3';
        
        // Use chemistry intelligence if available
        if (this.chemistryIntelligence) {
            return this.chemistryIntelligence.getHybridization(atom, this.molecule);
        }
        
        // Default based on bond count
        if (bonds.length <= 2) return 'sp';
        if (bonds.length === 3) return 'sp2';
        return 'sp3';
    }
    
    /**
     * Find best angle for new bond avoiding existing bonds
     */
    findBestAngle(existingAngles, targetAngle, hybridization) {
        const idealAngles = this.getIdealAngles(existingAngles[0] || 0, hybridization);
        
        // Filter out angles too close to existing bonds
        const availableAngles = idealAngles.filter(angle => {
            return !existingAngles.some(existing => 
                Math.abs(this.normalizeAngle(angle - existing)) < 0.3
            );
        });
        
        if (availableAngles.length === 0) {
            // All ideal positions taken, use mouse direction
            return targetAngle;
        }
        
        // Find closest available angle to mouse direction
        let bestAngle = availableAngles[0];
        let minDiff = Math.abs(this.normalizeAngle(targetAngle - bestAngle));
        
        availableAngles.forEach(angle => {
            const diff = Math.abs(this.normalizeAngle(targetAngle - angle));
            if (diff < minDiff) {
                minDiff = diff;
                bestAngle = angle;
            }
        });
        
        return bestAngle;
    }
    
    /**
     * Get ideal angles for hybridization
     */
    getIdealAngles(baseAngle, hybridization) {
        const angles = [];
        
        switch(hybridization) {
            case 'sp':
                angles.push(baseAngle, baseAngle + Math.PI);
                break;
            case 'sp2':
                for (let i = 0; i < 3; i++) {
                    angles.push(baseAngle + (i * 2 * Math.PI / 3));
                }
                break;
            case 'sp3':
                // Tetrahedral angles (simplified 2D projection)
                angles.push(
                    baseAngle,
                    baseAngle + (2 * Math.PI / 3),
                    baseAngle + (4 * Math.PI / 3),
                    baseAngle + Math.PI
                );
                break;
        }
        
        return angles;
    }
    
    /**
     * Normalize angle to -π to π
     */
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }
    
    /**
     * Validate atom placement
     */
    validateAtomPlacement(atom) {
        if (!this.chemistryIntelligence) return;
        
        // Check valence
        const isValid = this.chemistryIntelligence.isValenceSatisfied(atom, this.molecule);
        atom.valenceValid = isValid;
        
        // Calculate formal charge
        const charge = this.chemistryIntelligence.calculateFormalCharge(atom, this.molecule);
        atom.charge = charge;
        
        // Update hybridization
        const bonds = this.molecule.getAtomBonds(atom.id);
        atom.hybridization = this.chemistryIntelligence.getHybridization(atom, this.molecule);
        
        if (!isValid) {
            console.warn(`Valence error on ${atom.element} at (${atom.x}, ${atom.y})`);
        }
    }
    
    /**
     * Enrich atom with PubChem data
     */
    async enrichAtomWithPubChem(atom) {
        if (!this.pubchemService) return;
        
        try {
            // Get element-specific data from PubChem
            // This could be expanded to fetch common compounds containing this element
            const elementData = getElement(atom.element);
            
            if (elementData) {
                // Store preferences for future use
                this.elementPreferences.set(atom.element, {
                    commonValence: elementData.valence,
                    electronegativity: elementData.electronegativity,
                    commonHybridizations: elementData.commonHybridizations || []
                });
            }
        } catch (error) {
            console.warn('PubChem enrichment failed:', error);
        }
    }
    
    /**
     * Check if element is valid
     */
    isValidElement(element) {
        return getElement(element) !== null;
    }
    
    /**
     * Get suggested elements for a given context
     */
    getSuggestedElements(context = {}) {
        const { connectedTo = null, bondOrder = 1 } = context;
        
        if (!connectedTo) {
            // Default common elements
            return ['C', 'N', 'O', 'H', 'S', 'P', 'F', 'Cl', 'Br', 'I'];
        }
        
        // Suggest based on what's commonly bonded to this element
        const targetElement = connectedTo.element;
        const suggestions = {
            'C': ['C', 'H', 'N', 'O', 'F', 'Cl', 'Br', 'I', 'S', 'P'],
            'N': ['C', 'H', 'O'],
            'O': ['C', 'H', 'N'],
            'H': ['C', 'N', 'O', 'S'],
            'S': ['C', 'O', 'H'],
            'P': ['C', 'O', 'H']
        };
        
        return suggestions[targetElement] || ['C', 'H', 'N', 'O'];
    }
    
    /**
     * Suggest bond order based on context
     */
    suggestBondOrder(element1, element2) {
        // Common double bonds
        const doubleBonds = [
            ['C', 'O'], ['C', 'N'], ['C', 'C'], ['N', 'O'], ['S', 'O']
        ];
        
        // Common triple bonds
        const tripleBonds = [
            ['C', 'C'], ['C', 'N']
        ];
        
        const pair1 = [element1, element2].sort().join('-');
        const pair2 = [element2, element1].sort().join('-');
        
        if (tripleBonds.some(p => p.sort().join('-') === pair1)) {
            return 3;
        }
        
        if (doubleBonds.some(p => p.sort().join('-') === pair1)) {
            return 2;
        }
        
        return 1;
    }
    
    /**
     * Draw ghost preview of atom placement
     */
    drawGhostPreview(ctx, x, y, element, connectedAtom = null) {
        if (!this.showGhostPreview) return;
        
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#667eea';
        ctx.fillStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        // Draw ghost circle
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Draw element label
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(element, x, y);
        
        // Draw connection preview if connecting
        if (connectedAtom) {
            ctx.beginPath();
            ctx.moveTo(connectedAtom.x, connectedAtom.y);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    /**
     * Draw angle guides for atom placement
     */
    drawAngleGuides(ctx, atom, mouseX, mouseY) {
        const bonds = this.molecule.getAtomBonds(atom.id);
        const hybridization = this.determineHybridization(atom, bonds);
        
        const existingAngles = bonds.map(bond => {
            const otherAtom = this.molecule.getAtomById(
                bond.atom1 === atom.id ? bond.atom2 : bond.atom1
            );
            if (!otherAtom) return null;
            return Math.atan2(otherAtom.y - atom.y, otherAtom.x - atom.x);
        }).filter(a => a !== null);
        
        const idealAngles = this.getIdealAngles(existingAngles[0] || 0, hybridization);
        
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        
        idealAngles.forEach(angle => {
            const used = existingAngles.some(existing => 
                Math.abs(this.normalizeAngle(angle - existing)) < 0.2
            );
            
            if (!used) {
                const endX = atom.x + this.bondLength * 1.5 * Math.cos(angle);
                const endY = atom.y + this.bondLength * 1.5 * Math.sin(angle);
                
                ctx.beginPath();
                ctx.moveTo(atom.x, atom.y);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        });
        
        ctx.restore();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EnhancedAtomDrawing };
}

