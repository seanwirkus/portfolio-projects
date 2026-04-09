from chem.core import Atom, Bond, Molecule
from chem.io.sdf import parse_sdf, to_sdf


def test_sdf_round_trip():
    molecule = Molecule()
    c1 = molecule.add_atom(Atom(symbol="C", coords=(0.0, 0.0, 0.0)))
    c2 = molecule.add_atom(Atom(symbol="C", coords=(1.0, 0.0, 0.0)))
    o = molecule.add_atom(Atom(symbol="O", coords=(2.0, 0.0, 0.0)))
    molecule.add_bond(Bond((c1, c2), order=1.0))
    molecule.add_bond(Bond((c2, o), order=1.0))

    sdf_text = to_sdf(molecule, name="ethanol")
    parsed = parse_sdf(sdf_text)
    assert len(parsed) == 1
    parsed_mol = parsed[0]
    assert len(parsed_mol.atoms) == 3
    assert len(parsed_mol.bonds) == 2
    assert parsed_mol.atoms[0].symbol == "C"
    assert parsed_mol.atoms[-1].symbol == "O"
