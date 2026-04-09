/**
 * Atom Enrichment Service - Integrates PubChem data for all atoms
 * Provides validation, suggestions, and property enrichment
 */

class AtomEnrichmentService {
    constructor(pubchemService, chemistryIntelligence) {
        this.pubchemService = pubchemService;
        this.chemistryIntelligence = chemistryIntelligence;
        
        // Cache for element properties
        this.elementCache = new Map();
        
        // Common compound patterns for validation
        this.commonPatterns = this.initializeCommonPatterns();
    }
    
    /**
     * Initialize common molecular patterns for validation
     */
    initializeCommonPatterns() {
        return {
            // Common functional groups
            'carbonyl': { pattern: 'C=O', description: 'Carbonyl group' },
            'hydroxyl': { pattern: 'O-H', description: 'Hydroxyl group' },
            'amino': { pattern: 'N-H', description: 'Amino group' },
            'carboxyl': { pattern: 'C(=O)O', description: 'Carboxyl group' },
            'ester': { pattern: 'C(=O)O-C', description: 'Ester group' },
            'amide': { pattern: 'C(=O)N', description: 'Amide group' },
            
            // Common ring systems
            'benzene': { pattern: 'C6H6', description: 'Benzene ring' },
            'pyridine': { pattern: 'C5H5N', description: 'Pyridine ring' },
            'pyrrole': { pattern: 'C4H5N', description: 'Pyrrole ring' },
            
            // Common aliphatic chains
            'methane': { pattern: 'CH4', description: 'Methane' },
            'ethane': { pattern: 'C2H6', description: 'Ethane' },
            'propane': { pattern: 'C3H8', description: 'Propane' }
        };
    }
    
    /**
     * Enrich all atoms in a molecule with PubChem data
     */
    async enrichMolecule(molecule) {
        if (!this.pubchemService) {
            console.warn('PubChem service not available');
            return;
        }
        
        const enrichmentPromises = molecule.atoms.map(atom => 
            this.enrichAtom(atom, molecule)
        );
        
        await Promise.all(enrichmentPromises);
        
        // Validate entire molecule
        this.validateMolecule(molecule);
    }
    
    /**
     * Enrich a single atom with PubChem and chemistry intelligence
     */
    async enrichAtom(atom, molecule) {
        // Get element data
        const elementData = getElement(atom.element);
        if (!elementData) return;
        
        // Cache element properties
        if (!this.elementCache.has(atom.element)) {
            this.elementCache.set(atom.element, {
                ...elementData,
                commonCompounds: await this.fetchCommonCompounds(atom.element)
            });
        }
        
        // Calculate properties using chemistry intelligence
        if (this.chemistryIntelligence) {
            // Calculate implicit hydrogens
            atom.implicitHydrogens = this.chemistryIntelligence.calculateImplicitHydrogens(atom, molecule);
            
            // Calculate formal charge
            atom.charge = this.chemistryIntelligence.calculateFormalCharge(atom, molecule);
            
            // Determine hybridization
            atom.hybridization = this.chemistryIntelligence.getHybridization(atom, molecule);
            
            // Validate valence
            atom.valenceValid = this.chemistryIntelligence.isValenceSatisfied(atom, molecule);
        }
        
        // Add PubChem suggestions
        atom.suggestions = this.getSuggestions(atom, molecule);
        
        // Add common bonding patterns
        atom.commonPatterns = this.getCommonPatterns(atom, molecule);
    }
    
    /**
     * Fetch common compounds containing this element from PubChem
     */
    async fetchCommonCompounds(element) {
        if (!this.pubchemService) return [];
        
        try {
            // Search for common compounds with this element
            const query = element === 'C' ? 'methane' : 
                         element === 'N' ? 'ammonia' :
                         element === 'O' ? 'water' : element;
            
            const results = await this.pubchemService.searchCompounds(query, 5);
            return results.map(r => ({
                name: r.name,
                formula: r.formula,
                cid: r.cid
            }));
        } catch (error) {
            console.warn(`Failed to fetch compounds for ${element}:`, error);
            return [];
        }
    }
    
    /**
     * Get suggestions for atom based on context
     */
    getSuggestions(atom, molecule) {
        const suggestions = {
            nextElements: [],
            bondOrders: [],
            commonGroups: []
        };
        
        const bonds = molecule.getAtomBonds(atom.id);
        const bondCount = bonds.length;
        const element = atom.element;
        
        // Suggest next elements based on common patterns
        if (element === 'C') {
            if (bondCount < 4) {
                suggestions.nextElements = ['C', 'H', 'N', 'O', 'F', 'Cl', 'Br', 'I'];
            }
        } else if (element === 'N') {
            if (bondCount < 3) {
                suggestions.nextElements = ['C', 'H', 'O'];
            }
        } else if (element === 'O') {
            if (bondCount < 2) {
                suggestions.nextElements = ['C', 'H', 'N'];
            }
        }
        
        // Suggest bond orders based on existing bonds
        if (bonds.length > 0) {
            const hasDouble = bonds.some(b => b.order === 2);
            const hasTriple = bonds.some(b => b.order === 3);
            
            if (!hasDouble && !hasTriple && element === 'C') {
                suggestions.bondOrders = [1, 2]; // Can form double bond
            }
        }
        
        // Suggest common functional groups
        if (element === 'C' && bondCount === 1) {
            suggestions.commonGroups = ['OH', 'NH2', 'COOH', 'CHO'];
        }
        
        return suggestions;
    }
    
    /**
     * Get common bonding patterns for atom
     */
    getCommonPatterns(atom, molecule) {
        const patterns = [];
        const bonds = molecule.getAtomBonds(atom.id);
        
        // Check for carbonyl
        const carbonylBond = bonds.find(b => {
            const otherAtom = molecule.getAtomById(b.atom1 === atom.id ? b.atom2 : b.atom1);
            return b.order === 2 && otherAtom && otherAtom.element === 'O';
        });
        
        if (carbonylBond) {
            patterns.push({
                type: 'carbonyl',
                description: 'Carbonyl group (C=O)',
                valid: true
            });
        }
        
        // Check for hydroxyl
        const hydroxylBond = bonds.find(b => {
            const otherAtom = molecule.getAtomById(b.atom1 === atom.id ? b.atom2 : b.atom1);
            return b.order === 1 && otherAtom && otherAtom.element === 'O';
        });
        
        if (hydroxylBond) {
            const oAtom = molecule.getAtomById(hydroxylBond.atom1 === atom.id ? hydroxylBond.atom2 : hydroxylBond.atom1);
            const hasH = molecule.getAtomBonds(oAtom.id).some(b => {
                const otherAtom = molecule.getAtomById(b.atom1 === oAtom.id ? b.atom2 : b.atom1);
                return otherAtom && otherAtom.element === 'H';
            });
            
            if (hasH) {
                patterns.push({
                    type: 'hydroxyl',
                    description: 'Hydroxyl group (-OH)',
                    valid: true
                });
            }
        }
        
        return patterns;
    }
    
    /**
     * Validate entire molecule
     */
    validateMolecule(molecule) {
        if (!this.chemistryIntelligence) return;
        
        const errors = this.chemistryIntelligence.validateMolecule(molecule);
        
        // Add validation results to molecule
        molecule.validationErrors = errors;
        molecule.isValid = errors.length === 0;
        
        // Detect aromatic rings
        const aromaticRings = this.chemistryIntelligence.detectAromaticRings(molecule);
        molecule.aromaticRings = aromaticRings;
        
        // Detect functional groups
        const functionalGroups = molecule.detectFunctionalGroups();
        molecule.functionalGroups = functionalGroups;
        
        return {
            isValid: molecule.isValid,
            errors: errors,
            aromaticRings: aromaticRings,
            functionalGroups: functionalGroups
        };
    }
    
    /**
     * Suggest corrections for invalid atoms
     */
    suggestCorrections(atom, molecule) {
        const suggestions = [];
        
        if (!atom.valenceValid) {
            const bonds = molecule.getAtomBonds(atom.id);
            const bondSum = bonds.reduce((sum, b) => sum + b.order, 0);
            const elementData = getElement(atom.element);
            
            if (elementData && bondSum > elementData.valence) {
                suggestions.push({
                    type: 'remove_bond',
                    message: `Remove bonds to satisfy valence (${bondSum} > ${elementData.valence})`,
                    priority: 'high'
                });
            }
        }
        
        // Suggest adding hydrogens
        if (atom.implicitHydrogens > 0 && atom.element !== 'H') {
            suggestions.push({
                type: 'add_hydrogens',
                message: `Add ${atom.implicitHydrogens} implicit hydrogen(s)`,
                priority: 'medium',
                count: atom.implicitHydrogens
            });
        }
        
        return suggestions;
    }
    
    /**
     * Get PubChem data for a molecule (by formula or SMILES)
     */
    async searchMoleculeInPubChem(molecule) {
        if (!this.pubchemService) return null;
        
        try {
            const formula = molecule.getMolecularFormula();
            const results = await this.pubchemService.searchCompounds(formula, 10);
            
            // Try to match by formula
            const matches = results.filter(r => 
                r.formula && r.formula.replace(/\s/g, '') === formula.replace(/\s/g, '')
            );
            
            if (matches.length > 0) {
                return {
                    matches: matches,
                    bestMatch: matches[0],
                    confidence: 'high'
                };
            }
            
            return {
                matches: results,
                bestMatch: results[0] || null,
                confidence: 'low'
            };
        } catch (error) {
            console.warn('PubChem molecule search failed:', error);
            return null;
        }
    }
    
    /**
     * Import molecule structure from PubChem CID
     */
    async importFromPubChem(cid, molecule) {
        if (!this.pubchemService) {
            throw new Error('PubChem service not available');
        }
        
        try {
            const structure = await this.pubchemService.fetchCompoundStructure(cid);
            
            // Clear existing molecule
            molecule.clear();
            
            // Add atoms
            structure.atoms.forEach(atomData => {
                molecule.addAtom(
                    atomData.element,
                    atomData.position.x,
                    atomData.position.y
                );
            });
            
            // Add bonds
            structure.bonds.forEach(bondData => {
                molecule.addBond(
                    bondData.atom1,
                    bondData.atom2,
                    bondData.order
                );
            });
            
            // Enrich with PubChem data
            await this.enrichMolecule(molecule);
            
            return {
                success: true,
                name: structure.name,
                formula: structure.formula,
                metadata: structure.metadata
            };
        } catch (error) {
            console.error('PubChem import failed:', error);
            throw error;
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AtomEnrichmentService };
}

