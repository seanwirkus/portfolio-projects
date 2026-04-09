"""Simple SDF parser and writer (V2000 subset)."""
from __future__ import annotations

from typing import List

from ..core import Atom, Bond, Molecule


def parse_sdf(text: str) -> List[Molecule]:
    """Parse one or more molecules from an SDF string."""

    molecules: List[Molecule] = []
    for block in text.strip().split("$$$$"):
        block = block.strip()
        if not block:
            continue
        lines = block.splitlines()
        if len(lines) < 4:
            raise ValueError("SDF block too short")
        counts = lines[3]
        atom_count = int(counts[0:3])
        bond_count = int(counts[3:6])
        atoms_section = lines[4 : 4 + atom_count]
        bonds_section = lines[4 + atom_count : 4 + atom_count + bond_count]
        molecule = Molecule()
        for atom_line in atoms_section:
            x = float(atom_line[0:10])
            y = float(atom_line[10:20])
            z = float(atom_line[20:30])
            symbol = atom_line[31:34].strip()
            charge_code_str = atom_line[36:39].strip()
            charge_code = int(charge_code_str) if charge_code_str else 0
            charge_lookup = {0: 0, 1: 3, 2: 2, 3: 1, 4: 0, 5: -1, 6: -2, 7: -3}
            charge = charge_lookup.get(charge_code, 0)
            molecule.add_atom(Atom(symbol=symbol, coords=(x, y, z), charge=charge))
        for bond_line in bonds_section:
            a = int(bond_line[0:3]) - 1
            b = int(bond_line[3:6]) - 1
            order_code = int(bond_line[6:9])
            order = 1.0
            aromatic = False
            if order_code == 1:
                order = 1.0
            elif order_code == 2:
                order = 2.0
            elif order_code == 3:
                order = 3.0
            elif order_code == 4:
                order = 1.5
                aromatic = True
            molecule.add_bond(Bond((a, b), order=order, aromatic=aromatic))
        molecules.append(molecule)
    return molecules


def to_sdf(molecule: Molecule, name: str = "Molecule") -> str:
    """Export a :class:`~chem.core.Molecule` to an SDF block."""

    lines: List[str] = [name, "Orbital Toolkit", "", f"{len(molecule.atoms):>3}{len(molecule.bonds):>3}  0  0  0  0  0  0  0  0  0  0"]
    for atom in molecule.atoms:
        x, y, z = atom.coords
        charge = atom.charge
        charge_lookup = {3: 1, 2: 2, 1: 3, 0: 0, -1: 5, -2: 6, -3: 7}
        charge_code = charge_lookup.get(charge, 0)
        lines.append(f"{x:>10.4f}{y:>10.4f}{z:>10.4f} {atom.symbol:<3} 0  {charge_code:>2}  0  0  0  0")
    for bond in molecule.bonds:
        a, b = bond.atoms
        order_lookup = {1.0: 1, 2.0: 2, 3.0: 3, 1.5: 4}
        order_code = order_lookup.get(bond.order, 1)
        lines.append(f"{a+1:>3}{b+1:>3}{order_code:>3}  0  0  0  0")
    lines.append("M  END")
    lines.append("$$$$")
    return "\n".join(lines) + "\n"
