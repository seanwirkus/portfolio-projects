// MechanismWorkspace orchestrates the entire mechanism learning experience
// Handles summary meta, timeline controls, detail panes, and delegates drawing to MechanismRenderer

class MechanismWorkspace {
    constructor(config) {
        const defaults = {
            timelineId: 'mechanism-timeline',
            detailId: 'mechanism-step-detail',
            stageLabelId: 'mechanism-stage-label',
            energyProfileId: 'mechanism-energy-profile',
            meta: {
                reagents: 'mechanism-meta-reagents',
                conditions: 'mechanism-meta-conditions',
                type: 'mechanism-meta-type',
                difficulty: 'mechanism-meta-difficulty'
            },
            sliderId: 'mechanism-step-slider',
            prevBtnId: 'mechanism-prev-step',
            nextBtnId: 'mechanism-next-step',
            playBtnId: 'mechanism-play-pause',
            exportBtnId: 'mechanism-export-svg'
        };

        this.config = { ...defaults, ...config };
        this.timelineEl = document.getElementById(this.config.timelineId);
        this.detailEl = document.getElementById(this.config.detailId);
        this.stageLabelEl = document.getElementById(this.config.stageLabelId);
        this.energyProfileEl = document.getElementById(this.config.energyProfileId);
        this.metaEls = {
            reagents: document.getElementById(this.config.meta.reagents),
            conditions: document.getElementById(this.config.meta.conditions),
            type: document.getElementById(this.config.meta.type),
            difficulty: document.getElementById(this.config.meta.difficulty)
        };
        this.sliderEl = document.getElementById(this.config.sliderId);
        this.prevBtn = document.getElementById(this.config.prevBtnId);
        this.nextBtn = document.getElementById(this.config.nextBtnId);
        this.playBtn = document.getElementById(this.config.playBtnId);
        this.exportBtn = document.getElementById(this.config.exportBtnId);

        this.renderer = new MechanismRenderer(this.config.canvasContainerId);
        this.currentReaction = null;
        this.currentMoleculeData = null;
        this.currentStep = 0;
        this.autoPlayTimer = null;
        this.isPlaying = false;

        this.bindControls();
    }

    bindControls() {
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.setStep(this.currentStep - 1));
        }

        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.setStep(this.currentStep + 1));
        }

        if (this.sliderEl) {
            this.sliderEl.addEventListener('input', (event) => {
                const value = parseInt(event.target.value, 10);
                if (!Number.isNaN(value)) {
                    this.setStep(value);
                }
            });
        }

        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => this.togglePlayback());
        }

        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => {
                const name = this.currentReaction?.name?.replace(/\s+/g, '_') || 'mechanism';
                this.renderer.exportSVG(`${name}.svg`);
            });
        }
    }

    loadMechanism(key, reaction, moleculeData) {
        this.currentKey = key;
        this.currentReaction = reaction;
        this.currentMoleculeData = moleculeData;
        this.currentStep = 0;
        this.stopPlayback();

        if (!reaction) {
            return;
        }

        this.renderer.renderMechanism(reaction, moleculeData, { activeStep: 0 });
        this.renderSummary();
        this.renderTimeline();
        this.renderStepDetail();
        this.renderEnergyProfile();
        this.updateSlider();
    }

    renderSummary() {
        if (!this.currentReaction) return;
        const { reagents = [], conditions = '-', type = '-', mechanism = [] } = this.currentReaction;

        if (this.metaEls.reagents) {
            this.metaEls.reagents.textContent = reagents.length ? reagents.join(', ') : '—';
        }
        if (this.metaEls.conditions) {
            this.metaEls.conditions.textContent = conditions || '—';
        }
        if (this.metaEls.type) {
            const stepCount = mechanism.length;
            this.metaEls.type.textContent = `${type || 'reaction'} • ${stepCount} step${stepCount === 1 ? '' : 's'}`;
        }

        if (this.metaEls.difficulty) {
            const difficulty = this.estimateDifficulty(mechanism.length);
            this.metaEls.difficulty.textContent = difficulty.label;
            this.metaEls.difficulty.dataset.level = difficulty.level;
        }
    }

    renderTimeline() {
        if (!this.timelineEl) return;
        this.timelineEl.innerHTML = '';

        const steps = this.currentReaction?.mechanism || [];
        if (!steps.length) {
            this.timelineEl.innerHTML = '<p class="mechanism-empty">No mechanism steps available.</p>';
            return;
        }

        steps.forEach((step, index) => {
            const card = document.createElement('button');
            card.className = 'mechanism-timeline-card';
            card.setAttribute('type', 'button');
            card.dataset.stepIndex = index;
            card.innerHTML = `
                <span class="step-index">${index + 1}</span>
                <div class="step-title">${step.title}</div>
                <div class="step-meta">${this.describeEnergy(step.energyLevel)}</div>
            `;
            card.addEventListener('click', () => this.setStep(index));
            this.timelineEl.appendChild(card);
        });

        this.highlightTimeline();
    }

    renderStepDetail() {
        if (!this.detailEl) return;
        const steps = this.currentReaction?.mechanism || [];
        if (!steps.length) {
            this.detailEl.innerHTML = '<p class="mechanism-empty">Select a mechanism to begin.</p>';
            return;
        }

        const step = steps[this.currentStep];
        const flows = (step.electronFlow || []).map(flow => `
            <li><strong>${this.describeFlow(flow.type)}:</strong> ${this.describeFlowPath(flow)}</li>
        `).join('');

        const intermediate = step.intermediates
            ? `<div class="mechanism-pill">Intermediate: ${this.describeIntermediate(step.intermediates)}</div>`
            : '';

        this.detailEl.innerHTML = `
            <div class="step-detail-header">
                <span class="step-badge">Step ${this.currentStep + 1}</span>
                <h4>${step.title}</h4>
            </div>
            <p class="step-description">${step.description}</p>
            ${intermediate}
            <h5>Electron Flow</h5>
            <ul class="electron-flow-list">${flows || '<li>No arrow-pushing data available.</li>'}</ul>
        `;

        this.updateStageLabel(step);
    }

    renderEnergyProfile() {
        if (!this.energyProfileEl) return;
        const steps = this.currentReaction?.mechanism || [];
        if (!steps.length) {
            this.energyProfileEl.innerHTML = '';
            return;
        }

        const energyMap = {
            transition_state: 90,
            high_energy: 80,
            intermediate: 65,
            reactant: 55,
            product: 45,
            low_energy: 35,
            '': 50
        };

        this.energyProfileEl.innerHTML = steps.map((step, index) => {
            const height = energyMap[step.energyLevel] || energyMap[''];
            return `
                <div class="energy-bar" data-index="${index}">
                    <div class="energy-bar-fill" style="height:${height}%"></div>
                    <span>Step ${index + 1}</span>
                </div>
            `;
        }).join('');

        this.highlightEnergyProfile();
    }

    setStep(index) {
        const steps = this.currentReaction?.mechanism || [];
        if (!steps.length) return;

        const clamped = Math.max(0, Math.min(index, steps.length - 1));
        this.currentStep = clamped;
        this.renderer.setActiveStep(clamped, false);
        this.highlightTimeline();
        this.renderStepDetail();
        this.highlightEnergyProfile();
        this.updateSlider();
    }

    updateSlider() {
        const steps = this.currentReaction?.mechanism || [];
        if (!this.sliderEl || !steps.length) return;
        this.sliderEl.max = steps.length - 1;
        this.sliderEl.value = this.currentStep;
        this.sliderEl.disabled = steps.length <= 1;
        if (this.prevBtn) this.prevBtn.disabled = this.currentStep === 0;
        if (this.nextBtn) this.nextBtn.disabled = this.currentStep === steps.length - 1;
    }

    highlightTimeline() {
        if (!this.timelineEl) return;
        this.timelineEl.querySelectorAll('.mechanism-timeline-card').forEach(card => {
            const stepIndex = parseInt(card.dataset.stepIndex, 10);
            card.classList.toggle('active', stepIndex === this.currentStep);
        });
    }

    highlightEnergyProfile() {
        if (!this.energyProfileEl) return;
        this.energyProfileEl.querySelectorAll('.energy-bar').forEach(bar => {
            const stepIndex = parseInt(bar.dataset.index, 10);
            bar.classList.toggle('active', stepIndex === this.currentStep);
        });
    }

    updateStageLabel(step = null) {
        if (!this.stageLabelEl) return;
        const currentStepData = step || this.currentReaction?.mechanism?.[this.currentStep];
        if (!currentStepData) {
            this.stageLabelEl.textContent = '';
            return;
        }
        this.stageLabelEl.textContent = `Step ${this.currentStep + 1}: ${currentStepData.title}`;
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.stopPlayback();
            return;
        }

        this.isPlaying = true;
        if (this.playBtn) {
            this.playBtn.classList.add('playing');
            this.playBtn.textContent = 'Pause Timeline';
        }

        const steps = this.currentReaction?.mechanism || [];
        if (!steps.length) return;

        this.autoPlayTimer = setInterval(() => {
            const next = this.currentStep + 1;
            if (next >= steps.length) {
                this.stopPlayback();
                return;
            }
            this.setStep(next);
        }, 1800);
    }

    stopPlayback() {
        if (this.autoPlayTimer) {
            clearInterval(this.autoPlayTimer);
            this.autoPlayTimer = null;
        }
        this.isPlaying = false;
        if (this.playBtn) {
            this.playBtn.classList.remove('playing');
            this.playBtn.textContent = 'Play Timeline';
        }
    }

    estimateDifficulty(stepCount) {
        if (stepCount >= 4) return { label: 'Advanced', level: 'high' };
        if (stepCount === 3) return { label: 'Intermediate', level: 'medium' };
        return { label: 'Fundamental', level: 'low' };
    }

    describeEnergy(level) {
        const map = {
            transition_state: 'Transition state',
            high_energy: 'High energy',
            intermediate: 'Intermediate',
            reactant: 'Reactant',
            product: 'Product',
            low_energy: 'Stabilized'
        };
        return map[level] || '—';
    }

    describeFlow(type) {
        const map = {
            nucleophilic_attack: 'Nucleophilic attack',
            electrophilic_attack: 'Electrophilic attack',
            deprotonation: 'Deprotonation',
            bond_formation: 'Bond formation',
            bond_cleavage: 'Bond cleavage',
            pi_bond_formation: 'π bond formation',
            resonance_delocalization: 'Resonance shift',
            heterolytic_cleavage: 'Heterolytic cleavage',
            hydride_transfer: 'Hydride transfer',
            electron_push: 'Electron push',
            protonation: 'Protonation'
        };
        return map[type] || 'Electron flow';
    }

    describeFlowPath(flow) {
        if (!flow) return 'unspecified movement';
        const from = flow.from ? flow.from.replace(/_/g, ' ') : 'source';
        const to = flow.to ? flow.to.replace(/_/g, ' ') : 'target';
        return `${from} → ${to}`;
    }

    describeIntermediate(intermediate) {
        if (typeof intermediate === 'string') return intermediate;
        if (!intermediate) return 'transient species';
        const parts = [];
        if (intermediate.type) parts.push(intermediate.type.replace(/_/g, ' '));
        if (intermediate.stability) parts.push(`stability: ${intermediate.stability}`);
        if (intermediate.geometry) parts.push(`geometry: ${intermediate.geometry}`);
        return parts.join(' • ') || 'transient species';
    }
}

if (typeof window !== 'undefined') {
    window.MechanismWorkspace = MechanismWorkspace;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MechanismWorkspace };
}
