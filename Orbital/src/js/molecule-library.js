// Molecule Library - Prebuilt molecules for quick insertion

class MoleculeLibrary {
    constructor() {
        this.library = this.initializeLibrary();
    }

    initializeLibrary() {
        return {
            carbonyls: {
                name: 'Carbonyl Compounds',
                molecules: [
                    {
                        id: 'formalaldehyde',
                        name: 'Formaldehyde',
                        formula: 'CH₂O',
                        description: 'Simple aldehyde often used in polymer synthesis.',
                        atoms: [
                            { id: 'c1', element: 'C', x: 0, y: 0 },
                            { id: 'o1', element: 'O', x: 0, y: -30 },
                            { id: 'h1', element: 'H', x: -25, y: 10 },
                            { id: 'h2', element: 'H', x: 25, y: 10 }
                        ],
                        bonds: [
                            { atom1: 'c1', atom2: 'o1', order: 2 },
                            { atom1: 'c1', atom2: 'h1', order: 1 },
                            { atom1: 'c1', atom2: 'h2', order: 1 }
                        ]
                    },
                    {
                        id: 'acetone',
                        name: 'Acetone',
                        formula: 'C₃H₆O',
                        description: 'Prototypical ketone (dimethyl ketone).',
                        atoms: [
                            { id: 'c1', element: 'C', x: 0, y: 0 },
                            { id: 'o1', element: 'O', x: 0, y: -35 },
                            { id: 'c2', element: 'C', x: -35, y: 0 },
                            { id: 'c3', element: 'C', x: 35, y: 0 },
                            { id: 'h1', element: 'H', x: -55, y: -15 },
                            { id: 'h2', element: 'H', x: -55, y: 15 },
                            { id: 'h3', element: 'H', x: -25, y: 25 },
                            { id: 'h4', element: 'H', x: 55, y: -15 },
                            { id: 'h5', element: 'H', x: 55, y: 15 },
                            { id: 'h6', element: 'H', x: 25, y: 25 }
                        ],
                        bonds: [
                            { atom1: 'c1', atom2: 'o1', order: 2 },
                            { atom1: 'c1', atom2: 'c2', order: 1 },
                            { atom1: 'c1', atom2: 'c3', order: 1 },
                            { atom1: 'c2', atom2: 'h1', order: 1 },
                            { atom1: 'c2', atom2: 'h2', order: 1 },
                            { atom1: 'c2', atom2: 'h3', order: 1 },
                            { atom1: 'c3', atom2: 'h4', order: 1 },
                            { atom1: 'c3', atom2: 'h5', order: 1 },
                            { atom1: 'c3', atom2: 'h6', order: 1 }
                        ]
                    },
                    {
                        id: 'benzaldehyde',
                        name: 'Benzaldehyde',
                        formula: 'C₇H₆O',
                        description: 'Aromatic aldehyde used in fragrance chemistry.',
                        atoms: [
                            { id: 'c1', element: 'C', x: 0, y: 0 },
                            { id: 'o1', element: 'O', x: 0, y: -35 },
                            { id: 'c2', element: 'C', x: -35, y: 0 },
                            { id: 'c3', element: 'C', x: -55, y: -30 },
                            { id: 'c4', element: 'C', x: -85, y: -15 },
                            { id: 'c5', element: 'C', x: -85, y: 20 },
                            { id: 'c6', element: 'C', x: -55, y: 35 },
                            { id: 'c7', element: 'C', x: -35, y: 15 },
                            { id: 'h1', element: 'H', x: -100, y: -40 },
                            { id: 'h2', element: 'H', x: -115, y: 0 },
                            { id: 'h3', element: 'H', x: -100, y: 45 },
                            { id: 'h4', element: 'H', x: -35, y: 45 }
                        ],
                        bonds: [
                            { atom1: 'c1', atom2: 'o1', order: 2 },
                            { atom1: 'c1', atom2: 'c2', order: 1 },
                            { atom1: 'c2', atom2: 'c3', order: 2 },
                            { atom1: 'c3', atom2: 'c4', order: 1 },
                            { atom1: 'c4', atom2: 'c5', order: 2 },
                            { atom1: 'c5', atom2: 'c6', order: 1 },
                            { atom1: 'c6', atom2: 'c7', order: 2 },
                            { atom1: 'c7', atom2: 'c2', order: 1 },
                            { atom1: 'c3', atom2: 'h1', order: 1 },
                            { atom1: 'c4', atom2: 'h2', order: 1 },
                            { atom1: 'c5', atom2: 'h3', order: 1 },
                            { atom1: 'c7', atom2: 'h4', order: 1 }
                        ]
                    },
                    {
                        id: 'acetic_acid',
                        name: 'Acetic Acid',
                        formula: 'CH₃COOH',
                        description: 'Classic carboxylic acid for esterification demos.',
                        atoms: [
                            { id: 'c1', element: 'C', x: 0, y: 0 },
                            { id: 'c2', element: 'C', x: 35, y: 0 },
                            { id: 'o1', element: 'O', x: 60, y: -25 },
                            { id: 'o2', element: 'O', x: 60, y: 25 },
                            { id: 'h1', element: 'H', x: -25, y: -20 },
                            { id: 'h2', element: 'H', x: -25, y: 0 },
                            { id: 'h3', element: 'H', x: -25, y: 20 },
                            { id: 'h4', element: 'H', x: 80, y: 25 }
                        ],
                        bonds: [
                            { atom1: 'c1', atom2: 'c2', order: 1 },
                            { atom1: 'c2', atom2: 'o1', order: 2 },
                            { atom1: 'c2', atom2: 'o2', order: 1 },
                            { atom1: 'c1', atom2: 'h1', order: 1 },
                            { atom1: 'c1', atom2: 'h2', order: 1 },
                            { atom1: 'c1', atom2: 'h3', order: 1 },
                            { atom1: 'o2', atom2: 'h4', order: 1 }
                        ]
                    }
                ]
            },
            alcohols: {
                name: 'Alcohols & Diols',
                molecules: [
                    {
                        id: 'ethanol',
                        name: 'Ethanol',
                        formula: 'C₂H₅OH',
                        description: 'Primary alcohol; oxidation substrate.',
                        atoms: [
                            { id: 'c1', element: 'C', x: 0, y: 0 },
                            { id: 'c2', element: 'C', x: 35, y: 0 },
                            { id: 'o1', element: 'O', x: 60, y: 0 },
                            { id: 'h1', element: 'H', x: -25, y: -20 },
                            { id: 'h2', element: 'H', x: -25, y: 20 },
                            { id: 'h3', element: 'H', x: 0, y: 30 },
                            { id: 'h4', element: 'H', x: 35, y: 25 },
                            { id: 'h5', element: 'H', x: 35, y: -25 },
                            { id: 'h6', element: 'H', x: 80, y: 0 }
                        ],
                        bonds: [
                            { atom1: 'c1', atom2: 'c2', order: 1 },
                            { atom1: 'c2', atom2: 'o1', order: 1 },
                            { atom1: 'c1', atom2: 'h1', order: 1 },
                            { atom1: 'c1', atom2: 'h2', order: 1 },
                            { atom1: 'c1', atom2: 'h3', order: 1 },
                            { atom1: 'c2', atom2: 'h4', order: 1 },
                            { atom1: 'c2', atom2: 'h5', order: 1 },
                            { atom1: 'o1', atom2: 'h6', order: 1 }
                        ]
                    },
                    {
                        id: 'isopropanol',
                        name: 'Isopropanol',
                        formula: 'C₃H₇OH',
                        description: 'Secondary alcohol; oxidizes to acetone.',
                        atoms: [
                            { id: 'c1', element: 'C', x: 0, y: 0 },
                            { id: 'c2', element: 'C', x: 35, y: 0 },
                            { id: 'c3', element: 'C', x: 70, y: 0 },
                            { id: 'o1', element: 'O', x: 35, y: -35 },
                            { id: 'h1', element: 'H', x: -25, y: -20 },
                            { id: 'h2', element: 'H', x: -25, y: 20 },
                            { id: 'h3', element: 'H', x: 0, y: 30 },
                            { id: 'h4', element: 'H', x: 70, y: 30 },
                            { id: 'h5', element: 'H', x: 70, y: -30 },
                            { id: 'h6', element: 'H', x: 35, y: -60 }
                        ],
                        bonds: [
                            { atom1: 'c1', atom2: 'c2', order: 1 },
                            { atom1: 'c2', atom2: 'c3', order: 1 },
                            { atom1: 'c2', atom2: 'o1', order: 1 },
                            { atom1: 'c1', atom2: 'h1', order: 1 },
                            { atom1: 'c1', atom2: 'h2', order: 1 },
                            { atom1: 'c1', atom2: 'h3', order: 1 },
                            { atom1: 'c3', atom2: 'h4', order: 1 },
                            { atom1: 'c3', atom2: 'h5', order: 1 },
                            { atom1: 'o1', atom2: 'h6', order: 1 }
                        ]
                    }
                ]
            },
            aromatics: {
                name: 'Aromatic Systems',
                molecules: [
                    {
                        id: 'benzene',
                        name: 'Benzene',
                        formula: 'C₆H₆',
                        description: 'Parent aromatic compound for EAS reactions.',
                        atoms: [
                            { id: 'c1', element: 'C', x: 0, y: -35 },
                            { id: 'c2', element: 'C', x: 30, y: -15 },
                            { id: 'c3', element: 'C', x: 30, y: 20 },
                            { id: 'c4', element: 'C', x: 0, y: 40 },
                            { id: 'c5', element: 'C', x: -30, y: 20 },
                            { id: 'c6', element: 'C', x: -30, y: -15 },
                            { id: 'h1', element: 'H', x: 0, y: -60 },
                            { id: 'h2', element: 'H', x: 55, y: -30 },
                            { id: 'h3', element: 'H', x: 55, y: 35 },
                            { id: 'h4', element: 'H', x: 0, y: 65 },
                            { id: 'h5', element: 'H', x: -55, y: 35 },
                            { id: 'h6', element: 'H', x: -55, y: -30 }
                        ],
                        bonds: [
                            { atom1: 'c1', atom2: 'c2', order: 2 },
                            { atom1: 'c2', atom2: 'c3', order: 1 },
                            { atom1: 'c3', atom2: 'c4', order: 2 },
                            { atom1: 'c4', atom2: 'c5', order: 1 },
                            { atom1: 'c5', atom2: 'c6', order: 2 },
                            { atom1: 'c6', atom2: 'c1', order: 1 },
                            { atom1: 'c1', atom2: 'h1', order: 1 },
                            { atom1: 'c2', atom2: 'h2', order: 1 },
                            { atom1: 'c3', atom2: 'h3', order: 1 },
                            { atom1: 'c4', atom2: 'h4', order: 1 },
                            { atom1: 'c5', atom2: 'h5', order: 1 },
                            { atom1: 'c6', atom2: 'h6', order: 1 }
                        ]
                    }
                ]
            }
        };
    }

    getCategories() {
        return Object.keys(this.library).map(key => ({ key, name: this.library[key].name }));
    }

    getMoleculesForCategory(categoryKey) {
        return this.library[categoryKey]?.molecules || [];
    }

    getMoleculeById(moleculeId) {
        for (const category of Object.values(this.library)) {
            const found = category.molecules.find(mol => mol.id === moleculeId);
            if (found) return JSON.parse(JSON.stringify(found));
        }
        return null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MoleculeLibrary };
}
