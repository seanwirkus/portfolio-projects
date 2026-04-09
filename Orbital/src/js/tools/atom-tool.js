// Atom Tool - Place atoms on canvas

class AtomTool extends BaseTool {
    constructor() {
        super('atom');
        this.element = 'C';
    }

    setElement(element) {
        this.element = element;
    }

    onClick(x, y, molecule, renderer) {
        const clickedAtom = this.getAtomAtPosition(x, y, molecule, 20);
        
        if (clickedAtom) {
            // Clicked on existing atom - don't add duplicate
            return molecule;
        }
        
        // Add new atom
        const result = molecule.addAtom(this.element, x, y);
        return result.molecule;
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
}

window.AtomTool = AtomTool;

