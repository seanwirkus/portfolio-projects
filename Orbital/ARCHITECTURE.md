# Orbital Molecular Editor - Clean Architecture

## Design Principles

1. **Separation of Concerns** - Clear boundaries between data, logic, and presentation
2. **Single Responsibility** - Each class/module does one thing well
3. **Event-Driven** - Loose coupling through events
4. **Immutable State** - State changes create new objects
5. **Testable** - Easy to unit test each component

## Architecture Layers

```
┌─────────────────────────────────────────────┐
│           Presentation Layer                 │
│  - UI Components                             │
│  - Canvas Rendering                          │
│  - User Interactions                         │
└──────────────┬───────────────────────────────┘
               │ Events
┌──────────────▼───────────────────────────────┐
│           Application Layer                  │
│  - Tool System                               │
│  - Command Pattern                           │
│  - State Management                         │
└──────────────┬───────────────────────────────┘
               │ API
┌──────────────▼───────────────────────────────┐
│           Domain Layer                       │
│  - Molecule Model                            │
│  - Chemistry Rules                           │
│  - Validation                                │
└─────────────────────────────────────────────┘
```

## Core Components

### 1. Molecule Model (Domain)
- Pure data structure
- No rendering logic
- Immutable operations
- Validation built-in

### 2. Renderer (Presentation)
- Pure rendering logic
- No business logic
- Takes molecule + style → draws on canvas
- High-performance, cached

### 3. Tool System (Application)
- Each tool is a class
- Implements Tool interface
- Handles user interactions
- Emits events

### 4. State Manager (Application)
- Single source of truth
- Event emitter
- Manages UI state
- Coordinates tools

### 5. Command Pattern (Application)
- Undo/redo support
- All mutations are commands
- Commands are serializable
- History management

## File Structure

```
src/js/
├── core/
│   ├── molecule.js          # Pure data model
│   ├── chemistry.js         # Chemistry rules & validation
│   └── geometry.js          # Geometric calculations
├── rendering/
│   ├── renderer.js          # Main renderer
│   ├── style.js             # Style system
│   └── painters/
│       ├── bond-painter.js  # Bond rendering
│       ├── atom-painter.js  # Atom rendering
│       └── text-painter.js  # Text rendering
├── tools/
│   ├── base-tool.js         # Base tool class
│   ├── atom-tool.js          # Atom placement tool
│   ├── bond-tool.js          # Bond drawing tool
│   ├── chain-tool.js         # Chain tool
│   └── erase-tool.js        # Erase tool
├── commands/
│   ├── command.js           # Base command
│   ├── add-atom-cmd.js      # Add atom command
│   ├── add-bond-cmd.js      # Add bond command
│   └── remove-atom-cmd.js   # Remove atom command
├── state/
│   ├── state-manager.js     # Application state
│   └── history.js           # Undo/redo history
└── app.js                   # Main application

