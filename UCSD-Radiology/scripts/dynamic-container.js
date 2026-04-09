(function () {
    window.Webflow = window.Webflow || [];
    window.Webflow.push(() => {
        if (!gsap.core.globals().ScrollTrigger) {
            gsap.registerPlugin(ScrollTrigger);
        }

        class DynamicContainer {
            constructor(element) {
                this.element = element;
                if (!this.element) {
                    console.error("DynamicContainer: Element not provided or not found.");
                    return;
                }
                this.init();
            }

            init() {
                this.createScrollTrigger();
                window.addEventListener('resize', gsap.debounce(this.createScrollTrigger.bind(this), 250));
            }

            createScrollTrigger() {
                console.log("Creating scroll trigger for:", this.element);

                ScrollTrigger.getAll().forEach(trigger => {
                    if (trigger.trigger && (trigger.trigger === this.element || trigger.trigger === this.element.parentElement)) {
                        trigger.kill();
                    }
                });
                gsap.killTweensOf(this.element);

                const isDesktop = window.innerWidth >= 768;
                const viewportWidth = window.innerWidth;

                const computedStyle = getComputedStyle(this.element);
                let elementMaxWidth = computedStyle.maxWidth;
                let targetWidthPx = viewportWidth; // Default to viewportWidth (scale = 1)
                let scaleIsBasedOnMaxWidth = false;

                // Read the final border radius from CSS
                const finalBorderRadius = computedStyle.borderRadius;
                console.log(`Targeting final border-radius from CSS: ${finalBorderRadius}`);

                if (elementMaxWidth && elementMaxWidth !== 'none' && elementMaxWidth !== 'auto') {
                    if (elementMaxWidth.endsWith('px')) {
                        targetWidthPx = parseFloat(elementMaxWidth);
                        scaleIsBasedOnMaxWidth = true;
                    } else if (elementMaxWidth.endsWith('rem')) {
                        targetWidthPx = parseFloat(elementMaxWidth) * parseFloat(getComputedStyle(document.documentElement).fontSize);
                        scaleIsBasedOnMaxWidth = true;
                    } else {
                        console.warn(`Max-width ('${elementMaxWidth}') is in an unsupported unit. Element will not scale based on max-width.`);
                    }
                } else {
                    console.warn("Max-width is 'none', 'auto', or not set. Element will not scale based on max-width.");
                }
                
                if (scaleIsBasedOnMaxWidth) {
                    targetWidthPx = Math.min(targetWidthPx, viewportWidth); // Cap at viewport width
                }

                const targetScale = targetWidthPx / viewportWidth;
                if (targetScale === 1 && scaleIsBasedOnMaxWidth && parseFloat(elementMaxWidth) > 0 ){
                    console.log("Target scale is 1 because max-width is >= viewport width.");
                } else if (targetScale === 1 && !scaleIsBasedOnMaxWidth){
                    console.log("Target scale is 1 (no scaling) because max-width was not usable or not set to a specific value.");
                }

                gsap.set(this.element, {
                    width: '100vw',
                    height: '100vh',
                    scale: 1,
                    borderRadius: '0px', // Start with no border radius
                    // transformOrigin: 'center center' // Set initial if needed, but GSAP defaults to this for scale
                });

                gsap.to(this.element, {
                    scale: targetScale, 
                    borderRadius: finalBorderRadius, // Animate to the computed border radius
                    ease: 'expo.inOut',
                    // duration: 0.9, // Removed, scrub will control timing
                    transformOrigin: "center center", 

                    scrollTrigger: {
                        trigger: this.element, 
                        start: "top 80%", 
                        end: "+=100%", // Animation completes over a scroll distance of 100% viewport height
                        scrub: 1, // Smoothly links animation to scroll
                        // toggleActions: "play none none reverse", // Removed, scrub handles this
                        // markers: true,
                    }
                });
            }
        }

        const containers = document.querySelectorAll('.dynamic-container');
        if (containers.length > 0) {
            containers.forEach(container => new DynamicContainer(container));
        } else {
            console.warn("No elements with class .dynamic-container found to initialize.");
        }
    });
})();
