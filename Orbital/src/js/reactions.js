// Reaction Simulator - Handle chemical reactions

class Reaction {
    constructor() {
        this.reactants = [];
        this.products = [];
        this.reagents = [];
        this.conditions = [];
        this.reactionType = null;
    }

    // Add a reactant molecule
    addReactant(molecule) {
        this.reactants.push(JSON.parse(JSON.stringify(molecule.toJSON())));
    }

    // Add a product molecule
    addProduct(molecule) {
        this.products.push(JSON.parse(JSON.stringify(molecule.toJSON())));
    }

    // Add reagent
    addReagent(name) {
        this.reagents.push(name);
    }

    // Add reaction condition
    addCondition(condition) {
        this.conditions.push(condition);
    }

    // Clear reaction
    clear() {
        this.reactants = [];
        this.products = [];
        this.reagents = [];
        this.conditions = [];
        this.reactionType = null;
    }

    // Export reaction
    toJSON() {
        return {
            reactants: this.reactants,
            products: this.products,
            reagents: this.reagents,
            conditions: this.conditions,
            reactionType: this.reactionType
        };
    }
}

// Common reaction types and templates
const REACTION_TYPES = {
    'substitution': {
        name: 'Nucleophilic Substitution (SN1/SN2)',
        description: 'Nucleophile replaces leaving group',
        conditions: ['solvent', 'temperature']
    },
    'elimination': {
        name: 'Elimination (E1/E2)',
        description: 'Loss of atoms to form double bond',
        conditions: ['base', 'heat']
    },
    'addition': {
        name: 'Addition',
        description: 'Addition across double/triple bond',
        conditions: ['catalyst', 'temperature']
    },
    'oxidation': {
        name: 'Oxidation',
        description: 'Increase in oxidation state',
        conditions: ['oxidizing agent']
    },
    'reduction': {
        name: 'Reduction',
        description: 'Decrease in oxidation state',
        conditions: ['reducing agent']
    },
    'condensation': {
        name: 'Condensation',
        description: 'Combination with loss of small molecule',
        conditions: ['catalyst', 'heat']
    },
    'hydrolysis': {
        name: 'Hydrolysis',
        description: 'Cleavage with water',
        conditions: ['acid/base', 'water']
    }
};

// Common reagents with detailed descriptions
const REAGENTS = {
    // Strong Bases (Elimination reactions)
    't-BuOK': { 
        name: 'Potassium tert-Butoxide', 
        type: 'strong base',
        use: 'E2 Elimination → Forms alkenes',
        conditions: 'Heat (Δ)',
        mechanism: 'Strong bulky base favors elimination over substitution'
    },
    'NaOEt': { 
        name: 'Sodium Ethoxide', 
        type: 'base',
        use: 'E2 Elimination → Forms alkenes',
        conditions: 'Heat (Δ)',
        mechanism: 'Strong base promotes elimination'
    },
    'KOH': { 
        name: 'Potassium Hydroxide', 
        type: 'base',
        use: 'E2 Elimination or SN2 Substitution',
        conditions: 'Heat (Δ) for E2, Room temp for SN2',
        mechanism: 'Temperature dependent'
    },
    'NaOH': { 
        name: 'Sodium Hydroxide', 
        type: 'base',
        use: 'SN2 Substitution or E2 Elimination',
        conditions: 'Room temp for SN2, Heat (Δ) for E2',
        mechanism: 'Nucleophilic/basic reagent'
    },
    
    // Acids (Addition, dehydration, catalysis)
    'H2SO4': { 
        name: 'Sulfuric Acid (conc.)', 
        type: 'acid',
        use: 'Dehydration of alcohols → Alkenes',
        conditions: 'Heat (Δ)',
        mechanism: 'Protonation then E1 elimination'
    },
    'H3PO4': { 
        name: 'Phosphoric Acid', 
        type: 'acid',
        use: 'Dehydration of alcohols (milder)',
        conditions: 'Heat (Δ)',
        mechanism: 'Milder acid-catalyzed dehydration'
    },
    'HCl': { 
        name: 'Hydrochloric Acid', 
        type: 'acid',
        use: 'Addition to alkenes → Alkyl halides',
        conditions: 'Room temperature',
        mechanism: 'Markovnikov addition'
    },
    'HBr': { 
        name: 'Hydrogen Bromide', 
        type: 'acid',
        use: 'Addition to alkenes → Alkyl bromides',
        conditions: 'Room temperature',
        mechanism: 'Markovnikov addition (or anti-Markovnikov with peroxides)'
    },
    
    // Oxidizing agents
    'KMnO4': { 
        name: 'Potassium Permanganate', 
        type: 'oxidizing',
        use: 'Oxidizes alcohols → Ketones/Carboxylic acids, Cleaves alkenes',
        conditions: 'Heat (Δ), Acidic or basic',
        mechanism: 'Strong oxidizer'
    },
    'K2Cr2O7': { 
        name: 'Potassium Dichromate', 
        type: 'oxidizing',
        use: '1° Alcohol → Carboxylic acid, 2° Alcohol → Ketone',
        conditions: 'H⁺, Heat (Δ)',
        mechanism: 'Chromium-based oxidation'
    },
    'PCC': { 
        name: 'Pyridinium Chlorochromate', 
        type: 'oxidizing',
        use: '1° Alcohol → Aldehyde (mild, stops at aldehyde)',
        conditions: 'Room temperature, CH₂Cl₂',
        mechanism: 'Mild oxidizer, stops before carboxylic acid'
    },
    'H2O2': { 
        name: 'Hydrogen Peroxide', 
        type: 'oxidizing',
        use: 'Epoxidation, mild oxidation',
        conditions: 'Varies',
        mechanism: 'Peroxide oxidation'
    },
    
    // Reducing agents
    'NaBH4': { 
        name: 'Sodium Borohydride', 
        type: 'reducing',
        use: 'Reduces aldehydes/ketones → Alcohols',
        conditions: 'Methanol or ethanol, Room temp',
        mechanism: 'Mild hydride donor'
    },
    'LiAlH4': { 
        name: 'Lithium Aluminum Hydride', 
        type: 'reducing',
        use: 'Reduces aldehydes/ketones/esters/acids → Alcohols',
        conditions: 'Dry ether, then H⁺ workup',
        mechanism: 'Strong hydride donor'
    },
    'H2/Pd': { 
        name: 'Hydrogen + Palladium Catalyst', 
        type: 'reducing',
        use: 'Hydrogenation of alkenes/alkynes → Alkanes',
        conditions: 'Pressure, Heat (Δ)',
        mechanism: 'Catalytic hydrogenation'
    },
    'H2/Pt': { 
        name: 'Hydrogen + Platinum Catalyst', 
        type: 'reducing',
        use: 'Hydrogenation of alkenes/alkynes',
        conditions: 'Pressure, Heat (Δ)',
        mechanism: 'Catalytic hydrogenation'
    },
    
    // Halogenation
    'Br2': { 
        name: 'Bromine', 
        type: 'halogen',
        use: 'Addition to alkenes → Dibromides, or Free radical substitution',
        conditions: 'Dark for addition, Light (hν) for substitution',
        mechanism: 'Electrophilic addition or free radical'
    },
    'Cl2': { 
        name: 'Chlorine', 
        type: 'halogen',
        use: 'Halogenation of alkanes/alkenes',
        conditions: 'Light (hν) for free radical',
        mechanism: 'Free radical or electrophilic addition'
    },
    'NBS': { 
        name: 'N-Bromosuccinimide', 
        type: 'halogen',
        use: 'Allylic bromination',
        conditions: 'Light (hν), Heat (Δ)',
        mechanism: 'Free radical allylic substitution'
    },
    
    // Nucleophiles
    'NaCN': { 
        name: 'Sodium Cyanide', 
        type: 'nucleophile',
        use: 'SN2 substitution → Nitriles',
        conditions: 'DMSO or DMF solvent',
        mechanism: 'Strong nucleophile'
    },
    'NaN3': { 
        name: 'Sodium Azide', 
        type: 'nucleophile',
        use: 'SN2 substitution → Azides',
        conditions: 'Polar aprotic solvent',
        mechanism: 'Good nucleophile'
    },
    
    // Other important reagents
    'O3': { 
        name: 'Ozone', 
        type: 'oxidizing',
        use: 'Ozonolysis of alkenes → Aldehydes/Ketones',
        conditions: '1) O₃, -78°C  2) Zn, H⁺ or DMS',
        mechanism: 'Cleaves C=C double bonds'
    },
    'OsO4': { 
        name: 'Osmium Tetroxide', 
        type: 'oxidizing',
        use: 'Syn dihydroxylation of alkenes → Diols',
        conditions: 'Pyridine, Room temp',
        mechanism: 'Adds two OH groups syn to same face'
    },
    'mCPBA': { 
        name: 'meta-Chloroperoxybenzoic acid', 
        type: 'oxidizing',
        use: 'Epoxidation of alkenes',
        conditions: 'CH₂Cl₂, Room temp',
        mechanism: 'Forms epoxides'
    }
};

// Reaction conditions
const CONDITIONS = {
    'heat': '∆ (Heat)',
    'reflux': 'Reflux',
    'ice': '0°C',
    'rt': 'Room Temperature',
    'light': 'hν (Light)',
    'pressure': 'High Pressure',
    'catalyst': 'Catalyst'
};

// Predict reaction type based on reactant structure
function predictReactionType(molecule) {
    const bonds = molecule.bonds;
    const atoms = molecule.atoms;
    
    const hasDoubleBond = bonds.some(b => b.order === 2);
    const hasTripleBond = bonds.some(b => b.order === 3);
    const hasHalogen = atoms.some(a => ['F', 'Cl', 'Br', 'I'].includes(a.element));
    const hasOH = false; // Would need functional group detection
    
    if (hasDoubleBond) {
        return ['addition', 'elimination', 'oxidation'];
    } else if (hasHalogen) {
        return ['substitution', 'elimination'];
    } else {
        return ['substitution', 'oxidation', 'reduction'];
    }
}

// Generate reaction arrow with conditions
function getReactionArrow(reagents, conditions) {
    const arrow = '―→';
    const aboveArrow = reagents.join(', ');
    const belowArrow = conditions.join(', ');
    
    return {
        arrow,
        aboveArrow,
        belowArrow
    };
}

// Balance atoms between reactants and products
function checkAtomBalance(reactants, products) {
    const countElements = (molecules) => {
        const counts = {};
        molecules.forEach(mol => {
            mol.atoms.forEach(atom => {
                counts[atom.element] = (counts[atom.element] || 0) + 1;
            });
        });
        return counts;
    };
    
    const reactantCounts = countElements(reactants);
    const productCounts = countElements(products);
    
    // Check if balanced
    const allElements = new Set([...Object.keys(reactantCounts), ...Object.keys(productCounts)]);
    let balanced = true;
    const differences = {};
    
    allElements.forEach(element => {
        const reactantCount = reactantCounts[element] || 0;
        const productCount = productCounts[element] || 0;
        if (reactantCount !== productCount) {
            balanced = false;
            differences[element] = { reactants: reactantCount, products: productCount };
        }
    });
    
    return { balanced, differences };
}

// Export reaction to text format
function reactionToText(reaction) {
    let text = '';
    
    // Reactants with names
    const reactantStrings = reaction.reactants
        .filter(r => r && r.atoms && r.atoms.length > 0)
        .map(r => {
            const formula = getMolecularFormula(r);
            const name = getIUPACName(r);
            return `${formula} (${name})`;
        });
    
    text += reactantStrings.join(' + ');
    
    // Arrow with conditions
    text += ' ―';
    if (reaction.reagents.length > 0) {
        text += '[' + reaction.reagents.join(', ') + ']';
    }
    if (reaction.conditions.length > 0) {
        text += '[' + reaction.conditions.join(', ') + ']';
    }
    text += '→ ';
    
    // Products with names
    const productStrings = reaction.products
        .filter(p => p && p.atoms && p.atoms.length > 0)
        .map(p => {
            const formula = getMolecularFormula(p);
            const name = getIUPACName(p);
            return `${formula} (${name})`;
        });
    
    text += productStrings.join(' + ');
    
    return text;
}

// Helper to get molecular formula from molecule data
function getMolecularFormula(moleculeData) {
    const elementCounts = {};
    
    moleculeData.atoms.forEach(atom => {
        elementCounts[atom.element] = (elementCounts[atom.element] || 0) + 1;
    });
    
    const order = ['C', 'H'];
    const sortedElements = Object.keys(elementCounts).sort((a, b) => {
        const aIndex = order.indexOf(a);
        const bIndex = order.indexOf(b);
        
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
    });
    
    let formula = '';
    sortedElements.forEach(element => {
        formula += element;
        if (elementCounts[element] > 1) {
            formula += elementCounts[element];
        }
    });
    
    return formula || '-';
}
