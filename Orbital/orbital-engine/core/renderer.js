// Renderer - Canvas drawing and visualization

/**
 * Style adapter that emulates MolView's visual language while allowing us to
 * drive the drawing pipeline with analytics from the current molecule.
 *
 * The adapter inspects the molecule to derive a scale-aware set of metrics
 * (font sizes, line weights, offsets) so that the renderer can focus purely on
 * geometry. This gives us MolView-like visuals without duplicating their
 * implementation details and keeps the rendering code adaptable as molecules
 * grow in size.
 */
class MolViewStyleAdapter {
    constructor() {
        this.defaults = {
            bondLength: 60,
            bondWidth: 2,
            doubleBondOffset: 4,
            tripleBondOuterOffset: 6,
            fontSize: 18,
            fontWeight: '600',
            fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
            labelPadding: 4,
            minimumBondCap: 6,
            selectionRadius: 18,
            chargeOffsetMultiplier: 0.75,
            lonePairDistance: 26,
            lonePairDotRadius: 2,
            guidelineWidth: 1,
            aromaticCircleRatio: 0.32,
            maxScale: 1.7,
            minScale: 0.55
        };
    }

    compute(molecule, canvas) {
        const metrics = { ...this.defaults };

        if (!molecule || !molecule.bonds || molecule.bonds.length === 0) {
            metrics.canvasCenter = this.getCanvasCenter(canvas);
            metrics.scale = 1;
            metrics.chargeOffset = metrics.fontSize * this.defaults.chargeOffsetMultiplier;
            metrics.chargeFontSize = Math.max(10, Math.round(metrics.fontSize * 0.7));
            metrics.aromaticCircleRadius = metrics.bondLength * this.defaults.aromaticCircleRatio;
            return metrics;
        }

        const averageBond = this.getAverageBondLength(molecule);
        const scale = this.clamp(
            averageBond / this.defaults.bondLength,
            this.defaults.minScale,
            this.defaults.maxScale
        );

        metrics.bondLength = averageBond;
        metrics.scale = scale;
        metrics.bondWidth = Math.max(1.5, this.defaults.bondWidth * scale);
        metrics.doubleBondOffset = Math.max(3, this.defaults.doubleBondOffset * scale);
        metrics.tripleBondOuterOffset = Math.max(
            metrics.doubleBondOffset + 1,
            this.defaults.tripleBondOuterOffset * scale
        );
        metrics.fontSize = Math.max(12, Math.round(this.defaults.fontSize * scale));
        metrics.fontWeight = this.defaults.fontWeight;
        metrics.fontFamily = this.defaults.fontFamily;
        metrics.labelPadding = Math.max(3, this.defaults.labelPadding * scale);
        metrics.minimumBondCap = Math.max(5, this.defaults.minimumBondCap * scale);
        metrics.selectionRadius = Math.max(16, this.defaults.selectionRadius * scale);
        metrics.chargeOffset = metrics.fontSize * this.defaults.chargeOffsetMultiplier;
        metrics.chargeFontSize = Math.max(10, Math.round(metrics.fontSize * 0.7));
        metrics.lonePairDistance = Math.max(18, this.defaults.lonePairDistance * scale);
        metrics.lonePairDotRadius = Math.max(1.5, this.defaults.lonePairDotRadius * scale);
        metrics.guidelineWidth = Math.max(0.75, this.defaults.guidelineWidth * scale);
        metrics.aromaticCircleRadius = averageBond * this.defaults.aromaticCircleRatio;
        metrics.canvasCenter = this.getCanvasCenter(canvas);

        return metrics;
    }

    getCanvasCenter(canvas) {
        return {
            x: canvas.width / 2,
            y: canvas.height / 2
        };
    }

    getAverageBondLength(molecule) {
        let total = 0;
        let count = 0;

        molecule.bonds.forEach(bond => {
            const atom1 = molecule.getAtomById(bond.atom1);
            const atom2 = molecule.getAtomById(bond.atom2);

            if (!atom1 || !atom2 || !atom1.x || !atom2.x || !atom1.y || !atom2.y) {
                return;
            }

            const dx = atom2.x - atom1.x;
            const dy = atom2.y - atom1.y;
            total += Math.hypot(dx, dy);
            count += 1;
        });

        if (count === 0) {
            return this.defaults.bondLength;
        }

        return total / count;
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
}

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();

        // Rendering options
        this.showLonePairs = true;
        this.showCharges = true;
        this.showHybridization = false;

        this.styleAdapter = new MolViewStyleAdapter();
        this.layoutEngine = new MoleculeLayoutEngine();
        this.currentStyle = this.styleAdapter.compute(null, this.canvas);
        this.atomLabelFont = `${this.currentStyle.fontWeight} ${this.currentStyle.fontSize}px ${this.currentStyle.fontFamily}`;

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight - 40; // Account for info bar
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Render the entire molecule
    render(molecule) {
        try {
            console.log('🎨 Rendering molecule:', {
                atoms: molecule.atoms.length,
                bonds: molecule.bonds.length,
                canvasSize: { width: this.canvas.width, height: this.canvas.height }
            });

            this.clear();

            if (!molecule || !molecule.atoms) {
                console.warn('⚠️ Invalid molecule data');
                return;
            }

            // Auto-layout is now optional - disabled by default
            // Enable with: renderer.layoutEngine.setEnabled(true)
            if (this.layoutEngine && this.layoutEngine.enabled) {
                this.layoutEngine.layout(molecule, this.canvas);
            }

            this.currentStyle = this.styleAdapter.compute(molecule, this.canvas);
            this.atomLabelFont = `${this.currentStyle.fontWeight} ${this.currentStyle.fontSize}px ${this.currentStyle.fontFamily}`;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.font = this.atomLabelFont;

            // Detect and draw aromatic rings
            if (molecule.detectRings) {
                this.drawAromaticRings(molecule);
            }

            // Draw bonds first (so they appear behind atoms)
            if (molecule.bonds && Array.isArray(molecule.bonds)) {
                molecule.bonds.forEach(bond => {
                    try {
                        this.drawBond(bond, molecule);
                    } catch (e) {
                        console.error('Error drawing bond:', e);
                    }
                });
            }

            // Draw atoms
            if (molecule.atoms && Array.isArray(molecule.atoms)) {
                molecule.atoms.forEach(atom => {
                    try {
                        this.drawAtom(atom, molecule.selectedAtom === atom);

                        if (this.showLonePairs && molecule.getAtomBonds) {
                            this.drawLonePairs(atom, molecule);
                        }

                        if (this.showCharges && Math.abs(atom.charge) > 0.1) {
                            this.drawCharge(atom);
                        }

                        if (this.showHybridization && atom.hybridization) {
                            this.drawHybridization(atom, molecule);
                        }
                    } catch (e) {
                        console.error('Error drawing atom:', e);
                    }
                });
            }

            console.log('✓ Render complete');
        } catch (error) {
            console.error('🔥 Critical render error:', error);
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = '16px Arial';
            this.ctx.fillText('Rendering error - check console', 10, 30);
        }
    }

    // Draw aromatic ring indicators
    drawAromaticRings(molecule) {
        if (!molecule.detectRings) return;

        const rings = molecule.detectRings();

        rings.forEach(ring => {
            // Check if ring is aromatic
            if (ring.length === 6 && isAromatic(ring, molecule)) {
                // Calculate center of ring
                let centerX = 0, centerY = 0;
                ring.forEach(atomId => {
                    const atom = molecule.getAtomById(atomId);
                    centerX += atom.position.x;
                    centerY += atom.position.y;
                });
                centerX /= ring.length;
                centerY /= ring.length;

                // Draw circle in the center to indicate aromaticity
                this.ctx.beginPath();
                const radius = this.currentStyle.aromaticCircleRadius || 18;
                this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                this.ctx.strokeStyle = 'rgba(255, 107, 107, 0.75)';
                this.ctx.lineWidth = this.currentStyle.bondWidth;
                this.ctx.setLineDash([6, 6]);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
        });
    }

    // Draw an atom
    drawAtom(atom, isSelected) {
        const element = getElement(atom.element) || { symbol: atom.element, color: '#222' };
        const x = atom.position.x;
        const y = atom.position.y;
        const label = element.symbol || atom.element;

        const radius = this.getAtomLabelRadius(label);

        if (atom.valenceValid === false) {
            this.drawSelectionHalo(x, y, radius, 'rgba(230, 57, 70, 0.18)', '#E63946');
        } else if (isSelected) {
            this.drawSelectionHalo(x, y, radius, 'rgba(255, 215, 0, 0.2)', '#FFB400');
        }

        const previousFont = this.ctx.font;
        this.ctx.font = this.atomLabelFont;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = element.color || '#222';
        this.ctx.fillText(label, x, y);
        this.ctx.font = previousFont;
    }

    drawSelectionHalo(x, y, radius, fillStyle, strokeStyle) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, Math.max(radius, this.currentStyle.selectionRadius), 0, Math.PI * 2);
        this.ctx.fillStyle = fillStyle;
        this.ctx.fill();
        this.ctx.lineWidth = this.currentStyle.guidelineWidth;
        this.ctx.strokeStyle = strokeStyle;
        this.ctx.stroke();
    }

    // Draw a bond between two atoms
    drawBond(bond, molecule) {
        const atom1 = molecule.getAtomById(bond.atom1);
        const atom2 = molecule.getAtomById(bond.atom2);

        if (!atom1 || !atom2) return;

        const { start, end } = this.getTrimmedBondCoordinates(atom1, atom2);
        const x1 = start.x;
        const y1 = start.y;
        const x2 = end.x;
        const y2 = end.y;

        // Calculate bond angle
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const perpAngle = angle + Math.PI / 2;

        // Check if both atoms are carbons - if so, use skeletal notation
        const isSkeletal = atom1.element === 'C' && atom2.element === 'C';

        // Draw based on bond order
        if (bond.order === 1) {
            this.drawSingleBond(x1, y1, x2, y2, bond, isSkeletal);
        } else if (bond.order === 2) {
            this.drawDoubleBond(x1, y1, x2, y2, perpAngle, bond, molecule, atom1, atom2);
        } else if (bond.order === 3) {
            this.drawTripleBond(x1, y1, x2, y2, perpAngle, bond);
        }
    }

    drawSingleBond(x1, y1, x2, y2, bond, isSkeletal = false) {
        const color = this.getBondColor(bond);
        
        // For skeletal notation, draw with consistent line style
        if (isSkeletal) {
            this.ctx.save();
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = this.currentStyle.bondWidth;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
            this.ctx.restore();
        } else {
            this.drawStyledLine(x1, y1, x2, y2, this.currentStyle.bondWidth, color);
        }
    }

    drawDoubleBond(x1, y1, x2, y2, perpAngle, bond, molecule, atom1, atom2) {
        const offset = this.currentStyle.doubleBondOffset;
        const dx = Math.cos(perpAngle) * offset;
        const dy = Math.sin(perpAngle) * offset;
        const color = this.getBondColor(bond);

        const orientation = this.getDoubleBondOrientation(atom1, atom2, molecule, perpAngle);

        if (orientation === 0) {
            this.drawStyledLine(x1 + dx, y1 + dy, x2 + dx, y2 + dy, this.currentStyle.bondWidth, color);
            this.drawStyledLine(x1 - dx, y1 - dy, x2 - dx, y2 - dy, this.currentStyle.bondWidth, color);
        } else {
            const skewX = dx * orientation;
            const skewY = dy * orientation;
            this.drawStyledLine(x1, y1, x2, y2, this.currentStyle.bondWidth, color);
            this.drawStyledLine(
                x1 + skewX,
                y1 + skewY,
                x2 + skewX,
                y2 + skewY,
                this.currentStyle.bondWidth,
                color
            );
        }
    }

    drawTripleBond(x1, y1, x2, y2, perpAngle, bond) {
        const offset = this.currentStyle.tripleBondOuterOffset;
        const dx = Math.cos(perpAngle) * offset;
        const dy = Math.sin(perpAngle) * offset;
        const color = this.getBondColor(bond);

        this.drawStyledLine(x1, y1, x2, y2, this.currentStyle.bondWidth, color);
        this.drawStyledLine(x1 + dx, y1 + dy, x2 + dx, y2 + dy, this.currentStyle.bondWidth, color);
        this.drawStyledLine(x1 - dx, y1 - dy, x2 - dx, y2 - dy, this.currentStyle.bondWidth, color);
    }

    drawStyledLine(x1, y1, x2, y2, width, color) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.lineWidth = width;
        this.ctx.strokeStyle = color;
        this.ctx.stroke();
    }

    // Get bond color based on polarity
    getBondColor(bond) {
        if (!bond.polarity) return '#222';

        const delta = bond.polarity.delta;
        if (delta < 0.5) return '#222'; // Nonpolar - near-black
        if (delta < 1.7) return '#444'; // Polar - medium gray
        return '#666'; // Ionic - lighter gray
    }

    getTrimmedBondCoordinates(atom1, atom2) {
        const x1 = atom1.position.x;
        const y1 = atom1.position.y;
        const x2 = atom2.position.x;
        const y2 = atom2.position.y;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.hypot(dx, dy);

        if (distance === 0) {
            return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
        }

        const trim1 = this.getAtomTrimDistance(atom1);
        const trim2 = this.getAtomTrimDistance(atom2);

        const ratio1 = trim1 / distance;
        const ratio2 = trim2 / distance;

        return {
            start: {
                x: x1 + dx * ratio1,
                y: y1 + dy * ratio1
            },
            end: {
                x: x2 - dx * ratio2,
                y: y2 - dy * ratio2
            }
        };
    }

    getAtomTrimDistance(atom) {
        const element = getElement(atom.element) || { symbol: atom.element };
        return this.getAtomLabelRadius(element.symbol || atom.element) + this.currentStyle.labelPadding;
    }

    getAtomLabelRadius(label) {
        const previousFont = this.ctx.font;
        this.ctx.font = this.atomLabelFont;
        const metrics = this.ctx.measureText(label);
        const width = metrics.width;
        const height = this.currentStyle.fontSize;
        this.ctx.font = previousFont;

        const halfWidth = width / 2;
        const halfHeight = height * 0.6; // approximate visual height for uppercase glyphs
        const radius = Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight);
        return Math.max(this.currentStyle.minimumBondCap, radius);
    }

    getDoubleBondOrientation(atom1, atom2, molecule, perpAngle) {
        const bonds1 = molecule
            .getAtomBonds(atom1.id)
            .filter(b => !(b.atom1 === atom2.id || b.atom2 === atom2.id));
        const bonds2 = molecule
            .getAtomBonds(atom2.id)
            .filter(b => !(b.atom1 === atom1.id || b.atom2 === atom1.id));

        if (bonds1.length === 0 && bonds2.length === 0) {
            return 0;
        }

        const normal = { x: Math.cos(perpAngle), y: Math.sin(perpAngle) };
        const occupancy =
            this.getSideOccupancy(atom1, bonds1, molecule, normal) +
            this.getSideOccupancy(atom2, bonds2, molecule, normal);

        if (Math.abs(occupancy) < 0.01) {
            return 0;
        }

        return occupancy > 0 ? -1 : 1;
    }

    getSideOccupancy(atom, bonds, molecule, normal) {
        if (!bonds || bonds.length === 0) {
            return 0;
        }

        let total = 0;
        bonds.forEach(bond => {
            const otherId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
            const other = molecule.getAtomById(otherId);
            if (!other) return;

            const dx = other.position.x - atom.position.x;
            const dy = other.position.y - atom.position.y;
            total += dx * normal.x + dy * normal.y;
        });

        return total / bonds.length;
    }

    // Draw lone pairs on an atom
    drawLonePairs(atom, molecule) {
        const element = getElement(atom.element);
        if (!element) return;

        const lonePairCount = element.lonePairs;

        if (lonePairCount === 0) return;

        // Calculate positions for lone pairs
        const bonds = molecule.getAtomBonds(atom.id);
        const baseRadius = this.currentStyle.lonePairDistance;

        // Get bond angles with proper sorting
        const bondAngles = bonds
            .map(bond => {
                const otherAtomId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
                const otherAtom = molecule.getAtomById(otherAtomId);
                return Math.atan2(
                    otherAtom.position.y - atom.position.y,
                    otherAtom.position.x - atom.position.x
                );
            })
            .sort((a, b) => a - b);

        // Calculate ideal positions based on hybridization
        const hybridization = atom.hybridization;
        const totalElectronDomains = bondAngles.length + lonePairCount;

        // Find optimal angles for lone pairs (avoid bond angles)
        const lonePairAngles = this.calculateLonePairAngles(
            bondAngles,
            lonePairCount,
            hybridization,
            totalElectronDomains
        );

        // Draw lone pairs at calculated positions
        lonePairAngles.forEach(angle => {
            const x = atom.position.x + Math.cos(angle) * baseRadius;
            const y = atom.position.y + Math.sin(angle) * baseRadius;

            // Draw two dots for each lone pair
            const offset = this.currentStyle.lonePairDotRadius * 1.8;
            this.ctx.fillStyle = '#A61F24';
            this.ctx.beginPath();
            this.ctx.arc(x - offset, y, this.currentStyle.lonePairDotRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.arc(x + offset, y, this.currentStyle.lonePairDotRadius, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    // Calculate optimal angles for lone pairs based on VSEPR theory
    calculateLonePairAngles(bondAngles, lonePairCount, hybridization, totalDomains) {
        const lonePairAngles = [];

        if (bondAngles.length === 0) {
            // No bonds - distribute lone pairs evenly
            for (let i = 0; i < lonePairCount; i++) {
                lonePairAngles.push((Math.PI * 2 * i) / lonePairCount);
            }
            return lonePairAngles;
        }

        // Calculate angular gaps between consecutive bonds
        const sortedAngles = [...bondAngles].sort((a, b) => a - b);
        const gaps = [];

        for (let i = 0; i < sortedAngles.length; i++) {
            const nextIndex = (i + 1) % sortedAngles.length;
            const startAngle = sortedAngles[i];
            let endAngle = sortedAngles[nextIndex];

            // Handle wrap-around
            if (endAngle <= startAngle) {
                endAngle += Math.PI * 2;
            }

            const gapSize = endAngle - startAngle;
            const midpoint = startAngle + gapSize / 2;

            gaps.push({
                startAngle: startAngle,
                endAngle: endAngle,
                size: gapSize,
                midpoint: midpoint
            });
        }

        // Add the wrap-around gap if needed
        if (sortedAngles.length > 0) {
            const lastAngle = sortedAngles[sortedAngles.length - 1];
            const firstAngle = sortedAngles[0];
            const wrapGapSize = Math.PI * 2 - (lastAngle - firstAngle);

            if (wrapGapSize > 0.1) {
                const wrapMidpoint = lastAngle + wrapGapSize / 2;
                gaps.push({
                    startAngle: lastAngle,
                    endAngle: firstAngle + Math.PI * 2,
                    size: wrapGapSize,
                    midpoint: wrapMidpoint
                });
            }
        }

        // Sort gaps by size (largest first) to place lone pairs optimally
        gaps.sort((a, b) => b.size - a.size);

        // Distribute lone pairs in the largest gaps
        for (let i = 0; i < lonePairCount && i < gaps.length; i++) {
            let angle = gaps[i].midpoint;

            // Normalize angle to 0-2π range
            while (angle >= Math.PI * 2) angle -= Math.PI * 2;
            while (angle < 0) angle += Math.PI * 2;

            lonePairAngles.push(angle);
        }

        return lonePairAngles;
    }

    // Draw partial charge
    drawCharge(atom) {
        const sign = atom.charge > 0 ? 'δ+' : 'δ-';
        const x = atom.position.x + this.currentStyle.chargeOffset;
        const y = atom.position.y - this.currentStyle.chargeOffset;

        this.ctx.fillStyle = atom.charge > 0 ? '#0066FF' : '#A61F24';
        const previousFont = this.ctx.font;
        this.ctx.font = `italic ${this.currentStyle.chargeFontSize}px ${this.currentStyle.fontFamily}`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(sign, x, y);
        this.ctx.font = previousFont;
    }

    // Draw hybridization label
    drawHybridization(atom, molecule) {
        const x = atom.position.x;
        const y = atom.position.y + 25;

        // Draw hybridization type
        this.ctx.fillStyle = '#666';
        const previousFont = this.ctx.font;
        this.ctx.font = `normal ${Math.max(10, Math.round(this.currentStyle.fontSize * 0.6))}px ${this.currentStyle.fontFamily}`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(atom.hybridization, x, y);

        // Draw bond angles if atom has multiple bonds
        const angles = molecule.getAtomBondAngles(atom.id);
        if (angles.length > 0) {
            const idealAngle = getIdealBondAngle(atom.hybridization);

            // Draw ideal angle reference
            this.ctx.fillStyle = '#999';
            this.ctx.font = `normal ${Math.max(8, Math.round(this.currentStyle.fontSize * 0.45))}px ${this.currentStyle.fontFamily}`;
            this.ctx.fillText(`(${idealAngle.toFixed(1)}°)`, x, y + 10);

            // Optionally draw actual angles on bonds
            angles.forEach(angleData => {
                const atom1 = molecule.getAtomById(angleData.atom1);
                const atom2 = molecule.getAtomById(angleData.atom2);

                // Calculate midpoint between the two bonds
                const midX = (atom1.position.x + atom2.position.x) / 2;
                const midY = (atom1.position.y + atom2.position.y) / 2;

                // Offset slightly towards center
                const dx = (x - midX) * 0.7;
                const dy = (y - midY) * 0.7;

                this.ctx.fillStyle = '#007bff';
                this.ctx.font = `bold ${Math.max(9, Math.round(this.currentStyle.fontSize * 0.55))}px ${this.currentStyle.fontFamily}`;
                this.ctx.fillText(`${angleData.angle.toFixed(1)}°`, midX + dx, midY + dy);
            });
        }

        this.ctx.font = previousFont;
    }

    // Get contrasting text color (retained for potential future use)
    getTextColor(bgColor) {
        const color = bgColor.replace('#', '');
        const r = parseInt(color.substr(0, 2), 16);
        const g = parseInt(color.substr(2, 2), 16);
        const b = parseInt(color.substr(4, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        return brightness > 128 ? '#000' : '#FFF';
    }

    // Draw temporary bond during creation
    drawTempBond(x1, y1, x2, y2) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.strokeStyle = 'rgba(34, 34, 34, 0.45)';
        this.ctx.lineWidth = this.currentStyle.bondWidth;
        this.ctx.setLineDash([6, 6]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
}
