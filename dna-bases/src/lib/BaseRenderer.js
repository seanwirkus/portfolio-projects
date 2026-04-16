export class BaseRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.dpr = window.devicePixelRatio || 1;
        this.hoveredAtom = null;
        this.theme = "dark";
        this.rotation = 0;
        this.resize();
        this._resizeHandler = () => this.resize();
        window.addEventListener("resize", this._resizeHandler);
    }

    destroy() {
        window.removeEventListener("resize", this._resizeHandler);
    }

    get colors() {
        const isDark = this.theme === "dark";

        return {
            bg: isDark ? "#04121c" : "#f5fbff",
            bondColor: isDark ? "#d6e3ea" : "#173246",
            bondWidth: 2.8,
            doubleBondOffset: 5.5,
            atomColors: {
                N: isDark ? "#60c8ff" : "#0b78c4",
                O: isDark ? "#ff8f7f" : "#d65243",
                C: isDark ? "#9bb2c2" : "#5d7486",
                H: isDark ? "#9bb2c2" : "#5d7486",
                "NH₂": isDark ? "#60c8ff" : "#0b78c4",
                "CH₃": isDark ? "#9bb2c2" : "#5d7486",
            },
            atomFont: '700 18px "Space Grotesk", sans-serif',
            groupFont: '700 15px "Space Grotesk", sans-serif',
            hFont: '15px "Space Grotesk", sans-serif',
            numberFont: '500 10px "IBM Plex Mono", monospace',
            numberColor: isDark ? "rgba(155,178,194,0.5)" : "rgba(93,116,134,0.5)",
            donorColor: "#f7b955",
            donorGlow: isDark ? "rgba(247,185,85,0.2)" : "rgba(247,185,85,0.16)",
            acceptorColor: "#4fd6c4",
            acceptorGlow: isDark ? "rgba(79,214,196,0.18)" : "rgba(79,214,196,0.14)",
            hoverRing: isDark ? "rgba(255,255,255,0.16)" : "rgba(11,120,196,0.16)",
            lonePairColor: isDark ? "rgba(96,200,255,0.54)" : "rgba(11,120,196,0.5)",
            lonePairO: isDark ? "rgba(255,143,127,0.55)" : "rgba(214,82,67,0.46)",
        };
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return;
        }

        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = "high";
        this.logicalWidth = rect.width;
        this.logicalHeight = rect.height;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    }

    getTransform(base) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const atom of base.atoms) {
            minX = Math.min(minX, atom.x);
            maxX = Math.max(maxX, atom.x);
            minY = Math.min(minY, atom.y);
            maxY = Math.max(maxY, atom.y);
        }

        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        const cx = minX + width / 2;
        const cy = minY + height / 2;
        const pad = 70;
        const scale = Math.min(
            (this.logicalWidth - pad * 2) / width,
            (this.logicalHeight - pad * 2) / height,
            2.2,
        );

        return {
            dx: this.logicalWidth / 2 - cx * scale,
            dy: this.logicalHeight / 2 - cy * scale,
            scale,
        };
    }

    tx(x, transform) {
        return x * transform.scale + transform.dx;
    }

    ty(y, transform) {
        return y * transform.scale + transform.dy;
    }

    _rotatedBase(base) {
        return this._rotateBase(base, this.rotation);
    }

    _rotateBase(base, angle, mirror = false) {
        if (!angle && !mirror) {
            return base;
        }

        const cos = Math.cos(angle || 0);
        const sin = Math.sin(angle || 0);
        let cx = 0;
        let cy = 0;

        for (const atom of base.atoms) {
            cx += atom.x;
            cy += atom.y;
        }

        cx /= base.atoms.length;
        cy /= base.atoms.length;

        return {
            ...base,
            atoms: base.atoms.map((atom) => {
                let mx = atom.x;
                let my = atom.y;

                if (mirror) {
                    mx = cx - (atom.x - cx);
                }

                return {
                    ...atom,
                    x: cx + (mx - cx) * cos - (my - cy) * sin,
                    y: cy + (mx - cx) * sin + (my - cy) * cos,
                };
            }),
        };
    }

    _basePalette(base) {
        const key = (base?.letter || "").toUpperCase();
        const isDark = this.theme === "dark";
        const palettes = {
            A: {
                aura: isDark ? "rgba(96, 200, 255, 0.16)" : "rgba(11, 120, 196, 0.12)",
                ring: isDark ? "rgba(96, 200, 255, 0.46)" : "rgba(11, 120, 196, 0.26)",
                chipBg: isDark ? "rgba(5, 27, 41, 0.84)" : "rgba(223, 245, 255, 0.92)",
                chipFg: isDark ? "#dff6ff" : "#0e3c5b",
            },
            T: {
                aura: isDark ? "rgba(247, 185, 85, 0.16)" : "rgba(227, 143, 28, 0.12)",
                ring: isDark ? "rgba(247, 185, 85, 0.44)" : "rgba(227, 143, 28, 0.28)",
                chipBg: isDark ? "rgba(49, 24, 0, 0.82)" : "rgba(255, 242, 220, 0.94)",
                chipFg: isDark ? "#fff0d7" : "#73450d",
            },
            G: {
                aura: isDark ? "rgba(110, 230, 158, 0.15)" : "rgba(19, 156, 82, 0.12)",
                ring: isDark ? "rgba(110, 230, 158, 0.44)" : "rgba(19, 156, 82, 0.26)",
                chipBg: isDark ? "rgba(5, 32, 15, 0.82)" : "rgba(222, 250, 233, 0.92)",
                chipFg: isDark ? "#dcfce7" : "#13562a",
            },
            C: {
                aura: isDark ? "rgba(255, 143, 127, 0.15)" : "rgba(214, 82, 67, 0.12)",
                ring: isDark ? "rgba(255, 143, 127, 0.4)" : "rgba(214, 82, 67, 0.24)",
                chipBg: isDark ? "rgba(46, 13, 11, 0.82)" : "rgba(255, 234, 229, 0.92)",
                chipFg: isDark ? "#ffe8e3" : "#6e241d",
            },
            U: {
                aura: isDark ? "rgba(168, 139, 250, 0.16)" : "rgba(109, 40, 217, 0.1)",
                ring: isDark ? "rgba(168, 139, 250, 0.4)" : "rgba(109, 40, 217, 0.2)",
                chipBg: isDark ? "rgba(32, 18, 67, 0.82)" : "rgba(243, 237, 255, 0.92)",
                chipFg: isDark ? "#efe6ff" : "#54248f",
            },
        };

        return palettes[key] || palettes.A;
    }

    _baseBounds(base) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const atom of base.atoms) {
            minX = Math.min(minX, atom.x);
            maxX = Math.max(maxX, atom.x);
            minY = Math.min(minY, atom.y);
            maxY = Math.max(maxY, atom.y);
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

    _drawPairAura(base, transform, palette) {
        const bounds = this._baseBounds(base);
        const cx = this.tx(bounds.cx, transform);
        const cy = this.ty(bounds.cy, transform);
        const rx = (bounds.width * transform.scale) / 2 + 32 * transform.scale;
        const ry = (bounds.height * transform.scale) / 2 + 24 * transform.scale;
        const ctx = this.ctx;

        ctx.save();
        const gradient = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.2, cx, cy, Math.max(rx, ry));
        gradient.addColorStop(0, palette.aura);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = palette.ring;
        ctx.lineWidth = Math.max(1.2, 1.8 * transform.scale);
        ctx.setLineDash([8, 7]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx - 10 * transform.scale, ry - 8 * transform.scale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    _drawPairLabel(base, transform, palette) {
        const bounds = this._baseBounds(base);
        const cx = this.tx(bounds.cx, transform);
        const topY = this.ty(bounds.minY, transform) - 18 * transform.scale;
        const text = `${base.letter} · ${base.name}`;
        const ctx = this.ctx;

        ctx.save();
        ctx.font = '600 12px "Space Grotesk", sans-serif';
        const width = ctx.measureText(text).width + 16;
        const height = 22;
        ctx.fillStyle = palette.chipBg;
        ctx.strokeStyle = palette.ring;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cx - width / 2, topY - height / 2, width, height, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = palette.chipFg;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, cx, topY + 0.5);
        ctx.restore();
    }

    _drawBaseWithTransform(base, transform, options = {}, hoveredAtom = null) {
        const colors = this.colors;
        const ctx = this.ctx;
        const atomMap = new Map(base.atoms.map((atom) => [atom.id, atom]));
        const showHbond = options.showHbond !== false;
        const showNumbering = options.showNumbering !== false;
        const showLonePairs = options.showLonePairs === true;
        const showSugarBond = options.showSugarBond === true;
        const hbondMap = new Map();

        if (base.hbondSites) {
            base.hbondSites.forEach((site) => hbondMap.set(site.atomId, site));
        }

        for (const bond of base.bonds) {
            const atomA = atomMap.get(bond.from);
            const atomB = atomMap.get(bond.to);
            if (!atomA || !atomB) {
                continue;
            }

            this._drawBond(
                this.tx(atomA.x, transform),
                this.ty(atomA.y, transform),
                this.tx(atomB.x, transform),
                this.ty(atomB.y, transform),
                bond.order,
                transform.scale,
                atomA,
                atomB,
                colors,
                base,
                transform,
            );
        }

        if (showSugarBond && base.sugarAttachment) {
            const atom = atomMap.get(base.sugarAttachment.atomId);
            if (atom) {
                this._drawSugarBond(atom, base, atomMap, transform, colors);
            }
        }

        if (showHbond) {
            for (const [atomId, site] of hbondMap) {
                const atom = atomMap.get(atomId);
                if (!atom) {
                    continue;
                }
                this._drawHbondRing(this.tx(atom.x, transform), this.ty(atom.y, transform), site.type, transform.scale, colors);
            }
        }

        for (const atom of base.atoms) {
            this._drawAtom(atom, this.tx(atom.x, transform), this.ty(atom.y, transform), transform.scale, colors);
        }

        if (showNumbering) {
            for (const atom of base.atoms) {
                if (atom.ringNum == null) {
                    continue;
                }
                this._drawNumber(atom.ringNum, this.tx(atom.x, transform), this.ty(atom.y, transform), transform.scale, colors);
            }
        }

        if (showLonePairs) {
            for (const atom of base.atoms) {
                if (atom.element !== "N" && atom.element !== "O" && atom.element !== "NH") {
                    continue;
                }
                this._drawLonePairs(atom, base, atomMap, transform, colors);
            }
        }

        if (showHbond) {
            for (const [atomId, site] of hbondMap) {
                const atom = atomMap.get(atomId);
                if (!atom) {
                    continue;
                }
                this._drawHbondTag(this.tx(atom.x, transform), this.ty(atom.y, transform), site.type, transform.scale, colors);
            }
        }

        if (hoveredAtom) {
            const hx = this.tx(hoveredAtom.x, transform);
            const hy = this.ty(hoveredAtom.y, transform);
            ctx.save();
            ctx.beginPath();
            ctx.arc(hx, hy, 22 * transform.scale, 0, Math.PI * 2);
            ctx.strokeStyle = colors.hoverRing;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }

        return atomMap;
    }

    render(base, options = {}) {
        this.resize();
        this.clear();
        if (!base) {
            return;
        }

        const rotatedBase = this._rotatedBase(base);
        const transform = this.getTransform(rotatedBase);
        this._drawBaseWithTransform(rotatedBase, transform, options, this.hoveredAtom);
    }

    renderPairing(baseA, baseB, options = {}) {
        this.resize();
        this.clear();
        if (!baseA || !baseB) {
            return;
        }

        const approachProgress = Math.max(0, Math.min(options.approachProgress ?? 1, 1));
        const bondProgress = Math.max(0, Math.min(options.bondProgress ?? 1, 1));
        const pairMap = options.pairMap || [];
        const primaryRotation = options.primaryRotation ?? this.rotation;
        const partnerRotation = options.partnerRotation ?? this.rotation;

        const rotatedA = this._rotateBase(baseA, primaryRotation);
        const rotatedB = this._rotateBase(baseB, partnerRotation, options.partnerMirror || false);
        const boundsA = this._baseBounds(rotatedA);
        const boundsB = this._baseBounds(rotatedB);
        const paletteA = this._basePalette(baseA);
        const paletteB = this._basePalette(baseB);

        let nx = -1;
        let ny = 0;

        if (pairMap.length >= 2) {
            let faceAx = 0;
            let faceAy = 0;
            pairMap.forEach((pair) => {
                const atom = rotatedA.atoms.find((candidate) => candidate.id === pair.from);
                if (atom) {
                    faceAx += atom.x;
                    faceAy += atom.y;
                }
            });

            faceAx /= pairMap.length;
            faceAy /= pairMap.length;

            let centroidAx = 0;
            let centroidAy = 0;
            rotatedA.atoms.forEach((atom) => {
                centroidAx += atom.x;
                centroidAy += atom.y;
            });

            centroidAx /= rotatedA.atoms.length;
            centroidAy /= rotatedA.atoms.length;

            nx = faceAx - centroidAx;
            ny = faceAy - centroidAy;
            const length = Math.hypot(nx, ny);
            if (length > 0) {
                nx /= length;
                ny /= length;
            }
        }

        const finalGap = 92;
        const startGap = 300;
        const gap = startGap - (startGap - finalGap) * approachProgress;
        const spanA = Math.abs(nx * boundsA.width) + Math.abs(ny * boundsA.height);
        const spanB = Math.abs(nx * boundsB.width) + Math.abs(ny * boundsB.height);
        const distance = (spanA + spanB) / 2 + gap;

        const minX = Math.min(-distance / 2 * nx - boundsA.width / 2, distance / 2 * nx - boundsB.width / 2);
        const maxX = Math.max(-distance / 2 * nx + boundsA.width / 2, distance / 2 * nx + boundsB.width / 2);
        const minY = Math.min(-distance / 2 * ny - boundsA.height / 2, distance / 2 * ny - boundsB.height / 2);
        const maxY = Math.max(-distance / 2 * ny + boundsA.height / 2, distance / 2 * ny + boundsB.height / 2);

        const pad = 56;
        const scale = Math.min(
            (this.logicalWidth - pad * 2) / Math.max(maxX - minX, 1),
            (this.logicalHeight - pad * 2) / Math.max(maxY - minY, 1),
            2.2,
        );

        const centerX = this.logicalWidth / 2;
        const centerY = this.logicalHeight / 2;
        const targetAx = centerX - (distance / 2 * nx) * scale;
        const targetAy = centerY - (distance / 2 * ny) * scale;
        const targetBx = centerX + (distance / 2 * nx) * scale;
        const targetBy = centerY + (distance / 2 * ny) * scale;

        const transformA = {
            scale,
            dx: targetAx - boundsA.cx * scale,
            dy: targetAy - boundsA.cy * scale,
        };

        const transformB = {
            scale,
            dx: targetBx - boundsB.cx * scale,
            dy: targetBy - boundsB.cy * scale,
        };

        this._drawPairAura(rotatedA, transformA, paletteA);
        this._drawPairAura(rotatedB, transformB, paletteB);

        const atomMapA = this._drawBaseWithTransform(rotatedA, transformA, options);
        const atomMapB = this._drawBaseWithTransform(rotatedB, transformB, options);
        this._drawPairLabel(rotatedA, transformA, paletteA);
        this._drawPairLabel(rotatedB, transformB, paletteB);

        if (pairMap.length > 0 && (approachProgress > 0.35 || bondProgress > 0)) {
            const colors = this.colors;
            const ctx = this.ctx;
            ctx.save();
            ctx.lineDashOffset = -performance.now() / 70;

            for (const pair of pairMap) {
                const atomA = atomMapA.get(pair.from);
                const atomB = atomMapB.get(pair.to);
                if (!atomA || !atomB) {
                    continue;
                }

                let x1 = this.tx(atomA.x, transformA);
                let y1 = this.ty(atomA.y, transformA);
                let x2 = this.tx(atomB.x, transformB);
                let y2 = this.ty(atomB.y, transformB);

                const dx = x2 - x1;
                const dy = y2 - y1;
                const distanceBetweenAtoms = Math.sqrt(dx * dx + dy * dy);
                if (distanceBetweenAtoms > 0) {
                    const radiusA = this._labelRadius(atomA, scale) + 6 * scale;
                    const radiusB = this._labelRadius(atomB, scale) + 6 * scale;
                    if (distanceBetweenAtoms > radiusA + radiusB) {
                        x1 += (dx / distanceBetweenAtoms) * radiusA;
                        y1 += (dy / distanceBetweenAtoms) * radiusA;
                        x2 -= (dx / distanceBetweenAtoms) * radiusB;
                        y2 -= (dy / distanceBetweenAtoms) * radiusB;
                    }
                }

                const drawX = x1 + (x2 - x1) * bondProgress;
                const drawY = y1 + (y2 - y1) * bondProgress;
                const donorBond = pair.type === "donor";
                ctx.strokeStyle = donorBond ? colors.donorColor : colors.acceptorColor;
                ctx.lineWidth = Math.max(2.1, 2.8 * scale);
                ctx.setLineDash(donorBond ? [10, 5] : [4, 7]);
                ctx.globalAlpha = 0.92;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(drawX, drawY);
                ctx.stroke();

                ctx.globalAlpha = 0.95;
                ctx.fillStyle = donorBond ? colors.donorColor : colors.acceptorColor;
                ctx.beginPath();
                ctx.arc(x1, y1, 2.8 * scale, 0, Math.PI * 2);
                ctx.fill();

                if (bondProgress >= 1) {
                    ctx.globalAlpha = 0.25;
                    ctx.beginPath();
                    ctx.arc((x1 + x2) / 2, (y1 + y2) / 2, 10 * scale, 0, Math.PI * 2);
                    ctx.fillStyle = donorBond ? colors.donorGlow : colors.acceptorGlow;
                    ctx.fill();
                }
            }

            ctx.restore();
        }
    }

    _drawBond(x1, y1, x2, y2, order, scale, atomA, atomB, colors, base, transform) {
        const ctx = this.ctx;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.hypot(dx, dy);
        if (distance < 1) {
            return;
        }

        const ux = dx / distance;
        const uy = dy / distance;
        const trimA = this._labelRadius(atomA, scale);
        const trimB = this._labelRadius(atomB, scale);
        const trimmedX1 = x1 + ux * trimA;
        const trimmedY1 = y1 + uy * trimA;
        const trimmedX2 = x2 - ux * trimB;
        const trimmedY2 = y2 - uy * trimB;

        ctx.save();
        ctx.strokeStyle = colors.bondColor;
        ctx.lineWidth = colors.bondWidth * Math.min(scale, 1.3);
        ctx.lineCap = "round";

        if (order === 1) {
            ctx.beginPath();
            ctx.moveTo(trimmedX1, trimmedY1);
            ctx.lineTo(trimmedX2, trimmedY2);
            ctx.stroke();
            ctx.restore();
            return;
        }

        const ringBondA = atomA.ringNum != null;
        const ringBondB = atomB.ringNum != null;
        let px = -uy * colors.doubleBondOffset * scale;
        let py = ux * colors.doubleBondOffset * scale;

        if (ringBondA && ringBondB && base) {
            let rcx = 0;
            let rcy = 0;
            let count = 0;

            for (const atom of base.atoms) {
                if (atom.ringNum != null) {
                    rcx += this.tx(atom.x, transform);
                    rcy += this.ty(atom.y, transform);
                    count += 1;
                }
            }

            rcx /= count;
            rcy /= count;

            const midX = (trimmedX1 + trimmedX2) / 2;
            const midY = (trimmedY1 + trimmedY2) / 2;
            const toCenterX = rcx - midX;
            const toCenterY = rcy - midY;

            if (px * toCenterX + py * toCenterY < 0) {
                px = -px;
                py = -py;
            }

            ctx.beginPath();
            ctx.moveTo(trimmedX1, trimmedY1);
            ctx.lineTo(trimmedX2, trimmedY2);
            ctx.stroke();

            const padA = (atomA.element === "C" ? 6 : 4) * scale;
            const padB = (atomB.element === "C" ? 6 : 4) * scale;

            ctx.beginPath();
            ctx.moveTo(trimmedX1 + ux * padA + px, trimmedY1 + uy * padA + py);
            ctx.lineTo(trimmedX2 - ux * padB + px, trimmedY2 - uy * padB + py);
            ctx.stroke();
            ctx.restore();
            return;
        }

        if (ringBondA || ringBondB) {
            const padA = atomA.ringNum != null && atomA.element === "C" ? 2 * scale : 0;
            const padB = atomB.ringNum != null && atomB.element === "C" ? 2 * scale : 0;

            ctx.beginPath();
            ctx.moveTo(trimmedX1 + ux * padA + px, trimmedY1 + uy * padA + py);
            ctx.lineTo(trimmedX2 - ux * padB + px, trimmedY2 - uy * padB + py);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(trimmedX1 + ux * padA - px, trimmedY1 + uy * padA - py);
            ctx.lineTo(trimmedX2 - ux * padB - px, trimmedY2 - uy * padB - py);
            ctx.stroke();
            ctx.restore();
            return;
        }

        ctx.beginPath();
        ctx.moveTo(trimmedX1 + px, trimmedY1 + py);
        ctx.lineTo(trimmedX2 + px, trimmedY2 + py);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(trimmedX1 - px, trimmedY1 - py);
        ctx.lineTo(trimmedX2 - px, trimmedY2 - py);
        ctx.stroke();
        ctx.restore();
    }

    _labelRadius(atom, scale) {
        const element = atom.element;
        if (element === "C") {
            return 0;
        }
        if (element === "H") {
            return 5 * scale;
        }
        if (element === "NH₂" || element === "CH₃") {
            return 10 * scale;
        }
        if (element === "NH") {
            return 8 * scale;
        }
        return 7 * scale;
    }

    _drawAtom(atom, x, y, scale, colors) {
        const ctx = this.ctx;
        const element = atom.element;
        if (element === "C") {
            return;
        }

        const color = colors.atomColors[element] || colors.atomColors[element.charAt(0)] || colors.atomColors.C;
        const wideGroup = element.length > 2;
        const nhGroup = element === "NH";
        const hydrogen = element === "H";
        const bgRadius = wideGroup ? 12 * scale : nhGroup ? 9 * scale : hydrogen ? 5 * scale : 7 * scale;

        ctx.save();
        ctx.beginPath();
        if (wideGroup) {
            const width = 13 * scale;
            const height = 8 * scale;
            ctx.roundRect(x - width, y - height, width * 2, height * 2, 3 * scale);
        } else if (nhGroup) {
            const width = 10 * scale;
            const height = 8 * scale;
            ctx.roundRect(x - width, y - height, width * 2, height * 2, 3 * scale);
        } else {
            ctx.arc(x, y, bgRadius, 0, Math.PI * 2);
        }
        ctx.fillStyle = colors.bg;
        ctx.fill();

        if (wideGroup || nhGroup) {
            ctx.font = colors.groupFont;
        } else if (hydrogen) {
            ctx.font = colors.hFont;
        } else {
            ctx.font = colors.atomFont;
        }

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = color;
        ctx.fillText(element, Math.round(x), Math.round(y) + (hydrogen ? 0 : 1));
        ctx.restore();
    }

    _drawNumber(number, x, y, scale, colors) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = colors.numberFont;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = colors.numberColor;
        ctx.fillText(number.toString(), x - 15 * scale, y - 15 * scale);
        ctx.restore();
    }

    _drawHbondRing(x, y, type, scale, colors) {
        const ctx = this.ctx;
        const donorBond = type === "donor";
        const glow = donorBond ? colors.donorGlow : colors.acceptorGlow;
        const solid = donorBond ? colors.donorColor : colors.acceptorColor;
        const radius = 22 * scale;

        ctx.save();
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
        gradient.addColorStop(0, glow);
        gradient.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = solid;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.75;
        ctx.setLineDash(donorBond ? [] : [5, 3]);
        ctx.stroke();
        ctx.restore();
    }

    _drawHbondTag(x, y, type, scale, colors) {
        const ctx = this.ctx;
        const donorBond = type === "donor";
        const color = donorBond ? colors.donorColor : colors.acceptorColor;
        const text = donorBond ? "DONOR" : "ACCEPTOR";
        const tagY = y + 30 * scale;

        ctx.save();
        ctx.font = '700 9px "IBM Plex Mono", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const width = ctx.measureText(text).width + 10;
        const height = 15;
        ctx.fillStyle = donorBond ? "rgba(247,185,85,0.15)" : "rgba(79,214,196,0.15)";
        ctx.beginPath();
        ctx.roundRect(x - width / 2, tagY - height / 2, width, height, 3);
        ctx.fill();
        ctx.strokeStyle = donorBond ? "rgba(247,185,85,0.35)" : "rgba(79,214,196,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(text, x, tagY);
        ctx.restore();
    }

    _drawLonePairs(atom, base, atomMap, transform, colors) {
        const ax = this.tx(atom.x, transform);
        const ay = this.ty(atom.y, transform);
        const bondAngles = [];

        for (const bond of base.bonds) {
            let otherId = null;
            if (bond.from === atom.id) {
                otherId = bond.to;
            } else if (bond.to === atom.id) {
                otherId = bond.from;
            }

            if (!otherId) {
                continue;
            }

            const other = atomMap.get(otherId);
            if (!other) {
                continue;
            }

            bondAngles.push(Math.atan2(this.ty(other.y, transform) - ay, this.tx(other.x, transform) - ax));
        }

        let pairCount = atom.element === "O" ? 2 : 1;
        if (bondAngles.length === 0) {
            return;
        }

        const dist = 14 * transform.scale;
        const dotRadius = 2.5 * transform.scale;
        const dotGap = 6.5 * transform.scale;
        const ctx = this.ctx;

        ctx.save();
        ctx.fillStyle = atom.element === "O" ? colors.lonePairO : colors.lonePairColor;

        if (bondAngles.length === 1) {
            const bondAngle = bondAngles[0];
            const pairAngles = [];

            if (pairCount === 2) {
                pairAngles.push(bondAngle + (Math.PI * 2) / 3);
                pairAngles.push(bondAngle - (Math.PI * 2) / 3);
            } else {
                pairAngles.push(bondAngle + Math.PI);
            }

            for (const angle of pairAngles) {
                const cx = ax + Math.cos(angle) * dist;
                const cy = ay + Math.sin(angle) * dist;
                const px = -Math.sin(angle) * dotGap / 2;
                const py = Math.cos(angle) * dotGap / 2;
                ctx.beginPath();
                ctx.arc(cx + px, cy + py, dotRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx - px, cy - py, dotRadius, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
            return;
        }

        const sortedAngles = [...bondAngles].sort((a, b) => a - b);
        const gaps = [];

        for (let index = 0; index < sortedAngles.length; index += 1) {
            const nextIndex = (index + 1) % sortedAngles.length;
            let start = sortedAngles[index];
            let end = sortedAngles[nextIndex];
            if (end <= start) {
                end += Math.PI * 2;
            }

            gaps.push({
                mid: (start + (end - start) / 2) % (Math.PI * 2),
                size: end - start,
            });
        }

        gaps.sort((a, b) => b.size - a.size);

        for (let index = 0; index < Math.min(pairCount, gaps.length); index += 1) {
            const angle = gaps[index].mid;
            const cx = ax + Math.cos(angle) * dist;
            const cy = ay + Math.sin(angle) * dist;
            const px = -Math.sin(angle) * dotGap / 2;
            const py = Math.cos(angle) * dotGap / 2;
            ctx.beginPath();
            ctx.arc(cx + px, cy + py, dotRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx - px, cy - py, dotRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    _drawSugarBond(atom, base, atomMap, transform, colors) {
        const ctx = this.ctx;
        const ax = this.tx(atom.x, transform);
        const ay = this.ty(atom.y, transform);
        let bx = 0;
        let by = 0;
        let count = 0;

        for (const bond of base.bonds) {
            let otherId = null;
            if (bond.from === atom.id) {
                otherId = bond.to;
            } else if (bond.to === atom.id) {
                otherId = bond.from;
            }

            if (!otherId) {
                continue;
            }

            const other = atomMap.get(otherId);
            if (!other) {
                continue;
            }

            bx += this.tx(other.x, transform);
            by += this.ty(other.y, transform);
            count += 1;
        }

        let outX = 0;
        let outY = 1;
        if (count > 0) {
            bx /= count;
            by /= count;
            outX = ax - bx;
            outY = ay - by;
            const length = Math.hypot(outX, outY);
            if (length > 0) {
                outX /= length;
                outY /= length;
            }
        }

        const bondLength = 45 * transform.scale;
        const endX = ax + outX * bondLength;
        const endY = ay + outY * bondLength;
        const startOffset = this._labelRadius(atom, transform.scale) + 2 * transform.scale;
        const startX = ax + outX * startOffset;
        const startY = ay + outY * startOffset;

        ctx.save();
        ctx.strokeStyle = colors.bondColor;
        ctx.lineWidth = colors.bondWidth * Math.min(transform.scale, 1.3);
        ctx.lineCap = "round";
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.font = colors.groupFont;
        ctx.textAlign = outX > 0 ? "left" : "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = colors.atomColors.C;
        const padX = outX > 0 ? 5 : -5;
        ctx.fillText("C1' (Sugar)", endX + padX, endY);
        ctx.restore();
    }

    hitTest(mx, my, base) {
        const rotatedBase = this._rotatedBase(base);
        const transform = this.getTransform(rotatedBase);
        let closest = null;
        let best = 28 * transform.scale;

        for (const atom of rotatedBase.atoms) {
            const distance = Math.hypot(mx - this.tx(atom.x, transform), my - this.ty(atom.y, transform));
            if (distance < best) {
                best = distance;
                closest = atom;
            }
        }

        return closest;
    }
}
