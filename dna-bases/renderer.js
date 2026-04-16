// DNA Base Renderer — Clean skeletal formula style
// Inspired by Orbital app RendererV2 patterns

class BaseRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.hoveredAtom = null;
        this.theme = 'dark'; // 'dark' or 'light'
        this.rotation = 0; // radians
        this.resize();
        this._resizeHandler = () => this.resize();
        window.addEventListener('resize', this._resizeHandler);
    }

    get colors() {
        const isDark = this.theme === 'dark';
        return {
            bg: isDark ? '#070a0f' : '#f8fafc',
            bondColor: isDark ? '#cbd5e1' : '#1e293b',
            bondWidth: 2.8,
            doubleBondOffset: 5.5,
            atomColors: {
                'N': isDark ? '#60a5fa' : '#2563eb',
                'O': isDark ? '#f87171' : '#dc2626',
                'C': isDark ? '#94a3b8' : '#64748b',
                'H': isDark ? '#94a3b8' : '#64748b',
                'NH₂': isDark ? '#60a5fa' : '#2563eb',
                'CH₃': isDark ? '#94a3b8' : '#64748b',
            },
            atomFont: 'bold 18px "Inter", "Helvetica Neue", sans-serif',
            groupFont: 'bold 15px "Inter", "Helvetica Neue", sans-serif',
            hFont: '14px "Inter", "Helvetica Neue", sans-serif',
            numberFont: '500 10px "Inter", sans-serif',
            numberColor: isDark ? 'rgba(148,163,184,0.45)' : 'rgba(71,85,105,0.45)',
            donorColor: '#f59e0b',
            donorGlow: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.14)',
            acceptorColor: '#06b6d4',
            acceptorGlow: isDark ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.14)',
            hoverRing: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
            lonePairColor: isDark ? 'rgba(96,165,250,0.55)' : 'rgba(37,99,235,0.5)',
            lonePairO: isDark ? 'rgba(248,113,113,0.55)' : 'rgba(220,38,38,0.5)',
        };
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.logicalWidth = rect.width;
        this.logicalHeight = rect.height;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    }

    // Auto-center and scale molecule to fit canvas
    getTransform(base) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const a of base.atoms) {
            minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x);
            minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
        }
        const molW = maxX - minX || 1;
        const molH = maxY - minY || 1;
        const cx = minX + molW / 2;
        const cy = minY + molH / 2;
        const pad = 70;
        const scale = Math.min(
            (this.logicalWidth - pad * 2) / molW,
            (this.logicalHeight - pad * 2) / molH,
            2.2
        );
        return {
            dx: this.logicalWidth / 2 - cx * scale,
            dy: this.logicalHeight / 2 - cy * scale,
            scale
        };
    }

    tx(x, t) { return x * t.scale + t.dx; }
    ty(y, t) { return y * t.scale + t.dy; }

    // Rotate all atom positions around molecule center
    _rotatedBase(base) {
        return this._rotateBase(base, this.rotation);
    }

    _rotateBase(base, angle, mirror = false) {
        if (!angle && !mirror) return base;
        const cos = Math.cos(angle || 0), sin = Math.sin(angle || 0);
        // Find center
        let cx = 0, cy = 0;
        for (const a of base.atoms) { cx += a.x; cy += a.y; }
        cx /= base.atoms.length; cy /= base.atoms.length;
        return {
            ...base,
            atoms: base.atoms.map(a => {
                let mx = a.x, my = a.y;
                if (mirror) {
                    mx = cx - (a.x - cx); // Horizontal flip across centroid
                }
                return {
                    ...a,
                    x: cx + (mx - cx) * cos - (my - cy) * sin,
                    y: cy + (mx - cx) * sin + (my - cy) * cos,
                };
            })
        };
    }

    _basePalette(base) {
        const key = (base && base.letter || '').toUpperCase();
        const isDark = this.theme === 'dark';
        const palettes = {
            A: {
                aura: isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 132, 199, 0.16)',
                ring: isDark ? 'rgba(56, 189, 248, 0.48)' : 'rgba(2, 132, 199, 0.36)',
                chipBg: isDark ? 'rgba(8, 47, 73, 0.84)' : 'rgba(224, 242, 254, 0.9)',
                chipFg: isDark ? '#d7f0ff' : '#0c4a6e',
            },
            T: {
                aura: isDark ? 'rgba(251, 146, 60, 0.2)' : 'rgba(234, 88, 12, 0.14)',
                ring: isDark ? 'rgba(251, 146, 60, 0.5)' : 'rgba(234, 88, 12, 0.32)',
                chipBg: isDark ? 'rgba(67, 20, 7, 0.84)' : 'rgba(255, 237, 213, 0.9)',
                chipFg: isDark ? '#ffe8d1' : '#7c2d12',
            },
            G: {
                aura: isDark ? 'rgba(52, 211, 153, 0.18)' : 'rgba(5, 150, 105, 0.14)',
                ring: isDark ? 'rgba(52, 211, 153, 0.46)' : 'rgba(5, 150, 105, 0.32)',
                chipBg: isDark ? 'rgba(6, 46, 32, 0.84)' : 'rgba(209, 250, 229, 0.9)',
                chipFg: isDark ? '#dafce9' : '#064e3b',
            },
            C: {
                aura: isDark ? 'rgba(192, 132, 252, 0.2)' : 'rgba(147, 51, 234, 0.13)',
                ring: isDark ? 'rgba(192, 132, 252, 0.48)' : 'rgba(147, 51, 234, 0.3)',
                chipBg: isDark ? 'rgba(46, 16, 101, 0.82)' : 'rgba(243, 232, 255, 0.9)',
                chipFg: isDark ? '#f4e8ff' : '#581c87',
            },
        };
        return palettes[key] || palettes.A;
    }

    _drawPairAura(base, t, palette) {
        const b = this._baseBounds(base);
        const cx = this.tx(b.cx, t);
        const cy = this.ty(b.cy, t);
        const rx = (b.width * t.scale) / 2 + 32 * t.scale;
        const ry = (b.height * t.scale) / 2 + 24 * t.scale;
        const ctx = this.ctx;

        ctx.save();
        const g = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.2, cx, cy, Math.max(rx, ry));
        g.addColorStop(0, palette.aura);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = palette.ring;
        ctx.lineWidth = Math.max(1.2, 1.8 * t.scale);
        ctx.setLineDash([8, 7]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx - 10 * t.scale, ry - 8 * t.scale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    _drawPairLabel(base, t, palette) {
        const b = this._baseBounds(base);
        const cx = this.tx(b.cx, t);
        const topY = this.ty(b.minY, t) - 18 * t.scale;
            const text = `${base.letter} - ${base.name}`;
        const ctx = this.ctx;

        ctx.save();
        ctx.font = '600 12px Inter, sans-serif';
        const w = ctx.measureText(text).width + 16;
        const h = 22;
        ctx.fillStyle = palette.chipBg;
        ctx.strokeStyle = palette.ring;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cx - w / 2, topY - h / 2, w, h, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = palette.chipFg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, topY + 0.5);
        ctx.restore();
    }

    _baseBounds(base) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const a of base.atoms) {
            minX = Math.min(minX, a.x);
            maxX = Math.max(maxX, a.x);
            minY = Math.min(minY, a.y);
            maxY = Math.max(maxY, a.y);
        }
        return {
            minX,
            maxX,
            minY,
            maxY,
            width: Math.max(maxX - minX, 1),
            height: Math.max(maxY - minY, 1),
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2,
        };
    }

    _mirrorBase(base) {
        const b = this._baseBounds(base);
        return {
            ...base,
            atoms: base.atoms.map((a) => ({
                ...a,
                x: b.cx - (a.x - b.cx),
            })),
        };
    }

    _drawBaseWithTransform(base, t, opts = {}, hoveredAtom = null) {
        const c = this.colors;
        const ctx = this.ctx;
        const atomMap = new Map(base.atoms.map(a => [a.id, a]));

        const showHbond = opts.showHbond !== false;
        const showNum = opts.showNumbering !== false;
        const showLP = opts.showLonePairs === true;
        const showSugarBond = opts.showSugarBond === true;

        const hbMap = new Map();
        if (base.hbondSites) base.hbondSites.forEach(s => hbMap.set(s.atomId, s));

        for (const bond of base.bonds) {
            const a1 = atomMap.get(bond.from);
            const a2 = atomMap.get(bond.to);
            if (!a1 || !a2) continue;
            this._drawBond(
                this.tx(a1.x, t), this.ty(a1.y, t),
                this.tx(a2.x, t), this.ty(a2.y, t),
                bond.order, t.scale, a1, a2, c, base, t
            );
        }

        if (showSugarBond && base.sugarAttachment) {
            const atom = atomMap.get(base.sugarAttachment.atomId);
            if (atom) {
                this._drawSugarBond(atom, base, atomMap, t, c);
            }
        }

        if (showHbond) {
            for (const [aid, site] of hbMap) {
                const a = atomMap.get(aid);
                if (!a) continue;
                this._drawHbondRing(this.tx(a.x, t), this.ty(a.y, t), site.type, t.scale, c);
            }
        }

        for (const atom of base.atoms) {
            this._drawAtom(atom, this.tx(atom.x, t), this.ty(atom.y, t), t.scale, c);
        }

        if (showNum) {
            for (const atom of base.atoms) {
                if (atom.ringNum == null) continue;
                this._drawNumber(atom.ringNum, this.tx(atom.x, t), this.ty(atom.y, t), t.scale, c);
            }
        }

        if (showLP) {
            for (const atom of base.atoms) {
                if (atom.element !== 'N' && atom.element !== 'O' && atom.element !== 'NH') continue;
                this._drawLonePairs(atom, base, atomMap, t, c);
            }
        }

        if (showHbond) {
            for (const [aid, site] of hbMap) {
                const a = atomMap.get(aid);
                if (!a) continue;
                this._drawHbondTag(this.tx(a.x, t), this.ty(a.y, t), site.type, t.scale, c);
            }
        }

        if (hoveredAtom) {
            const hx = this.tx(hoveredAtom.x, t);
            const hy = this.ty(hoveredAtom.y, t);
            ctx.save();
            ctx.beginPath();
            ctx.arc(hx, hy, 22 * t.scale, 0, Math.PI * 2);
            ctx.strokeStyle = c.hoverRing;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }

        return atomMap;
    }

    render(base, opts = {}) {
        this.resize();
        this.clear();
        if (!base) return;

        base = this._rotatedBase(base);
        const t = this.getTransform(base);
        this._drawBaseWithTransform(base, t, opts, this.hoveredAtom);
    }

    renderPairing(baseA, baseB, opts = {}) {
        this.resize();
        this.clear();
        if (!baseA || !baseB) return;

        const approach = Math.max(0, Math.min(opts.approachProgress ?? 1, 1));
        const bondProgress = Math.max(0, Math.min(opts.bondProgress ?? 1, 1));
        const pairMap = opts.pairMap || [];
        const primaryRotation = opts.primaryRotation ?? this.rotation;
        const partnerRotation = opts.partnerRotation ?? this.rotation;

        const rbA = this._rotateBase(baseA, primaryRotation);
        const rbB = this._rotateBase(baseB, partnerRotation, opts.partnerMirror || false);
        const aBounds = this._baseBounds(rbA);
        const bBounds = this._baseBounds(rbB);
        const paletteA = this._basePalette(baseA);
        const paletteB = this._basePalette(baseB);

        let nx = -1, ny = 0; // Default facing left

        if (pairMap.length >= 2) {
            let faceAx = 0, faceAy = 0;
            pairMap.forEach(p => {
                const a = rbA.atoms.find(at => at.id === p.from);
                if (a) { faceAx += a.x; faceAy += a.y; }
            });
            faceAx /= pairMap.length; faceAy /= pairMap.length;

            let centroidAx = 0, centroidAy = 0;
            rbA.atoms.forEach(a => { centroidAx += a.x; centroidAy += a.y; });
            centroidAx /= rbA.atoms.length; centroidAy /= rbA.atoms.length;

            nx = faceAx - centroidAx;
            ny = faceAy - centroidAy;
            let len = Math.hypot(nx, ny);
            if (len > 0) { nx /= len; ny /= len; }
        }

        const finalGap = 92;
        const startGap = 300;
        const gap = startGap - (startGap - finalGap) * approach;

        let spanAx = Math.abs(nx * aBounds.width) + Math.abs(ny * aBounds.height);
        let spanBx = Math.abs(nx * bBounds.width) + Math.abs(ny * bBounds.height);
        const dist = (spanAx + spanBx) / 2 + gap;

        const minX = Math.min(-dist/2 * nx - aBounds.width/2, dist/2 * nx - bBounds.width/2);
        const maxX = Math.max(-dist/2 * nx + aBounds.width/2, dist/2 * nx + bBounds.width/2);
        const minY = Math.min(-dist/2 * ny - aBounds.height/2, dist/2 * ny - bBounds.height/2);
        const maxY = Math.max(-dist/2 * ny + aBounds.height/2, dist/2 * ny + bBounds.height/2);

        const pad = 56;
        const scale = Math.min(
            (this.logicalWidth - pad * 2) / Math.max(maxX - minX, 1),
            (this.logicalHeight - pad * 2) / Math.max(maxY - minY, 1),
            2.2
        );

        const centerX = this.logicalWidth / 2;
        const centerY = this.logicalHeight / 2;
        
        const targetAx = centerX - (dist/2 * nx) * scale;
        const targetAy = centerY - (dist/2 * ny) * scale;
        const targetBx = centerX + (dist/2 * nx) * scale;
        const targetBy = centerY + (dist/2 * ny) * scale;

        const tA = {
            scale,
            dx: targetAx - aBounds.cx * scale,
            dy: targetAy - aBounds.cy * scale,
        };

        const tB = {
            scale,
            dx: targetBx - bBounds.cx * scale,
            dy: targetBy - bBounds.cy * scale,
        };

        this._drawPairAura(rbA, tA, paletteA);
        this._drawPairAura(rbB, tB, paletteB);

        const mapA = this._drawBaseWithTransform(rbA, tA, opts, null);
        const mapB = this._drawBaseWithTransform(rbB, tB, opts, null);
        this._drawPairLabel(rbA, tA, paletteA);
        this._drawPairLabel(rbB, tB, paletteB);

        if (pairMap.length > 0 && (approach > 0.35 || bondProgress > 0)) {
            const c = this.colors;
            const ctx = this.ctx;
            ctx.save();
            ctx.lineDashOffset = -performance.now() / 70;

            for (const pair of pairMap) {
                const a = mapA.get(pair.from);
                const b = mapB.get(pair.to);
                if (!a || !b) continue;

                let x1 = this.tx(a.x, tA);
                let y1 = this.ty(a.y, tA);
                let x2 = this.tx(b.x, tB);
                let y2 = this.ty(b.y, tB);

                // Trim the hydrogen bond so it doesn't overlap the atoms
                const dx = x2 - x1;
                const dy = y2 - y1;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    const r1 = this._labelRadius(a, scale) + 6 * scale;
                    const r2 = this._labelRadius(b, scale) + 6 * scale;
                    if (dist > r1 + r2) {
                        x1 += (dx / dist) * r1;
                        y1 += (dy / dist) * r1;
                        x2 -= (dx / dist) * r2;
                        y2 -= (dy / dist) * r2;
                    }
                }

                const xDraw = x1 + (x2 - x1) * bondProgress;
                const yDraw = y1 + (y2 - y1) * bondProgress;

                const isDonor = pair.type === 'donor';
                ctx.strokeStyle = isDonor ? c.donorColor : c.acceptorColor;
                ctx.lineWidth = Math.max(2.1, 2.8 * scale);
                ctx.setLineDash(isDonor ? [10, 5] : [4, 7]);
                ctx.globalAlpha = 0.92;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(xDraw, yDraw);
                ctx.stroke();

                 ctx.globalAlpha = 0.95;
                ctx.fillStyle = isDonor ? c.donorColor : c.acceptorColor;
                ctx.beginPath();
                ctx.arc(x1, y1, 2.8 * scale, 0, Math.PI * 2);
                ctx.fill();

                if (bondProgress >= 1) {
                    ctx.globalAlpha = 0.25;
                    ctx.beginPath();
                    ctx.arc((x1 + x2) / 2, (y1 + y2) / 2, 10 * scale, 0, Math.PI * 2);
                    ctx.fillStyle = isDonor ? c.donorGlow : c.acceptorGlow;
                    ctx.fill();
                }
            }
            ctx.restore();
        }
    }

    // ——— Bond drawing ———
    _drawBond(x1, y1, x2, y2, order, scale, a1, a2, c, base, t) {
        const ctx = this.ctx;
        const dx = x2 - x1, dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return;
        const ux = dx / dist, uy = dy / dist;

        // Trim toward heteroatoms (N, O) and groups to avoid overlap
        const trim1 = this._labelRadius(a1, scale);
        const trim2 = this._labelRadius(a2, scale);
        const tx1 = x1 + ux * trim1, ty1 = y1 + uy * trim1;
        const tx2 = x2 - ux * trim2, ty2 = y2 - uy * trim2;

        ctx.save();
        ctx.strokeStyle = c.bondColor;
        ctx.lineWidth = c.bondWidth * Math.min(scale, 1.3);
        ctx.lineCap = 'round';

        if (order === 1) {
            ctx.beginPath();
            ctx.moveTo(tx1, ty1);
            ctx.lineTo(tx2, ty2);
            ctx.stroke();
        } else if (order === 2) {
            // Determine side for the double bond inner line
            // If one atom is not in a ring (e.g. exocyclic O), draw the second line symmetrically or offset
            const inRing1 = a1.ringNum != null;
            const inRing2 = a2.ringNum != null;
            
            let px = -uy * c.doubleBondOffset * scale;
            let py = ux * c.doubleBondOffset * scale;

            if (inRing1 && inRing2 && base) {
                // Find ring center
                let rcx = 0, rcy = 0, count = 0;
                for (const a of base.atoms) {
                    if (a.ringNum != null) {
                        rcx += this.tx(a.x, t);
                        rcy += this.ty(a.y, t);
                        count++;
                    }
                }
                rcx /= count; rcy /= count;
                
                // Vector to center
                const midX = (tx1 + tx2) / 2, midY = (ty1 + ty2) / 2;
                const toCx = rcx - midX, toCy = rcy - midY;
                
                // Dot product with normal
                const dot = px * toCx + py * toCy;
                if (dot < 0) {
                    px = -px; py = -py;
                }
                
                // Draw main line (on the actual bond path)
                ctx.beginPath();
                ctx.moveTo(tx1, ty1);
                ctx.lineTo(tx2, ty2);
                ctx.stroke();
                
                const innerPad1 = (a1.element === 'C' ? 6 : 4) * scale;
                const innerPad2 = (a2.element === 'C' ? 6 : 4) * scale;
                
                // Draw inner line (slightly shorter)
                ctx.beginPath();
                ctx.moveTo(tx1 + ux * innerPad1 + px, ty1 + uy * innerPad1 + py);
                ctx.lineTo(tx2 - ux * innerPad2 + px, ty2 - uy * innerPad2 + py);
                ctx.stroke();
            } else if (inRing1 || inRing2) {
                // Exocyclic double bond connects to a ring atom (e.g. C=O)
                // Both lines symmetric is often preferred, but let's make it look clean
                let pad1 = (a1.ringNum != null && a1.element === 'C') ? 2 * scale : 0;
                let pad2 = (a2.ringNum != null && a2.element === 'C') ? 2 * scale : 0;
                
                ctx.beginPath();
                ctx.moveTo(tx1 + ux * pad1 + px, ty1 + uy * pad1 + py);
                ctx.lineTo(tx2 - ux * pad2 + px, ty2 - uy * pad2 + py);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(tx1 + ux * pad1 - px, ty1 + uy * pad1 - py);
                ctx.lineTo(tx2 - ux * pad2 - px, ty2 - uy * pad2 - py);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(tx1 + px, ty1 + py);
                ctx.lineTo(tx2 + px, ty2 + py);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(tx1 - px, ty1 - py);
                ctx.lineTo(tx2 - px, ty2 - py);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    _labelRadius(atom, scale) {
        const el = atom.element;
        if (el === 'C') return 0; // Skeletal vertex needs 0 trim
        if (el === 'H') return 5 * scale;
        if (el === 'NH₂' || el === 'CH₃') return 10 * scale;
        if (el === 'NH') return 8 * scale;
        // Single heteroatoms (N, O)
        return 7 * scale;
    }

    // ——— Atom label ———
    _drawAtom(atom, x, y, scale, c) {
        const ctx = this.ctx;
        const el = atom.element;

        // Skeletal: don't label carbon atoms
        if (el === 'C') return;

        // Color: NH uses nitrogen color
        const color = c.atomColors[el] || c.atomColors[el.charAt(0)] || c.atomColors['C'];

        // Background mask (clears bond lines behind label)
        const isWideGroup = el.length > 2; // NH₂, CH₃
        const isNH = el === 'NH';
        const isH = el === 'H';
        const bgR = isWideGroup ? 12 * scale : (isNH ? 9 * scale : (isH ? 5 * scale : 7 * scale));

        ctx.save();
        ctx.beginPath();
        if (isWideGroup) {
            const pw = 13 * scale, ph = 8 * scale;
            ctx.roundRect(x - pw, y - ph, pw * 2, ph * 2, 3 * scale);
        } else if (isNH) {
            const pw = 10 * scale, ph = 8 * scale;
            ctx.roundRect(x - pw, y - ph, pw * 2, ph * 2, 3 * scale);
        } else {
            ctx.arc(x, y, bgR, 0, Math.PI * 2);
        }
        ctx.fillStyle = c.bg;
        ctx.fill();

        // Draw label
        if (isWideGroup || isNH) {
            ctx.font = c.groupFont;
        } else if (isH) {
            ctx.font = c.hFont;
        } else {
            ctx.font = c.atomFont;
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(el, Math.round(x), Math.round(y) + (isH ? 0 : 1));
        ctx.restore();
    }

    // ——— Ring numbering ———
    _drawNumber(num, x, y, scale, c) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = c.numberFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = c.numberColor;
        ctx.fillText(num.toString(), x - 15 * scale, y - 15 * scale);
        ctx.restore();
    }

    // ——— H-bond highlight ring ———
    _drawHbondRing(x, y, type, scale, c) {
        const ctx = this.ctx;
        const isDonor = type === 'donor';
        const glow = isDonor ? c.donorGlow : c.acceptorGlow;
        const solid = isDonor ? c.donorColor : c.acceptorColor;
        const r = 22 * scale;

        ctx.save();
        // Soft glow
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
        g.addColorStop(0, glow);
        g.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(x, y, r * 2, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        // Ring outline
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = solid;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.75;
        ctx.setLineDash(isDonor ? [] : [5, 3]);
        ctx.stroke();
        ctx.restore();
    }

    // ——— H-bond tag ———
    _drawHbondTag(x, y, type, scale, c) {
        const ctx = this.ctx;
        const isDonor = type === 'donor';
        const color = isDonor ? c.donorColor : c.acceptorColor;
        const text = isDonor ? 'DONOR' : 'ACCEPTOR';
        const tagY = y + 30 * scale;

        ctx.save();
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const m = ctx.measureText(text);
        const pw = m.width + 10, ph = 15;
        ctx.fillStyle = isDonor ? 'rgba(245,158,11,0.15)' : 'rgba(6,182,212,0.15)';
        ctx.beginPath();
        ctx.roundRect(x - pw / 2, tagY - ph / 2, pw, ph, 3);
        ctx.fill();
        ctx.strokeStyle = isDonor ? 'rgba(245,158,11,0.35)' : 'rgba(6,182,212,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.fillText(text, x, tagY);
        ctx.restore();
    }

    // ——— Lone pairs ———
    _drawLonePairs(atom, base, atomMap, t, c) {
        const ax = this.tx(atom.x, t), ay = this.ty(atom.y, t);
        const bondAngles = [];
        for (const bond of base.bonds) {
            let oid = null;
            if (bond.from === atom.id) oid = bond.to;
            else if (bond.to === atom.id) oid = bond.from;
            if (!oid) continue;
            const o = atomMap.get(oid);
            if (!o) continue;
            bondAngles.push(Math.atan2(this.ty(o.y, t) - ay, this.tx(o.x, t) - ax));
        }
        let numPairs = atom.element === 'O' ? 2 : 1;
        if (bondAngles.length === 0) return;

        const dist = 14 * t.scale;
        const dotR = 2.5 * t.scale;
        const dotGap = 6.5 * t.scale;
        const ctx = this.ctx;

        ctx.save();
        ctx.fillStyle = atom.element === 'O' ? c.lonePairO : c.lonePairColor;

        if (bondAngles.length === 1) {
            // Terminal atom (e.g. C=O)
            const bondAngle = bondAngles[0];
            const pairsAngles = [];
            if (numPairs == 2) {
                // Place at 120 degrees from the double bond
                pairsAngles.push(bondAngle + Math.PI * 2 / 3);
                pairsAngles.push(bondAngle - Math.PI * 2 / 3);
            } else {
                pairsAngles.push(bondAngle + Math.PI);
            }
            
            for (const a of pairsAngles) {
                const cx = ax + Math.cos(a) * dist;
                const cy = ay + Math.sin(a) * dist;
                // perpendicular to radius for the two dots in a pair
                const px = -Math.sin(a) * dotGap / 2;
                const py = Math.cos(a) * dotGap / 2;
                ctx.beginPath(); ctx.arc(cx + px, cy + py, dotR, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx - px, cy - py, dotR, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            // Atom within a ring or chain (e.g. pyramidal N in ring)
            const sorted = [...bondAngles].sort((a, b) => a - b);
            const gaps = [];
            for (let i = 0; i < sorted.length; i++) {
                const next = (i + 1) % sorted.length;
                let start = sorted[i], end = sorted[next];
                if (end <= start) end += Math.PI * 2;
                gaps.push({ mid: (start + (end - start) / 2) % (Math.PI * 2), size: end - start });
            }
            gaps.sort((a, b) => b.size - a.size);

            for (let i = 0; i < Math.min(numPairs, gaps.length); i++) {
                const a = gaps[i].mid;
                const cx = ax + Math.cos(a) * dist;
                const cy = ay + Math.sin(a) * dist;
                const px = -Math.sin(a) * dotGap / 2;
                const py = Math.cos(a) * dotGap / 2;
                ctx.beginPath(); ctx.arc(cx + px, cy + py, dotR, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx - px, cy - py, dotR, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();
    }

    // ——— Sugar Bond (C1') ———
    _drawSugarBond(atom, base, atomMap, t, c) {
        const ctx = this.ctx;
        const ax = this.tx(atom.x, t);
        const ay = this.ty(atom.y, t);

        // Find average angle of bonds connected to this atom, and project outward
        let bx = 0, by = 0, count = 0;
        for (const bond of base.bonds) {
            let oid = null;
            if (bond.from === atom.id) oid = bond.to;
            else if (bond.to === atom.id) oid = bond.from;
            if (oid) {
                const o = atomMap.get(oid);
                if (o) {
                    bx += this.tx(o.x, t);
                    by += this.ty(o.y, t);
                    count++;
                }
            }
        }

        let outX = 0, outY = 1;
        if (count > 0) {
            bx /= count;
            by /= count;
            // Vector from average bond pos to atom pos
            outX = ax - bx;
            outY = ay - by;
            const len = Math.hypot(outX, outY);
            if (len > 0) {
                outX /= len;
                outY /= len;
            }
        }

        const bondLen = 45 * t.scale;
        const endX = ax + outX * bondLen;
        const endY = ay + outY * bondLen;

        // Start bond a little away from atom label
        const startOff = this._labelRadius(atom, t.scale) + 2 * t.scale;
        const startX = ax + outX * startOff;
        const startY = ay + outY * startOff;

        ctx.save();
        ctx.strokeStyle = c.bondColor;
        ctx.lineWidth = c.bondWidth * Math.min(t.scale, 1.3);
        ctx.lineCap = 'round';
        ctx.setLineDash([5, 4]);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.font = c.groupFont;
        ctx.textAlign = outX > 0 ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = c.atomColors['C'];

        const padX = outX > 0 ? 5 : -5;
        const label = "C1' (Sugar)";
        ctx.fillText(label, endX + padX, endY);
        ctx.restore();
    }

    // ——— Hit test ———
    hitTest(mx, my, base) {
        const rb = this._rotatedBase(base);
        const t = this.getTransform(rb);
        let closest = null, best = 28 * t.scale;
        for (const atom of rb.atoms) {
            const d = Math.hypot(mx - this.tx(atom.x, t), my - this.ty(atom.y, t));
            if (d < best) { best = d; closest = atom; }
        }
        return closest;
    }
}
