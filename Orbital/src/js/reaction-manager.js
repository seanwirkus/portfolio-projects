// Reaction Manager - Handle reaction simulation with reagents

class ReactionManager {
    constructor() {
        this.reactions = [];
        this.currentReactionIndex = 0;
        this.reactionEngine = new ChemicalReactionEngine();
        this.reagentLibrary = {
            'H2SO4': { name: 'Sulfuric Acid', formula: 'H₂SO₄', type: 'acid', color: '#FF6B6B' },
            'HBr': { name: 'Hydrobromic Acid', formula: 'HBr', type: 'acid', color: '#FF8787' },
            'HCl': { name: 'Hydrochloric Acid', formula: 'HCl', type: 'acid', color: '#FFB3B3' },
            'HI': { name: 'Hydroiodic Acid', formula: 'HI', type: 'acid', color: '#FF9AA2' },
            'NaOH': { name: 'Sodium Hydroxide', formula: 'NaOH', type: 'base', color: '#4ECDC4' },
            'KOH': { name: 'Potassium Hydroxide', formula: 'KOH', type: 'base', color: '#45B7AA' },
            'NaOEt': { name: 'Sodium Ethoxide', formula: 'NaOEt', type: 'base', color: '#3DA5A5' },
            't-BuOK': { name: 'Potassium tert-Butoxide', formula: 'KOtBu', type: 'base', color: '#2F9C95' },
            'LDA': { name: 'Lithium Diisopropylamide', formula: 'LDA', type: 'base', color: '#279A8F' },
            'NaCN': { name: 'Sodium Cyanide', formula: 'NaCN', type: 'nucleophile', color: '#48A9A6' },
            'NH3': { name: 'Ammonia', formula: 'NH₃', type: 'nucleophile', color: '#54BAB9' },
            'NaBH4': { name: 'Sodium Borohydride', formula: 'NaBH₄', type: 'reducing', color: '#95E1D3' },
            'LiAlH4': { name: 'Lithium Aluminum Hydride', formula: 'LiAlH₄', type: 'reducing', color: '#7FD8BE' },
            'BH3': { name: 'Borane', formula: 'BH₃·THF', type: 'reducing', color: '#6FDBAD' },
            'DIBAL-H': { name: 'Diisobutylaluminium Hydride', formula: 'DIBAL-H', type: 'reducing', color: '#62C2A8' },
            'H2': { name: 'Hydrogen Gas', formula: 'H₂', type: 'reducing', color: '#5BC0BE' },
            'H2O2': { name: 'Hydrogen Peroxide', formula: 'H₂O₂', type: 'oxidizing', color: '#FFE66D' },
            'KMnO4': { name: 'Potassium Permanganate', formula: 'KMnO₄', type: 'oxidizing', color: '#FFD93D' },
            'CrO3': { name: 'Chromium Trioxide', formula: 'CrO₃', type: 'oxidizing', color: '#FFC93D' },
            'PCC': { name: 'Pyridinium Chlorochromate', formula: 'C₅H₅NH[CrO₃Cl]', type: 'oxidizing', color: '#FFA93D' },
            'mCPBA': { name: 'meta-Chloroperbenzoic Acid', formula: 'C₇H₅ClO₃', type: 'oxidizing', color: '#FFB347' },
            'Br2': { name: 'Bromine', formula: 'Br₂', type: 'halogenating', color: '#FF7F50' },
            'Cl2': { name: 'Chlorine', formula: 'Cl₂', type: 'halogenating', color: '#FF6347' },
            'NBS': { name: 'N-Bromosuccinimide', formula: 'C₄H₄BrNO₂', type: 'halogenating', color: '#FF9F68' },
            'OsO4': { name: 'Osmium Tetroxide', formula: 'OsO₄', type: 'oxidizing', color: '#9B5DE5' },
            'heat': { name: 'Heat', formula: 'Δ', type: 'condition', color: '#FF4500' },
            'hv': { name: 'Light', formula: 'hν', type: 'condition', color: '#FFD700' },
            'H2O': { name: 'Water', formula: 'H₂O', type: 'condition', color: '#4A90E2' },
            'EtOH': { name: 'Ethanol', formula: 'EtOH', type: 'condition', color: '#5DADE2' },
            'THF': { name: 'Tetrahydrofuran', formula: 'THF', type: 'condition', color: '#85C1E9' },
            'CH3OH': { name: 'Methanol', formula: 'CH₃OH', type: 'condition', color: '#7FB3D5' },
            'catalyst': { name: 'Catalyst', formula: 'cat.', type: 'condition', color: '#A9A9A9' }
        };
    }

    /**
     * Perform reaction and get product
     */
    performReaction(reactant, reagents, conditions = []) {
        console.log('🧪 ReactionManager: Performing reaction');
        return this.reactionEngine.performReaction(reactant, reagents, conditions);
    }

    /**
     * Create a new reaction
     * @param {Molecule} reactant
     * @returns {Reaction}
     */
    createReaction(reactant) {
        const reaction = {
            id: Date.now(),
            reactant: this.cloneMolecule(reactant),
            products: [],
            reagents: [],
            conditions: [],
            mechanism: null,
            description: '',
            yield: 0
        };
        return reaction;
    }

    /**
     * Add reagent to reaction
     * @param {Reaction} reaction
     * @param {string} reagentKey
     */
    addReagent(reaction, reagentKey) {
        if (this.reagentLibrary[reagentKey]) {
            reaction.reagents.push(reagentKey);
        }
    }

    /**
     * Remove reagent from reaction
     * @param {Reaction} reaction
     * @param {string} reagentKey
     */
    removeReagent(reaction, reagentKey) {
        reaction.reagents = reaction.reagents.filter(r => r !== reagentKey);
    }

    /**
     * Get available reagents
     * @returns {Object}
     */
    getReagentLibrary() {
        return this.reagentLibrary;
    }

    /**
     * Suggest reactions based on reactant structure
     * @param {Molecule} molecule
     * @returns {Array<string>}
     */
    suggestReactions(molecule) {
        const suggestions = [];

        // Check for functional groups
        if (molecule.hasFunctionalGroup('hydroxyl')) {
            suggestions.push('oxidation', 'esterification', 'etherification');
        }
        if (molecule.hasFunctionalGroup('carbonyl')) {
            suggestions.push('reduction', 'oxidation', 'nucleophilic_addition');
        }
        if (molecule.hasFunctionalGroup('alkene')) {
            suggestions.push('addition', 'oxidation', 'polymerization', 'hydration');
        }
        if (molecule.hasFunctionalGroup('alkyne')) {
            suggestions.push('addition', 'reduction', 'hydration');
        }
        if (molecule.hasFunctionalGroup('ester')) {
            suggestions.push('hydrolysis', 'transesterification', 'reduction');
        }
        if (molecule.hasFunctionalGroup('amine')) {
            suggestions.push('acylation', 'alkylation', 'oxidation');
        }

        return [...new Set(suggestions)]; // Remove duplicates
    }

    /**
     * Clone molecule for reaction
     * @private
     */
    cloneMolecule(molecule) {
        // Return a proper Molecule instance if possible
        if (molecule && typeof molecule.clone === 'function') {
            return molecule.clone();
        }
        // Fallback: create new Molecule and copy data
        if (typeof Molecule !== 'undefined') {
            const cloned = new Molecule();
            if (molecule && molecule.atoms) {
                molecule.atoms.forEach(atom => {
                    cloned.addAtom(atom.element, atom.x || atom.position?.x || 0, atom.y || atom.position?.y || 0);
                });
            }
            if (molecule && molecule.bonds) {
                molecule.bonds.forEach(bond => {
                    cloned.addBond(bond.atom1, bond.atom2, bond.order || 1);
                });
            }
            return cloned;
        }
        // Last resort: return plain object
        return {
            atoms: molecule?.atoms?.map(a => ({ ...a })) || [],
            bonds: molecule?.bonds?.map(b => ({ ...b })) || []
        };
    }
}

// Reaction step for animation
class ReactionStep {
    constructor(name, description, products, mechanism) {
        this.name = name;
        this.description = description;
        this.products = products || [];
        this.mechanism = mechanism || null;
        this.electronFlow = [];
    }

    /**
     * Add electron flow arrow
     * @param {number} fromAtomId
     * @param {number} toAtomId
     * @param {string} type - 'single' or 'double'
     */
    addElectronFlow(fromAtomId, toAtomId, type = 'single') {
        this.electronFlow.push({
            from: fromAtomId,
            to: toAtomId,
            type: type
        });
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReactionManager, ReactionStep };
}
