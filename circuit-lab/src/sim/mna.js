/**
 * DC MNA: resistors + ideal voltage sources. Node 0 = reference.
 * Unknowns: v[1..n-1] and j[0..b-1] (current through each V, + to -).
 * KCL: G v + A j = 0   where A's column k has -1 at the + node and +1 at the - node.
 * KVL: v(+) - v(-) = E (each as a row on the lower block, bottom-right 0 for ideal V).
 */

function augMat(dim) {
    return Array.from({ length: dim }, () => new Float64Array(dim + 1));
}

function gaussSolve(m) {
    const n = m.length;
    const c = m[0].length - 1;
    for (let k = 0; k < n; k++) {
        let piv = k;
        let best = Math.abs(m[k][k]);
        for (let r = k + 1; r < n; r++) {
            const v = Math.abs(m[r][k]);
            if (v > best) {
                best = v;
                piv = r;
            }
        }
        if (best < 1e-20) return null;
        if (piv !== k) {
            const t = m[k];
            m[k] = m[piv];
            m[piv] = t;
        }
        const d = m[k][k];
        for (let j = k; j <= c; j++) m[k][j] /= d;
        for (let r = 0; r < n; r++) {
            if (r === k) continue;
            const f = m[r][k];
            if (Math.abs(f) < 1e-20) continue;
            for (let j = k; j <= c; j++) m[r][j] -= f * m[k][j];
        }
    }
    return m.map((row) => row[c]);
}

/**
 * @param {object} p
 * @param {number} p.n
 * @param {Array<{a:number,b:number,r:number}>} p.resistors
 * @param {Array<{a:number,b:number,v:number, plus:number, minus:number}>} p.vsources
 *   plus and minus are node indices: v(plus) - v(minus) = v
 */
export function solveDC({ n, resistors, vsources }) {
    if (n < 2) {
        return { ok: true, v: new Float64Array(1) };
    }
    const mfree = n - 1; // nodes 1..mfree are unknowns
    const b = vsources.length;
    const dim = mfree + b;
    if (dim === 0) {
        return { ok: true, v: new Float64Array(n) };
    }
    const a = augMat(dim);

    for (const { a: na, b: nb, r } of resistors) {
        if (!Number.isFinite(r) || r <= 0) continue;
        const g = 1 / r;
        stampG(a, g, na, nb, mfree);
    }

    for (let k = 0; k < b; k++) {
        const vs = vsources[k];
        const p = vs.plus;
        const q = vs.minus;
        // KCL: column for j at index mfree + k
        const jcol = mfree + k;
        if (p > 0) a[p - 1][jcol] += -1;
        if (q > 0) a[q - 1][jcol] += 1;
        // KVL row: v(p) - v(q) = E
        const row = mfree + k;
        if (p > 0) a[row][p - 1] += 1;
        if (q > 0) a[row][q - 1] += -1;
        a[row][dim] = vs.v;
    }

    const x = gaussSolve(a);
    if (!x) {
        return { ok: false, error: "DC solve failed (singular system — add ground, check floating nets)." };
    }

    const v = new Float64Array(n);
    for (let i = 0; i < mfree; i++) v[i + 1] = x[i];
    const j = b ? x.subarray(mfree) : new Float64Array(0);
    return { ok: true, v, j };
}

function stampG(a, g, na, nb, m) {
    const rA = nRow(na, m);
    const rB = nRow(nb, m);
    if (rA >= 0 && rB >= 0) {
        a[rA][rA] += g;
        a[rB][rB] += g;
        a[rA][rB] -= g;
        a[rB][rA] -= g;
    } else if (rA >= 0) {
        a[rA][rA] += g;
    } else if (rB >= 0) {
        a[rB][rB] += g;
    }
}

function nRow(node, m) {
    if (node <= 0) return -1;
    return node - 1;
}
