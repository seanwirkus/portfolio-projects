// DNA Replication Study Data
// Covers Problem Set 2: enzymes, bonds, fork anatomy, telomerase, nucleases

const ENZYMES = {
    helicase: {
        name: 'Helicase',
        shortName: 'Helicase',
        color: '#f59e0b',
        fn: 'Unwinds the DNA double helix at the replication fork',
        bondAction: 'Breaks hydrogen bonds between complementary base pairs',
        bondType: 'hydrogen',
        location: 'At the replication fork junction',
        detail: 'Uses ATP hydrolysis to separate parental DNA strands so each can serve as a template for new DNA synthesis.',
        inMismatchRepair: true,
    },
    topoisomerase: {
        name: 'Topoisomerase',
        shortName: 'Topo',
        color: '#8b5cf6',
        fn: 'Relieves torsional strain (supercoiling) ahead of the replication fork',
        bondAction: 'Breaks and re-forms phosphodiester bonds in the backbone',
        bondType: 'phosphodiester',
        location: 'Ahead of the replication fork, on parent DNA',
        detail: 'Cuts one or both DNA strands to allow rotation, then reseals. Prevents the DNA ahead of the fork from becoming overwound.',
        inMismatchRepair: false,
    },
    ssb: {
        name: 'SSB Proteins',
        shortName: 'SSB',
        color: '#14b8a6',
        fn: 'Stabilize single-stranded DNA after unwinding',
        bondAction: 'No covalent bond changes \u2014 non-covalent binding only',
        bondType: 'none',
        location: 'Coating exposed single-stranded template DNA',
        detail: 'Prevents single strands from re-annealing or being degraded by nucleases. Keeps the template extended for polymerase access.',
        inMismatchRepair: false,
    },
    primase: {
        name: 'Primase',
        shortName: 'Primase',
        color: '#ec4899',
        fn: 'Synthesizes short RNA primers (~10 nt) to initiate DNA synthesis',
        bondAction: 'Forms phosphodiester bonds (RNA nucleotides)',
        bondType: 'phosphodiester',
        location: 'On the template strand at each Okazaki fragment start',
        detail: 'DNA polymerase CANNOT start de novo \u2014 it needs a free 3\u2032-OH group. Primase provides this by laying down a short RNA primer. Both RNA and DNA primers share this 3\u2032-OH.',
        inMismatchRepair: false,
    },
    dnaPol3: {
        name: 'DNA Polymerase III',
        shortName: 'Pol III',
        color: '#3b82f6',
        fn: 'Main replicative polymerase: synthesizes 5\u2032\u21923\u2032 and proofreads 3\u2032\u21925\u2032',
        bondAction: 'Forms phosphodiester bonds (polymerase); breaks them (exonuclease)',
        bondType: 'phosphodiester',
        location: 'On both leading and lagging strands',
        detail: 'TWO enzyme activities:\n\u2022 5\u2032\u21923\u2032 polymerase \u2014 adds nucleotides, forming phosphodiester bonds\n\u2022 3\u2032\u21925\u2032 exonuclease \u2014 removes mismatches (proofreading), breaking phosphodiester bonds',
        dualActivities: [
            '5\u2032\u21923\u2032 polymerase \u2014 forms phosphodiester bonds',
            '3\u2032\u21925\u2032 exonuclease \u2014 breaks phosphodiester bonds (proofreading)',
        ],
        inMismatchRepair: true,
    },
    dnaPol1: {
        name: 'DNA Polymerase I',
        shortName: 'Pol I',
        color: '#6366f1',
        fn: 'Removes RNA primers and replaces them with DNA',
        bondAction: 'Breaks phosphodiester bonds (5\u2032\u21923\u2032 exonuclease); forms them (polymerase)',
        bondType: 'phosphodiester',
        location: 'On the lagging strand at primer locations',
        detail: 'Has 5\u2032\u21923\u2032 exonuclease activity to degrade RNA primers, and polymerase activity to fill the resulting gap with DNA nucleotides.',
        inMismatchRepair: false,
    },
    ligase: {
        name: 'DNA Ligase',
        shortName: 'Ligase',
        color: '#10b981',
        fn: 'Joins Okazaki fragments by sealing nicks in the backbone',
        bondAction: 'Forms phosphodiester bonds between adjacent nucleotides',
        bondType: 'phosphodiester',
        location: 'Between Okazaki fragments on the lagging strand',
        detail: 'After Pol I removes the primer and fills the gap, Ligase seals the remaining nick by forming a phosphodiester bond between the 3\u2032-OH and 5\u2032-phosphate of adjacent nucleotides.',
        inMismatchRepair: true,
    },
    telomerase: {
        name: 'Telomerase',
        shortName: 'Telomerase',
        color: '#f97316',
        fn: 'Extends the 3\u2032 end of the parent template strand at chromosome ends',
        bondAction: 'Forms phosphodiester bonds using its built-in RNA template',
        bondType: 'phosphodiester',
        location: 'At chromosome ends (telomeres)',
        detail: 'A reverse transcriptase with its own RNA template. Extends the PARENT TEMPLATE strand (NOT the daughter strand) to solve the end-replication problem. Only active in germ cells, stem cells, and most cancers.',
        inMismatchRepair: false,
    },
};

// Enzymes shared between replication AND mismatch repair
const MISMATCH_REPAIR_ENZYMES = ['helicase', 'dnaPol3', 'ligase'];

const BOND_TYPES = {
    phosphodiester: {
        name: 'Phosphodiester Bond',
        desc: 'Covalent bond in the sugar-phosphate backbone',
        location: 'Between the 3\u2032-OH of one nucleotide and the 5\u2032-phosphate of the next',
        color: '#3b82f6',
    },
    hydrogen: {
        name: 'Hydrogen Bond',
        desc: 'Non-covalent bond between complementary base pairs',
        location: 'Between bases across the double helix (A-T: 2, G-C: 3)',
        color: '#f59e0b',
    },
};

const KEY_CONCEPTS = [
    {
        id: 'primer',
        title: 'RNA vs DNA Primers',
        icon: '\ud83d\udcdd',
        text: 'Both RNA and DNA primers provide a free 3\u2032-OH group for DNA polymerase to extend. DNA pol CANNOT start synthesis de novo \u2014 it always needs a primer.',
    },
    {
        id: 'direction',
        title: '5\u2032\u21923\u2032 Synthesis',
        icon: '\u27a1\ufe0f',
        text: 'DNA polymerase ONLY synthesizes in the 5\u2032\u21923\u2032 direction. It reads the template 3\u2032\u21925\u2032 and builds the new strand 5\u2032\u21923\u2032.',
    },
    {
        id: 'leading',
        title: 'Leading Strand',
        icon: '\ud83d\udfe6',
        text: 'Synthesized continuously in the SAME direction as fork movement. Needs only ONE primer. DNA Pol III stays on and keeps going.',
    },
    {
        id: 'lagging',
        title: 'Lagging Strand',
        icon: '\ud83d\udfe9',
        text: 'Synthesized discontinuously as Okazaki fragments, AWAY from the fork. Needs MANY RNA primers (one per fragment). Primase \u2192 Pol III \u2192 Pol I \u2192 Ligase.',
    },
    {
        id: 'okazaki',
        title: 'Okazaki Fragments',
        icon: '\ud83e\udde9',
        text: 'Short DNA segments on the lagging strand (~1000\u20132000 nt in prokaryotes, ~100\u2013200 nt in eukaryotes). Each starts with an RNA primer that is later replaced by DNA.',
    },
    {
        id: 'dualActivity',
        title: 'Pol III Dual Activities',
        icon: '\ud83d\udd27',
        text: '(1) 5\u2032\u21923\u2032 polymerase \u2014 adds nucleotides, forms phosphodiester bonds.\n(2) 3\u2032\u21925\u2032 exonuclease \u2014 removes mismatched bases (proofreading), breaks phosphodiester bonds.',
    },
    {
        id: 'telomerase',
        title: 'Telomerase',
        icon: '\ud83d\udd1a',
        text: 'Extends the PARENT TEMPLATE strand (not the daughter) using its internal RNA template. It is a reverse transcriptase. Solves the end-replication problem at chromosome ends.',
    },
    {
        id: 'nucleases',
        title: 'Endo vs Exonuclease',
        icon: '\u2702\ufe0f',
        text: 'Endonuclease: cuts WITHIN a strand (can cut circular DNA).\nExonuclease: removes nucleotides from a FREE END (CANNOT cut circular DNA \u2014 no free ends!).',
    },
    {
        id: 'methylation',
        title: '5-Methylcytosine',
        icon: '\ud83e\uddea',
        text: 'Methyl at C5 does NOT disrupt base pairing with guanine. C5 is not involved in hydrogen bonding \u2014 the H-bonds use positions C2=O, N3, and N4-H.',
    },
    {
        id: 'mismatchRepair',
        title: 'Mismatch Repair',
        icon: '\ud83d\udee0\ufe0f',
        text: 'Three enzymes active in BOTH replication AND mismatch repair:\n\u2022 Helicase \u2014 unwinds at the mismatch\n\u2022 DNA Polymerase \u2014 re-synthesizes the corrected strand\n\u2022 DNA Ligase \u2014 seals the nick',
    },
];

// Quiz question banks
const ENZYME_QUESTIONS = [
    { q: 'Which enzyme unwinds the DNA double helix at the replication fork?', a: 'helicase', opts: ['helicase', 'topoisomerase', 'primase', 'ligase'] },
    { q: 'Which enzyme synthesizes RNA primers?', a: 'primase', opts: ['primase', 'dnaPol3', 'ligase', 'helicase'] },
    { q: 'Which enzyme has BOTH polymerase and exonuclease activity?', a: 'dnaPol3', opts: ['dnaPol3', 'primase', 'ligase', 'dnaPol1'] },
    { q: 'Which enzyme joins Okazaki fragments?', a: 'ligase', opts: ['ligase', 'dnaPol1', 'primase', 'helicase'] },
    { q: 'Which enzyme relieves supercoiling ahead of the fork?', a: 'topoisomerase', opts: ['topoisomerase', 'helicase', 'ssb', 'primase'] },
    { q: 'Which enzyme replaces RNA primers with DNA?', a: 'dnaPol1', opts: ['dnaPol1', 'dnaPol3', 'primase', 'ligase'] },
    { q: 'Which enzyme extends telomeres at chromosome ends?', a: 'telomerase', opts: ['telomerase', 'dnaPol1', 'primase', 'helicase'] },
    { q: 'Which proteins stabilize single-stranded DNA after unwinding?', a: 'ssb', opts: ['ssb', 'primase', 'ligase', 'topoisomerase'] },
    { q: 'Which enzyme forms phosphodiester bonds between Okazaki fragments?', a: 'ligase', opts: ['ligase', 'dnaPol3', 'helicase', 'primase'] },
    { q: 'Which enzyme is a reverse transcriptase with its own RNA template?', a: 'telomerase', opts: ['telomerase', 'primase', 'dnaPol3', 'dnaPol1'] },
    { q: 'Which enzyme\'s proofreading activity removes mismatched bases?', a: 'dnaPol3', opts: ['dnaPol3', 'dnaPol1', 'ligase', 'helicase'] },
    { q: 'Which enzyme cuts DNA strands to relieve tension, then reseals them?', a: 'topoisomerase', opts: ['topoisomerase', 'helicase', 'ligase', 'dnaPol1'] },
];

const CONCEPT_QUESTIONS = [
    { q: 'What type of bond does DNA polymerase form during DNA synthesis?', a: 'Phosphodiester bonds', opts: ['Phosphodiester bonds', 'Hydrogen bonds', 'Peptide bonds', 'Glycosidic bonds'] },
    { q: 'What type of bond does helicase break to unwind DNA?', a: 'Hydrogen bonds', opts: ['Hydrogen bonds', 'Phosphodiester bonds', 'Covalent bonds', 'Ionic bonds'] },
    { q: 'In what direction does DNA polymerase synthesize new DNA?', a: '5\u2032 to 3\u2032', opts: ['5\u2032 to 3\u2032', '3\u2032 to 5\u2032', 'Either direction', 'C to N terminus'] },
    { q: 'Does telomerase extend the parent template or daughter strand?', a: 'Parent template strand', opts: ['Parent template strand', 'Lagging daughter strand', 'Leading daughter strand', 'Both strands'] },
    { q: 'Why can DNA polymerase use either RNA or DNA primers?', a: 'Both have a 3\u2032-OH group', opts: ['Both have a 3\u2032-OH group', 'Both have a 5\u2032 cap', 'Both are double-stranded', 'Both contain thymine'] },
    { q: 'Can an exonuclease cut circular DNA?', a: 'No \u2014 it needs a free end', opts: ['No \u2014 it needs a free end', 'Yes \u2014 it cuts anywhere', 'Only with ATP', 'Only in prokaryotes'] },
    { q: 'Does methylation at C5 of cytosine disrupt G-C base pairing?', a: 'No \u2014 C5 is not involved in H-bonding', opts: ['No \u2014 C5 is not involved in H-bonding', 'Yes \u2014 it blocks hydrogen bonds', 'Only at high temperatures', 'Only in RNA'] },
    { q: 'What are the TWO activities of DNA Polymerase III?', a: '5\u2032\u21923\u2032 polymerase + 3\u2032\u21925\u2032 exonuclease', opts: ['5\u2032\u21923\u2032 polymerase + 3\u2032\u21925\u2032 exonuclease', 'Helicase + ligase', '5\u2032\u21923\u2032 exonuclease + primase', 'Topoisomerase + polymerase'] },
    { q: 'Name three enzymes active in both replication and mismatch repair.', a: 'Helicase, DNA Pol, Ligase', opts: ['Helicase, DNA Pol, Ligase', 'Primase, Pol I, SSB', 'Topoisomerase, Primase, Ligase', 'Telomerase, Pol III, SSB'] },
    { q: 'How does the leading strand differ from the lagging strand?', a: 'Leading is continuous; lagging has Okazaki fragments', opts: ['Leading is continuous; lagging has Okazaki fragments', 'Leading uses RNA; lagging uses DNA', 'Leading goes 3\u2032\u21925\u2032; lagging goes 5\u2032\u21923\u2032', 'Leading has no primer; lagging has primers'] },
    { q: 'Which strand is synthesized as Okazaki fragments?', a: 'Lagging strand', opts: ['Lagging strand', 'Leading strand', 'Both strands', 'Template strand'] },
    { q: 'What does telomerase use as a template?', a: 'Its own built-in RNA', opts: ['Its own built-in RNA', 'The daughter strand', 'mRNA', 'tRNA'] },
    { q: 'Can an endonuclease cut circular DNA?', a: 'Yes \u2014 it cuts within a strand', opts: ['Yes \u2014 it cuts within a strand', 'No \u2014 circular DNA has no ends', 'Only with helicase help', 'Only in eukaryotes'] },
    { q: 'What type of bond does ligase form?', a: 'Phosphodiester bonds', opts: ['Phosphodiester bonds', 'Hydrogen bonds', 'Disulfide bonds', 'Glycosidic bonds'] },
];
