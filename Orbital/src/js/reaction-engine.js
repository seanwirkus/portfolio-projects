// Chemical Reaction Engine - Performs actual transformations on molecules

class ChemicalReactionEngine {
    constructor() {
        this.reactionRules = this.initializeReactionRules();
    }

    /**
     * Initialize reaction rules for different reagent combinations
     */
    initializeReactionRules() {
        return {
            // Oxidation reactions
            oxidation: {
                'primary_alcohol': {
                    reagents: ['KMnO4', 'CrO3', 'H2O2'],
                    transform: (molecule, alcoholAtoms) => {
                        // Primary alcohol → Carboxylic acid
                        alcoholAtoms.forEach(atomId => {
                            this.oxidizePrimaryAlcohol(molecule, atomId);
                        });
                    }
                },
                'secondary_alcohol': {
                    reagents: ['KMnO4', 'CrO3', 'PCC'],
                    transform: (molecule, alcoholAtoms) => {
                        // Secondary alcohol → Ketone
                        alcoholAtoms.forEach(atomId => {
                            this.oxidizeSecondaryAlcohol(molecule, atomId);
                        });
                    }
                },
                'alkene': {
                    reagents: ['KMnO4'],
                    transform: (molecule, alkeneAtoms) => {
                        // Alkene → Diol or cleaved products
                        this.oxidizeAlkene(molecule, alkeneAtoms);
                    }
                }
            },

            // Reduction reactions
            reduction: {
                'carbonyl': {
                    reagents: ['LiAlH4', 'NaBH4', 'BH3'],
                    transform: (molecule, carbonylAtoms) => {
                        // Aldehyde/Ketone → Alcohol
                        carbonylAtoms.forEach(atomId => {
                            this.reduceCarbonyl(molecule, atomId);
                        });
                    }
                },
                'carboxylic_acid': {
                    reagents: ['LiAlH4'],
                    transform: (molecule, acidAtoms) => {
                        // Carboxylic acid → Primary alcohol
                        acidAtoms.forEach(atomId => {
                            this.reduceCarboxylicAcid(molecule, atomId);
                        });
                    }
                },
                'alkene': {
                    reagents: ['H2'],
                    transform: (molecule, alkeneAtoms) => {
                        // Alkene → Alkane
                        this.reduceAlkene(molecule, alkeneAtoms);
                    }
                }
            },

            // Halogenation
            halogenation: {
                'alkene': {
                    reagents: ['Br2', 'Cl2'],
                    transform: (molecule, alkeneAtoms, reagent) => {
                        // Alkene → Dihalide
                        const halogen = reagent === 'Br2' ? 'Br' : 'Cl';
                        this.halogenateAlkene(molecule, alkeneAtoms, halogen);
                    }
                },
                'alkane': {
                    reagents: ['Br2', 'Cl2'],
                    conditions: ['hv'],
                    transform: (molecule, reagent) => {
                        // Free radical substitution
                        const halogen = reagent === 'Br2' ? 'Br' : 'Cl';
                        this.radicalHalogenation(molecule, halogen);
                    }
                }
            },

            // Addition reactions
            addition: {
                'alkene_HX': {
                    reagents: ['HBr', 'HCl'],
                    transform: (molecule, alkeneAtoms, reagent) => {
                        // Alkene + HX → Haloalkane (Markovnikov)
                        const halogen = reagent === 'HBr' ? 'Br' : 'Cl';
                        this.addHXToAlkene(molecule, alkeneAtoms, halogen);
                    }
                },
                'alkene_H2O': {
                    reagents: ['H2SO4'],
                    conditions: ['H2O'],
                    transform: (molecule, alkeneAtoms) => {
                        // Alkene + H2O → Alcohol (acid-catalyzed hydration)
                        this.hydrateAlkene(molecule, alkeneAtoms);
                    }
                }
            },

            // Elimination reactions
            elimination: {
                'haloalkane': {
                    reagents: ['NaOH', 'KOH'],
                    conditions: ['heat'],
                    transform: (molecule, haloAtoms) => {
                        // Haloalkane → Alkene (E2)
                        this.eliminateToAlkene(molecule, haloAtoms);
                    }
                },
                'alcohol': {
                    reagents: ['H2SO4'],
                    conditions: ['heat'],
                    transform: (molecule, alcoholAtoms) => {
                        // Alcohol → Alkene (dehydration)
                        this.dehydrateAlcohol(molecule, alcoholAtoms);
                    }
                }
            }
        };
    }

    /**
     * Perform reaction on molecule with given reagents
     */
    performReaction(molecule, reagents, conditions = []) {
        console.log('🧪 Performing reaction with reagents:', reagents);

        // Detect functional groups in molecule
        const functionalGroups = this.detectFunctionalGroups(molecule);
        console.log('📊 Detected functional groups:', functionalGroups);

        // Determine reaction type from reagents and conditions
        const reactionType = this.determineReactionType(reagents, conditions);
        console.log('⚗️ Reaction type:', reactionType);

        // Clone molecule for product
        const product = this.cloneMolecule(molecule);

        // Apply transformations based on reaction type and functional groups
        if (reactionType === 'aldol_addition' || reactionType === 'aldol_condensation') {
            this.performAldolReaction(product, functionalGroups, reagents, conditions, reactionType);
        } else if (reactionType === 'claisen_condensation') {
            this.performClaisenCondensation(product, functionalGroups, reagents);
        } else if (reactionType === 'friedel_crafts') {
            this.performFriedelCrafts(product, functionalGroups, reagents);
        } else if (reactionType === 'retro_aldol') {
            this.performRetroAldol(product, functionalGroups);
        } else if (reactionType === 'michael_addition') {
            this.performMichaelAddition(product, functionalGroups, reagents);
        } else if (reactionType === 'oxidation' && functionalGroups.alcohols.length > 0) {
            this.oxidizeAlcohols(product, functionalGroups.alcohols, reagents);
        } else if (reactionType === 'reduction' && functionalGroups.carbonyls.length > 0) {
            this.reduceCarbonyls(product, functionalGroups.carbonyls);
        } else if (reactionType === 'halogenation' && functionalGroups.alkenes.length > 0) {
            const halogen = reagents.includes('Br2') ? 'Br' : 'Cl';
            this.halogenateAlkenes(product, functionalGroups.alkenes, halogen);
        } else if (reactionType === 'addition' && functionalGroups.alkenes.length > 0) {
            if (reagents.includes('HBr') || reagents.includes('HCl')) {
                const halogen = reagents.includes('HBr') ? 'Br' : 'Cl';
                this.addHXToAlkenes(product, functionalGroups.alkenes, halogen);
            } else if (reagents.includes('H2SO4') && conditions.includes('H2O')) {
                this.hydrateAlkenes(product, functionalGroups.alkenes);
            }
        } else if (reactionType === 'elimination') {
            if (functionalGroups.haloalkanes.length > 0) {
                this.eliminateHaloalkanes(product, functionalGroups.haloalkanes);
            } else if (functionalGroups.alcohols.length > 0 && reagents.includes('H2SO4')) {
                this.dehydrateAlcohols(product, functionalGroups.alcohols);
            }
        }

        // Apply layout to product to ensure proper rendering
        this.layoutProduct(product);

        return product;
    }

    /**
     * Detect functional groups in molecule
     */
    detectFunctionalGroups(molecule) {
        const groups = {
            alcohols: [],
            carbonyls: [],
            alkenes: [],
            alkynes: [],
            haloalkanes: [],
            carboxylicAcids: [],
            amines: []
        };

        // Find alcohols (C-OH)
        molecule.atoms.forEach(atom => {
            if (atom.element === 'O') {
                const bonds = molecule.bonds.filter(b => b.atom1 === atom.id || b.atom2 === atom.id);
                const connectedToC = bonds.some(b => {
                    const otherId = b.atom1 === atom.id ? b.atom2 : b.atom1;
                    const otherAtom = molecule.atoms.find(a => a.id === otherId);
                    return otherAtom && otherAtom.element === 'C';
                });
                if (connectedToC && bonds.length === 1) {
                    groups.alcohols.push(atom.id);
                }
            }
        });

        // Find carbonyls (C=O)
        molecule.bonds.forEach(bond => {
            if (bond.order === 2) {
                const atom1 = molecule.atoms.find(a => a.id === bond.atom1);
                const atom2 = molecule.atoms.find(a => a.id === bond.atom2);
                if ((atom1.element === 'C' && atom2.element === 'O') ||
                    (atom1.element === 'O' && atom2.element === 'C')) {
                    const carbonId = atom1.element === 'C' ? atom1.id : atom2.id;
                    groups.carbonyls.push(carbonId);
                }
            }
        });

        // Find alkenes (C=C)
        molecule.bonds.forEach(bond => {
            if (bond.order === 2) {
                const atom1 = molecule.atoms.find(a => a.id === bond.atom1);
                const atom2 = molecule.atoms.find(a => a.id === bond.atom2);
                if (atom1.element === 'C' && atom2.element === 'C') {
                    groups.alkenes.push({ atom1: atom1.id, atom2: atom2.id, bondId: bond.id });
                }
            }
        });

        // Find haloalkanes (C-X where X = F, Cl, Br, I)
        molecule.atoms.forEach(atom => {
            if (['F', 'Cl', 'Br', 'I'].includes(atom.element)) {
                const bonds = molecule.bonds.filter(b => b.atom1 === atom.id || b.atom2 === atom.id);
                const connectedToC = bonds.some(b => {
                    const otherId = b.atom1 === atom.id ? b.atom2 : b.atom1;
                    const otherAtom = molecule.atoms.find(a => a.id === otherId);
                    return otherAtom && otherAtom.element === 'C';
                });
                if (connectedToC) {
                    groups.haloalkanes.push(atom.id);
                }
            }
        });

        return groups;
    }

    /**
     * Determine reaction type from reagents and conditions
     */
    determineReactionType(reagents, conditions = []) {
        // Check for specific reaction types first
        const strongBases = ['t-BuOK', 'KOBu', 'NaOEt', 'NaOMe', 'LDA'];
        const weakBases = ['NaOH', 'KOH', 'Ca(OH)2'];
        const lewisAcids = ['AlCl3', 'FeCl3', 'BF3'];
        const oxidizers = ['KMnO4', 'CrO3', 'PCC', 'H2O2', 'K2Cr2O7'];
        const reducers = ['LiAlH4', 'NaBH4', 'BH3'];
        const halogens = ['Br2', 'Cl2', 'NBS'];
        const acids = ['HBr', 'HCl', 'H2SO4', 'H3PO4', 'HClO4'];
        
        // Check for specific reaction patterns
        if (reagents.some(r => strongBases.includes(r)) && conditions.includes('heat')) {
            return 'aldol_condensation';
        }
        if (reagents.some(r => strongBases.includes(r)) && reagents.includes('NaOEt')) {
            return 'claisen_condensation';
        }
        if (reagents.some(r => lewisAcids.includes(r))) {
            return 'friedel_crafts';
        }
        if (reagents.some(r => weakBases.includes(r)) && conditions.includes('cold')) {
            return 'aldol_addition';
        }
        if (reagents.some(r => weakBases.includes(r)) && !conditions.includes('cold')) {
            return 'retro_aldol';
        }
        if (reagents.some(r => oxidizers.includes(r))) return 'oxidation';
        if (reagents.some(r => reducers.includes(r))) return 'reduction';
        if (reagents.some(r => halogens.includes(r))) return 'halogenation';
        if (reagents.some(r => acids.includes(r)) && reagents.some(r => ['H2O', 'H2O2'].includes(r))) {
            return 'michael_addition';
        }
        if (reagents.some(r => acids.includes(r))) return 'addition';
        if (reagents.some(r => weakBases.includes(r))) return 'elimination';

        return 'unknown';
    }

    /**
     * Oxidize alcohols to carbonyl compounds
     */
    oxidizeAlcohols(molecule, alcoholIds, reagents) {
        alcoholIds.forEach(oxygenId => {
            // Find the C-O bond
            const bond = molecule.bonds.find(b => 
                (b.atom1 === oxygenId || b.atom2 === oxygenId) && b.order === 1
            );
            
            if (bond) {
                // Convert C-O single bond to C=O double bond
                bond.order = 2;
                console.log(`✓ Oxidized alcohol to carbonyl at oxygen ${oxygenId}`);
            }
        });
    }

    /**
     * Reduce carbonyls to alcohols
     */
    reduceCarbonyls(molecule, carbonylIds) {
        carbonylIds.forEach(carbonId => {
            // Find the C=O bond
            const bond = molecule.bonds.find(b => {
                if (b.order !== 2) return false;
                const atom1 = molecule.atoms.find(a => a.id === b.atom1);
                const atom2 = molecule.atoms.find(a => a.id === b.atom2);
                return (atom1.id === carbonId && atom2.element === 'O') ||
                       (atom2.id === carbonId && atom1.element === 'O');
            });

            if (bond) {
                // Convert C=O double bond to C-O single bond
                bond.order = 1;
                console.log(`✓ Reduced carbonyl to alcohol at carbon ${carbonId}`);
            }
        });
    }

    /**
     * Add halogen across double bond
     */
    halogenateAlkenes(molecule, alkenes, halogen) {
        alkenes.forEach(alkene => {
            // Find the C=C bond
            const bond = molecule.bonds.find(b => b.id === alkene.bondId);
            if (bond) {
                // Convert double bond to single bond
                bond.order = 1;

                // Add halogens to both carbons
                const atom1 = molecule.atoms.find(a => a.id === alkene.atom1);
                const atom2 = molecule.atoms.find(a => a.id === alkene.atom2);

                if (atom1 && atom2) {
                    // Add first halogen
                    const hal1 = this.addAtomNearby(molecule, atom1, halogen, 30, 45);
                    molecule.bonds.push({
                        id: `bond_${molecule.bonds.length}`,
                        atom1: atom1.id,
                        atom2: hal1.id,
                        order: 1
                    });

                    // Add second halogen
                    const hal2 = this.addAtomNearby(molecule, atom2, halogen, 30, -45);
                    molecule.bonds.push({
                        id: `bond_${molecule.bonds.length}`,
                        atom1: atom2.id,
                        atom2: hal2.id,
                        order: 1
                    });

                    console.log(`✓ Added ${halogen}₂ across double bond`);
                }
            }
        });
    }

    /**
     * Add HX across double bond (Markovnikov addition)
     */
    addHXToAlkenes(molecule, alkenes, halogen) {
        alkenes.forEach(alkene => {
            const bond = molecule.bonds.find(b => b.id === alkene.bondId);
            if (bond) {
                // Convert double bond to single bond
                bond.order = 1;

                const atom1 = molecule.atoms.find(a => a.id === alkene.atom1);
                const atom2 = molecule.atoms.find(a => a.id === alkene.atom2);

                if (atom1 && atom2) {
                    // Add halogen to more substituted carbon (Markovnikov)
                    const hal = this.addAtomNearby(molecule, atom2, halogen, 30, 45);
                    molecule.bonds.push({
                        id: `bond_${molecule.bonds.length}`,
                        atom1: atom2.id,
                        atom2: hal.id,
                        order: 1
                    });

                    console.log(`✓ Added H${halogen} across double bond (Markovnikov)`);
                }
            }
        });
    }

    /**
     * Hydrate alkene to alcohol
     */
    hydrateAlkenes(molecule, alkenes) {
        alkenes.forEach(alkene => {
            const bond = molecule.bonds.find(b => b.id === alkene.bondId);
            if (bond) {
                // Convert double bond to single bond
                bond.order = 1;

                const atom2 = molecule.atoms.find(a => a.id === alkene.atom2);
                if (atom2) {
                    // Add OH to more substituted carbon (Markovnikov)
                    const oxygen = this.addAtomNearby(molecule, atom2, 'O', 30, 45);
                    molecule.bonds.push({
                        id: `bond_${molecule.bonds.length}`,
                        atom1: atom2.id,
                        atom2: oxygen.id,
                        order: 1
                    });

                    console.log(`✓ Hydrated alkene to alcohol`);
                }
            }
        });
    }

    /**
     * Eliminate to form alkene
     */
    eliminateHaloalkanes(molecule, haloIds) {
        haloIds.forEach(haloId => {
            // Find the halogen and its carbon
            const halogen = molecule.atoms.find(a => a.id === haloId);
            const bond = molecule.bonds.find(b => b.atom1 === haloId || b.atom2 === haloId);
            
            if (bond && halogen) {
                const carbonId = bond.atom1 === haloId ? bond.atom2 : bond.atom1;
                const carbon = molecule.atoms.find(a => a.id === carbonId);

                if (carbon && carbon.element === 'C') {
                    // Remove halogen
                    molecule.atoms = molecule.atoms.filter(a => a.id !== haloId);
                    molecule.bonds = molecule.bonds.filter(b => !(b.atom1 === haloId || b.atom2 === haloId));

                    // Find adjacent carbon and create double bond
                    const adjacentBonds = molecule.bonds.filter(b => 
                        (b.atom1 === carbonId || b.atom2 === carbonId) && b.order === 1
                    );

                    if (adjacentBonds.length > 0) {
                        // Convert first adjacent C-C bond to double bond
                        const targetBond = adjacentBonds.find(b => {
                            const otherId = b.atom1 === carbonId ? b.atom2 : b.atom1;
                            const otherAtom = molecule.atoms.find(a => a.id === otherId);
                            return otherAtom && otherAtom.element === 'C';
                        });

                        if (targetBond) {
                            targetBond.order = 2;
                            console.log(`✓ Eliminated ${halogen.element} to form alkene`);
                        }
                    }
                }
            }
        });
    }

    /**
     * Dehydrate alcohol to alkene
     */
    dehydrateAlcohols(molecule, alcoholIds) {
        alcoholIds.forEach(oxygenId => {
            // Remove the OH group and form double bond
            const bond = molecule.bonds.find(b => b.atom1 === oxygenId || b.atom2 === oxygenId);
            
            if (bond) {
                const carbonId = bond.atom1 === oxygenId ? bond.atom2 : bond.atom1;

                // Remove oxygen
                molecule.atoms = molecule.atoms.filter(a => a.id !== oxygenId);
                molecule.bonds = molecule.bonds.filter(b => !(b.atom1 === oxygenId || b.atom2 === oxygenId));

                // Create double bond with adjacent carbon
                const adjacentBonds = molecule.bonds.filter(b => 
                    (b.atom1 === carbonId || b.atom2 === carbonId) && b.order === 1
                );

                if (adjacentBonds.length > 0) {
                    const targetBond = adjacentBonds.find(b => {
                        const otherId = b.atom1 === carbonId ? b.atom2 : b.atom1;
                        const otherAtom = molecule.atoms.find(a => a.id === otherId);
                        return otherAtom && otherAtom.element === 'C';
                    });

                    if (targetBond) {
                        targetBond.order = 2;
                        console.log(`✓ Dehydrated alcohol to form alkene`);
                    }
                }
            }
        });
    }

    /**
     * Perform Aldol reaction (addition or condensation)
     */
    performAldolReaction(molecule, functionalGroups, reagents, conditions, reactionType) {
        const carbonyls = functionalGroups.carbonyls || [];
        if (carbonyls.length === 0) return;

        carbonyls.forEach(carbonylId => {
            const carbonyl = molecule.atoms.find(a => a.id === carbonylId);
            if (!carbonyl) return;

            const carbonylBonds = molecule.bonds.filter(b => 
                (b.atom1 === carbonylId || b.atom2 === carbonylId) && b.order === 1
            );

            carbonylBonds.forEach(bond => {
                const alphaId = bond.atom1 === carbonylId ? bond.atom2 : bond.atom1;
                const alphaAtom = molecule.atoms.find(a => a.id === alphaId);
                
                if (alphaAtom && alphaAtom.element === 'C') {
                    if (reactionType === 'aldol_condensation') {
                        // Dehydrate to form enone
                        this.createEnone(molecule, carbonylId, alphaId);
                    } else {
                        // Aldol addition - add OH to alpha carbon
                        const oxygen = this.addAtomNearby(molecule, alphaAtom, 'O', 25, 90);
                        if (typeof molecule.addBond === 'function') {
                            molecule.addBond(alphaId, oxygen.id, 1);
                        } else {
                            molecule.bonds.push({
                                id: `bond_${molecule.bonds.length}`,
                                atom1: alphaId,
                                atom2: oxygen.id,
                                order: 1
                            });
                        }
                    }
                    console.log('✓ Performed aldol reaction');
                }
            });
        });
    }

    /**
     * Perform Claisen condensation (Dieckmann for intramolecular)
     */
    performClaisenCondensation(molecule, functionalGroups, reagents) {
        const esters = this.findEsters(molecule);
        if (esters.length < 1) return;

        const firstEster = esters[0];
        if (firstEster.alphaCarbon) {
            // Create beta-keto ester - form new C-C bond between alpha carbons
            const alphaBonds = molecule.bonds.filter(b => 
                (b.atom1 === firstEster.alphaCarbon || b.atom2 === firstEster.alphaCarbon) && b.order === 1
            );
            
            // Find another alpha carbon to bond to
            alphaBonds.forEach(bond => {
                const otherId = bond.atom1 === firstEster.alphaCarbon ? bond.atom2 : bond.atom1;
                const otherAtom = molecule.atoms.find(a => a.id === otherId);
                if (otherAtom && otherAtom.element === 'C') {
                    // Create new bond
                    if (typeof molecule.addBond === 'function') {
                        molecule.addBond(firstEster.alphaCarbon, otherId, 1);
                    } else {
                        molecule.bonds.push({
                            id: `bond_${molecule.bonds.length}`,
                            atom1: firstEster.alphaCarbon,
                            atom2: otherId,
                            order: 1
                        });
                    }
                    console.log('✓ Performed Claisen condensation (Dieckmann)');
                }
            });
        }
    }

    /**
     * Perform Friedel-Crafts acylation
     */
    performFriedelCrafts(molecule, functionalGroups, reagents) {
        const aromaticRings = this.findAromaticRings(molecule);
        if (aromaticRings.length === 0) return;

        const carbonyls = functionalGroups.carbonyls || [];
        if (carbonyls.length === 0) return;

        const aromaticRing = aromaticRings[0];
        const carbonyl = molecule.atoms.find(a => a.id === carbonyls[0]);
        
        if (carbonyl && aromaticRing.length > 0) {
            const ringCarbon = molecule.atoms.find(a => a.id === aromaticRing[0]);
            if (ringCarbon) {
                if (typeof molecule.addBond === 'function') {
                    molecule.addBond(ringCarbon.id, carbonyl.id, 1);
                } else {
                    molecule.bonds.push({
                        id: `bond_${molecule.bonds.length}`,
                        atom1: ringCarbon.id,
                        atom2: carbonyl.id,
                        order: 1
                    });
                }
                console.log('✓ Performed Friedel-Crafts acylation');
            }
        }
    }

    /**
     * Perform retro-aldol reaction
     */
    performRetroAldol(molecule, functionalGroups) {
        const alcohols = functionalGroups.alcohols || [];
        const carbonyls = functionalGroups.carbonyls || [];

        alcohols.forEach(alcoholId => {
            const alcohol = molecule.atoms.find(a => a.id === alcoholId);
            if (!alcohol) return;

            const alcoholBond = molecule.bonds.find(b => 
                (b.atom1 === alcoholId || b.atom2 === alcoholId) && b.order === 1
            );
            if (!alcoholBond) return;

            const betaCarbonId = alcoholBond.atom1 === alcoholId ? alcoholBond.atom2 : alcoholBond.atom1;
            const betaCarbon = molecule.atoms.find(a => a.id === betaCarbonId);
            
            if (betaCarbon && betaCarbon.element === 'C') {
                // Remove OH
                molecule.atoms = molecule.atoms.filter(a => a.id !== alcoholId);
                molecule.bonds = molecule.bonds.filter(b => !(b.atom1 === alcoholId || b.atom2 === alcoholId));

                // Create double bond
                const adjacentBonds = molecule.bonds.filter(b => 
                    (b.atom1 === betaCarbonId || b.atom2 === betaCarbonId) && b.order === 1
                );
                if (adjacentBonds.length > 0) {
                    const targetBond = adjacentBonds[0];
                    targetBond.order = 2;
                    console.log('✓ Performed retro-aldol');
                }
            }
        });
    }

    /**
     * Perform Michael addition
     */
    performMichaelAddition(molecule, functionalGroups, reagents) {
        const carbonyls = functionalGroups.carbonyls || [];
        const alkenes = functionalGroups.alkenes || [];

        carbonyls.forEach(carbonylId => {
            const carbonyl = molecule.atoms.find(a => a.id === carbonylId);
            alkenes.forEach(alkene => {
                const carbonylBond = molecule.bonds.find(b => 
                    (b.atom1 === carbonylId || b.atom2 === carbonylId) && b.order === 1
                );
                
                if (carbonylBond) {
                    const alphaId = carbonylBond.atom1 === carbonylId ? carbonylBond.atom2 : carbonylBond.atom1;
                    if (alphaId === alkene.atom1 || alphaId === alkene.atom2) {
                        const betaId = alkene.atom1 === alphaId ? alkene.atom2 : alkene.atom1;
                        const betaAtom = molecule.atoms.find(a => a.id === betaId);
                        
                        if (betaAtom) {
                            const nucleophile = this.addAtomNearby(molecule, betaAtom, 'C', 30, 45);
                            if (typeof molecule.addBond === 'function') {
                                molecule.addBond(betaId, nucleophile.id, 1);
                            } else {
                                molecule.bonds.push({
                                    id: `bond_${molecule.bonds.length}`,
                                    atom1: betaId,
                                    atom2: nucleophile.id,
                                    order: 1
                                });
                            }
                            
                            const doubleBond = molecule.bonds.find(b => b.id === alkene.bondId);
                            if (doubleBond) doubleBond.order = 1;
                            
                            console.log('✓ Performed Michael addition');
                        }
                    }
                }
            });
        });
    }

    /**
     * Create enone from beta-hydroxy carbonyl
     */
    createEnone(molecule, carbonylId, alphaId) {
        const alphaBonds = molecule.bonds.filter(b => 
            (b.atom1 === alphaId || b.atom2 === alphaId) && b.order === 1
        );
        
        const ohBond = alphaBonds.find(b => {
            const otherId = b.atom1 === alphaId ? b.atom2 : b.atom1;
            const otherAtom = molecule.atoms.find(a => a.id === otherId);
            return otherAtom && otherAtom.element === 'O';
        });
        
        if (ohBond) {
            const oxygenId = ohBond.atom1 === alphaId ? ohBond.atom2 : ohBond.atom1;
            molecule.atoms = molecule.atoms.filter(a => a.id !== oxygenId);
            molecule.bonds = molecule.bonds.filter(b => !(b.atom1 === oxygenId || b.atom2 === oxygenId));
            
            const betaBond = alphaBonds.find(b => {
                const otherId = b.atom1 === alphaId ? b.atom2 : b.atom1;
                return otherId !== carbonylId && otherId !== oxygenId;
            });
            if (betaBond) betaBond.order = 2;
        }
    }

    /**
     * Find esters in molecule
     */
    findEsters(molecule) {
        const esters = [];
        const carbonyls = molecule.bonds.filter(b => b.order === 2);
        
        carbonyls.forEach(bond => {
            const atom1 = molecule.atoms.find(a => a.id === bond.atom1);
            const atom2 = molecule.atoms.find(a => a.id === bond.atom2);
            
            if ((atom1.element === 'C' && atom2.element === 'O') ||
                (atom1.element === 'O' && atom2.element === 'C')) {
                const carbonId = atom1.element === 'C' ? atom1.id : atom2.id;
                
                const carbonBonds = molecule.bonds.filter(b => 
                    (b.atom1 === carbonId || b.atom2 === carbonId) && b.order === 1
                );
                
                carbonBonds.forEach(cb => {
                    const otherId = cb.atom1 === carbonId ? cb.atom2 : cb.atom1;
                    const otherAtom = molecule.atoms.find(a => a.id === otherId);
                    if (otherAtom && otherAtom.element === 'O') {
                        esters.push({
                            carbonylCarbon: carbonId,
                            esterOxygen: otherId,
                            alphaCarbon: this.findAlphaCarbon(molecule, carbonId)
                        });
                    }
                });
            }
        });
        
        return esters;
    }

    /**
     * Find alpha carbon to carbonyl
     */
    findAlphaCarbon(molecule, carbonylId) {
        const bonds = molecule.bonds.filter(b => 
            (b.atom1 === carbonylId || b.atom2 === carbonylId) && b.order === 1
        );
        
        for (const bond of bonds) {
            const otherId = bond.atom1 === carbonylId ? bond.atom2 : bond.atom1;
            const otherAtom = molecule.atoms.find(a => a.id === otherId);
            if (otherAtom && otherAtom.element === 'C') {
                return otherId;
            }
        }
        return null;
    }

    /**
     * Find aromatic rings
     */
    findAromaticRings(molecule) {
        const rings = [];
        const visited = new Set();
        
        const findRing = (startId, currentId, path) => {
            if (path.length > 6) return;
            if (path.length === 6 && currentId === startId) {
                rings.push([...path]);
                return;
            }
            
            const bonds = molecule.bonds.filter(b => 
                (b.atom1 === currentId || b.atom2 === currentId)
            );
            
            bonds.forEach(bond => {
                const nextId = bond.atom1 === currentId ? bond.atom2 : bond.atom1;
                if (!path.includes(nextId)) {
                    findRing(startId, nextId, [...path, nextId]);
                }
            });
        };
        
        molecule.atoms.forEach(atom => {
            if (atom.element === 'C' && !visited.has(atom.id)) {
                findRing(atom.id, atom.id, [atom.id]);
                visited.add(atom.id);
            }
        });
        
        return rings;
    }

    /**
     * Apply layout to product molecule
     */
    layoutProduct(molecule) {
        if (!molecule || !molecule.atoms || molecule.atoms.length === 0) return;
        
        // Simple force-directed layout for new product
        const iterations = 30;
        const springLength = 50;
        
        for (let iter = 0; iter < iterations; iter++) {
            molecule.atoms.forEach(atom => {
                const atomX = atom.x !== undefined ? atom.x : (atom.position?.x || 0);
                const atomY = atom.y !== undefined ? atom.y : (atom.position?.y || 0);
                
                if (!atom.x && !atom.position) {
                    atom.x = 200 + Math.random() * 100;
                    atom.y = 200 + Math.random() * 100;
                } else if (!atom.x) {
                    atom.x = atomX;
                    atom.y = atomY;
                }
                
                let fx = 0, fy = 0;
                
                const bonds = molecule.bonds.filter(b => 
                    b.atom1 === atom.id || b.atom2 === atom.id
                );
                
                bonds.forEach(bond => {
                    const otherId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
                    const other = molecule.atoms.find(a => a.id === otherId);
                    if (other) {
                        const otherX = other.x !== undefined ? other.x : (other.position?.x || 0);
                        const otherY = other.y !== undefined ? other.y : (other.position?.y || 0);
                        const dx = otherX - atom.x;
                        const dy = otherY - atom.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        const force = (dist - springLength) * 0.1;
                        fx += (dx / dist) * force;
                        fy += (dy / dist) * force;
                    }
                });
                
                molecule.atoms.forEach(other => {
                    if (other.id !== atom.id) {
                        const otherX = other.x !== undefined ? other.x : (other.position?.x || 0);
                        const otherY = other.y !== undefined ? other.y : (other.position?.y || 0);
                        const dx = otherX - atom.x;
                        const dy = otherY - atom.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        if (dist > 0) {
                            const force = 500 / (dist * dist);
                            fx -= (dx / dist) * force;
                            fy -= (dy / dist) * force;
                        }
                    }
                });
                
                atom.x += fx * 0.1;
                atom.y += fy * 0.1;
            });
        }
    }

    /**
     * Helper: Add atom near existing atom (works with both x/y and position.x/y)
     */
    addAtomNearby(molecule, nearAtom, element, distance, angleOffset) {
        const angle = (angleOffset * Math.PI) / 180;
        const nearX = nearAtom.x !== undefined ? nearAtom.x : (nearAtom.position?.x || 0);
        const nearY = nearAtom.y !== undefined ? nearAtom.y : (nearAtom.position?.y || 0);
        
        const newX = nearX + distance * Math.cos(angle);
        const newY = nearY + distance * Math.sin(angle);
        
        // Use Molecule.addAtom if available
        if (typeof molecule.addAtom === 'function') {
            return molecule.addAtom(element, newX, newY);
        }
        
        // Fallback: create atom object
        const newAtom = {
            id: molecule.atoms.length,
            element: element,
            x: newX,
            y: newY,
            charge: 0
        };
        molecule.atoms.push(newAtom);
        return newAtom;
    }

    /**
     * Clone molecule properly - creates new Molecule instance with new coordinates
     */
    cloneMolecule(molecule) {
        if (!molecule || !molecule.atoms) {
            return null;
        }

        // Create proper Molecule instance if available
        if (typeof Molecule !== 'undefined') {
            const cloned = new Molecule();
            
            // Create ID mapping for atoms
            const idMap = new Map();
            
            // Add atoms with new coordinates (offset slightly to show difference)
            molecule.atoms.forEach((atom, index) => {
                const x = (atom.x !== undefined ? atom.x : (atom.position?.x || 0)) + (index % 2 === 0 ? 5 : -5);
                const y = (atom.y !== undefined ? atom.y : (atom.position?.y || 0)) + (index % 2 === 0 ? 5 : -5);
                const newAtom = cloned.addAtom(atom.element, x, y);
                idMap.set(atom.id, newAtom.id);
                
                // Copy other properties
                if (atom.charge !== undefined) newAtom.charge = atom.charge;
                if (atom.hybridization) newAtom.hybridization = atom.hybridization;
            });
            
            // Add bonds with mapped IDs
            molecule.bonds.forEach(bond => {
                const newId1 = idMap.get(bond.atom1);
                const newId2 = idMap.get(bond.atom2);
                if (newId1 !== undefined && newId2 !== undefined) {
                    cloned.addBond(newId1, newId2, bond.order || 1);
                }
            });
            
            return cloned;
        }
        
        // Fallback: deep clone with new references
        return {
            atoms: molecule.atoms.map(a => ({
                ...a,
                x: (a.x !== undefined ? a.x : (a.position?.x || 0)) + 10,
                y: (a.y !== undefined ? a.y : (a.position?.y || 0)) + 10
            })),
            bonds: molecule.bonds.map(b => ({ ...b }))
        };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChemicalReactionEngine;
}
