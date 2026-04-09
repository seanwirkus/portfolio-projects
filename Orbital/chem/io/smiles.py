"""Minimal SMILES parser and writer supporting acyclic molecules and simple rings."""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from ..core import Atom, Bond, Molecule


_BOND_SYMBOLS: Dict[float, str] = {
    1.0: "",
    2.0: "=",
    3.0: "#",
    1.5: "",
}

_SYMBOL_TO_ORDER = {"-": 1.0, "=": 2.0, "#": 3.0, ":": 1.5}


def _parse_element(smiles: str, index: int) -> Tuple[str, int, bool]:
    char = smiles[index]
    aromatic = char.islower()
    if char.isalpha():
        symbol = char.upper() if aromatic else char
        index += 1
        if index < len(smiles) and smiles[index].islower() and not aromatic:
            symbol += smiles[index]
            index += 1
        return symbol, index, aromatic
    raise ValueError(f"Unexpected token '{char}' in SMILES '{smiles}'")


def parse_smiles(smiles: str) -> Molecule:
    """Parse a subset of SMILES into a :class:`~chem.core.Molecule`."""

    molecule = Molecule()
    atom_stack: List[int] = []
    ring_closures: Dict[str, Tuple[int, float, bool]] = {}
    prev_atom: Optional[int] = None
    bond_order = 1.0
    aromatic_bond = False

    index = 0
    while index < len(smiles):
        char = smiles[index]
        if char in "-=#:":
            bond_order = _SYMBOL_TO_ORDER[char]
            aromatic_bond = char == ":"
            index += 1
            continue
        if char == "(":
            if prev_atom is None:
                raise ValueError("Branch without previous atom")
            atom_stack.append(prev_atom)
            index += 1
            continue
        if char == ")":
            if not atom_stack:
                raise ValueError("Unbalanced parentheses in SMILES")
            prev_atom = atom_stack.pop()
            index += 1
            continue
        if char.isdigit():
            if prev_atom is None:
                raise ValueError("Ring digit without previous atom")
            digit = char
            closure = ring_closures.pop(digit, None)
            if closure is None:
                aromatic_prev = bool(
                    molecule.atoms[prev_atom].metadata.get("aromatic")
                ) if molecule.atoms else False
                ring_closures[digit] = (prev_atom, bond_order, aromatic_bond or aromatic_prev)
            else:
                other_atom, order, aromatic = closure
                molecule.add_bond(
                    Bond(
                        (other_atom, prev_atom),
                        order=order,
                        aromatic=aromatic or aromatic_bond or bool(
                            molecule.atoms[prev_atom].metadata.get("aromatic")
                        ),
                    )
                )
            index += 1
            bond_order = 1.0
            aromatic_bond = False
            continue
        symbol, index, aromatic_atom = _parse_element(smiles, index)
        metadata = {"aromatic": True} if aromatic_atom else {}
        atom = Atom(symbol=symbol, metadata=metadata)
        atom_index = molecule.add_atom(atom)
        if prev_atom is not None:
            molecule.add_bond(
                Bond(
                    (prev_atom, atom_index),
                    order=bond_order if not aromatic_atom else 1.5 if bond_order == 1.0 else bond_order,
                    aromatic=aromatic_bond or aromatic_atom,
                )
            )
        prev_atom = atom_index
        bond_order = 1.0
        aromatic_bond = False

    if ring_closures:
        raise ValueError("Unclosed rings in SMILES")

    return molecule


def _atom_to_smiles(atom: Atom) -> str:
    aromatic = bool(atom.metadata.get("aromatic")) if atom.metadata else False
    symbol = atom.symbol
    return symbol.lower() if aromatic else symbol


def to_smiles(molecule: Molecule) -> str:
    """Export a :class:`~chem.core.Molecule` to a simple SMILES string."""

    if not molecule.atoms:
        return ""

    adjacency: Dict[int, List[Tuple[int, Bond]]] = {i: [] for i in range(len(molecule.atoms))}
    for bond in molecule.bonds:
        a, b = bond.atoms
        adjacency[a].append((b, bond))
        adjacency[b].append((a, bond))

    visited_atoms: set[int] = set()
    visited_bonds: set[int] = set()
    ring_ids: Dict[Tuple[int, int], int] = {}

    bond_index_lookup = {id(bond): idx for idx, bond in enumerate(molecule.bonds)}

    def traverse(atom_index: int, parent: Optional[int]) -> str:
        visited_atoms.add(atom_index)
        symbol = _atom_to_smiles(molecule.atoms[atom_index])
        pieces = [symbol]
        neighbors = adjacency[atom_index]
        branches: List[str] = []
        for neighbor, bond in neighbors:
            bond_id = bond_index_lookup[id(bond)]
            if bond_id in visited_bonds:
                if parent is not None and neighbor == parent:
                    continue
            bond_symbol = _BOND_SYMBOLS.get(bond.order, "")
            if bond.aromatic and bond.order == 1.0:
                bond_symbol = ""
            if neighbor in visited_atoms:
                key = tuple(sorted((atom_index, neighbor)))
                if key in ring_ids:
                    continue
                ring_ids[key] = len(ring_ids) + 1
                pieces.append(f"{bond_symbol}{ring_ids[key]}")
                visited_bonds.add(bond_id)
                continue
            visited_bonds.add(bond_id)
            branch_smiles = traverse(neighbor, atom_index)
            branch_text = f"{bond_symbol}{branch_smiles}" if bond_symbol else branch_smiles
            branches.append(branch_text)
        if branches:
            first = branches[0]
            pieces.append(first)
            for branch in branches[1:]:
                pieces.append(f"({branch})")
        return "".join(pieces)

    return traverse(0, None)
