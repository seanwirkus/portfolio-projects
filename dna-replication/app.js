// DNA Replication Study App — App Logic

(function () {
    // State
    let currentMode = 'explore';
    let currentTheme = 'dark';
    let selectedEnzyme = null;
    let score = { correct: 0, total: 0, streak: 0 };
    let quizState = null;

    // DOM
    const explorePanel = document.getElementById('explore-panel');
    const quizPanel = document.getElementById('quiz-panel');
    const forkCanvas = document.getElementById('fork-canvas');
    const enzymeList = document.getElementById('enzyme-list');
    const infoPanel = document.getElementById('info-panel');
    const conceptGrid = document.getElementById('concept-grid');
    const themeToggle = document.getElementById('theme-toggle');
    const quizPrompt = document.getElementById('quiz-prompt');
    const quizOptions = document.getElementById('quiz-options');
    const quizFeedback = document.getElementById('quiz-feedback');
    const scoreValue = document.getElementById('score-value');
    const streakValue = document.getElementById('streak-value');

    // Renderer
    const renderer = new ForkRenderer(forkCanvas);

    // ——— Theme ———
    function setTheme(theme) {
        currentTheme = theme;
        document.body.classList.toggle('light', theme === 'light');
        renderer.theme = theme;
        localStorage.setItem('dna-repl-theme', theme);
        renderExplore();
    }
    themeToggle.addEventListener('click', () => setTheme(currentTheme === 'dark' ? 'light' : 'dark'));
    const saved = localStorage.getItem('dna-repl-theme');
    if (saved) setTheme(saved);

    // ——— Explore Mode ———
    function renderExplore() {
        renderer.selectedEnzyme = selectedEnzyme;
        renderer.render();
        updateEnzymeList();
        updateInfoPanel();
        renderConcepts();
    }

    function selectEnzyme(key) {
        selectedEnzyme = (selectedEnzyme === key) ? null : key;
        // Highlight in sidebar
        document.querySelectorAll('.enzyme-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.enzyme === selectedEnzyme);
        });
        renderExplore();
    }

    function updateEnzymeList() {
        const list = enzymeList;
        if (list.children.length > 0) return; // already built
        list.innerHTML = '';
        for (const [key, enz] of Object.entries(ENZYMES)) {
            const btn = document.createElement('button');
            btn.className = 'enzyme-btn' + (key === selectedEnzyme ? ' active' : '');
            btn.dataset.enzyme = key;
            btn.innerHTML = `
                <span class="enzyme-dot" style="background:${enz.color}"></span>
                <span class="enzyme-label">${enz.shortName}</span>
            `;
            btn.addEventListener('click', () => selectEnzyme(key));
            list.appendChild(btn);
        }
    }

    function updateInfoPanel() {
        if (!selectedEnzyme) {
            infoPanel.innerHTML = `
                <div class="info-card">
                    <h3>Replication Fork</h3>
                    <div class="info-detail">Click an enzyme on the diagram or sidebar to see details.</div>
                    <div class="info-detail" style="margin-top:8px">
                        <strong>Key bonds:</strong><br>
                        \u2022 <span class="info-bond-term--phosphodiester">Phosphodiester</span> \u2014 backbone bonds (formed by polymerase, ligase)<br>
                        \u2022 <span class="info-bond-term--hydrogen">Hydrogen</span> \u2014 base pair bonds (broken by helicase)
                    </div>
                </div>
                <div class="legend-card">
                    <h4>Strand Colors</h4>
                    <div class="legend-item"><span class="legend-dot" style="background:#94a3b8"></span> Template / Parent</div>
                    <div class="legend-item"><span class="legend-dot" style="background:#3b82f6"></span> Leading strand (continuous)</div>
                    <div class="legend-item"><span class="legend-dot" style="background:#10b981"></span> Lagging strand (Okazaki fragments)</div>
                    <div class="legend-item"><span class="legend-dot" style="background:#ec4899"></span> RNA primer</div>
                </div>
            `;
            return;
        }

        const enz = ENZYMES[selectedEnzyme];
        const detail = enz.detail.replace(/\n/g, '<br>');
        let dualHTML = '';
        if (enz.dualActivities) {
            dualHTML = `<div class="dual-box">
                <h4>Dual Activities</h4>
                ${enz.dualActivities.map(a => `<div class="dual-item">\u2022 ${a}</div>`).join('')}
            </div>`;
        }
        let repairBadge = '';
        if (enz.inMismatchRepair) {
            repairBadge = '<span class="repair-badge">Also in mismatch repair</span>';
        }

        infoPanel.innerHTML = `
            <div class="info-card">
                <div class="info-header">
                    <span class="enzyme-dot-lg" style="background:${enz.color}"></span>
                    <h3>${enz.name}</h3>
                </div>
                ${repairBadge}
                <div class="info-fn">${enz.fn}</div>
                <div class="info-bond">
                    <strong>Bond action:</strong> ${enz.bondAction}
                </div>
                <div class="info-loc">
                    <strong>Location:</strong> ${enz.location}
                </div>
                <div class="info-detail-long">${detail}</div>
                ${dualHTML}
            </div>
        `;
    }

    function renderConcepts() {
        if (conceptGrid.children.length > 0) return; // already built
        conceptGrid.innerHTML = '';
        for (const concept of KEY_CONCEPTS) {
            const card = document.createElement('div');
            card.className = 'concept-card';
            card.innerHTML = `
                <div class="concept-icon">${concept.icon}</div>
                <div class="concept-body">
                    <div class="concept-title">${concept.title}</div>
                    <div class="concept-text">${concept.text.replace(/\n/g, '<br>')}</div>
                </div>
            `;
            conceptGrid.appendChild(card);
        }
    }

    // Canvas interactivity
    forkCanvas.addEventListener('mousemove', (e) => {
        const rect = forkCanvas.getBoundingClientRect();
        const hit = renderer.hitTest(e.clientX - rect.left, e.clientY - rect.top);
        if (renderer.hoveredPill !== hit) {
            renderer.hoveredPill = hit;
            forkCanvas.style.cursor = hit ? 'pointer' : 'default';
            renderer.render();
        }
    });

    forkCanvas.addEventListener('click', (e) => {
        const rect = forkCanvas.getBoundingClientRect();
        const hit = renderer.hitTest(e.clientX - rect.left, e.clientY - rect.top);
        if (hit) selectEnzyme(hit);
    });

    forkCanvas.addEventListener('mouseleave', () => {
        if (renderer.hoveredPill) {
            renderer.hoveredPill = null;
            forkCanvas.style.cursor = 'default';
            renderer.render();
        }
    });

    // ——— Mode Switching ———
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;

            if (currentMode === 'explore') {
                explorePanel.classList.remove('hidden');
                quizPanel.classList.add('hidden');
                quizPanel.style.display = 'none';
                explorePanel.style.display = '';
                setTimeout(renderExplore, 50);
            } else {
                explorePanel.classList.add('hidden');
                explorePanel.style.display = 'none';
                quizPanel.classList.remove('hidden');
                quizPanel.style.display = '';
                startQuiz();
            }
        });
    });

    // ——— Quiz Mode ———
    function getQuizBank() {
        return currentMode === 'quiz-enzymes' ? ENZYME_QUESTIONS : CONCEPT_QUESTIONS;
    }

    function startQuiz() {
        nextQuestion();
    }

    function nextQuestion() {
        quizFeedback.classList.add('hidden');
        quizFeedback.className = 'quiz-feedback hidden';

        const bank = getQuizBank();
        let pick;
        do {
            pick = Math.floor(Math.random() * bank.length);
        } while (bank.length > 2 && quizState && pick === quizState.idx);

        const q = bank[pick];
        quizState = { idx: pick, q, answered: false };

        quizPrompt.textContent = q.q;
        quizOptions.innerHTML = '';

        const shuffled = shuffle([...q.opts]);
        for (const opt of shuffled) {
            const btn = document.createElement('button');
            btn.className = 'quiz-option';
            // Display enzyme name if it's a key
            if (currentMode === 'quiz-enzymes' && ENZYMES[opt]) {
                btn.textContent = ENZYMES[opt].name;
                btn.dataset.key = opt;
            } else {
                btn.textContent = opt;
                btn.dataset.key = opt;
            }
            btn.addEventListener('click', () => handleAnswer(btn, opt, q));
            quizOptions.appendChild(btn);
        }
    }

    function handleAnswer(btn, answer, q) {
        if (quizState.answered) return;
        quizState.answered = true;
        score.total++;

        const correct = answer === q.a;
        if (correct) {
            score.correct++;
            score.streak++;
            btn.classList.add('correct');
            if (currentMode === 'quiz-enzymes') {
                const enz = ENZYMES[q.a];
                showFB(true, `Correct! ${enz.name}: ${enz.fn}`);
            } else {
                showFB(true, `Correct!`);
            }
        } else {
            score.streak = 0;
            btn.classList.add('wrong');
            // Highlight correct answer
            quizOptions.querySelectorAll('.quiz-option').forEach(o => {
                if (o.dataset.key === q.a) o.classList.add('highlight-correct');
            });
            if (currentMode === 'quiz-enzymes') {
                const enz = ENZYMES[q.a];
                showFB(false, `The answer is ${enz.name}: ${enz.fn}`);
            } else {
                showFB(false, `The answer is: ${q.a}`);
            }
        }
        updateScore();
        setTimeout(nextQuestion, 2200);
    }

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
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ——— Init ———
    quizPanel.style.display = 'none';
    setTimeout(renderExplore, 60);

    window.addEventListener('resize', () => {
        if (currentMode === 'explore') renderExplore();
    });
})();
