// Periodic Table Loader - Loads comprehensive element data from JSON
// This allows easy expansion and offline functionality

class PeriodicTableLoader {
    constructor() {
        this.elements = new Map();
        this.loaded = false;
    }

    /**
     * Load periodic table data from JSON file
     */
    async loadPeriodicTable(jsonPath = 'src/data/periodic-table.json') {
        try {
            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to load periodic table: ${response.status}`);
            }
            const data = await response.json();
            
            // Build element map for fast lookup
            data.elements.forEach(element => {
                this.elements.set(element.symbol, element);
            });
            
            this.loaded = true;
            console.log(`✓ Loaded ${this.elements.size} elements from periodic table`);
            return true;
        } catch (error) {
            console.error('Failed to load periodic table:', error);
            // Fall back to existing ELEMENTS object
            this.loadFromExisting();
            return false;
        }
    }

    /**
     * Load from existing ELEMENTS object (fallback)
     */
    loadFromExisting() {
        if (typeof ELEMENTS !== 'undefined') {
            Object.keys(ELEMENTS).forEach(symbol => {
                const element = ELEMENTS[symbol];
                this.elements.set(symbol, {
                    symbol: symbol,
                    name: element.name,
                    atomicMass: element.atomicMass,
                    electronegativity: element.electronegativity,
                    valence: element.valence,
                    radius: element.radius,
                    color: element.color,
                    lonePairs: element.lonePairs,
                    commonHybridizations: element.commonHybridizations || []
                });
            });
            this.loaded = true;
            console.log(`✓ Loaded ${this.elements.size} elements from existing data`);
        }
    }

    /**
     * Get element by symbol
     */
    getElement(symbol) {
        return this.elements.get(symbol) || null;
    }

    /**
     * Get all elements
     */
    getAllElements() {
        return Array.from(this.elements.values());
    }

    /**
     * Get elements by category
     */
    getElementsByCategory(category) {
        return this.getAllElements().filter(el => el.category === category);
    }

    /**
     * Get elements by group
     */
    getElementsByGroup(group) {
        return this.getAllElements().filter(el => el.group === group);
    }

    /**
     * Get elements by period
     */
    getElementsByPeriod(period) {
        return this.getAllElements().filter(el => el.period === period);
    }

    /**
     * Search elements by name or symbol
     */
    searchElements(query) {
        const lowerQuery = query.toLowerCase();
        return this.getAllElements().filter(el => 
            el.name.toLowerCase().includes(lowerQuery) ||
            el.symbol.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Merge periodic table data into existing ELEMENTS object
     */
    mergeIntoElements() {
        if (!this.loaded) return;

        this.elements.forEach((element, symbol) => {
            if (typeof ELEMENTS !== 'undefined') {
                // Update or add element
                ELEMENTS[symbol] = {
                    name: element.name,
                    symbol: element.symbol,
                    valence: element.valence,
                    electronegativity: element.electronegativity,
                    atomicMass: element.atomicMass,
                    color: element.color,
                    radius: element.radius,
                    lonePairs: element.lonePairs,
                    commonHybridizations: element.commonHybridizations || [],
                    // Additional properties
                    atomicNumber: element.atomicNumber,
                    group: element.group,
                    period: element.period,
                    block: element.block,
                    category: element.category,
                    electronConfiguration: element.electronConfiguration,
                    ionizationEnergy: element.ionizationEnergy,
                    electronAffinity: element.electronAffinity,
                    commonOxidationStates: element.commonOxidationStates,
                    covalentRadius: element.covalentRadius,
                    vanDerWaalsRadius: element.vanDerWaalsRadius
                };
            }
        });

        console.log(`✓ Merged ${this.elements.size} elements into ELEMENTS object`);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PeriodicTableLoader;
}

