// DNA Base Memorizer — App Logic

(function () {
    // State
    let currentBase = 'adenine';
    let currentMode = 'explore';
    let currentTheme = 'dark';
    let score = { correct: 0, total: 0, streak: 0 };
    let quizState = null;

    // DOM refs
    const explorePanel = document.getElementById('explore-panel');
    const quizPanel = document.getElementById('quiz-panel');
    const molCanvas = document.getElementById('mol-canvas');
    const quizCanvas = document.getElementById('quiz-canvas');
    const showHbond = document.getElementById('show-hbond');
    const showNumbering = document.getElementById('show-numbering');
    const showLonePairs = document.getElementById('show-lone-pairs');
    const showSugarBond = document.getElementById('show-sugar-bond');
    const quizPrompt = document.getElementById('quiz-prompt');
    const quizOptions = document.getElementById('quiz-options');
    const quizFeedback = document.getElementById('quiz-feedback');
    const scoreValue = document.getElementById('score-value');
    const streakValue = document.getElementById('streak-value');
    const hbondList = document.getElementById('hbond-list');
    const themeToggle = document.getElementById('theme-toggle');
    const rotateLeft = document.getElementById('rotate-left');
    const rotateRight = document.getElementById('rotate-right');
    const rotateValue = document.getElementById('rotate-value');
    const rotateReset = document.getElementById('rotate-reset');
    const pairingDemoBtn = document.getElementById('pairing-demo-btn');
    const pairingDemoStatus = document.getElementById('pairing-demo-status');
    const ROTATE_STEP_DEG = 90;
    let exploreRotationDeg = 0;

    const PAIRING_BOND_MAP = {
        adenine: {
            thymine: [
                { from: 'NH2', to: 'O4', type: 'donor' },
                { from: 'N1', to: 'N3', type: 'acceptor' },
            ]
        },
        thymine: {
            adenine: [
                { from: 'O4', to: 'NH2', type: 'acceptor' },
                { from: 'N3', to: 'N1', type: 'donor' },
            ]
        },
        guanine: {
            cytosine: [
                { from: 'O6', to: 'NH2', type: 'acceptor' },
                { from: 'N1', to: 'N3', type: 'donor' },
                { from: 'NH2', to: 'O2', type: 'donor' },
            ]
        },
        cytosine: {
            guanine: [
                { from: 'NH2', to: 'O6', type: 'donor' },
                { from: 'N3', to: 'N1', type: 'acceptor' },
                { from: 'O2', to: 'NH2', type: 'acceptor' },
            ]
        }
    };

    const pairingDemo = {
        active: true,
        playing: false,
        startedAt: 0,
        rafId: null,
        approachProgress: 1,
        bondProgress: 1,
        primaryRotation: 0,
        primaryRotation: 0,
        partnerRotation: 0,
        targetPrimary: 0,
        targetPartner: 0,
        partnerMirror: false,
    };

    /* computePairingAngles removed in favor of dynamic mathematical alignment */

    function atomCentroid(atoms) {
        let x = 0, y = 0;
        for (const a of atoms) { x += a.x; y += a.y; }
        return { x: x / atoms.length, y: y / atoms.length };
    }

    // Renderers
    const exploreRenderer = new BaseRenderer(molCanvas);
    let quizRenderer = null;

    // ——— Theme ———
    function setTheme(theme) {
        currentTheme = theme;
        document.body.classList.toggle('light', theme === 'light');
        exploreRenderer.theme = theme;
        if (quizRenderer) quizRenderer.theme = theme;
        localStorage.setItem('dna-bases-theme', theme);
        if (currentMode === 'explore') renderExplore();
        else if (quizRenderer && quizState) renderCurrentQuiz();
    }

    themeToggle.addEventListener('click', () => {
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    // Restore saved theme
    const savedTheme = localStorage.getItem('dna-bases-theme');
    if (savedTheme) setTheme(savedTheme);

    // ——— Explore Mode ———
    function renderExplore() {
        const base = DNA_BASES[currentBase];
        const partnerKey = keyForBaseName(base.pairsWith);
        const partnerBase = DNA_BASES[partnerKey];

        if (pairingDemo.active && partnerBase) {
            const map = getPairMap(currentBase, partnerKey);
            exploreRenderer.renderPairing(base, partnerBase, {
                showHbond: showHbond.checked,
                showNumbering: showNumbering.checked,
                showLonePairs: showLonePairs.checked,
                showSugarBond: showSugarBond.checked,
                pairMap: map,
                approachProgress: pairingDemo.approachProgress,
                bondProgress: pairingDemo.bondProgress,
                primaryRotation: pairingDemo.primaryRotation,
                partnerRotation: pairingDemo.partnerRotation,
                partnerMirror: pairingDemo.partnerMirror,
            });
        } else {
            exploreRenderer.render(base, {
                showHbond: showHbond.checked,
                showNumbering: showNumbering.checked,
                showLonePairs: showLonePairs.checked,
                showSugarBond: showSugarBond.checked,
            });
        }

        updateInfoPanel(base);
        updateHbondList(base);
        updatePairingStatus(base);
    }

    function keyForBaseName(name) {
        if (!name) return null;
        return Object.keys(DNA_BASES).find((k) => DNA_BASES[k].name.toLowerCase() === name.toLowerCase()) || null;
    }

    function getPairMap(baseKey, partnerKey) {
        return (PAIRING_BOND_MAP[baseKey] && PAIRING_BOND_MAP[baseKey][partnerKey]) || [];
    }

    function updatePairingStatus(base) {
        if (!pairingDemo.active) {
            pairingDemoStatus.textContent = 'Single base view';
            pairingDemoBtn.textContent = 'Show Pairing';
            return;
        }

        if (pairingDemo.playing) {
            const partnerKey = keyForBaseName(base.pairsWith);
            const partnerLetter = partnerKey && DNA_BASES[partnerKey] ? DNA_BASES[partnerKey].letter : '?';
            pairingDemoStatus.textContent = `Auto pairing ${base.letter}-${partnerLetter}: rotate, align, connect...`;
            pairingDemoBtn.textContent = 'Stop Pairing';
            return;
        }

        pairingDemoStatus.textContent = `${base.name} <-> ${base.pairsWith} fully paired (${base.hbondCount} H-bonds)`;
        pairingDemoBtn.textContent = 'Hide Pairing';
    }

    function stopPairingAnimation() {
        if (pairingDemo.rafId) {
            cancelAnimationFrame(pairingDemo.rafId);
            pairingDemo.rafId = null;
        }
        pairingDemo.playing = false;
    }

    function startPairingAnimation() {
        stopPairingAnimation();

        const base = DNA_BASES[currentBase];
        const partnerKey = keyForBaseName(base.pairsWith);
        const partnerBase = DNA_BASES[partnerKey];
        const map = getPairMap(currentBase, partnerKey);

        // Keep primary rotation as is
        pairingDemo.primaryRotation = exploreRenderer.rotation;
        pairingDemo.targetPrimary = exploreRenderer.rotation;

        // Calculate optimal partner snap computationally to guarantee no criss-crossing
        let bestRot = 0;
        let bestMirror = false;
        let minLoss = Infinity;

        const testA = exploreRenderer._rotateBase(base, pairingDemo.primaryRotation);
        let acx = 0, acy = 0;
        map.forEach(p => {
             const a = testA.atoms.find(at => at.id === p.from);
             acx += a.x; acy += a.y;
        });
        acx /= map.length; acy /= map.length;

        for (let m of [false, true]) {
             for (let r = 0; r <= 360; r+=2) {
                  const rad = r * Math.PI / 180;
                  const testB = exploreRenderer._rotateBase(partnerBase, rad, m);
                  
                  let bcx = 0, bcy = 0;
                  map.forEach(p => {
                       const b = testB.atoms.find(at => at.id === p.to);
                       bcx += b.x; bcy += b.y;
                  });
                  bcx /= map.length; bcy /= map.length;

                  const dx = acx - bcx;
                  const dy = acy - bcy;

                  let loss = 0;
                  // Distance between pairing atoms
                  map.forEach(p => {
                       const a = testA.atoms.find(at => at.id === p.from);
                       const b = testB.atoms.find(at => at.id === p.to);
                       loss += Math.pow(a.x - (b.x + dx), 2) + Math.pow(a.y - (b.y + dy), 2);
                  });

                  // Ensure sugars point far apart (antiparallel orientation)
                  const sugA = testA.atoms.find(at => at.id === base.sugarAttachment.atomId);
                  const sugB = testB.atoms.find(at => at.id === partnerBase.sugarAttachment.atomId);
                  if (sugA && sugB) {
                      const sugDist = Math.hypot(sugA.x - (sugB.x + dx), sugA.y - (sugB.y + dy));
                      loss -= sugDist * 3; // strong reward for opposite facing sugars
                  }

                  if (loss < minLoss) {
                       minLoss = loss;
                       bestRot = rad;
                       bestMirror = m;
                  }
             }
        }

        pairingDemo.targetPartner = bestRot;
        pairingDemo.partnerMirror = bestMirror;

        pairingDemo.active = true;
        pairingDemo.playing = true;
        pairingDemo.startedAt = performance.now();
        pairingDemo.approachProgress = 0;
        pairingDemo.bondProgress = 0;

        // Start partner with extra spin for visual flair
        const extraSpin = Math.PI * -1.5; // Spins into place
        const startPartner = pairingDemo.targetPartner + extraSpin;

        const run = (time) => {
            const elapsed = time - pairingDemo.startedAt;
            const approachDuration = 900;
            const rotDuration = 1200;
            const bondDelay = 400;
            const bondDuration = 800;
            const holdDuration = 900;
            const totalDuration = Math.max(rotDuration, bondDelay + bondDuration) + holdDuration;
            const easeOut = (v) => 1 - Math.pow(1 - v, 3);

            pairingDemo.approachProgress = easeOut(Math.min(elapsed / approachDuration, 1));

            const rotEase = easeOut(Math.min(elapsed / rotDuration, 1));
            
            // Primary stays completely still at targetPrimary!
            pairingDemo.primaryRotation = pairingDemo.targetPrimary;
            
            pairingDemo.partnerRotation = startPartner + (pairingDemo.targetPartner - startPartner) * rotEase;

            pairingDemo.bondProgress = Math.min(Math.max((elapsed - bondDelay) / bondDuration, 0), 1);

            renderExplore();

            if (elapsed < totalDuration) {
                pairingDemo.rafId = requestAnimationFrame(run);
            } else {
                pairingDemo.playing = false;
                pairingDemo.rafId = null;
                pairingDemo.approachProgress = 1;
                pairingDemo.bondProgress = 1;
                pairingDemo.primaryRotation = pairingDemo.targetPrimary;
                pairingDemo.partnerRotation = pairingDemo.targetPartner;
                renderExplore();
            }
        };

        pairingDemo.rafId = requestAnimationFrame(run);
    }

    function updateInfoPanel(base) {
        document.getElementById('info-title').textContent = base.name;
        document.getElementById('info-formula').textContent = base.formula;
        document.getElementById('info-type').textContent = `${base.type} (${base.ring})`;
        document.getElementById('info-pairs').innerHTML =
            `Pairs with: <strong>${base.pairsWith}</strong> (${base.hbondCount} H-bonds)`;
    }

    function updateHbondList(base) {
        hbondList.innerHTML = '';
        if (!base.hbondSites) return;
        for (const site of base.hbondSites) {
            const div = document.createElement('div');
            div.className = `hbond-item ${site.type}-item`;
            div.innerHTML = `<strong>${site.label} — ${site.atomId}</strong>${site.detail}`;
            hbondList.appendChild(div);
        }
    }

    // Base selector
    document.querySelectorAll('.base-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.base-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentBase = btn.dataset.base;
            
            stopPairingAnimation();
            pairingDemo.active = false;
            pairingDemo.playing = false;
            renderExplore();
        });
    });

    // Toggles
    [showHbond, showNumbering, showLonePairs, showSugarBond].forEach(el => {
        el.addEventListener('change', renderExplore);
    });

    // Rotation
    function setExploreRotation(deg) {
        exploreRotationDeg = ((deg % 360) + 360) % 360;
        rotateValue.textContent = exploreRotationDeg + '\u00B0';
        exploreRenderer.rotation = exploreRotationDeg * Math.PI / 180;
        if (!pairingDemo.active) {
            renderExplore();
        }
    }

    rotateLeft.addEventListener('click', () => {
        setExploreRotation(exploreRotationDeg - ROTATE_STEP_DEG);
    });

    rotateRight.addEventListener('click', () => {
        setExploreRotation(exploreRotationDeg + ROTATE_STEP_DEG);
    });

    rotateReset.addEventListener('click', () => {
        setExploreRotation(0);
    });

    pairingDemoBtn.addEventListener('click', () => {
        if (pairingDemo.active) {
            stopPairingAnimation();
            pairingDemo.active = false;
            pairingDemo.playing = false;
            renderExplore();
        } else {
            startPairingAnimation();
        }
    });

    // Hover on explore canvas
    molCanvas.addEventListener('mousemove', (e) => {
        if (pairingDemo.active) return;
        const rect = molCanvas.getBoundingClientRect();
        const base = DNA_BASES[currentBase];
        const hit = exploreRenderer.hitTest(e.clientX - rect.left, e.clientY - rect.top, base);
        exploreRenderer.hoveredAtom = hit;
        renderExplore();

        // Highlight matching hbond item
        document.querySelectorAll('.hbond-item').forEach(el => el.style.outline = 'none');
        if (hit && base.hbondSites) {
            const idx = base.hbondSites.findIndex(s => s.atomId === hit.id);
            if (idx >= 0) {
                const items = hbondList.querySelectorAll('.hbond-item');
                if (items[idx]) items[idx].style.outline = '1px solid rgba(255,255,255,0.3)';
            }
        }
    });

    molCanvas.addEventListener('mouseleave', () => {
        exploreRenderer.hoveredAtom = null;
        renderExplore();
    });

    // ——— Mode Switching ———
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;

            if (currentMode === 'explore') {
                explorePanel.classList.remove('hidden');
                explorePanel.style.display = '';
                quizPanel.classList.add('hidden');
                quizPanel.style.display = 'none';
                setTimeout(renderExplore, 50);
            } else {
                stopPairingAnimation();
                explorePanel.classList.add('hidden');
                explorePanel.style.display = 'none';
                quizPanel.classList.remove('hidden');
                quizPanel.style.display = '';
                startQuiz();
            }
        });
    });

    // ——— Quiz Mode ———
    function startQuiz() {
        if (!quizRenderer) {
            quizRenderer = new BaseRenderer(quizCanvas);
            quizRenderer.theme = currentTheme;
        }
        nextQuestion();
    }

    function renderCurrentQuiz() {
        if (!quizRenderer || !quizState) return;
        const base = quizState.base;
        if (currentMode === 'quiz-hbond' && hbondQuizState) {
            const partialSites = base.hbondSites.filter(s => hbondQuizState.found.has(s.atomId));
            quizRenderer.render({ ...base, hbondSites: partialSites }, {
                showHbond: true, showNumbering: true
            });
        } else {
            quizRenderer.render(base, {
                showHbond: false,
                showNumbering: currentMode !== 'quiz-name',
            });
        }
    }

    function nextQuestion() {
        quizFeedback.classList.add('hidden');
        quizFeedback.className = 'quiz-feedback hidden';

        const baseKeys = Object.keys(DNA_BASES);
        let pick;
        do {
            pick = baseKeys[Math.floor(Math.random() * baseKeys.length)];
        } while (baseKeys.length > 1 && quizState && pick === quizState.baseKey);

        const base = DNA_BASES[pick];
        quizState = { baseKey: pick, base, answered: false };

        // Random rotation so students learn to recognize from any angle
        quizRenderer.rotation = Math.random() * Math.PI * 2;

        if (currentMode === 'quiz-name') {
            quizPrompt.textContent = 'What is this nucleobase?';
            quizRenderer.render(base, { showHbond: false, showNumbering: false });
            renderNameOptions(base);
        } else if (currentMode === 'quiz-hbond') {
            quizPrompt.textContent = 'Click all H-bond donors and acceptors on this base.';
            quizRenderer.render(base, { showHbond: false, showNumbering: true });
            renderHbondQuiz(base);
        } else if (currentMode === 'quiz-pair') {
            quizPrompt.textContent = `What base pairs with ${base.name}?`;
            quizRenderer.render(base, { showHbond: false, showNumbering: false });
            renderPairOptions(base);
        }
    }

    function renderNameOptions(base) {
        quizOptions.innerHTML = '';
        const names = shuffle(['Adenine', 'Thymine', 'Guanine', 'Cytosine', 'Uracil']);
        for (const name of names) {
            const btn = document.createElement('button');
            btn.className = 'quiz-option';
            btn.textContent = name;
            btn.addEventListener('click', () => handleAnswer(btn, name, base.name, base));
            quizOptions.appendChild(btn);
        }
    }

    function renderPairOptions(base) {
        quizOptions.innerHTML = '';
        const names = shuffle(['Adenine', 'Thymine', 'Guanine', 'Cytosine', 'Uracil']);
        for (const name of names) {
            const btn = document.createElement('button');
            btn.className = 'quiz-option';
            btn.textContent = name;
            btn.addEventListener('click', () => handleAnswer(btn, name, base.pairsWith, base));
            quizOptions.appendChild(btn);
        }
    }

    function handleAnswer(btn, answer, correct, base) {
        if (quizState.answered) return;
        quizState.answered = true;
        score.total++;

        const isCorrect = answer === correct;
        if (isCorrect) {
            score.correct++;
            score.streak++;
            btn.classList.add('correct');
            if (currentMode === 'quiz-name') {
                showFB(true, `Correct! ${base.name} (${base.letter}) is a ${base.type}.`);
            } else {
                showFB(true, `Correct! ${base.name} pairs with ${base.pairsWith} via ${base.hbondCount} H-bonds.`);
            }
        } else {
            score.streak = 0;
            btn.classList.add('wrong');
            quizOptions.querySelectorAll('.quiz-option').forEach(o => {
                if (o.textContent === correct) o.classList.add('highlight-correct');
            });
            if (currentMode === 'quiz-name') {
                showFB(false, `That's ${base.name} (${base.letter}) — a ${base.type}.`);
            } else {
                showFB(false, `${base.name} pairs with ${base.pairsWith} (${base.hbondCount} H-bonds).`);
            }
        }
        updateScore();
        setTimeout(nextQuestion, 1800);
    }

    // H-Bond Quiz
    let hbondQuizState = null;

    function renderHbondQuiz(base) {
        quizOptions.innerHTML = '';
        hbondQuizState = {
            remaining: new Set(base.hbondSites.map(s => s.atomId)),
            found: new Set(),
            wrongClicks: 0,
            base
        };

        const info = document.createElement('div');
        info.style.cssText = 'font-size:12px;color:var(--text-muted);text-align:center;width:100%;';
        info.textContent = `Find ${base.hbondSites.length} H-bond site${base.hbondSites.length > 1 ? 's' : ''} — click on the molecule`;
        quizOptions.appendChild(info);

        for (const site of base.hbondSites) {
            const chip = document.createElement('span');
            chip.className = 'quiz-option';
            chip.style.cssText = 'cursor:default;opacity:0.35;min-width:auto;padding:6px 12px;font-size:12px;';
            chip.textContent = `${site.type === 'donor' ? '\u25CF' : '\u25CB'} ${site.atomId}`;
            chip.id = `hbond-chip-${site.atomId}`;
            quizOptions.appendChild(chip);
        }
    }

    quizCanvas.addEventListener('click', (e) => {
        if (currentMode !== 'quiz-hbond' || !hbondQuizState || quizState.answered) return;
        const rect = quizCanvas.getBoundingClientRect();
        const hit = quizRenderer.hitTest(e.clientX - rect.left, e.clientY - rect.top, hbondQuizState.base);
        if (!hit) return;

        if (hbondQuizState.remaining.has(hit.id)) {
            hbondQuizState.remaining.delete(hit.id);
            hbondQuizState.found.add(hit.id);
            const chip = document.getElementById(`hbond-chip-${hit.id}`);
            if (chip) { chip.style.opacity = '1'; chip.classList.add('correct'); }
            refreshHbondCanvas();

            if (hbondQuizState.remaining.size === 0) {
                quizState.answered = true;
                score.total++;
                if (hbondQuizState.wrongClicks <= 1) {
                    score.correct++;
                    score.streak++;
                }
                showFB(true, `Found all ${hbondQuizState.base.hbondSites.length} H-bond sites on ${hbondQuizState.base.name}!`);
                updateScore();
                quizRenderer.render(hbondQuizState.base, { showHbond: true, showNumbering: true });
                setTimeout(nextQuestion, 2200);
            }
        } else if (!hbondQuizState.found.has(hit.id)) {
            hbondQuizState.wrongClicks++;
        }
    });

    quizCanvas.addEventListener('mousemove', (e) => {
        if (currentMode !== 'quiz-hbond' || !hbondQuizState) return;
        const rect = quizCanvas.getBoundingClientRect();
        quizRenderer.hoveredAtom = quizRenderer.hitTest(e.clientX - rect.left, e.clientY - rect.top, hbondQuizState.base);
        refreshHbondCanvas();
    });

    quizCanvas.addEventListener('mouseleave', () => {
        if (quizRenderer) quizRenderer.hoveredAtom = null;
    });

    function refreshHbondCanvas() {
        if (!hbondQuizState) return;
        const base = hbondQuizState.base;
        const partial = base.hbondSites.filter(s => hbondQuizState.found.has(s.atomId));
        quizRenderer.render({ ...base, hbondSites: partial }, { showHbond: true, showNumbering: true });
    }

    // Helpers
    function updateScore() {
        scoreValue.textContent = `${score.correct} / ${score.total}`;
        streakValue.textContent = score.streak.toString();
    }

    function showFB(ok, msg) {
        quizFeedback.classList.remove('hidden', 'correct-feedback', 'wrong-feedback');
        quizFeedback.classList.add(ok ? 'correct-feedback' : 'wrong-feedback');
        quizFeedback.textContent = msg;
    }

    document.getElementById('reset-quiz').addEventListener('click', () => {
        score = { correct: 0, total: 0, streak: 0 };
        updateScore();
        nextQuestion();
    });

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // ——— Init ———
    quizPanel.style.display = 'none';
    setTimeout(renderExplore, 100);

    window.addEventListener('resize', () => {
        if (currentMode === 'explore') renderExplore();
        else renderCurrentQuiz();
    });

    updatePairingStatus(DNA_BASES[currentBase]);
})();
