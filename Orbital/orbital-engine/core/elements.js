// Element Library - Chemical Properties Database
// Contains electronegativity, valence, color, atomic mass, and other properties

const ELEMENTS = {
    'C': {
        name: 'Carbon',
        symbol: 'C',
        valence: 4,
        electronegativity: 2.55,
        atomicMass: 12.011,
        color: '#333333',
        radius: 15,
        lonePairs: 0,
        commonHybridizations: ['sp', 'sp2', 'sp3']
    },
    'H': {
        name: 'Hydrogen',
        symbol: 'H',
        valence: 1,
        electronegativity: 2.20,
        atomicMass: 1.008,
        color: '#FFFFFF',
        radius: 10,
        lonePairs: 0,
        commonHybridizations: ['s']
    },
    'N': {
        name: 'Nitrogen',
        symbol: 'N',
        valence: 3,
        electronegativity: 3.04,
        atomicMass: 14.007,
        color: '#3050F8',
        radius: 14,
        lonePairs: 1,
        commonHybridizations: ['sp', 'sp2', 'sp3']
    },
    'O': {
        name: 'Oxygen',
        symbol: 'O',
        valence: 2,
        electronegativity: 3.44,
        atomicMass: 15.999,
        color: '#FF0D0D',
        radius: 13,
        lonePairs: 2,
        commonHybridizations: ['sp2', 'sp3']
    },
    'F': {
        name: 'Fluorine',
        symbol: 'F',
        valence: 1,
        electronegativity: 3.98,
        atomicMass: 18.998,
        color: '#90E050',
        radius: 12,
        lonePairs: 3,
        commonHybridizations: ['sp3']
    },
    'Cl': {
        name: 'Chlorine',
        symbol: 'Cl',
        valence: 1,
        electronegativity: 3.16,
        atomicMass: 35.453,
        color: '#1FF01F',
        radius: 16,
        lonePairs: 3,
        commonHybridizations: ['sp3']
    },
    'Br': {
        name: 'Bromine',
        symbol: 'Br',
        valence: 1,
        electronegativity: 2.96,
        atomicMass: 79.904,
        color: '#A62929',
        radius: 18,
        lonePairs: 3,
        commonHybridizations: ['sp3']
    },
    'I': {
        name: 'Iodine',
        symbol: 'I',
        valence: 1,
        electronegativity: 2.66,
        atomicMass: 126.904,
        color: '#940094',
        radius: 20,
        lonePairs: 3,
        commonHybridizations: ['sp3']
    },
    'S': {
        name: 'Sulfur',
        symbol: 'S',
        valence: 2,
        electronegativity: 2.58,
        atomicMass: 32.065,
        color: '#FFFF30',
        radius: 16,
        lonePairs: 2,
        commonHybridizations: ['sp2', 'sp3']
    },
    'P': {
        name: 'Phosphorus',
        symbol: 'P',
        valence: 3,
        electronegativity: 2.19,
        atomicMass: 30.974,
        color: '#FF8000',
        radius: 15,
        lonePairs: 1,
        commonHybridizations: ['sp3']
    }
};

// Calculate bond polarity based on electronegativity difference
function calculateBondPolarity(element1, element2) {
    const en1 = ELEMENTS[element1].electronegativity;
    const en2 = ELEMENTS[element2].electronegativity;
    const delta = Math.abs(en1 - en2);
    
    return {
        delta: delta,
        type: delta < 0.5 ? 'nonpolar' : delta < 1.7 ? 'polar' : 'ionic',
        moreElectronegative: en1 > en2 ? element1 : element2
    };
}

// Determine hybridization based on bond count and lone pairs
function determineHybridization(element, bondCount) {
    const elementData = ELEMENTS[element];
    if (!elementData) return 'unknown';
    
    const lonePairs = elementData.lonePairs;
    const electronDomains = bondCount + lonePairs;
    
    // Special cases
    if (element === 'H') return 's'; // Hydrogen only uses s orbital
    
    switch(electronDomains) {
        case 2:
            return 'sp';
        case 3:
            return 'sp2';
        case 4:
            return 'sp3';
        case 5:
            return 'sp3d';
        case 6:
            return 'sp3d2';
        default:
            return 'sp3';
    }
}

// Get ideal bond angle based on hybridization
function getIdealBondAngle(hybridization) {
    const angles = {
        's': 0,
        'sp': 180,
        'sp2': 120,
        'sp3': 109.5,
        'sp3d': 90, // Trigonal bipyramidal equatorial
        'sp3d2': 90  // Octahedral
    };
    return angles[hybridization] || 109.5;
}

// Get geometry name based on hybridization and lone pairs
function getGeometry(hybridization, lonePairs) {
    const geometries = {
        'sp': {
            0: 'linear',
            1: 'linear'
        },
        'sp2': {
            0: 'trigonal planar',
            1: 'bent'
        },
        'sp3': {
            0: 'tetrahedral',
            1: 'trigonal pyramidal',
            2: 'bent'
        }
    };
    
    return (geometries[hybridization] && geometries[hybridization][lonePairs]) || 'unknown';
}

// Validate if an atom can form more bonds
function canFormBond(element, currentBonds) {
    const elementData = ELEMENTS[element];
    if (!elementData) return false;
    return currentBonds < elementData.valence;
}

// Calculate formal charge on an atom
function calculateFormalCharge(element, bondCount, lonePairElectrons) {
    const elementData = ELEMENTS[element];
    if (!elementData) return 0;
    
    const valenceElectrons = elementData.valence + elementData.lonePairs;
    const formalCharge = valenceElectrons - lonePairElectrons - bondCount;
    
    return formalCharge;
}

// Calculate partial charge on an atom
function calculatePartialCharge(element, bonds) {
    let totalDelta = 0;
    
    bonds.forEach(bond => {
        const polarity = calculateBondPolarity(element, bond.otherElement);
        // Weight by bond order
        const weight = bond.order || 1;
        
        if (polarity.moreElectronegative === element) {
            totalDelta -= polarity.delta * weight * 0.5; // Scale factor for partial charge
        } else {
            totalDelta += polarity.delta * weight * 0.5;
        }
    });
    
    return totalDelta;
}

// Check if molecule is aromatic based on Hückel's rule
function isAromatic(ringAtoms, molecule) {
    // Must be cyclic, planar, fully conjugated with 4n+2 π electrons
    if (ringAtoms.length < 3) return false;
    
    let piElectrons = 0;
    let allSp2 = true;
    
    ringAtoms.forEach(atomId => {
        const atom = molecule.getAtomById(atomId);
        if (atom.hybridization !== 'sp2') {
            allSp2 = false;
        }
        
        // Count π electrons
        const bonds = molecule.getAtomBonds(atomId);
        bonds.forEach(bond => {
            if (bond.order === 2) piElectrons += 1; // Each double bond contributes 2 π electrons total
        });
    });
    
    // Check Hückel's rule: 4n + 2
    const isHuckelNumber = (piElectrons - 2) % 4 === 0;
    
    return allSp2 && isHuckelNumber && piElectrons > 0;
}

// Get element by symbol
function getElement(symbol) {
    return ELEMENTS[symbol] || null;
}

// Get all element symbols
function getAllElements() {
    return Object.keys(ELEMENTS);
}
