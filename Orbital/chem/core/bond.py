"""Bond data structure for chemistry toolkit."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple


@dataclass(eq=True, frozen=True)
class Bond:
    """Represents a bond connecting two atom indices."""

    atoms: Tuple[int, int]
    order: float = 1.0
    stereochemistry: Optional[str] = None
    aromatic: bool = False
    metadata: Dict[str, object] = field(default_factory=dict)

    def other(self, atom_index: int) -> int:
        """Return the index of the atom on the opposite side of the bond."""

        a, b = self.atoms
        if atom_index == a:
            return b
        if atom_index == b:
            return a
        raise ValueError(f"Atom {atom_index} not part of bond {self.atoms}")
