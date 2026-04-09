// Smart Drawing System - ChemSketcher/MolView inspired
// Provides intelligent atom placement with angle prediction

class SmartDrawingTool {
    constructor() {
        this.bondLength = 40; // Standard bond length in pixels
        this.snapAngles = true;
        this.showGhostPreview = true;
        this.ghostAtom = null;
        this.chainPlacementThreshold = this.bondLength * 0.7;

        // Drawing state
        this.currentTool = 'atom'; // 'atom', 'bond', 'chain', 'ring', 'template'
        this.currentBondOrder = 1;
        this.currentElement = 'C';
        
        // Angle presets based on hybridization
        this.angles = {
            sp: [180], // Linear
            sp2: [0, 120, 240], // Trigonal planar
            sp3: [0, 109.5, 240, 109.5] // Tetrahedral (simplified to 2D)
        };
        
        // Common structure templates
        this.templates = {
            benzene: this.createBenzeneTemplate(),
            cyclohexane: this.createCyclohexaneTemplate(),
            cyclopentane: this.createCyclopentaneTemplate()
        };
    }
    
    // Predict next atom position based on existing bonds
    predictNextPosition(atom, molecule, mouseX, mouseY) {
        const bonds = molecule.getAtomBonds(atom.id);
        const bondCount = bonds.length;
        
        if (bondCount === 0) {
            // No bonds yet - use mouse direction but snap to standard angles
            const angle = Math.atan2(mouseY - atom.y, mouseX - atom.x);
            return this.snapToAngle(atom, angle);
        }
        
        // Determine hybridization from bond count
        let hybridization = 'sp3';
        if (bondCount === 1) {
            const bond = bonds[0];
            if (bond.order === 3) hybridization = 'sp';
            else if (bond.order === 2) hybridization = 'sp2';
        } else if (bondCount === 2) {
            hybridization = 'sp2';
        }
        
        // Calculate existing bond angles
        const existingAngles = bonds.map(bond => {
            const otherAtom = molecule.getAtomById(
                bond.atom1 === atom.id ? bond.atom2 : bond.atom1
            );
            return Math.atan2(otherAtom.y - atom.y, otherAtom.x - atom.x);
        });
        
        // Find best angle for next bond
        const mouseAngle = Math.atan2(mouseY - atom.y, mouseX - atom.x);
        const bestAngle = this.findBestAngle(existingAngles, mouseAngle, hybridization);
        
        return {
            x: atom.x + this.bondLength * Math.cos(bestAngle),
            y: atom.y + this.bondLength * Math.sin(bestAngle)
        };
    }
    
    // Find best angle that avoids existing bonds
    findBestAngle(existingAngles, targetAngle, hybridization) {
        const idealAngles = this.getIdealAngles(existingAngles[0] || 0, hybridization);
        
        // Filter out used angles
        const availableAngles = idealAngles.filter(angle => {
            return !existingAngles.some(existing => 
                Math.abs(this.normalizeAngle(angle - existing)) < 0.2
            );
        });
        
        if (availableAngles.length === 0) {
            return targetAngle; // All positions used, use mouse direction
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
    
    // Get ideal angles based on hybridization
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
                // Tetrahedral in 2D approximation
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
    
    // Normalize angle to -π to π
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }
    
    // Snap angle to nearest 30 degrees if enabled
    snapToAngle(fromAtom, angle) {
        if (this.snapAngles) {
            const snapIncrement = Math.PI / 6; // 30 degrees
            angle = Math.round(angle / snapIncrement) * snapIncrement;
        }
        
        return {
            x: fromAtom.x + this.bondLength * Math.cos(angle),
            y: fromAtom.y + this.bondLength * Math.sin(angle)
        };
    }
    
    // Draw ghost preview of where atom will be placed
    drawGhostPreview(ctx, x, y, element = 'C') {
        if (!this.showGhostPreview) return;
        
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        // Ghost circle
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Ghost element label
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#667eea';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(element, x, y);
        
        ctx.restore();
    }
    
    // Draw angle guides
    drawAngleGuides(ctx, fromAtom, existingAngles, hybridization) {
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
                const endX = fromAtom.x + this.bondLength * 1.5 * Math.cos(angle);
                const endY = fromAtom.y + this.bondLength * 1.5 * Math.sin(angle);
                
                ctx.beginPath();
                ctx.moveTo(fromAtom.x, fromAtom.y);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        });
        
        ctx.restore();
    }
    
    // Chain drawing tool - click and drag to draw continuous chain
    startChainDrawing(startX, startY, molecule) {
        const firstAtom = molecule.addAtom('C', startX, startY);
        return {
            atoms: [firstAtom],
            lastAtom: firstAtom,
            lastPointer: { x: startX, y: startY },
            totalCarbons: 1
        };
    }

    continueChainDrawing(chainState, x, y, molecule) {
        const dx = x - chainState.lastPointer.x;
        const dy = y - chainState.lastPointer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.chainPlacementThreshold) {
            return { state: chainState, addedAtom: false };
        }

        const predicted = this.predictNextPosition(chainState.lastAtom, molecule, x, y);
        const newAtom = molecule.addAtom('C', predicted.x, predicted.y);
        molecule.addBond(chainState.lastAtom.id, newAtom.id, 1);

        chainState.atoms.push(newAtom);
        chainState.lastAtom = newAtom;
        chainState.lastPointer = { x: predicted.x, y: predicted.y };
        chainState.totalCarbons += 1;

        return { state: chainState, addedAtom: true };
    }
    
    // Template insertion
    createBenzeneTemplate() {
        const radius = 40;
        const atoms = [];
        const bonds = [];
        
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI / 3) - Math.PI / 2;
            atoms.push({
                element: 'C',
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle)
            });
        }
        
        for (let i = 0; i < 6; i++) {
            bonds.push({
                atom1: i,
                atom2: (i + 1) % 6,
                order: i % 2 === 0 ? 2 : 1
            });
        }
        
        return { atoms, bonds };
    }
    
    createCyclohexaneTemplate() {
        const radius = 40;
        const atoms = [];
        const bonds = [];
        
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI / 3) - Math.PI / 2;
            const r = i % 2 === 0 ? radius : radius * 0.9; // Chair conformation hint
            atoms.push({
                element: 'C',
                x: r * Math.cos(angle),
                y: r * Math.sin(angle)
            });
        }
        
        for (let i = 0; i < 6; i++) {
            bonds.push({
                atom1: i,
                atom2: (i + 1) % 6,
                order: 1
            });
        }
        
        return { atoms, bonds };
    }
    
    createCyclopentaneTemplate() {
        const radius = 35;
        const atoms = [];
        const bonds = [];
        
        for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
            atoms.push({
                element: 'C',
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle)
            });
        }
        
        for (let i = 0; i < 5; i++) {
            bonds.push({
                atom1: i,
                atom2: (i + 1) % 5,
                order: 1
            });
        }
        
        return { atoms, bonds };
    }
    
    // Insert template at position
    insertTemplate(template, centerX, centerY, molecule) {
        const atomIds = [];
        
        // Add atoms
        template.atoms.forEach(atom => {
            const newAtom = molecule.addAtom(
                atom.element,
                centerX + atom.x,
                centerY + atom.y
            );
            atomIds.push(newAtom.id);
        });
        
        // Add bonds
        template.bonds.forEach(bond => {
            molecule.addBond(
                atomIds[bond.atom1],
                atomIds[bond.atom2],
                bond.order
            );
        });
        
        return atomIds;
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartDrawingTool;
}
