"""Validation utilities for molecules."""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Set, Tuple

from ..core import Molecule

_DEFAULT_VALENCE: Dict[str, int] = {
    "H": 1,
    "B": 3,
    "C": 4,
    "N": 3,
    "O": 2,
    "F": 1,
    "P": 5,
    "S": 6,
    "Cl": 1,
    "Br": 1,
    "I": 1,
}


def validate_valence(molecule: Molecule) -> None:
    """Raise :class:`ValueError` if any atom exceeds its default valence."""

    for index, atom in enumerate(molecule.atoms):
        allowed = _DEFAULT_VALENCE.get(atom.symbol)
        if allowed is None:
            continue
        total = 0.0
        for bond in molecule.bonds_for_atom(index):
            total += bond.order
        total = round(total)
        if total > allowed + abs(atom.charge):
            raise ValueError(f"Atom {index} ({atom.symbol}) exceeds valence: {total} > {allowed}")


def validate_charge_balance(molecule: Molecule) -> None:
    """Ensure the molecule has balanced (zero) formal charge."""

    total_charge = sum(atom.charge for atom in molecule.atoms)
    if total_charge != 0:
        raise ValueError(f"Molecule not charge balanced: total charge {total_charge}")


def _canonicalize_cycle(cycle: List[int]) -> Tuple[int, ...]:
    """Return a canonical representation of a cycle regardless of start or direction."""

    if not cycle:
        return tuple()

    # Generate all rotations of the cycle in both forward and reverse directions.
    rotations = []
    n = len(cycle)
    for i in range(n):
        rotations.append(tuple(cycle[i:] + cycle[:i]))

    reversed_cycle = list(reversed(cycle))
    for i in range(n):
        rotations.append(tuple(reversed_cycle[i:] + reversed_cycle[:i]))

    return min(rotations)


def _find_cycles(molecule: Molecule, max_length: int | None = None) -> List[List[int]]:
    adjacency: Dict[int, List[Tuple[int, int]]] = defaultdict(list)
    for idx, bond in enumerate(molecule.bonds):
        a, b = bond.atoms
        adjacency[a].append((b, idx))
        adjacency[b].append((a, idx))

    cycles: Set[Tuple[int, ...]] = set()

    max_allowed = max_length or len(molecule.atoms)

    def dfs(start: int, current: int, path: List[int], used_bonds: Set[int]) -> None:
        for neighbor, bond_idx in adjacency[current]:
            if bond_idx in used_bonds:
                continue
            if neighbor == start and len(path) >= 3:
                canonical = _canonicalize_cycle(path)
                if canonical:
                    cycles.add(canonical)
                continue
            if neighbor in path:
                continue
            if len(path) >= max_allowed:
                continue
            dfs(start, neighbor, path + [neighbor], used_bonds | {bond_idx})

    for atom_index in range(len(molecule.atoms)):
        dfs(atom_index, atom_index, [atom_index], set())

    return [list(cycle) for cycle in cycles]


def detect_aromatic_rings(molecule: Molecule) -> List[List[int]]:
    """Return cycles composed entirely of aromatic bonds."""

    cycles = _find_cycles(molecule)
    aromatic_cycles: List[List[int]] = []
    for cycle in cycles:
        is_aromatic = True
        for i in range(len(cycle)):
            a = cycle[i]
            b = cycle[(i + 1) % len(cycle)]
            bond = molecule.get_bond(a, b)
            if bond is None:
                is_aromatic = False
                break
            if not (bond.aromatic or abs(bond.order - 1.5) < 1e-6 or bond.order == 2.0):
                is_aromatic = False
                break
        if is_aromatic:
            aromatic_cycles.append(cycle)
            for idx in cycle:
                atom = molecule.atoms[idx]
                if not atom.metadata.get("aromatic"):
                    atom.metadata["aromatic"] = True
    return aromatic_cycles
