const HEX = {
    N1: { x: 148, y: 190 },
    C2: { x: 148, y: 250 },
    N3: { x: 200, y: 280 },
    C4: { x: 252, y: 250 },
    C5: { x: 252, y: 190 },
    C6: { x: 200, y: 160 },
};

const PENT = {
    N7: { x: 309, y: 171 },
    C8: { x: 344, y: 220 },
    N9: { x: 309, y: 269 },
};

export const DNA_BASES = {
    adenine: {
        name: "Adenine",
        letter: "A",
        formula: "C₅H₅N₅",
        type: "Purine",
        ring: "Bicyclic (imidazole fused to pyrimidine)",
        pairsWith: "Thymine",
        hbondCount: 2,
        description: "A purine with an amino group at C6. It forms two hydrogen bonds with thymine in DNA.",
        atoms: [
            { id: "N1", element: "N", ...HEX.N1, ringNum: 1 },
            { id: "C2", element: "C", ...HEX.C2, ringNum: 2 },
            { id: "N3", element: "N", ...HEX.N3, ringNum: 3 },
            { id: "C4", element: "C", ...HEX.C4, ringNum: 4 },
            { id: "C5", element: "C", ...HEX.C5, ringNum: 5 },
            { id: "C6", element: "C", ...HEX.C6, ringNum: 6 },
            { id: "N7", element: "N", ...PENT.N7, ringNum: 7 },
            { id: "C8", element: "C", ...PENT.C8, ringNum: 8 },
            { id: "N9", element: "NH", ...PENT.N9, ringNum: 9 },
            { id: "NH2", element: "NH₂", x: 200, y: 98, exocyclic: true },
        ],
        bonds: [
            { from: "N1", to: "C6", order: 2 },
            { from: "C6", to: "C5", order: 1 },
            { from: "C5", to: "C4", order: 2 },
            { from: "C4", to: "N3", order: 1 },
            { from: "N3", to: "C2", order: 2 },
            { from: "C2", to: "N1", order: 1 },
            { from: "C5", to: "N7", order: 1 },
            { from: "N7", to: "C8", order: 2 },
            { from: "C8", to: "N9", order: 1 },
            { from: "N9", to: "C4", order: 1 },
            { from: "C6", to: "NH2", order: 1 },
        ],
        hbondSites: [
            {
                atomId: "NH2",
                type: "donor",
                label: "Donor",
                detail: "NH₂ at C6 donates a hydrogen to thymine C4=O.",
                pairingAtom: "C4=O on Thymine",
            },
            {
                atomId: "N1",
                type: "acceptor",
                label: "Acceptor",
                detail: "N1 accepts a hydrogen from thymine N3—H.",
                pairingAtom: "N3—H on Thymine",
            },
        ],
        sugarAttachment: { atomId: "N9" },
    },
    thymine: {
        name: "Thymine",
        letter: "T",
        formula: "C₅H₆N₂O₂",
        type: "Pyrimidine",
        ring: "Single 6-membered ring",
        pairsWith: "Adenine",
        hbondCount: 2,
        description: "A pyrimidine with two carbonyl groups and a methyl at C5. It pairs with adenine in DNA.",
        atoms: [
            { id: "N1", element: "NH", ...HEX.N1, ringNum: 1 },
            { id: "C2", element: "C", ...HEX.C2, ringNum: 2 },
            { id: "N3", element: "NH", ...HEX.N3, ringNum: 3 },
            { id: "C4", element: "C", ...HEX.C4, ringNum: 4 },
            { id: "C5", element: "C", ...HEX.C5, ringNum: 5 },
            { id: "C6", element: "C", ...HEX.C6, ringNum: 6 },
            { id: "O2", element: "O", x: 95, y: 280, exocyclic: true },
            { id: "O4", element: "O", x: 305, y: 280, exocyclic: true },
            { id: "CH3", element: "CH₃", x: 305, y: 158, exocyclic: true },
        ],
        bonds: [
            { from: "N1", to: "C6", order: 1 },
            { from: "C6", to: "C5", order: 2 },
            { from: "C5", to: "C4", order: 1 },
            { from: "C4", to: "N3", order: 1 },
            { from: "N3", to: "C2", order: 1 },
            { from: "C2", to: "N1", order: 1 },
            { from: "C2", to: "O2", order: 2 },
            { from: "C4", to: "O4", order: 2 },
            { from: "C5", to: "CH3", order: 1 },
        ],
        hbondSites: [
            {
                atomId: "N3",
                type: "donor",
                label: "Donor",
                detail: "N3—H donates to adenine N1.",
                pairingAtom: "N1 on Adenine",
            },
            {
                atomId: "O4",
                type: "acceptor",
                label: "Acceptor",
                detail: "C4=O accepts a hydrogen from adenine NH₂.",
                pairingAtom: "NH₂ on Adenine",
            },
        ],
        sugarAttachment: { atomId: "N1" },
    },
    guanine: {
        name: "Guanine",
        letter: "G",
        formula: "C₅H₅N₅O",
        type: "Purine",
        ring: "Bicyclic (imidazole fused to pyrimidine)",
        pairsWith: "Cytosine",
        hbondCount: 3,
        description: "A purine with a carbonyl at C6 and an amino group at C2. It forms the strongest canonical DNA pair.",
        atoms: [
            { id: "N1", element: "NH", ...HEX.N1, ringNum: 1 },
            { id: "C2", element: "C", ...HEX.C2, ringNum: 2 },
            { id: "N3", element: "N", ...HEX.N3, ringNum: 3 },
            { id: "C4", element: "C", ...HEX.C4, ringNum: 4 },
            { id: "C5", element: "C", ...HEX.C5, ringNum: 5 },
            { id: "C6", element: "C", ...HEX.C6, ringNum: 6 },
            { id: "N7", element: "N", ...PENT.N7, ringNum: 7 },
            { id: "C8", element: "C", ...PENT.C8, ringNum: 8 },
            { id: "N9", element: "NH", ...PENT.N9, ringNum: 9 },
            { id: "O6", element: "O", x: 200, y: 98, exocyclic: true },
            { id: "NH2", element: "NH₂", x: 92, y: 282, exocyclic: true },
        ],
        bonds: [
            { from: "N1", to: "C6", order: 1 },
            { from: "C6", to: "C5", order: 1 },
            { from: "C5", to: "C4", order: 2 },
            { from: "C4", to: "N3", order: 1 },
            { from: "N3", to: "C2", order: 2 },
            { from: "C2", to: "N1", order: 1 },
            { from: "C5", to: "N7", order: 1 },
            { from: "N7", to: "C8", order: 2 },
            { from: "C8", to: "N9", order: 1 },
            { from: "N9", to: "C4", order: 1 },
            { from: "C6", to: "O6", order: 2 },
            { from: "C2", to: "NH2", order: 1 },
        ],
        hbondSites: [
            {
                atomId: "O6",
                type: "acceptor",
                label: "Acceptor",
                detail: "C6=O accepts a hydrogen from cytosine NH₂.",
                pairingAtom: "NH₂ on Cytosine",
            },
            {
                atomId: "N1",
                type: "donor",
                label: "Donor",
                detail: "N1—H donates to cytosine N3.",
                pairingAtom: "N3 on Cytosine",
            },
            {
                atomId: "NH2",
                type: "donor",
                label: "Donor",
                detail: "NH₂ at C2 donates to cytosine C2=O.",
                pairingAtom: "C2=O on Cytosine",
            },
        ],
        sugarAttachment: { atomId: "N9" },
    },
    cytosine: {
        name: "Cytosine",
        letter: "C",
        formula: "C₄H₅N₃O",
        type: "Pyrimidine",
        ring: "Single 6-membered ring",
        pairsWith: "Guanine",
        hbondCount: 3,
        description: "A pyrimidine with an amino group at C4 and a carbonyl at C2. It pairs with guanine.",
        atoms: [
            { id: "N1", element: "NH", ...HEX.N1, ringNum: 1 },
            { id: "C2", element: "C", ...HEX.C2, ringNum: 2 },
            { id: "N3", element: "N", ...HEX.N3, ringNum: 3 },
            { id: "C4", element: "C", ...HEX.C4, ringNum: 4 },
            { id: "C5", element: "C", ...HEX.C5, ringNum: 5 },
            { id: "C6", element: "C", ...HEX.C6, ringNum: 6 },
            { id: "O2", element: "O", x: 95, y: 280, exocyclic: true },
            { id: "NH2", element: "NH₂", x: 305, y: 280, exocyclic: true },
        ],
        bonds: [
            { from: "N1", to: "C6", order: 1 },
            { from: "C6", to: "C5", order: 2 },
            { from: "C5", to: "C4", order: 1 },
            { from: "C4", to: "N3", order: 2 },
            { from: "N3", to: "C2", order: 1 },
            { from: "C2", to: "N1", order: 1 },
            { from: "C2", to: "O2", order: 2 },
            { from: "C4", to: "NH2", order: 1 },
        ],
        hbondSites: [
            {
                atomId: "NH2",
                type: "donor",
                label: "Donor",
                detail: "NH₂ at C4 donates to guanine C6=O.",
                pairingAtom: "C6=O on Guanine",
            },
            {
                atomId: "N3",
                type: "acceptor",
                label: "Acceptor",
                detail: "N3 accepts a hydrogen from guanine N1—H.",
                pairingAtom: "N1—H on Guanine",
            },
            {
                atomId: "O2",
                type: "acceptor",
                label: "Acceptor",
                detail: "C2=O accepts a hydrogen from guanine NH₂.",
                pairingAtom: "NH₂ on Guanine",
            },
        ],
        sugarAttachment: { atomId: "N1" },
    },
    uracil: {
        name: "Uracil",
        letter: "U",
        formula: "C₄H₄N₂O₂",
        type: "Pyrimidine",
        ring: "Single 6-membered ring",
        pairsWith: "Adenine",
        hbondCount: 2,
        description: "An RNA pyrimidine that resembles thymine without the methyl group at C5.",
        atoms: [
            { id: "N1", element: "NH", ...HEX.N1, ringNum: 1 },
            { id: "C2", element: "C", ...HEX.C2, ringNum: 2 },
            { id: "N3", element: "NH", ...HEX.N3, ringNum: 3 },
            { id: "C4", element: "C", ...HEX.C4, ringNum: 4 },
            { id: "C5", element: "C", ...HEX.C5, ringNum: 5 },
            { id: "C6", element: "C", ...HEX.C6, ringNum: 6 },
            { id: "O2", element: "O", x: 95, y: 280, exocyclic: true },
            { id: "O4", element: "O", x: 305, y: 280, exocyclic: true },
        ],
        bonds: [
            { from: "N1", to: "C6", order: 1 },
            { from: "C6", to: "C5", order: 2 },
            { from: "C5", to: "C4", order: 1 },
            { from: "C4", to: "N3", order: 1 },
            { from: "N3", to: "C2", order: 1 },
            { from: "C2", to: "N1", order: 1 },
            { from: "C2", to: "O2", order: 2 },
            { from: "C4", to: "O4", order: 2 },
        ],
        hbondSites: [
            {
                atomId: "N3",
                type: "donor",
                label: "Donor",
                detail: "N3—H donates to adenine N1.",
                pairingAtom: "N1 on Adenine",
            },
            {
                atomId: "O4",
                type: "acceptor",
                label: "Acceptor",
                detail: "C4=O accepts a hydrogen from adenine NH₂.",
                pairingAtom: "NH₂ on Adenine",
            },
        ],
        sugarAttachment: { atomId: "N1" },
    },
};

export const BASE_ORDER = ["adenine", "thymine", "guanine", "cytosine", "uracil"];
export const DNA_STRAND_KEYS = ["adenine", "thymine", "guanine", "cytosine"];

export const LETTER_TO_BASE = {
    A: "adenine",
    T: "thymine",
    G: "guanine",
    C: "cytosine",
    U: "uracil",
};

export const BASE_TO_COMPLEMENT = {
    adenine: "thymine",
    thymine: "adenine",
    guanine: "cytosine",
    cytosine: "guanine",
    uracil: "adenine",
};

const PAIRING_BOND_MAP = {
    adenine: {
        thymine: [
            { from: "NH2", to: "O4", type: "donor" },
            { from: "N1", to: "N3", type: "acceptor" },
        ],
        uracil: [
            { from: "NH2", to: "O4", type: "donor" },
            { from: "N1", to: "N3", type: "acceptor" },
        ],
    },
    thymine: {
        adenine: [
            { from: "O4", to: "NH2", type: "acceptor" },
            { from: "N3", to: "N1", type: "donor" },
        ],
    },
    guanine: {
        cytosine: [
            { from: "O6", to: "NH2", type: "acceptor" },
            { from: "N1", to: "N3", type: "donor" },
            { from: "NH2", to: "O2", type: "donor" },
        ],
    },
    cytosine: {
        guanine: [
            { from: "NH2", to: "O6", type: "donor" },
            { from: "N3", to: "N1", type: "acceptor" },
            { from: "O2", to: "NH2", type: "acceptor" },
        ],
    },
    uracil: {
        adenine: [
            { from: "O4", to: "NH2", type: "acceptor" },
            { from: "N3", to: "N1", type: "donor" },
        ],
    },
};

export function getComplementKey(baseKey) {
    return BASE_TO_COMPLEMENT[baseKey] || null;
}

export function getPairMap(baseKey, partnerKey = getComplementKey(baseKey)) {
    return PAIRING_BOND_MAP[baseKey]?.[partnerKey] || [];
}

export function isDnaStrandBase(baseKey) {
    return DNA_STRAND_KEYS.includes(baseKey);
}

export function cleanSequenceInput(raw) {
    const validKeys = [];
    const invalidTokens = [];

    for (const char of raw.toUpperCase()) {
        if (char === " " || char === "-" || char === "_" || char === ",") {
            continue;
        }

        const baseKey = LETTER_TO_BASE[char];
        if (baseKey && isDnaStrandBase(baseKey)) {
            validKeys.push(baseKey);
            continue;
        }

        if (char.trim()) {
            invalidTokens.push(char);
        }
    }

    return {
        validKeys,
        invalidTokens: [...new Set(invalidTokens)],
    };
}

export function formatSequence(baseKeys) {
    return baseKeys.map((baseKey) => DNA_BASES[baseKey].letter).join("");
}
