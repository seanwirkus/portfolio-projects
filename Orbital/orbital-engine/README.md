# Orbital Chemistry Engine

A comprehensive JavaScript framework for molecular visualization, reaction simulation, and chemical intelligence.

## Structure

- **core/**: Core chemistry engine classes
  - `molecule.js` - Molecular graph data structure
  - `elements.js` - Element properties database
  - `chemistry-intelligence.js` - Valence, hybridization, aromaticity calculations
  - `geometry.js` - Molecular geometry generation utilities
  - `smart-drawing.js` - Intelligent atom placement and bond prediction
  - `renderer.js` - Canvas-based molecular visualization

- **services/**: External service integrations
  - `pubchem-service.js` - PubChem API integration for compound lookup

- **utils/**: Utility classes and helpers
  - `undo-redo.js` - Undo/redo state management
  - `selection.js` - Atom/bond selection system
  - `clipboard.js` - Copy/paste functionality
  - `keyboard-shortcuts.js` - Keyboard command handling
  - `smart-chain-tool.js` - Chain drawing tool

## Usage

```javascript
// Import core classes
import { Molecule } from './core/molecule.js';
import { Renderer } from './core/renderer.js';
import { PubChemService } from './services/pubchem-service.js';

// Create molecule
const molecule = new Molecule();
const atom = molecule.addAtom('C', 100, 100);

// Render
const canvas = document.getElementById('canvas');
const renderer = new Renderer(canvas);
renderer.render(molecule);

// Use PubChem
const pubchem = new PubChemService();
const results = await pubchem.searchCompounds('aspirin');
```

## License

MIT License - See LICENSE file in parent directory

