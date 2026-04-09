"""Reaction container representing a chemical transformation."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from .molecule import Molecule


@dataclass
class Reaction:
    """Stores reactant and product molecules with optional metadata."""

    reactants: List[Molecule] = field(default_factory=list)
    products: List[Molecule] = field(default_factory=list)
    metadata: Dict[str, object] = field(default_factory=dict)

    def add_reactant(self, molecule: Molecule) -> None:
        self.reactants.append(molecule)

    def add_product(self, molecule: Molecule) -> None:
        self.products.append(molecule)
