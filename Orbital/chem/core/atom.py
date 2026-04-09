"""Core Atom data structure for chemistry toolkit."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

Coordinate = Tuple[float, float, float]


@dataclass(eq=True)
class Atom:
    """Represents an atom with coordinates and metadata.

    Attributes
    ----------
    symbol:
        Chemical symbol of the element (e.g. ``"C"``).
    coords:
        3D coordinates in Angstroms.
    charge:
        Formal charge.
    isotope:
        Optional isotope mass number.
    stereochemistry:
        Optional stereochemistry descriptor (e.g. ``"R"``, ``"S"``).
    metadata:
        Arbitrary metadata preserved during IO round-trips.
    """

    symbol: str
    coords: Coordinate = (0.0, 0.0, 0.0)
    charge: int = 0
    isotope: Optional[int] = None
    stereochemistry: Optional[str] = None
    metadata: Dict[str, object] = field(default_factory=dict)

    def copy(self, **updates: object) -> "Atom":
        """Return a copy of the atom with optional updates."""

        data = self.__dict__.copy()
        data["metadata"] = dict(data.get("metadata", {}))
        data.update(updates)
        return Atom(**data)  # type: ignore[arg-type]
