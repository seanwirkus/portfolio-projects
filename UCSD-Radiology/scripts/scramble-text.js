class TextScramble {
  constructor(selector) {
    this.element = document.querySelector(selector);
    this.phrases = [
      'Care',
      'Diagnostics',
      'Outcomes',
      'Imaging',
      'Treatments',
      'Possibilities',
      'Radiology'
    ].map(word => `${word}<span style="color: white;">.</span>`);
    
    // Icon codes for icon-900 font
    this.icons = [
      'e900',
      'e901',
      'e902',
      'e903',
      'e904',
      'e905',
      'e906',
      'e907'
    ];

    if (!this.element) {
      console.error(`Element not found: ${selector}`);
      return;
    }

    if (typeof gsap === 'undefined') {
      console.error('GSAP is not loaded');
      return;
    }

    gsap.registerPlugin(TextPlugin);
    this.init();
  }

  init() {
    this.element.innerHTML = this.phrases[0];

    const tl = gsap.timeline({
      repeat: -1,
      repeatDelay: 1
    });

    this.phrases.forEach((phrase, index) => {
      const nextPhrase = this.phrases[(index + 1) % this.phrases.length];

      tl.to(this.element, {
        duration: 0.6,
        text: {
          value: this.stripHTML(nextPhrase),
          scrambleText: {
            chars: () => `<span class="icon-900">&#x${this.randomIcon()};</span>`,
            speed: 0.75,
            revealDelay: 0.1,
            delimiter: ''
          }
        },
        ease: "none",
        onComplete: () => {
          this.element.innerHTML = nextPhrase;
        }
      }, `+=1`);
    });
  }

  randomIcon() {
    return this.icons[Math.floor(Math.random() * this.icons.length)];
  }

  stripHTML(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new TextScramble('.scramble-text');
});