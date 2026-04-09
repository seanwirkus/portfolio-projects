// PubChemService - fetch and translate compound data into Orbital-friendly templates

class PubChemService {
    constructor(options = {}) {
        this.baseUrl = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
        this.searchLimit = options.searchLimit || 10;
        this.coordinateScale = options.coordinateScale || 28;
        this.atomicNumberMap = this.buildAtomicNumberMap();
        this.lastError = null;
    }

    buildAtomicNumberMap() {
        return {
            1: 'H', 2: 'He', 3: 'Li', 4: 'Be', 5: 'B', 6: 'C', 7: 'N', 8: 'O', 9: 'F', 10: 'Ne',
            11: 'Na', 12: 'Mg', 13: 'Al', 14: 'Si', 15: 'P', 16: 'S', 17: 'Cl', 18: 'Ar',
            19: 'K', 20: 'Ca', 21: 'Sc', 22: 'Ti', 23: 'V', 24: 'Cr', 25: 'Mn', 26: 'Fe',
            27: 'Co', 28: 'Ni', 29: 'Cu', 30: 'Zn', 31: 'Ga', 32: 'Ge', 33: 'As', 34: 'Se',
            35: 'Br', 36: 'Kr', 53: 'I', 80: 'Hg'
        };
    }

    async searchCompounds(query, limit = this.searchLimit) {
        if (!query || query.trim().length < 2) {
            return [];
        }

        const cleanedQuery = query.trim();

        try {
            const cids = await this.fetchCids(cleanedQuery);
            if (!cids.length) {
                return [];
            }

            const limited = cids.slice(0, limit);
            const properties = await this.fetchProperties(limited);
            return properties.map(prop => ({
                cid: prop.CID,
                name: prop.Title || prop.IUPACName || `CID ${prop.CID}`,
                formula: prop.MolecularFormula || null,
                iupac: prop.IUPACName || null,
                molecularWeight: prop.MolecularWeight || null,
                smiles: prop.CanonicalSMILES || null
            }));
        } catch (error) {
            this.lastError = error;
            console.error('PubChem search error:', error);
            throw error;
        }
    }

    async fetchCids(query) {
        const url = `${this.baseUrl}/compound/name/${encodeURIComponent(query)}/cids/JSON?name_type=word`; // broadens the match window
        const data = await this.fetchJson(url, 'Unable to reach PubChem for CID lookup.');
        const list = data?.IdentifierList?.CID;
        return Array.isArray(list) ? list : [];
    }

    async fetchProperties(cids) {
        if (!Array.isArray(cids) || cids.length === 0) {
            return [];
        }
        const joined = cids.join(',');
        const url = `${this.baseUrl}/compound/cid/${joined}/property/Title,IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES/JSON`;
        const data = await this.fetchJson(url, 'Unable to load PubChem compound properties.');
        const props = data?.PropertyTable?.Properties;
        return Array.isArray(props) ? props : [];
    }

    async fetchCompoundStructure(cid) {
        if (!cid) {
            throw new Error('Missing CID for PubChem structure request.');
        }

        const url = `${this.baseUrl}/compound/cid/${cid}/record/JSON?record_type=2d&response_type=display`;
        const data = await this.fetchJson(url, `Unable to load PubChem record for CID ${cid}.`);
        const compound = data?.PC_Compounds?.[0];
        if (!compound) {
            throw new Error(`PubChem returned no compound data for CID ${cid}.`);
        }

        return this.parseCompoundRecord(cid, compound);
    }

    parseCompoundRecord(cid, compound) {
        const aids = compound?.atoms?.aid || [];
        const elements = compound?.atoms?.element || [];
        const coordsBlock = compound?.coords?.[0]?.conformers?.[0] || {};
        const xs = coordsBlock.x || [];
        const ys = coordsBlock.y || [];

        const atoms = [];
        const idMap = new Map();
        const unmappedElements = [];

        aids.forEach((aid, index) => {
            const atomicNumber = elements[index];
            const symbol = this.mapAtomicNumber(atomicNumber);
            if (!symbol) {
                unmappedElements.push(atomicNumber);
                return;
            }

            const atomId = `a${aid}`;
            const x = (xs[index] ?? 0) * this.coordinateScale;
            const y = (ys[index] ?? 0) * -this.coordinateScale; // invert y to match canvas orientation

            atoms.push({
                id: atomId,
                element: symbol,
                position: { x, y },
                charge: 0
            });
            idMap.set(aid, atomId);
        });

        const bonds = [];
        const bondAid1 = compound?.bonds?.aid1 || [];
        const bondAid2 = compound?.bonds?.aid2 || [];
        const bondOrders = compound?.bonds?.order || [];

        bondAid1.forEach((aid1, index) => {
            const aid2 = bondAid2[index];
            const mapped1 = idMap.get(aid1);
            const mapped2 = idMap.get(aid2);
            if (!mapped1 || !mapped2) {
                return;
            }

            bonds.push({
                atom1: mapped1,
                atom2: mapped2,
                order: this.translateBondOrder(bondOrders[index])
            });
        });

        const metadata = {
            cid,
            title: this.extractProperty(compound.props, 'Title'),
            iupacName: this.extractProperty(compound.props, 'IUPAC Name'),
            molecularFormula: this.extractProperty(compound.props, 'Molecular Formula'),
            molecularWeight: this.extractProperty(compound.props, 'Molecular Weight'),
            canonicalSmiles: this.extractProperty(compound.props, 'SMILES', 'Canonical'),
            unmappedElements
        };

        const name = metadata.title || metadata.iupacName || `CID ${cid}`;
        const formula = metadata.molecularFormula || null;

        return {
            cid,
            name,
            formula,
            atoms,
            bonds,
            metadata
        };
    }

    extractProperty(props, label, name) {
        if (!Array.isArray(props)) {
            return null;
        }

        const entry = props.find(prop => {
            const urn = prop?.urn;
            if (!urn) return false;
            if (urn.label !== label) return false;
            if (name && urn.name !== name) return false;
            return true;
        });

        if (!entry || !entry.value) {
            return null;
        }

        const value = entry.value;
        if (typeof value.sval === 'string') return value.sval;
        if (typeof value.fval === 'number') return value.fval;
        if (typeof value.ival === 'number') return value.ival;
        if (Array.isArray(value.slist)) return value.slist.join(', ');
        return null;
    }

    mapAtomicNumber(number) {
        if (typeof number !== 'number') {
            return null;
        }
        return this.atomicNumberMap[number] || null;
    }

    translateBondOrder(order) {
        if (order === 2) return 2;
        if (order === 3) return 3;
        if (order === 4) return 1; // aromatic bonds arrive as 4 in PubChem
        if (order === 1 || order === 0) return 1;
        return 1;
    }

    async fetchJson(url, errorMessage) {
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) {
            throw new Error(errorMessage || `PubChem request failed (${response.status}).`);
        }
        return response.json();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PubChemService };
}
