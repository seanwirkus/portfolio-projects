// Molecule Model — Immutable chemical graph with centralized validation
(function() {
'use strict';

class Atom {
    constructor(id, element, x, y, options = {}) {
        this.id = id;
        this.element = element;
        this.position = { x, y };
        this.charge = options.charge || 0;
        this.radicals = options.radicals || 0;
        this.isotope = options.isotope || null;
        this.stereo = options.stereo || null;
        this.hybridization = options.hybridization || null;
        this.bonds = [];
    }

    clone() {
        return new Atom(
            this.id,
            this.element,
            this.position.x,
            this.position.y,
            {
                charge: this.charge,
                radicals: this.radicals,
                isotope: this.isotope,
                stereo: this.stereo,
                hybridization: this.hybridization
            }
        );
    }

    move(x, y) {
        const cloned = this.clone();
        cloned.position = { x, y };
        return cloned;
    }
}

class Bond {
    constructor(id, atom1Id, atom2Id, order, options = {}) {
        this.id = id;
        this.atom1 = atom1Id;
        this.atom2 = atom2Id;
        this.order = Math.max(1, Math.min(3, order));
        this.stereo = options.stereo || null;
        this.type = options.type || 'covalent';
    }

    clone() {
        return new Bond(
            this.id,
            this.atom1,
            this.atom2,
            this.order,
            {
                stereo: this.stereo,
                type: this.type
            }
        );
    }

    changeOrder(newOrder) {
        const cloned = this.clone();
        cloned.order = Math.max(1, Math.min(3, newOrder));
        return cloned;
    }
}

class Molecule {
    constructor(options = {}) {
        this.atoms = new Map();
        this.bonds = new Map();
        this.nextAtomId = 0;
        this.nextBondId = 0;
        this.metadata = {
            name: '',
            formula: '',
            molecularWeight: 0
        };
        this.chemistryIntelligence = options.chemistryIntelligence ||
            (typeof ChemistryIntelligence !== 'undefined' ? new ChemistryIntelligence() : null);
    }

    setChemistryIntelligence(instance) {
        this.chemistryIntelligence = instance;
        return this;
    }

    addAtom(element, x, y, options = {}) {
        const cloned = this.clone();
        const id = `atom_${cloned.nextAtomId++}`;
        const atom = new Atom(id, element, x, y, options);
        cloned.atoms.set(id, atom);
        cloned.updateMetadata();
        return { molecule: cloned, atom };
    }

    removeAtom(atomId) {
        const cloned = this.clone();
        cloned.atoms.delete(atomId);
        const bondsToRemove = [];
        cloned.bonds.forEach((bond, bondId) => {
            if (bond.atom1 === atomId || bond.atom2 === atomId) {
                bondsToRemove.push(bondId);
            }
        });
        bondsToRemove.forEach(bondId => cloned.bonds.delete(bondId));
        const removedBondSet = new Set(bondsToRemove);
        cloned.atoms.forEach(atom => {
            atom.bonds = atom.bonds.filter(bondId => !removedBondSet.has(bondId));
        });
        cloned.updateMetadata();
        return cloned;
    }

    addBond(atom1Id, atom2Id, order = 1, options = {}) {
        for (const bond of this.bonds.values()) {
            if ((bond.atom1 === atom1Id && bond.atom2 === atom2Id) ||
                (bond.atom1 === atom2Id && bond.atom2 === atom1Id)) {
                const cloned = this.clone();
                const existingBond = cloned.bonds.get(bond.id);
                const increase = order - (existingBond.order || 1);
                if (increase > 0 && !this.canIncreaseBondOrder(cloned, existingBond, increase)) {
                    return { molecule: this, bond: existingBond };
                }
                cloned.bonds.set(bond.id, existingBond.changeOrder(order));
                cloned.updateMetadata();
                return { molecule: cloned, bond: cloned.bonds.get(bond.id) };
            }
        }

        const cloned = this.clone();
        const atom1 = cloned.atoms.get(atom1Id);
        const atom2 = cloned.atoms.get(atom2Id);
        if (!atom1 || !atom2) return { molecule: this, bond: null };

        if (!this.canAddBond(atom1, order, cloned) || !this.canAddBond(atom2, order, cloned)) {
            console.warn('Valence exceeded when creating bond');
            return { molecule: this, bond: null };
        }

        const id = `bond_${cloned.nextBondId++}`;
        const bond = new Bond(id, atom1Id, atom2Id, order, options);
        cloned.bonds.set(id, bond);
        atom1.bonds.push(id);
        atom2.bonds.push(id);
        cloned.updateMetadata();
        return { molecule: cloned, bond };
    }

    removeBond(bondId) {
        const cloned = this.clone();
        const bond = cloned.bonds.get(bondId);
        if (!bond) return cloned;
        cloned.bonds.delete(bondId);
        const atom1 = cloned.atoms.get(bond.atom1);
        const atom2 = cloned.atoms.get(bond.atom2);
        if (atom1) atom1.bonds = atom1.bonds.filter(id => id !== bondId);
        if (atom2) atom2.bonds = atom2.bonds.filter(id => id !== bondId);
        cloned.updateMetadata();
        return cloned;
    }

    getAtom(id) {
        return this.atoms.get(id);
    }

    getBond(id) {
        return this.bonds.get(id);
    }

    getAtomBonds(atomId) {
        const atom = this.atoms.get(atomId);
        if (!atom) return [];
        return atom.bonds.map(id => this.bonds.get(id)).filter(Boolean);
    }

    getAtomBondOrder(atomId) {
        return this.getAtomBonds(atomId).reduce((sum, bond) => sum + (bond.order || 1), 0);
    }

    changeBondOrder(bondId, newOrder) {
        const cloned = this.clone();
        const bond = cloned.bonds.get(bondId);
        if (!bond) return cloned;
        const increase = newOrder - (bond.order || 1);
        if (increase > 0 && !this.canIncreaseBondOrder(cloned, bond, increase)) {
            return cloned;
        }
        cloned.bonds.set(bondId, bond.changeOrder(newOrder));
        cloned.updateMetadata();
        return cloned;
    }

    canAddBond(atom, order = 1, molecule = this) {
        if (!this.chemistryIntelligence || !atom) return true;
        return this.chemistryIntelligence.canAddBond(molecule, atom, order);
    }

    canIncreaseBondOrder(molecule, bond, orderIncrease) {
        if (!this.chemistryIntelligence) return true;
        const atom1 = molecule.atoms.get(bond.atom1);
        const atom2 = molecule.atoms.get(bond.atom2);
        if (!atom1 || !atom2) return false;
        return this.canAddBond(atom1, orderIncrease, molecule) &&
            this.canAddBond(atom2, orderIncrease, molecule);
    }

    clone() {
        const cloned = new Molecule({ chemistryIntelligence: this.chemistryIntelligence });
        cloned.nextAtomId = this.nextAtomId;
        cloned.nextBondId = this.nextBondId;
        this.atoms.forEach((atom, id) => {
            cloned.atoms.set(id, atom.clone());
        });
        this.bonds.forEach((bond, id) => {
            cloned.bonds.set(id, bond.clone());
        });
        cloned.metadata = { ...this.metadata };
        return cloned;
    }

    updateMetadata() {
        const elementCounts = {};
        this.atoms.forEach(atom => {
            elementCounts[atom.element] = (elementCounts[atom.element] || 0) + 1;
        });

        const order = ['C', 'H'];
        const sorted = Object.keys(elementCounts).sort((a, b) => {
            const aIdx = order.indexOf(a);
            const bIdx = order.indexOf(b);
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
            if (aIdx !== -1) return -1;
            if (bIdx !== -1) return 1;
            return a.localeCompare(b);
        });

        this.metadata.formula = sorted.map(el => {
            const count = elementCounts[el];
            return count > 1 ? `${el}${count}` : el;
        }).join('');

        let weight = 0;
        this.atoms.forEach(atom => {
            const element = getElement(atom.element);
            if (element) weight += element.atomicMass || 0;
        });
        this.metadata.molecularWeight = weight;
    }

    toArray() {
        return {
            atoms: Array.from(this.atoms.values()),
            bonds: Array.from(this.bonds.values())
        };
    }

    static fromArray(data, options = {}) {
        const mol = new Molecule(options);
        if (data.atoms) {
            data.atoms.forEach(atomData => {
                const x = atomData.position?.x ?? atomData.x ?? 0;
                const y = atomData.position?.y ?? atomData.y ?? 0;
                const atom = new Atom(
                    atomData.id,
                    atomData.element,
                    x,
                    y,
                    {
                        charge: atomData.charge,
                        radicals: atomData.radicals,
                        isotope: atomData.isotope,
                        stereo: atomData.stereo,
                        hybridization: atomData.hybridization
                    }
                );
                mol.atoms.set(atom.id, atom);
                const numeric = parseInt(atom.id.split('_')[1] || '0', 10);
                if (!Number.isNaN(numeric)) {
                    mol.nextAtomId = Math.max(mol.nextAtomId, numeric + 1);
                }
            });
        }
        if (data.bonds) {
            data.bonds.forEach(bondData => {
                const bond = new Bond(
                    bondData.id,
                    bondData.atom1,
                    bondData.atom2,
                    bondData.order || 1,
                    {
                        stereo: bondData.stereo,
                        type: bondData.type
                    }
                );
                mol.bonds.set(bond.id, bond);
                mol.atoms.get(bond.atom1)?.bonds.push(bond.id);
                mol.atoms.get(bond.atom2)?.bonds.push(bond.id);
                const numeric = parseInt(bond.id.split('_')[1] || '0', 10);
                if (!Number.isNaN(numeric)) {
                    mol.nextBondId = Math.max(mol.nextBondId, numeric + 1);
                }
            });
        }
        mol.updateMetadata();
        return mol;
    }
}

window.Molecule = Molecule;
window.Atom = Atom;
window.Bond = Bond;
})();
