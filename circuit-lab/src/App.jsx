import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, GRID, getModulesInCategory, moduleById } from "./modules/registry";
import { runSimulation } from "./sim/runSimulation";

let idSeq = 1;
const uid = (p) => `${p}${idSeq++}`;

const DEFAULT_DEMO = () => {
    const g1 = uid("g");
    const b1 = uid("v");
    const r1 = uid("r");
    const l1 = uid("l");
    return {
        instances: [
            { id: g1, typeId: "gnd", x: 200, y: 320, props: {} },
            { id: b1, typeId: "vbat", x: 200, y: 120, props: { v: 9 } },
            { id: r1, typeId: "res", x: 200, y: 200, props: { r: 1000 } },
            { id: l1, typeId: "led", x: 200, y: 260, props: {} },
        ],
        wires: [
            { id: uid("w"), a: { inst: b1, pin: "n" }, b: { inst: g1, pin: "g" } },
            { id: uid("w"), a: { inst: b1, pin: "p" }, b: { inst: r1, pin: "a" } },
            { id: uid("w"), a: { inst: r1, pin: "b" }, b: { inst: l1, pin: "a" } },
            { id: uid("w"), a: { inst: l1, pin: "k" }, b: { inst: g1, pin: "g" } },
        ],
    };
};

function snap(v) {
    return Math.round(v / GRID) * GRID;
}

function useWorldTransform() {
    const [view, setView] = useState({ x: 80, y: 20, s: 1 });
    const toWorld = useCallback(
        (clientX, clientY, el) => {
            const r = el.getBoundingClientRect();
            const x = (clientX - r.left - view.x) / view.s;
            const y = (clientY - r.top - view.y) / view.s;
            return { x, y };
        },
        [view],
    );
    return { view, setView, toWorld };
}

function ModuleNode({ def, x, y, inst, onPinDown, onDouble, selected, onDragStart, simInfo }) {
    const ps = def.pins;
    const w = def.w;
    const h = def.h;
    const g = (inst.typeId === "gnd" && "M 0,8 L-18,8 M-6,8 L-6,20 L6,8 L6,20 M0,2 L-10,0 L0,-4 L10,0 Z") || undefined;
    const rLed = (inst.typeId === "led" && simInfo?.brightness) || 0;
    return (
        <g
            transform={`translate(${x} ${y})`}
            onPointerDown={(e) => {
                if (e.target.closest("[data-pin]")) return;
                e.stopPropagation();
                onDragStart(e, inst);
            }}
            onDoubleClick={() => onDouble?.(inst)}
            style={{ cursor: "grab" }}
        >
            <rect
                x={-w / 2 - 4}
                y={-h / 2 - 4}
                width={w + 8}
                height={h + 8}
                rx={10}
                fill="var(--panel)"
                stroke={selected ? "var(--accent-2)" : "transparent"}
                strokeWidth={2}
            />
            {g ? (
                <path
                    d={g}
                    fill="var(--c-gnd-line)"
                    stroke="var(--c-gnd-line)"
                    strokeWidth="1.2"
                />
            ) : null}
            {inst.typeId === "led" ? (
                <circle r={10} fill={`rgba(180, 255, 200, ${0.1 + 0.55 * rLed})`} />
            ) : null}
            {inst.typeId !== "gnd" ? (
                <text
                    x={0}
                    y={-h / 2 - 2}
                    textAnchor="middle"
                    fill="var(--muted)"
                    style={{ fontSize: 9, userSelect: "none" }}
                >
                    {def.shortName}
                </text>
            ) : null}
            <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, userSelect: "none", fontWeight: 600 }} fill="var(--ink)">
                {def.name}
            </text>
            {ps.map((p) => {
                const px = p.x;
                const py = p.y;
                return (
                    <g key={p.id} data-pin>
                        <circle
                            data-pin
                            cx={px}
                            cy={py}
                            r={5}
                            fill="var(--pin)"
                            stroke="var(--ink-soft)"
                            strokeWidth={0.5}
                            onPointerDown={(e) => onPinDown(e, inst, p.id)}
                        />
                    </g>
                );
            })}
        </g>
    );
}

function wirePath(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1) * 0.45;
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function App() {
    const [store, setStore] = useState(() => DEFAULT_DEMO());
    const { view, setView, toWorld } = useWorldTransform();
    const svgRef = useRef(null);
    const handPan = useRef(false);
    const dragR = useRef(null);
    const [tool, setTool] = useState("sel");
    const [wireFrom, setWireFrom] = useState(null);
    const [sel, setSel] = useState(null);
    const [search, setSearch] = useState("");
    const [cat, setCat] = useState("power");
    const [readout, setReadout] = useState({ ok: true, v: null, byInst: new Map() });

    const instById = useMemo(() => {
        const m = new Map();
        for (const i of store.instances) m.set(i.id, i);
        return m;
    }, [store.instances]);

    const sim = useCallback(() => {
        const r = runSimulation(store);
        if (r.ok) {
            setReadout({ ok: true, v: r.v, byInst: r.byInst });
        } else {
            setReadout({ ok: false, error: r.error, v: null, byInst: new Map() });
        }
    }, [store]);

    useEffect(() => {
        sim();
    }, [sim]);

    const worldPin = (iid, pid) => {
        const inst = instById.get(iid);
        if (!inst) return { x: 0, y: 0 };
        const d = moduleById.get(inst.typeId);
        if (!d) return { x: inst.x, y: inst.y };
        const p = d.pins.find((x) => x.id === pid);
        if (!p) return { x: inst.x, y: inst.y };
        return { x: inst.x + p.x, y: inst.y + p.y };
    };

    const onPointerMove = (e) => {
        const d = dragR.current;
        if (d && svgRef.current) {
            const w = toWorld(e.clientX, e.clientY, svgRef.current);
            setStore((s) => ({
                ...s,
                instances: s.instances.map((it) =>
                    it.id === d.id
                        ? { ...it, x: snap(d.x0 + (w.x - d.w0x)), y: snap(d.y0 + (w.y - d.w0y)) }
                        : it,
                ),
            }));
        } else if (handPan.current) {
            setView((v) => ({ ...v, x: v.x + e.movementX, y: v.y + e.movementY }));
        }
    };
    const onWheel = (e) => {
        e.preventDefault();
        const z = e.deltaY > 0 ? 0.92 : 1.08;
        setView((v) => ({ ...v, s: Math.min(2, Math.max(0.3, v.s * z)) }));
    };

    const onPinDown = (e, inst, pin) => {
        e.stopPropagation();
        if (e.button !== 0) return;
        if (tool === "sel") {
            setSel({ kind: "mod", id: inst.id });
            return;
        }
        if (tool === "wire") {
            if (wireFrom) {
                if (wireFrom.inst !== inst.id || wireFrom.pin !== pin) {
                    const idw = uid("w");
                    setStore((s) => ({
                        ...s,
                        wires: [
                            ...s.wires,
                            { id: idw, a: { inst: wireFrom.inst, pin: wireFrom.pin }, b: { inst: inst.id, pin } },
                        ],
                    }));
                }
                setWireFrom(null);
            } else {
                setWireFrom({ inst: inst.id, pin });
            }
        }
    };

    const startDrag = (e, inst) => {
        if (e.button !== 0 || tool !== "sel" || !svgRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        setSel({ kind: "mod", id: inst.id });
        const w = toWorld(e.clientX, e.clientY, svgRef.current);
        dragR.current = { id: inst.id, x0: inst.x, y0: inst.y, w0x: w.x, w0y: w.y };
    };

    const endPointer = () => {
        dragR.current = null;
        handPan.current = false;
    };

    const addPart = (typeId) => {
        const newId = uid("p");
        const pdef = moduleById.get(typeId);
        setStore((s) => ({
            ...s,
            instances: [
                ...s.instances,
                { id: newId, typeId, x: 320, y: 240, props: { ...pdef?.defaultProps } },
            ],
        }));
        setSel({ kind: "mod", id: newId });
    };

    const deleteSel = () => {
        if (!sel) return;
        if (sel.kind === "mod") {
            setStore((s) => ({
                instances: s.instances.filter((i) => i.id !== sel.id),
                wires: s.wires.filter((w) => w.a.inst !== sel.id && w.b.inst !== sel.id),
            }));
        } else {
            setStore((s) => ({ ...s, wires: s.wires.filter((w) => w.id !== sel.id) }));
        }
        setSel(null);
    };

    const selectedInst = sel?.kind === "mod" ? instById.get(sel.id) : null;
    const selectedDef = selectedInst ? moduleById.get(selectedInst.typeId) : null;

    const setProp = (k, v) => {
        if (!selectedInst) return;
        setStore((s) => ({
            ...s,
            instances: s.instances.map((i) => (i.id === selectedInst.id ? { ...i, props: { ...i.props, [k]: v } } : i)),
        }));
    };

    const palette = getModulesInCategory(cat).filter(
        (d) =>
            d.name.toLowerCase().includes(search.toLowerCase()) || d.shortName.toLowerCase().includes(search.toLowerCase()),
    );

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") {
                setWireFrom(null);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <div className="cl-app">
            <header className="cl-header">
                <div>
                    <h1 className="cl-title">Circuit Lab</h1>
                    <p className="cl-kicker">Modular workbench with DC MNA. Pan: middle‑drag. Zoom: scroll.</p>
                </div>
                <div className="cl-header-actions">
                    <button type="button" className="cl-btn" onClick={() => setStore(DEFAULT_DEMO())}>
                        Reset demo
                    </button>
                    <button
                        type="button"
                        className="cl-btn cl-btn--primary"
                        onClick={sim}
                    >
                        Re‑run sim
                    </button>
                </div>
            </header>

            <div className="cl-body">
                <aside className="cl-palette">
                    <div className="cl-search">
                        <input
                            className="cl-input"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search parts…"
                            aria-label="Search parts"
                        />
                    </div>
                    <div className="cl-cat" role="tablist" aria-label="Part categories">
                        {CATEGORIES.map((c) => (
                            <button
                                type="button"
                                key={c.id}
                                className={c.id === cat ? "is-active" : ""}
                                onClick={() => setCat(c.id)}
                                role="tab"
                                aria-selected={c.id === cat}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                    <div className="cl-parts" role="list">
                        {palette.map((d) => (
                            <button
                                type="button"
                                key={d.typeId}
                                className="cl-part"
                                onClick={() => addPart(d.typeId)}
                            >
                                <span className="cl-part-tag" style={{ color: d.accent || d.color }}>{d.shortName}</span>
                                <span className="cl-part-name">{d.name}</span>
                            </button>
                        ))}
                    </div>
                </aside>

                <div className="cl-stage" onPointerLeave={endPointer} onPointerUp={endPointer} onPointerMove={onPointerMove} onPointerCancel={endPointer}>
                    <div className="cl-toolbar" role="toolbar" aria-label="Tools">
                        <button type="button" className={tool === "sel" ? "is-active" : ""} onClick={() => { setTool("sel"); setWireFrom(null); }} title="Select and drag parts (canvas)">
                            Select
                        </button>
                        <button
                            type="button"
                            className={tool === "wire" ? "is-active" : ""}
                            onClick={() => {
                                setTool("wire");
                                setWireFrom(null);
                            }}
                            title="Wire: click A then B"
                        >
                            Wire
                        </button>
                        <div className="cl-bar-div" />
                        <span className="cl-hint">Select parts with pins, or use Wire. Esc clears a wire start.</span>
                    </div>
                    <svg
                        className="cl-svg"
                        ref={svgRef}
                        onWheel={onWheel}
                        onPointerDown={(e) => {
                            if (e.button === 1) {
                                e.preventDefault();
                                handPan.current = true;
                            }
                        }}
                    >
                        <g transform={`translate(${view.x} ${view.y}) scale(${view.s})`}>
                            <rect x={-1e4} y={-1e4} width={2e4} height={2e4} fill="url(#g)" onPointerDown={() => { setSel(null); }} style={{ pointerEvents: "all" }} />
                            <defs>
                                <pattern id="g" width={16} height={16} patternUnits="userSpaceOnUse">
                                    <path d="M0 0 L0 16 M0 0 L16 0" fill="none" stroke="var(--grid)" strokeWidth={0.5} />
                                </pattern>
                            </defs>
                            {store.wires.map((w) => {
                                const a = worldPin(w.a.inst, w.a.pin);
                                const b = worldPin(w.b.inst, w.b.pin);
                                return (
                                    <path
                                        key={w.id}
                                        d={wirePath(a.x, a.y, b.x, b.y)}
                                        fill="none"
                                        stroke={sel?.kind === "wire" && sel.id === w.id ? "var(--accent-2)" : "var(--wire)"}
                                        strokeWidth={2.5 * (1 / view.s)}
                                        onPointerDown={(e) => {
                                            e.stopPropagation();
                                            setSel({ kind: "wire", id: w.id });
                                        }}
                                        style={{ pointerEvents: "stroke", cursor: "pointer" }}
                                    />
                                );
                            })}
                            {store.instances.map((inst) => {
                                const d = moduleById.get(inst.typeId);
                                if (!d) return null;
                                const simInfo = readout?.byInst?.get(inst.id);
                                return (
                                    <ModuleNode
                                        key={inst.id}
                                        def={d}
                                        x={inst.x}
                                        y={inst.y}
                                        inst={inst}
                                        onPinDown={onPinDown}
                                        selected={sel?.kind === "mod" && sel.id === inst.id}
                                        onDouble={(it) => {
                                            if (it.typeId === "sw") {
                                                setStore((s) => ({
                                                    ...s,
                                                    instances: s.instances.map((i) => (i.id === it.id ? { ...i, props: { ...i.props, closed: !i.props?.closed } } : i)),
                                                }));
                                            } else if (it.typeId === "btn") {
                                                setStore((s) => ({
                                                    ...s,
                                                    instances: s.instances.map((i) => (i.id === it.id ? { ...i, props: { ...i.props, pressed: !i.props?.pressed } } : i)),
                                                }));
                                            }
                                        }}
                                        onDragStart={startDrag}
                                        simInfo={simInfo}
                                    />
                                );
                            })}
                        </g>
                    </svg>
                </div>

                <aside className="cl-ins">
                    {readout.ok ? (
                        <div className="cl-readout" role="status">
                            Nodes: {readout.v?.length ?? 0} · re‑ground your nets if results look odd
                        </div>
                    ) : (
                        <div className="cl-err" role="alert">
                            {readout.error ?? "Simulation error."}
                        </div>
                    )}

                    {selectedInst && selectedDef ? (
                        <div className="cl-panel">
                            <h2>{selectedDef.name}</h2>
                            <p className="cl-des">{selectedDef.description}</p>
                            {selectedDef.typeId === "vbat" || selectedDef.typeId === "res" || selectedDef.typeId === "pot" ? (
                                <label className="cl-field">
                                    {selectedDef.typeId === "vbat" ? "Voltage (V)" : "Resistance (Ω)"}
                                    {selectedDef.typeId === "pot" ? " / taper" : ""}
                                    {selectedDef.typeId === "vbat" && (
                                        <input
                                            type="number"
                                            className="cl-input"
                                            value={Number(selectedInst.props?.v) || 0}
                                            onChange={(e) => setProp("v", Number(e.target.value))}
                                        />
                                    )}
                                    {selectedDef.typeId === "res" && (
                                        <input
                                            type="number"
                                            className="cl-input"
                                            value={Number(selectedInst.props?.r) || 0}
                                            onChange={(e) => setProp("r", Number(e.target.value))}
                                        />
                                    )}
                                    {selectedDef.typeId === "pot" && (
                                        <>
                                            <input
                                                type="number"
                                                className="cl-input"
                                                value={Number(selectedInst.props?.r) || 1000}
                                                onChange={(e) => setProp("r", Number(e.target.value))}
                                            />
                                            <input
                                                type="range"
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                value={Number(selectedInst.props?.t) ?? 0.5}
                                                onChange={(e) => setProp("t", Number(e.target.value))}
                                            />
                                        </>
                                    )}
                                </label>
                            ) : null}
                            {["sw", "btn", "npn", "nmos"].includes(selectedDef.typeId) && (
                                <label className="cl-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <input
                                        type="checkbox"
                                        checked={
                                            selectedDef.typeId === "sw"
                                                ? Boolean(selectedInst.props?.closed)
                                                : selectedDef.typeId === "btn"
                                                  ? Boolean(selectedInst.props?.pressed)
                                                  : Boolean(selectedInst.props?.on)
                                        }
                                        onChange={(e) => {
                                            const c = e.target.checked;
                                            if (selectedDef.typeId === "sw") setProp("closed", c);
                                            else if (selectedDef.typeId === "btn") setProp("pressed", c);
                                            else setProp("on", c);
                                        }}
                                    />
                                    {selectedDef.typeId === "sw" ? "Closed" : selectedDef.typeId === "btn" ? "Pressed" : "On (simplified model)"}
                                </label>
                            )}
                            {readout.byInst?.get(selectedInst.id)?.mA != null && <div className="cl-stat">LED drive: {readout.byInst.get(selectedInst.id).mA.toFixed(1)} mA (linearized model)</div>}
                            {readout.byInst?.get(selectedInst.id)?.vRead != null && <div className="cl-stat">ΔV: {readout.byInst.get(selectedInst.id).vRead.toFixed(3)} V</div>}
                            {readout.byInst?.get(selectedInst.id)?.aRead != null && <div className="cl-stat">I: {readout.byInst.get(selectedInst.id).aRead.toFixed(4)} A</div>}
                            {readout.byInst?.get(selectedInst.id)?.vOut != null && <div className="cl-stat">Out: {readout.byInst.get(selectedInst.id).vOut.toFixed(2)} V</div>}
                            {readout.byInst?.get(selectedInst.id)?.w != null && <div className="cl-stat">P: {readout.byInst.get(selectedInst.id).w.toFixed(3)} W</div>}

                            <div className="cl-row">
                                <button type="button" className="cl-btn" onClick={deleteSel} aria-label="Delete selected part">
                                    Delete
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="cl-tip">Add parts from the left. Click a pin in <strong>Select</strong> to start wiring, or switch to <strong>Wire</strong>. Connect your battery return to <strong>GND</strong> so the reference is defined.</p>
                    )}
                </aside>
            </div>
        </div>
    );
}
