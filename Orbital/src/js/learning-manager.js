// LearningManager - lightweight knowledge base for user-provided chemistry problems

class LearningManager {
    constructor(storageKey = 'orbitalLearningLog') {
        this.storageKey = storageKey;
        this.entries = [];
        this.load();
    }

    load() {
        try {
            const storage = typeof window !== 'undefined' ? window.localStorage : null;
            const raw = storage ? storage.getItem(this.storageKey) : null;
            if (raw) {
                const data = JSON.parse(raw);
                if (Array.isArray(data)) {
                    this.entries = data;
                }
            }
        } catch (error) {
            console.warn('LearningManager: unable to load stored entries', error);
            this.entries = [];
        }
    }

    save() {
        try {
            const storage = typeof window !== 'undefined' ? window.localStorage : null;
            if (storage) {
                storage.setItem(this.storageKey, JSON.stringify(this.entries));
            }
        } catch (error) {
            console.warn('LearningManager: unable to persist entries', error);
        }
    }

    tokenizeReagents(reagentText) {
        if (!reagentText) return [];
        return reagentText
            .split(/[,;/]+/)
            .map(token => token.trim().toLowerCase())
            .filter(token => token.length > 0);
    }

    addEntry({ problem, reagent = '', solution, insight = '' }) {
        if (!problem || !solution) {
            return null;
        }

        const entry = {
            id: `learning_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            problem,
            solution,
            insight,
            reagentLabel: reagent.trim(),
            reagents: this.tokenizeReagents(reagent),
            createdAt: new Date().toISOString()
        };

        this.entries.unshift(entry);
        this.save();
        return entry;
    }

    getEntries() {
        return [...this.entries];
    }

    findSuggestions({ reagent }) {
        if (!reagent) return [];
        const needle = reagent.toLowerCase();

        return this.entries.filter(entry => {
            const matchesReagent = entry.reagents?.includes(needle);
            const matchesProblem = entry.problem?.toLowerCase().includes(needle);
            const matchesSolution = entry.solution?.toLowerCase().includes(needle);
            return matchesReagent || matchesProblem || matchesSolution;
        }).slice(0, 3);
    }
}
