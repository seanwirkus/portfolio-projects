// MolView-Style Drawing System - Clean & Reliable
// Simple, intuitive drawing like MolView

class OrganicDrawingEngine {
    constructor(molecule, renderer, options = {}) {
        this.renderer = renderer;
        this.chemistryIntelligence = options.chemistryIntelligence || null;
        this.smartChemistryLogic = options.smartChemistryLogic || null;
        this.updateMoleculeReference(molecule);
        
        // Drawing state
        this.mode = 'atom'; // 'atom', 'bond', 'erase'
        this.currentElement = 'C';
        this.bondOrder = 1;
        
        // Interaction state
        this.dragStartAtom = null;
        this.isDragging = false;
        this.previewAtom = null;
        this.previewBond = null;
        
        // Smart snapping
        this.snapAngles = true;
        this.defaultBondLength = 90; // Increased from 60 (50% larger)
        this.chainElement = this.currentElement;
        this.chainConfig = {
            bondLength: 50,
            minDragDistance: 20,
            zigzagAngle: Math.PI / 6
        };
        this.chainState = {
            active: false,
            startAtom: null,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            previewAtoms: [],
            previewBonds: []
        };
    }
    
    updateMoleculeReference(molecule) {
        this.molecule = molecule;
        if (this.smartChemistryLogic && this.smartChemistryLogic.setMolecule) {
            this.smartChemistryLogic.setMolecule(molecule);
        }
    }
    
    setMode(mode) {
        this.mode = mode;
        this.clearPreview();
        this.dragStartAtom = null;
        this.isDragging = false;
        if (mode !== 'chain') {
            this.stopChainDrawing();
        }
    }
    
    setElement(element) {
        this.currentElement = element;
        this.chainElement = element;
    }
    
    setBondOrder(order) {
        this.bondOrder = Math.max(1, Math.min(3, order));
    }
    
    // Handle mouse down
    onMouseDown(x, y) {
        if (this.mode === 'chain') {
            this.handleChainMouseDown(x, y);
            return;
        }
        
        const atom = this.getAtomAt(x, y);
        const bond = this.getBondAt(x, y);
        
        if (this.mode === 'erase') {
            if (atom) {
                this.eraseAtom(atom);
                this.updateRender();
                return;
            }
            const bond = this.getBondAt(x, y);
            if (bond) {
                this.eraseBond(bond);
                this.updateRender();
            }
            return;
        }
        
        if (this.mode === 'atom') {
            if (bond && this.smartChemistryLogic) {
                const newAtom = this.smartChemistryLogic.smartAddAtom(
                    this.currentElement,
                    bond,
                    this.molecule,
                    x,
                    y,
                    this.bondOrder
                );
                if (newAtom) {
                    this.afterStructureChange([newAtom]);
                }
                this.updateRender();
                return;
            }
            
            if (atom && this.smartChemistryLogic) {
                const newAtom = this.smartChemistryLogic.addAtomToAtom(
                    this.currentElement,
                    atom,
                    this.molecule,
                    x,
                    y,
                    this.bondOrder
                );
                if (newAtom) {
                    this.afterStructureChange([atom, newAtom]);
                }
                this.updateRender();
                return;
            }
            
            if (atom && !this.smartChemistryLogic) {
                // Fallback: allow drag to specify direction
                this.dragStartAtom = atom;
                this.isDragging = true;
                return;
            }
            
            const placedAtom = this.placeAtom(x, y);
            if (placedAtom) {
                this.afterStructureChange([placedAtom]);
            }
            this.updateRender();
            return;
        } else if (this.mode === 'bond') {
            if (atom) {
                // Start bond from this atom
                this.dragStartAtom = atom;
                this.isDragging = true;
            } else {
                // Create new atom and start bond
                const newAtom = this.placeAtom(x, y);
                if (newAtom) {
                    this.dragStartAtom = newAtom;
                    this.isDragging = true;
                    this.updateRender();
                }
            }
        }
    }
    
    // Handle mouse move
    onMouseMove(x, y) {
        if (this.mode === 'chain' && this.chainState.active) {
            this.handleChainMouseMove(x, y);
            return;
        }
        
        if (this.isDragging && this.dragStartAtom) {
            // Drawing a bond
            const atom = this.getAtomAt(x, y);
            
            if (atom && atom.id !== this.dragStartAtom.id) {
                // Snapped to an atom - show preview bond
                this.previewBond = {
                    from: this.dragStartAtom,
                    to: atom,
                    order: this.bondOrder
                };
                this.previewAtom = null;
            } else {
                // Not snapped - show preview with smart angle
                const snappedPos = this.snapToAngle(x, y, this.dragStartAtom);
                this.previewAtom = {
                    element: this.currentElement,
                    x: snappedPos.x,
                    y: snappedPos.y
                };
                this.previewBond = {
                    from: this.dragStartAtom,
                    to: { position: snappedPos },
                    order: this.bondOrder
                };
            }
        } else if (this.mode === 'atom' && !this.isDragging) {
            // Show preview atom
            const atom = this.getAtomAt(x, y);
            if (atom) {
                // Hovering over atom - show where new atom would go
                const snappedPos = this.snapToAngle(x, y, atom);
                this.previewAtom = {
                    element: this.currentElement,
                    x: snappedPos.x,
                    y: snappedPos.y
                };
            } else {
                // Just show ghost atom
                this.previewAtom = {
                    element: this.currentElement,
                    x: x,
                    y: y
                };
            }
        }
        
        this.updatePreview();
    }
    
    // Handle mouse up
    onMouseUp(x, y) {
        if (this.mode === 'chain' && this.chainState.active) {
            this.handleChainMouseUp(x, y);
            return;
        }
        
        if (this.isDragging && this.dragStartAtom) {
            const atom = this.getAtomAt(x, y);
            
            if (atom && atom.id !== this.dragStartAtom.id) {
                // Complete bond to existing atom
                this.createBond(this.dragStartAtom, atom, this.bondOrder);
            } else {
                // Create new atom and bond
                const snappedPos = this.snapToAngle(x, y, this.dragStartAtom);
                const newAtom = this.placeAtom(snappedPos.x, snappedPos.y);
                if (newAtom) {
                    this.createBond(this.dragStartAtom, newAtom, this.bondOrder);
                }
            }
            
            this.isDragging = false;
            this.dragStartAtom = null;
        }
        
        this.clearPreview();
        this.updateRender();
    }
    
    stopChainDrawing() {
        if (this.chainState.active) {
            this.chainState.active = false;
            this.clearChainPreview();
        }
    }
    
    handleChainMouseDown(x, y) {
        this.chainState.active = true;
        this.chainState.startX = x;
        this.chainState.startY = y;
        this.chainState.currentX = x;
        this.chainState.currentY = y;
        this.chainState.startAtom = this.getAtomAt(x, y, 25);
        this.chainState.previewAtoms = [];
        this.chainState.previewBonds = [];
        this.buildChainPreview(1);
    }
    
    handleChainMouseMove(x, y) {
        this.chainState.currentX = x;
        this.chainState.currentY = y;
        const distance = Math.hypot(x - this.chainState.startX, y - this.chainState.startY);
        const segments = Math.max(1, Math.floor(distance / this.chainConfig.bondLength));
        this.buildChainPreview(segments);
    }
    
    handleChainMouseUp(x, y) {
        const distance = Math.hypot(x - this.chainState.startX, y - this.chainState.startY);
        const segments = distance < this.chainConfig.minDragDistance
            ? 1
            : Math.max(1, Math.floor(distance / this.chainConfig.bondLength));
        this.commitChain(segments);
        this.stopChainDrawing();
        this.updateRender();
    }
    
    buildChainPreview(segments) {
        this.chainState.previewAtoms = [];
        this.chainState.previewBonds = [];
        
        if (segments < 1) {
            this.pushChainPreview();
            return;
        }
        
        const startAtom = this.chainState.startAtom;
        const startPos = startAtom ? this.getAtomPosition(startAtom) : { x: this.chainState.startX, y: this.chainState.startY };
        let prevX = startPos.x;
        let prevY = startPos.y;
        const baseAngle = this.getChainBaseAngle(startAtom);
        
        for (let i = 0; i < segments; i++) {
            const zigzag = (i % 2 === 0 ? 1 : -1) * this.chainConfig.zigzagAngle;
            const bondAngle = baseAngle + zigzag;
            const x = prevX + this.chainConfig.bondLength * Math.cos(bondAngle);
            const y = prevY + this.chainConfig.bondLength * Math.sin(bondAngle);
            const id = `preview_chain_${i}`;
            
            this.chainState.previewAtoms.push({
                id,
                element: this.chainElement,
                position: { x, y }
            });
            
            const prevId = i === 0
                ? (startAtom ? startAtom.id : '__chain_start__')
                : `preview_chain_${i - 1}`;
            
            if (prevId) {
                this.chainState.previewBonds.push({
                    atom1: prevId,
                    atom2: id,
                    order: 1
                });
            }
            
            prevX = x;
            prevY = y;
        }
        
        this.pushChainPreview();
    }
    
    pushChainPreview() {
        if (!this.renderer || !this.renderer.setPreviewState) return;
        if (!this.chainState.active) {
            this.renderer.setPreviewState({ chainPreview: null });
            return;
        }
        
        this.renderer.setPreviewState({
            chainPreview: {
                atoms: this.chainState.previewAtoms,
                bonds: this.chainState.previewBonds,
                startAtom: this.chainState.startAtom,
                startX: this.chainState.startX,
                startY: this.chainState.startY
            }
        });
        this.renderer.render(this.molecule);
    }
    
    clearChainPreview() {
        this.chainState.previewAtoms = [];
        this.chainState.previewBonds = [];
        if (this.renderer && this.renderer.setPreviewState) {
            this.renderer.setPreviewState({ chainPreview: null });
        }
    }
    
    commitChain(segments) {
        if (segments < 1) return;
        
        const startAtom = this.chainState.startAtom;
        let position = startAtom ? this.getAtomPosition(startAtom) : { x: this.chainState.startX, y: this.chainState.startY };
        const baseAngle = this.getChainBaseAngle(startAtom);
        let lastAtomId = startAtom ? startAtom.id : null;
        
        if (!lastAtomId) {
            const firstAtom = this.handleMoleculeResult(this.molecule.addAtom(this.chainElement, position.x, position.y), 'atom');
            if (!firstAtom) return;
            lastAtomId = firstAtom.id;
            this.afterStructureChange([firstAtom]);
        }
        
        for (let i = 0; i < segments; i++) {
            const zigzag = (i % 2 === 0 ? 1 : -1) * this.chainConfig.zigzagAngle;
            const bondAngle = baseAngle + zigzag;
            position = {
                x: position.x + this.chainConfig.bondLength * Math.cos(bondAngle),
                y: position.y + this.chainConfig.bondLength * Math.sin(bondAngle)
            };
            
            const newAtom = this.handleMoleculeResult(this.molecule.addAtom(this.chainElement, position.x, position.y), 'atom');
            if (!newAtom) continue;
            this.handleMoleculeResult(this.molecule.addBond(lastAtomId, newAtom.id, 1), 'bond');
            this.afterStructureChange([this.getAtomById(lastAtomId), newAtom]);
            lastAtomId = newAtom.id;
        }
    }
    
    getChainBaseAngle(startAtom) {
        let baseAngle = Math.atan2(
            this.chainState.currentY - this.chainState.startY,
            this.chainState.currentX - this.chainState.startX
        );
        
        if (startAtom) {
            const bonds = this.getAtomBonds(startAtom.id);
            if (bonds.length > 0) {
                const angles = bonds.map(bond => {
                    const otherId = bond.atom1 === startAtom.id ? bond.atom2 : bond.atom1;
                    const otherAtom = this.getAtomById(otherId);
                    if (!otherAtom) return null;
                    const pos = this.getAtomPosition(otherAtom);
                    const startPos = this.getAtomPosition(startAtom);
                    return Math.atan2(pos.y - startPos.y, pos.x - startPos.x);
                }).filter(Boolean);
                if (angles.length) {
                    const avgAngle = angles.reduce((sum, value) => sum + value, 0) / angles.length;
                    baseAngle = avgAngle + Math.PI / 2;
                }
            }
        }
        
        if (!Number.isFinite(baseAngle)) {
            baseAngle = 0;
        }
        
        return baseAngle;
    }
    
    // Place atom at position
    placeAtom(x, y) {
        // Check if atom already exists here
        const existing = this.getAtomAt(x, y);
        if (existing) return existing;
        
        // Add atom to molecule - handle both old and new formats
        if (this.molecule.addAtom) {
            const result = this.molecule.addAtom(this.currentElement, x, y);
            return this.handleMoleculeResult(result, 'atom');
        }
        
        return null;
    }
    
    // Create bond between two atoms
    createBond(atom1, atom2, order) {
        if (!atom1 || !atom2 || atom1.id === atom2.id) return;
        
        // Check if bond already exists
        const existingBond = this.getBondBetween(atom1.id, atom2.id);
        if (existingBond) {
            // Cycle bond order
            this.cycleBondOrder(existingBond);
            return;
        }
        
        // Create new bond
        if (this.molecule.addBond) {
            const result = this.molecule.addBond(atom1.id, atom2.id, order);
            this.handleMoleculeResult(result, 'bond');
            this.afterStructureChange([atom1, atom2]);
        }
    }
    
    // Cycle bond order
    cycleBondOrder(bond) {
        const newOrder = bond.order >= 3 ? 1 : bond.order + 1;
        if (this.molecule.changeBondOrder) {
            const result = this.molecule.changeBondOrder(bond.id, newOrder);
            if (result) {
                this.updateMoleculeReference(result);
            }
        } else if (bond.order !== undefined) {
            bond.order = newOrder;
        }
        
        const atom1 = this.getAtomById(bond.atom1);
        const atom2 = this.getAtomById(bond.atom2);
        this.afterStructureChange([atom1, atom2]);
    }
    
    // Erase atom
    eraseAtom(atom) {
        if (this.molecule.removeAtom) {
            const result = this.molecule.removeAtom(atom.id);
            if (result) {
                this.updateMoleculeReference(result);
            }
        }
        this.afterStructureChange([]);
    }
    
    // Erase bond
    eraseBond(bond) {
        if (this.molecule.removeBond) {
            const result = this.molecule.removeBond(bond.id);
            if (result) {
                this.updateMoleculeReference(result);
            }
        }
        this.afterStructureChange([]);
    }
    
    // Smart angle snapping
    snapToAngle(x, y, fromAtom) {
        if (!this.snapAngles || !fromAtom) {
            return { x, y };
        }
        
        const bonds = this.getAtomBonds(fromAtom.id);
        const bondCount = bonds.length;
        
        // Calculate ideal angles
        let idealAngles = [];
        
        if (bondCount === 0) {
            // No bonds - use any angle
            idealAngles = [Math.atan2(y - fromAtom.position.y, x - fromAtom.position.x)];
        } else if (bondCount === 1) {
            // One bond - 120° or 180°
            const existingAngle = Math.atan2(
                bonds[0].otherAtom.position.y - fromAtom.position.y,
                bonds[0].otherAtom.position.x - fromAtom.position.x
            );
            idealAngles = [
                existingAngle + Math.PI, // Opposite
                existingAngle + Math.PI * 2 / 3, // 120°
                existingAngle - Math.PI * 2 / 3  // 120°
            ];
        } else if (bondCount === 2) {
            // Two bonds - find gap
            const angles = bonds.map(b => 
                Math.atan2(b.otherAtom.position.y - fromAtom.position.y,
                         b.otherAtom.position.x - fromAtom.position.x)
            );
            const avgAngle = (angles[0] + angles[1]) / 2;
            idealAngles = [
                avgAngle + Math.PI, // Opposite
                avgAngle + Math.PI / 2, // Perpendicular
                avgAngle - Math.PI / 2  // Perpendicular
            ];
        } else {
            // Multiple bonds - find largest gap
            const angles = bonds.map(b => 
                Math.atan2(b.otherAtom.position.y - fromAtom.position.y,
                         b.otherAtom.position.x - fromAtom.position.x)
            ).sort((a, b) => a - b);
            
            const gaps = [];
            for (let i = 0; i < angles.length; i++) {
                const next = (i + 1) % angles.length;
                let gap = angles[next] - angles[i];
                if (gap < 0) gap += Math.PI * 2;
                gaps.push({ start: angles[i], size: gap, mid: angles[i] + gap / 2 });
            }
            
            gaps.sort((a, b) => b.size - a.size);
            idealAngles = [gaps[0].mid];
        }
        
        // Find closest ideal angle
        const mouseAngle = Math.atan2(y - fromAtom.position.y, x - fromAtom.position.x);
        let bestAngle = idealAngles[0];
        let minDiff = Math.abs(this.normalizeAngle(mouseAngle - idealAngles[0]));
        
        for (const angle of idealAngles) {
            const diff = Math.abs(this.normalizeAngle(mouseAngle - angle));
            if (diff < minDiff) {
                minDiff = diff;
                bestAngle = angle;
            }
        }
        
        // Snap if close enough (30 degrees)
        if (minDiff < Math.PI / 6) {
            const pos = fromAtom.position || { x: fromAtom.x, y: fromAtom.y };
            return {
                x: pos.x + Math.cos(bestAngle) * this.defaultBondLength,
                y: pos.y + Math.sin(bestAngle) * this.defaultBondLength
            };
        }
        
        return { x, y };
    }
    
    // Get atom at position
    getAtomAt(x, y, threshold = 20) {
        if (!this.molecule) return null;
        
        const atoms = this.molecule.atoms instanceof Map ? 
            Array.from(this.molecule.atoms.values()) : 
            (Array.isArray(this.molecule.atoms) ? this.molecule.atoms : []);
        
        for (const atom of atoms) {
            const pos = atom.position || { x: atom.x, y: atom.y };
            const dx = pos.x - x;
            const dy = pos.y - y;
            const dist = Math.hypot(dx, dy);
            if (dist <= threshold) {
                return atom;
            }
        }
        return null;
    }
    
    // Get bond at position
    getBondAt(x, y, threshold = 10) {
        if (!this.molecule) return null;
        
        const bonds = this.molecule.bonds instanceof Map ? 
            Array.from(this.molecule.bonds.values()) : 
            (Array.isArray(this.molecule.bonds) ? this.molecule.bonds : []);
        
        for (const bond of bonds) {
            const atom1 = this.getAtomById(bond.atom1);
            const atom2 = this.getAtomById(bond.atom2);
            if (!atom1 || !atom2) continue;
            
            const pos1 = atom1.position || { x: atom1.x, y: atom1.y };
            const pos2 = atom2.position || { x: atom2.x, y: atom2.y };
            
            // Distance from point to line segment
            const dx = pos2.x - pos1.x;
            const dy = pos2.y - pos1.y;
            const lengthSq = dx * dx + dy * dy;
            if (lengthSq === 0) continue;
            
            const t = Math.max(0, Math.min(1, ((x - pos1.x) * dx + (y - pos1.y) * dy) / lengthSq));
            const projX = pos1.x + t * dx;
            const projY = pos1.y + t * dy;
            
            const distSq = (x - projX) * (x - projX) + (y - projY) * (y - projY);
            if (distSq <= threshold * threshold) {
                return bond;
            }
        }
        return null;
    }
    
    // Get bond between two atoms
    getBondBetween(atom1Id, atom2Id) {
        if (!this.molecule) return null;
        
        const bonds = this.molecule.bonds instanceof Map ? 
            Array.from(this.molecule.bonds.values()) : 
            (Array.isArray(this.molecule.bonds) ? this.molecule.bonds : []);
        
        for (const bond of bonds) {
            if ((bond.atom1 === atom1Id && bond.atom2 === atom2Id) ||
                (bond.atom1 === atom2Id && bond.atom2 === atom1Id)) {
                return bond;
            }
        }
        return null;
    }
    
    // Get atom by ID
    getAtomById(id) {
        if (!this.molecule) return null;
        
        if (this.molecule.atoms instanceof Map) {
            return this.molecule.atoms.get(id);
        } else if (this.molecule.getAtom) {
            return this.molecule.getAtom(id);
        } else if (this.molecule.getAtomById) {
            return this.molecule.getAtomById(id);
        }
        
        // Fallback: search array
        const atoms = Array.isArray(this.molecule.atoms) ? 
            this.molecule.atoms : 
            Array.from(this.molecule.atoms?.values() || []);
        
        return atoms.find(a => a.id === id);
    }
    
    // Get bonds for atom
    getAtomBonds(atomId) {
        if (!this.molecule) return [];
        
        // Try using molecule's method first
        if (this.molecule.getAtomBonds) {
            const bonds = this.molecule.getAtomBonds(atomId);
            return bonds.map(bond => {
                const otherId = bond.atom1 === atomId ? bond.atom2 : bond.atom1;
                const otherAtom = this.getAtomById(otherId);
                return {
                    ...bond,
                    otherAtom: otherAtom
                };
            });
        }
        
        // Fallback: search bonds manually
        let bonds = [];
        if (this.molecule.bonds instanceof Map) {
            bonds = Array.from(this.molecule.bonds.values());
        } else if (Array.isArray(this.molecule.bonds)) {
            bonds = this.molecule.bonds;
        }
        
        return bonds
            .filter(b => b.atom1 === atomId || b.atom2 === atomId)
            .map(bond => {
                const otherId = bond.atom1 === atomId ? bond.atom2 : bond.atom1;
                const otherAtom = this.getAtomById(otherId);
                return {
                    ...bond,
                    otherAtom: otherAtom
                };
            });
    }
    
    // Update preview rendering
    updatePreview() {
        if (this.renderer && this.renderer.setPreviewState) {
            this.renderer.setPreviewState({
                previewAtom: this.previewAtom,
                previewBond: this.previewBond
            });
            if (this.renderer.render) {
                this.renderer.render(this.molecule);
            }
        }
    }
    
    handleMoleculeResult(result, entityKey) {
        if (!result) return null;
        if (result.molecule) {
            this.updateMoleculeReference(result.molecule);
            if (!entityKey) {
                return null;
            }
            return result[entityKey] || null;
        }
        return entityKey ? result : result;
    }
    
    afterStructureChange(affectedAtoms = []) {
        if (this.molecule && typeof this.molecule.updateAtomProperties === 'function') {
            affectedAtoms.forEach(atom => {
                if (!atom || !atom.id) return;
                const actual = this.getAtomById(atom.id);
                if (actual) {
                    this.molecule.updateAtomProperties(actual);
                    if (this.chemistryIntelligence && typeof this.chemistryIntelligence.calculateFormalCharge === 'function') {
                        actual.charge = this.chemistryIntelligence.calculateFormalCharge(actual, this.molecule);
                    }
                }
            });
        }
        
        if (this.chemistryIntelligence && typeof this.chemistryIntelligence.validateMolecule === 'function') {
            try {
                const warnings = this.chemistryIntelligence.validateMolecule(this.molecule);
                if (warnings && warnings.length) {
                    console.warn('Valence warnings:', warnings);
                }
            } catch (err) {
                console.warn('Validation skipped:', err);
            }
        }
        
        if (this.smartChemistryLogic && typeof this.smartChemistryLogic.setMolecule === 'function') {
            this.smartChemistryLogic.setMolecule(this.molecule);
        }
    }
    
    // Update render
    updateRender() {
        if (this.renderer && this.renderer.render) {
            this.renderer.render(this.molecule);
        }
    }
    
    // Clear preview
    clearPreview() {
        this.previewAtom = null;
        this.previewBond = null;
        if (this.renderer && this.renderer.setPreviewState) {
            this.renderer.setPreviewState({
                previewAtom: null,
                previewBond: null,
                chainPreview: null
            });
        }
    }
    
    // Normalize angle to [-PI, PI]
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }
    
    getAtomPosition(atom) {
        if (!atom) return { x: 0, y: 0 };
        return atom.position || { x: atom.x, y: atom.y };
    }
}

