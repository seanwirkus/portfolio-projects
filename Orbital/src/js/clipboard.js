// Clipboard and SMILES Export System
// Handles copy/paste operations with SMILES format for AI/ChatGPT compatibility

class ClipboardManager {
    constructor() {
        this.copiedMolecule = null;
    }
    
    // Generate SMILES string from molecule (simplified - basic implementation)
    generateSMILES(molecule) {
        if (!molecule || molecule.atoms.length === 0) {
            return '';
        }
        
        try {
            // Simple SMILES generation for common structures
            const visited = new Set();
            const smiles = [];
            
            // Start with first carbon or any atom
            const startAtom = molecule.atoms[0];
            this.buildSMILES(startAtom, molecule, visited, smiles, null);
            
            return smiles.join('');
        } catch (error) {
            console.error('SMILES generation error:', error);
            return this.fallbackToJSON(molecule);
        }
    }
    
    buildSMILES(atom, molecule, visited, smiles, fromBond) {
        if (visited.has(atom.id)) return;
        visited.add(atom.id);
        
        // Add element (skip C in organic style)
        if (atom.element !== 'C' && atom.element !== 'H') {
            smiles.push(atom.element);
        } else if (atom.element === 'C') {
            const bonds = molecule.getAtomBonds(atom.id);
            const carbons = bonds.filter(b => {
                const other = molecule.getAtomById(b.atom1 === atom.id ? b.atom2 : b.atom1);
                return other && other.element === 'C';
            });
            
            // Explicitly write C if: charged, has double/triple bonds, or branches
            if (atom.charge !== 0 || bonds.some(b => b.order > 1) || carbons.length > 2) {
                smiles.push('C');
            }
        }
        
        // Add charge if present
        if (atom.charge > 0) {
            smiles.push(`+${atom.charge > 1 ? atom.charge : ''}`);
        } else if (atom.charge < 0) {
            smiles.push(`${atom.charge < -1 ? atom.charge : '-'}`);
        }
        
        // Get bonds
        const bonds = molecule.getAtomBonds(atom.id).filter(b => b !== fromBond);
        
        // Sort bonds: single first, then double, then triple
        bonds.sort((a, b) => a.order - b.order);
        
        // Process bonds
        bonds.forEach((bond, index) => {
            const otherAtomId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
            const otherAtom = molecule.getAtomById(otherAtomId);
            
            if (!otherAtom || visited.has(otherAtom.id)) return;
            
            // Add bond symbol
            if (bond.order === 2) {
                smiles.push('=');
            } else if (bond.order === 3) {
                smiles.push('#');
            }
            
            // Branch notation
            if (index > 0) {
                smiles.push('(');
            }
            
            this.buildSMILES(otherAtom, molecule, visited, smiles, bond);
            
            if (index > 0) {
                smiles.push(')');
            }
        });
    }
    
    fallbackToJSON(molecule) {
        // Fallback: return JSON representation
        return JSON.stringify({
            atoms: molecule.atoms.map(a => ({
                element: a.element,
                x: Math.round(a.x),
                y: Math.round(a.y),
                charge: a.charge || 0
            })),
            bonds: molecule.bonds.map(b => ({
                atom1: b.atom1,
                atom2: b.atom2,
                order: b.order
            }))
        });
    }
    
    // Copy molecule to clipboard (SMILES + JSON)
    async copyMolecule(molecule) {
        if (!molecule || molecule.atoms.length === 0) {
            console.log('Nothing to copy');
            return false;
        }
        
        const smiles = this.generateSMILES(molecule);
        const json = this.fallbackToJSON(molecule);
        const formula = molecule.getMolecularFormula();
        const mw = molecule.getMolecularWeight();
        
        // Create comprehensive text for ChatGPT/AI
        const aiText = `Chemical Structure:
SMILES: ${smiles}
Molecular Formula: ${formula}
Molecular Weight: ${typeof mw === 'number' ? mw.toFixed(2) : mw} g/mol
Atoms: ${molecule.atoms.length}
Bonds: ${molecule.bonds.length}

Structure Data (JSON):
${json}

Note: This structure can be analyzed, modified, or used for reaction predictions.`;
        
        try {
            // Copy to clipboard
            await navigator.clipboard.writeText(aiText);
            
            // Store for internal paste
            this.copiedMolecule = {
                atoms: JSON.parse(JSON.stringify(molecule.atoms)),
                bonds: JSON.parse(JSON.stringify(molecule.bonds))
            };
            
            console.log('✓ Copied to clipboard (SMILES + JSON format)');
            this.showNotification('Copied to clipboard!', 'success');
            return true;
        } catch (error) {
            console.error('Copy failed:', error);
            this.showNotification('Copy failed', 'error');
            return false;
        }
    }
    
    // Paste molecule from clipboard
    pasteMolecule(targetMolecule, offsetX = 50, offsetY = 50) {
        if (!this.copiedMolecule) {
            console.log('Nothing to paste');
            return false;
        }
        
        try {
            const atomIdMap = {};
            
            // Add atoms with offset
            this.copiedMolecule.atoms.forEach(atom => {
                const newAtom = targetMolecule.addAtom(
                    atom.element,
                    atom.x + offsetX,
                    atom.y + offsetY
                );
                atomIdMap[atom.id] = newAtom.id;
                
                if (atom.charge) {
                    newAtom.charge = atom.charge;
                }
            });
            
            // Add bonds
            this.copiedMolecule.bonds.forEach(bond => {
                const newAtom1 = atomIdMap[bond.atom1];
                const newAtom2 = atomIdMap[bond.atom2];
                
                if (newAtom1 && newAtom2) {
                    targetMolecule.addBond(newAtom1, newAtom2, bond.order);
                }
            });
            
            console.log('✓ Pasted molecule');
            this.showNotification('Pasted from clipboard!', 'success');
            return true;
        } catch (error) {
            console.error('Paste failed:', error);
            this.showNotification('Paste failed', 'error');
            return false;
        }
    }
    
    // Cut molecule (copy + clear)
    async cutMolecule(molecule) {
        const copied = await this.copyMolecule(molecule);
        if (copied) {
            molecule.clear();
            this.showNotification('Cut to clipboard!', 'success');
            return true;
        }
        return false;
    }
    
    // Handle copy to clipboard with SMILES format
    handleCopy(molecule) {
        try {
            const smiles = this.generateSMILES(molecule);
            navigator.clipboard.writeText(smiles).then(() => {
                this.showNotification('Copied as SMILES to clipboard', 'success');
            }).catch(err => {
                console.error('Clipboard write error:', err);
                this.showNotification('Failed to copy to clipboard', 'error');
            });
        } catch (error) {
            console.error('Copy error:', error);
            this.showNotification('Copy operation failed', 'error');
        }
    }
    
    // Handle paste from clipboard
    handlePaste(molecule) {
        navigator.clipboard.readText().then(text => {
            try {
                // Try to parse as SMILES first
                if (this.isProbablySMILES(text)) {
                    this.parseSMILES(text, molecule);
                    this.showNotification('Pasted SMILES structure', 'success');
                } else if (this.isProbablyJSON(text)) {
                    // Try JSON format
                    this.parseJSON(text, molecule);
                    this.showNotification('Pasted molecular structure', 'success');
                } else {
                    this.showNotification('Unrecognized format (SMILES or JSON expected)', 'warning');
                }
            } catch (error) {
                console.error('Paste parse error:', error);
                this.showNotification('Failed to parse pasted content', 'error');
            }
        }).catch(err => {
            console.error('Clipboard read error:', err);
            this.showNotification('Failed to read from clipboard', 'error');
        });
    }
    
    // Check if text looks like SMILES
    isProbablySMILES(text) {
        // Basic SMILES pattern: contains element symbols, bonds, brackets
        const smilesPattern = /^[A-Za-z0-9\[\]()=\-#@%+\\\/]+$/;
        return smilesPattern.test(text.trim()) && text.length > 0;
    }
    
    // Check if text looks like JSON
    isProbablyJSON(text) {
        try {
            JSON.parse(text);
            return true;
        } catch {
            return false;
        }
    }
    
    // Parse SMILES string (basic implementation)
    parseSMILES(smiles, molecule) {
        if (!smiles || smiles.trim().length === 0) return;
        
        // This is a simplified SMILES parser
        // For production use, integrate with a library like smilesjs
        const atoms = [];
        const bonds = [];
        let currentAtom = null;
        let x = 100;
        const y = 100;
        
        const chars = smiles.trim().split('');
        
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            const nextChar = chars[i + 1];
            
            // Parse elements
            if (char.match(/[A-Z]/)) {
                const element = nextChar && char + nextChar === char.toUpperCase() + nextChar.toLowerCase() 
                    ? char + nextChar 
                    : char;
                
                if (nextChar && element.length === 2) i++;
                
                const atom = { id: atoms.length, element, x, y };
                atoms.push(atom);
                
                if (currentAtom !== null) {
                    bonds.push({ atom1: currentAtom, atom2: atoms.length - 1, order: 1 });
                }
                
                currentAtom = atoms.length - 1;
                x += 40;
            }
            // Parse bonds
            else if (char === '=' || char === '#' || char === '-') {
                const order = char === '=' ? 2 : char === '#' ? 3 : 1;
                const nextElement = chars[i + 1];
                if (nextElement && nextElement.match(/[A-Z]/)) {
                    bonds.push({ atom1: currentAtom, atom2: atoms.length, order });
                }
            }
        }
        
        // Add atoms to molecule
        molecule.atoms = [];
        molecule.bonds = [];
        atoms.forEach(atom => {
            molecule.addAtom(atom.element, atom.x, atom.y);
        });
        bonds.forEach(bond => {
            if (bond.atom1 >= 0 && bond.atom2 >= 0) {
                molecule.addBond(bond.atom1, bond.atom2, bond.order);
            }
        });
    }
    
    // Parse JSON format
    parseJSON(jsonText, molecule) {
        try {
            const data = JSON.parse(jsonText);
            molecule.atoms = [];
            molecule.bonds = [];
            
            if (data.atoms) {
                data.atoms.forEach(atom => {
                    molecule.addAtom(atom.element || 'C', atom.x || 100, atom.y || 100);
                });
            }
            
            if (data.bonds && data.atoms) {
                data.bonds.forEach(bond => {
                    molecule.addBond(bond.atom1, bond.atom2, bond.order || 1);
                });
            }
        } catch (error) {
            console.error('JSON parse error:', error);
            throw error;
        }
    }
    
    // Export as various formats
    exportAsSMILES(molecule) {
        return this.generateSMILES(molecule);
    }
    
    exportAsJSON(molecule) {
        return this.fallbackToJSON(molecule);
    }
    
    exportAsMolFile(molecule) {
        // Generate MOL file format (V2000)
        let molFile = `
  Orbital Chemistry Tool

  0  0  0  0  0  0  0  0  0  0999 V2000
`;
        
        // Atom block
        molecule.atoms.forEach(atom => {
            const x = (atom.x / 50).toFixed(4).padStart(10);
            const y = (atom.y / 50).toFixed(4).padStart(10);
            const z = '0.0000'.padStart(10);
            const element = atom.element.padEnd(3);
            
            molFile += `${x}${y}${z} ${element} 0  ${atom.charge}  0  0  0  0  0  0  0  0  0\n`;
        });
        
        // Bond block
        molecule.bonds.forEach(bond => {
            const atom1Idx = molecule.atoms.findIndex(a => a.id === bond.atom1) + 1;
            const atom2Idx = molecule.atoms.findIndex(a => a.id === bond.atom2) + 1;
            
            molFile += `${atom1Idx.toString().padStart(3)}${atom2Idx.toString().padStart(3)}${bond.order.toString().padStart(3)}  0  0  0  0\n`;
        });
        
        molFile += 'M  END\n';
        return molFile;
    }
    
    // Show notification
    showNotification(message, type = 'info') {
        const notif = document.createElement('div');
        notif.className = `clipboard-notification ${type}`;
        notif.textContent = message;
        notif.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notif.remove(), 300);
        }, 2000);
    }
}

// Add CSS for notification animation (check if not already present)
if (!document.querySelector('style[data-clipboard-notify]')) {
    const clipboardStyle = document.createElement('style');
    clipboardStyle.setAttribute('data-clipboard-notify', 'true');
    clipboardStyle.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    document.head.appendChild(clipboardStyle);
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClipboardManager;
}
