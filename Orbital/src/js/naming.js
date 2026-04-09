// Chemical Naming System - IUPAC nomenclature

// Get the IUPAC name for a molecule
function getIUPACName(moleculeData) {
    const atoms = moleculeData.atoms;
    const bonds = moleculeData.bonds;
    
    if (atoms.length === 0) return '';
    
    // Simple cases first
    if (atoms.length === 1) {
        return getSingleAtomName(atoms[0].element);
    }
    
    // Check for common simple molecules
    const simpleName = getSimpleMoleculeName(moleculeData);
    if (simpleName) return simpleName;
    
    // Get carbon count for hydrocarbons
    const carbons = atoms.filter(a => a.element === 'C');
    const hydrogens = atoms.filter(a => a.element === 'H');
    
    if (carbons.length > 0 && hydrogens.length > 0) {
        return getHydrocarbonName(moleculeData);
    }
    
    // Generic fallback
    return getMolecularFormula(moleculeData);
}

// Get single atom name
function getSingleAtomName(element) {
    const names = {
        'H': 'Hydrogen',
        'C': 'Carbon',
        'N': 'Nitrogen',
        'O': 'Oxygen',
        'F': 'Fluorine',
        'Cl': 'Chlorine',
        'Br': 'Bromine',
        'I': 'Iodine',
        'S': 'Sulfur',
        'P': 'Phosphorus'
    };
    return names[element] || element;
}

// Recognize common simple molecules
function getSimpleMoleculeName(moleculeData) {
    const formula = getMolecularFormula(moleculeData);
    
    const commonMolecules = {
        'H2O': 'Water',
        'H2O2': 'Hydrogen Peroxide',
        'NH3': 'Ammonia',
        'CH4': 'Methane',
        'CO2': 'Carbon Dioxide',
        'CO': 'Carbon Monoxide',
        'O2': 'Oxygen',
        'N2': 'Nitrogen',
        'Cl2': 'Chlorine',
        'H2': 'Hydrogen',
        'HCl': 'Hydrochloric Acid',
        'H2SO4': 'Sulfuric Acid',
        'HNO3': 'Nitric Acid',
        'NaOH': 'Sodium Hydroxide',
        'C2H6O': 'Ethanol',
        'C6H12O6': 'Glucose'
    };
    
    return commonMolecules[formula] || null;
}

// Get hydrocarbon name (alkanes, alkenes, alkynes)
function getHydrocarbonName(moleculeData) {
    const carbons = moleculeData.atoms.filter(a => a.element === 'C');
    const carbonCount = carbons.length;
    
    // Get carbon chain prefix
    const prefix = getCarbonPrefix(carbonCount);
    
    // Check for double and triple bonds
    let hasDoubleBond = false;
    let hasTripleBond = false;
    
    moleculeData.bonds.forEach(bond => {
        const atom1 = moleculeData.atoms.find(a => a.id === bond.atom1);
        const atom2 = moleculeData.atoms.find(a => a.id === bond.atom2);
        
        if (atom1 && atom2 && atom1.element === 'C' && atom2.element === 'C') {
            if (bond.order === 2) hasDoubleBond = true;
            if (bond.order === 3) hasTripleBond = true;
        }
    });
    
    // Determine suffix
    let suffix = 'ane'; // Alkane (single bonds)
    if (hasTripleBond) {
        suffix = 'yne'; // Alkyne
    } else if (hasDoubleBond) {
        suffix = 'ene'; // Alkene
    }
    
    // Check for functional groups
    const functionalGroups = detectFunctionalGroupsForNaming(moleculeData);
    
    if (functionalGroups.alcohol) {
        suffix = 'anol';
    } else if (functionalGroups.ketone) {
        suffix = 'anone';
    } else if (functionalGroups.aldehyde) {
        suffix = 'anal';
    } else if (functionalGroups.carboxylicAcid) {
        suffix = 'anoic acid';
    } else if (functionalGroups.amine) {
        suffix = 'anamine';
    }
    
    // Check for cyclic structure
    const rings = detectRingsInMolecule(moleculeData);
    const cyclic = rings.length > 0 && rings.some(r => r.length >= 3);
    const cyclicPrefix = cyclic ? 'cyclo' : '';
    
    return cyclicPrefix + prefix + suffix;
}

// Get carbon number prefix
function getCarbonPrefix(count) {
    const prefixes = {
        1: 'meth',
        2: 'eth',
        3: 'prop',
        4: 'but',
        5: 'pent',
        6: 'hex',
        7: 'hept',
        8: 'oct',
        9: 'non',
        10: 'dec',
        11: 'undec',
        12: 'dodec'
    };
    
    return prefixes[count] || `C${count}`;
}

// Detect functional groups for naming
function detectFunctionalGroupsForNaming(moleculeData) {
    const groups = {
        alcohol: false,
        aldehyde: false,
        ketone: false,
        carboxylicAcid: false,
        amine: false,
        ether: false,
        ester: false
    };
    
    moleculeData.atoms.forEach(atom => {
        const atomBonds = moleculeData.bonds.filter(b => 
            b.atom1 === atom.id || b.atom2 === atom.id
        );
        
        // Alcohol (-OH)
        if (atom.element === 'O' && atomBonds.length === 2) {
            const connectedAtoms = atomBonds.map(b => {
                const otherId = b.atom1 === atom.id ? b.atom2 : b.atom1;
                return moleculeData.atoms.find(a => a.id === otherId);
            });
            
            const hasH = connectedAtoms.some(a => a.element === 'H');
            const hasC = connectedAtoms.some(a => a.element === 'C');
            
            if (hasH && hasC) {
                groups.alcohol = true;
            }
        }
        
        // Carbonyl (C=O)
        if (atom.element === 'C') {
            const doubleBondO = atomBonds.find(b => {
                const otherId = b.atom1 === atom.id ? b.atom2 : b.atom1;
                const otherAtom = moleculeData.atoms.find(a => a.id === otherId);
                return b.order === 2 && otherAtom && otherAtom.element === 'O';
            });
            
            if (doubleBondO) {
                const connectedCarbons = atomBonds.filter(b => {
                    const otherId = b.atom1 === atom.id ? b.atom2 : b.atom1;
                    const otherAtom = moleculeData.atoms.find(a => a.id === otherId);
                    return otherAtom && otherAtom.element === 'C';
                });
                
                if (connectedCarbons.length === 2) {
                    groups.ketone = true;
                } else if (connectedCarbons.length === 1) {
                    // Check if it's carboxylic acid or aldehyde
                    const hasOH = atomBonds.some(b => {
                        const otherId = b.atom1 === atom.id ? b.atom2 : b.atom1;
                        const otherAtom = moleculeData.atoms.find(a => a.id === otherId);
                        return otherAtom && otherAtom.element === 'O' && b.order === 1;
                    });
                    
                    if (hasOH) {
                        groups.carboxylicAcid = true;
                    } else {
                        groups.aldehyde = true;
                    }
                }
            }
        }
        
        // Amine (-NH2, -NH-, -N<)
        if (atom.element === 'N') {
            const hCount = atomBonds.filter(b => {
                const otherId = b.atom1 === atom.id ? b.atom2 : b.atom1;
                const otherAtom = moleculeData.atoms.find(a => a.id === otherId);
                return otherAtom && otherAtom.element === 'H';
            }).length;
            
            if (hCount > 0) {
                groups.amine = true;
            }
        }
    });
    
    return groups;
}

// Detect rings in molecule data
function detectRingsInMolecule(moleculeData) {
    const visited = new Set();
    const rings = [];
    
    const dfs = (atomId, parent, path, depth) => {
        if (depth > 10) return; // Prevent infinite recursion
        
        if (visited.has(atomId)) {
            const cycleStart = path.indexOf(atomId);
            if (cycleStart !== -1) {
                const ring = path.slice(cycleStart);
                if (ring.length >= 3 && ring.length <= 10) {
                    rings.push(ring);
                }
            }
            return;
        }
        
        visited.add(atomId);
        path.push(atomId);
        
        const atomBonds = moleculeData.bonds.filter(b => 
            b.atom1 === atomId || b.atom2 === atomId
        );
        
        atomBonds.forEach(bond => {
            const nextId = bond.atom1 === atomId ? bond.atom2 : bond.atom1;
            if (nextId !== parent) {
                dfs(nextId, atomId, [...path], depth + 1);
            }
        });
    };
    
    moleculeData.atoms.forEach(atom => {
        if (!visited.has(atom.id)) {
            dfs(atom.id, null, [], 0);
        }
    });
    
    return rings;
}

// Get common name for functional groups
function getFunctionalGroupName(groupType) {
    const names = {
        'alcohol': 'Alcohol',
        'aldehyde': 'Aldehyde',
        'ketone': 'Ketone',
        'carboxylicAcid': 'Carboxylic Acid',
        'amine': 'Amine',
        'ether': 'Ether',
        'ester': 'Ester',
        'amide': 'Amide',
        'nitrile': 'Nitrile',
        'alkene': 'Alkene',
        'alkyne': 'Alkyne',
        'aromaticRing': 'Aromatic Ring',
        'halide': 'Halide'
    };
    
    return names[groupType] || groupType;
}

// Get descriptive name with functional groups
function getDescriptiveName(moleculeData) {
    const iupacName = getIUPACName(moleculeData);
    const functionalGroups = detectFunctionalGroupsForNaming(moleculeData);
    const rings = detectRingsInMolecule(moleculeData);
    
    let description = iupacName;
    
    const groupList = [];
    for (const group in functionalGroups) {
        if (functionalGroups[group]) {
            groupList.push(getFunctionalGroupName(group));
        }
    }
    
    if (groupList.length > 0) {
        description += ' (' + groupList.join(', ') + ')';
    }
    
    if (rings.length > 0) {
        description += ` [${rings.length} ring(s)]`;
    }
    
    return description;
}
