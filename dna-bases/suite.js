const LABS = {
    strand: {
        id: "strand",
        label: "Strand Lab",
        title: "DNA Strand Lab",
        kicker: "Base Geometry",
        summary: "Explore base structure, hydrogen-bond pairing, and complementary strand assembly in one interactive surface.",
        embedSrc: "./strand-lab.html",
        directHref: "./strand-lab.html",
        pills: [
            { label: "Pairing", tone: "cool" },
            { label: "H-Bonds", tone: "warm" },
            { label: "Quizzes", tone: "success" },
        ],
    },
    phosphodiester: {
        id: "phosphodiester",
        label: "Phosphodiester",
        title: "Phosphodiester Lab",
        kicker: "Backbone Chemistry",
        summary: "Build a DNA polymer nucleotide-by-nucleotide and see how the 3' hydroxyl and 5' phosphate form the backbone.",
        embedSrc: "../dna-molecule-builder/index.html",
        directHref: "../dna-molecule-builder/index.html",
        pills: [
            { label: "3'→5' Bonds", tone: "warm" },
            { label: "Backbone", tone: "cool" },
            { label: "Polymer Growth", tone: "success" },
        ],
    },
    replication: {
        id: "replication",
        label: "Replication",
        title: "DNA Replication Study",
        kicker: "Fork Mechanics",
        summary: "Study the replication fork, enzyme roles, bond chemistry, and quiz through leading and lagging strand concepts.",
        embedSrc: "../dna-replication/index.html",
        directHref: "../dna-replication/index.html",
        pills: [
            { label: "Enzymes", tone: "cool" },
            { label: "Fork Logic", tone: "warm" },
            { label: "Concept Quiz", tone: "success" },
        ],
    },
};

const LAB_ORDER = ["strand", "phosphodiester", "replication"];
const THEME_KEY = "dna-learning-suite-theme";
const LAB_KEY = "dna-learning-suite-lab";

const app = document.querySelector(".suite-app");
const header = document.getElementById("suite-header");
const revealZone = document.getElementById("suite-reveal-zone");
const themeToggle = document.getElementById("suite-theme-toggle");
const directLink = document.getElementById("suite-direct-link");
const stageKicker = document.getElementById("suite-stage-kicker");
const stageTitle = document.getElementById("suite-stage-title");
const stageSummary = document.getElementById("suite-stage-summary");
const pillRow = document.getElementById("suite-pill-row");
const pathRow = document.getElementById("suite-path");
const tabs = Array.from(document.querySelectorAll(".suite-tab"));
const frames = {
    strand: document.getElementById("frame-strand"),
    phosphodiester: document.getElementById("frame-phosphodiester"),
    replication: document.getElementById("frame-replication"),
};

const supportsAutoHide = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

let currentTheme = getInitialTheme();
let activeLab = getInitialLab();
let hideTimer = null;

function getInitialTheme() {
    const params = new URLSearchParams(window.location.search);
    const requestedTheme = params.get("theme");
    if (requestedTheme === "light" || requestedTheme === "dark") {
        return requestedTheme;
    }

    return window.localStorage.getItem(THEME_KEY) || "dark";
}

function getInitialLab() {
    const params = new URLSearchParams(window.location.search);
    const requestedLab = params.get("lab");
    if (requestedLab && LABS[requestedLab]) {
        return requestedLab;
    }

    const saved = window.localStorage.getItem(LAB_KEY);
    if (saved && LABS[saved]) {
        return saved;
    }

    return "strand";
}

function buildEmbedSrc(labId) {
    const lab = LABS[labId];
    const url = new URL(lab.embedSrc, window.location.href);
    url.searchParams.set("embedded", "1");
    url.searchParams.set("theme", currentTheme);
    return url.toString();
}

function syncTheme(frame) {
    frame.contentWindow?.postMessage({ type: "theme-change", mode: currentTheme }, "*");
}

function loadFrames() {
    LAB_ORDER.forEach((labId) => {
        const frame = frames[labId];
        frame.addEventListener("load", () => syncTheme(frame));
        frame.addEventListener("mouseenter", () => scheduleHide(900));
        frame.addEventListener("focus", () => scheduleHide(700));
        frame.src = buildEmbedSrc(labId);
    });
}

function updateThemeUI() {
    app.dataset.theme = currentTheme;
    themeToggle.textContent = currentTheme === "dark" ? "Light" : "Dark";
    window.localStorage.setItem(THEME_KEY, currentTheme);
    Object.values(frames).forEach(syncTheme);
}

function updateLabUI() {
    const lab = LABS[activeLab];

    stageKicker.textContent = lab.kicker;
    stageTitle.textContent = lab.title;
    stageSummary.textContent = lab.summary;
    directLink.href = lab.directHref;
    directLink.textContent = `Open ${lab.title}`;

    tabs.forEach((tab) => {
        const selected = tab.dataset.lab === activeLab;
        tab.classList.toggle("is-active", selected);
        tab.setAttribute("aria-selected", String(selected));
    });

    Object.entries(frames).forEach(([labId, frame]) => {
        frame.classList.toggle("is-active", labId === activeLab);
    });

    pillRow.innerHTML = "";
    lab.pills.forEach((pill) => {
        const chip = document.createElement("span");
        chip.className = `suite-pill suite-pill--${pill.tone}`;
        chip.textContent = pill.label;
        pillRow.appendChild(chip);
    });

    pathRow.innerHTML = "";
    LAB_ORDER.forEach((labId, index) => {
        const step = document.createElement("span");
        step.className = `suite-path__step${labId === activeLab ? " is-active" : ""}`;
        step.dataset.index = `0${index + 1}`;
        step.textContent = LABS[labId].label;
        pathRow.appendChild(step);
    });

    window.localStorage.setItem(LAB_KEY, activeLab);
    const url = new URL(window.location.href);
    url.searchParams.set("lab", activeLab);
    url.searchParams.set("theme", currentTheme);
    window.history.replaceState({}, "", url);
}

function setTheme(nextTheme) {
    currentTheme = nextTheme === "light" ? "light" : "dark";
    updateThemeUI();
}

function setActiveLab(nextLab) {
    if (!LABS[nextLab]) {
        return;
    }

    activeLab = nextLab;
    updateLabUI();
    showNav();
    scheduleHide(2200);
}

function showNav() {
    if (!supportsAutoHide) {
        return;
    }

    app.classList.remove("nav-hidden");
    scheduleHide(2600);
}

function scheduleHide(delay = 2200) {
    if (!supportsAutoHide) {
        return;
    }

    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
        if (header.matches(":hover")) {
            scheduleHide(1200);
            return;
        }
        app.classList.add("nav-hidden");
    }, delay);
}

function bindEvents() {
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => setActiveLab(tab.dataset.lab));
    });

    themeToggle.addEventListener("click", () => {
        setTheme(currentTheme === "dark" ? "light" : "dark");
        scheduleHide(2200);
    });

    if (!supportsAutoHide) {
        return;
    }

    revealZone.addEventListener("mouseenter", showNav);
    header.addEventListener("mouseenter", showNav);
    header.addEventListener("mouseleave", () => scheduleHide(900));
    document.addEventListener("keydown", showNav);
    document.addEventListener("focusin", showNav);
    document.addEventListener("mousemove", (event) => {
        if (event.clientY <= 56) {
            showNav();
        }
    });
}

loadFrames();
updateThemeUI();
updateLabUI();
bindEvents();
scheduleHide(2800);
