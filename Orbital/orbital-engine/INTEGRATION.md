# Orbital Engine Integration Guide

## Quick Start

To integrate the Orbital Engine into your application:

### 1. Include Required Scripts

```html
<!-- Core Engine -->
<script src="orbital-engine/core/elements.js"></script>
<script src="src/js/core/Molecule.js"></script>
<script src="orbital-engine/core/chemistry-intelligence.js"></script>
<script src="orbital-engine/core/geometry.js"></script>
<script src="orbital-engine/core/smart-drawing.js"></script>
<script src="orbital-engine/core/enhanced-atom-drawing.js"></script>
<script src="orbital-engine/core/renderer.js"></script>

<!-- Services -->
<script src="orbital-engine/services/pubchem-service.js"></script>
<script src="orbital-engine/services/atom-enrichment-service.js"></script>

<!-- Utils -->
<script src="orbital-engine/utils/undo-redo.js"></script>
<script src="orbital-engine/utils/selection.js"></script>
<script src="orbital-engine/utils/clipboard.js"></script>
<script src="orbital-engine/utils/keyboard-shortcuts.js"></script>
<script src="orbital-engine/utils/smart-chain-tool.js"></script>
```

### 2. Initialize Enhanced Atom Drawing

```javascript
// Initialize services
const pubchemService = new PubChemService();
const chemistryIntelligence = new ChemistryIntelligence();
const enrichmentService = new AtomEnrichmentService(pubchemService, chemistryIntelligence);

// Create molecule
const molecule = new Molecule();

// Initialize enhanced drawing system
const enhancedDrawing = new EnhancedAtomDrawing(
    molecule,
    pubchemService,
    chemistryIntelligence
);

// Initialize renderer
const canvas = document.getElementById('canvas');
const renderer = new Renderer(canvas);
```

### 3. Use Enhanced Atom Placement

```javascript
// Place atom with intelligent positioning
canvas.addEventListener('click', async (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const clickedAtom = molecule.getAtomAtPosition(x, y, 20);
    
    if (clickedAtom) {
        // Place connected atom
        const newAtom = await enhancedDrawing.placeAtom(
            'C',
            x,
            y,
            {
                connectToAtom: clickedAtom,
                bondOrder: 1,
                validate: true,
                usePubChem: true
            }
        );
    } else {
        // Place standalone atom
        const newAtom = await enhancedDrawing.placeAtom('C', x, y);
    }
    
    // Enrich molecule with PubChem data
    await enrichmentService.enrichMolecule(molecule);
    
    // Render
    renderer.render(molecule);
});
```

### 4. PubChem Integration

```javascript
// Search for compounds
const results = await pubchemService.searchCompounds('aspirin');

// Import from PubChem
await enrichmentService.importFromPubChem(2244, molecule); // Aspirin CID

// Validate molecule against PubChem
const validation = await enrichmentService.searchMoleculeInPubChem(molecule);
```

## Features

### Enhanced Atom Drawing
- Intelligent position prediction based on VSEPR theory
- Automatic hybridization detection
- Valence validation
- Bond angle optimization
- Ghost preview with angle guides

### PubChem Integration
- Automatic atom enrichment
- Common compound suggestions
- Molecular validation
- Structure import from PubChem CID

### Chemistry Intelligence
- Formal charge calculation
- Implicit hydrogen calculation
- Aromaticity detection
- Functional group recognition
- Valence validation

## API Reference

### EnhancedAtomDrawing

```javascript
// Place atom
placeAtom(element, x, y, options)

// Predict optimal position
predictOptimalPosition(atom, mouseX, mouseY)

// Get suggestions
getSuggestedElements(context)
suggestBondOrder(element1, element2)

// Draw preview
drawGhostPreview(ctx, x, y, element, connectedAtom)
drawAngleGuides(ctx, atom, mouseX, mouseY)
```

### AtomEnrichmentService

```javascript
// Enrich molecule
enrichMolecule(molecule)

// Enrich atom
enrichAtom(atom, molecule)

// Validate molecule
validateMolecule(molecule)

// Import from PubChem
importFromPubChem(cid, molecule)

// Search molecule
searchMoleculeInPubChem(molecule)
```

## Migration from Old System

If you're migrating from the old system:

1. Replace `SmartDrawingTool` with `EnhancedAtomDrawing`
2. Initialize `AtomEnrichmentService` for PubChem integration
3. Use `placeAtom()` instead of manual `addAtom()` calls
4. Call `enrichMolecule()` after molecule changes

## License

MIT License - See LICENSE file
