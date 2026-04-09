/* script.js */

document.addEventListener('DOMContentLoaded', () => {
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

    // 2. Navbar Background Blur on Scroll
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(10, 10, 10, 0.85)';
            navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
        } else {
            navbar.style.background = 'rgba(10, 10, 10, 0.7)';
            navbar.style.boxShadow = 'none';
        }
    });

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

    // 6. Live MPH counter synced with gauge animation
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

    // 7. Interactive card hover glow that follows mouse
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
    // 8. Hero – Typing Role Animation
    // ═══════════════════════════════════════
    const typedEl = document.getElementById('typed-role');
    if (typedEl) {
        const roles = [
            'physiological visualization tools.',
            'embedded medical devices.',
            'clinical data pipelines.',
            'molecular structure editors.',
            'patient-facing health platforms.',
            'real-time biosignal systems.'
        ];
        let roleIndex = 0;
        let charIndex = 0;
        let deleting = false;
        const typeSpeed = 65;
        const deleteSpeed = 35;
        const pauseAfterType = 2000;
        const pauseAfterDelete = 400;

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
        setTimeout(typeRole, 800); // Initial delay before typing starts
    }

    // ═══════════════════════════════════════
    // 9. Hero – Parallax Mouse Tracking
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
                    imgWrapper.style.transform = `translate(${x * 12}px, ${y * 12}px)`;
                }

                // Orbit rings parallax at different intensities
                rings.forEach((ring, i) => {
                    const intensity = (i + 1) * 8;
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
    // 10. Hero – Floating Particles Canvas
    // ═══════════════════════════════════════
    const heroCanvas = document.getElementById('hero-particles');
    if (heroCanvas) {
        const ctx = heroCanvas.getContext('2d');
        let particles = [];
        const particleCount = 45; // Increased particle count for more interaction
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
            'rgba(59, 130, 246, 0.35)',
            'rgba(139, 92, 246, 0.3)',
            'rgba(16, 185, 129, 0.3)',
            'rgba(255, 255, 255, 0.15)'
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
                if (mouseDist < 180) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(mousePos.x, mousePos.y);
                    ctx.strokeStyle = `rgba(139, 92, 246, ${0.2 * (1 - mouseDist / 180)})`;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    
                    // slight attraction to mouse for interactive feel
                    particles[i].dx += (mousePos.x - particles[i].x) * 0.00015;
                    particles[i].dy += (mousePos.y - particles[i].y) * 0.00015;
                }

                for (let j = i + 1; j < particles.length; j++) {
                    const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(59, 130, 246, ${0.08 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.8;
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
    // 11. Hero – Scroll Parallax (Content fades / shifts as you scroll down)
    // ═══════════════════════════════════════
    const heroContent = document.querySelector('.hero-content');
    const heroVisualEl = document.querySelector('.hero-visual');

    if (heroContent && heroVisualEl) {
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            const factor = Math.min(scrollY / 600, 1);

            heroContent.style.transform = `translateY(${scrollY * 0.15}px)`;
            heroContent.style.opacity = 1 - factor * 0.6;

            heroVisualEl.style.transform = `translateY(${scrollY * 0.08}px)`;
        }, { passive: true });
    }
});
