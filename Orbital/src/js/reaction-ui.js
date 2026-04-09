// Reaction UI - Display and manage reactions with reagents

class ReactionUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.reactionManager = new ReactionManager();
        this.validator = new ReactionValidator();
        this.moleculeLibrary = new MoleculeLibrary();
        this.pubChemService = typeof PubChemService !== 'undefined' ? new PubChemService() : null;
        this.selectedLibraryCategory = null;
        this.selectedLibraryMolecule = null;
        this.pubChemResults = [];
        this.pubchemSearchState = { loading: false };
        this.currentReaction = null;
        this.validationResult = null;
        this.lastImportedMetadata = null;
        this.reactants = { 1: null, 2: null }; // Store multiple reactants
        this.init();
    }

    init() {
        if (this.container) {
            this.createReactionLayout();
        }
    }

    /**
     * Create the reaction display layout
     */
    createReactionLayout() {
        const html = `
            <div class="reaction-container">
                <!-- Reactant 1 Section -->
                <div class="reaction-section reactant-section" data-reactant="1">
                    <h4>Reactant 1</h4>
                    <div class="reactant-header">
                        <button class="btn-small" onclick="reactionUI.loadFromDrawTab(1)" title="Load from Draw tab">📥 From Draw</button>
                        <button class="btn-small" onclick="reactionUI.clearReactant(1)" title="Clear">🗑️</button>
                    </div>
                    <div class="reaction-molecule-display" id="reactant-1-display">
                        <p class="placeholder">Draw a molecule or search PubChem</p>
                    </div>
                    <div class="library-controls">
                        <h5>Quick Molecule Library</h5>
                        <div class="library-selectors">
                            <select id="library-category-select-1"></select>
                            <select id="library-molecule-select-1">
                                <option value="">Choose a molecule...</option>
                            </select>
                            <button id="load-library-molecule-btn-1" class="action-btn small">Load</button>
                        </div>
                    </div>
                    <div class="pubchem-controls">
                        <h5>PubChem Search</h5>
                        <div class="pubchem-search-bar">
                            <input type="text" id="pubchem-search-input-1" placeholder="Search PubChem (e.g., glucose)">
                            <button id="pubchem-search-btn-1" class="action-btn small">Search</button>
                        </div>
                        <div id="pubchem-results-1" class="pubchem-results"></div>
                    </div>
                </div>

                <!-- Reactant 2 Section -->
                <div class="reaction-section reactant-section" data-reactant="2">
                    <h4>Reactant 2 <span class="optional-badge">(Optional)</span></h4>
                    <div class="reactant-header">
                        <button class="btn-small" onclick="reactionUI.loadFromDrawTab(2)" title="Load from Draw tab">📥 From Draw</button>
                        <button class="btn-small" onclick="reactionUI.clearReactant(2)" title="Clear">🗑️</button>
                    </div>
                    <div class="reaction-molecule-display" id="reactant-2-display">
                        <p class="placeholder">Optional second reactant</p>
                    </div>
                    <div class="library-controls">
                        <h5>Quick Molecule Library</h5>
                        <div class="library-selectors">
                            <select id="library-category-select-2"></select>
                            <select id="library-molecule-select-2">
                                <option value="">Choose a molecule...</option>
                            </select>
                            <button id="load-library-molecule-btn-2" class="action-btn small">Load</button>
                        </div>
                    </div>
                    <div class="pubchem-controls">
                        <h5>PubChem Search</h5>
                        <div class="pubchem-search-bar">
                            <input type="text" id="pubchem-search-input-2" placeholder="Search PubChem">
                            <button id="pubchem-search-btn-2" class="action-btn small">Search</button>
                        </div>
                        <div id="pubchem-results-2" class="pubchem-results"></div>
                    </div>
                </div>

                <!-- Reagents & Conditions -->
                <div class="reaction-section reagents-section">
                    <h4>Reagents & Conditions</h4>
                    
                    <!-- Real-time validation status -->
                    <div id="validation-status" class="validation-status"></div>
                    
                    <!-- Suggested Reagents (Guided) -->
                    <div id="suggested-reagents" class="suggested-reagents">
                        <h5>💡 Suggested Reagents:</h5>
                        <div id="suggested-reagents-list" class="suggested-reagents-list">
                            <p class="placeholder-text">Add a reactant to see suggested reagents</p>
                        </div>
                    </div>
                    
                    <div class="reagents-list" id="reagents-list"></div>
                    <div class="reagent-selector">
                        <label>Add Reagent:</label>
                        <select id="reagent-dropdown">
                            <option value="">Select a reagent...</option>
                        </select>
                        <button id="add-reagent-btn" class="action-btn">Add</button>
                    </div>
                    <div class="conditions-input">
                        <label>Temperature (°C):</label>
                        <input type="number" id="temp-input" placeholder="25" value="25" onchange="reactionUI.updateValidationStatus()">
                        <label>Solvent:</label>
                        <select id="solvent-select" onchange="reactionUI.updateValidationStatus()">
                            <option value="">Select solvent...</option>
                            <option value="H2O">Water</option>
                            <option value="EtOH">Ethanol</option>
                            <option value="MeOH">Methanol</option>
                            <option value="THF">THF</option>
                            <option value="DCM">DCM</option>
                            <option value="DMSO">DMSO</option>
                        </select>
                    </div>
                </div>

                <!-- Arrow -->
                <div class="reaction-arrow">
                    <svg width="60" height="30" viewBox="0 0 60 30">
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                                <polygon points="0 0, 10 3, 0 6" fill="#333"/>
                            </marker>
                        </defs>
                        <line x1="5" y1="15" x2="55" y2="15" stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>
                    </svg>
                </div>

                <!-- Products Section -->
                <div class="reaction-section products-section">
                    <h4>Products</h4>
                    <div class="products-list" id="products-list">
                        <p class="placeholder">Run reaction to see products</p>
                    </div>
                    <button id="predict-products-btn" class="action-btn primary">🧪 Predict Products</button>
                </div>

                <!-- Mechanism Display -->
                <div class="reaction-section mechanism-section">
                    <h4>Reaction Mechanism</h4>
                    <div class="mechanism-controls">
                        <button id="show-mechanism-btn" class="action-btn">📊 Show Mechanism</button>
                        <button id="animate-mechanism-btn" class="action-btn">▶️ Animate</button>
                    </div>
                    <div class="mechanism-display" id="mechanism-display"></div>
                </div>

                <!-- Reaction Information -->
                <div class="reaction-section info-section">
                    <h4>Reaction Information</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <label>Type:</label>
                            <span id="reaction-type">-</span>
                        </div>
                        <div class="info-item">
                            <label>Predicted Yield:</label>
                            <span id="predicted-yield">-</span>
                        </div>
                        <div class="info-item">
                            <label>Difficulty:</label>
                            <span id="reaction-difficulty">-</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.attachEventHandlers();
    }

    /**
     * Attach event handlers to reaction UI
     */
    attachEventHandlers() {
        // Add reagent button
        const addReagentBtn = document.getElementById('add-reagent-btn');
        const reagentDropdown = document.getElementById('reagent-dropdown');

        if (addReagentBtn) {
            addReagentBtn.addEventListener('click', () => {
                const reagentKey = reagentDropdown.value;
                if (reagentKey && this.currentReaction) {
                    this.reactionManager.addReagent(this.currentReaction, reagentKey);
                    this.updateReagentsList();
                    this.updateValidationStatus(); // Real-time validation
                }
            });
        }

        // Predict products button
        const predictBtn = document.getElementById('predict-products-btn');
        if (predictBtn) {
            predictBtn.addEventListener('click', () => {
                if (this.currentReaction) {
                    this.predictProducts();
                }
            });
        }

        // Show mechanism button
        const mechBtn = document.getElementById('show-mechanism-btn');
        if (mechBtn) {
            mechBtn.addEventListener('click', () => {
                this.displayMechanism();
            });
        }

        // Populate reagent dropdown
        this.populateReagentDropdown();
        
        // Initialize controls for both reactants
        this.initializeMoleculeLibraryControls(1);
        this.initializeMoleculeLibraryControls(2);
        this.initializePubChemControls(1);
        this.initializePubChemControls(2);
    }

    /**
     * Generate SMILES string from molecule
     */
    generateSMILES(molecule) {
        if (!molecule || !molecule.atoms || molecule.atoms.length === 0) {
            return '';
        }
        
        // Use ClipboardManager if available
        if (typeof ClipboardManager !== 'undefined') {
            const clipboard = new ClipboardManager();
            return clipboard.generateSMILES(molecule);
        }
        
        // Fallback simple SMILES generation
        let smiles = '';
        const visited = new Set();
        
        const getAtomSymbol = (atom) => {
            if (atom.element === 'C') return 'C';
            return `[${atom.element}]`;
        };
        
        const traverse = (atomId, parentId = null) => {
            if (visited.has(atomId)) return;
            visited.add(atomId);
            
            const atom = molecule.atoms.find(a => a.id === atomId);
            if (!atom) return;
            
            smiles += getAtomSymbol(atom);
            
            const bonds = molecule.bonds.filter(b => 
                (b.atom1 === atomId || b.atom2 === atomId) && 
                (b.atom1 !== parentId && b.atom2 !== parentId)
            );
            
            bonds.forEach(bond => {
                const nextId = bond.atom1 === atomId ? bond.atom2 : bond.atom1;
                if (bond.order === 2) smiles += '=';
                else if (bond.order === 3) smiles += '#';
                traverse(nextId, atomId);
            });
        };
        
        if (molecule.atoms.length > 0) {
            traverse(molecule.atoms[0].id);
        }
        
        return smiles || 'C'; // Default to carbon if empty
    }

    /**
     * Populate reagent dropdown with library
     */
    populateReagentDropdown() {
        const dropdown = document.getElementById('reagent-dropdown');
        if (!dropdown) return;

        const library = this.reactionManager.getReagentLibrary();
        const typeLabels = {
            acid: 'Acids',
            base: 'Bases',
            nucleophile: 'Nucleophiles',
            reducing: 'Reducing Agents',
            oxidizing: 'Oxidizing Agents',
            halogenating: 'Halogenating Agents',
            condition: 'Conditions'
        };

        // Group reagents by type
        const grouped = {};
        Object.entries(library).forEach(([key, info]) => {
            const groupName = typeLabels[info.type] || 'Other';
            if (!grouped[groupName]) grouped[groupName] = [];
            grouped[groupName].push({ key, info });
        });

        // Sort entries alphabetically inside each group
        Object.values(grouped).forEach(arr => {
            arr.sort((a, b) => a.info.name.localeCompare(b.info.name));
        });

        let html = '<option value="">Select a reagent...</option>';
        Object.entries(grouped).forEach(([groupName, entries]) => {
            html += `<optgroup label="${groupName}">`;
            entries.forEach(({ key, info }) => {
                const formula = info.formula ? ` (${info.formula})` : '';
                html += `<option value="${key}">${info.name}${formula}</option>`;
            });
            html += '</optgroup>';
        });

        dropdown.innerHTML = html;
    }

    /**
     * Initialize molecule library controls for a specific reactant
     */
    initializeMoleculeLibraryControls(reactantNumber = 1) {
        const categorySelect = document.getElementById(`library-category-select-${reactantNumber}`);
        const moleculeSelect = document.getElementById(`library-molecule-select-${reactantNumber}`);
        const loadButton = document.getElementById(`load-library-molecule-btn-${reactantNumber}`);

        if (!categorySelect || !moleculeSelect || !loadButton) return;

        const categories = this.moleculeLibrary.getCategories();
        if (categories.length === 0) {
            categorySelect.innerHTML = '<option value="">No library entries</option>';
            return;
        }

        categorySelect.innerHTML = categories.map(cat =>
            `<option value="${cat.key}">${cat.name}</option>`
        ).join('');

        this.selectedLibraryCategory = categories[0].key;
        categorySelect.value = this.selectedLibraryCategory;
        this.populateLibraryMoleculeOptions(this.selectedLibraryCategory, reactantNumber);

        categorySelect.addEventListener('change', (event) => {
            this.selectedLibraryCategory = event.target.value;
            this.populateLibraryMoleculeOptions(this.selectedLibraryCategory, reactantNumber);
        });

        moleculeSelect.addEventListener('change', (event) => {
            this.selectedLibraryMolecule = event.target.value;
            this.updateLibraryDescription(this.selectedLibraryMolecule);
        });

        loadButton.addEventListener('click', () => {
            const selectedMolecule = moleculeSelect.value;
            if (!selectedMolecule) {
                alert('Select a molecule from the library first.');
                return;
            }
            this.loadLibraryMolecule(selectedMolecule, { reactantNumber });
        });
    }

    initializePubChemControls(reactantNumber = 1) {
        const pubchemSearchInput = document.getElementById(`pubchem-search-input-${reactantNumber}`);
        const pubchemSearchButton = document.getElementById(`pubchem-search-btn-${reactantNumber}`);
        const pubchemResultsContainer = document.getElementById(`pubchem-results-${reactantNumber}`);

        if (!pubchemSearchInput || !pubchemSearchButton || !pubchemResultsContainer) {
            return;
        }

        if (!this.pubChemService) {
            this.renderPubChemMessage('PubChem integration is unavailable in this environment.', 'error', reactantNumber);
            pubchemSearchInput.disabled = true;
            pubchemSearchButton.disabled = true;
            return;
        }

        pubchemSearchButton.addEventListener('click', () => this.handlePubChemSearch(reactantNumber));
        pubchemSearchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.handlePubChemSearch(reactantNumber);
            }
        });
    }

    togglePubChemControls(isLoading) {
        if (this.pubchemSearchButton) {
            this.pubchemSearchButton.disabled = isLoading;
        }

        if (this.pubchemSearchInput) {
            this.pubchemSearchInput.readOnly = isLoading;
        }
    }

    renderPubChemMessage(message, type = 'info', reactantNumber = 1) {
        const container = document.getElementById(`pubchem-results-${reactantNumber}`);
        if (!container) return;
        const className = `pubchem-status ${type}`;
        container.innerHTML = `<div class="${className}">${this.escapeHtml(message)}</div>`;
    }

    escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }

        return String(value).replace(/[&<>"']/g, (char) => {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return map[char] || char;
        });
    }

    renderPubChemResults(results, reactantNumber = 1) {
        const container = document.getElementById(`pubchem-results-${reactantNumber}`);
        if (!container) return;
        
        // Store results per reactant
        if (!this.pubChemResults) this.pubChemResults = {};
        this.pubChemResults[reactantNumber] = results;

        const markup = results.map((entry, index) => {
            const name = this.escapeHtml(entry.name || `CID ${entry.cid}`);
            const cidString = this.escapeHtml(entry.cid);
            const metaParts = [];

            if (entry.formula) {
                metaParts.push(this.escapeHtml(entry.formula));
            }

            metaParts.push(`CID ${cidString}`);

            if (entry.molecularWeight) {
                const weight = typeof entry.molecularWeight === 'number'
                    ? entry.molecularWeight.toFixed(2)
                    : String(entry.molecularWeight);
                metaParts.push(`${this.escapeHtml(weight)} g/mol`);
            }

            const metaHtml = metaParts
                .map(part => `<span class="pubchem-result-meta-item">${part}</span>`)
                .join(' ');

            const iupac = entry.iupac
                ? `<div class="pubchem-result-iupac">${this.escapeHtml(entry.iupac)}</div>`
                : '';

            return `
                <div class="pubchem-result" data-index="${index}">
                    <div class="pubchem-result-header">
                        <span class="pubchem-result-name">${name}</span>
                        <button class="action-btn small" data-index="${index}" data-cid="${cidString}">Import</button>
                    </div>
                    <div class="pubchem-result-meta">${metaHtml}</div>
                    ${iupac}
                </div>
            `;
        }).join('');

        container.innerHTML = markup;
        this.attachPubChemResultListeners(reactantNumber);
    }

    attachPubChemResultListeners(reactantNumber = 1) {
        const container = document.getElementById(`pubchem-results-${reactantNumber}`);
        if (!container) return;
        const buttons = container.querySelectorAll('button[data-index]');
        buttons.forEach(button => {
            button.addEventListener('click', (event) => {
                const idx = parseInt(event.currentTarget.dataset.index, 10);
                if (Number.isNaN(idx)) return;
                this.importPubChemResult(idx, reactantNumber);
            });
        });
    }

    async handlePubChemSearch(reactantNumber = 1) {
        if (!this.pubChemService) {
            return;
        }

        const searchInput = document.getElementById(`pubchem-search-input-${reactantNumber}`);
        const searchButton = document.getElementById(`pubchem-search-btn-${reactantNumber}`);
        const query = searchInput?.value?.trim() || '';
        
        if (query.length < 2) {
            this.renderPubChemMessage('Enter at least two characters to search PubChem.', 'hint', reactantNumber);
            return;
        }

        if (searchButton) searchButton.disabled = true;
        if (searchInput) searchInput.readOnly = true;
        this.renderPubChemMessage(`Searching PubChem for "${query}"...`, 'loading', reactantNumber);

        try {
            const results = await this.pubChemService.searchCompounds(query);
            this.pubChemResults = results;

            if (!results.length) {
                this.renderPubChemMessage('No PubChem compounds found for that query.', 'empty', reactantNumber);
            } else {
                this.renderPubChemResults(results, reactantNumber);
            }
        } catch (error) {
            console.error('PubChem search failed:', error);
            this.renderPubChemMessage('PubChem search failed. Please try again.', 'error', reactantNumber);
        } finally {
            if (searchButton) searchButton.disabled = false;
            if (searchInput) searchInput.readOnly = false;
        }
    }

    async importPubChemResult(index, reactantNumber = 1) {
        const results = this.pubChemResults && this.pubChemResults[reactantNumber];
        if (!Array.isArray(results) || !results[index]) {
            this.renderPubChemMessage('Could not identify the selected PubChem entry.', 'error', reactantNumber);
            return;
        }

        const entry = results[index];
        if (!entry.cid) {
            this.renderPubChemMessage('The selected PubChem result is missing a CID.', 'error', reactantNumber);
            return;
        }

        const searchInput = document.getElementById(`pubchem-search-input-${reactantNumber}`);
        const searchButton = document.getElementById(`pubchem-search-btn-${reactantNumber}`);
        if (searchButton) searchButton.disabled = true;
        if (searchInput) searchInput.readOnly = true;
        this.renderPubChemMessage(`Loading CID ${entry.cid} from PubChem...`, 'loading', reactantNumber);

        try {
            const structure = await this.pubChemService.fetchCompoundStructure(entry.cid);
            const mergedMetadata = { ...entry, ...(structure.metadata || {}) };
            const description = structure.formula
                ? `Imported from PubChem (CID ${entry.cid}) - ${structure.formula}`
                : `Imported from PubChem (CID ${entry.cid}).`;

            this.loadMoleculeTemplate(structure, {
                descriptionText: description,
                metadata: mergedMetadata,
                source: 'pubchem',
                reactantNumber: reactantNumber
            });

            const displayName = structure.name || entry.name || `CID ${entry.cid}`;
            this.renderPubChemMessage(`Loaded ${displayName} as Reactant ${reactantNumber}.`, 'success', reactantNumber);
        } catch (error) {
            console.error('PubChem import failed:', error);
            this.renderPubChemMessage('Unable to import compound from PubChem.', 'error', reactantNumber);
        } finally {
            if (searchButton) searchButton.disabled = false;
            if (searchInput) searchInput.readOnly = false;
        }
    }

    /**
     * Populate molecule options for selected category
     */
    populateLibraryMoleculeOptions(categoryKey, reactantNumber = 1) {
        const moleculeSelect = document.getElementById(`library-molecule-select-${reactantNumber}`);
        if (!moleculeSelect) return;

        const molecules = this.moleculeLibrary.getMoleculesForCategory(categoryKey);
        if (molecules.length === 0) {
            moleculeSelect.innerHTML = '<option value="">No molecules available</option>';
            this.selectedLibraryMolecule = null;
            this.updateLibraryDescription(null);
            return;
        }

        moleculeSelect.innerHTML = ['<option value="">Choose a molecule...</option>']
            .concat(molecules.map(mol => `<option value="${mol.id}">${mol.name} (${mol.formula})</option>`))
            .join('');

        this.selectedLibraryMolecule = molecules[0].id;
        moleculeSelect.value = this.selectedLibraryMolecule;
        this.updateLibraryDescription(this.selectedLibraryMolecule);
    }

    /**
     * Update library molecule description helper
     */
    updateLibraryDescription(moleculeId) {
        const desc = document.getElementById('library-molecule-description');
        if (!desc) return;

        if (!moleculeId) {
            desc.textContent = 'Pick a preset molecule to load into the canvas.';
            return;
        }

        const moleculeInfo = this.moleculeLibrary.getMoleculeById(moleculeId);
        if (!moleculeInfo) {
            desc.textContent = 'Molecule unavailable.';
            return;
        }

        desc.textContent = `${moleculeInfo.description} (Formula: ${moleculeInfo.formula})`;
    }

    /**
     * Load selected library molecule into main canvas and reaction panel
     */
    loadLibraryMolecule(moleculeId, options = {}) {
        const template = this.moleculeLibrary.getMoleculeById(moleculeId);
        if (!template) {
            alert('Could not load molecule from library.');
            return;
        }

        console.log('📚 Loading library molecule:', template.name);

        this.loadMoleculeTemplate(template, {
            descriptionText: `${template.description} (Formula: ${template.formula})`,
            metadata: {
                source: 'library',
                id: template.id,
                name: template.name,
                formula: template.formula
            },
            fitToCanvas: false,
            reactantNumber: options.reactantNumber
        });
    }

    loadMoleculeTemplate(template, options = {}) {
        if (!template || !Array.isArray(template.atoms) || template.atoms.length === 0) {
            alert('Unable to load molecule template. The entry is missing atom data.');
            return;
        }

        const reactantNumber = options.reactantNumber || 1;
        const targetMolecule = options.reactantNumber ? null : molecule; // Use molecule for draw tab, null for reaction tab

        // If loading into reaction tab, create a new molecule
        if (reactantNumber && typeof Molecule !== 'undefined') {
            const newMolecule = new Molecule();
            const idMap = new Map();
            
            template.atoms.forEach(atom => {
                const x = atom.position?.x ?? atom.x ?? 0;
                const y = atom.position?.y ?? atom.y ?? 0;
                const element = atom.element || 'C';
                const newAtom = newMolecule.addAtom(element, x, y);
                if (atom.id !== undefined) {
                    idMap.set(atom.id, newAtom.id);
                }
            });
            
            template.bonds.forEach(bond => {
                const id1 = idMap.get(bond.atom1) ?? bond.atom1;
                const id2 = idMap.get(bond.atom2) ?? bond.atom2;
                newMolecule.addBond(id1, id2, bond.order || 1);
            });
            
            // Set as reactant
            this.setReaction(newMolecule, reactantNumber);
            
            if (typeof renderer !== 'undefined' && renderer) {
                renderer.render(newMolecule);
            }
            
            return;
        }

        // Original logic for draw tab
        if (typeof molecule === 'undefined' || !molecule) {
            alert('Main drawing canvas not ready.');
            return;
        }

        molecule.atoms = [];
        molecule.bonds = [];
        molecule.nextAtomId = 0;
        molecule.nextBondId = 0;

        const idMap = new Map();

        template.atoms.forEach((atom, index) => {
            const x = atom.position?.x ?? atom.x ?? 0;
            const y = atom.position?.y ?? atom.y ?? 0;
            const element = atom.element || 'C';
            const newAtom = molecule.addAtom(element, x, y);
            if (typeof atom.charge === 'number') {
                newAtom.charge = atom.charge;
            }
            const sourceId = atom.id || atom.sourceId || `atom_${index}`;
            idMap.set(sourceId, newAtom.id);
        });

        if (Array.isArray(template.bonds)) {
            template.bonds.forEach((bond) => {
                const sourceAtom1 = bond.atom1 || bond.from || bond.a1;
                const sourceAtom2 = bond.atom2 || bond.to || bond.a2;
                const atom1 = idMap.get(sourceAtom1);
                const atom2 = idMap.get(sourceAtom2);
                if (!atom1 || !atom2) {
                    return;
                }

                const rawOrder = typeof bond.order === 'number' ? bond.order : 1;
                const order = Math.max(1, Math.min(3, Math.round(rawOrder)));
                molecule.addBond(atom1, atom2, order);
            });
        }

        const shouldFit = options.fitToCanvas !== false;
        if (shouldFit && typeof molecule.fitToCanvas === 'function' && typeof renderer !== 'undefined' && renderer && renderer.canvas) {
            molecule.fitToCanvas(renderer.canvas.width, renderer.canvas.height);
        }

        if (typeof renderer !== 'undefined' && renderer) {
            renderer.render(molecule);
        }

        if (typeof updateMoleculeProperties === 'function') {
            updateMoleculeProperties();
        }

        this.setReaction(molecule);
        this.updateValidationStatus();

        if (options.descriptionText) {
            const desc = document.getElementById('library-molecule-description');
            if (desc) {
                desc.textContent = options.descriptionText;
            }
        }

        if (options.metadata) {
            this.lastImportedMetadata = options.metadata;
        }

        console.log('✅ Molecule template loaded onto canvas.');
    }

    /**
     * Update reagents list display
     */
    updateReagentsList() {
        const list = document.getElementById('reagents-list');
        if (!list || !this.currentReaction) return;

        let html = '';
        if (this.currentReaction.reagents.length === 0) {
            html = '<p class="placeholder">No reagents added</p>';
        } else {
            html = this.currentReaction.reagents.map(reagentKey => {
                const reagent = this.reactionManager.getReagentLibrary()[reagentKey];
                if (!reagent) return '';
                const label = reagent.formula ? `${reagent.name} (${reagent.formula})` : reagent.name;
                return `
                    <div class="reagent-tag" style="background-color: ${reagent.color}20; border-color: ${reagent.color}">
                        <span>${label}</span>
                        <button class="remove-btn" onclick="reactionUI.removeReagent('${reagentKey}')">×</button>
                    </div>
                `;
            }).join('');
        }

        list.innerHTML = html;
    }

    /**
     * Remove reagent from reaction
     */
    removeReagent(reagentKey) {
        if (this.currentReaction) {
            this.reactionManager.removeReagent(this.currentReaction, reagentKey);
            this.updateReagentsList();
            this.updateValidationStatus(); // Real-time validation
        }
    }

    /**
     * Set current reaction (for backward compatibility - sets Reactant 1)
     */
    /**
     * Suggest reagents based on reactant structure
     */
    suggestReagentsForMolecule(molecule) {
        if (!molecule || !molecule.atoms || molecule.atoms.length === 0) {
            return [];
        }

        const suggestions = [];
        const reagentLibrary = this.reactionManager.getReagentLibrary();
        
        // Detect functional groups using reaction engine
        const functionalGroups = this.detectFunctionalGroups(molecule);
        
        // Map functional groups to suggested reagents
        const groupToReagents = {
            'alcohol': ['KMnO4', 'CrO3', 'PCC', 'LiAlH4', 'NaBH4', 'H2SO4'],
            'aldehyde': ['NaBH4', 'LiAlH4', 'KMnO4', 'Ag2O'],
            'ketone': ['NaBH4', 'LiAlH4', 'KMnO4'],
            'carboxylic_acid': ['LiAlH4', 'SOCl2', 'PCl5'],
            'alkene': ['Br2', 'Cl2', 'H2', 'KMnO4', 'OsO4'],
            'alkyne': ['H2', 'Br2', 'HgSO4'],
            'ester': ['NaOH', 'LiAlH4', 'NaBH4'],
            'amine': ['CH3I', 'Ac2O', 'HNO2'],
            'halide': ['Mg', 'Li', 'Na']
        };
        
        // Add reagents based on detected groups
        functionalGroups.forEach(group => {
            const reagents = groupToReagents[group] || [];
            reagents.forEach(reagent => {
                if (reagentLibrary[reagent] && !suggestions.includes(reagent)) {
                    suggestions.push(reagent);
                }
            });
        });
        
        // If no specific groups detected, suggest common reagents
        if (suggestions.length === 0) {
            suggestions.push('KMnO4', 'LiAlH4', 'Br2', 'H2SO4', 'NaOH');
        }
        
        return suggestions.slice(0, 6); // Limit to 6 suggestions
    }
    
    /**
     * Detect functional groups in molecule
     */
    detectFunctionalGroups(molecule) {
        const groups = [];
        
        // Simple detection based on atom types and bonds
        molecule.atoms.forEach(atom => {
            const bonds = molecule.getAtomBonds ? molecule.getAtomBonds(atom.id) : [];
            const bondSum = bonds.reduce((sum, b) => sum + b.order, 0);
            
            // Alcohol detection (O with single bond to C)
            if (atom.element === 'O' && bondSum === 1) {
                const bond = bonds[0];
                const otherId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
                const otherAtom = molecule.getAtomById(otherId);
                if (otherAtom && otherAtom.element === 'C') {
                    groups.push('alcohol');
                }
            }
            
            // Carbonyl detection (C=O)
            if (atom.element === 'C') {
                const hasDoubleBondToO = bonds.some(bond => {
                    if (bond.order === 2) {
                        const otherId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
                        const otherAtom = molecule.getAtomById(otherId);
                        return otherAtom && otherAtom.element === 'O';
                    }
                    return false;
                });
                if (hasDoubleBondToO) {
                    groups.push('carbonyl');
                }
            }
            
            // Alkene detection (C=C)
            if (atom.element === 'C') {
                const hasDoubleBond = bonds.some(bond => bond.order === 2);
                if (hasDoubleBond) {
                    groups.push('alkene');
                }
            }
        });
        
        return [...new Set(groups)];
    }
    
    /**
     * Update suggested reagents display
     */
    updateSuggestedReagents() {
        const container = document.getElementById('suggested-reagents-list');
        if (!container) return;
        
        const primaryReactant = this.reactants[1];
        if (!primaryReactant || !primaryReactant.atoms || primaryReactant.atoms.length === 0) {
            container.innerHTML = '<p class="placeholder-text">Add a reactant to see suggested reagents</p>';
            return;
        }
        
        const suggestions = this.suggestReagentsForMolecule(primaryReactant);
        const reagentLibrary = this.reactionManager.getReagentLibrary();
        
        if (suggestions.length === 0) {
            container.innerHTML = '<p class="placeholder-text">No specific suggestions. Try common reagents like KMnO4, LiAlH4, or Br2</p>';
            return;
        }
        
        const html = suggestions.map(reagentKey => {
            const reagent = reagentLibrary[reagentKey];
            if (!reagent) return '';
            
            return `
                <button class="suggested-reagent-btn" 
                        onclick="reactionUI.addSuggestedReagent('${reagentKey}')"
                        title="${reagent.description || reagentKey}">
                    <strong>${reagentKey}</strong>
                    ${reagent.name ? `<small>${reagent.name}</small>` : ''}
                </button>
            `;
        }).join('');
        
        container.innerHTML = html;
    }
    
    /**
     * Add a suggested reagent
     */
    addSuggestedReagent(reagentKey) {
        if (!this.currentReaction) {
            this.currentReaction = { reagents: [] };
        }
        
        if (!this.currentReaction.reagents.includes(reagentKey)) {
            this.currentReaction.reagents.push(reagentKey);
            this.updateDisplay(); // Fixed: use updateDisplay instead of updateReactionDisplay
            this.updateValidationStatus();
            this.showNotification(`Added ${reagentKey}`, 'success');
        } else {
            this.showNotification(`${reagentKey} already added`, 'info');
        }
    }

    setReaction(molecule, reactantNumber = 1) {
        if (!molecule || molecule.atoms.length === 0) {
            return;
        }

        // Store reactant
        this.reactants[reactantNumber] = molecule;
        
        // Update suggested reagents when reactant 1 is set
        if (reactantNumber === 1) {
            this.updateSuggestedReagents();
        }
        
        // Create or update reaction
        if (!this.currentReaction) {
            this.currentReaction = this.reactionManager.createReaction(molecule);
        } else {
            // Update existing reaction
            if (reactantNumber === 1) {
                this.currentReaction.reactant = this.reactionManager.cloneMolecule(molecule);
            } else if (reactantNumber === 2) {
                // For multi-reactant reactions, store as second reactant
                this.currentReaction.reactant2 = this.reactionManager.cloneMolecule(molecule);
            }
        }
        
        this.updateDisplay();
        this.updateValidationStatus();
        console.log(`✅ Reactant ${reactantNumber} set with molecule:`, molecule.atoms.length, 'atoms');
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Load molecule from Draw tab into specified reactant slot
     */
    loadFromDrawTab(reactantNumber = 1) {
        if (typeof molecule !== 'undefined' && molecule && molecule.atoms.length > 0) {
            this.setReaction(molecule, reactantNumber);
            this.showNotification(`Reactant ${reactantNumber} loaded from Draw tab`, 'success');
        } else {
            this.showNotification('No molecule in Draw tab. Draw a molecule first.', 'warning');
        }
    }

    /**
     * Clear a specific reactant
     */
    clearReactant(reactantNumber) {
        this.reactants[reactantNumber] = null;
        const display = document.getElementById(`reactant-${reactantNumber}-display`);
        if (display) {
            display.innerHTML = '<p class="placeholder">' + 
                (reactantNumber === 1 ? 'Draw a molecule or search PubChem' : 'Optional second reactant') + 
                '</p>';
        }
        if (this.currentReaction) {
            if (reactantNumber === 1) {
                this.currentReaction.reactant = null;
            } else if (reactantNumber === 2) {
                this.currentReaction.reactant2 = null;
            }
        }
        this.updateValidationStatus();
    }

    /**
     * Update reaction display
     */
    updateDisplay() {
        // Update Reactant 1 display
        const reactant1Display = document.getElementById('reactant-1-display');
        if (reactant1Display) {
            reactant1Display.innerHTML = '';
            if (this.reactants[1] && this.reactants[1].atoms.length > 0) {
                const miniCanvas = document.createElement('canvas');
                miniCanvas.width = 200;
                miniCanvas.height = 150;
                miniCanvas.style.border = '1px solid #e5e7eb';
                miniCanvas.style.borderRadius = '4px';
                reactant1Display.appendChild(miniCanvas);
                const ctx = miniCanvas.getContext('2d');
                this.renderMiniMolecule(ctx, this.reactants[1], miniCanvas.width, miniCanvas.height);
            } else {
                reactant1Display.innerHTML = '<p class="placeholder">Draw a molecule or search PubChem</p>';
            }
        }

        // Update Reactant 2 display
        const reactant2Display = document.getElementById('reactant-2-display');
        if (reactant2Display) {
            reactant2Display.innerHTML = '';
            if (this.reactants[2] && this.reactants[2].atoms.length > 0) {
                const miniCanvas = document.createElement('canvas');
                miniCanvas.width = 200;
                miniCanvas.height = 150;
                miniCanvas.style.border = '1px solid #e5e7eb';
                miniCanvas.style.borderRadius = '4px';
                reactant2Display.appendChild(miniCanvas);
                const ctx = miniCanvas.getContext('2d');
                this.renderMiniMolecule(ctx, this.reactants[2], miniCanvas.width, miniCanvas.height);
            } else {
                reactant2Display.innerHTML = '<p class="placeholder">Optional second reactant</p>';
            }
        }

        this.updateReagentsList();
    }

    /**
     * Render molecule on small canvas
     */
    renderMiniMolecule(ctx, molecule, width, height) {
        ctx.clearRect(0, 0, width, height);

        if (!molecule || !molecule.atoms || molecule.atoms.length === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No molecule', width / 2, height / 2);
            return;
        }

        // Calculate bounds - handle both position.x/y and x/y properties
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        molecule.atoms.forEach(atom => {
            const x = atom.x !== undefined ? atom.x : (atom.position?.x || 0);
            const y = atom.y !== undefined ? atom.y : (atom.position?.y || 0);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });

        // Calculate scale to fit
        const molWidth = maxX - minX || 100;
        const molHeight = maxY - minY || 100;
        const padding = 20;
        const scaleX = (width - padding * 2) / molWidth;
        const scaleY = (height - padding * 2) / molHeight;
        const scale = Math.min(scaleX, scaleY, 1);

        // Center offset
        const offsetX = (width - molWidth * scale) / 2 - minX * scale;
        const offsetY = (height - molHeight * scale) / 2 - minY * scale;

        // Draw bonds with basic multi-bond styling
        const baseOffset = Math.max(1.5, Math.min(4, 6 / (scale + 0.2)));
        const drawBond = (startX, startY, endX, endY, offset = 0) => {
            const dx = endX - startX;
            const dy = endY - startY;
            const length = Math.hypot(dx, dy) || 1;
            const ox = (-dy / length) * offset;
            const oy = (dx / length) * offset;

            ctx.beginPath();
            ctx.moveTo(startX + ox, startY + oy);
            ctx.lineTo(endX + ox, endY + oy);
            ctx.stroke();
        };

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;

        if (molecule.bonds) {
            molecule.bonds.forEach(bond => {
                const atom1 = molecule.atoms.find(a => a.id === bond.atom1);
                const atom2 = molecule.atoms.find(a => a.id === bond.atom2);
                if (!atom1 || !atom2) return;

                const atom1X = atom1.x !== undefined ? atom1.x : (atom1.position?.x || 0);
                const atom1Y = atom1.y !== undefined ? atom1.y : (atom1.position?.y || 0);
                const atom2X = atom2.x !== undefined ? atom2.x : (atom2.position?.x || 0);
                const atom2Y = atom2.y !== undefined ? atom2.y : (atom2.position?.y || 0);

                const startX = atom1X * scale + offsetX;
                const startY = atom1Y * scale + offsetY;
                const endX = atom2X * scale + offsetX;
                const endY = atom2Y * scale + offsetY;

                if (bond.order === 3) {
                    drawBond(startX, startY, endX, endY, 0);
                    drawBond(startX, startY, endX, endY, baseOffset);
                    drawBond(startX, startY, endX, endY, -baseOffset);
                } else if (bond.order === 2) {
                    drawBond(startX, startY, endX, endY, baseOffset * 0.6);
                    drawBond(startX, startY, endX, endY, -baseOffset * 0.6);
                } else {
                    drawBond(startX, startY, endX, endY, 0);
                }
            });
        }

        // Draw atoms with skeletal notation
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Helper to determine if carbon label should be shown
        const shouldShowCarbonLabel = (atom) => {
            if (atom.element !== 'C') return true;
            if (Math.abs(atom.charge || 0) > 0.1) return true;
            
            const bonds = molecule.bonds ? molecule.bonds.filter(b => 
                b.atom1 === atom.id || b.atom2 === atom.id
            ) : [];
            
            // Show if terminal (1 bond) or has multiple bonds
            if (bonds.length <= 1) return true;
            if (bonds.some(b => b.order > 1)) return true;
            
            // Show if connected to heteroatoms
            const hasHeteroatoms = bonds.some(bond => {
                const otherId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
                const otherAtom = molecule.atoms.find(a => a.id === otherId);
                return otherAtom && otherAtom.element !== 'C' && otherAtom.element !== 'H';
            });
            
            if (hasHeteroatoms) return true;
            
            // Show if has explicit hydrogens
            const hasExplicitH = bonds.some(bond => {
                const otherId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
                const otherAtom = molecule.atoms.find(a => a.id === otherId);
                return otherAtom && otherAtom.element === 'H';
            });
            
            return hasExplicitH;
        };

        molecule.atoms.forEach(atom => {
            const atomX = atom.x !== undefined ? atom.x : (atom.position?.x || 0);
            const atomY = atom.y !== undefined ? atom.y : (atom.position?.y || 0);
            const x = atomX * scale + offsetX;
            const y = atomY * scale + offsetY;

            // Draw circle for non-carbon atoms
            if (atom.element !== 'C') {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            // Draw label only if needed (skeletal notation)
            if (shouldShowCarbonLabel(atom)) {
            ctx.fillStyle = atom.element === 'C' ? '#333' : '#667eea';
            ctx.fillText(atom.element, x, y);
            }
        });
    }

    /**
     * Predict products based on reaction using PubChem when possible
     */
    async predictProducts() {
        if (!this.currentReaction || !this.reactants[1]) {
            this.showNotification('Please add at least Reactant 1', 'warning');
            return;
        }

        const productsList = document.getElementById('products-list');
        if (!productsList) return;

        // Get reagents and conditions
        const reagents = this.currentReaction.reagents || [];
        const conditions = [];
        const solvent = document.getElementById('solvent-select')?.value;
        const temp = parseInt(document.getElementById('temp-input')?.value) || 25;
        
        if (solvent) conditions.push(solvent);
        if (temp > 100) conditions.push('heat');

        console.log('🧪 Predicting products for reagents:', reagents, 'conditions:', conditions);

        // VALIDATE REACTION FIRST
        const primaryReactant = this.reactants[1];
        this.validationResult = this.validator.validateReaction(
            primaryReactant,
            reagents,
            conditions,
            null // Let validator determine reaction type
        );

        console.log('🔍 Validation result:', this.validationResult);

        // Clear previous results
        productsList.innerHTML = '<div class="pubchem-status loading">🔬 Predicting products...</div>';

        // Display validation results
        this.displayValidationResults(productsList, this.validationResult);

        // If not valid, stop here
        if (!this.validationResult.valid) {
            document.getElementById('reaction-type').textContent = 'Invalid';
            document.getElementById('predicted-yield').textContent = '0%';
            document.getElementById('reaction-difficulty').textContent = 'Cannot proceed';
            return;
        }

        // Only proceed if validation passed
        console.log('✅ Validation passed! Performing reaction...');

        // Try PubChem for product prediction (search by formula/name, not SMILES)
        let productMolecule = null;
        const pubchemProduct = null;

        // Note: PubChem doesn't support reaction prediction via API
        // We'll use the local reaction engine for product prediction
        // PubChem integration is better suited for searching/reactant import
        console.log('⚗️ Using local reaction engine for product prediction...');
        
        // Use local reaction engine for product prediction
        productMolecule = this.reactionManager.performReaction(
            primaryReactant,
            reagents,
            conditions
        );
        
        // Future enhancement: Could search PubChem for known products by formula/name
        // after generating the product structure to validate/improve the prediction

        console.log('✅ Product generated:', productMolecule);

    // Determine final reaction classification for display
    const reactionType = this.validator.determineReactionType(reagents);

        // Add success message
        const successMsg = document.createElement('div');
        successMsg.className = 'validation-success';
        successMsg.style.cssText = 'background: #d1fae5; color: #065f46; padding: 10px; border-radius: 4px; margin-bottom: 15px; border-left: 4px solid #10b981;';
        successMsg.innerHTML = `
            <strong>✅ Reaction Valid!</strong><br>
            <span style="font-size: 12px;">Success probability: ${this.validationResult.score}%</span>
        `;
        productsList.appendChild(successMsg);

        // Show original reactant snapshot for comparison
        this.renderReactantSnapshot(productsList);

    // Smart product rendering with auto-layout
    this.renderProductMolecule(productsList, productMolecule, reactionType);

        // Update reaction info
        document.getElementById('reaction-type').textContent = reactionType;
        document.getElementById('predicted-yield').textContent = this.validationResult.score + '%';
        document.getElementById('reaction-difficulty').textContent = 
            this.validationResult.score > 80 ? 'Easy' : 
            this.validationResult.score > 60 ? 'Intermediate' : 'Advanced';

        console.log('✅ Products predicted and displayed');
    }

    /**
     * Render snapshot of the original reactant for comparison
     */
    renderReactantSnapshot(container) {
        if (!this.currentReaction) return;

        const reactantCard = document.createElement('div');
        reactantCard.className = 'reactant-snapshot';
        reactantCard.style.cssText = `
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 12px;
            background: #f9fafb;
            margin-bottom: 12px;
        `;

        const title = document.createElement('div');
        title.style.cssText = 'font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; margin-bottom: 6px;';
        title.textContent = 'Reactant Snapshot';
        reactantCard.appendChild(title);

        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 240;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.background = '#ffffff';
        canvas.style.border = '1px solid #e5e7eb';
        canvas.style.borderRadius = '6px';

        const ctx = canvas.getContext('2d');
        const reactantClone = JSON.parse(JSON.stringify(this.currentReaction.reactant));
        this.renderEnhancedMolecule(ctx, reactantClone, canvas.width, canvas.height);

        reactantCard.appendChild(canvas);
        container.appendChild(reactantCard);
    }

    /**
     * Smart product molecule rendering with auto-layout
     */
    renderProductMolecule(container, molecule, reactionType) {
        // Create product container
        const productContainer = document.createElement('div');
        productContainer.className = 'product-molecule-container';
        productContainer.style.cssText = `
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            background: white;
            margin-bottom: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;

    // Apply smart layout to product molecule
    const laidOutMolecule = this.applySmartLayout(molecule);

        // Create larger canvas for better detail
        const productCanvas = document.createElement('canvas');
        productCanvas.width = 400;
        productCanvas.height = 300;
        productCanvas.style.display = 'block';
        productCanvas.style.margin = '0 auto';
        productCanvas.style.cursor = 'pointer';
        productCanvas.title = 'Click to view in detail';
        
        const ctx = productCanvas.getContext('2d');
        
        // Render with enhanced styling
        this.renderEnhancedMolecule(ctx, laidOutMolecule, productCanvas.width, productCanvas.height);
        
        productContainer.appendChild(productCanvas);

        // Add product details
        const detailsDiv = document.createElement('div');
        detailsDiv.style.cssText = 'margin-top: 12px; text-align: center;';
        
        // Detect changes from reactant
        const changes = this.detectMolecularChanges(this.currentReaction.reactant, molecule);
        
        detailsDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <div style="background: #f3f4f6; padding: 8px; border-radius: 4px;">
                    <div style="font-size: 11px; color: #6b7280;">Atoms</div>
                    <div style="font-size: 18px; font-weight: bold; color: #333;">${molecule.atoms.length}</div>
                </div>
                <div style="background: #f3f4f6; padding: 8px; border-radius: 4px;">
                    <div style="font-size: 11px; color: #6b7280;">Bonds</div>
                    <div style="font-size: 18px; font-weight: bold; color: #333;">${molecule.bonds.length}</div>
                </div>
                <div style="background: #f3f4f6; padding: 8px; border-radius: 4px;">
                    <div style="font-size: 11px; color: #6b7280;">Changes</div>
                    <div style="font-size: 18px; font-weight: bold; color: #10b981;">${changes.totalChanges}</div>
                </div>
            </div>
            ${changes.description ? `
                <div style="background: #dbeafe; color: #1e40af; padding: 10px; border-radius: 4px; font-size: 12px; border-left: 3px solid #3b82f6;">
                    <strong>🔬 Transformation:</strong> ${changes.description}
                </div>
            ` : ''}
        `;
        
        productContainer.appendChild(detailsDiv);

        // Add interactive buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 8px; justify-content: center; margin-top: 12px;';
        
        buttonContainer.innerHTML = `
            <button onclick="reactionUI.copyProductToCanvas()" class="action-btn" style="font-size: 12px; padding: 6px 12px;">
                📋 Copy to Canvas
            </button>
            <button onclick="reactionUI.compareBeforeAfter()" class="action-btn" style="font-size: 12px; padding: 6px 12px;">
                🔄 Compare
            </button>
            <button onclick="reactionUI.highlightChanges()" class="action-btn" style="font-size: 12px; padding: 6px 12px;">
                ✨ Highlight Changes
            </button>
        `;
        
        productContainer.appendChild(buttonContainer);
        container.appendChild(productContainer);

        // Store product for later use
        this.lastProduct = laidOutMolecule;
    }

    /**
     * Apply smart layout to molecule for better visualization
     */
    applySmartLayout(molecule) {
        // Clone molecule to avoid modifying original
        const layoutMol = JSON.parse(JSON.stringify(molecule));
        
        // If atoms don't have good positions, generate them
        const needsLayout = layoutMol.atoms.some(a => 
            a.x === undefined || a.y === undefined || 
            layoutMol.atoms.filter(b => Math.abs(a.x - b.x) < 5 && Math.abs(a.y - b.y) < 5).length > 1
        );

        if (needsLayout) {
            console.log('🎨 Applying smart layout to product molecule');
            
            // Use force-directed layout
            const engine = new MoleculeLayoutEngine();
            engine.setEnabled(true);
            const { atoms: newAtoms } = engine.layout({ atoms: layoutMol.atoms, bonds: layoutMol.bonds });
            
            // Update positions
            layoutMol.atoms.forEach((atom, i) => {
                if (newAtoms[i]) {
                    atom.x = newAtoms[i].x;
                    atom.y = newAtoms[i].y;
                }
            });
        }

        return layoutMol;
    }

    /**
     * Render molecule with enhanced styling and detail
     */
    renderEnhancedMolecule(ctx, molecule, width, height) {
        ctx.clearRect(0, 0, width, height);

        if (!molecule || !molecule.atoms || molecule.atoms.length === 0) {
            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No product generated', width / 2, height / 2);
            return;
        }

        // Calculate bounds with padding
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        molecule.atoms.forEach(atom => {
            const x = atom.x !== undefined ? atom.x : (atom.position?.x || 0);
            const y = atom.y !== undefined ? atom.y : (atom.position?.y || 0);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });

        // Smart scaling
        const molWidth = maxX - minX || 100;
        const molHeight = maxY - minY || 100;
        const padding = 40;
        const scaleX = (width - padding * 2) / molWidth;
        const scaleY = (height - padding * 2) / molHeight;
        const scale = Math.min(scaleX, scaleY, 2); // Allow zoom up to 2x

        // Center offset
        const offsetX = (width - molWidth * scale) / 2 - minX * scale;
        const offsetY = (height - molHeight * scale) / 2 - minY * scale;

        // Draw bonds with different styles for different orders
        if (molecule.bonds) {
            molecule.bonds.forEach(bond => {
                const atom1 = molecule.atoms.find(a => a.id === bond.atom1);
                const atom2 = molecule.atoms.find(a => a.id === bond.atom2);

                if (atom1 && atom2) {
                    const atom1X = atom1.x !== undefined ? atom1.x : (atom1.position?.x || 0);
                    const atom1Y = atom1.y !== undefined ? atom1.y : (atom1.position?.y || 0);
                    const atom2X = atom2.x !== undefined ? atom2.x : (atom2.position?.x || 0);
                    const atom2Y = atom2.y !== undefined ? atom2.y : (atom2.position?.y || 0);
                    
                    const x1 = atom1X * scale + offsetX;
                    const y1 = atom1Y * scale + offsetY;
                    const x2 = atom2X * scale + offsetX;
                    const y2 = atom2Y * scale + offsetY;

                    ctx.strokeStyle = '#2c3e50';
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';

                    if (bond.order === 1) {
                        // Single bond
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    } else if (bond.order === 2) {
                        // Double bond
                        const angle = Math.atan2(y2 - y1, x2 - x1);
                        const offset = 4;
                        const dx = Math.sin(angle) * offset;
                        const dy = -Math.cos(angle) * offset;

                        ctx.beginPath();
                        ctx.moveTo(x1 + dx, y1 + dy);
                        ctx.lineTo(x2 + dx, y2 + dy);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.moveTo(x1 - dx, y1 - dy);
                        ctx.lineTo(x2 - dx, y2 - dy);
                        ctx.stroke();
                    } else if (bond.order === 3) {
                        // Triple bond
                        const angle = Math.atan2(y2 - y1, x2 - x1);
                        const offset = 5;
                        const dx = Math.sin(angle) * offset;
                        const dy = -Math.cos(angle) * offset;

                        // Center line
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();

                        // Side lines
                        ctx.beginPath();
                        ctx.moveTo(x1 + dx, y1 + dy);
                        ctx.lineTo(x2 + dx, y2 + dy);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.moveTo(x1 - dx, y1 - dy);
                        ctx.lineTo(x2 - dx, y2 - dy);
                        ctx.stroke();
                    }
                }
            });
        }

        // Draw atoms with element-specific colors
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const elementColors = {
            'C': '#2c3e50',
            'H': '#95a5a6',
            'O': '#e74c3c',
            'N': '#3498db',
            'S': '#f39c12',
            'P': '#9b59b6',
            'F': '#1abc9c',
            'Cl': '#16a085',
            'Br': '#d35400',
            'I': '#8e44ad'
        };

        molecule.atoms.forEach(atom => {
            const x = atom.x * scale + offsetX;
            const y = atom.y * scale + offsetY;

            const color = elementColors[atom.element] || '#34495e';

            // Draw background circle for visibility
            if (atom.element !== 'C') {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(x, y, 16, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Draw element label
            ctx.fillStyle = color;
            ctx.fillText(atom.element, x, y);

            // Draw implicit hydrogens for non-carbon
            if (atom.element !== 'C' && atom.element !== 'H') {
                const connectedBonds = molecule.bonds.filter(b => 
                    b.atom1 === atom.id || b.atom2 === atom.id
                );
                const bondOrderSum = connectedBonds.reduce((sum, b) => sum + (b.order || 1), 0);
                
                const valence = { 'O': 2, 'N': 3, 'S': 2, 'P': 5, 'F': 1, 'Cl': 1, 'Br': 1, 'I': 1 };
                const implicitH = (valence[atom.element] || 0) - bondOrderSum;
                
                if (implicitH > 0) {
                    ctx.font = 'bold 12px Arial';
                    ctx.fillStyle = '#7f8c8d';
                    ctx.fillText(`H${implicitH > 1 ? implicitH : ''}`, x + 20, y + 15);
                }
            }
        });

        // Draw subtle grid for reference
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);
        
        for (let i = 0; i < width; i += 50) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, height);
            ctx.stroke();
        }
        
        for (let i = 0; i < height; i += 50) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(width, i);
            ctx.stroke();
        }
        
        ctx.setLineDash([]);
    }

    /**
     * Detect changes between reactant and product
     */
    detectMolecularChanges(reactant, product) {
        const changes = {
            totalChanges: 0,
            atomsAdded: product.atoms.length - reactant.atoms.length,
            bondsChanged: 0,
            description: ''
        };

        // Count bond order changes
        const reactantBonds = new Map();
        reactant.bonds.forEach(b => {
            const key = `${Math.min(b.atom1, b.atom2)}-${Math.max(b.atom1, b.atom2)}`;
            reactantBonds.set(key, b.order || 1);
        });

        product.bonds.forEach(b => {
            const key = `${Math.min(b.atom1, b.atom2)}-${Math.max(b.atom1, b.atom2)}`;
            const oldOrder = reactantBonds.get(key);
            if (oldOrder && oldOrder !== (b.order || 1)) {
                changes.bondsChanged++;
            }
        });

        changes.totalChanges = Math.abs(changes.atomsAdded) + changes.bondsChanged;

        // Generate description
        if (changes.atomsAdded > 0) {
            changes.description = `Added ${changes.atomsAdded} atom(s)`;
        } else if (changes.atomsAdded < 0) {
            changes.description = `Removed ${Math.abs(changes.atomsAdded)} atom(s)`;
        }
        
        if (changes.bondsChanged > 0) {
            changes.description += (changes.description ? ' and ' : '') + 
                `modified ${changes.bondsChanged} bond(s)`;
        }

        return changes;
    }

    /**
     * Copy product molecule to main canvas
     */
    copyProductToCanvas() {
        if (!this.lastProduct) {
            alert('⚠️ No product to copy');
            return;
        }

        console.log('📋 Copying product to canvas...');
        
        // Access main molecule through global reference
        if (typeof molecule !== 'undefined' && molecule) {
            // Clear current molecule
            molecule.atoms = [];
            molecule.bonds = [];
            
            // Copy product atoms and bonds
            this.lastProduct.atoms.forEach(atom => {
                molecule.atoms.push({ ...atom });
            });
            
            this.lastProduct.bonds.forEach(bond => {
                molecule.bonds.push({ ...bond });
            });
            
            // Re-render
            if (typeof renderer !== 'undefined' && renderer) {
                renderer.render(molecule);
            }
            
            // Switch to draw tab
            document.querySelector('[data-tab="draw"]')?.click();
            
            console.log('✅ Product copied to canvas');
            alert('✅ Product copied to canvas! Switch to Draw tab to see it.');
        }
    }

    /**
     * Show before/after comparison
     */
    compareBeforeAfter() {
        if (!this.currentReaction || !this.lastProduct) return;

        // Create modal for comparison
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 900px;
            width: 90%;
        `;

        content.innerHTML = `
            <h3 style="margin-bottom: 20px; text-align: center;">🔄 Before & After Comparison</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h4 style="text-align: center; color: #667eea;">Reactant</h4>
                    <canvas id="compare-reactant" width="350" height="250" style="border: 2px solid #667eea; border-radius: 8px;"></canvas>
                </div>
                <div>
                    <h4 style="text-align: center; color: #10b981;">Product</h4>
                    <canvas id="compare-product" width="350" height="250" style="border: 2px solid #10b981; border-radius: 8px;"></canvas>
                </div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="action-btn primary" style="margin-top: 20px; width: 100%;">Close</button>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Render both molecules
        setTimeout(() => {
            const reactantCtx = document.getElementById('compare-reactant').getContext('2d');
            const productCtx = document.getElementById('compare-product').getContext('2d');
            
            this.renderEnhancedMolecule(reactantCtx, this.currentReaction.reactant, 350, 250);
            this.renderEnhancedMolecule(productCtx, this.lastProduct, 350, 250);
        }, 50);

        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    /**
     * Highlight changes in product
     */
    highlightChanges() {
        if (!this.lastProduct || !this.currentReaction) {
            alert('⚠️ No product to highlight');
            return;
        }

        console.log('✨ Highlighting changes...');
        
        // Create modal with highlighted view
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 800px;
            width: 90%;
        `;

        content.innerHTML = `
            <h3 style="margin-bottom: 20px; text-align: center;">✨ Changes Highlighted</h3>
            <canvas id="highlight-canvas" width="700" height="500" style="border: 2px solid #e5e7eb; border-radius: 8px; display: block; margin: 0 auto;"></canvas>
            <div style="margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
                <h4 style="margin-bottom: 10px;">Legend:</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 13px;">
                    <div><span style="color: #10b981;">●</span> New atoms</div>
                    <div><span style="color: #ef4444;">●</span> Removed atoms</div>
                    <div><span style="color: #3b82f6;">▬</span> Changed bonds</div>
                </div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="action-btn primary" style="margin-top: 20px; width: 100%;">Close</button>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Render with highlights
        setTimeout(() => {
            const canvas = document.getElementById('highlight-canvas');
            const ctx = canvas.getContext('2d');
            this.renderWithHighlights(ctx, this.currentReaction.reactant, this.lastProduct, 700, 500);
        }, 50);

        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    /**
     * Render molecule with changes highlighted
     */
    renderWithHighlights(ctx, reactant, product, width, height) {
        ctx.clearRect(0, 0, width, height);
        
        // Calculate bounds for product
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        product.atoms.forEach(atom => {
            minX = Math.min(minX, atom.x);
            maxX = Math.max(maxX, atom.x);
            minY = Math.min(minY, atom.y);
            maxY = Math.max(maxY, atom.y);
        });

        const molWidth = maxX - minX || 100;
        const molHeight = maxY - minY || 100;
        const padding = 60;
        const scaleX = (width - padding * 2) / molWidth;
        const scaleY = (height - padding * 2) / molHeight;
        const scale = Math.min(scaleX, scaleY, 2.5);

        const offsetX = (width - molWidth * scale) / 2 - minX * scale;
        const offsetY = (height - molHeight * scale) / 2 - minY * scale;

    // Identify changes
    const reactantAtomIds = new Set(reactant.atoms.map(a => a.id));
    const productAtomIds = new Set(product.atoms.map(a => a.id));
    const newAtoms = product.atoms.filter(a => !reactantAtomIds.has(a.id));
    const removedAtoms = reactant.atoms.filter(a => !productAtomIds.has(a.id));

        // Map reactant bonds
        const reactantBondMap = new Map();
        reactant.bonds.forEach(b => {
            const key = `${Math.min(b.atom1, b.atom2)}-${Math.max(b.atom1, b.atom2)}`;
            reactantBondMap.set(key, b.order || 1);
        });

        // Draw bonds with highlights for changes
        product.bonds.forEach(bond => {
            const atom1 = product.atoms.find(a => a.id === bond.atom1);
            const atom2 = product.atoms.find(a => a.id === bond.atom2);

            if (atom1 && atom2) {
                const x1 = atom1.x * scale + offsetX;
                const y1 = atom1.y * scale + offsetY;
                const x2 = atom2.x * scale + offsetX;
                const y2 = atom2.y * scale + offsetY;

                const bondKey = `${Math.min(bond.atom1, bond.atom2)}-${Math.max(bond.atom1, bond.atom2)}`;
                const oldOrder = reactantBondMap.get(bondKey);
                const orderChanged = oldOrder && oldOrder !== (bond.order || 1);
                const isNewBond = !oldOrder;

                // Highlight changed bonds in blue
                if (orderChanged || isNewBond) {
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 5;
                    ctx.shadowColor = '#3b82f6';
                    ctx.shadowBlur = 10;
                } else {
                    ctx.strokeStyle = '#2c3e50';
                    ctx.lineWidth = 3;
                    ctx.shadowBlur = 0;
                }

                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        });

        // Draw atoms with highlights
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const elementColors = {
            'C': '#2c3e50', 'H': '#95a5a6', 'O': '#e74c3c', 
            'N': '#3b82f6', 'S': '#f39c12', 'Br': '#d35400', 'Cl': '#16a085'
        };

        product.atoms.forEach(atom => {
            const x = atom.x * scale + offsetX;
            const y = atom.y * scale + offsetY;
            const isNew = newAtoms.some(a => a.id === atom.id);
            const color = elementColors[atom.element] || '#34495e';

            // Draw glow for new atoms
            if (isNew) {
                ctx.shadowColor = '#10b981';
                ctx.shadowBlur = 20;
                ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
                ctx.beginPath();
                ctx.arc(x, y, 25, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            // Draw background circle
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 18, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = isNew ? '#10b981' : color;
            ctx.lineWidth = isNew ? 3 : 2;
            ctx.stroke();

            // Draw element label
            ctx.fillStyle = isNew ? '#10b981' : color;
            ctx.fillText(atom.element, x, y);
        });

        // Draw removed atoms as translucent markers
        removedAtoms.forEach((atom, index) => {
            const x = 80 + index * 60;
            const y = height - 70;

            ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
            ctx.beginPath();
            ctx.arc(x, y, 18, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.strokeStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(x - 10, y - 10);
            ctx.lineTo(x + 10, y + 10);
            ctx.moveTo(x + 10, y - 10);
            ctx.lineTo(x - 10, y + 10);
            ctx.stroke();

            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 14px Arial';
            ctx.fillText(atom.element, x, y);
        });
    }

    /**
     * Display validation results (errors, warnings, suggestions)
     */
    displayValidationResults(container, validation) {
        // Display errors
        if (validation.errors.length > 0) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'validation-errors';
            errorDiv.style.cssText = 'background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 4px; margin-bottom: 10px; border-left: 4px solid #ef4444;';
            errorDiv.innerHTML = `
                <strong style="display: block; margin-bottom: 8px;">⛔ Reaction Cannot Proceed:</strong>
                ${validation.errors.map(err => `<div style="margin: 4px 0; font-size: 13px;">• ${err}</div>`).join('')}
            `;
            container.appendChild(errorDiv);
        }

        // Display warnings
        if (validation.warnings.length > 0) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'validation-warnings';
            warningDiv.style.cssText = 'background: #fef3c7; color: #92400e; padding: 12px; border-radius: 4px; margin-bottom: 10px; border-left: 4px solid #f59e0b;';
            warningDiv.innerHTML = `
                <strong style="display: block; margin-bottom: 8px;">⚠️ Important Considerations:</strong>
                ${validation.warnings.map(warn => `<div style="margin: 4px 0; font-size: 13px;">• ${warn}</div>`).join('')}
            `;
            container.appendChild(warningDiv);
        }

        // Display suggestions
        if (validation.suggestions.length > 0) {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.className = 'validation-suggestions';
            suggestionDiv.style.cssText = 'background: #dbeafe; color: #1e40af; padding: 12px; border-radius: 4px; margin-bottom: 10px; border-left: 4px solid #3b82f6;';
            suggestionDiv.innerHTML = `
                <strong style="display: block; margin-bottom: 8px;">💡 Suggestions:</strong>
                ${validation.suggestions.map(sug => `<div style="margin: 4px 0; font-size: 13px;">• ${sug}</div>`).join('')}
            `;
            container.appendChild(suggestionDiv);
        }
    }

    /**
     * Determine reaction type from reagents
     */
    determineReactionType(reagentTypes) {
        if (reagentTypes.includes('reducing')) return 'Reduction';
        if (reagentTypes.includes('oxidizing')) return 'Oxidation';
        if (reagentTypes.includes('halogenating')) return 'Halogenation';
        if (reagentTypes.includes('acid')) return 'Acid-Catalyzed';
        if (reagentTypes.includes('base')) return 'Base-Catalyzed';
        return 'Substitution/Addition';
    }

    /**
     * Clone molecule
     */
    cloneMolecule(molecule) {
        return {
            atoms: molecule.atoms.map(a => ({ ...a })),
            bonds: molecule.bonds.map(b => ({ ...b }))
        };
    }

    /**
     * Display reaction mechanism
     */
    displayMechanism() {
        const mechDisplay = document.getElementById('mechanism-display');
        if (!mechDisplay || !this.currentReaction) return;

        // Get reagent types to determine mechanism
        const reagentTypes = this.currentReaction.reagents.map(rKey => {
            return this.reactionManager.getReagentLibrary()[rKey]?.type;
        }).filter(t => t);

        if (reagentTypes.length === 0) {
            mechDisplay.innerHTML = '<p class="placeholder">⚠️ Add reagents to see mechanism</p>';
            return;
        }

        // Generate mechanism steps based on reagent types
        const steps = this.generateMechanismSteps(reagentTypes);

        let html = '<div class="mechanism-steps">';
        
        steps.forEach((step, index) => {
            html += `
                <div class="step">
                    <div class="step-number">${index + 1}</div>
                    <div class="step-content">
                        <h5>${step.title}</h5>
                        <p>${step.description}</p>
                        <div class="step-visual">
                            <canvas class="mechanism-canvas" data-step="${index}" width="300" height="100"></canvas>
                        </div>
                    </div>
                </div>
            `;
            
            if (index < steps.length - 1) {
                html += '<div class="mechanism-arrow">↓</div>';
            }
        });

        html += '</div>';
        mechDisplay.innerHTML = html;

        // Draw mechanism visuals on each canvas
        setTimeout(() => {
            steps.forEach((step, index) => {
                const canvas = mechDisplay.querySelector(`canvas[data-step="${index}"]`);
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    this.drawMechanismStep(ctx, step, canvas.width, canvas.height);
                }
            });
        }, 100);

        console.log('✅ Mechanism displayed with', steps.length, 'steps');
    }

    /**
     * Generate mechanism steps based on reagent types
     */
    generateMechanismSteps(reagentTypes) {
        const steps = [];

        if (reagentTypes.includes('reducing')) {
            steps.push({
                title: 'Nucleophilic Attack',
                description: 'Hydride (H⁻) attacks the carbonyl carbon',
                type: 'attack'
            });
            steps.push({
                title: 'Tetrahedral Intermediate',
                description: 'Formation of alkoxide intermediate',
                type: 'intermediate'
            });
            steps.push({
                title: 'Protonation',
                description: 'Water adds proton to oxygen, forming alcohol',
                type: 'product'
            });
        } else if (reagentTypes.includes('oxidizing')) {
            steps.push({
                title: 'Hydrogen Abstraction',
                description: 'Oxidizing agent removes hydrogen from alcohol',
                type: 'attack'
            });
            steps.push({
                title: 'Formation of Carbonyl',
                description: 'Double bond forms between carbon and oxygen',
                type: 'product'
            });
        } else if (reagentTypes.includes('halogenating')) {
            steps.push({
                title: 'Electrophilic Addition',
                description: 'Halogen adds to double bond',
                type: 'attack'
            });
            steps.push({
                title: 'Carbocation Formation',
                description: 'Intermediate carbocation forms',
                type: 'intermediate'
            });
            steps.push({
                title: 'Nucleophilic Attack',
                description: 'Second halogen attacks carbocation',
                type: 'product'
            });
        } else if (reagentTypes.includes('acid')) {
            steps.push({
                title: 'Protonation',
                description: 'Acid protonates the substrate',
                type: 'attack'
            });
            steps.push({
                title: 'Carbocation Formation',
                description: 'Good leaving group departs',
                type: 'intermediate'
            });
            steps.push({
                title: 'Nucleophilic Attack',
                description: 'Nucleophile attacks carbocation',
                type: 'product'
            });
        } else {
            steps.push({
                title: 'Step 1',
                description: 'Reaction initiation',
                type: 'attack'
            });
            steps.push({
                title: 'Step 2',
                description: 'Product formation',
                type: 'product'
            });
        }

        return steps;
    }

    /**
     * Draw mechanism step visualization
     */
    drawMechanismStep(ctx, step, width, height) {
        ctx.clearRect(0, 0, width, height);

        // Background
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, width, height);

        // Draw simplified representation
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const centerY = height / 2;

        if (step.type === 'attack') {
            // Draw curved arrow
            ctx.strokeStyle = '#667eea';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(50, centerY + 10);
            ctx.quadraticCurveTo(100, centerY - 20, 150, centerY);
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            ctx.moveTo(150, centerY);
            ctx.lineTo(145, centerY - 5);
            ctx.lineTo(145, centerY + 5);
            ctx.closePath();
            ctx.fillStyle = '#667eea';
            ctx.fill();

            // Labels
            ctx.fillStyle = '#333';
            ctx.fillText('Nu:', 30, centerY + 10);
            ctx.fillText('C=O', 170, centerY);
        } else if (step.type === 'intermediate') {
            // Draw intermediate structure
            ctx.strokeStyle = '#f59e0b';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(width / 2, centerY, 30, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#f59e0b';
            ctx.fillText('Intermediate', width / 2, centerY);
        } else {
            // Draw product
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(width / 2, centerY, 25, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#10b981';
            ctx.fillText('Product', width / 2, centerY);
        }
    }

    /**
     * Update real-time validation status display
     */
    updateValidationStatus() {
        if (!this.currentReaction) return;

        const statusDiv = document.getElementById('validation-status');
        if (!statusDiv) return;

        // Get current conditions
        const reagents = this.currentReaction.reagents;
        const conditions = [];
        const solvent = document.getElementById('solvent-select')?.value;
        const temp = parseInt(document.getElementById('temp-input')?.value) || 25;
        
        if (solvent) conditions.push(solvent);
        if (temp > 100) conditions.push('heat');

        // Validate
        const validation = this.validator.validateReaction(
            this.currentReaction.reactant,
            reagents,
            conditions,
            null
        );

        // Display compact status
        let statusHTML = '';
        
        if (reagents.length === 0) {
            statusHTML = `
                <div style="background: #f3f4f6; color: #6b7280; padding: 8px; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                    ℹ️ Add reagents to begin
                </div>
            `;
        } else if (!validation.valid) {
            statusHTML = `
                <div style="background: #fee2e2; color: #991b1b; padding: 8px; border-radius: 4px; font-size: 12px; margin-bottom: 10px; border-left: 3px solid #ef4444;">
                    <strong>❌ Invalid</strong> - ${validation.errors[0]}
                </div>
            `;
        } else {
            const scoreColor = validation.score > 80 ? '#10b981' : validation.score > 60 ? '#f59e0b' : '#ef4444';
            statusHTML = `
                <div style="background: ${scoreColor}20; color: ${scoreColor}; padding: 8px; border-radius: 4px; font-size: 12px; margin-bottom: 10px; border-left: 3px solid ${scoreColor};">
                    <strong>✅ Valid</strong> - Success: ${validation.score}%
                    ${validation.warnings.length > 0 ? `<br><span style="font-size: 11px;">⚠️ ${validation.warnings[0]}</span>` : ''}
                </div>
            `;
        }

        statusDiv.innerHTML = statusHTML;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReactionUI;
}
