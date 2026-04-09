from chem.io.smiles import parse_smiles, to_smiles
from chem.validators import detect_aromatic_rings


def test_smiles_round_trip_linear():
    smiles = "CCO"
    molecule = parse_smiles(smiles)
    exported = to_smiles(molecule)
    assert exported == smiles
    reparsed = parse_smiles(exported)
    assert len(reparsed.atoms) == len(molecule.atoms)
    assert len(reparsed.bonds) == len(molecule.bonds)


def test_smiles_aromatic_ring_detection():
    smiles = "c1ccccc1"
    molecule = parse_smiles(smiles)
    rings = detect_aromatic_rings(molecule)
    assert rings
    exported = to_smiles(molecule)
    assert exported.startswith("c")
