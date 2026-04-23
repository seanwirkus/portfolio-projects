import { moduleById } from "../modules/registry";
import { solveDC } from "./mna.js";

const OPEN = 1e12;
const C_DC = 1e12;
const L_DC = 1e-6;
const AMM_SHUNT = 0.001;

class DSU {
    constructor() {
        this.p = new Map();
    }
    id(k) {
        if (!this.p.has(k)) this.p.set(k, k);
        return this.p.get(k);
    }
    find(k) {
        let v = this.id(k);
        if (v !== this.p.get(v)) {
            v = this.find(this.p.get(v));
            this.p.set(k, v);
        }
        return v;
    }
    union(a, b) {
        const ra = this.find(a);
        const rb = this.find(b);
        if (ra !== rb) {
            this.p.set(ra, rb);
        }
    }
}

function k(instId, pin) {
    return `${instId}::${pin}`;
}

/**
 * @param {object} circuit
 * @param {Array} circuit.instances
 * @param {Array} circuit.wires
 */
export function runSimulation(circuit) {
    const { instances, wires } = circuit;
    if (!instances.some((i) => i.typeId === "gnd")) {
        return { ok: false, error: "Add a GND and tie it to your return rail." };
    }

    const dsu = new DSU();
    for (const w of wires) {
        dsu.union(k(w.a.inst, w.a.pin), k(w.b.inst, w.b.pin));
    }
    for (const inst of instances) {
        if (inst.typeId === "gnd") {
            dsu.union(k(inst.id, "g"), "__gnd__");
        }
    }

    const seenRoots = new Set();
    for (const inst of instances) {
        const d = moduleById.get(inst.typeId);
        if (!d) continue;
        for (const p of d.pins) {
            seenRoots.add(dsu.find(k(inst.id, p.id)));
        }
    }
    if (!seenRoots.has(dsu.find("__gnd__"))) {
        return { ok: false, error: "Ground net is not connected to any part pin." };
    }

    const gRoot = dsu.find("__gnd__");
    const roots = [...seenRoots].filter((r) => r);
    if (!roots.includes(gRoot)) {
        return { ok: false, error: "Internal: ground not in net set." };
    }
    const others = roots.filter((r) => r !== gRoot).sort();
    const rootToNode = new Map();
    rootToNode.set(gRoot, 0);
    let n = 1;
    for (const r of others) {
        rootToNode.set(r, n++);
    }
    const nNet = roots.length;
    const pinNode = (iid, pid) => rootToNode.get(dsu.find(k(iid, pid)));

    let nTotal = nNet;
    const allocNode = () => nTotal++;

    const resistors = [];
    const vsources = [];
    const meters = { voltmeters: [], ammeters: [], leds: [], lamps: [] };
    const compMeters = [];

    function addR(na, nb, r) {
        if (na === nb) return;
        if (!Number.isFinite(r) || r <= 0) return;
        resistors.push({ a: na, b: nb, r: Math.min(OPEN, r) });
    }
    function addV(nP, nM, v) {
        if (nP === nM) return;
        vsources.push({ plus: nP, minus: nM, v });
    }

    for (const inst of instances) {
        const d = moduleById.get(inst.typeId);
        if (!d?.sim) continue;
        const p = (pin) => pinNode(inst.id, pin);
        const { kind } = d.sim;
        const props = { ...d.defaultProps, ...inst.props };

        switch (kind) {
            case "ground":
                break;
            case "vsource":
                addV(p("p"), p("n"), Number(props.v) || 0);
                break;
            case "vreg":
                addV(p("out"), p("g"), 5);
                break;
            case "resistor": {
                const r = Math.max(1e-6, Math.min(OPEN, Number(props.r) || 1000));
                addR(p("a"), p("b"), r);
                break;
            }
            case "cap":
                addR(p("a"), p("b"), C_DC);
                break;
            case "ind":
                addR(p("a"), p("b"), L_DC);
                break;
            case "pot": {
                const t = Math.min(0.999, Math.max(0.001, Number(props.t) ?? 0.5));
                const r = Math.max(1, Number(props.r) || 1000);
                addR(p("a"), p("w"), Math.max(1e-6, (1 - t) * r));
                addR(p("w"), p("b"), Math.max(1e-6, t * r));
                break;
            }
            case "sw":
                addR(p("a"), p("b"), props.closed ? 0.02 : OPEN);
                break;
            case "button":
                addR(p("a"), p("b"), props.pressed ? 0.02 : OPEN);
                break;
            case "led": {
                const rL = 200;
                addR(p("a"), p("k"), rL);
                meters.leds.push({ inst, na: p("a"), nk: p("k"), r: rL });
                break;
            }
            case "diode": {
                const h = allocNode();
                const va = p("a");
                const vk = p("k");
                addV(va, h, 0.65);
                addR(h, vk, 5);
                break;
            }
            case "zener":
                addR(p("a"), p("k"), 75);
                break;
            case "npn":
                addR(p("c"), p("e"), props.on ? 0.5 : OPEN);
                break;
            case "nmos":
                addR(p("d"), p("s"), props.on ? 0.2 : OPEN);
                break;
            case "lamp": {
                const r = Math.max(0.1, Number(props.r) || 12);
                addR(p("a"), p("b"), r);
                meters.lamps.push({ inst, na: p("a"), nb: p("b"), r });
                break;
            }
            case "vprobe":
                meters.voltmeters.push({ inst, nPos: p("p"), nNeg: p("g") });
                break;
            case "ammeter": {
                const a = p("a");
                const b = p("b");
                addR(a, b, AMM_SHUNT);
                meters.ammeters.push({ inst, a, b, r: AMM_SHUNT });
                break;
            }
            case "opamp":
                addV(p("p"), p("o"), 0);
                break;
            case "comparator":
                compMeters.push({ inst, n: p("n"), po: p("p"), o: p("o") });
                break;
            case "none":
            default:
                break;
        }
    }

    const compDrives = compMeters.map(() => 0.02);

    function solveWithComp() {
        const vs = vsources.slice();
        for (let i = 0; i < compMeters.length; i++) {
            const c = compMeters[i];
            const vout = compDrives[i];
            if (c.o !== 0) {
                vs.push({ plus: c.o, minus: 0, v: vout });
            }
        }
        return solveDC({ n: nTotal, resistors, vsources: vs });
    }

    let res = solveWithComp();
    if (!res.ok) {
        return { ok: false, error: res.error || "DC failed" };
    }

    for (let it = 0; it < 10; it++) {
        let changed = false;
        for (let i = 0; i < compMeters.length; i++) {
            const c = compMeters[i];
            const vp = res.v[c.po] - res.v[c.n];
            const vnew = vp > 0 ? 5 : 0.02;
            if (Math.abs(vnew - compDrives[i]) > 1e-4) {
                changed = true;
            }
            compDrives[i] = vnew;
        }
        if (!changed) break;
        res = solveWithComp();
        if (!res.ok) {
            return { ok: false, error: res.error || "DC failed (comparator loop)" };
        }
    }

    if (!res.ok) {
        return { ok: false, error: res.error || "DC failed" };
    }

    const { v } = res;
    const byInst = new Map();

    for (const inst of instances) {
        byInst.set(inst.id, { typeId: inst.typeId });
    }
    for (const vm of meters.voltmeters) {
        const dV = v[vm.nPos] - v[vm.nNeg];
        byInst.set(vm.inst.id, { ...byInst.get(vm.inst.id), vRead: dV, unit: "V" });
    }
    for (const am of meters.ammeters) {
        const aI = (v[am.a] - v[am.b]) / am.r;
        byInst.set(am.inst.id, { ...byInst.get(am.inst.id), aRead: aI, unit: "A" });
    }
    for (const l of meters.leds) {
        const aI = (v[l.na] - v[l.nk]) / l.r;
        const b = Math.min(1, Math.max(0, Math.abs(aI) * 5));
        byInst.set(l.inst.id, { ...byInst.get(l.inst.id), brightness: b, mA: aI * 1000 });
    }
    for (const l of meters.lamps) {
        const aI = (v[l.na] - v[l.nb]) / l.r;
        const pwr = (aI * aI) * l.r;
        byInst.set(l.inst.id, { ...byInst.get(l.inst.id), brightness: Math.min(1, pwr / 2), w: pwr });
    }
    for (const c of compMeters) {
        byInst.set(c.inst.id, { ...byInst.get(c.inst.id), vOut: v[c.o] });
    }

    return { ok: true, v, byInst, nodeCount: nTotal };
}
