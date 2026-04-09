// Comprehensive Organic Reaction Database
// Each reaction includes mechanism steps, electron flow, intermediates, and visual data

const REACTION_DATABASE = {
    // ==================== ELIMINATION REACTIONS ====================
    'e2_elimination': {
        name: 'E2 Elimination',
        type: 'elimination',
        reagents: ['t-BuOK', 'NaOEt', 'KOH'],
        conditions: 'Heat (Δ)',
        
        // Pattern matching for reactant recognition
        recognitionPattern: {
            substrate: 'alkyl_halide',
            requirement: 'beta_hydrogen'
        },
        
        // Mechanism steps
        mechanism: [
            {
                step: 1,
                title: 'Concerted E2 Elimination',
                description: 'Base abstracts β-hydrogen while C-X bond breaks, forming π bond',
                electronFlow: [
                    { from: 'base', to: 'beta_H', type: 'deprotonation' },
                    { from: 'C-H_bond', to: 'C-C_pi', type: 'bond_formation' },
                    { from: 'C-X_bond', to: 'leaving_group', type: 'bond_cleavage' }
                ],
                intermediates: null, // Concerted, no intermediate
                energyLevel: 'transition_state'
            }
        ],
        
        // Product prediction rules
        productRules: {
            majorProduct: 'zaitsev', // More substituted alkene
            stereochemistry: 'anti_periplanar'
        }
    },
    
    'e1_elimination': {
        name: 'E1 Elimination',
        type: 'elimination',
        reagents: ['H2SO4', 'H3PO4'],
        conditions: 'Heat (Δ)',
        
        mechanism: [
            {
                step: 1,
                title: 'Carbocation Formation',
                description: 'Leaving group departs, forming carbocation',
                electronFlow: [
                    { from: 'C-X_bond', to: 'leaving_group', type: 'heterolytic_cleavage' }
                ],
                intermediates: { type: 'carbocation', stability: 'tertiary > secondary > primary' },
                energyLevel: 'high_energy'
            },
            {
                step: 2,
                title: 'Deprotonation',
                description: 'Base removes β-hydrogen, forming π bond',
                electronFlow: [
                    { from: 'base', to: 'beta_H', type: 'deprotonation' },
                    { from: 'C-H_bond', to: 'C-C_pi', type: 'pi_bond_formation' }
                ],
                intermediates: null,
                energyLevel: 'product'
            }
        ],
        
        productRules: {
            majorProduct: 'zaitsev',
            sideReaction: 'sn1_substitution_possible'
        }
    },
    
    // ==================== SUBSTITUTION REACTIONS ====================
    'sn2_substitution': {
        name: 'SN2 Nucleophilic Substitution',
        type: 'substitution',
        reagents: ['NaCN', 'NaN3', 'NaOH'],
        conditions: 'Polar aprotic solvent (DMSO, DMF)',
        
        recognitionPattern: {
            substrate: 'primary_or_secondary_alkyl_halide',
            stericHindrance: 'low'
        },
        
        mechanism: [
            {
                step: 1,
                title: 'Backside Attack',
                description: 'Nucleophile attacks from opposite side of leaving group',
                electronFlow: [
                    { from: 'nucleophile', to: 'carbon', type: 'nucleophilic_attack' },
                    { from: 'C-X_bond', to: 'leaving_group', type: 'bond_cleavage' }
                ],
                intermediates: { type: 'transition_state', geometry: 'trigonal_bipyramidal' },
                energyLevel: 'transition_state',
                stereochemistry: 'inversion_of_configuration'
            }
        ],
        
        productRules: {
            stereochemistry: 'walden_inversion',
            rateDependent: 'both_nucleophile_and_substrate'
        }
    },
    
    'sn1_substitution': {
        name: 'SN1 Nucleophilic Substitution',
        type: 'substitution',
        reagents: ['H2O', 'ROH'],
        conditions: 'Polar protic solvent',
        
        mechanism: [
            {
                step: 1,
                title: 'Ionization',
                description: 'Leaving group departs, forming carbocation',
                electronFlow: [
                    { from: 'C-X_bond', to: 'leaving_group', type: 'heterolytic_cleavage' }
                ],
                intermediates: { type: 'carbocation', planar: true },
                energyLevel: 'high_energy'
            },
            {
                step: 2,
                title: 'Nucleophilic Attack',
                description: 'Nucleophile attacks planar carbocation from either face',
                electronFlow: [
                    { from: 'nucleophile', to: 'carbocation', type: 'nucleophilic_attack' }
                ],
                intermediates: null,
                energyLevel: 'product',
                stereochemistry: 'racemization'
            }
        ],
        
        productRules: {
            stereochemistry: 'racemic_mixture',
            rearrangement: 'possible_carbocation_rearrangement'
        }
    },
    
    // ==================== ADDITION REACTIONS ====================
    'electrophilic_addition': {
        name: 'Electrophilic Addition to Alkenes',
        type: 'addition',
        reagents: ['HBr', 'HCl', 'Br2', 'Cl2'],
        conditions: 'Room temperature',
        
        mechanism: [
            {
                step: 1,
                title: 'π Bond Attacks Electrophile',
                description: 'Alkene π electrons attack H-X or X₂, forming carbocation',
                electronFlow: [
                    { from: 'pi_bond', to: 'electrophile', type: 'electrophilic_attack' },
                    { from: 'E-X_bond', to: 'X', type: 'heterolytic_cleavage' }
                ],
                intermediates: { type: 'carbocation_or_bromonium', stability: 'more_substituted' },
                energyLevel: 'intermediate'
            },
            {
                step: 2,
                title: 'Nucleophile Attacks Carbocation',
                description: 'Halide ion attacks carbocation',
                electronFlow: [
                    { from: 'nucleophile', to: 'carbocation', type: 'nucleophilic_attack' }
                ],
                intermediates: null,
                energyLevel: 'product'
            }
        ],
        
        productRules: {
            regioselectivity: 'markovnikov',
            exception: 'anti_markovnikov_with_peroxides'
        }
    },
    
    // ==================== OXIDATION REACTIONS ====================
    'alcohol_oxidation_primary': {
        name: 'Oxidation of Primary Alcohol',
        type: 'oxidation',
        reagents: ['K2Cr2O7', 'KMnO4'],
        conditions: 'H⁺, Heat (Δ)',
        
        mechanism: [
            {
                step: 1,
                title: 'Aldehyde Formation',
                description: 'Alcohol oxidized to aldehyde',
                electronFlow: [
                    { from: 'C-H_bond', to: 'oxidant', type: 'hydride_transfer' },
                    { from: 'C-O_single', to: 'C-O_double', type: 'bond_order_increase' }
                ],
                intermediates: { type: 'aldehyde', reactivity: 'high' },
                energyLevel: 'intermediate'
            },
            {
                step: 2,
                title: 'Carboxylic Acid Formation',
                description: 'Aldehyde further oxidized to carboxylic acid',
                electronFlow: [
                    { from: 'C-H_bond', to: 'oxidant', type: 'hydride_transfer' }
                ],
                intermediates: null,
                energyLevel: 'product'
            }
        ],
        
        productRules: {
            finalProduct: 'carboxylic_acid',
            mildOxidant: 'PCC_stops_at_aldehyde'
        }
    },
    
    'alcohol_oxidation_secondary': {
        name: 'Oxidation of Secondary Alcohol',
        type: 'oxidation',
        reagents: ['K2Cr2O7', 'PCC', 'KMnO4'],
        conditions: 'H⁺',
        
        mechanism: [
            {
                step: 1,
                title: 'Ketone Formation',
                description: 'Secondary alcohol oxidized to ketone',
                electronFlow: [
                    { from: 'C-H_bond', to: 'oxidant', type: 'hydride_transfer' },
                    { from: 'C-O_single', to: 'C-O_double', type: 'bond_order_increase' }
                ],
                intermediates: null,
                energyLevel: 'product'
            }
        ],
        
        productRules: {
            finalProduct: 'ketone',
            noFurtherOxidation: true
        }
    },
    
    // ==================== REDUCTION REACTIONS ====================
    'carbonyl_reduction': {
        name: 'Carbonyl Reduction',
        type: 'reduction',
        reagents: ['NaBH4', 'LiAlH4'],
        conditions: 'Methanol or ether',
        
        mechanism: [
            {
                step: 1,
                title: 'Hydride Attack',
                description: 'Hydride attacks electrophilic carbonyl carbon',
                electronFlow: [
                    { from: 'hydride', to: 'carbonyl_carbon', type: 'nucleophilic_attack' },
                    { from: 'C=O_pi', to: 'oxygen', type: 'pi_bond_breaks' }
                ],
                intermediates: { type: 'alkoxide', charge: 'negative_on_oxygen' },
                energyLevel: 'intermediate'
            },
            {
                step: 2,
                title: 'Protonation',
                description: 'Alkoxide protonated to form alcohol',
                electronFlow: [
                    { from: 'alkoxide', to: 'proton', type: 'protonation' }
                ],
                intermediates: null,
                energyLevel: 'product'
            }
        ],
        
        productRules: {
            aldehyde: 'primary_alcohol',
            ketone: 'secondary_alcohol'
        }
    },
    
    // ==================== ALDOL REACTIONS ====================
    'aldol_condensation': {
        name: 'Aldol Condensation',
        type: 'condensation',
        reagents: ['NaOH', 'KOH'],
        conditions: 'Base, Heat (Δ)',
        
        mechanism: [
            {
                step: 1,
                title: 'Enolate Formation',
                description: 'Base deprotonates α-carbon, forming enolate',
                electronFlow: [
                    { from: 'base', to: 'alpha_H', type: 'deprotonation' },
                    { from: 'C-H_bond', to: 'C=O_pi', type: 'resonance_delocalization' }
                ],
                intermediates: { type: 'enolate', resonance: 'C- and O-' },
                energyLevel: 'intermediate'
            },
            {
                step: 2,
                title: 'Nucleophilic Addition',
                description: 'Enolate attacks another carbonyl',
                electronFlow: [
                    { from: 'enolate_carbon', to: 'carbonyl_carbon', type: 'nucleophilic_attack' },
                    { from: 'C=O_pi', to: 'oxygen', type: 'pi_bond_breaks' }
                ],
                intermediates: { type: 'beta_hydroxy_carbonyl', name: 'aldol' },
                energyLevel: 'intermediate'
            },
            {
                step: 3,
                title: 'Dehydration',
                description: 'E1cB elimination forms α,β-unsaturated carbonyl',
                electronFlow: [
                    { from: 'base', to: 'alpha_H', type: 'deprotonation' },
                    { from: 'C-OH_bond', to: 'leaving_group', type: 'beta_elimination' }
                ],
                intermediates: null,
                energyLevel: 'product'
            }
        ],
        
        productRules: {
            product: 'alpha_beta_unsaturated_carbonyl',
            conjugation: 'extended_conjugation'
        }
    },
    
    // ==================== GROB FRAGMENTATION ====================
    'grob_fragmentation': {
        name: 'Grob Fragmentation',
        type: 'fragmentation',
        reagents: ['KOH', 't-BuOK'],
        conditions: 'Strong base, Heat (Δ)',
        
        mechanism: [
            {
                step: 1,
                title: 'Deprotonation',
                description: 'Base removes hydroxyl proton, forming alkoxide',
                electronFlow: [
                    { from: 'base', to: 'OH_proton', type: 'deprotonation' }
                ],
                intermediates: { type: 'alkoxide', position: 'bridgehead' },
                energyLevel: 'intermediate'
            },
            {
                step: 2,
                title: 'Concerted Fragmentation',
                description: 'Alkoxide pushes electrons, breaking C-C bond and forming carbonyl',
                electronFlow: [
                    { from: 'alkoxide', to: 'C-C_bond', type: 'electron_push' },
                    { from: 'C-C_bond', to: 'leaving_carbon', type: 'bond_cleavage' },
                    { from: 'leaving_carbon', to: 'carbonyl', type: 'pi_bond_formation' }
                ],
                intermediates: { type: 'ring_opened', carbocation: false },
                energyLevel: 'intermediate',
                drivingForce: 'ring_strain_relief'
            },
            {
                step: 3,
                title: 'Intramolecular Aldol',
                description: 'Carbanion attacks intramolecular carbonyl',
                electronFlow: [
                    { from: 'carbanion', to: 'carbonyl', type: 'aldol_attack' }
                ],
                intermediates: null,
                energyLevel: 'product'
            }
        ],
        
        productRules: {
            ringContraction: true,
            product: 'smaller_ring_with_carbonyl'
        }
    },
    
    // ==================== ADDITION-ELIMINATION (ACYL SUBSTITUTION) ====================
    'ester_hydrolysis_base': {
        name: 'Ester Hydrolysis (Saponification)',
        type: 'acyl_substitution',
        reagents: ['NaOH', 'KOH'],
        conditions: 'Aqueous base, Heat (Δ)',
        
        mechanism: [
            {
                step: 1,
                title: 'Nucleophilic Addition',
                description: 'Hydroxide attacks carbonyl carbon',
                electronFlow: [
                    { from: 'OH-', to: 'carbonyl_carbon', type: 'nucleophilic_attack' },
                    { from: 'C=O_pi', to: 'oxygen', type: 'pi_bond_breaks' }
                ],
                intermediates: { type: 'tetrahedral_intermediate', geometry: 'sp3' },
                energyLevel: 'intermediate'
            },
            {
                step: 2,
                title: 'Elimination',
                description: 'Alkoxide leaving group departs, reforming C=O',
                electronFlow: [
                    { from: 'O-', to: 'C=O_pi', type: 'pi_bond_reforms' },
                    { from: 'C-OR_bond', to: 'OR-', type: 'bond_cleavage' }
                ],
                intermediates: null,
                energyLevel: 'product'
            },
            {
                step: 3,
                title: 'Acid-Base Reaction',
                description: 'Carboxylic acid deprotonated (irreversible)',
                electronFlow: [
                    { from: 'base', to: 'COOH', type: 'acid_base' }
                ],
                intermediates: null,
                energyLevel: 'final_product'
            }
        ],
        
        productRules: {
            products: ['carboxylate_salt', 'alcohol'],
            irreversibility: 'deprotonation_drives_forward'
        }
    }
};

// Functional group detection patterns
const FUNCTIONAL_GROUPS = {
    alkyl_halide: {
        pattern: ['C-X'], // X = Cl, Br, I
        properties: { reactivity: 'I > Br > Cl > F' }
    },
    alcohol: {
        pattern: ['C-OH'],
        classification: ['primary', 'secondary', 'tertiary']
    },
    alkene: {
        pattern: ['C=C'],
        properties: { nucleophilic: true }
    },
    alkyne: {
        pattern: ['C≡C'],
        properties: { acidic: 'terminal_H' }
    },
    carbonyl: {
        pattern: ['C=O'],
        subtypes: ['aldehyde', 'ketone', 'ester', 'amide', 'acid']
    },
    ester: {
        pattern: ['C(=O)-O-C'],
        reactivity: 'nucleophilic_acyl_substitution'
    },
    amine: {
        pattern: ['C-NH2', 'C-NH-C', 'C-N(C)C'],
        classification: ['primary', 'secondary', 'tertiary']
    }
};

// Reaction condition effects
const CONDITION_EFFECTS = {
    heat: {
        symbol: 'Δ',
        effect: 'Increases kinetic energy, favors elimination over substitution',
        temp_range: '60-100°C typical'
    },
    cold: {
        symbol: '0°C or -78°C',
        effect: 'Slows side reactions, increases selectivity',
        common_use: 'Ozonolysis, organometallic reactions'
    },
    light: {
        symbol: 'hν',
        effect: 'Homolytic cleavage, initiates radical reactions',
        common_use: 'Halogenation, photochemical reactions'
    },
    pressure: {
        symbol: 'High P',
        effect: 'Favors reactions with volume decrease',
        common_use: 'Hydrogenation'
    }
};

// ==================== ORGANIC CHEMISTRY II MECHANISMS ====================

// Diels-Alder Reaction
REACTION_DATABASE.diels_alder = {
    name: 'Diels-Alder Cycloaddition',
    type: 'cycloaddition',
    reagents: ['dienophile'],
    conditions: 'Heat or Lewis acid catalyst',
    
    mechanism: [
        {
            step: 1,
            title: 'Concerted [4+2] Cycloaddition',
            description: 'Conjugated diene reacts with dienophile in single concerted step',
            electronFlow: [
                { from: 'diene_C1', to: 'dienophile_C1', type: 'nucleophilic' },
                { from: 'diene_C4', to: 'dienophile_C2', type: 'nucleophilic' },
                { from: 'dienophile_pi', to: 'new_sigma_bonds', type: 'bond_formation' }
            ],
            intermediates: { type: 'pericyclic_TS', geometry: 'boat_like' },
            energyLevel: 'transition_state'
        }
    ],
    
    productRules: {
        stereochemistry: 'suprafacial',
        endo_preference: 'endo_product_favored',
        majorProduct: 'endo_adduct'
    }
};

// Claisen Condensation
REACTION_DATABASE.claisen_condensation = {
    name: 'Claisen Condensation',
    type: 'condensation',
    reagents: ['NaOEt', 'LDA'],
    conditions: 'Ethanol solvent',
    
    mechanism: [
        {
            step: 1,
            title: 'Enolate Formation',
            description: 'Base deprotonates α-carbon of ester',
            electronFlow: [
                { from: 'base', to: 'alpha_H', type: 'deprotonation' },
                { from: 'C-H', to: 'C=O_resonance', type: 'resonance' }
            ],
            intermediates: { type: 'enolate', resonance: 'stabilized_by_carbonyl' },
            energyLevel: 'intermediate'
        },
        {
            step: 2,
            title: 'Nucleophilic Acyl Substitution',
            description: 'Enolate attacks carbonyl of second ester molecule',
            electronFlow: [
                { from: 'enolate', to: 'carbonyl_C', type: 'nucleophilic' },
                { from: 'C=O_pi', to: 'oxygen', type: 'bond_formation' }
            ],
            intermediates: { type: 'tetrahedral_intermediate' },
            energyLevel: 'high_energy'
        },
        {
            step: 3,
            title: 'Elimination of Alkoxide',
            description: 'Alkoxide leaving group departs, reforming C=O',
            electronFlow: [
                { from: 'O_lone_pair', to: 'C=O', type: 'bond_formation' },
                { from: 'C-OR', to: 'leaving_group', type: 'bond_cleavage' }
            ],
            intermediates: null,
            energyLevel: 'product'
        }
    ],
    
    productRules: {
        majorProduct: 'beta_ketoester'
    }
};

// Wittig Reaction
REACTION_DATABASE.wittig_reaction = {
    name: 'Wittig Reaction',
    type: 'olefination',
    reagents: ['Ph3P=CHR'],
    conditions: 'Room temperature',
    
    mechanism: [
        {
            step: 1,
            title: 'Nucleophilic Addition',
            description: 'Ylide carbon attacks carbonyl carbon',
            electronFlow: [
                { from: 'ylide_C', to: 'carbonyl_C', type: 'nucleophilic' },
                { from: 'C=O_pi', to: 'oxygen', type: 'bond_cleavage' }
            ],
            intermediates: { type: 'betaine', charge: 'zwitterionic' },
            energyLevel: 'intermediate'
        },
        {
            step: 2,
            title: 'Oxaphosphetane Formation',
            description: 'Cyclization to four-membered ring',
            electronFlow: [
                { from: 'O_negative', to: 'P_positive', type: 'bond_formation' }
            ],
            intermediates: { type: 'oxaphosphetane', ring_size: 4 },
            energyLevel: 'intermediate'
        },
        {
            step: 3,
            title: 'Ring Opening',
            description: 'Oxaphosphetane decomposes to alkene and phosphine oxide',
            electronFlow: [
                { from: 'P-O', to: 'P=O', type: 'bond_formation' },
                { from: 'C-C_sigma', to: 'C=C_pi', type: 'elimination' }
            ],
            intermediates: null,
            energyLevel: 'product'
        }
    ],
    
    productRules: {
        majorProduct: 'alkene',
        stereochemistry: 'generally_Z_selective_with_non_stabilized_ylides'
    }
};

// Grignard Reaction
REACTION_DATABASE.grignard_reaction = {
    name: 'Grignard Addition to Carbonyl',
    type: 'addition',
    reagents: ['RMgX'],
    conditions: 'Dry ether solvent, anhydrous',
    
    mechanism: [
        {
            step: 1,
            title: 'Nucleophilic Addition',
            description: 'Grignard reagent attacks carbonyl carbon',
            electronFlow: [
                { from: 'R_Mg', to: 'carbonyl_C', type: 'nucleophilic' },
                { from: 'C=O_pi', to: 'oxygen', type: 'bond_cleavage' }
            ],
            intermediates: { type: 'alkoxide_magnesium_complex' },
            energyLevel: 'intermediate'
        },
        {
            step: 2,
            title: 'Aqueous Workup',
            description: 'Protonation of alkoxide to form alcohol',
            electronFlow: [
                { from: 'H3O+', to: 'O_negative', type: 'protonation' }
            ],
            intermediates: null,
            energyLevel: 'product'
        }
    ],
    
    productRules: {
        majorProduct: 'alcohol',
        with_formaldehyde: 'primary_alcohol',
        with_aldehyde: 'secondary_alcohol',
        with_ketone: 'tertiary_alcohol',
        with_ester: 'tertiary_alcohol_two_R_groups'
    }
};

// Michael Addition
REACTION_DATABASE.michael_addition = {
    name: 'Michael Addition (Conjugate Addition)',
    type: 'conjugate_addition',
    reagents: ['Enolate', 'Organocuprate'],
    conditions: 'Catalytic base',
    
    mechanism: [
        {
            step: 1,
            title: '1,4-Nucleophilic Addition',
            description: 'Nucleophile attacks β-carbon of α,β-unsaturated carbonyl',
            electronFlow: [
                { from: 'nucleophile', to: 'beta_carbon', type: 'nucleophilic' },
                { from: 'C=C_pi', to: 'alpha_carbon', type: 'bond_cleavage' },
                { from: 'alpha_carbon', to: 'carbonyl_O', type: 'resonance' }
            ],
            intermediates: { type: 'enolate', resonance: 'delocalized' },
            energyLevel: 'intermediate'
        },
        {
            step: 2,
            title: 'Protonation',
            description: 'Enolate intermediate is protonated',
            electronFlow: [
                { from: 'H3O+', to: 'enolate_O', type: 'protonation' },
                { from: 'C=O', to: 'C-OH', type: 'bond_formation' }
            ],
            intermediates: null,
            energyLevel: 'product'
        }
    ],
    
    productRules: {
        majorProduct: '1,4-addition_product',
        regioselectivity: 'conjugate_over_direct'
    }
};

// Robinson Annulation
REACTION_DATABASE.robinson_annulation = {
    name: 'Robinson Annulation',
    type: 'annulation',
    reagents: ['NaOEt', 'KOH'],
    conditions: 'Heat',
    
    mechanism: [
        {
            step: 1,
            title: 'Michael Addition',
            description: 'Enolate performs 1,4-addition to α,β-unsaturated ketone',
            electronFlow: [
                { from: 'enolate', to: 'beta_carbon', type: 'nucleophilic' },
                { from: 'C=C_pi', to: 'carbonyl_O', type: 'resonance' }
            ],
            intermediates: { type: 'michael_adduct' },
            energyLevel: 'intermediate'
        },
        {
            step: 2,
            title: 'Intramolecular Aldol',
            description: 'Intramolecular aldol condensation forms ring',
            electronFlow: [
                { from: 'enolate', to: 'carbonyl_C', type: 'nucleophilic' }
            ],
            intermediates: { type: 'aldol_product' },
            energyLevel: 'intermediate'
        },
        {
            step: 3,
            title: 'Dehydration',
            description: 'Loss of water to form α,β-unsaturated ketone',
            electronFlow: [
                { from: 'base', to: 'alpha_H', type: 'deprotonation' },
                { from: 'C-OH', to: 'leaving_group', type: 'elimination' },
                { from: 'C-H', to: 'C=C', type: 'bond_formation' }
            ],
            intermediates: null,
            energyLevel: 'product'
        }
    ],
    
    productRules: {
        majorProduct: 'cyclohexenone',
        ring_size: 6
    }
};

// Hofmann Elimination
REACTION_DATABASE.hofmann_elimination = {
    name: 'Hofmann Elimination',
    type: 'elimination',
    reagents: ['Ag2O', 'H2O', 'heat'],
    conditions: 'Excess CH3I then heat',
    
    mechanism: [
        {
            step: 1,
            title: 'Quaternary Ammonium Formation',
            description: 'Exhaustive methylation of amine',
            electronFlow: [
                { from: 'amine', to: 'CH3I', type: 'nucleophilic' }
            ],
            intermediates: { type: 'quaternary_ammonium_salt' },
            energyLevel: 'intermediate'
        },
        {
            step: 2,
            title: 'E2 Elimination',
            description: 'Hydroxide removes less substituted β-hydrogen',
            electronFlow: [
                { from: 'OH-', to: 'beta_H', type: 'deprotonation' },
                { from: 'C-H', to: 'C=C', type: 'bond_formation' },
                { from: 'C-N+', to: 'amine', type: 'bond_cleavage' }
            ],
            intermediates: null,
            energyLevel: 'product'
        }
    ],
    
    productRules: {
        majorProduct: 'less_substituted_alkene',
        regioselectivity: 'anti_zaitsev'
    }
};

// Cope Elimination
REACTION_DATABASE.cope_elimination = {
    name: 'Cope Elimination',
    type: 'elimination',
    reagents: ['H2O2'],
    conditions: 'Heat (100-150°C)',
    
    mechanism: [
        {
            step: 1,
            title: 'Amine Oxide Formation',
            description: 'Oxidation of tertiary amine to N-oxide',
            electronFlow: [
                { from: 'amine', to: 'H2O2', type: 'oxidation' }
            ],
            intermediates: { type: 'amine_N_oxide' },
            energyLevel: 'intermediate'
        },
        {
            step: 2,
            title: 'Syn Elimination',
            description: 'Concerted five-membered cyclic transition state',
            electronFlow: [
                { from: 'beta_H', to: 'oxygen', type: 'syn_elimination' },
                { from: 'C-H', to: 'C=C', type: 'bond_formation' },
                { from: 'C-N', to: 'hydroxylamine', type: 'bond_cleavage' }
            ],
            intermediates: { type: 'cyclic_TS', geometry: 'syn_periplanar' },
            energyLevel: 'transition_state'
        }
    ],
    
    productRules: {
        stereochemistry: 'syn',
        majorProduct: 'less_substituted_alkene'
    }
};

// Pinacol Rearrangement
REACTION_DATABASE.pinacol_rearrangement = {
    name: 'Pinacol Rearrangement',
    type: 'rearrangement',
    reagents: ['H2SO4', 'H3PO4'],
    conditions: 'Acid catalyst, heat',
    
    mechanism: [
        {
            step: 1,
            title: 'Protonation of Hydroxyl',
            description: 'Acid protonates one OH group',
            electronFlow: [
                { from: 'H+', to: 'OH', type: 'protonation' }
            ],
            intermediates: { type: 'protonated_alcohol' },
            energyLevel: 'intermediate'
        },
        {
            step: 2,
            title: 'Water Loss',
            description: 'Formation of carbocation',
            electronFlow: [
                { from: 'C-OH2+', to: 'H2O', type: 'bond_cleavage' }
            ],
            intermediates: { type: 'carbocation' },
            energyLevel: 'high_energy'
        },
        {
            step: 3,
            title: '1,2-Methyl Shift',
            description: 'Alkyl group migrates with its bonding electrons',
            electronFlow: [
                { from: 'C-C', to: 'carbocation', type: 'migration' },
                { from: 'OH', to: 'C+', type: 'resonance' }
            ],
            intermediates: { type: 'oxonium_ion' },
            energyLevel: 'intermediate'
        },
        {
            step: 4,
            title: 'Deprotonation',
            description: 'Loss of proton forms ketone',
            electronFlow: [
                { from: 'base', to: 'H+', type: 'deprotonation' },
                { from: 'O-H', to: 'C=O', type: 'bond_formation' }
            ],
            intermediates: null,
            energyLevel: 'product'
        }
    ],
    
    productRules: {
        majorProduct: 'ketone_or_aldehyde',
        migration: 'more_stable_carbocation_intermediate'
    }
};

// Beckmann Rearrangement
REACTION_DATABASE.beckmann_rearrangement = {
    name: 'Beckmann Rearrangement',
    type: 'rearrangement',
    reagents: ['H2SO4', 'PCl5', 'SOCl2'],
    conditions: 'Acidic conditions',
    
    mechanism: [
        {
            step: 1,
            title: 'Protonation of Oxime OH',
            description: 'Activation of leaving group',
            electronFlow: [
                { from: 'H+', to: 'N-OH', type: 'protonation' }
            ],
            intermediates: { type: 'protonated_oxime' },
            energyLevel: 'intermediate'
        },
        {
            step: 2,
            title: 'Concerted Migration',
            description: 'Anti group migrates as water leaves',
            electronFlow: [
                { from: 'C-C', to: 'nitrogen', type: 'migration' },
                { from: 'N-OH2+', to: 'H2O', type: 'bond_cleavage' }
            ],
            intermediates: { type: 'nitrilium_ion' },
            energyLevel: 'transition_state'
        },
        {
            step: 3,
            title: 'Hydration',
            description: 'Water attacks nitrilium ion',
            electronFlow: [
                { from: 'H2O', to: 'C+', type: 'nucleophilic' }
            ],
            intermediates: { type: 'imidic_acid' },
            energyLevel: 'intermediate'
        },
        {
            step: 4,
            title: 'Tautomerization',
            description: 'Rearrangement to amide',
            electronFlow: [
                { from: 'N-H', to: 'C=O', type: 'tautomerization' }
            ],
            intermediates: null,
            energyLevel: 'product'
        }
    ],
    
    productRules: {
        majorProduct: 'amide',
        stereochemistry: 'anti_group_migrates'
    }
};

// Baeyer-Villiger Oxidation
REACTION_DATABASE.baeyer_villiger = {
    name: 'Baeyer-Villiger Oxidation',
    type: 'oxidation',
    reagents: ['mCPBA', 'H2O2'],
    conditions: 'Peracid',
    
    mechanism: [
        {
            step: 1,
            title: 'Nucleophilic Addition',
            description: 'Ketone attacks peracid',
            electronFlow: [
                { from: 'ketone_O', to: 'peracid_O', type: 'nucleophilic' }
            ],
            intermediates: { type: 'criegee_intermediate' },
            energyLevel: 'intermediate'
        },
        {
            step: 2,
            title: 'Alkyl Migration',
            description: 'More substituted alkyl group migrates',
            electronFlow: [
                { from: 'C-C', to: 'oxygen', type: 'migration' },
                { from: 'O-O', to: 'carboxylate', type: 'bond_cleavage' }
            ],
            intermediates: null,
            energyLevel: 'product'
        }
    ],
    
    productRules: {
        majorProduct: 'ester',
        migratory_aptitude: 'tertiary > secondary > primary > methyl',
        cyclic_ketones: 'lactone'
    }
};

// Ozonolysis
REACTION_DATABASE.ozonolysis = {
    name: 'Ozonolysis',
    type: 'oxidative_cleavage',
    reagents: ['O3', 'Zn/H2O or DMS'],
    conditions: 'Low temperature then reductive workup',
    
    mechanism: [
        {
            step: 1,
            title: 'Formation of Molozonide',
            description: '1,3-dipolar cycloaddition of ozone to alkene',
            electronFlow: [
                { from: 'O3', to: 'C=C', type: 'cycloaddition' }
            ],
            intermediates: { type: 'molozonide', stability: 'unstable' },
            energyLevel: 'intermediate'
        },
        {
            step: 2,
            title: 'Molozonide Rearrangement',
            description: 'Fragmentation and recombination to ozonide',
            electronFlow: [
                { from: 'molozonide', to: 'carbonyl_oxide', type: 'fragmentation' }
            ],
            intermediates: { type: 'ozonide', ring: 'five_membered' },
            energyLevel: 'intermediate'
        },
        {
            step: 3,
            title: 'Reductive Workup',
            description: 'Reduction to carbonyl compounds',
            electronFlow: [
                { from: 'reducing_agent', to: 'ozonide', type: 'reduction' }
            ],
            intermediates: null,
            energyLevel: 'product'
        }
    ],
    
    productRules: {
        majorProduct: 'two_carbonyl_compounds',
        with_Zn: 'aldehydes_or_ketones',
        with_H2O2: 'carboxylic_acids'
    }
};

// Fischer Esterification
REACTION_DATABASE.fischer_esterification = {
    name: 'Fischer Esterification',
    type: 'esterification',
    reagents: ['H2SO4', 'ROH'],
    conditions: 'Acid catalyst, excess alcohol',
    
    mechanism: [
        {
            step: 1,
            title: 'Protonation of Carbonyl',
            description: 'Acid activates carboxylic acid',
            electronFlow: [
                { from: 'H+', to: 'C=O', type: 'protonation' }
            ],
            intermediates: { type: 'protonated_carbonyl' },
            energyLevel: 'intermediate'
        },
        {
            step: 2,
            title: 'Nucleophilic Attack',
            description: 'Alcohol attacks carbonyl carbon',
            electronFlow: [
                { from: 'ROH', to: 'C+', type: 'nucleophilic' }
            ],
            intermediates: { type: 'tetrahedral_intermediate' },
            energyLevel: 'intermediate'
        },
        {
            step: 3,
            title: 'Proton Transfer',
            description: 'Protonation of OH, deprotonation of OR',
            electronFlow: [
                { from: 'H+', to: 'OH', type: 'protonation' }
            ],
            intermediates: { type: 'protonated_intermediate' },
            energyLevel: 'intermediate'
        },
        {
            step: 4,
            title: 'Water Elimination',
            description: 'Loss of water forms ester',
            electronFlow: [
                { from: 'C-OH2+', to: 'H2O', type: 'elimination' },
                { from: 'O', to: 'C=O', type: 'bond_formation' }
            ],
            intermediates: null,
            energyLevel: 'product'
        }
    ],
    
    productRules: {
        majorProduct: 'ester',
        equilibrium: 'use_excess_alcohol_or_remove_water'
    }
};

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { REACTION_DATABASE, FUNCTIONAL_GROUPS, CONDITION_EFFECTS };
}
