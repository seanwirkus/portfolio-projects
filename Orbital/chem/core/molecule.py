"""Molecule container with convenience helpers."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional

from .atom import Atom
from .bond import Bond


@dataclass
class Molecule:
    """Represents a molecular graph."""

    atoms: List[Atom] = field(default_factory=list)
    bonds: List[Bond] = field(default_factory=list)
    metadata: Dict[str, object] = field(default_factory=dict)

    def add_atom(self, atom: Atom) -> int:
        self.atoms.append(atom)
        return len(self.atoms) - 1

    def add_bond(self, bond: Bond) -> int:
        self.bonds.append(bond)
        return len(self.bonds) - 1

    def neighbors(self, atom_index: int) -> Iterable[int]:
        for bond in self.bonds:
            if atom_index in bond.atoms:
                yield bond.other(atom_index)

    def bonds_for_atom(self, atom_index: int) -> Iterable[Bond]:
        for bond in self.bonds:
            if atom_index in bond.atoms:
                yield bond

    def get_bond(self, a: int, b: int) -> Optional[Bond]:
        for bond in self.bonds:
            if set(bond.atoms) == {a, b}:
                return bond
        return None

    def copy(self) -> "Molecule":
        return Molecule(list(self.atoms), list(self.bonds), dict(self.metadata))
