// Bond Tool - Draw bonds between atoms

class BondTool extends BaseTool {
    constructor() {
        super('bond');
        this.bondStartAtom = null;
        this.bondOrder = 1;
    }

    setBondOrder(order) {
        this.bondOrder = Math.max(1, Math.min(3, order));
    }

    onMouseDown(x, y, molecule, renderer) {
        const clickedAtom = this.getAtomAtPosition(x, y, molecule, 20);
        
        if (clickedAtom) {
            this.bondStartAtom = clickedAtom;
        } else {
            // Create new atom and start bond
            const result = molecule.addAtom('C', x, y);
            molecule = result.molecule;
            this.bondStartAtom = result.atom;
        }
        
        return molecule;
    }

    onMouseUp(x, y, molecule, renderer) {
        if (!this.bondStartAtom) return molecule;
        
        const clickedAtom = this.getAtomAtPosition(x, y, molecule, 20);
        
        if (clickedAtom && clickedAtom.id !== this.bondStartAtom.id) {
            // Complete bond
            const result = molecule.addBond(
                this.bondStartAtom.id,
                clickedAtom.id,
                this.bondOrder
            );
            molecule = result.molecule;
        }
        
        this.bondStartAtom = null;
        return molecule;
    }

    onClick(x, y, molecule, renderer) {
        // Handle bond clicking to cycle order
        const clickedBond = this.getBondAtPosition(x, y, molecule, 10);
        if (clickedBond) {
            const newOrder = clickedBond.order >= 3 ? 1 : clickedBond.order + 1;
            const updated = molecule.bonds.get(clickedBond.id).changeOrder(newOrder);
            const newMolecule = molecule.clone();
            newMolecule.bonds.set(clickedBond.id, updated);
            newMolecule.updateMetadata();
            return newMolecule;
        }
        
        return molecule;
    }

    getAtomAtPosition(x, y, molecule, threshold = 20) {
        for (const atom of molecule.atoms.values()) {
            const dx = atom.position.x - x;
            const dy = atom.position.y - y;
            const dist = Math.hypot(dx, dy);
            if (dist <= threshold) {
                return atom;
            }
        }
        return null;
    }

    getBondAtPosition(x, y, molecule, threshold = 10) {
        for (const bond of molecule.bonds.values()) {
            const atom1 = molecule.getAtom(bond.atom1);
            const atom2 = molecule.getAtom(bond.atom2);
            if (!atom1 || !atom2) continue;
            
            const x1 = atom1.position.x;
            const y1 = atom1.position.y;
            const x2 = atom2.position.x;
            const y2 = atom2.position.y;
            
            // Distance from point to line segment
            const dx = x2 - x1;
            const dy = y2 - y1;
            const lengthSq = dx * dx + dy * dy;
            if (lengthSq === 0) continue;
            
            const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSq));
            const projX = x1 + t * dx;
            const projY = y1 + t * dy;
            
            const distSq = (x - projX) * (x - projX) + (y - projY) * (y - projY);
            if (distSq <= threshold * threshold) {
                return bond;
            }
        }
        return null;
    }
}

window.BondTool = BondTool;

