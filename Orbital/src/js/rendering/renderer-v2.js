// Renderer v2 - Pure Rendering Engine
// No business logic, just draws what it's told

class RendererV2 {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.setupCanvas();
        
        this.style = {
            bondWidth: 2,
            bondColor: '#222',
            atomFont: 'bold 18px Helvetica Neue, Arial',
            atomColors: {
                'C': '#222', 'H': '#666', 'N': '#3050F8', 'O': '#FF0D0D',
                'F': '#90E050', 'Cl': '#1FF01F', 'Br': '#A62929', 'I': '#940094',
                'S': '#FFFF30', 'P': '#FF8000', 'B': '#FBC02D', 'Si': '#4A4A4A'
            },
            selectionColor: '#FFB400',
            errorColor: '#E63946',
            implicitHColor: '#999',
            implicitHFont: '12px Helvetica Neue, Arial'
        };
        
        this.viewport = {
            scale: 1,
            offsetX: 0,
            offsetY: 0
        };
        
        // Preview state
        this.previewState = {
            previewAtom: null,
            previewBond: null,
            hoverAtom: null,
            hoverBond: null,
            chainPreview: null
        };
    }
    
    setPreviewState(state) {
        this.previewState = { ...this.previewState, ...state };
    }

    setupCanvas() {
        this.resize();
        
        // Re-resize on window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resize(), 100);
        });
    }
    
    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        // Only resize if size actually changed
        if (rect.width > 0 && rect.height > 0) {
            const logicalWidth = rect.width;
            const logicalHeight = rect.height;
            
            // Set actual canvas size (physical pixels)
            this.canvas.width = logicalWidth * dpr;
            this.canvas.height = logicalHeight * dpr;
            
            // Set display size (CSS pixels)
            this.canvas.style.width = logicalWidth + 'px';
            this.canvas.style.height = logicalHeight + 'px';
            
            // Scale context to match device pixel ratio
            this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
            this.ctx.scale(dpr, dpr);
            
            // Enable high-quality rendering
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
        }
    }

    clear() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        // Use logical dimensions (after scaling)
        this.ctx.clearRect(0, 0, rect.width, rect.height);
    }

    render(molecule, options = {}) {
        this.clear();
        this._molecule = molecule; // Store for preview helpers
        
        if (!molecule) return;
        
        // Handle different molecule formats
        const atoms = molecule.atoms instanceof Map ? 
            Array.from(molecule.atoms.values()) : 
            (Array.isArray(molecule.atoms) ? molecule.atoms : []);
        const bonds = molecule.bonds instanceof Map ? 
            Array.from(molecule.bonds.values()) : 
            (Array.isArray(molecule.bonds) ? molecule.bonds : []);
        
        if (atoms.length === 0 && !this.previewState.previewAtom) return;
        
        const selectedAtomId = options.selectedAtomId || null;
        const showImplicitH = options.showImplicitH !== false;
        
        // Draw bonds first (behind atoms)
        bonds.forEach(bond => {
            this.drawBond(molecule, bond);
        });
        
        // Draw atoms
        atoms.forEach(atom => {
            const isSelected = atom.id === selectedAtomId;
            const isHovered = this.previewState.hoverAtom?.id === atom.id;
            this.drawAtom(atom, isSelected, isHovered, showImplicitH, molecule);
        });
        
        // Draw preview elements (on top)
        this.drawPreview();
    }
    
    drawPreview() {
        // Draw preview bond
        if (this.previewState.previewBond) {
            const bond = this.previewState.previewBond;
            const from = bond.from;
            const to = bond.to;
            
            const x1 = from.position?.x || from.x;
            const y1 = from.position?.y || from.y;
            const x2 = to.position?.x || to.x;
            const y2 = to.position?.y || to.y;
            
            this.ctx.save();
            this.ctx.strokeStyle = '#667eea';
            this.ctx.lineWidth = this.style.bondWidth + 1;
            this.ctx.setLineDash([8, 4]);
            this.ctx.lineCap = 'round';
            
            if (bond.order === 1) {
                this.drawSingleBond(x1, y1, x2, y2);
            } else if (bond.order === 2) {
                this.drawDoubleBond(x1, y1, x2, y2);
            } else if (bond.order === 3) {
                this.drawTripleBond(x1, y1, x2, y2);
            }
            
            this.ctx.restore();
        }
        
        // Draw preview atom
        if (this.previewState.previewAtom) {
            const atom = this.previewState.previewAtom;
            const x = atom.x;
            const y = atom.y;
            const element = atom.element;
            const color = this.style.atomColors[element] || '#222';
            
            this.ctx.save();
            this.ctx.globalAlpha = 0.6;
            
            // Draw ghost circle
            this.ctx.beginPath();
            this.ctx.arc(x, y, 18, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#667eea';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.stroke();
            this.ctx.fillStyle = 'rgba(102, 126, 234, 0.1)';
            this.ctx.fill();
            
            // Draw element label
            this.ctx.font = this.style.atomFont;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = color;
            this.ctx.globalAlpha = 0.8;
            this.ctx.fillText(element, Math.round(x), Math.round(y));
            
            this.ctx.restore();
        }
        
        // Draw hover highlight
        if (this.previewState.hoverAtom) {
            const atom = this.previewState.hoverAtom;
            const x = atom.position?.x || atom.x;
            const y = atom.position?.y || atom.y;
            
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(x, y, 22, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#667eea';
            this.ctx.lineWidth = 2;
            this.ctx.globalAlpha = 0.3;
            this.ctx.stroke();
            this.ctx.restore();
        }
        
        if (this.previewState.hoverBond) {
            const bond = this.previewState.hoverBond;
            const atom1 = this.getAtomFromMolecule(bond.atom1);
            const atom2 = this.getAtomFromMolecule(bond.atom2);
            if (atom1 && atom2) {
                const x1 = atom1.position?.x || atom1.x;
                const y1 = atom1.position?.y || atom1.y;
                const x2 = atom2.position?.x || atom2.x;
                const y2 = atom2.position?.y || atom2.y;
                
                this.ctx.save();
                this.ctx.strokeStyle = '#667eea';
                this.ctx.lineWidth = this.style.bondWidth + 2;
                this.ctx.globalAlpha = 0.4;
                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
                this.ctx.restore();
            }
        }
        
        if (this.previewState.chainPreview) {
            const { atoms, bonds, startAtom, startX, startY } = this.previewState.chainPreview;
            const lookup = new Map(atoms.map(atom => [atom.id, atom]));
            const getPosition = (id) => {
                if (!id || id === '__chain_start__') {
                    return { x: startX, y: startY };
                }
                if (startAtom && id === startAtom.id) {
                    const pos = startAtom.position || { x: startAtom.x, y: startAtom.y };
                    return pos;
                }
                const previewAtom = lookup.get(id);
                if (previewAtom) {
                    return previewAtom.position || { x: previewAtom.x, y: previewAtom.y };
                }
                return null;
            };
            
            this.ctx.save();
            this.ctx.strokeStyle = '#667eea';
            this.ctx.lineWidth = this.style.bondWidth;
            this.ctx.setLineDash([6, 4]);
            
            bonds.forEach(bond => {
                const p1 = getPosition(bond.atom1);
                const p2 = getPosition(bond.atom2);
                if (!p1 || !p2) return;
                this.ctx.beginPath();
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.stroke();
            });
            
            this.ctx.setLineDash([]);
            atoms.forEach(atom => {
                const pos = atom.position || { x: atom.x, y: atom.y };
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
                this.ctx.strokeStyle = '#667eea';
                this.ctx.globalAlpha = 0.8;
                this.ctx.stroke();
                this.ctx.fillStyle = 'rgba(102, 126, 234, 0.12)';
                this.ctx.fill();
                this.ctx.font = 'bold 14px Helvetica Neue, Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillStyle = this.style.atomColors[atom.element] || '#667eea';
                this.ctx.fillText(atom.element || 'C', pos.x, pos.y);
            });
            
            this.ctx.restore();
        }
    }
    
    getAtomFromMolecule(atomId) {
        // Helper to get atom from molecule (handles different molecule formats)
        if (!this._molecule) return null;
        const mol = this._molecule;
        
        if (mol.getAtom) return mol.getAtom(atomId);
        if (mol.getAtomById) return mol.getAtomById(atomId);
        if (mol.atoms instanceof Map) return mol.atoms.get(atomId);
        if (Array.isArray(mol.atoms)) return mol.atoms.find(a => a.id === atomId);
        return null;
    }

    drawBond(molecule, bond) {
        // Handle both old and new molecule formats
        const atom1 = molecule.getAtom ? molecule.getAtom(bond.atom1) : 
                     (molecule.getAtomById ? molecule.getAtomById(bond.atom1) :
                     (molecule.atoms instanceof Map ? molecule.atoms.get(bond.atom1) :
                     (Array.isArray(molecule.atoms) ? molecule.atoms.find(a => a.id === bond.atom1) : null)));
        
        const atom2 = molecule.getAtom ? molecule.getAtom(bond.atom2) :
                     (molecule.getAtomById ? molecule.getAtomById(bond.atom2) :
                     (molecule.atoms instanceof Map ? molecule.atoms.get(bond.atom2) :
                     (Array.isArray(molecule.atoms) ? molecule.atoms.find(a => a.id === bond.atom2) : null)));
        
        if (!atom1 || !atom2) return;
        
        const pos1 = atom1.position || { x: atom1.x, y: atom1.y };
        const pos2 = atom2.position || { x: atom2.x, y: atom2.y };
        const x1 = pos1.x;
        const y1 = pos1.y;
        const x2 = pos2.x;
        const y2 = pos2.y;
        
        // Trim bond to avoid overlapping with atoms
        const trimmed = this.trimBond(x1, y1, x2, y2, atom1, atom2, molecule);
        
        this.ctx.save();
        this.ctx.strokeStyle = this.style.bondColor;
        this.ctx.lineWidth = this.style.bondWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        if (bond.order === 1) {
            this.drawSingleBond(trimmed.x1, trimmed.y1, trimmed.x2, trimmed.y2);
        } else if (bond.order === 2) {
            this.drawDoubleBond(trimmed.x1, trimmed.y1, trimmed.x2, trimmed.y2);
        } else if (bond.order === 3) {
            this.drawTripleBond(trimmed.x1, trimmed.y1, trimmed.x2, trimmed.y2);
        }
        
        this.ctx.restore();
    }

    drawSingleBond(x1, y1, x2, y2) {
        this.ctx.beginPath();
        this.ctx.moveTo(Math.round(x1), Math.round(y1));
        this.ctx.lineTo(Math.round(x2), Math.round(y2));
        this.ctx.stroke();
    }

    drawDoubleBond(x1, y1, x2, y2) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const perpAngle = angle + Math.PI / 2;
        const offset = 3;
        const dx = Math.cos(perpAngle) * offset;
        const dy = Math.sin(perpAngle) * offset;
        
        this.ctx.beginPath();
        this.ctx.moveTo(Math.round(x1 + dx), Math.round(y1 + dy));
        this.ctx.lineTo(Math.round(x2 + dx), Math.round(y2 + dy));
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(Math.round(x1 - dx), Math.round(y1 - dy));
        this.ctx.lineTo(Math.round(x2 - dx), Math.round(y2 - dy));
        this.ctx.stroke();
    }

    drawTripleBond(x1, y1, x2, y2) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const perpAngle = angle + Math.PI / 2;
        const offset = 4;
        const dx = Math.cos(perpAngle) * offset;
        const dy = Math.sin(perpAngle) * offset;
        
        // Center line
        this.drawSingleBond(x1, y1, x2, y2);
        
        // Top line
        this.ctx.beginPath();
        this.ctx.moveTo(Math.round(x1 + dx), Math.round(y1 + dy));
        this.ctx.lineTo(Math.round(x2 + dx), Math.round(y2 + dy));
        this.ctx.stroke();
        
        // Bottom line
        this.ctx.beginPath();
        this.ctx.moveTo(Math.round(x1 - dx), Math.round(y1 - dy));
        this.ctx.lineTo(Math.round(x2 - dx), Math.round(y2 - dy));
        this.ctx.stroke();
    }

    drawAtom(atom, isSelected, isHovered, showImplicitH, molecule) {
        const atomPos = atom.position || { x: atom.x, y: atom.y };
        const x = atomPos.x;
        const y = atomPos.y;
        const element = getElement(atom.element);
        const symbol = element?.symbol || atom.element;
        const color = this.style.atomColors[atom.element] || '#222';
        
        // Draw selection halo
        if (isSelected) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, 20, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 180, 0, 0.2)';
            this.ctx.fill();
            this.ctx.strokeStyle = this.style.selectionColor;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        } else if (isHovered) {
            // Subtle hover highlight
            this.ctx.beginPath();
            this.ctx.arc(x, y, 20, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(102, 126, 234, 0.1)';
            this.ctx.fill();
        }
        
        // Draw atom label
        this.ctx.save();
        this.ctx.font = this.style.atomFont;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = color;
        this.ctx.fillText(symbol, Math.round(x), Math.round(y));
        this.ctx.restore();
        
        // Draw implicit hydrogens
        if (showImplicitH && atom.element === 'C') {
            const implicitH = this.calculateImplicitH(atom, molecule);
            if (implicitH > 0) {
                this.drawImplicitHydrogens(atom, molecule, implicitH);
            }
        }
    }

    calculateImplicitH(atom, molecule) {
        const bonds = this.getAtomBondsForRenderer(atom.id, molecule);
        let bondOrder = 0;
        bonds.forEach(bond => {
            bondOrder += typeof bond.order === 'number' ? bond.order : 1;
        });
        const charge = atom.charge || 0;
        const valence = 4; // Carbon default
        const implicit = Math.min(valence, valence - bondOrder - charge);
        return Math.max(0, implicit);
    }
    
    getAtomBondsForRenderer(atomId, molecule) {
        if (molecule.getAtomBonds) {
            return molecule.getAtomBonds(atomId);
        }
        
        // Fallback: search manually
        const bonds = molecule.bonds instanceof Map ? 
            Array.from(molecule.bonds.values()) : 
            (Array.isArray(molecule.bonds) ? molecule.bonds : []);
        
        return bonds.filter(b => b.atom1 === atomId || b.atom2 === atomId);
    }
    
    getAtomForRenderer(atomId, molecule) {
        if (molecule.getAtom) return molecule.getAtom(atomId);
        if (molecule.getAtomById) return molecule.getAtomById(atomId);
        if (molecule.atoms instanceof Map) return molecule.atoms.get(atomId);
        if (Array.isArray(molecule.atoms)) return molecule.atoms.find(a => a.id === atomId);
        return null;
    }

    drawImplicitHydrogens(atom, molecule, count) {
        const bonds = this.getAtomBondsForRenderer(atom.id, molecule);
        const atomPos = atom.position || { x: atom.x, y: atom.y };
        const angles = bonds.map(bond => {
            const otherId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
            const otherAtom = this.getAtomForRenderer(otherId, molecule);
            if (!otherAtom) return null;
            const otherPos = otherAtom.position || { x: otherAtom.x, y: otherAtom.y };
            return Math.atan2(
                otherPos.y - atomPos.y,
                otherPos.x - atomPos.x
            );
        }).filter(a => a !== null);
        
        // Place H in gaps
        const hAngles = this.calculateHAngles(angles, count);
        const distance = 15;
        
        this.ctx.save();
        this.ctx.font = this.style.implicitHFont;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = this.style.implicitHColor;
        
        // atomPos already declared above, reuse it
        hAngles.forEach(angle => {
            const hX = atomPos.x + Math.cos(angle) * distance;
            const hY = atomPos.y + Math.sin(angle) * distance;
            this.ctx.fillText('H', Math.round(hX), Math.round(hY));
        });
        
        this.ctx.restore();
    }

    calculateHAngles(bondAngles, hCount) {
        if (hCount === 0) return [];
        if (bondAngles.length === 0) {
            // No bonds, distribute evenly
            const angles = [];
            for (let i = 0; i < hCount; i++) {
                angles.push((Math.PI * 2 * i) / hCount);
            }
            return angles;
        }
        
        // Find gaps between bonds
        const sorted = [...bondAngles].sort((a, b) => a - b);
        const gaps = [];
        
        for (let i = 0; i < sorted.length; i++) {
            const next = (i + 1) % sorted.length;
            const start = sorted[i];
            let end = sorted[next];
            if (end <= start) end += Math.PI * 2;
            
            gaps.push({
                start,
                end,
                size: end - start,
                midpoint: start + (end - start) / 2
            });
        }
        
        gaps.sort((a, b) => b.size - a.size);
        return gaps.slice(0, hCount).map(g => g.midpoint % (Math.PI * 2));
    }

    trimBond(x1, y1, x2, y2, atom1, atom2, molecule) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return { x1, y1, x2, y2 };
        
        const trim1 = this.getAtomRadius(atom1, molecule);
        const trim2 = this.getAtomRadius(atom2, molecule);
        
        const ratio1 = Math.min(0.4, trim1 / dist);
        const ratio2 = Math.min(0.4, trim2 / dist);
        
        return {
            x1: x1 + dx * ratio1,
            y1: y1 + dy * ratio1,
            x2: x2 - dx * ratio2,
            y2: y2 - dy * ratio2
        };
    }

    getAtomRadius(atom, molecule) {
        const element = getElement(atom.element);
        const symbol = element?.symbol || atom.element;
        this.ctx.save();
        this.ctx.font = this.style.atomFont;
        const metrics = this.ctx.measureText(symbol);
        this.ctx.restore();
        return Math.max(12, metrics.width / 2 + 4);
    }

    getAtomAtPosition(x, y, molecule, threshold = 20) {
        const atoms = molecule.atoms instanceof Map ? 
            Array.from(molecule.atoms.values()) : 
            (Array.isArray(molecule.atoms) ? molecule.atoms : []);
        
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
}

window.RendererV2 = RendererV2;

