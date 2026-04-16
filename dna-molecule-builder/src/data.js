export const BASES = {
    adenine: {
        key: "adenine",
        name: "Adenine",
        letter: "A",
        pairLetter: "T",
        pairName: "Thymine",
        nucleotide: "dAMP",
        incoming: "dATP",
        color: "#60c8ff",
        tint: "rgba(96, 200, 255, 0.16)",
        hbondCount: 2,
    },
    thymine: {
        key: "thymine",
        name: "Thymine",
        letter: "T",
        pairLetter: "A",
        pairName: "Adenine",
        nucleotide: "dTMP",
        incoming: "dTTP",
        color: "#f7b955",
        tint: "rgba(247, 185, 85, 0.16)",
        hbondCount: 2,
    },
    guanine: {
        key: "guanine",
        name: "Guanine",
        letter: "G",
        pairLetter: "C",
        pairName: "Cytosine",
        nucleotide: "dGMP",
        incoming: "dGTP",
        color: "#74e39c",
        tint: "rgba(116, 227, 156, 0.16)",
        hbondCount: 3,
    },
    cytosine: {
        key: "cytosine",
        name: "Cytosine",
        letter: "C",
        pairLetter: "G",
        pairName: "Guanine",
        nucleotide: "dCMP",
        incoming: "dCTP",
        color: "#ff8f7f",
        tint: "rgba(255, 143, 127, 0.16)",
        hbondCount: 3,
    },
};

export const BASE_ORDER = ["adenine", "thymine", "guanine", "cytosine"];

export const COMPLEMENTS = {
    adenine: "thymine",
    thymine: "adenine",
    guanine: "cytosine",
    cytosine: "guanine",
};

export const SEQUENCE_LOOKUP = {
    A: "adenine",
    T: "thymine",
    G: "guanine",
    C: "cytosine",
};

export const CONCEPT_CARDS = [
    {
        title: "Glycosidic Bond",
        body: "Each base attaches to deoxyribose at the sugar's 1' carbon. That base-sugar link makes a nucleoside before phosphate is counted.",
    },
    {
        title: "Phosphodiester Bond",
        body: "DNA strands grow when the 3' hydroxyl of one sugar connects to the 5' phosphate of the next nucleotide, creating a 3'→5' phosphodiester linkage.",
    },
    {
        title: "Directionality",
        body: "The backbone has polarity. Polymerases extend the free 3' end, so the strand is written and built in the 5'→3' direction.",
    },
    {
        title: "Backbone vs. Bases",
        body: "The sugar-phosphate backbone carries the chain. Bases project off the sugars and store the sequence information used for pairing.",
    },
];

export function parseSequenceInput(value) {
    const baseKeys = [];
    const invalid = [];

    for (const char of value.toUpperCase()) {
        if (char === " " || char === "-" || char === "_" || char === ",") {
            continue;
        }

        if (SEQUENCE_LOOKUP[char]) {
            baseKeys.push(SEQUENCE_LOOKUP[char]);
            continue;
        }

        if (char.trim()) {
            invalid.push(char);
        }
    }

    return {
        baseKeys,
        invalid: [...new Set(invalid)],
    };
}

export function formatSequence(strand) {
    return strand.map((baseKey) => BASES[baseKey].letter).join("");
}

export function formatComplement(strand) {
    return strand.map((baseKey) => BASES[COMPLEMENTS[baseKey]].letter).join("");
}

export function gcContent(strand) {
    if (strand.length === 0) {
        return 0;
    }

    const gcCount = strand.filter((baseKey) => baseKey === "guanine" || baseKey === "cytosine").length;
    return Math.round((gcCount / strand.length) * 100);
}
