<div class="vespa-text-container">
 <h1 class="vespa-text">Non-Invasive.</h1>
  <h1 class="vespa-text">High Resolution.</h1>
  <h1 class="vespa-text">Faster Results.</h1>
  <div class="spacer-large"></div>
  <h1 class="vespa-text final-text text-color-yellow">Because Every Second Counts.</h1>
</div>
<script>
// Register GSAP plugin
gsap.registerPlugin(ScrollTrigger);

class VespaTextAnimation {
  constructor() {
    this.container = document.querySelector('.vespa-text-container');
    this.texts = this.container.querySelectorAll('.vespa-text');
    this.finalText = this.container.querySelector('.final-text');
    this.init();
  }

  init() {
    // Create master timeline
    const masterTl = gsap.timeline({
      scrollTrigger: {
        trigger: this.container,
        start: "top 90%",
        end: "bottom -20%", // Optional: Define an end point
        toggleActions: "play reverse play reverse", // Ensures replay when scrolling back
        markers: false // Set to true for debugging
      }
    });

    // Animate regular text lines
    this.texts.forEach((text, index) => {
      if (!text.classList.contains('final-text')) {
        masterTl.from(text, {
          opacity: 0,
          y: 50,
          duration: 0.8,
          ease: "power2.out"
        }, index * 0.2); // Stagger each line
      }
    });

    // Special animation for final yellow text
    if (this.finalText) {
      masterTl
        .from(this.finalText, {
          opacity: 0,
          y: 50,
          duration: 1,
          ease: "power2.out"
        }, "-=0.3")
        .to(this.finalText, {
          scale: 1.1,
          duration: 0.4,
          ease: "power2.inOut"
        })
        .to(this.finalText, {
          scale: 1,
          duration: 0.3,
          ease: "power2.out"
        });
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new VespaTextAnimation();
});