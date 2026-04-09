
document.addEventListener("DOMContentLoaded", function () {
    gsap.registerPlugin(ScrollTrigger);

    const heroTl = gsap.timeline({
      scrollTrigger: {
        trigger: ".hero-section",
        start: "top top",
        end: "+=300%",
        scrub: 1.5,
        markers: false,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
      },
    });

    // Initial state setup
    gsap.set([".hero__sub-heading-anim", ".hero__links-anim"], {
      opacity: 1,
      y: 0,
    });
    gsap.set(".hero__heading-anim", {
      scale: 1,
      opacity: 1,
    });

    // Timeline animations with extended durations
    heroTl
      // Initial pause
      .addLabel("start")
      .to([".hero__sub-heading-anim", ".hero__links-anim"], {
        opacity: 1,
        y: 0,
        duration: 2,
        ease: "power1.inOut",
      })

      // Hold state
      .to([".hero__sub-heading-anim", ".hero__links-anim"], {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "none",
      })

      // Begin fade out
      .to([".hero__sub-heading-anim", ".hero__links-anim"], {
        opacity: 0,
        y: -50,
        duration: 1.5,
        ease: "power2.inOut",
      })

      // Heading animation
      .to(
        ".hero__heading-anim",
        {
          scale: 1.3,
          opacity: 0.8,
          duration: 2,
          ease: "power2.inOut",
        },
        "-=1"
      ) // Overlap with previous animation

      // Scale up heading
      .to(".hero__heading-anim", {
        scale: 1.5,
        opacity: 0.4,
        duration: 1.5,
        ease: "power2.inOut",
      })

      // Final heading state
      .to(".hero__heading-anim", {
        scale: 1.8,
        opacity: 0,
        duration: 1,
        ease: "power2.in",
      })

      // Additional animations for smooth transitions
      .to(
        ".hero__heading1",
        {
          scale: 2,
          opacity: 0,
          duration: 1,
          ease: "power3.in",
        },
        "-=0.5"
      )

      // Optional Lottie animation trigger
      .add(() => {
        if (window.heroLottie) {
          heroLottie.goToAndPlay(0, true);
        }
      });

    // Smooth scroll initialization
    ScrollTrigger.defaults({
      ease: "power2.inOut",
      overwrite: "auto",
    });

    // Optional: Add scroll-based parallax effects
    gsap.to(".hero-section", {
      scrollTrigger: {
        trigger: ".hero-section",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
      backgroundPosition: "50% 100%",
      ease: "none",
    });

    // Optional: Add responsive breakpoints
    ScrollTrigger.matchMedia({
      "(min-width: 1024px)": function () {
        // Desktop-specific timing adjustments
        heroTl.timeScale(1);
      },
      "(max-width: 767px)": function () {
        // Mobile-specific timing adjustments
        heroTl.timeScale(1.2);
      },
    });

    // Optional: Smooth scroll behavior
    ScrollTrigger.config({
      autoRefreshEvents: "visibilitychange,DOMContentLoaded,load",
      syncInterval: 0.5,
    });
  });
