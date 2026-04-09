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
    const mphEl = document.querySelector('.mph-value');
    if (mphEl) {
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
            mphEl.textContent = Math.round(mph);
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
});
