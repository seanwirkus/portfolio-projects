import React, { startTransition, useEffect, useReducer, useRef, useState } from "react";
import "./styles.css";
import {
    BASE_ORDER,
    BASE_TO_COMPLEMENT,
    cleanSequenceInput,
    DNA_BASES,
    DNA_STRAND_KEYS,
    formatSequence,
    getComplementKey,
    getPairMap,
    isDnaStrandBase,
} from "./data/bases";
import { BaseRenderer } from "./lib/BaseRenderer";

const MODE_OPTIONS = [
    { id: "explore", label: "Explore" },
    { id: "quiz-name", label: "Quiz: Bases" },
    { id: "quiz-hbond", label: "Quiz: H-Bonds" },
    { id: "quiz-pair", label: "Quiz: Pairing" },
];

const ROTATE_STEP = 90;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const DEFAULT_SCORE = { correct: 0, total: 0, streak: 0 };

function getSavedTheme() {
    if (typeof window === "undefined") {
        return "dark";
    }
    return window.localStorage.getItem("dna-bases-theme") || "dark";
}

function isQuizMode(mode) {
    return mode.startsWith("quiz-");
}

function normalizeRotation(deg) {
    return ((deg % 360) + 360) % 360;
}

function shuffle(list) {
    const next = [...list];
    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
}

function createQuizQuestion(mode, previousBaseKey = null) {
    const availableKeys = [...BASE_ORDER];
    let baseKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];

    if (availableKeys.length > 1) {
        while (baseKey === previousBaseKey) {
            baseKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
        }
    }

    const base = DNA_BASES[baseKey];
    const options = shuffle(BASE_ORDER.map((key) => DNA_BASES[key].name));

    return {
        mode,
        baseKey,
        answered: false,
        options,
        rotationRad: Math.random() * Math.PI * 2,
        foundSiteIds: [],
        wrongClicks: 0,
        prompt:
            mode === "quiz-name"
                ? "What nucleobase is shown?"
                : mode === "quiz-pair"
                  ? `What base pairs with ${base.name}?`
                  : `Click every donor and acceptor on ${base.name}.`,
    };
}

function feedbackForAnswer(mode, isCorrect, base) {
    if (mode === "quiz-name") {
        if (isCorrect) {
            return {
                ok: true,
                message: `Correct. ${base.name} (${base.letter}) is a ${base.type.toLowerCase()}.`,
            };
        }

        return {
            ok: false,
            message: `That structure is ${base.name} (${base.letter}), a ${base.type.toLowerCase()}.`,
        };
    }

    if (mode === "quiz-pair") {
        if (isCorrect) {
            return {
                ok: true,
                message: `Correct. ${base.name} pairs with ${base.pairsWith} through ${base.hbondCount} hydrogen bonds.`,
            };
        }

        return {
            ok: false,
            message: `${base.name} pairs with ${base.pairsWith} through ${base.hbondCount} hydrogen bonds.`,
        };
    }

    return {
        ok: true,
        message: `Found all ${base.hbondSites.length} hydrogen-bond sites on ${base.name}.`,
    };
}

function createInitialState() {
    return {
        theme: getSavedTheme(),
        mode: "explore",
        selectedBaseKey: "adenine",
        controls: {
            showHbond: true,
            showNumbering: true,
            showLonePairs: false,
            showSugarBond: false,
        },
        rotationDeg: 0,
        pairingVisible: false,
        strandInput: "",
        strand: ["adenine", "thymine", "guanine", "cytosine"],
        strandNotice: "Primary strand runs 5'→3'. Complement is generated automatically.",
        quiz: {
            score: { ...DEFAULT_SCORE },
            question: null,
            feedback: null,
        },
    };
}

function appReducer(state, action) {
    switch (action.type) {
        case "SET_THEME":
            return {
                ...state,
                theme: action.theme,
            };

        case "SET_MODE":
            if (action.mode === state.mode) {
                return state;
            }

            return {
                ...state,
                mode: action.mode,
                quiz: isQuizMode(action.mode)
                    ? {
                        ...state.quiz,
                        question: createQuizQuestion(action.mode, state.quiz.question?.baseKey || null),
                        feedback: null,
                    }
                    : state.quiz,
            };

        case "SELECT_BASE":
            return {
                ...state,
                selectedBaseKey: action.baseKey,
            };

        case "SET_CONTROL":
            return {
                ...state,
                controls: {
                    ...state.controls,
                    [action.control]: action.value,
                },
            };

        case "SET_ROTATION":
            return {
                ...state,
                rotationDeg: normalizeRotation(action.rotationDeg),
            };

        case "SET_PAIRING_VISIBLE":
            return {
                ...state,
                pairingVisible: action.visible,
            };

        case "SET_STRAND_INPUT":
            return {
                ...state,
                strandInput: action.value.toUpperCase(),
            };

        case "APPEND_BASE": {
            if (!isDnaStrandBase(action.baseKey)) {
                return {
                    ...state,
                    strandNotice: "Uracil is RNA-only and is not added to the DNA strand builder.",
                };
            }

            return {
                ...state,
                strand: [...state.strand, action.baseKey],
                selectedBaseKey: action.baseKey,
                strandNotice: `${DNA_BASES[action.baseKey].name} added to the primary strand.`,
            };
        }

        case "APPEND_SEQUENCE": {
            const parsed = cleanSequenceInput(state.strandInput);
            if (parsed.validKeys.length === 0) {
                return {
                    ...state,
                    strandNotice:
                        parsed.invalidTokens.length > 0
                            ? `Only A, T, G, and C can be appended. Ignored: ${parsed.invalidTokens.join(", ")}.`
                            : "Enter A, T, G, or C to append a sequence.",
                };
            }

            const ignored = parsed.invalidTokens.length > 0 ? ` Ignored: ${parsed.invalidTokens.join(", ")}.` : "";

            return {
                ...state,
                strand: [...state.strand, ...parsed.validKeys],
                strandInput: "",
                selectedBaseKey: parsed.validKeys[parsed.validKeys.length - 1],
                strandNotice: `Added ${parsed.validKeys.length} base${parsed.validKeys.length === 1 ? "" : "s"} to the strand.${ignored}`,
            };
        }

        case "REMOVE_LAST_BASE":
            if (state.strand.length === 0) {
                return {
                    ...state,
                    strandNotice: "The strand is already empty.",
                };
            }

            return {
                ...state,
                strand: state.strand.slice(0, -1),
                strandNotice: "Removed the last base pair from the strand.",
            };

        case "CLEAR_STRAND":
            return {
                ...state,
                strand: [],
                strandNotice: "Cleared the assembled strand. Add bases or append a sequence to start again.",
            };

        case "ANSWER_OPTION": {
            const question = state.quiz.question;
            if (!question || question.answered) {
                return state;
            }

            const base = DNA_BASES[question.baseKey];
            const correctAnswer = question.mode === "quiz-name" ? base.name : base.pairsWith;
            const correct = action.answer === correctAnswer;
            const nextScore = {
                correct: state.quiz.score.correct + (correct ? 1 : 0),
                total: state.quiz.score.total + 1,
                streak: correct ? state.quiz.score.streak + 1 : 0,
            };

            return {
                ...state,
                quiz: {
                    score: nextScore,
                    question: {
                        ...question,
                        answered: true,
                        selectedAnswer: action.answer,
                        correctAnswer,
                    },
                    feedback: feedbackForAnswer(question.mode, correct, base),
                },
            };
        }

        case "HBOND_SELECT": {
            const question = state.quiz.question;
            if (!question || question.mode !== "quiz-hbond" || question.answered) {
                return state;
            }

            const base = DNA_BASES[question.baseKey];
            const validSiteIds = new Set(base.hbondSites.map((site) => site.atomId));

            if (!validSiteIds.has(action.atomId)) {
                return {
                    ...state,
                    quiz: {
                        ...state.quiz,
                        question: {
                            ...question,
                            wrongClicks: question.wrongClicks + 1,
                        },
                    },
                };
            }

            if (question.foundSiteIds.includes(action.atomId)) {
                return state;
            }

            const foundSiteIds = [...question.foundSiteIds, action.atomId];
            const solved = foundSiteIds.length === base.hbondSites.length;

            if (!solved) {
                return {
                    ...state,
                    quiz: {
                        ...state.quiz,
                        question: {
                            ...question,
                            foundSiteIds,
                        },
                    },
                };
            }

            const credited = question.wrongClicks <= 1;
            const nextScore = {
                correct: state.quiz.score.correct + (credited ? 1 : 0),
                total: state.quiz.score.total + 1,
                streak: credited ? state.quiz.score.streak + 1 : 0,
            };

            return {
                ...state,
                quiz: {
                    score: nextScore,
                    question: {
                        ...question,
                        answered: true,
                        foundSiteIds,
                    },
                    feedback: feedbackForAnswer(question.mode, true, base),
                },
            };
        }

        case "NEXT_QUESTION":
            return {
                ...state,
                quiz: {
                    ...state.quiz,
                    question: createQuizQuestion(
                        state.mode,
                        state.quiz.question?.baseKey || null,
                    ),
                    feedback: null,
                },
            };

        case "RESET_QUIZ":
            return {
                ...state,
                quiz: {
                    score: { ...DEFAULT_SCORE },
                    question: isQuizMode(state.mode) ? createQuizQuestion(state.mode, null) : null,
                    feedback: null,
                },
            };

        default:
            return state;
    }
}

function getBasePairLabel(baseKey) {
    const base = DNA_BASES[baseKey];
    const partner = DNA_BASES[getComplementKey(baseKey)];
    return `${base.letter}-${partner.letter}`;
}

function getStrandStats(strand) {
    const totalPairs = strand.length;
    const totalHBonds = strand.reduce((total, baseKey) => total + DNA_BASES[baseKey].hbondCount, 0);
    const gcCount = strand.filter((baseKey) => baseKey === "guanine" || baseKey === "cytosine").length;
    const gcPercent = totalPairs === 0 ? 0 : Math.round((gcCount / totalPairs) * 100);
    return { totalPairs, totalHBonds, gcPercent };
}

function getPairingAlignment(baseKey, primaryRotation, renderer, cache) {
    const cacheKey = `${baseKey}:${primaryRotation}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const base = DNA_BASES[baseKey];
    const partnerKey = getComplementKey(baseKey);
    const partnerBase = DNA_BASES[partnerKey];
    const pairMap = getPairMap(baseKey, partnerKey);

    if (!partnerBase || pairMap.length === 0) {
        const fallback = {
            primaryRotation,
            partnerRotation: primaryRotation,
            partnerMirror: false,
            approachProgress: 1,
            bondProgress: 1,
            pairMap,
        };
        cache.set(cacheKey, fallback);
        return fallback;
    }

    let bestRotation = 0;
    let bestMirror = false;
    let lowestLoss = Infinity;
    const rotatedPrimary = renderer._rotateBase(base, primaryRotation);

    let primaryPairX = 0;
    let primaryPairY = 0;
    pairMap.forEach((pair) => {
        const atom = rotatedPrimary.atoms.find((candidate) => candidate.id === pair.from);
        primaryPairX += atom.x;
        primaryPairY += atom.y;
    });
    primaryPairX /= pairMap.length;
    primaryPairY /= pairMap.length;

    for (const mirror of [false, true]) {
        for (let degrees = 0; degrees <= 360; degrees += 2) {
            const rotation = (degrees * Math.PI) / 180;
            const rotatedPartner = renderer._rotateBase(partnerBase, rotation, mirror);

            let partnerPairX = 0;
            let partnerPairY = 0;
            pairMap.forEach((pair) => {
                const atom = rotatedPartner.atoms.find((candidate) => candidate.id === pair.to);
                partnerPairX += atom.x;
                partnerPairY += atom.y;
            });
            partnerPairX /= pairMap.length;
            partnerPairY /= pairMap.length;

            const dx = primaryPairX - partnerPairX;
            const dy = primaryPairY - partnerPairY;

            let loss = 0;
            pairMap.forEach((pair) => {
                const atomA = rotatedPrimary.atoms.find((candidate) => candidate.id === pair.from);
                const atomB = rotatedPartner.atoms.find((candidate) => candidate.id === pair.to);
                loss += Math.pow(atomA.x - (atomB.x + dx), 2) + Math.pow(atomA.y - (atomB.y + dy), 2);
            });

            const sugarA = rotatedPrimary.atoms.find((candidate) => candidate.id === base.sugarAttachment.atomId);
            const sugarB = rotatedPartner.atoms.find((candidate) => candidate.id === partnerBase.sugarAttachment.atomId);
            if (sugarA && sugarB) {
                const sugarDistance = Math.hypot(sugarA.x - (sugarB.x + dx), sugarA.y - (sugarB.y + dy));
                loss -= sugarDistance * 3;
            }

            if (loss < lowestLoss) {
                lowestLoss = loss;
                bestRotation = rotation;
                bestMirror = mirror;
            }
        }
    }

    const result = {
        primaryRotation,
        partnerRotation: bestRotation,
        partnerMirror: bestMirror,
        approachProgress: 1,
        bondProgress: 1,
        pairMap,
    };

    if (cache.size > 32) {
        cache.clear();
    }
    cache.set(cacheKey, result);
    return result;
}

function StatChip({ label, value, accent = "neutral" }) {
    return (
        <div className={`stat-chip stat-chip--${accent}`}>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function ModeTabs({ activeMode, onSelect }) {
    return (
        <div className="mode-tabs" role="tablist" aria-label="Learning modes">
            {MODE_OPTIONS.map((option) => (
                <button
                    key={option.id}
                    type="button"
                    className={`mode-tab${activeMode === option.id ? " is-active" : ""}`}
                    onClick={() => onSelect(option.id)}
                    role="tab"
                    aria-selected={activeMode === option.id}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function BaseRail({ selectedBaseKey, onSelect, onAppendSelected, strandCount }) {
    return (
        <aside className="base-rail" aria-label="Base selector">
            <div className="panel-heading">
                <span className="panel-kicker">Base Library</span>
                <h2>Choose a Base</h2>
                <p>Select a nucleobase to inspect its geometry, donors, acceptors, and canonical pairing partner.</p>
            </div>

            <div className="base-list" role="group" aria-label="DNA base selection">
                {BASE_ORDER.map((baseKey) => {
                    const base = DNA_BASES[baseKey];
                    const isSelected = baseKey === selectedBaseKey;
                    const pairLabel = DNA_BASES[getComplementKey(baseKey)]?.letter || "–";
                    return (
                        <button
                            key={baseKey}
                            type="button"
                            className={`base-card${isSelected ? " is-selected" : ""}`}
                            data-base={base.letter}
                            onClick={() => onSelect(baseKey)}
                        >
                            <span className="base-card__letter">{base.letter}</span>
                            <span className="base-card__content">
                                <strong>{base.name}</strong>
                                <span>{base.type}</span>
                            </span>
                            <span className="base-card__meta">{base.letter} · {pairLabel}</span>
                        </button>
                    );
                })}
            </div>

            <div className="rail-footer">
                <StatChip label="Pairs Built" value={strandCount} accent="cool" />
                <button
                    type="button"
                    className="button button--primary button--full"
                    onClick={onAppendSelected}
                    disabled={!isDnaStrandBase(selectedBaseKey)}
                >
                    {isDnaStrandBase(selectedBaseKey) ? `Add ${getBasePairLabel(selectedBaseKey)} Pair` : "RNA Base Only"}
                </button>
            </div>
        </aside>
    );
}

function ToggleField({ id, checked, label, onChange }) {
    return (
        <label className="toggle-field" htmlFor={id}>
            <input
                id={id}
                name={id}
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
            />
            <span className="toggle-field__switch" aria-hidden="true" />
            <span>{label}</span>
        </label>
    );
}

function StrandBuilder({
    strand,
    strandInput,
    strandNotice,
    selectedBaseKey,
    onInputChange,
    onAppendSequence,
    onAppendBase,
    onRemoveLast,
    onClear,
    onSelectBase,
}) {
    const stats = getStrandStats(strand);
    const primarySequence = formatSequence(strand);
    const complementSequence = formatSequence(strand.map((baseKey) => BASE_TO_COMPLEMENT[baseKey]));

    return (
        <section className="strand-builder" aria-labelledby="strand-builder-title">
            <div className="strand-builder__header">
                <div>
                    <span className="panel-kicker">Strand Builder</span>
                    <h2 id="strand-builder-title">Assemble a DNA Strand</h2>
                </div>
                <div className="strand-builder__stats">
                    <StatChip label="Base Pairs" value={stats.totalPairs} accent="cool" />
                    <StatChip label="H-Bonds" value={stats.totalHBonds} accent="warm" />
                    <StatChip label="GC Content" value={`${stats.gcPercent}%`} accent="success" />
                </div>
            </div>

            <div className="strand-builder__toolbar">
                <div className="quick-pairs" role="group" aria-label="Quick add base pairs">
                    {DNA_STRAND_KEYS.map((baseKey) => (
                        <button
                            key={baseKey}
                            type="button"
                            className={`button button--ghost${selectedBaseKey === baseKey ? " is-active" : ""}`}
                            data-base={DNA_BASES[baseKey].letter}
                            onClick={() => onAppendBase(baseKey)}
                        >
                            {getBasePairLabel(baseKey)}
                        </button>
                    ))}
                </div>

                <div className="strand-builder__actions">
                    <button type="button" className="button button--ghost" onClick={onRemoveLast}>
                        Remove Last
                    </button>
                    <button type="button" className="button button--ghost" onClick={onClear}>
                        Clear Strand
                    </button>
                </div>
            </div>

            <form
                className="strand-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    onAppendSequence();
                }}
            >
                <label className="strand-form__label" htmlFor="strand-input">
                    Append Primary Sequence
                </label>
                <div className="strand-form__row">
                    <input
                        id="strand-input"
                        className="strand-input"
                        name="strand_sequence"
                        type="text"
                        value={strandInput}
                        onChange={(event) => onInputChange(event.target.value)}
                        placeholder="ATGCGT…"
                        autoComplete="off"
                        spellCheck={false}
                        inputMode="latin"
                    />
                    <button type="submit" className="button button--primary">
                        Append Sequence
                    </button>
                </div>
            </form>

            <div className="strand-sequences">
                <div className="strand-sequences__row">
                    <span>5' Primary</span>
                    <code>{primarySequence || "—"}</code>
                </div>
                <div className="strand-sequences__row">
                    <span>3' Complement</span>
                    <code>{complementSequence || "—"}</code>
                </div>
            </div>

            <div className="strand-builder__note" aria-live="polite">
                {strandNotice}
            </div>

            <div className="strand-track" aria-label="Assembled DNA strand">
                {strand.length === 0 ? (
                    <div className="strand-empty">
                        Add A, T, G, or C to build a complementary strand pair-by-pair.
                    </div>
                ) : (
                    strand.map((baseKey, index) => {
                        const base = DNA_BASES[baseKey];
                        const partner = DNA_BASES[getComplementKey(baseKey)];
                        return (
                            <button
                                key={`${baseKey}-${index}`}
                                type="button"
                                className={`strand-pair${selectedBaseKey === baseKey ? " is-selected" : ""}`}
                                data-base={base.letter}
                                onClick={() => onSelectBase(baseKey)}
                                aria-label={`Focus ${base.name} paired with ${partner.name}`}
                            >
                                <span className="strand-pair__terminal strand-pair__terminal--top">{index === 0 ? "5'" : ""}</span>
                                <span className="strand-base strand-base--top" data-base={base.letter}>
                                    {base.letter}
                                </span>
                                <span className="strand-pair__bridge">
                                    <span />
                                    <small>{base.hbondCount}</small>
                                    <span />
                                </span>
                                <span className="strand-base strand-base--bottom" data-base={partner.letter}>
                                    {partner.letter}
                                </span>
                                <span className="strand-pair__terminal strand-pair__terminal--bottom">
                                    {index === strand.length - 1 ? "5'" : ""}
                                </span>
                            </button>
                        );
                    })
                )}
            </div>
        </section>
    );
}

function Inspector({ selectedBaseKey, hoveredAtomId }) {
    const base = DNA_BASES[selectedBaseKey];
    const partner = DNA_BASES[getComplementKey(selectedBaseKey)];

    return (
        <aside className="inspector" aria-label="Selected base details">
            <section className="inspector-section">
                <div className="panel-heading">
                    <span className="panel-kicker">Selected Base</span>
                    <h2>{base.name}</h2>
                    <p>{base.description}</p>
                </div>
                <div className="inspector-metrics">
                    <StatChip label="Formula" value={base.formula} accent="cool" />
                    <StatChip label="Pair" value={`${base.letter} · ${partner.letter}`} accent="warm" />
                    <StatChip label="H-Bonds" value={base.hbondCount} accent="success" />
                </div>
            </section>

            <section className="inspector-section">
                <div className="panel-heading">
                    <span className="panel-kicker">Hydrogen-Bond Map</span>
                    <h3>Donors & Acceptors</h3>
                </div>
                <div className="legend-list">
                    <div className="legend-row">
                        <span className="legend-dot legend-dot--donor" />
                        <span>Donor site</span>
                    </div>
                    <div className="legend-row">
                        <span className="legend-dot legend-dot--acceptor" />
                        <span>Acceptor site</span>
                    </div>
                    <div className="legend-row">
                        <span className="legend-label legend-label--nitrogen">N</span>
                        <span>Nitrogen</span>
                    </div>
                    <div className="legend-row">
                        <span className="legend-label legend-label--oxygen">O</span>
                        <span>Oxygen</span>
                    </div>
                </div>

                <div className="site-list">
                    {base.hbondSites.map((site) => (
                        <article
                            key={site.atomId}
                            className={`site-card site-card--${site.type}${hoveredAtomId === site.atomId ? " is-highlighted" : ""}`}
                        >
                            <strong>
                                {site.label} · {site.atomId}
                            </strong>
                            <p>{site.detail}</p>
                            <small>Pairs with {site.pairingAtom}</small>
                        </article>
                    ))}
                </div>
            </section>
        </aside>
    );
}

function QuizPanel({
    mode,
    quiz,
    canvasRef,
    onAnswer,
    onReset,
    onCanvasClick,
    onCanvasMove,
    onCanvasLeave,
}) {
    const question = quiz.question;
    if (!question) {
        return null;
    }

    const base = DNA_BASES[question.baseKey];
    const correctAnswer = question.mode === "quiz-name" ? base.name : base.pairsWith;

    return (
        <section className="quiz-layout" aria-labelledby="quiz-title">
            <header className="quiz-header">
                <div className="panel-heading">
                    <span className="panel-kicker">Quiz Mode</span>
                    <h2 id="quiz-title">
                        {mode === "quiz-name" ? "Base Recognition" : mode === "quiz-pair" ? "Pair Matching" : "H-Bond Spotting"}
                    </h2>
                </div>

                <div className="quiz-header__stats">
                    <StatChip label="Score" value={`${quiz.score.correct} / ${quiz.score.total}`} accent="success" />
                    <StatChip label="Streak" value={quiz.score.streak} accent="warm" />
                    <button type="button" className="button button--ghost" onClick={onReset}>
                        Reset Quiz
                    </button>
                </div>
            </header>

            <div className="quiz-stage">
                <div className="quiz-stage__canvas">
                    <canvas
                        ref={canvasRef}
                        onClick={onCanvasClick}
                        onMouseMove={onCanvasMove}
                        onMouseLeave={onCanvasLeave}
                    />
                </div>

                <div className="quiz-stage__content">
                    <p className="quiz-prompt">{question.prompt}</p>

                    {mode === "quiz-hbond" ? (
                        <div className="quiz-hbond-list">
                            {base.hbondSites.map((site) => {
                                const found = question.foundSiteIds.includes(site.atomId);
                                return (
                                    <span
                                        key={site.atomId}
                                        className={`quiz-chip${found ? " is-found" : ""}`}
                                    >
                                        {site.type === "donor" ? "●" : "○"} {site.atomId}
                                    </span>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="quiz-options" role="group" aria-label="Answer options">
                            {question.options.map((option) => {
                                const selected = question.selectedAnswer === option;
                                const showCorrect = question.answered && option === correctAnswer;
                                const wrong = question.answered && selected && option !== correctAnswer;

                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`quiz-option${showCorrect ? " is-correct" : ""}${wrong ? " is-wrong" : ""}`}
                                        onClick={() => onAnswer(option)}
                                        disabled={question.answered}
                                    >
                                        {option}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className={`quiz-feedback${quiz.feedback ? " is-visible" : ""}`} aria-live="polite">
                        {quiz.feedback?.message || " "}
                    </div>
                </div>
            </div>
        </section>
    );
}

export function App() {
    const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);
    const [hoveredAtomId, setHoveredAtomId] = useState(null);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const [pairingAnimating, setPairingAnimating] = useState(false);

    const exploreCanvasRef = useRef(null);
    const quizCanvasRef = useRef(null);
    const exploreRendererRef = useRef(null);
    const quizRendererRef = useRef(null);
    const exploreHoveredAtomRef = useRef(null);
    const quizHoveredAtomRef = useRef(null);
    const latestStateRef = useRef(state);
    const pairingFrameRef = useRef(null);
    const pairingMotionRef = useRef(null);
    const quizTimerRef = useRef(null);
    const pairingCacheRef = useRef(new Map());

    latestStateRef.current = state;

    useEffect(() => {
        const query = window.matchMedia(REDUCED_MOTION_QUERY);
        const update = () => setPrefersReducedMotion(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        window.localStorage.setItem("dna-bases-theme", state.theme);
    }, [state.theme]);

    useEffect(() => {
        if (
            exploreCanvasRef.current &&
            exploreRendererRef.current?.canvas !== exploreCanvasRef.current
        ) {
            if (exploreRendererRef.current) {
                exploreRendererRef.current.destroy();
            }
            exploreRendererRef.current = new BaseRenderer(exploreCanvasRef.current);
            requestAnimationFrame(() => renderExploreScene());
        }

        if (
            quizCanvasRef.current &&
            quizRendererRef.current?.canvas !== quizCanvasRef.current
        ) {
            if (quizRendererRef.current) {
                quizRendererRef.current.destroy();
            }
            quizRendererRef.current = new BaseRenderer(quizCanvasRef.current);
            requestAnimationFrame(() => renderQuizScene());
        }
    });

    useEffect(() => {
        return () => {
            if (pairingFrameRef.current) {
                cancelAnimationFrame(pairingFrameRef.current);
            }
            if (quizTimerRef.current) {
                window.clearTimeout(quizTimerRef.current);
            }
            if (exploreRendererRef.current) {
                exploreRendererRef.current.destroy();
            }
            if (quizRendererRef.current) {
                quizRendererRef.current.destroy();
            }
        };
    }, []);

    function renderExploreScene() {
        const renderer = exploreRendererRef.current;
        if (!renderer) {
            return;
        }

        const snapshot = latestStateRef.current;
        const base = DNA_BASES[snapshot.selectedBaseKey];
        const partnerKey = getComplementKey(snapshot.selectedBaseKey);
        const partnerBase = DNA_BASES[partnerKey];
        const primaryRotation = (snapshot.rotationDeg * Math.PI) / 180;
        renderer.theme = snapshot.theme;
        renderer.rotation = primaryRotation;

        if ((snapshot.pairingVisible || pairingAnimating) && partnerBase) {
            const pairingState =
                pairingAnimating && pairingMotionRef.current
                    ? pairingMotionRef.current
                    : getPairingAlignment(snapshot.selectedBaseKey, primaryRotation, renderer, pairingCacheRef.current);

            renderer.renderPairing(base, partnerBase, {
                showHbond: snapshot.controls.showHbond,
                showNumbering: snapshot.controls.showNumbering,
                showLonePairs: snapshot.controls.showLonePairs,
                showSugarBond: snapshot.controls.showSugarBond,
                pairMap: pairingState.pairMap,
                approachProgress: pairingState.approachProgress,
                bondProgress: pairingState.bondProgress,
                primaryRotation: pairingState.primaryRotation,
                partnerRotation: pairingState.partnerRotation,
                partnerMirror: pairingState.partnerMirror,
            });
            return;
        }

        renderer.hoveredAtom = exploreHoveredAtomRef.current;
        renderer.render(base, {
            showHbond: snapshot.controls.showHbond,
            showNumbering: snapshot.controls.showNumbering,
            showLonePairs: snapshot.controls.showLonePairs,
            showSugarBond: snapshot.controls.showSugarBond,
        });
    }

    function renderQuizScene() {
        const renderer = quizRendererRef.current;
        if (!renderer) {
            return;
        }

        const snapshot = latestStateRef.current;
        const question = snapshot.quiz.question;
        if (!question) {
            return;
        }

        const base = DNA_BASES[question.baseKey];
        renderer.theme = snapshot.theme;
        renderer.rotation = question.rotationRad;
        renderer.hoveredAtom = quizHoveredAtomRef.current;

        if (question.mode === "quiz-hbond") {
            const visibleSites = base.hbondSites.filter((site) => question.foundSiteIds.includes(site.atomId));
            renderer.render(
                {
                    ...base,
                    hbondSites: visibleSites,
                },
                {
                    showHbond: true,
                    showNumbering: true,
                },
            );
            return;
        }

        renderer.render(base, {
            showHbond: false,
            showNumbering: question.mode !== "quiz-name",
        });
    }

    useEffect(() => {
        renderExploreScene();
    }, [
        state.mode,
        state.theme,
        state.selectedBaseKey,
        state.controls,
        state.rotationDeg,
        state.pairingVisible,
        hoveredAtomId,
        pairingAnimating,
    ]);

    useEffect(() => {
        if (isQuizMode(state.mode)) {
            renderQuizScene();
        }
    }, [state.mode, state.theme, state.quiz]);

    useEffect(() => {
        if (!isQuizMode(state.mode) || !state.quiz.question?.answered) {
            if (quizTimerRef.current) {
                window.clearTimeout(quizTimerRef.current);
            }
            return undefined;
        }

        quizTimerRef.current = window.setTimeout(() => {
            startTransition(() => {
                dispatch({ type: "NEXT_QUESTION" });
            });
        }, state.mode === "quiz-hbond" ? 2200 : 1800);

        return () => {
            if (quizTimerRef.current) {
                window.clearTimeout(quizTimerRef.current);
            }
        };
    }, [state.mode, state.quiz.question?.answered, state.quiz.question?.baseKey]);

    useEffect(() => {
        if (state.mode !== "explore" && pairingFrameRef.current) {
            cancelAnimationFrame(pairingFrameRef.current);
            pairingFrameRef.current = null;
            setPairingAnimating(false);
        }
    }, [state.mode]);

    useEffect(() => {
        if (!pairingFrameRef.current) {
            return;
        }

        cancelAnimationFrame(pairingFrameRef.current);
        pairingFrameRef.current = null;
        pairingMotionRef.current = null;
        setPairingAnimating(false);
    }, [state.selectedBaseKey, state.rotationDeg]);

    useEffect(() => {
        if (state.pairingVisible || !pairingFrameRef.current) {
            return;
        }

        cancelAnimationFrame(pairingFrameRef.current);
        pairingFrameRef.current = null;
        pairingMotionRef.current = null;
        setPairingAnimating(false);
        renderExploreScene();
    }, [state.pairingVisible]);

    const selectedBase = DNA_BASES[state.selectedBaseKey];
    const partnerBase = DNA_BASES[getComplementKey(state.selectedBaseKey)];

    const handleThemeToggle = () => {
        dispatch({
            type: "SET_THEME",
            theme: state.theme === "dark" ? "light" : "dark",
        });
    };

    const handleModeSelect = (mode) => {
        startTransition(() => {
            dispatch({ type: "SET_MODE", mode });
        });
    };

    const playPairingAnimation = () => {
        const renderer = exploreRendererRef.current;
        if (!renderer) {
            return;
        }

        const snapshot = latestStateRef.current;
        const primaryRotation = (snapshot.rotationDeg * Math.PI) / 180;
        const alignment = getPairingAlignment(snapshot.selectedBaseKey, primaryRotation, renderer, pairingCacheRef.current);

        if (!snapshot.pairingVisible) {
            dispatch({ type: "SET_PAIRING_VISIBLE", visible: true });
        }

        if (prefersReducedMotion) {
            pairingMotionRef.current = alignment;
            setPairingAnimating(false);
            renderExploreScene();
            return;
        }

        if (pairingFrameRef.current) {
            cancelAnimationFrame(pairingFrameRef.current);
        }

        const startedAt = performance.now();
        const extraSpin = Math.PI * -1.5;
        const startPartnerRotation = alignment.partnerRotation + extraSpin;
        setPairingAnimating(true);

        const easeOut = (value) => 1 - Math.pow(1 - value, 3);

        const run = (time) => {
            const elapsed = time - startedAt;
            const approachDuration = 900;
            const rotationDuration = 1200;
            const bondDelay = 380;
            const bondDuration = 800;
            const holdDuration = 900;
            const totalDuration = Math.max(rotationDuration, bondDelay + bondDuration) + holdDuration;
            const approachProgress = easeOut(Math.min(elapsed / approachDuration, 1));
            const rotationProgress = easeOut(Math.min(elapsed / rotationDuration, 1));

            pairingMotionRef.current = {
                ...alignment,
                approachProgress,
                bondProgress: Math.min(Math.max((elapsed - bondDelay) / bondDuration, 0), 1),
                primaryRotation: alignment.primaryRotation,
                partnerRotation:
                    startPartnerRotation + (alignment.partnerRotation - startPartnerRotation) * rotationProgress,
            };

            renderExploreScene();

            if (elapsed < totalDuration) {
                pairingFrameRef.current = requestAnimationFrame(run);
                return;
            }

            pairingMotionRef.current = alignment;
            pairingFrameRef.current = null;
            setPairingAnimating(false);
            renderExploreScene();
        };

        pairingFrameRef.current = requestAnimationFrame(run);
    };

    const handleExploreMouseMove = (event) => {
        if (state.pairingVisible || !exploreRendererRef.current) {
            return;
        }

        const rect = exploreCanvasRef.current.getBoundingClientRect();
        const hit = exploreRendererRef.current.hitTest(
            event.clientX - rect.left,
            event.clientY - rect.top,
            DNA_BASES[state.selectedBaseKey],
        );
        exploreHoveredAtomRef.current = hit;
        setHoveredAtomId((current) => (current === (hit?.id || null) ? current : hit?.id || null));
        renderExploreScene();
    };

    const handleExploreMouseLeave = () => {
        exploreHoveredAtomRef.current = null;
        setHoveredAtomId(null);
        renderExploreScene();
    };

    const handleQuizAnswer = (answer) => {
        dispatch({ type: "ANSWER_OPTION", answer });
    };

    const handleQuizCanvasClick = (event) => {
        if (state.mode !== "quiz-hbond" || !state.quiz.question || !quizRendererRef.current) {
            return;
        }

        const rect = quizCanvasRef.current.getBoundingClientRect();
        const hit = quizRendererRef.current.hitTest(
            event.clientX - rect.left,
            event.clientY - rect.top,
            DNA_BASES[state.quiz.question.baseKey],
        );

        if (!hit) {
            return;
        }

        dispatch({ type: "HBOND_SELECT", atomId: hit.id });
    };

    const handleQuizCanvasMove = (event) => {
        if (state.mode !== "quiz-hbond" || !state.quiz.question || !quizRendererRef.current) {
            return;
        }

        const rect = quizCanvasRef.current.getBoundingClientRect();
        quizHoveredAtomRef.current = quizRendererRef.current.hitTest(
            event.clientX - rect.left,
            event.clientY - rect.top,
            DNA_BASES[state.quiz.question.baseKey],
        );
        renderQuizScene();
    };

    const handleQuizCanvasLeave = () => {
        quizHoveredAtomRef.current = null;
        renderQuizScene();
    };

    const pairingStatus = pairingAnimating
        ? `Animating canonical ${selectedBase.letter}-${partnerBase.letter} alignment…`
        : state.pairingVisible
          ? `Showing ${selectedBase.name} paired with ${partnerBase.name} using ${selectedBase.hbondCount} hydrogen bonds.`
          : "Single-base study view active.";

    return (
        <div className="dna-app" data-theme={state.theme}>
            <div className="dna-app__backdrop" aria-hidden="true" />

            <header className="app-header">
                <div className="app-header__brand">
                    <div className="brand-mark" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </div>
                    <div>
                        <span className="panel-kicker">Interactive Study Surface</span>
                        <h1>DNA Strand Lab</h1>
                    </div>
                </div>

                <p className="app-header__summary">
                    Explore base geometry, rehearse canonical pairing, and build a complementary DNA strand one pair at a time.
                </p>

                <div className="app-header__controls">
                    <button
                        type="button"
                        className="theme-toggle"
                        onClick={handleThemeToggle}
                        aria-label={state.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                    >
                        {state.theme === "dark" ? "Light" : "Dark"}
                    </button>
                    <ModeTabs activeMode={state.mode} onSelect={handleModeSelect} />
                </div>
            </header>

            {state.mode === "explore" ? (
                <main className="app-shell">
                    <BaseRail
                        selectedBaseKey={state.selectedBaseKey}
                        strandCount={state.strand.length}
                        onSelect={(baseKey) => {
                            exploreHoveredAtomRef.current = null;
                            setHoveredAtomId(null);
                            dispatch({ type: "SELECT_BASE", baseKey });
                        }}
                        onAppendSelected={() => dispatch({ type: "APPEND_BASE", baseKey: state.selectedBaseKey })}
                    />

                    <section className="stage" aria-labelledby="stage-title">
                        <div className="stage-header">
                            <div className="stage-header__copy">
                                <span className="panel-kicker">Current View</span>
                                <h2 id="stage-title">{selectedBase.name}</h2>
                                <p>{selectedBase.ring} · pairs with {partnerBase.name}</p>
                            </div>
                            <div className="stage-header__stats">
                                <StatChip label="Type" value={selectedBase.type} accent="cool" />
                                <StatChip label="Pair" value={`${selectedBase.letter} · ${partnerBase.letter}`} accent="warm" />
                                <StatChip label="Formula" value={selectedBase.formula} accent="success" />
                            </div>
                        </div>

                        <section className="canvas-panel" aria-label="Molecular viewer">
                            <div className="canvas-toolbar">
                                <div className="canvas-toolbar__group">
                                    <ToggleField
                                        id="show-hbond"
                                        checked={state.controls.showHbond}
                                        label="H-Bond Sites"
                                        onChange={(value) => dispatch({ type: "SET_CONTROL", control: "showHbond", value })}
                                    />
                                    <ToggleField
                                        id="show-numbering"
                                        checked={state.controls.showNumbering}
                                        label="Atom Numbering"
                                        onChange={(value) => dispatch({ type: "SET_CONTROL", control: "showNumbering", value })}
                                    />
                                    <ToggleField
                                        id="show-lone-pairs"
                                        checked={state.controls.showLonePairs}
                                        label="Lone Pairs"
                                        onChange={(value) => dispatch({ type: "SET_CONTROL", control: "showLonePairs", value })}
                                    />
                                    <ToggleField
                                        id="show-sugar-bond"
                                        checked={state.controls.showSugarBond}
                                        label="Sugar Bond"
                                        onChange={(value) => dispatch({ type: "SET_CONTROL", control: "showSugarBond", value })}
                                    />
                                </div>

                                <div className="canvas-toolbar__group canvas-toolbar__group--actions">
                                    <div className="rotate-group" role="group" aria-label="Rotation controls">
                                        <span className="rotate-group__label">Rotate</span>
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => dispatch({ type: "SET_ROTATION", rotationDeg: state.rotationDeg - ROTATE_STEP })}
                                            aria-label="Rotate left 90 degrees"
                                        >
                                            ↺
                                        </button>
                                        <span className="rotate-group__value">{state.rotationDeg}°</span>
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => dispatch({ type: "SET_ROTATION", rotationDeg: state.rotationDeg + ROTATE_STEP })}
                                            aria-label="Rotate right 90 degrees"
                                        >
                                            ↻
                                        </button>
                                        <button
                                            type="button"
                                            className="button button--ghost"
                                            onClick={() => dispatch({ type: "SET_ROTATION", rotationDeg: 0 })}
                                        >
                                            Reset
                                        </button>
                                    </div>

                                    <div className="pairing-group" role="group" aria-label="Pairing controls">
                                        <button
                                            type="button"
                                            className={`button button--ghost${state.pairingVisible ? " is-active" : ""}`}
                                            onClick={() =>
                                                dispatch({
                                                    type: "SET_PAIRING_VISIBLE",
                                                    visible: !state.pairingVisible,
                                                })
                                            }
                                            aria-pressed={state.pairingVisible}
                                        >
                                            {state.pairingVisible ? "Hide Pair" : "Show Pair"}
                                        </button>
                                        <button type="button" className="button button--primary" onClick={playPairingAnimation}>
                                            {state.pairingVisible ? "Animate Again" : "Animate Pairing"}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="canvas-status" aria-live="polite">
                                {pairingStatus}
                            </div>

                            <div className="canvas-frame">
                                <canvas
                                    ref={exploreCanvasRef}
                                    onMouseMove={handleExploreMouseMove}
                                    onMouseLeave={handleExploreMouseLeave}
                                />
                            </div>
                        </section>

                        <StrandBuilder
                            strand={state.strand}
                            strandInput={state.strandInput}
                            strandNotice={state.strandNotice}
                            selectedBaseKey={state.selectedBaseKey}
                            onInputChange={(value) => dispatch({ type: "SET_STRAND_INPUT", value })}
                            onAppendSequence={() => dispatch({ type: "APPEND_SEQUENCE" })}
                            onAppendBase={(baseKey) => dispatch({ type: "APPEND_BASE", baseKey })}
                            onRemoveLast={() => dispatch({ type: "REMOVE_LAST_BASE" })}
                            onClear={() => dispatch({ type: "CLEAR_STRAND" })}
                            onSelectBase={(baseKey) => dispatch({ type: "SELECT_BASE", baseKey })}
                        />
                    </section>

                    <Inspector selectedBaseKey={state.selectedBaseKey} hoveredAtomId={hoveredAtomId} />
                </main>
            ) : (
                <main className="app-shell app-shell--quiz">
                    <QuizPanel
                        mode={state.mode}
                        quiz={state.quiz}
                        canvasRef={quizCanvasRef}
                        onAnswer={handleQuizAnswer}
                        onReset={() => dispatch({ type: "RESET_QUIZ" })}
                        onCanvasClick={handleQuizCanvasClick}
                        onCanvasMove={handleQuizCanvasMove}
                        onCanvasLeave={handleQuizCanvasLeave}
                    />
                </main>
            )}
        </div>
    );
}
