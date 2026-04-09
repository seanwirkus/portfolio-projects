// SVG-based Mechanism Renderer
// Generates interactive mechanism diagrams with electron flow arrows

class MechanismRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.svg = null;
        this.currentStep = 0;
        this.animationSpeed = 1000; // ms per step
        this.scaleFactor = 1.0;
        this.activeStep = 0;
    }
    
    // Create SVG canvas for mechanism
    initializeSVG(width = 1400, height = 800) {
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.style.background = '#ffffff';
        this.svg.style.border = '2px solid #ddd';
        this.svg.style.borderRadius = '8px';
        
        // Add defs for arrow markers
        this.createArrowMarkers();
        
        this.container.innerHTML = '';
        this.container.appendChild(this.svg);
    }
    
    // Create reusable arrow markers for electron flow
    createArrowMarkers() {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        // Main arrow for reaction equations
        const mainMarker = this.createMarker('arrowhead-main', '#667eea', 12, 12);
        defs.appendChild(mainMarker);
        
        // Blue arrow for nucleophilic attack
        const blueMarker = this.createMarker('arrow-blue', '#0066cc');
        defs.appendChild(blueMarker);
        
        // Red arrow for electrophilic attack
        const redMarker = this.createMarker('arrow-red', '#cc0066');
        defs.appendChild(redMarker);
        
        // Green arrow for bond formation
        const greenMarker = this.createMarker('arrow-green', '#009900');
        defs.appendChild(greenMarker);
        
        // Purple arrow for resonance
        const purpleMarker = this.createMarker('arrow-purple', '#9900cc');
        defs.appendChild(purpleMarker);
        
        this.svg.appendChild(defs);
    }
    
    createMarker(id, color, width = 10, height = 10) {
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', id);
        marker.setAttribute('markerWidth', width);
        marker.setAttribute('markerHeight', height);
        marker.setAttribute('refX', width - 1);
        marker.setAttribute('refY', height / 2);
        marker.setAttribute('orient', 'auto');
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', `0 0, ${width} ${height/2}, 0 ${height}`);
        polygon.setAttribute('fill', color);
        
        marker.appendChild(polygon);
        return marker;
    }
    
    // Render full mechanism from database
    renderMechanism(reactionData, moleculeData, options = {}) {
        try {
            if (!reactionData || !reactionData.mechanism) {
                console.error('Invalid reaction data');
                return;
            }
            
            this.currentMechanism = reactionData;
            this.currentOptions = options;
            const canvasWidth = 2000;
            const canvasHeight = 1000;
            this.initializeSVG(canvasWidth, canvasHeight); // Larger canvas for bigger molecules
            this.activeStep = Math.max(0, options.activeStep || 0);
            
            const { mechanism, name } = reactionData;
            
            // Add title
            this.addTitle(name, 1000, 50);
            
            // Better spacing for organic equations with larger molecules
            const startX = 200;
            const yCenter = 450;
            const arrowWidth = 220;
            const moleculeSpacing = 120;
            
            // Draw starting material (reactant)
            if (moleculeData && moleculeData.reactant) {
                this.drawMoleculeStructure(moleculeData.reactant, startX, yCenter, 'Reactant', 3.5);
            }
            
            // Calculate positions
            let currentX = startX + moleculeSpacing;
            
            // Draw reaction arrow with reagent
            const arrowY = yCenter;
            this.drawReactionArrow(currentX, arrowY, currentX + arrowWidth, arrowY, reactionData);
            
            currentX += arrowWidth + moleculeSpacing;
            
            // Draw product
            if (moleculeData && moleculeData.product) {
                this.drawMoleculeStructure(moleculeData.product, currentX, yCenter, 'Product', 3.5);
            }
            
            // Draw mechanism electron flow overview beneath main arrow
            if (mechanism && mechanism.length > 0) {
                const arrowBaseY = yCenter + 260;
                const availableWidth = canvasWidth - 400;
                const arrowSpacing = Math.min(360, Math.max(180, availableWidth / Math.max(1, mechanism.length)));
                const arrowStart = startX;
                mechanism.forEach((step, index) => {
                    const stepStart = arrowStart + index * arrowSpacing * 0.9;
                    this.drawMechanismArrow(stepStart, arrowBaseY, stepStart + arrowSpacing * 0.6, arrowBaseY, step, index);
                });
            }

            // Add mechanism steps description at bottom
            this.addMechanismSteps(reactionData, 50, 480);
            this.setActiveStep(this.activeStep, true);
            
            console.log('✓ Mechanism rendered successfully');
        } catch (error) {
            console.error('🔥 Error rendering mechanism:', error);
            if (this.container) {
                this.container.innerHTML = `<div style="padding: 20px; color: #ff0000; text-align: center;">
                    <h3>Error rendering mechanism</h3>
                    <p>${error.message}</p>
                </div>`;
            }
        }
    }
    
    // Draw a reaction arrow with reagent and conditions
    drawReactionArrow(x1, y, x2, y2, reactionData) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Main arrow line
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        arrow.setAttribute('x1', x1);
        arrow.setAttribute('y1', y);
        arrow.setAttribute('x2', x2);
        arrow.setAttribute('y2', y);
        arrow.setAttribute('stroke', '#667eea');
        arrow.setAttribute('stroke-width', '4');
        arrow.setAttribute('marker-end', 'url(#arrowhead-main)');
        group.appendChild(arrow);
        
        // Reagent label above arrow
        if (reactionData.reagents && reactionData.reagents.length > 0) {
            const reagentText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            reagentText.setAttribute('x', (x1 + x2) / 2);
            reagentText.setAttribute('y', y - 15);
            reagentText.setAttribute('text-anchor', 'middle');
            reagentText.setAttribute('font-size', '16');
            reagentText.setAttribute('font-weight', '600');
            reagentText.setAttribute('fill', '#667eea');
            reagentText.textContent = reactionData.reagents.join(', ');
            group.appendChild(reagentText);
        }
        
        // Conditions label below arrow
        if (reactionData.conditions) {
            const condText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            condText.setAttribute('x', (x1 + x2) / 2);
            condText.setAttribute('y', y + 25);
            condText.setAttribute('text-anchor', 'middle');
            condText.setAttribute('font-size', '14');
            condText.setAttribute('fill', '#666');
            condText.textContent = reactionData.conditions;
            group.appendChild(condText);
        }
        
        this.svg.appendChild(group);
    }
    
    // Draw molecule structure from atom/bond data
    drawMoleculeStructure(molecule, centerX, centerY, label, scale = 1.5) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'molecule-structure');
        
        // Label with better styling
        const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        labelBg.setAttribute('x', centerX - 50);
        labelBg.setAttribute('y', centerY - 140);
        labelBg.setAttribute('width', '100');
        labelBg.setAttribute('height', '24');
        labelBg.setAttribute('fill', '#f0f4ff');
        labelBg.setAttribute('stroke', '#667eea');
        labelBg.setAttribute('stroke-width', '2');
        labelBg.setAttribute('rx', '6');
        group.appendChild(labelBg);
        
        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.setAttribute('x', centerX);
        labelText.setAttribute('y', centerY - 122);
        labelText.setAttribute('text-anchor', 'middle');
        labelText.setAttribute('font-size', '13');
        labelText.setAttribute('font-weight', '600');
        labelText.setAttribute('fill', '#667eea');
        labelText.textContent = label;
        group.appendChild(labelText);
        
        // Convert molecule data to SVG paths
        if (molecule && molecule.atoms && molecule.atoms.length > 0) {
            // Draw bonds first (so they appear behind atoms)
            if (molecule.bonds && molecule.bonds.length > 0) {
                molecule.bonds.forEach(bond => {
                    const atom1 = molecule.atoms.find(a => a.id === bond.atom1);
                    const atom2 = molecule.atoms.find(a => a.id === bond.atom2);
                    
                    if (atom1 && atom2) {
                        this.drawBond(
                            group,
                            centerX + (atom1.position.x - 90) * scale,
                            centerY + (atom1.position.y - 100) * scale,
                            centerX + (atom2.position.x - 90) * scale,
                            centerY + (atom2.position.y - 100) * scale,
                            bond.order
                        );
                    }
                });
            }
            
            // Draw atoms with proper scaling
            molecule.atoms.forEach((atom, index) => {
                const atomGroup = this.drawAtom(
                    group,
                    atom.element,
                    centerX + (atom.position.x - 90) * scale,
                    centerY + (atom.position.y - 100) * scale,
                    atom.charge || 0
                );
                
                // Add subtle entrance animation
                if (atomGroup) {
                    atomGroup.style.opacity = '0';
                    atomGroup.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        atomGroup.style.transition = 'all 0.3s ease-out';
                        atomGroup.style.opacity = '1';
                        atomGroup.style.transform = 'scale(1)';
                    }, 50 + index * 30);
                }
            });
        } else {
            // Placeholder for empty structure
            const placeholder = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            placeholder.setAttribute('x', centerX - 60);
            placeholder.setAttribute('y', centerY - 80);
            placeholder.setAttribute('width', '120');
            placeholder.setAttribute('height', '120');
            placeholder.setAttribute('fill', '#fafbfc');
            placeholder.setAttribute('stroke', '#e0e0e0');
            placeholder.setAttribute('stroke-width', '2');
            placeholder.setAttribute('stroke-dasharray', '5,5');
            placeholder.setAttribute('rx', '8');
            group.appendChild(placeholder);
            
            const placeholderText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            placeholderText.setAttribute('x', centerX);
            placeholderText.setAttribute('y', centerY);
            placeholderText.setAttribute('text-anchor', 'middle');
            placeholderText.setAttribute('font-size', '12');
            placeholderText.setAttribute('fill', '#999');
            placeholderText.textContent = 'No structure';
            group.appendChild(placeholderText);
        }
        
        this.svg.appendChild(group);
    }
    
    // Draw bonds with proper order (single, double, triple)
    drawBond(parent, x1, y1, x2, y2, order) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const perpX = -dy / length;
        const perpY = dx / length;
        const offset = 6;
        
        if (order === 1) {
            // Single bond - thicker and more visible
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', '#222');
            line.setAttribute('stroke-width', '6');
            line.setAttribute('stroke-linecap', 'round');
            parent.appendChild(line);
        } else if (order === 2) {
            // Double bond
            for (let i = -1; i <= 1; i += 2) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x1 + perpX * offset * i);
                line.setAttribute('y1', y1 + perpY * offset * i);
                line.setAttribute('x2', x2 + perpX * offset * i);
                line.setAttribute('y2', y2 + perpY * offset * i);
                line.setAttribute('stroke', '#222');
                line.setAttribute('stroke-width', '6');
                line.setAttribute('stroke-linecap', 'round');
                parent.appendChild(line);
            }
        } else if (order === 3) {
            // Triple bond
            for (let i = -1; i <= 1; i++) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x1 + perpX * offset * i);
                line.setAttribute('y1', y1 + perpY * offset * i);
                line.setAttribute('x2', x2 + perpX * offset * i);
                line.setAttribute('y2', y2 + perpY * offset * i);
                line.setAttribute('stroke', '#222');
                line.setAttribute('stroke-width', '6');
                line.setAttribute('stroke-linecap', 'round');
                parent.appendChild(line);
            }
        }
    }
    
    // Draw atom with element symbol and charge
    drawAtom(parent, element, x, y, charge) {
        const atomGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        atomGroup.setAttribute('class', 'atom-group');
        
        const colors = {
            'C': '#222', 'H': '#666', 'O': '#ff4444', 'N': '#4444ff',
            'S': '#ffaa00', 'P': '#ff9900', 'F': '#44ff44', 'Cl': '#44ff44',
            'Br': '#aa4400', 'I': '#800080', 'Mg': '#999'
        };
        
        // Always draw a visible circle for atoms in mechanism diagrams
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', element === 'C' ? '12' : '18');
        circle.setAttribute('fill', element === 'C' ? '#222' : '#fff');
        circle.setAttribute('stroke', colors[element] || '#000');
        circle.setAttribute('stroke-width', '2.5');
        circle.setAttribute('class', 'atom-circle');
        atomGroup.appendChild(circle);
        
        // Element symbol (always show for non-H atoms)
        if (element !== 'H') {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y + 6);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', element === 'C' ? '14' : '18');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('fill', element === 'C' ? '#fff' : colors[element] || '#000');
            text.textContent = element;
            atomGroup.appendChild(text);
        }
        
        // Charge indicator
        if (charge !== 0) {
            const chargeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            chargeText.setAttribute('x', x + 18);
            chargeText.setAttribute('y', y - 10);
            chargeText.setAttribute('font-size', '14');
            chargeText.setAttribute('fill', charge > 0 ? '#ff4444' : '#4444ff');
            chargeText.setAttribute('font-weight', 'bold');
            chargeText.textContent = charge > 0 ? `+${charge > 1 ? charge : ''}` : `${charge < -1 ? charge : '−'}`;
            atomGroup.appendChild(chargeText);
        }
        
        parent.appendChild(atomGroup);
        return atomGroup;
    }
    
    // Draw curved arrow showing electron flow
    drawMechanismArrow(x1, y1, x2, y2, step, stepIndex) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `mechanism-arrow step-${stepIndex}`);
        group.setAttribute('opacity', '0'); // Start invisible for animation
        group.dataset.stepIndex = stepIndex;
        
        // Choose color based on step type
        const color = this.getArrowColor(step.electronFlow[0]?.type);
        
        // Draw each electron flow arrow
        step.electronFlow.forEach((flow, flowIndex) => {
            const flowColor = this.getArrowColor(flow.type);
            
            // Create curved path for arrow with unique curve
            const controlY = y1 - 60 - (flowIndex * 20);
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${controlY} ${x2} ${y2}`;
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', flowColor);
            path.setAttribute('stroke-width', '3');
            path.setAttribute('class', 'electron-flow-arrow');
            
            // Add animated arrow marker
            const markerId = `arrow-${flowColor.replace('#', '')}`;
            path.setAttribute('marker-end', `url(#${markerId})`);
            
            // Add animation attributes
            const pathLength = path.getTotalLength ? path.getTotalLength() : 200;
            path.style.strokeDasharray = pathLength;
            path.style.strokeDashoffset = pathLength;
            
            group.appendChild(path);
        });
        
        // Step label with background
        const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        labelBg.setAttribute('x', (x1 + x2) / 2 - 80);
        labelBg.setAttribute('y', y1 - 85);
        labelBg.setAttribute('width', '160');
        labelBg.setAttribute('height', '25');
        labelBg.setAttribute('fill', '#fff');
        labelBg.setAttribute('stroke', color);
        labelBg.setAttribute('stroke-width', '2');
        labelBg.setAttribute('rx', '6');
        labelBg.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))';
        group.appendChild(labelBg);
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', (x1 + x2) / 2);
        label.setAttribute('y', y1 - 65);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '13');
        label.setAttribute('font-weight', 'bold');
        label.setAttribute('fill', color);
        label.textContent = `${stepIndex + 1}. ${step.title}`;
        group.appendChild(label);
        
        // Description below with better styling
        const desc = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        desc.setAttribute('x', (x1 + x2) / 2);
        desc.setAttribute('y', y1 - 45);
        desc.setAttribute('text-anchor', 'middle');
        desc.setAttribute('font-size', '11');
        desc.setAttribute('fill', '#666');
        desc.setAttribute('font-style', 'italic');
        
        // Word wrap description
        const words = step.description.split(' ');
        let line = '';
        const maxWidth = 35;
        
        for (let i = 0; i < words.length; i++) {
            if ((line + words[i]).length > maxWidth && line.length > 0) {
                break;
            }
            line += words[i] + ' ';
        }
        desc.textContent = line.trim() + (words.length > line.split(' ').length ? '...' : '');
        group.appendChild(desc);
        
        this.svg.appendChild(group);
    }
    
    // Get arrow color based on electron flow type
    getArrowColor(flowType) {
        const colorMap = {
            'nucleophilic_attack': '#0066cc',
            'deprotonation': '#0066cc',
            'electrophilic_attack': '#cc0066',
            'bond_formation': '#009900',
            'bond_cleavage': '#cc0066',
            'pi_bond_formation': '#009900',
            'resonance_delocalization': '#9900cc',
            'heterolytic_cleavage': '#cc0066',
            'hydride_transfer': '#0066cc',
            'electron_push': '#9900cc'
        };
        return colorMap[flowType] || '#333';
    }
    
    // Add title text
    addTitle(text, x, y) {
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', x);
        title.setAttribute('y', y);
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-size', '24');
        title.setAttribute('font-weight', 'bold');
        title.setAttribute('fill', '#333');
        title.textContent = text;
        this.svg.appendChild(title);
    }
    
    // Add mechanism summary at bottom
    addMechanismSummary(reactionData, x, y) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Reagents
        const reagentText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        reagentText.setAttribute('x', x);
        reagentText.setAttribute('y', y);
        reagentText.setAttribute('text-anchor', 'middle');
        reagentText.setAttribute('font-size', '14');
        reagentText.setAttribute('fill', '#666');
        reagentText.textContent = `Reagents: ${reactionData.reagents.join(', ')}`;
        group.appendChild(reagentText);
        
        // Conditions
        const condText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        condText.setAttribute('x', x);
        condText.setAttribute('y', y + 20);
        condText.setAttribute('text-anchor', 'middle');
        condText.setAttribute('font-size', '14');
        condText.setAttribute('fill', '#666');
        condText.textContent = `Conditions: ${reactionData.conditions}`;
        group.appendChild(condText);
        
        this.svg.appendChild(group);
    }
    
    // Add mechanism steps description
    addMechanismSteps(reactionData, x, y) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Title for steps
        const stepsTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        stepsTitle.setAttribute('x', x);
        stepsTitle.setAttribute('y', y);
        stepsTitle.setAttribute('font-size', '16');
        stepsTitle.setAttribute('font-weight', 'bold');
        stepsTitle.setAttribute('fill', '#667eea');
        stepsTitle.textContent = 'Mechanism Steps:';
        group.appendChild(stepsTitle);
        
        // Add each step
        if (reactionData.mechanism && reactionData.mechanism.length > 0) {
            reactionData.mechanism.forEach((step, index) => {
                const yPos = y + 30 + (index * 40);
                
                // Step number and title
                const stepText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                stepText.setAttribute('x', x);
                stepText.setAttribute('y', yPos);
                stepText.setAttribute('font-size', '14');
                stepText.setAttribute('font-weight', '600');
                stepText.setAttribute('fill', '#333');
                stepText.textContent = `${index + 1}. ${step.title}`;
                group.appendChild(stepText);
                
                // Step description
                const descText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                descText.setAttribute('x', x + 20);
                descText.setAttribute('y', yPos + 18);
                descText.setAttribute('font-size', '12');
                descText.setAttribute('fill', '#666');
                descText.textContent = this.truncateText(step.description, 120);
                group.appendChild(descText);
            });
        }
        
        this.svg.appendChild(group);
    }
    
    // Truncate long text
    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    // Animate mechanism step by step with enhanced visual effects
    animateStep(stepIndex) {
        const arrows = this.svg.querySelectorAll('.mechanism-arrow');
        if (!arrows[stepIndex]) return;
        
        const arrow = arrows[stepIndex];
        const electronFlows = arrow.querySelectorAll('.electron-flow-arrow');
        
        // Get the current step data for atom highlighting
        if (this.currentMechanism && this.currentMechanism.mechanism[stepIndex]) {
            const step = this.currentMechanism.mechanism[stepIndex];
            this.highlightReactingAtoms(step);
        }
        
        // Fade in the step group
        arrow.style.transition = 'opacity 0.5s ease-in';
        arrow.setAttribute('opacity', '1');
        
        // Animate each electron flow arrow
        electronFlows.forEach((path, index) => {
            setTimeout(() => {
                const pathLength = path.getTotalLength ? path.getTotalLength() : 200;
                path.style.transition = `stroke-dashoffset 0.8s ease-in-out`;
                path.style.strokeDashoffset = '0';
            }, index * 300);
        });
    }
    
    // Highlight atoms involved in the reaction step
    highlightReactingAtoms(step) {
        // Get all atom groups in the SVG
        const atomGroups = this.svg.querySelectorAll('.atom-group');
        
        // Remove previous highlights
        atomGroups.forEach(group => {
            group.classList.remove('atom-active');
            const circle = group.querySelector('.atom-circle');
            if (circle) circle.classList.remove('reacting');
        });
        
        // Add pulsing effect to atoms involved in this step
        // This is a simplified version - in a full implementation, you'd track
        // atom indices from the electron flow data
        step.electronFlow.forEach((flow, index) => {
            // Highlight a few atoms based on the electron flow
            if (index < atomGroups.length) {
                const atomGroup = atomGroups[index];
                atomGroup.classList.add('atom-active');
                const circle = atomGroup.querySelector('.atom-circle');
                if (circle) {
                    circle.classList.add('reacting');
                }
                
                // Remove highlight after animation
                setTimeout(() => {
                    atomGroup.classList.remove('atom-active');
                    if (circle) circle.classList.remove('reacting');
                }, 1500);
            }
        });
    }
    
    // Play full animation
    playAnimation() {
        const arrows = this.svg.querySelectorAll('.mechanism-arrow');
        
        // Reset all arrows first
        arrows.forEach(arrow => {
            arrow.setAttribute('opacity', '0');
            const electronFlows = arrow.querySelectorAll('.electron-flow-arrow');
            electronFlows.forEach(path => {
                const pathLength = path.getTotalLength ? path.getTotalLength() : 200;
                path.style.strokeDasharray = pathLength;
                path.style.strokeDashoffset = pathLength;
            });
        });
        
        // Animate each step in sequence
        arrows.forEach((arrow, index) => {
            setTimeout(() => {
                this.setActiveStep(index);
                this.animateStep(index);
            }, index * this.animationSpeed);
        });
    }

    setActiveStep(stepIndex = 0, suppressAnimation = false) {
        if (!this.svg) return;
        const totalSteps = this.currentMechanism?.mechanism?.length || 0;
        if (totalSteps === 0) return;

        this.activeStep = Math.max(0, Math.min(stepIndex, totalSteps - 1));
        const arrows = this.svg.querySelectorAll('.mechanism-arrow');
        arrows.forEach((arrow, index) => {
            const isActive = index === this.activeStep;
            arrow.classList.toggle('active', isActive);
            arrow.style.transition = isActive ? 'opacity 0.3s ease' : 'opacity 0.3s ease';
            arrow.setAttribute('opacity', isActive ? '1' : '0.2');

            if (isActive) {
                const flows = arrow.querySelectorAll('.electron-flow-arrow');
                flows.forEach(path => {
                    const pathLength = path.getTotalLength ? path.getTotalLength() : 200;
                    path.style.strokeDasharray = pathLength;
                    path.style.strokeDashoffset = suppressAnimation ? 0 : pathLength;
                    if (!suppressAnimation) {
                        requestAnimationFrame(() => {
                            path.style.transition = 'stroke-dashoffset 0.6s ease-out';
                            path.style.strokeDashoffset = '0';
                        });
                    } else {
                        path.style.transition = 'none';
                        path.style.strokeDashoffset = '0';
                    }
                });
            }
        });
    }
    
    // Export SVG as downloadable file
    exportSVG(filename = 'mechanism.svg') {
        const svgData = new XMLSerializer().serializeToString(this.svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MechanismRenderer;
}
