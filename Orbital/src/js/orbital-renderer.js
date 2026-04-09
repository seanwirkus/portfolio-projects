/* exported OrbitalRenderer */
/**
 * OrbitalRenderer - Custom Drawing Logic
 * Handles overlay rendering (Lone Pairs, Charges, Warnings) on top of MolPad.
 */
class OrbitalRenderer {
    constructor(molpad, chemIntelligence) {
        this.molpad = molpad;
        this.chemIntelligence = chemIntelligence;
        
        // Expose canvas property for SmartChainTool compatibility
        this.canvas = molpad.container && molpad.container[0] ? molpad.container[0].querySelector('canvas') : null;
        
        // Preview State for Chain Tool
        this.previewState = null;
        
        // Display State
        this.options = {
            lonePairs: false,
            charges: false,
            hybridization: false,
            valenceWarnings: true,
            skeletal: true,
            implicitH: true
        };

        this.hookDrawCycle();
    }

    hookDrawCycle() {
        const originalDraw = this.molpad.draw.bind(this.molpad);
        this.molpad.draw = () => {
            try {
                originalDraw(); // Base MolPad render
                this.drawOverlays();
            } catch (e) {
                console.error('Draw Cycle Error:', e);
                originalDraw(); // Fallback
            }
        };
    }

    render() {
        this.molpad.requestRedraw();
    }

    setPreviewState(state) {
        this.previewState = state;
        this.render();
    }

    drawOverlays() {
        const ctx = this.molpad.ctx;
        if (!ctx) return;

        ctx.save();
        // Apply transform
        ctx.transform(...this.molpad.matrix);

        // 0. Chain Preview (Draw BEFORE overlays)
        if (this.previewState && this.previewState.chainPreview) {
            this.drawChainPreview(ctx, this.previewState.chainPreview);
        }

        // 1. Lone Pairs
        if (this.options.lonePairs) this.drawLonePairs(ctx);

        // 2. Charges
        if (this.options.charges) this.drawCharges(ctx);

        // 3. Hybridization
        if (this.options.hybridization) this.drawHybridization(ctx);

        // 4. Valence Warnings
        if (this.options.valenceWarnings) this.drawValenceWarnings(ctx);

        // 5. OH Labels (Always on)
        this.drawOHLabels(ctx);

        ctx.restore();
    }

    drawChainPreview(ctx, preview) {
        if (!preview || !preview.atoms || !preview.bonds) return;

        // Draw Bonds
        ctx.beginPath();
        ctx.strokeStyle = '#000'; // Standard bond color
        ctx.lineWidth = 1.5 * (this.molpad.s ? this.molpad.s.bond.width : 1); 
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        preview.bonds.forEach(bond => {
            let pos1 = null, pos2 = null;

            if (bond.atom1 === 'start') {
                pos1 = preview.startAtom ? preview.startAtom.center : {x: preview.startX, y: preview.startY};
            } else {
                // Manually find atom in preview.atoms to avoid prototype patch issues
                for (let i = 0; i < preview.atoms.length; i++) {
                    const a = preview.atoms[i];
                    if (a && a.id === bond.atom1) {
                        pos1 = a.center || {x: a.x, y: a.y};
                        break;
                    }
                }
            }

            for (let i = 0; i < preview.atoms.length; i++) {
                const a = preview.atoms[i];
                if (a && a.id === bond.atom2) {
                    pos2 = a.center || {x: a.x, y: a.y};
                    break;
                }
            }
            
            if (pos1 && pos2) {
                ctx.moveTo(pos1.x, pos1.y);
                ctx.lineTo(pos2.x, pos2.y);
            }
        });
        ctx.stroke();

        // Draw Atoms (Nodes)
        ctx.fillStyle = '#000';
        preview.atoms.forEach(atom => {
            const pos = atom.center || {x: atom.x, y: atom.y};
            // Draw simple dot for carbon chain nodes
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawLonePairs(ctx) {
        // Simplified delegation to ChemIntelligence or local calculation
        // Implementation matches logic extracted from app-molview.js
        const mol = this.molpad.mol;
        mol.atoms.forEach((atom, i) => {
            if (atom.element === 'C' || atom.element === 'H') return;
            const count = this.getLonePairCount(atom);
            if (count > 0) this.renderLonePairDots(ctx, atom, count);
        });
    }

    drawValenceWarnings(ctx) {
        if (!this.chemIntelligence) return;
        const mol = this.molpad.mol;
        const wrapper = this.createMolWrapper(mol);

        mol.atoms.forEach((atom, i) => {
            const tempAtom = { id: i, element: atom.element, charge: atom.charge || 0 };
            if (!this.chemIntelligence.isValenceSatisfied(tempAtom, wrapper)) {
                this.renderWarningIcon(ctx, atom);
            }
        });
    }

    // ... Helpers (createMolWrapper, etc. ported from app-molview.js)
    createMolWrapper(mol) {
        return {
            getAtomBonds: (id) => {
                const atom = mol.atoms[id];
                if (!atom || !atom.bonds) return [];
                return atom.bonds.map(bIdx => {
                    const b = mol.bonds[bIdx];
                    return { id: bIdx, atom1: b.from, atom2: b.to, order: b.type || 1 };
                });
            },
            getAtomById: (id) => ({ id, element: mol.atoms[id].element, charge: mol.atoms[id].charge || 0 })
        };
    }

    getLonePairCount(atom) {
        // Delegation to ChemIntelligence
        if (this.chemIntelligence) {
            const wrapper = this.createMolWrapper(this.molpad.mol);
            const tempAtom = { id: atom.index, element: atom.element, charge: atom.charge || 0 };
            return this.chemIntelligence.calculateLonePairs(tempAtom, wrapper);
        }
        return 0; 
    }

    renderLonePairDots(ctx, atom, count) {
        // Visual rendering logic (red dots)
        const cx = atom.center.x;
        const cy = atom.center.y;
        const radius = 18;
        
        // Simple placement for MVP - can use advanced geometry if needed
        for(let i=0; i<count; i++) {
            const angle = (Math.PI * 2 * i) / count; // Simplified distribution
            const px = cx + Math.cos(angle) * radius;
            const py = cy + Math.sin(angle) * radius;
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI*2);
            ctx.fillStyle = '#A61F24';
            ctx.fill();
        }
    }

    renderWarningIcon(ctx, atom) {
        const { x, y } = atom.center;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('!', x - 2, y + 3);
    }

    drawCharges(ctx) {
        // Implement charge rendering
    }

    drawHybridization(ctx) {
        // Implement hybridization rendering
    }

    drawOHLabels(ctx) {
        // OH label logic
    }
}
// Expose globally for modules that instantiate OrbitalRenderer by name
if (typeof window !== 'undefined') window.OrbitalRenderer = OrbitalRenderer;
