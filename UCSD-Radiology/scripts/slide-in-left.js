document.addEventListener('DOMContentLoaded', () => {
  // Select all elements with the 'slide-in-left' class
  const elements = document.querySelectorAll('.slide-in-left');

  elements.forEach((element) => {
    // Wrap each element in an overflow-hidden container
    const wrapper = document.createElement('div');
    wrapper.style.overflow = 'hidden'; // Prevent element from being visible outside bounds
    wrapper.style.display = 'inline-block'; // Ensure inline elements respect layout
    element.parentNode.insertBefore(wrapper, element); // Insert wrapper before the element
    wrapper.appendChild(element); // Move element into wrapper

    // Set initial state
    gsap.set(element, {
      x: '-100%' // Start fully off-screen to the left
    });

    // Create scroll trigger for each element
    ScrollTrigger.create({
      trigger: wrapper,
      start: "top 75%",
      once: true, // Only triggers once
      onEnter: () => {
        gsap.to(element, {
          x: '0%', // Animate to original position
          duration: 0.4,
          ease: "cubic-bezier(0.68, -0.55, 0.27, 1.55)", // Custom cubic bezier for bounce effect
        });
      }
    });
  });
});