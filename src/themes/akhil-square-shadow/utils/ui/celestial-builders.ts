/**
 * Celestial DOM Builders
 *
 * Creates DOM elements for sky, sun, moon, and stars.
 */

/** Create the sky container with gradient background. */
export function createSky(): HTMLElement {
  const sky = document.createElement('div');
  sky.className = 'shadow-theme-sky';
  sky.setAttribute('aria-hidden', 'true');
  return sky;
}

/** Create the sun element. */
export function createSun(): HTMLElement {
  const sun = document.createElement('div');
  sun.className = 'shadow-theme-sun';
  sun.setAttribute('aria-hidden', 'true');
  // Inner glow
  const innerGlow = document.createElement('div');
  innerGlow.className = 'sun-glow';
  sun.appendChild(innerGlow);
  return sun;
}

/** Create the moon element with craters. */
export function createMoon(): HTMLElement {
  const moon = document.createElement('div');
  moon.className = 'shadow-theme-moon';
  moon.setAttribute('aria-hidden', 'true');
  // Add crater details
  for (let i = 0; i < 3; i++) {
    const crater = document.createElement('div');
    crater.className = `moon-crater moon-crater-${i + 1}`;
    moon.appendChild(crater);
  }
  return moon;
}

/** Create stars container with random stars. */
export function createStars(): HTMLElement {
  const stars = document.createElement('div');
  stars.className = 'shadow-theme-stars';
  stars.setAttribute('aria-hidden', 'true');

  // Create random stars
  const starCount = 50;
  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 60}%`; // Keep stars in upper portion
    star.style.setProperty('--twinkle-delay', `${Math.random() * 3}s`);
    star.style.setProperty('--star-size', `${1 + Math.random() * 2}px`);
    stars.appendChild(star);
  }
  return stars;
}
