gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

document.addEventListener("DOMContentLoaded", function () {
    const video = document.querySelector(".bt-video video");
    const videoSection = document.querySelector(".bt-video-section");
    const smoothScrollContainer = document.getElementById("smooth-scroll");

    if (!video || !videoSection) {
        console.error("Video or video section not found!");
        return;
    }

    // Video settings
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const frameRate = 60;
    const frameDuration = 1 / frameRate;
    let lastFrameTime = performance.now();

    // Use #smooth-scroll as wrapper/content if it exists, otherwise default
    let smoother;
    if (smoothScrollContainer) {
        smoother = ScrollSmoother.create({
            wrapper: "#smooth-scroll",
            content: "#smooth-scroll > *",
            smooth: 2,
            effects: true
        });
    } else {
        smoother = ScrollSmoother.create({
            smooth: 2,
            effects: true
        });
    }

    function initScrollSync() {
        video.play().then(() => {
            video.pause();

            ScrollTrigger.create({
                trigger: videoSection,
                start: "top top",
                end: "bottom top",
                scrub: true,
                scroller: smoother && smoother.scrollContainer,
                onUpdate: (self) => {
                    if (!video.duration) return;

                    const now = performance.now();
                    const elapsedTime = (now - lastFrameTime) / 1000;

                    if (elapsedTime >= frameDuration) {
                        const targetTime = self.progress * video.duration;

                        gsap.to(video, {
                            currentTime: targetTime,
                            duration: 0.03,
                            ease: "none"
                        });

                        lastFrameTime = now;
                    }
                },
                invalidateOnRefresh: true
            });
        }).catch(console.error);
    }

    video.addEventListener("loadedmetadata", () => {
        video.currentTime = 0;
        video.play().then(() => {
            video.pause();
            initScrollSync();
        }).catch(console.error);
    });

    document.addEventListener("touchstart", () => {
        video.play().then(() => video.pause()).catch(console.error);
    }, { once: true });

    window.addEventListener("resize", () => {
        ScrollTrigger.refresh();
        if (smoother) smoother.refresh();
    });
});