import React, { startTransition, useEffect, useReducer } from "react";
import "./styles.css";
import {
    BASE_ORDER,
    BASES,
    COMPLEMENTS,
    CONCEPT_CARDS,
    formatComplement,
    formatSequence,
    gcContent,
    parseSequenceInput,
} from "./data";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getSavedTheme() {
    if (typeof window === "undefined") {
        return "dark";
    }

    return window.localStorage.getItem("dna-molecule-builder-theme") || "dark";
}

function createLogEntry(id, title, detail) {
    return { id, title, detail };
}

function createInitialState() {
    return {
        theme: getSavedTheme(),
        selectedBaseKey: "adenine",
        strand: [],
        pendingBaseKey: null,
        sequenceInput: "",
        showComplement: true,
        reducedMotion: false,
        highlightToken: 0,
        nextLogId: 2,
        status: "Select a deoxynucleotide and start a 5' end.",
        logs: [
            createLogEntry(
                1,
                "Ready to polymerize",
                "Choose a base, place the first nucleotide on the 5' end, then connect additional nucleotides through 3'→5' phosphodiester bonds.",
            ),
        ],
    };
}

function prependLog(state, title, detail, extra = {}) {
    return {
        ...state,
        ...extra,
        logs: [createLogEntry(state.nextLogId, title, detail), ...state.logs].slice(0, 6),
        nextLogId: state.nextLogId + 1,
    };
}

function reducer(state, action) {
    switch (action.type) {
        case "SET_THEME":
            return {
                ...state,
                theme: action.theme,
            };

        case "SET_REDUCED_MOTION":
            return {
                ...state,
                reducedMotion: action.value,
            };

        case "SELECT_BASE":
            return {
                ...state,
                selectedBaseKey: action.baseKey,
                status: `Selected ${BASES[action.baseKey].incoming}.`,
            };

        case "SET_SEQUENCE_INPUT":
            return {
                ...state,
                sequenceInput: action.value.toUpperCase(),
            };

        case "QUEUE_SELECTED": {
            const base = BASES[state.selectedBaseKey];

            if (state.strand.length === 0) {
                return prependLog(
                    {
                        ...state,
                        strand: [state.selectedBaseKey],
                        pendingBaseKey: null,
                        status: `Placed ${base.nucleotide} at the 5' end. Its 3' hydroxyl is now free for extension.`,
                    },
                    "Started the strand",
                    `${base.nucleotide} anchors the 5' end. The sugar already holds the base by a glycosidic bond, and the free 3' hydroxyl can attack the next phosphate.`,
                );
            }

            return prependLog(
                {
                    ...state,
                    pendingBaseKey: state.selectedBaseKey,
                    status: `${base.incoming} is aligned so its 5' phosphate can meet the current 3' hydroxyl.`,
                },
                "Loaded an incoming nucleotide",
                `${base.incoming} is waiting at the active site. The next step is to form the 3'→5' phosphodiester bond.`,
            );
        }

        case "FORM_BOND": {
            if (!state.pendingBaseKey) {
                return {
                    ...state,
                    status: "Load an incoming nucleotide first so the 3' hydroxyl has a phosphate to attack.",
                };
            }

            const incoming = BASES[state.pendingBaseKey];
            const priorBase = BASES[state.strand[state.strand.length - 1]];

            return prependLog(
                {
                    ...state,
                    strand: [...state.strand, state.pendingBaseKey],
                    pendingBaseKey: null,
                    highlightToken: state.highlightToken + 1,
                    status: `${priorBase.nucleotide} and ${incoming.nucleotide} are now joined by a 3'→5' phosphodiester bond.`,
                },
                "Phosphodiester bond formed",
                `The prior sugar's 3' oxygen is now linked to ${incoming.nucleotide}'s 5' phosphate. The sugar-phosphate backbone extends one nucleotide farther in the 5'→3' direction.`,
            );
        }

        case "APPEND_SEQUENCE": {
            if (action.baseKeys.length === 0) {
                return {
                    ...state,
                    status:
                        action.invalid.length > 0
                            ? `Only A, T, G, and C are accepted. Ignored: ${action.invalid.join(", ")}.`
                            : "Enter a DNA sequence using A, T, G, and C.",
                };
            }

            const nextStrand = [...state.strand, ...action.baseKeys];
            const invalidTail = action.invalid.length > 0 ? ` Ignored: ${action.invalid.join(", ")}.` : "";

            return prependLog(
                {
                    ...state,
                    strand: nextStrand,
                    pendingBaseKey: null,
                    sequenceInput: "",
                    highlightToken: state.highlightToken + 1,
                    status: `Extended the strand by ${action.baseKeys.length} nucleotide${action.baseKeys.length === 1 ? "" : "s"} through repeated phosphodiester formation.${invalidTail}`,
                },
                "Batch polymerization",
                `Added ${action.baseKeys.length} nucleotide${action.baseKeys.length === 1 ? "" : "s"} to the 3' end. Each addition repeats the same sugar-phosphate coupling chemistry.`,
            );
        }

        case "REMOVE_LAST": {
            if (state.strand.length === 0) {
                return {
                    ...state,
                    status: "The strand is empty.",
                };
            }

            const removed = BASES[state.strand[state.strand.length - 1]];

            return prependLog(
                {
                    ...state,
                    strand: state.strand.slice(0, -1),
                    pendingBaseKey: null,
                    status: `Removed ${removed.nucleotide} from the 3' end.`,
                },
                "Removed the terminal nucleotide",
                `The last phosphodiester linkage was rolled back so you can rebuild the strand tail.`,
            );
        }

        case "CLEAR_STRAND":
            return prependLog(
                {
                    ...state,
                    strand: [],
                    pendingBaseKey: null,
                    status: "Cleared the strand. Start again from the 5' end.",
                },
                "Strand reset",
                "The DNA builder has been cleared so you can reassemble the backbone from scratch.",
            );

        case "TOGGLE_COMPLEMENT":
            return {
                ...state,
                showComplement: !state.showComplement,
            };

        default:
            return state;
    }
}

function StatPill({ label, value, accent = "cool" }) {
    return (
        <div className={`stat-pill stat-pill--${accent}`}>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function BaseSelector({ selectedBaseKey, onSelect }) {
    return (
        <div className="base-selector" role="group" aria-label="Nucleotide selector">
            {BASE_ORDER.map((baseKey) => {
                const base = BASES[baseKey];
                return (
                    <button
                        key={baseKey}
                        type="button"
                        className={`base-chip${selectedBaseKey === baseKey ? " is-active" : ""}`}
                        data-base={base.letter}
                        onClick={() => onSelect(baseKey)}
                    >
                        <span className="base-chip__letter">{base.letter}</span>
                        <span className="base-chip__copy">
                            <strong>{base.incoming}</strong>
                            <span>Pairs with {base.pairLetter}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function SelectedNucleotide({ baseKey, onQueue, onBond, canBond, strandLength, pendingBaseKey }) {
    const base = BASES[baseKey];
    const isStarter = strandLength === 0;

    return (
        <section className="panel panel--soft">
            <div className="panel-head">
                <div>
                    <span className="eyebrow">Selected Nucleotide</span>
                    <h2>{base.incoming}</h2>
                </div>
                <div className="nucleotide-badge" data-base={base.letter}>
                    {base.letter}
                </div>
            </div>

            <div className="nucleotide-preview" data-base={base.letter}>
                <div className="nucleotide-preview__phosphate">PO₄</div>
                <div className="nucleotide-preview__sugar">
                    <span>2'</span>
                    <span>1'</span>
                    <span>3'</span>
                    <strong>deoxyribose</strong>
                </div>
                <div className="nucleotide-preview__base">{base.name}</div>
            </div>

            <div className="nucleotide-note">
                Base attaches at C1'. The 5' phosphate and 3' hydroxyl are the handles used to extend the backbone.
            </div>

            <div className="action-row">
                <button type="button" className="button button--primary" onClick={onQueue}>
                    {isStarter ? `Start with ${base.nucleotide}` : `Load ${base.incoming}`}
                </button>
                <button type="button" className="button button--ghost" onClick={onBond} disabled={!canBond}>
                    Form 3'→5' Bond
                </button>
            </div>

            <div className="action-caption">
                {isStarter
                    ? "The first nucleotide defines the 5' end."
                    : pendingBaseKey
                      ? "Incoming nucleotide is loaded. Connect it to the current 3' hydroxyl."
                      : "Load a nucleotide, then form the phosphodiester bond to extend the 3' end."}
            </div>
        </section>
    );
}

function Sugar({ cx, cy, className = "" }) {
    const points = [
        [cx - 34, cy - 6],
        [cx - 10, cy - 42],
        [cx + 30, cy - 28],
        [cx + 26, cy + 20],
        [cx - 14, cy + 34],
    ]
        .map((point) => point.join(","))
        .join(" ");

    return <polygon className={`workspace-sugar ${className}`.trim()} points={points} />;
}

function BackboneWorkspace({ strand, selectedBaseKey, pendingBaseKey, highlightToken, reducedMotion }) {
    const tailBaseKey = strand[strand.length - 1] || null;
    const tailBase = tailBaseKey ? BASES[tailBaseKey] : null;
    const selectedBase = BASES[selectedBaseKey];
    const pendingBase = pendingBaseKey ? BASES[pendingBaseKey] : null;
    const showIncoming = strand.length > 0;
    const incomingDisplayBase = pendingBase || selectedBase;
    const animateBond = highlightToken > 0 && !reducedMotion;

    return (
        <section className="panel workspace-panel">
            <div className="panel-head panel-head--stack">
                <div>
                    <span className="eyebrow">Assembly Workspace</span>
                    <h2>{strand.length === 0 ? "Starter Nucleotide" : "Backbone Coupling Reaction"}</h2>
                </div>
                <p>
                    {strand.length === 0
                        ? "Place the first nucleotide on the 5' end, then extend the chain from the free 3' hydroxyl."
                        : pendingBase
                          ? "The current strand terminus and the incoming nucleotide are aligned for phosphodiester bond formation."
                          : "Select an incoming nucleotide to see how the 3' hydroxyl and 5' phosphate meet."}
                </p>
            </div>

            <svg className="workspace-svg" viewBox="0 0 840 360" role="img" aria-label="DNA nucleotide assembly workspace">
                <defs>
                    <linearGradient id="tailFade" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.35)" />
                    </linearGradient>
                </defs>

                {strand.length > 1 && (
                    <>
                        <line className="workspace-backbone workspace-backbone--faded" x1="90" y1="190" x2="182" y2="190" />
                        <text className="workspace-caption" x="92" y="170">
                            Existing backbone
                        </text>
                    </>
                )}

                {tailBase ? (
                    <g className="workspace-tail">
                        <circle className="workspace-phosphate" cx="184" cy="190" r="28" />
                        <text className="workspace-phosphate-label" x="184" y="196">
                            PO₄
                        </text>
                        <line className="workspace-backbone" x1="212" y1="190" x2="280" y2="190" />
                        <Sugar cx={330} cy={190} />
                        <line className="workspace-backbone" x1="280" y1="190" x2="298" y2="190" />
                        <line className="workspace-base-link" x1="348" y1="148" x2="382" y2="106" />
                        <rect className="workspace-base" data-base={tailBase.letter} x="360" y="54" width="126" height="60" rx="18" />
                        <text className="workspace-base-text" x="423" y="78">
                            {tailBase.nucleotide}
                        </text>
                        <text className="workspace-base-subtext" x="423" y="98">
                            base + sugar
                        </text>
                        <circle className="workspace-oh" cx="394" cy="242" r="16" />
                        <text className="workspace-oh-label" x="394" y="247">
                            3'OH
                        </text>
                        <text className="workspace-atom-label" x="356" y="145">
                            1'
                        </text>
                        <text className="workspace-atom-label" x="382" y="232">
                            3'
                        </text>
                        <text className="workspace-atom-label" x="276" y="176">
                            5'
                        </text>
                    </g>
                ) : (
                    <g className="workspace-starter">
                        <circle className="workspace-phosphate" cx="280" cy="190" r="28" />
                        <text className="workspace-phosphate-label" x="280" y="196">
                            PO₄
                        </text>
                        <line className="workspace-backbone" x1="308" y1="190" x2="376" y2="190" />
                        <Sugar cx={426} cy={190} />
                        <line className="workspace-base-link" x1="444" y1="148" x2="478" y2="106" />
                        <rect className="workspace-base" data-base={selectedBase.letter} x="456" y="54" width="126" height="60" rx="18" />
                        <text className="workspace-base-text" x="519" y="78">
                            {selectedBase.nucleotide}
                        </text>
                        <text className="workspace-base-subtext" x="519" y="98">
                            starter unit
                        </text>
                        <circle className="workspace-oh" cx="490" cy="242" r="16" />
                        <text className="workspace-oh-label" x="490" y="247">
                            3'OH
                        </text>
                    </g>
                )}

                {showIncoming && (
                    <g className="workspace-incoming">
                        <circle className="workspace-phosphate workspace-phosphate--incoming" cx="566" cy="190" r="28" />
                        <text className="workspace-phosphate-label" x="566" y="196">
                            5'P
                        </text>
                        <line className="workspace-backbone" x1="594" y1="190" x2="660" y2="190" />
                        <Sugar cx={710} cy={190} className={pendingBase ? "workspace-sugar--active" : "workspace-sugar--ghost"} />
                        <line className="workspace-base-link" x1="728" y1="148" x2="762" y2="106" />
                        <rect className="workspace-base" data-base={incomingDisplayBase.letter} x="740" y="54" width="84" height="60" rx="18" />
                        <text className="workspace-base-text" x="782" y="78">
                            {incomingDisplayBase.letter}
                        </text>
                        <text className="workspace-base-subtext" x="782" y="98">
                            {pendingBase ? "incoming" : "selected"}
                        </text>
                        <circle className="workspace-oh workspace-oh--ghost" cx="774" cy="242" r="16" />
                        <text className="workspace-oh-label" x="774" y="247">
                            3'OH
                        </text>
                        <text className="workspace-caption" x="566" y="234">
                            Incoming nucleotide
                        </text>
                    </g>
                )}

                {tailBase && (
                    <>
                        <line
                            className={`workspace-bond-guide${pendingBase ? " workspace-bond-guide--armed" : ""}${animateBond ? " workspace-bond-guide--pulse" : ""}`}
                            x1="410"
                            y1="232"
                            x2="538"
                            y2="190"
                        />
                        <text className="workspace-annotation" x="478" y="162">
                            3' oxygen attacks 5' phosphate
                        </text>
                    </>
                )}

                <text className="workspace-end-label" x="152" y="286">
                    5' end
                </text>
                <text className="workspace-end-label" x="736" y="286">
                    3' end
                </text>
            </svg>
        </section>
    );
}

function StrandRibbon({ strand, showComplement, highlightToken, reducedMotion }) {
    const width = Math.max(960, strand.length * 140 + 220);
    const animateTail = highlightToken > 0 && !reducedMotion;

    return (
        <section className="panel ribbon-panel">
            <div className="panel-head">
                <div>
                    <span className="eyebrow">DNA Backbone</span>
                    <h2>Polymer Preview</h2>
                </div>
            </div>

            {strand.length === 0 ? (
                <div className="empty-state">
                    Start with a nucleotide to see the sugar-phosphate backbone grow across the strand.
                </div>
            ) : (
                <div className="ribbon-scroll">
                    <svg className="ribbon-svg" viewBox={`0 0 ${width} 360`} role="img" aria-label="Growing DNA strand preview">
                        <text className="ribbon-end-label" x="42" y="62">
                            5'
                        </text>
                        <text className="ribbon-end-label" x={width - 48} y="62">
                            3'
                        </text>

                        {strand.map((baseKey, index) => {
                            const base = BASES[baseKey];
                            const complement = BASES[COMPLEMENTS[baseKey]];
                            const sugarX = 120 + index * 140;
                            const phosphateX = 52 + index * 140;
                            const isNewest = index === strand.length - 1 && animateTail;

                            return (
                                <g key={`${baseKey}-${index}`} className={isNewest ? "ribbon-node ribbon-node--new" : "ribbon-node"}>
                                    <circle className="ribbon-phosphate" cx={phosphateX} cy="170" r="22" />
                                    <text className="ribbon-phosphate-label" x={phosphateX} y="176">
                                        P
                                    </text>
                                    <line className="ribbon-link" x1={phosphateX + 22} y1="170" x2={sugarX - 32} y2="170" />
                                    <polygon
                                        className="ribbon-sugar"
                                        points={`${sugarX - 28},164 ${sugarX - 8},132 ${sugarX + 26},146 ${sugarX + 22},188 ${sugarX - 14},204`}
                                    />
                                    <line className="ribbon-base-link" x1={sugarX + 16} y1="138" x2={sugarX + 48} y2="108" />
                                    <rect className="ribbon-base" data-base={base.letter} x={sugarX + 34} y="74" width="74" height="40" rx="16" />
                                    <text className="ribbon-base-text" x={sugarX + 71} y="99">
                                        {base.letter}
                                    </text>

                                    {showComplement && (
                                        <>
                                            <line
                                                className={`ribbon-hbond ribbon-hbond--${base.hbondCount}`}
                                                x1={sugarX + 68}
                                                y1="124"
                                                x2={sugarX + 68}
                                                y2="232"
                                            />
                                            <rect className="ribbon-base ribbon-base--complement" data-base={complement.letter} x={sugarX + 34} y="240" width="74" height="40" rx="16" />
                                            <text className="ribbon-base-text" x={sugarX + 71} y="265">
                                                {complement.letter}
                                            </text>
                                        </>
                                    )}

                                    {index === strand.length - 1 && (
                                        <>
                                            <circle className="ribbon-oh" cx={sugarX + 42} cy="206" r="10" />
                                            <text className="ribbon-oh-label" x={sugarX + 42} y="228">
                                                3' OH
                                            </text>
                                        </>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>
            )}
        </section>
    );
}

function ConceptSidebar({ strand, pendingBaseKey, showComplement, onToggleComplement, logs }) {
    const phosphodiesterCount = Math.max(0, strand.length - 1);
    const strandSequence = formatSequence(strand);
    const complement = formatComplement(strand);

    return (
        <aside className="sidebar">
            <section className="panel panel--soft">
                <div className="panel-head panel-head--stack">
                    <div>
                        <span className="eyebrow">Chain Metrics</span>
                        <h2>What You Built</h2>
                    </div>
                </div>

                <div className="stats-grid">
                    <StatPill label="Nucleotides" value={strand.length} accent="cool" />
                    <StatPill label="Backbone Bonds" value={phosphodiesterCount} accent="warm" />
                    <StatPill label="GC Content" value={`${gcContent(strand)}%`} accent="success" />
                </div>

                <div className="sequence-block">
                    <div className="sequence-row">
                        <span>Primary</span>
                        <code>{strandSequence || "—"}</code>
                    </div>
                    {showComplement && (
                        <div className="sequence-row">
                            <span>Complement</span>
                            <code>{complement || "—"}</code>
                        </div>
                    )}
                </div>

                <button type="button" className="button button--ghost button--full" onClick={onToggleComplement}>
                    {showComplement ? "Hide Complement Preview" : "Show Complement Preview"}
                </button>

                <div className="sidebar-caption">
                    {pendingBaseKey
                        ? `${BASES[pendingBaseKey].incoming} is staged to extend the 3' end.`
                        : "Load an incoming nucleotide when you want to form the next phosphodiester bond."}
                </div>
            </section>

            <section className="panel">
                <div className="panel-head panel-head--stack">
                    <div>
                        <span className="eyebrow">Concept Notes</span>
                        <h2>Backbone Chemistry</h2>
                    </div>
                </div>
                <div className="concept-list">
                    {CONCEPT_CARDS.map((card) => (
                        <article key={card.title} className="concept-card">
                            <strong>{card.title}</strong>
                            <p>{card.body}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="panel">
                <div className="panel-head panel-head--stack">
                    <div>
                        <span className="eyebrow">Assembly Log</span>
                        <h2>Recent Steps</h2>
                    </div>
                </div>
                <div className="log-list">
                    {logs.map((entry) => (
                        <article key={entry.id} className="log-item">
                            <strong>{entry.title}</strong>
                            <p>{entry.detail}</p>
                        </article>
                    ))}
                </div>
            </section>
        </aside>
    );
}

export function App() {
    const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
    const selectedBase = BASES[state.selectedBaseKey];
    const canFormBond = Boolean(state.pendingBaseKey);

    useEffect(() => {
        window.localStorage.setItem("dna-molecule-builder-theme", state.theme);
    }, [state.theme]);

    useEffect(() => {
        const query = window.matchMedia(REDUCED_MOTION_QUERY);
        const update = () => dispatch({ type: "SET_REDUCED_MOTION", value: query.matches });
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data?.type === "theme-change") {
                const mode = event.data.mode;
                if (mode === "light" || mode === "dark") {
                    dispatch({ type: "SET_THEME", theme: mode });
                }
            }
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    const handleAppendSequence = () => {
        const parsed = parseSequenceInput(state.sequenceInput);
        startTransition(() => {
            dispatch({ type: "APPEND_SEQUENCE", baseKeys: parsed.baseKeys, invalid: parsed.invalid });
        });
    };

    return (
        <div className="dna-molecule-app" data-theme={state.theme}>
            <div className="dna-molecule-app__wash" aria-hidden="true" />

            <header className="app-header">
                <div className="app-header__brand">
                    <span className="app-header__eyebrow">Interactive DNA Builder</span>
                    <h1>Phosphodiester Lab</h1>
                    <p>
                        Learn how nucleotides connect through deoxyribose and phosphate to build a real DNA backbone.
                    </p>
                </div>

                <div className="app-header__summary">
                    <StatPill label="Selected" value={selectedBase.incoming} accent="cool" />
                    <StatPill label="Backbone Direction" value="5'→3'" accent="warm" />
                    <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => dispatch({ type: "SET_THEME", theme: state.theme === "dark" ? "light" : "dark" })}
                    >
                        {state.theme === "dark" ? "Light Theme" : "Dark Theme"}
                    </button>
                </div>
            </header>

            <main className="app-shell">
                <section className="composer">
                    <section className="panel panel--soft">
                        <div className="panel-head panel-head--stack">
                            <div>
                                <span className="eyebrow">Nucleotide Shelf</span>
                                <h2>Choose an Incoming Base</h2>
                            </div>
                            <p>Each choice brings a base, a deoxyribose sugar, and a 5' phosphate ready for DNA polymerization.</p>
                        </div>
                        <BaseSelector
                            selectedBaseKey={state.selectedBaseKey}
                            onSelect={(baseKey) => dispatch({ type: "SELECT_BASE", baseKey })}
                        />
                    </section>

                    <SelectedNucleotide
                        baseKey={state.selectedBaseKey}
                        strandLength={state.strand.length}
                        pendingBaseKey={state.pendingBaseKey}
                        canBond={canFormBond}
                        onQueue={() => dispatch({ type: "QUEUE_SELECTED" })}
                        onBond={() => dispatch({ type: "FORM_BOND" })}
                    />

                    <section className="panel">
                        <div className="panel-head panel-head--stack">
                            <div>
                                <span className="eyebrow">Sequence Builder</span>
                                <h2>Append a DNA Segment</h2>
                            </div>
                        </div>

                        <label className="sequence-label" htmlFor="sequence-input">
                            Enter A, T, G, or C
                        </label>
                        <div className="sequence-form">
                            <input
                                id="sequence-input"
                                className="sequence-input"
                                type="text"
                                value={state.sequenceInput}
                                onChange={(event) => dispatch({ type: "SET_SEQUENCE_INPUT", value: event.target.value })}
                                placeholder="ATGCGT"
                                autoComplete="off"
                                spellCheck={false}
                            />
                            <button type="button" className="button button--primary" onClick={handleAppendSequence}>
                                Append Sequence
                            </button>
                        </div>

                        <div className="action-row">
                            <button type="button" className="button button--ghost" onClick={() => dispatch({ type: "REMOVE_LAST" })}>
                                Remove Last
                            </button>
                            <button type="button" className="button button--ghost" onClick={() => dispatch({ type: "CLEAR_STRAND" })}>
                                Clear Strand
                            </button>
                        </div>

                        <div className="status-callout" aria-live="polite">
                            {state.status}
                        </div>
                    </section>
                </section>

                <section className="workspace">
                    <BackboneWorkspace
                        strand={state.strand}
                        selectedBaseKey={state.selectedBaseKey}
                        pendingBaseKey={state.pendingBaseKey}
                        highlightToken={state.highlightToken}
                        reducedMotion={state.reducedMotion}
                    />
                    <StrandRibbon
                        strand={state.strand}
                        showComplement={state.showComplement}
                        highlightToken={state.highlightToken}
                        reducedMotion={state.reducedMotion}
                    />
                </section>

                <ConceptSidebar
                    strand={state.strand}
                    pendingBaseKey={state.pendingBaseKey}
                    showComplement={state.showComplement}
                    onToggleComplement={() => dispatch({ type: "TOGGLE_COMPLEMENT" })}
                    logs={state.logs}
                />
            </main>
        </div>
    );
}
