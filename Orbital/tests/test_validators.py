import pytest

from chem.core import Atom, Bond, Molecule
from chem.validators import detect_aromatic_rings, validate_charge_balance, validate_valence


def build_methane() -> Molecule:
    molecule = Molecule()
    carbon = molecule.add_atom(Atom(symbol="C"))
    hydrogens = [molecule.add_atom(Atom(symbol="H")) for _ in range(4)]
    for hydrogen in hydrogens:
        molecule.add_bond(Bond((carbon, hydrogen)))
    return molecule


def test_validate_valence_ok():
    molecule = build_methane()
    validate_valence(molecule)


def test_validate_valence_failure():
    molecule = Molecule()
    carbon = molecule.add_atom(Atom(symbol="C"))
    hydrogens = [molecule.add_atom(Atom(symbol="H")) for _ in range(5)]
    for hydrogen in hydrogens:
        molecule.add_bond(Bond((carbon, hydrogen)))
    with pytest.raises(ValueError):
        validate_valence(molecule)


def test_charge_balance():
    water = Molecule()
    o = water.add_atom(Atom(symbol="O", charge=-2))
    h1 = water.add_atom(Atom(symbol="H", charge=1))
    h2 = water.add_atom(Atom(symbol="H", charge=1))
    water.add_bond(Bond((o, h1)))
    water.add_bond(Bond((o, h2)))
    validate_charge_balance(water)

    water.atoms[0].charge = -1
    with pytest.raises(ValueError):
        validate_charge_balance(water)


def test_aromatic_detection_from_structure():
    benzene = Molecule()
    atoms = [benzene.add_atom(Atom(symbol="C")) for _ in range(6)]
    bonds = [
        Bond((atoms[i], atoms[(i + 1) % 6]), order=1.5, aromatic=True)
        for i in range(6)
    ]
    for bond in bonds:
        benzene.add_bond(bond)
    rings = detect_aromatic_rings(benzene)
    assert len(rings) == 1
    assert len(rings[0]) == 6


def test_aromatic_detection_large_ring():
    macrocycle = Molecule()
    atoms = [macrocycle.add_atom(Atom(symbol="C")) for _ in range(10)]

    for i in range(10):
        a = atoms[i]
        b = atoms[(i + 1) % 10]
        macrocycle.add_bond(Bond((a, b), order=1.5, aromatic=False))

    rings = detect_aromatic_rings(macrocycle)

    assert rings == [list(range(10))]
    assert all(atom.metadata.get("aromatic") for atom in macrocycle.atoms)
