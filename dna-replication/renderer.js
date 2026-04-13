// DNA Replication Fork Renderer — Canvas-based schematic diagram

class ForkRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.theme = 'dark';
        this.selectedEnzyme = null;
        this.hoveredPill = null;
        this._pills = []; // clickable enzyme pill regions
        this.resize();
        this._resizeHandler = () => this.resize();
        window.addEventListener('resize', this._resizeHandler);
    }

    get colors() {
        const dk = this.theme === 'dark';
        return {
            bg: dk ? '#070a0f' : '#f8fafc',
            strand: dk ? '#64748b' : '#94a3b8',
            strandThick: dk ? '#94a3b8' : '#475569',
            basePair: dk ? 'rgba(148,163,184,0.22)' : 'rgba(71,85,105,0.18)',
            leading: '#3b82f6',
            lagging: '#10b981',
            primer: '#ec4899',
            labelFont: '600 11px "Inter", sans-serif',
            dirFont: 'bold 13px "JetBrains Mono", monospace',
            pillFont: '600 11px "Inter", sans-serif',
            pillFontSm: '500 10px "Inter", sans-serif',
            text: dk ? '#e6edf3' : '#0f172a',
            textMuted: dk ? '#8b949e' : '#64748b',
            arrowColor: dk ? 'rgba(148,163,184,0.5)' : 'rgba(71,85,105,0.45)',
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
        this.w = rect.width;
        this.h = rect.height;
    }

    clear() { this.ctx.clearRect(0, 0, this.w, this.h); }

    render() {
        this.resize();
        this.clear();
        this._pills = [];
        const ctx = this.ctx;
        const c = this.colors;
        const w = this.w, h = this.h;

        // Responsive scaling
        const scale = Math.min(w / 760, h / 420, 1.2);
        const ox = (w - 740 * scale) / 2; // offset to center
        const oy = (h - 400 * scale) / 2;
        const s = (x, y) => [ox + x * scale, oy + y * scale]; // scale point

        // --- Layout ---
        const forkX = 220;
        const midY = 205;
        const gap = 12;
        const rightX = 710;
        const upY = 75;   // upper arm endpoint y
        const loY = 335;  // lower arm endpoint y
        const parentL = 30;

        // Interpolate along an arm
        const lerp = (x1, y1, x2, y2, t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];

        // --- Draw parent DNA ---
        const topY = midY - gap;
        const botY = midY + gap;
        this._drawLine(s(parentL, topY), s(forkX, topY), c.strandThick, 3 * scale);
        this._drawLine(s(parentL, botY), s(forkX, botY), c.strandThick, 3 * scale);

        // Base pair dashes in parent region
        for (let x = parentL + 25; x < forkX - 10; x += 18) {
            ctx.save();
            ctx.strokeStyle = c.basePair;
            ctx.lineWidth = 1.2 * scale;
            ctx.setLineDash([3, 3]);
            const [px1, py1] = s(x, topY + 3);
            const [px2, py2] = s(x, botY - 3);
            ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
            ctx.restore();
        }

        // --- Draw template strands (fork arms) ---
        // Upper arm: template for leading strand
        this._drawCurve(s(forkX, topY), s(forkX + 100, topY - 40), s(rightX, upY), c.strandThick, 3 * scale);
        // Lower arm: template for lagging strand
        this._drawCurve(s(forkX, botY), s(forkX + 100, botY + 40), s(rightX, loY), c.strandThick, 3 * scale);

        // --- Leading strand (continuous, blue, follows upper template offset) ---
        const leadOff = 14;
        this._drawCurve(
            s(forkX + 12, topY + leadOff),
            s(forkX + 110, topY - 40 + leadOff + 5),
            s(rightX - 15, upY + leadOff + 2),
            c.leading, 2.8 * scale
        );
        // Small synthesis arrow on leading strand
        this._drawSynthArrow(s(rightX - 50, upY + leadOff + 1), s(forkX + 60, topY + leadOff - 4), c.leading, scale);

        // --- Lagging strand (Okazaki fragments, green + pink primers) ---
        const lagOff = -14;
        // Fragment positions along lower arm (t = 0 at fork, t = 1 at end)
        const frags = [
            { t0: 0.04, t1: 0.22, primer: true, label: '1' },
            { t0: 0.28, t1: 0.52, primer: true, label: '2' },
            { t0: 0.58, t1: 0.82, primer: true, label: '3' },
        ];

        for (const frag of frags) {
            const [sx, sy] = lerp(forkX, botY, rightX, loY, frag.t0);
            const [ex, ey] = lerp(forkX, botY, rightX, loY, frag.t1);
            // Offset above the template
            const fx1 = sx, fy1 = sy + lagOff;
            const fx2 = ex, fy2 = ey + lagOff;

            if (frag.primer) {
                // Primer block (5' end = near fork = left end of fragment)
                const primerLen = Math.min(0.18, (frag.t1 - frag.t0) * 0.3);
                const [px, py] = lerp(forkX, botY, rightX, loY, frag.t0 + primerLen);
                this._drawLine(s(fx1, fy1), s(px, py + lagOff), c.primer, 4 * scale, true);
                // DNA portion
                this._drawLine(s(px, py + lagOff), s(fx2, fy2), c.lagging, 2.8 * scale);
            } else {
                this._drawLine(s(fx1, fy1), s(fx2, fy2), c.lagging, 2.8 * scale);
            }
        }

        // Synthesis arrow for lagging (on fragment 1, pointing away from fork)
        const [la1x, la1y] = lerp(forkX, botY, rightX, loY, 0.06);
        const [la2x, la2y] = lerp(forkX, botY, rightX, loY, 0.20);
        this._drawSynthArrow(s(la1x, la1y + lagOff), s(la2x, la2y + lagOff), c.lagging, scale);

        // --- 5'/3' direction labels ---
        const dirStyle = (color) => { ctx.font = c.dirFont; ctx.fillStyle = color; ctx.textBaseline = 'middle'; };

        // Parent top strand: 5' left
        dirStyle(c.textMuted);
        ctx.textAlign = 'right';
        const [p5x, p5y] = s(parentL - 5, topY);
        ctx.fillText("5'", p5x, p5y);
        // Parent bottom strand: 3' left
        const [p3x, p3y] = s(parentL - 5, botY);
        ctx.fillText("3'", p3x, p3y);

        // Upper template end: 3'
        ctx.textAlign = 'left';
        const [u3x, u3y] = s(rightX + 6, upY);
        ctx.fillText("3'", u3x, u3y);
        // Leading strand end: 5'
        const [l5x, l5y] = s(rightX + 6, upY + leadOff + 2);
        dirStyle(c.leading);
        ctx.fillText("5'", l5x, l5y);

        // Lower template end: 5'
        dirStyle(c.textMuted);
        const [lo5x, lo5y] = s(rightX + 6, loY);
        ctx.fillText("5'", lo5x, lo5y);

        // Lagging strand label near fork: 5'
        dirStyle(c.lagging);
        const [lag5x, lag5y] = lerp(forkX, botY, rightX, loY, 0.01);
        const [lag5sx, lag5sy] = s(lag5x - 12, lag5y + lagOff - 2);
        ctx.textAlign = 'right';
        ctx.fillText("5'", lag5sx, lag5sy);

        // Leading strand near fork: 3'
        dirStyle(c.leading);
        ctx.textAlign = 'right';
        const [lead3x, lead3y] = s(forkX + 5, topY + leadOff + 5);
        ctx.fillText("3'", lead3x, lead3y);

        // --- Strand labels (Leading / Lagging) ---
        ctx.save();
        ctx.font = '600 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = c.leading;
        const [llx, lly] = s(forkX + 160, topY - 40 + leadOff + 28);
        ctx.fillText('Leading strand (continuous)', llx, lly);
        ctx.fillStyle = c.lagging;
        const [lgx, lgy] = lerp(forkX, botY, rightX, loY, 0.35);
        const [lgsx, lgsy] = s(lgx + 10, lgy + lagOff - 18);
        ctx.fillText('Lagging strand (Okazaki fragments)', lgsx, lgsy);
        ctx.restore();

        // --- Parent DNA label ---
        ctx.save();
        ctx.font = '500 11px Inter, sans-serif';
        ctx.fillStyle = c.textMuted;
        ctx.textAlign = 'center';
        const [pdx, pdy] = s((parentL + forkX) / 2, midY + gap + 28);
        ctx.fillText('Parent DNA', pdx, pdy);
        ctx.restore();

        // --- Fork movement arrow ---
        ctx.save();
        ctx.font = '500 10px Inter, sans-serif';
        ctx.fillStyle = c.arrowColor;
        ctx.textAlign = 'center';
        const [fax, fay] = s((parentL + forkX) / 2, midY - gap - 22);
        ctx.fillText('\u2190 Fork moves', fax, fay);
        ctx.restore();

        // --- Enzyme pills ---
        // Helicase at fork
        this._pill(s(forkX + 2, midY), 'helicase', ENZYMES.helicase, scale);
        // Topoisomerase ahead
        this._pill(s(parentL + 60, midY - gap - 38), 'topoisomerase', ENZYMES.topoisomerase, scale);
        // SSB on upper template
        const [ssb1x, ssb1y] = lerp(forkX, topY, rightX, upY, 0.5);
        this._drawSSBdots(s(ssb1x, ssb1y - 8), ENZYMES.ssb.color, scale);
        this._pillSmall(s(ssb1x + 30, ssb1y - 22), 'ssb', ENZYMES.ssb, scale);
        // SSB on lower template
        const [ssb2x, ssb2y] = lerp(forkX, botY, rightX, loY, 0.45);
        this._drawSSBdots(s(ssb2x, ssb2y + 8), ENZYMES.ssb.color, scale);

        // DNA Pol III on leading
        const [pol3Lx, pol3Ly] = lerp(forkX, topY, rightX, upY, 0.55);
        this._pill(s(pol3Lx, pol3Ly + leadOff + 22), 'dnaPol3', ENZYMES.dnaPol3, scale);

        // DNA Pol III on lagging (fragment 1)
        const [pol3Fx, pol3Fy] = lerp(forkX, botY, rightX, loY, 0.14);
        this._pill(s(pol3Fx, pol3Fy + lagOff - 20), 'dnaPol3', ENZYMES.dnaPol3, scale, 'Pol III');

        // Primase near fork on lagging template
        const [primX, primY] = lerp(forkX, botY, rightX, loY, 0.025);
        this._pill(s(primX + 20, primY + 26), 'primase', ENZYMES.primase, scale);

        // DNA Pol I (removing primer on fragment 2)
        const [pol1x, pol1y] = lerp(forkX, botY, rightX, loY, 0.30);
        this._pill(s(pol1x, pol1y + lagOff - 20), 'dnaPol1', ENZYMES.dnaPol1, scale);

        // Ligase (between fragments 2 and 3)
        const [ligx, ligy] = lerp(forkX, botY, rightX, loY, 0.55);
        this._pill(s(ligx, ligy + lagOff - 20), 'ligase', ENZYMES.ligase, scale);

        // Telomerase indicator (bottom right corner)
        this._pill(s(rightX - 50, loY + 38), 'telomerase', ENZYMES.telomerase, scale);

        // --- Primer legend chip ---
        ctx.save();
        ctx.font = '500 10px Inter, sans-serif';
        const [plx, ply] = lerp(forkX, botY, rightX, loY, 0.70);
        const [plsx, plsy] = s(plx, ply + lagOff - 18);
        ctx.fillStyle = c.primer;
        ctx.fillRect(plsx, plsy - 4 * scale, 20 * scale, 4 * scale);
        ctx.fillStyle = c.textMuted;
        ctx.textAlign = 'left';
        ctx.fillText('= RNA primer', plsx + 24 * scale, plsy);
        ctx.restore();
    }

    // --- Drawing helpers ---

    _drawLine([x1, y1], [x2, y2], color, width, rounded = false) {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = rounded ? 'round' : 'butt';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.restore();
    }

    _drawCurve([x1, y1], [cx, cy], [x2, y2], color, width) {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cx, cy, x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    _drawSynthArrow([x1, y1], [x2, y2], color, scale) {
        const ctx = this.ctx;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len < 5) return;
        const ux = dx / len, uy = dy / len;
        const headLen = 10 * scale;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(midX + ux * headLen, midY + uy * headLen);
        ctx.lineTo(midX - uy * headLen * 0.45, midY + ux * headLen * 0.45);
        ctx.lineTo(midX + uy * headLen * 0.45, midY - ux * headLen * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    _drawSSBdots([x, y], color, scale) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6;
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.arc(x + i * 10 * scale, y, 3 * scale, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    _pill([x, y], enzymeKey, enzyme, scale, overrideLabel) {
        const ctx = this.ctx;
        const label = overrideLabel || enzyme.shortName;
        const isSelected = this.selectedEnzyme === enzymeKey;
        const isHovered = this.hoveredPill === enzymeKey;

        ctx.save();
        ctx.font = this.colors.pillFont;
        const tw = ctx.measureText(label).width;
        const pw = tw + 16 * scale;
        const ph = 22 * scale;
        const px = x - pw / 2;
        const py = y - ph / 2;

        // Store hit region
        this._pills.push({ key: enzymeKey, x: px, y: py, w: pw, h: ph });

        // Glow if selected
        if (isSelected || isHovered) {
            ctx.shadowColor = enzyme.color;
            ctx.shadowBlur = 14 * scale;
        }

        // Background
        ctx.fillStyle = isSelected
            ? enzyme.color
            : (isHovered ? enzyme.color + '55' : (this.theme === 'dark' ? 'rgba(13,17,23,0.88)' : 'rgba(255,255,255,0.92)'));
        ctx.strokeStyle = enzyme.color;
        ctx.lineWidth = (isSelected ? 2 : 1.2) * scale;
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 6 * scale);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.shadowBlur = 0;
        ctx.fillStyle = isSelected ? '#fff' : enzyme.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y + 0.5);
        ctx.restore();
    }

    _pillSmall([x, y], enzymeKey, enzyme, scale) {
        const ctx = this.ctx;
        const label = enzyme.shortName;
        const isSelected = this.selectedEnzyme === enzymeKey;
        const isHovered = this.hoveredPill === enzymeKey;

        ctx.save();
        ctx.font = this.colors.pillFontSm;
        const tw = ctx.measureText(label).width;
        const pw = tw + 12 * scale;
        const ph = 18 * scale;
        const px = x - pw / 2;
        const py = y - ph / 2;

        this._pills.push({ key: enzymeKey, x: px, y: py, w: pw, h: ph });

        if (isSelected || isHovered) {
            ctx.shadowColor = enzyme.color;
            ctx.shadowBlur = 10 * scale;
        }

        ctx.fillStyle = isSelected
            ? enzyme.color
            : (this.theme === 'dark' ? 'rgba(13,17,23,0.85)' : 'rgba(255,255,255,0.9)');
        ctx.strokeStyle = enzyme.color;
        ctx.lineWidth = (isSelected ? 1.8 : 1) * scale;
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 5 * scale);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = isSelected ? '#fff' : enzyme.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y + 0.5);
        ctx.restore();
    }

    // Hit test: returns enzyme key or null
    hitTest(mx, my) {
        for (const p of this._pills) {
            if (mx >= p.x && mx <= p.x + p.w && my >= p.y && my <= p.y + p.h) {
                return p.key;
            }
        }
        return null;
    }
}
