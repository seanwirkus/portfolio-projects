// Erase Tool - Remove atoms and bonds

class EraseTool extends BaseTool {
    constructor() {
        super('erase');
    }

    onClick(x, y, molecule, renderer) {
        // Try to find atom first
        const atom = this.getAtomAtPosition(x, y, molecule, 20);
        if (atom) {
            return molecule.removeAtom(atom.id);
        }
        
        // Try to find bond
        const bond = this.getBondAtPosition(x, y, molecule, 10);
        if (bond) {
            return molecule.removeBond(bond.id);
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

window.EraseTool = EraseTool;

