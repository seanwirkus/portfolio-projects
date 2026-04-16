/* script.js */

document.addEventListener('DOMContentLoaded', () => {
    const THEME_STORAGE_MODE = 'portfolio-theme-mode';
    const THEME_STORAGE_PALETTE = 'portfolio-theme-palette';
    const VALID_THEME_MODES = new Set(['dark', 'light']);
    const VALID_THEME_PALETTES = new Set(['ocean', 'forest', 'sunrise']);
    const themeState = getInitialThemeState();

    function getInitialThemeState() {
        const params = new URLSearchParams(window.location.search);
        const queryMode = params.get('mode');
        const queryPalette = params.get('theme');
        let mode = 'dark';
        let palette = 'ocean';

        try {
            const savedMode = window.localStorage.getItem(THEME_STORAGE_MODE);
            const savedPalette = window.localStorage.getItem(THEME_STORAGE_PALETTE);
            if (VALID_THEME_MODES.has(savedMode)) mode = savedMode;
            if (VALID_THEME_PALETTES.has(savedPalette)) palette = savedPalette;
        } catch (error) {
            // Ignore storage failures and keep defaults.
        }

        if (VALID_THEME_MODES.has(queryMode)) mode = queryMode;
        if (VALID_THEME_PALETTES.has(queryPalette)) palette = queryPalette;

        return { mode, palette };
    }

    function persistThemeState() {
        try {
            window.localStorage.setItem(THEME_STORAGE_MODE, themeState.mode);
            window.localStorage.setItem(THEME_STORAGE_PALETTE, themeState.palette);
        } catch (error) {
            // Ignore storage failures.
        }
    }

    function syncThemeImages() {
        const isLight = themeState.mode === 'light';
        document.querySelectorAll('[data-theme-src-dark][data-theme-src-light]').forEach((element) => {
            const nextSrc = isLight ? element.dataset.themeSrcLight : element.dataset.themeSrcDark;
            if (!nextSrc) return;

            if (element.tagName === 'IMG') {
                if (element.getAttribute('src') !== nextSrc) {
                    element.setAttribute('src', nextSrc);
                }
                return;
            }

            if (element.tagName === 'SOURCE') {
                if (element.getAttribute('srcset') !== nextSrc) {
                    element.setAttribute('srcset', nextSrc);
                }
            }
        });

        document.querySelectorAll('meta[data-theme-content-dark][data-theme-content-light]').forEach((meta) => {
            const nextContent = isLight ? meta.dataset.themeContentLight : meta.dataset.themeContentDark;
            if (nextContent && meta.getAttribute('content') !== nextContent) {
                meta.setAttribute('content', nextContent);
            }
        });
    }

    function applyThemeState() {
        document.body.dataset.themeMode = themeState.mode;
        document.body.dataset.themePalette = themeState.palette;
        document.documentElement.style.colorScheme = themeState.mode;
        document.body.classList.toggle('cell-light-mode', themeState.mode === 'light');
        syncThemeImages();
        window.dispatchEvent(new CustomEvent('site-theme-change', {
            detail: { ...themeState }
        }));
    }

    function createThemeDock() {
        if (!document.body || document.querySelector('.theme-toggle-btn')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'theme-toggle-btn magnetic';
        btn.setAttribute('aria-label', 'Toggle dark/light mode');
        btn.innerHTML = `
            <span class="theme-toggle-icon theme-toggle-icon--dark" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4A9 9 0 1 0 20 14.5z"></path>
                </svg>
            </span>
            <span class="theme-toggle-icon theme-toggle-icon--light" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2.5v2.5"></path>
                    <path d="M12 19v2.5"></path>
                    <path d="M4.93 4.93l1.77 1.77"></path>
                    <path d="M17.3 17.3l1.77 1.77"></path>
                    <path d="M2.5 12H5"></path>
                    <path d="M19 12h2.5"></path>
                    <path d="M4.93 19.07l1.77-1.77"></path>
                    <path d="M17.3 6.7l1.77-1.77"></path>
                </svg>
            </span>
        `;

        document.body.appendChild(btn);

        function syncToggleState() {
            const isLight = themeState.mode === 'light';
            btn.classList.toggle('is-light', isLight);
            btn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
        }

        btn.addEventListener('click', () => {
            themeState.mode = themeState.mode === 'light' ? 'dark' : 'light';
            persistThemeState();
            applyThemeState();
            syncToggleState();
        });

        window.addEventListener('site-theme-change', syncToggleState);
        syncToggleState();
    }

    function enhanceNavbar() {
        const navbar = document.querySelector('.navbar');
        const navContent = navbar?.querySelector('.nav-content');
        const navLinks = navbar?.querySelector('.nav-links');
        if (!navbar || !navContent || !navLinks) return;
        if (navLinks.children.length <= 2 || navContent.querySelector('.nav-menu-toggle')) return;

        const navId = navLinks.id || 'site-nav-links';
        navLinks.id = navId;
        navbar.classList.add('has-nav-toggle');

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'nav-menu-toggle';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', navId);
        toggle.setAttribute('aria-label', 'Toggle navigation');
        toggle.innerHTML = `
            <span class="nav-menu-toggle__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                    <path d="M4 7.5h16"></path>
                    <path d="M4 12h16"></path>
                    <path d="M4 16.5h16"></path>
                </svg>
            </span>
            <span>Menu</span>
        `;
        navContent.appendChild(toggle);

        const mobileQuery = window.matchMedia('(max-width: 768px)');

        const setNavOpen = (open) => {
            const active = Boolean(open && mobileQuery.matches);
            navbar.classList.toggle('is-open', active);
            document.body.classList.toggle('nav-open', active);
            toggle.setAttribute('aria-expanded', active ? 'true' : 'false');
        };

        toggle.addEventListener('click', () => {
            setNavOpen(!navbar.classList.contains('is-open'));
        });

        navLinks.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                setNavOpen(false);
            });
        });

        document.addEventListener('click', (event) => {
            if (!mobileQuery.matches || !navbar.classList.contains('is-open')) return;
            if (!navbar.contains(event.target)) {
                setNavOpen(false);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && navbar.classList.contains('is-open')) {
                setNavOpen(false);
                toggle.focus();
            }
        });

        const syncNavForViewport = () => {
            if (!mobileQuery.matches) {
                setNavOpen(false);
            }
        };

        if (typeof mobileQuery.addEventListener === 'function') {
            mobileQuery.addEventListener('change', syncNavForViewport);
        } else if (typeof mobileQuery.addListener === 'function') {
            mobileQuery.addListener(syncNavForViewport);
        }

        syncNavForViewport();
    }

    function syncIframeThemes(mode) {
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                // Method 1: Direct document manipulation (if same-origin)
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (doc) {
                    doc.documentElement.style.colorScheme = mode;
                    doc.body.dataset.themeMode = mode;
                    // Trigger a custom event inside the iframe if it's listening
                    doc.dispatchEvent(new CustomEvent('site-theme-change', { detail: { mode } }));
                }
            } catch (e) {
                // Cross-origin iframes will fail here, handled by postMessage
            }
            
            // Method 2: postMessage (useful for cross-origin or nested shells)
            iframe.contentWindow?.postMessage({ type: 'theme-change', mode }, '*');
        });
    }

    applyThemeState();
    createThemeDock();
    enhanceNavbar();

    // Notify iframes on initial load and theme change
    window.addEventListener('site-theme-change', (e) => {
        syncIframeThemes(e.detail.mode);
    });

    // Handle newly loaded iframes (e.g. from modals)
    document.addEventListener('load', (e) => {
        if (e.target.tagName === 'IFRAME') {
            syncIframeThemes(themeState.mode);
        }
    }, true);

    // 1. Intersection Observer for Scroll Animations
    const observerOptions = {
        root: null,
        rootMargin: '40px',
        threshold: 0.05
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    const revealIfInView = (element) => {
        const rect = element.getBoundingClientRect();
        const viewportThreshold = window.innerHeight * 0.05;

        if (rect.top <= window.innerHeight - viewportThreshold && rect.bottom >= 0) {
            element.classList.add('visible');
        }
    };

    const sections = document.querySelectorAll('.section-animate');
    sections.forEach(section => {
        revealIfInView(section);
        observer.observe(section);
    });

    const slideUpItems = document.querySelectorAll('.slide-up');
    slideUpItems.forEach(item => {
        revealIfInView(item);
        observer.observe(item);
    });

    const refreshAnimatedVisibility = () => {
        sections.forEach(revealIfInView);
        slideUpItems.forEach(revealIfInView);
    };

    window.addEventListener('load', () => {
        window.requestAnimationFrame(refreshAnimatedVisibility);
        window.setTimeout(refreshAnimatedVisibility, 160);
    });

    window.addEventListener('hashchange', () => {
        window.requestAnimationFrame(refreshAnimatedVisibility);
    });

    // 2. Navbar Background Blur on Scroll
    const navbar = document.querySelector('.navbar');
    const updateNavbarChrome = () => {
        if (!navbar) return;
        const styles = getComputedStyle(document.body);
        if (window.scrollY > 50) {
            navbar.style.background = styles.getPropertyValue('--nav-bg-scrolled').trim() || '';
            navbar.style.boxShadow = styles.getPropertyValue('--nav-shadow-scrolled').trim() || 'none';
        } else {
            navbar.style.background = styles.getPropertyValue('--nav-bg-rest').trim() || '';
            navbar.style.boxShadow = styles.getPropertyValue('--nav-shadow-rest').trim() || 'none';
        }
    };
    window.addEventListener('scroll', updateNavbarChrome, { passive: true });
    window.addEventListener('site-theme-change', updateNavbarChrome);
    updateNavbarChrome();

    // 3. Smooth Scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if(targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const offsetTop = targetElement.getBoundingClientRect().top + window.pageYOffset;
                window.scrollTo({
                    top: offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 4. 3D Tilt Effect
    const tiltElements = document.querySelectorAll('.tilt-elem');
    const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    
    if (!isTouchDevice) {
        tiltElements.forEach(elem => {
            elem.addEventListener('mousemove', (e) => {
                const rect = elem.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const multiplier = 7.5; // smaller is less tilt
                const xRotate = multiplier * ((x - rect.width / 2) / rect.width);
                const yRotate = -multiplier * ((y - rect.height / 2) / rect.height);
                
                elem.style.transform = `perspective(1000px) rotateX(${yRotate}deg) rotateY(${xRotate}deg) scale3d(1.02, 1.02, 1.02)`;
            });

            elem.addEventListener('mouseleave', () => {
                elem.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
                setTimeout(() => {
                    if(!elem.matches(':hover')) {
                        elem.style.transition = 'transform 0.4s ease';
                    }
                }, 50);
            });
            
            elem.addEventListener('mouseenter', () => {
                elem.style.transition = 'transform 0.1s ease';
            });
        });
    }

        // 5. Auto-resize same-origin project preview iframes to avoid nested scrollbars
        const projectFrames = document.querySelectorAll('.project-frame[data-auto-resize]');
        projectFrames.forEach((frame) => {
            const shell = frame.closest('.project-frame-shell');
            const minHeight = Number(frame.dataset.minHeight || 720);
            const maxHeight = Number(frame.dataset.maxHeight || 2200);
            let resizeObserver = null;
            let currentHeight = 0; // track height to avoid loops

            const applyHeight = () => {
                try {
                    const doc = frame.contentDocument;
                    if (!doc) return;

                    const html = doc.documentElement;
                    const body = doc.body;
                    const contentHeight = Math.max(
                        html ? html.scrollHeight : 0,
                        html ? html.offsetHeight : 0,
                        body ? body.scrollHeight : 0,
                        body ? body.offsetHeight : 0
                    );

                    if (!contentHeight) return;

                    const nextHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight);
                    if (nextHeight !== currentHeight) { // Only update if changed!
                        currentHeight = nextHeight;
                        frame.style.height = `${nextHeight}px`;
                        if (shell) {
                            shell.style.height = `${nextHeight}px`;
                        }
                    }
                } catch (error) {
                    // Ignore cross-document or early-load access errors.
                }
            };

            frame.addEventListener('load', () => {
                applyHeight();

                try {
                    const doc = frame.contentDocument;
                    if (!doc || !doc.documentElement) return;

                    if ('ResizeObserver' in window) {
                        resizeObserver = new ResizeObserver(() => applyHeight());
                        resizeObserver.observe(doc.documentElement);
                        if (doc.body) resizeObserver.observe(doc.body);
                    }
                } catch (error) {
                    // Ignore inaccessible documents.
                }

                window.setTimeout(applyHeight, 150);
                window.setTimeout(applyHeight, 600);
                window.setTimeout(applyHeight, 1200);
            });

            window.addEventListener('resize', applyHeight);
        });

    // 6. Click-to-expand theater previews for full-page scrolling inside embedded sites
    const previewOpeners = document.querySelectorAll('[data-preview-theater-open]');
    previewOpeners.forEach((opener) => {
        const modalId = opener.dataset.previewTheaterOpen;
        if (!modalId) return;

        const modal = document.getElementById(modalId);
        if (!modal) return;

        const frame = modal.querySelector('[data-preview-theater-frame]');
        const closeTargets = modal.querySelectorAll('[data-preview-theater-close]');
        const closeButton = modal.querySelector('.project-preview-modal__close');
        const sourceFrame = opener.closest('.project-frame-shell')?.querySelector('.project-frame');
        const source = opener.dataset.previewSrc || sourceFrame?.getAttribute('src') || '';
        let lastFocused = null;

        const openModal = () => {
            lastFocused = document.activeElement;
            if (frame && source && frame.getAttribute('src') !== source) {
                frame.setAttribute('src', source);
            }
            modal.hidden = false;
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            window.setTimeout(() => {
                if (closeButton) closeButton.focus();
            }, 30);
        };

        const closeModal = () => {
            modal.hidden = true;
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
            if (lastFocused instanceof HTMLElement) {
                lastFocused.focus();
            }
        };

        opener.addEventListener('click', openModal);
        closeTargets.forEach((target) => target.addEventListener('click', closeModal));

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modal.hidden) {
                closeModal();
            }
        });
    });

    // 7. Live MPH counter synced with gauge animation
    const mphEls = document.querySelectorAll('.mph-value');
    if (mphEls.length > 0) {
        // Keyframes match the CSS fillGauge / sweepNeedle animation (3s loop)
        // 0% → 0mph, 30% → 65mph, 60% → 88mph, 80% → 48mph, 100% → 0mph
        const keyframes = [
            { t: 0, v: 0 },
            { t: 0.30, v: 65 },
            { t: 0.60, v: 88 },
            { t: 0.80, v: 48 },
            { t: 1.0, v: 0 }
        ];
        const duration = 3000; // matches CSS 3s

        function lerp(a, b, t) { return a + (b - a) * t; }

        function animateMPH() {
            const elapsed = Date.now() % duration;
            const progress = elapsed / duration;

            let mph = 0;
            for (let i = 0; i < keyframes.length - 1; i++) {
                if (progress >= keyframes[i].t && progress <= keyframes[i + 1].t) {
                    const segProgress = (progress - keyframes[i].t) / (keyframes[i + 1].t - keyframes[i].t);
                    mph = lerp(keyframes[i].v, keyframes[i + 1].v, segProgress);
                    break;
                }
            }
            
            const roundedMph = Math.round(mph);
            mphEls.forEach(el => el.textContent = roundedMph);
            
            requestAnimationFrame(animateMPH);
        }
        requestAnimationFrame(animateMPH);
    }

    // 8. Interactive card hover glow that follows mouse
    if (!isTouchDevice) {
        document.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--glow-x', x + 'px');
                card.style.setProperty('--glow-y', y + 'px');
            });
        });
    }

    // ═══════════════════════════════════════
    // 9. Hero – Typing Role Animation
    // ═══════════════════════════════════════
    const typedEl = document.getElementById('typed-role');
    if (typedEl) {
        const roles = [
            'clinical interfaces.',
            'physiological visualization tools.',
            'embedded medical devices.',
            'clinical data pipelines.',
            'molecular structure editors.',
            'patient-facing health platforms.',
            'real-time biosignal systems.'
        ];
        let roleIndex = 0;
        let charIndex = roles[0].length;
        let deleting = true; // start by deleting the pre-shown first role, then cycle normally
        const typeSpeed = 65;
        const deleteSpeed = 35;
        const pauseAfterType = 2000;
        const pauseAfterDelete = 400;

        typedEl.textContent = roles[0];

        function typeRole() {
            const current = roles[roleIndex];
            if (!deleting) {
                typedEl.textContent = current.substring(0, charIndex + 1);
                charIndex++;
                if (charIndex === current.length) {
                    setTimeout(() => { deleting = true; typeRole(); }, pauseAfterType);
                    return;
                }
                setTimeout(typeRole, typeSpeed);
            } else {
                typedEl.textContent = current.substring(0, charIndex);
                charIndex--;
                if (charIndex < 0) {
                    deleting = false;
                    charIndex = 0;
                    roleIndex = (roleIndex + 1) % roles.length;
                    setTimeout(typeRole, pauseAfterDelete);
                    return;
                }
                setTimeout(typeRole, deleteSpeed);
            }
        }
        setTimeout(typeRole, pauseAfterType);
    }

    // ═══════════════════════════════════════
    // 10. Hero – Parallax Mouse Tracking
    // ═══════════════════════════════════════
    if (!isTouchDevice) {
        const heroSection = document.querySelector('.hero');
        const heroVisual = document.getElementById('hero-visual');

        if (heroSection && heroVisual) {
            const rings = heroVisual.querySelectorAll('.hero-orbit-ring');
            const imgWrapper = heroVisual.querySelector('.hero-image-wrapper');

            heroSection.addEventListener('mousemove', (e) => {
                const rect = heroSection.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;   // -0.5 to 0.5
                const y = (e.clientY - rect.top) / rect.height - 0.5;

                // Image wrapper subtle shift
                if (imgWrapper) {
                    imgWrapper.style.transform = `translate(${x * 7}px, ${y * 7}px)`;
                }

                // Orbit rings parallax at different intensities
                rings.forEach((ring, i) => {
                    const intensity = (i + 1) * 5;
                    ring.style.marginLeft = `${x * intensity}px`;
                    ring.style.marginTop = `${y * intensity}px`;
                });
            });

            heroSection.addEventListener('mouseleave', () => {
                if (imgWrapper) {
                    imgWrapper.style.transform = '';
                    imgWrapper.style.transition = 'transform 0.6s ease';
                    setTimeout(() => { imgWrapper.style.transition = ''; }, 600);
                }
                rings.forEach(ring => {
                    ring.style.marginLeft = '';
                    ring.style.marginTop = '';
                    ring.style.transition = 'margin 0.6s ease';
                    setTimeout(() => { ring.style.transition = ''; }, 600);
                });
            });
        }
    }

    // ═══════════════════════════════════════
    // 11. Hero – Floating Particles Canvas
    // ═══════════════════════════════════════
    const heroCanvas = document.getElementById('hero-particles');
    if (heroCanvas) {
        const ctx = heroCanvas.getContext('2d');
        let particles = [];
        const particleCount = 14;
        let mousePos = { x: -1000, y: -1000 };
        const heroSection = document.querySelector('.hero');
        
        if (heroSection) {
            heroSection.addEventListener('mousemove', (e) => {
                const rect = heroCanvas.getBoundingClientRect();
                mousePos.x = e.clientX - rect.left;
                mousePos.y = e.clientY - rect.top;
            });
            heroSection.addEventListener('mouseleave', () => {
                mousePos.x = -1000;
                mousePos.y = -1000;
            });
        }

        const colors = [
            'rgba(59, 130, 246, 0.18)',
            'rgba(139, 92, 246, 0.12)',
            'rgba(16, 185, 129, 0.12)',
            'rgba(255, 255, 255, 0.06)'
        ];

        function resizeHeroCanvas() {
            const parent = heroCanvas.parentElement;
            heroCanvas.width = parent.offsetWidth + 120;
            heroCanvas.height = parent.offsetHeight + 120;
        }

        function initParticles() {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: Math.random() * heroCanvas.width,
                    y: Math.random() * heroCanvas.height,
                    r: Math.random() * 2.5 + 0.8,
                    dx: (Math.random() - 0.5) * 0.4,
                    dy: (Math.random() - 0.5) * 0.4,
                    color: colors[Math.floor(Math.random() * colors.length)]
                });
            }
        }

        function drawParticles() {
            ctx.clearRect(0, 0, heroCanvas.width, heroCanvas.height);
            particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();

                p.x += p.dx;
                p.y += p.dy;

                if (p.x < 0 || p.x > heroCanvas.width) p.dx *= -1;
                if (p.y < 0 || p.y > heroCanvas.height) p.dy *= -1;
            });

            // Draw faint connecting lines
            for (let i = 0; i < particles.length; i++) {
                // Connect to mouse with interactive glow
                const mouseDist = Math.hypot(particles[i].x - mousePos.x, particles[i].y - mousePos.y);
                if (mouseDist < 96) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(mousePos.x, mousePos.y);
                    ctx.strokeStyle = `rgba(139, 92, 246, ${0.05 * (1 - mouseDist / 96)})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    
                    // slight attraction to mouse for interactive feel
                    particles[i].dx += (mousePos.x - particles[i].x) * 0.00003;
                    particles[i].dy += (mousePos.y - particles[i].y) * 0.00003;
                }

                for (let j = i + 1; j < particles.length; j++) {
                    const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
                    if (dist < 64) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(59, 130, 246, ${0.028 * (1 - dist / 64)})`;
                        ctx.lineWidth = 0.7;
                        ctx.stroke();
                    }
                }
            }

            requestAnimationFrame(drawParticles);
        }

        resizeHeroCanvas();
        initParticles();
        drawParticles();

        window.addEventListener('resize', () => {
            resizeHeroCanvas();
            initParticles();
        });
    }

    // ═══════════════════════════════════════
    // 12. Hero – Scroll Parallax (Content fades / shifts as you scroll down)
    // ═══════════════════════════════════════
    const heroContent = document.querySelector('.hero-content');
    const heroVisualEl = document.querySelector('.hero-visual');

    if (heroContent && heroVisualEl) {
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            const factor = Math.min(scrollY / 600, 1);

            heroContent.style.transform = `translateY(${scrollY * 0.08}px)`;
            heroContent.style.opacity = 1 - factor * 0.32;

            heroVisualEl.style.transform = `translateY(${scrollY * 0.04}px)`;
        }, { passive: true });
    }

    // ═══════════════════════════════════════
    // 13. Ideas – Signal Feed Scroll Sync
    // ═══════════════════════════════════════
    (function initIdeasFeed() {
        const screen = document.querySelector('[data-ideas-feed-screen]');
        const steps = Array.from(document.querySelectorAll('[data-ideas-step]'));
        if (!screen || steps.length === 0) return;

        const byteRain = screen.querySelector('[data-byte-rain]');
        const panelKicker = screen.querySelector('[data-ideas-panel-kicker]');
        const panelTitle = screen.querySelector('[data-ideas-panel-title]');
        const panelSummary = screen.querySelector('[data-ideas-panel-summary]');
        const panelTheme = screen.querySelector('[data-ideas-panel-theme]');
        const panelStatus = screen.querySelector('[data-ideas-panel-status]');
        const panelLines = Array.from(screen.querySelectorAll('[data-ideas-panel-line]'));
        let resizeTimer = null;

        const byteAlphabet = '01ATCG[]{}<>/=+';

        const makeByteChunk = () => {
            const length = 8 + Math.floor(Math.random() * 7);
            let line = '';
            for (let index = 0; index < length; index += 1) {
                line += byteAlphabet[Math.floor(Math.random() * byteAlphabet.length)];
            }
            return line;
        };

        const buildByteRain = () => {
            if (!byteRain) return;

            const columnCount = window.matchMedia('(max-width: 820px)').matches ? 8 : 11;
            byteRain.innerHTML = '';

            for (let index = 0; index < columnCount; index += 1) {
                const column = document.createElement('div');
                const lines = Array.from({ length: 22 }, makeByteChunk).join('\n');

                column.className = 'ideas-byte-column';
                column.textContent = lines;
                column.style.setProperty('--ideas-column-left', `${4 + index * (90 / Math.max(columnCount - 1, 1))}%`);
                column.style.setProperty('--ideas-column-delay', `${(Math.random() * -14).toFixed(2)}s`);
                column.style.setProperty('--ideas-column-duration', `${(15 + Math.random() * 10).toFixed(2)}s`);
                column.style.setProperty('--ideas-column-opacity', `${(0.14 + Math.random() * 0.22).toFixed(2)}`);
                column.style.setProperty('--ideas-column-width', `${(3.4 + Math.random() * 1.8).toFixed(2)}rem`);
                byteRain.appendChild(column);
            }
        };

        const applyStep = (step) => {
            if (!step) return;

            steps.forEach((item) => item.classList.toggle('is-active', item === step));
            screen.dataset.ideasTheme = step.dataset.ideasTheme || 'hook';

            if (panelKicker) panelKicker.textContent = step.dataset.panelKicker || '';
            if (panelTitle) panelTitle.textContent = step.dataset.panelTitle || '';
            if (panelSummary) panelSummary.textContent = step.dataset.panelSummary || '';
            if (panelTheme) panelTheme.textContent = step.dataset.panelTheme || '';
            if (panelStatus) panelStatus.textContent = step.dataset.panelStatus || '';

            const nextLines = (step.dataset.panelLines || '').split('|').filter(Boolean);
            panelLines.forEach((lineNode, index) => {
                const nextLine = nextLines[index];
                lineNode.hidden = !nextLine;
                lineNode.textContent = nextLine || '';
            });
        };

        buildByteRain();
        applyStep(steps[0]);

        const stepObserver = new IntersectionObserver((entries) => {
            const visibleEntries = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

            if (visibleEntries[0]) {
                applyStep(visibleEntries[0].target);
            }
        }, {
            root: null,
            rootMargin: '-22% 0px -46% 0px',
            threshold: [0.2, 0.45, 0.7]
        });

        steps.forEach((step) => {
            stepObserver.observe(step);
            step.addEventListener('mouseenter', () => applyStep(step));
            step.addEventListener('focusin', () => applyStep(step));
        });

        window.addEventListener('resize', () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(buildByteRain, 180);
        }, { passive: true });
    })();

    // ═══════════════════════════════════════
    // 14. Mobile bottom tab bar — active state + scroll progress
    // ═══════════════════════════════════════
    (function initMobileTabs() {
        const tabs = Array.from(document.querySelectorAll('.m-tabbar .m-tab'));
        const progressFill = document.querySelector('.m-progress__fill');
        if (!tabs.length && !progressFill) return;

        // Smooth-scroll tab clicks with offset for the floating top nav
        tabs.forEach((tab) => {
            tab.addEventListener('click', (e) => {
                const targetId = tab.dataset.target;
                const el = targetId && document.getElementById(targetId);
                if (!el) return;
                e.preventDefault();
                const y = el.getBoundingClientRect().top + window.scrollY - 8;
                window.scrollTo({ top: y, behavior: 'smooth' });

                // Haptic tick for supported devices
                if (navigator.vibrate) { try { navigator.vibrate(6); } catch (_) {} }
            });
        });

        // Active-state tracking via scroll position
        const sections = tabs
            .map((t) => document.getElementById(t.dataset.target))
            .filter(Boolean);

        function updateActiveTab() {
            if (!sections.length) return;
            const probe = window.scrollY + window.innerHeight * 0.35;
            let activeIdx = 0;
            sections.forEach((s, i) => {
                if (s.offsetTop <= probe) activeIdx = i;
            });
            tabs.forEach((t, i) => t.classList.toggle('is-active', i === activeIdx));
        }

        function updateProgress() {
            if (!progressFill) return;
            const doc = document.documentElement;
            const scrollable = (doc.scrollHeight - window.innerHeight);
            const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
            progressFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
        }

        let ticking = false;
        function onScroll() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                updateActiveTab();
                updateProgress();
                ticking = false;
            });
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        updateActiveTab();
        updateProgress();
    })();
});
