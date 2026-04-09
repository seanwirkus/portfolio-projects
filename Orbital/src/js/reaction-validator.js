// Reaction Validator - Ensures all criteria are met before reactions proceed

class ReactionValidator {
    constructor() {
        this.validationRules = this.initializeValidationRules();
    }

    /**
     * Initialize validation rules for different reaction types
     */
    initializeValidationRules() {
        return {
            // Oxidation reactions - require oxidizing agent + appropriate functional group
            oxidation: {
                requiredReagents: ['KMnO4', 'CrO3', 'H2CrO4', 'PCC', 'H2O2', 'Na2Cr2O7'],
                requiredFunctionalGroups: ['alcohol', 'aldehyde', 'alkene'],
                incompatibleGroups: [],
                requiredConditions: [],
                optionalConditions: ['heat', 'H2O', 'acidic', 'basic'],
                minimumAtoms: 2,
                warnings: {
                    'tertiary_alcohol': 'Tertiary alcohols cannot be oxidized under normal conditions',
                    'no_alpha_hydrogen': 'No α-hydrogen for oxidation',
                    'overoxidation': 'Strong oxidizers may cause over-oxidation'
                }
            },

            // Reduction reactions - require reducing agent
            reduction: {
                requiredReagents: ['LiAlH4', 'NaBH4', 'H2', 'BH3', 'DIBAL-H'],
                requiredFunctionalGroups: ['carbonyl', 'carboxylic_acid', 'ester', 'alkene', 'alkyne'],
                incompatibleGroups: ['water_sensitive'], // LiAlH4 reacts with water
                requiredConditions: [],
                optionalConditions: ['Pd/C', 'Pt', 'Ni', 'dry_ether'],
                minimumAtoms: 2,
                warnings: {
                    'LiAlH4_water': 'LiAlH4 must be used in anhydrous conditions',
                    'catalyst_required': 'Catalytic hydrogenation requires metal catalyst (Pd, Pt, Ni)',
                    'selectivity': 'NaBH4 is selective for aldehydes/ketones; LiAlH4 reduces everything'
                }
            },

            // Halogenation - require halogen source
            halogenation: {
                requiredReagents: ['Br2', 'Cl2', 'I2', 'NBS', 'NCS'],
                requiredFunctionalGroups: ['alkene', 'alkyne', 'aromatic', 'alkane'],
                incompatibleGroups: [],
                requiredConditions: {
                    'alkane': ['hv', 'heat'], // Free radical requires light or heat
                    'aromatic': ['FeBr3', 'FeCl3', 'AlCl3'] // Electrophilic aromatic substitution requires Lewis acid
                },
                optionalConditions: ['CCl4', 'CH2Cl2', 'dark'],
                minimumAtoms: 1,
                warnings: {
                    'alkane_radical': 'Halogenation of alkanes requires UV light (hv) for radical initiation',
                    'regioselectivity': 'Radical halogenation is not regioselective',
                    'polyhalogenation': 'Multiple halogenations may occur'
                }
            },

            // Addition reactions - require electrophile or nucleophile
            addition: {
                requiredReagents: ['HBr', 'HCl', 'HI', 'H2SO4', 'H2O', 'Br2', 'Cl2'],
                requiredFunctionalGroups: ['alkene', 'alkyne'],
                incompatibleGroups: [],
                requiredConditions: {
                    'hydration': ['H2SO4', 'H2O'], // Acid-catalyzed hydration
                    'hydrohalogenation': [] // No special conditions
                },
                optionalConditions: ['heat', 'peroxide'],
                minimumAtoms: 2,
                warnings: {
                    'markovnikov': 'Addition follows Markovnikov rule (unless peroxide present)',
                    'carbocation_rearrangement': 'Watch for carbocation rearrangements',
                    'peroxide_effect': 'Peroxides cause anti-Markovnikov addition (radical pathway)'
                }
            },

            // Elimination reactions - require strong base or acid + heat
            elimination: {
                requiredReagents: ['NaOH', 'KOH', 't-BuOK', 'NaOEt', 'H2SO4'],
                requiredFunctionalGroups: ['haloalkane', 'alcohol'],
                incompatibleGroups: [],
                requiredConditions: {
                    'E2': ['strong_base'], // E2 requires strong base
                    'E1': ['heat'], // E1 requires heat (usually with acid)
                    'dehydration': ['H2SO4', 'heat'] // Alcohol dehydration
                },
                optionalConditions: ['ethanol', 'reflux'],
                minimumAtoms: 2,
                warnings: {
                    'zaitsev_rule': 'Major product follows Zaitsev rule (most substituted alkene)',
                    'E1_vs_E2': 'Strong bases favor E2; weak bases/heat favor E1',
                    'competition_SN': 'Elimination competes with substitution'
                }
            },

            // Substitution reactions - require nucleophile
            substitution: {
                requiredReagents: ['NaOH', 'KOH', 'NaCN', 'NH3', 'CH3OH', 'H2O'],
                requiredFunctionalGroups: ['haloalkane', 'alcohol'],
                incompatibleGroups: [],
                requiredConditions: {
                    'SN2': ['primary_carbon', 'strong_nucleophile'],
                    'SN1': ['tertiary_carbon', 'polar_protic_solvent']
                },
                optionalConditions: ['heat', 'DMSO', 'acetone'],
                minimumAtoms: 2,
                warnings: {
                    'SN1_vs_SN2': 'Primary carbons favor SN2; tertiary favor SN1',
                    'inversion': 'SN2 causes inversion of stereochemistry',
                    'racemization': 'SN1 causes racemization',
                    'competition_E': 'Substitution competes with elimination at elevated temperatures'
                }
            },

            // Condensation reactions - require aldehyde/ketone + nucleophile
            condensation: {
                requiredReagents: ['NaOH', 'LDA', 'NaOEt'],
                requiredFunctionalGroups: ['aldehyde', 'ketone'],
                incompatibleGroups: [],
                requiredConditions: ['base'],
                optionalConditions: ['heat', 'dehydration'],
                minimumAtoms: 4,
                warnings: {
                    'alpha_hydrogen': 'Requires α-hydrogen for enolate formation',
                    'crossed_aldol': 'Crossed aldol requires careful control to avoid self-condensation',
                    'dehydration': 'Product may dehydrate to α,β-unsaturated carbonyl'
                }
            }
        };
    }

    /**
     * Validate if reaction can proceed with given conditions
     * Returns: { valid: boolean, errors: [], warnings: [], suggestions: [] }
     */
    validateReaction(molecule, reagents, conditions, reactionType) {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            score: 0 // 0-100, how likely the reaction will work
        };

        // Check if molecule exists and has atoms
        if (!molecule || !molecule.atoms || molecule.atoms.length === 0) {
            result.valid = false;
            result.errors.push('⚠️ No molecule provided - draw a molecule first');
            return result;
        }

        // Check minimum atom count
        if (molecule.atoms.length < 2) {
            result.valid = false;
            result.errors.push('⚠️ Molecule too small - need at least 2 atoms for reaction');
            return result;
        }

        // Check if reagents provided
        if (!reagents || reagents.length === 0) {
            result.valid = false;
            result.errors.push('⚠️ No reagents selected - add at least one reagent');
            result.suggestions.push('💡 Try adding an oxidizing agent (KMnO4), reducing agent (LiAlH4), or halogen (Br2)');
            return result;
        }

        // Detect functional groups
        const functionalGroups = this.detectFunctionalGroups(molecule);
        console.log('📊 Functional groups detected:', functionalGroups);

        // Determine reaction type if not provided
        if (!reactionType) {
            reactionType = this.determineReactionType(reagents);
        }

        // Get validation rules for this reaction type
        const rules = this.validationRules[reactionType];
        if (!rules) {
            result.warnings.push(`⚠️ Unknown reaction type: ${reactionType}`);
            result.score = 50; // Uncertain
            return result;
        }

        // Validate reagents
        const hasRequiredReagent = rules.requiredReagents.some(r => reagents.includes(r));
        if (!hasRequiredReagent) {
            result.valid = false;
            result.errors.push(
                `❌ Missing required reagent for ${reactionType}. Need one of: ${rules.requiredReagents.join(', ')}`
            );
            result.suggestions.push(`💡 Add ${rules.requiredReagents[0]} to perform ${reactionType}`);
            return result;
        }

        // Validate functional groups
        const hasFunctionalGroup = this.checkFunctionalGroups(functionalGroups, rules.requiredFunctionalGroups);
        if (!hasFunctionalGroup) {
            result.valid = false;
            result.errors.push(
                `❌ Molecule lacks required functional group for ${reactionType}. Need: ${rules.requiredFunctionalGroups.join(' or ')}`
            );
            result.suggestions.push(`💡 This molecule cannot undergo ${reactionType} - try a different reaction type`);
            result.suggestions.push(`📚 Current molecule has: ${this.describeFunctionalGroups(functionalGroups)}`);
            return result;
        }

        // Validate conditions (for reactions that require specific conditions)
        if (rules.requiredConditions) {
            const conditionCheck = this.validateConditions(rules.requiredConditions, conditions, reactionType);
            if (!conditionCheck.valid) {
                result.valid = false;
                result.errors.push(...conditionCheck.errors);
                result.suggestions.push(...conditionCheck.suggestions);
                return result;
            }
            result.warnings.push(...conditionCheck.warnings);
        }

        // Check for incompatibilities
        const incompatibilityCheck = this.checkIncompatibilities(reagents, conditions, rules);
        if (!incompatibilityCheck.valid) {
            result.valid = false;
            result.errors.push(...incompatibilityCheck.errors);
            return result;
        }
        result.warnings.push(...incompatibilityCheck.warnings);

        // Add specific warnings based on reagent/substrate combination
        result.warnings.push(...this.getSpecificWarnings(molecule, reagents, conditions, reactionType, functionalGroups));

        // Calculate reaction score (probability of success)
        result.score = this.calculateReactionScore(molecule, reagents, conditions, reactionType, functionalGroups);

        // Add suggestions for optimization
        result.suggestions.push(...this.getSuggestions(molecule, reagents, conditions, reactionType, functionalGroups));

        return result;
    }

    /**
     * Detect functional groups in molecule
     */
    detectFunctionalGroups(molecule) {
        const groups = {
            alcohols: [],
            aldehydes: [],
            ketones: [],
            carbonyls: [], // aldehydes + ketones
            carboxylicAcids: [],
            esters: [],
            amines: [],
            amides: [],
            alkenes: [],
            alkynes: [],
            aromatics: [],
            haloalkanes: [],
            ethers: []
        };

        molecule.atoms.forEach(atom => {
            const bonds = molecule.bonds.filter(b => b.atom1 === atom.id || b.atom2 === atom.id);

            // Alcohols: C-OH (single bond)
            if (atom.element === 'O') {
                const singleBonds = bonds.filter(b => b.order === 1);
                if (singleBonds.length === 1) {
                    const connectedAtom = this.getConnectedAtom(molecule, atom.id, singleBonds[0]);
                    if (connectedAtom && connectedAtom.element === 'C') {
                        groups.alcohols.push(atom.id);
                    }
                }
            }

            // Carbonyls: C=O (double bond)
            if (atom.element === 'C') {
                const doubleBondToO = bonds.find(b => {
                    const other = this.getConnectedAtom(molecule, atom.id, b);
                    return b.order === 2 && other && other.element === 'O';
                });

                if (doubleBondToO) {
                    groups.carbonyls.push(atom.id);

                    // Distinguish aldehydes from ketones
                    const carbonBonds = bonds.filter(b => b.order === 1);
                    const connectedCarbons = carbonBonds.filter(b => {
                        const other = this.getConnectedAtom(molecule, atom.id, b);
                        return other && other.element === 'C';
                    }).length;

                    if (connectedCarbons === 1 || carbonBonds.length === 1) {
                        groups.aldehydes.push(atom.id);
                    } else {
                        groups.ketones.push(atom.id);
                    }

                    // Check for carboxylic acid: C(=O)-OH
                    const hasOH = bonds.some(b => {
                        const other = this.getConnectedAtom(molecule, atom.id, b);
                        if (!other || other.element !== 'O' || b.order !== 1) return false;
                        const otherBonds = molecule.bonds.filter(ob => 
                            ob.atom1 === other.id || ob.atom2 === other.id
                        );
                        return otherBonds.length === 1; // O connected only to this C
                    });
                    if (hasOH) {
                        groups.carboxylicAcids.push(atom.id);
                    }
                }
            }

            // Alkenes: C=C
            if (atom.element === 'C') {
                const doubleBondToC = bonds.find(b => {
                    const other = this.getConnectedAtom(molecule, atom.id, b);
                    return b.order === 2 && other && other.element === 'C';
                });
                if (doubleBondToC) {
                    groups.alkenes.push(atom.id);
                }
            }

            // Alkynes: C≡C
            if (atom.element === 'C') {
                const tripleBond = bonds.find(b => {
                    const other = this.getConnectedAtom(molecule, atom.id, b);
                    return b.order === 3 && other && other.element === 'C';
                });
                if (tripleBond) {
                    groups.alkynes.push(atom.id);
                }
            }

            // Haloalkanes: C-X (X = F, Cl, Br, I)
            if (atom.element === 'C') {
                const halogens = ['F', 'Cl', 'Br', 'I'];
                const hasHalogen = bonds.some(b => {
                    const other = this.getConnectedAtom(molecule, atom.id, b);
                    return other && halogens.includes(other.element);
                });
                if (hasHalogen) {
                    groups.haloalkanes.push(atom.id);
                }
            }

            // Amines: C-NH2, C-NHR, C-NR2
            if (atom.element === 'N') {
                const connectedToC = bonds.some(b => {
                    const other = this.getConnectedAtom(molecule, atom.id, b);
                    return other && other.element === 'C';
                });
                if (connectedToC) {
                    groups.amines.push(atom.id);
                }
            }
        });

        return groups;
    }

    /**
     * Helper to get connected atom from bond
     */
    getConnectedAtom(molecule, atomId, bond) {
        const otherId = bond.atom1 === atomId ? bond.atom2 : bond.atom1;
        return molecule.atoms.find(a => a.id === otherId);
    }

    /**
     * Check if molecule has required functional groups
     */
    checkFunctionalGroups(detected, required) {
        return required.some(group => {
            if (group === 'alcohol') return detected.alcohols.length > 0;
            if (group === 'carbonyl') return detected.carbonyls.length > 0;
            if (group === 'aldehyde') return detected.aldehydes.length > 0;
            if (group === 'ketone') return detected.ketones.length > 0;
            if (group === 'carboxylic_acid') return detected.carboxylicAcids.length > 0;
            if (group === 'alkene') return detected.alkenes.length > 0;
            if (group === 'alkyne') return detected.alkynes.length > 0;
            if (group === 'haloalkane') return detected.haloalkanes.length > 0;
            if (group === 'amine') return detected.amines.length > 0;
            return false;
        });
    }

    /**
     * Describe functional groups in human-readable format
     */
    describeFunctionalGroups(groups) {
        const parts = [];
        if (groups.alcohols.length > 0) parts.push(`${groups.alcohols.length} alcohol(s)`);
        if (groups.aldehydes.length > 0) parts.push(`${groups.aldehydes.length} aldehyde(s)`);
        if (groups.ketones.length > 0) parts.push(`${groups.ketones.length} ketone(s)`);
        if (groups.carboxylicAcids.length > 0) parts.push(`${groups.carboxylicAcids.length} carboxylic acid(s)`);
        if (groups.alkenes.length > 0) parts.push(`${groups.alkenes.length} alkene(s)`);
        if (groups.alkynes.length > 0) parts.push(`${groups.alkynes.length} alkyne(s)`);
        if (groups.haloalkanes.length > 0) parts.push(`${groups.haloalkanes.length} haloalkane(s)`);
        if (groups.amines.length > 0) parts.push(`${groups.amines.length} amine(s)`);
        return parts.length > 0 ? parts.join(', ') : 'no reactive functional groups';
    }

    /**
     * Validate reaction conditions
     */
    validateConditions(requiredConditions, providedConditions, reactionType) {
        const result = { valid: true, errors: [], warnings: [], suggestions: [] };

        if (typeof requiredConditions === 'object' && !Array.isArray(requiredConditions)) {
            // Conditional requirements based on substrate
            return result; // Will be checked in detail later
        }

        if (Array.isArray(requiredConditions) && requiredConditions.length > 0) {
            const hasRequired = requiredConditions.every(cond => providedConditions.includes(cond));
            if (!hasRequired) {
                result.valid = false;
                result.errors.push(`❌ Missing required conditions: ${requiredConditions.join(', ')}`);
                result.suggestions.push(`💡 Add conditions: ${requiredConditions.join(', ')}`);
            }
        }

        return result;
    }

    /**
     * Check for incompatible reagent/condition combinations
     */
    checkIncompatibilities(reagents, conditions, rules) {
        const result = { valid: true, errors: [], warnings: [] };

        // LiAlH4 + water = violent reaction
        if (reagents.includes('LiAlH4') && (conditions.includes('H2O') || conditions.includes('water'))) {
            result.valid = false;
            result.errors.push('❌ DANGER: LiAlH4 reacts violently with water! Use anhydrous conditions.');
            return result;
        }

        // Strong oxidizers + flammable solvents
        if ((reagents.includes('KMnO4') || reagents.includes('CrO3')) && 
            (conditions.includes('ether') || conditions.includes('acetone'))) {
            result.warnings.push('⚠️ Strong oxidizers with flammable solvents - use caution');
        }

        // Alkane halogenation without light/heat
        if ((reagents.includes('Br2') || reagents.includes('Cl2')) && 
            !conditions.includes('hv') && !conditions.includes('heat') && !conditions.includes('light')) {
            result.warnings.push('⚠️ Halogenation of alkanes requires UV light (hv) or heat');
        }

        return result;
    }

    /**
     * Get specific warnings based on substrate/reagent combination
     */
    getSpecificWarnings(molecule, reagents, conditions, reactionType, functionalGroups) {
        const warnings = [];

        // Tertiary alcohol + oxidation
        if (reactionType === 'oxidation' && functionalGroups.alcohols.length > 0) {
            warnings.push('⚠️ Tertiary alcohols resist oxidation; only primary/secondary alcohols react');
        }

        // E1 vs E2 mechanism
        if (reactionType === 'elimination' && functionalGroups.haloalkanes.length > 0) {
            if (reagents.some(r => ['NaOH', 'KOH', 't-BuOK'].includes(r))) {
                warnings.push('💡 Strong base favors E2 elimination (concerted mechanism)');
            } else if (conditions.includes('heat')) {
                warnings.push('💡 Heat + weak base favors E1 elimination (carbocation intermediate)');
            }
        }

        // Markovnikov vs Anti-Markovnikov
        if (reactionType === 'addition' && functionalGroups.alkenes.length > 0) {
            if (conditions.includes('peroxide') || reagents.includes('peroxide')) {
                warnings.push('💡 Peroxide present: Anti-Markovnikov addition (radical pathway)');
            } else {
                warnings.push('💡 Markovnikov addition: hydrogen adds to less substituted carbon');
            }
        }

        // Over-oxidation risk
        if ((reagents.includes('KMnO4') || reagents.includes('CrO3')) && functionalGroups.aldehydes.length > 0) {
            warnings.push('⚠️ Strong oxidizers may over-oxidize aldehydes to carboxylic acids');
        }

        return warnings;
    }

    /**
     * Calculate reaction success score (0-100)
     */
    calculateReactionScore(molecule, reagents, conditions, reactionType, functionalGroups) {
        let score = 70; // Base score

        // Good functional group match
        const hasGoodMatch = this.checkFunctionalGroups(functionalGroups, 
            this.validationRules[reactionType]?.requiredFunctionalGroups || []);
        if (hasGoodMatch) score += 15;

        // Appropriate conditions
        if (reactionType === 'elimination' && conditions.includes('heat')) score += 10;
        if (reactionType === 'reduction' && reagents.includes('LiAlH4') && !conditions.includes('H2O')) score += 10;
        if (reactionType === 'halogenation' && conditions.includes('hv')) score += 5;

        // Penalty for incompatibilities
        if (reagents.includes('LiAlH4') && conditions.includes('H2O')) score = 0;

        // Bonus for common, reliable reactions
        if (reactionType === 'reduction' && reagents.includes('NaBH4')) score += 5; // Mild, selective
        if (reactionType === 'oxidation' && reagents.includes('PCC')) score += 5; // Mild, stops at aldehyde

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get suggestions for improving reaction
     */
    getSuggestions(molecule, reagents, conditions, reactionType, functionalGroups) {
        const suggestions = [];

        // Suggest better reagents
        if (reactionType === 'oxidation' && functionalGroups.aldehydes.length > 0) {
            if (reagents.includes('KMnO4')) {
                suggestions.push('💡 Consider PCC instead of KMnO4 to stop at aldehyde (avoid over-oxidation)');
            }
        }

        if (reactionType === 'reduction') {
            if (reagents.includes('LiAlH4') && functionalGroups.ketones.length > 0 && functionalGroups.carboxylicAcids.length === 0) {
                suggestions.push('💡 NaBH4 is milder and safer for simple ketone reduction');
            }
        }

        // Suggest conditions
        if (reactionType === 'elimination' && !conditions.includes('heat')) {
            suggestions.push('💡 Add heat to improve elimination reaction rate');
        }

        if (reactionType === 'addition' && functionalGroups.alkenes.length > 0 && 
            reagents.includes('H2SO4') && !conditions.includes('H2O')) {
            suggestions.push('💡 Add H2O for acid-catalyzed hydration of alkene');
        }

        return suggestions;
    }

    /**
     * Determine reaction type from reagents
     */
    determineReactionType(reagents) {
        const oxidizers = ['KMnO4', 'CrO3', 'H2CrO4', 'PCC', 'H2O2', 'Na2Cr2O7'];
        const reducers = ['LiAlH4', 'NaBH4', 'H2', 'BH3', 'DIBAL-H'];
        const halogens = ['Br2', 'Cl2', 'I2', 'NBS', 'NCS'];
        const bases = ['NaOH', 'KOH', 't-BuOK', 'NaOEt', 'LDA'];
        const acids = ['H2SO4', 'HCl', 'HBr'];

        if (reagents.some(r => oxidizers.includes(r))) return 'oxidation';
        if (reagents.some(r => reducers.includes(r))) return 'reduction';
        if (reagents.some(r => halogens.includes(r))) return 'halogenation';
        if (reagents.some(r => bases.includes(r))) return 'elimination';
        if (reagents.some(r => acids.includes(r))) return 'addition';

        return 'unknown';
    }
}
