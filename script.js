// Progressive enhancement for the TPI scrollytelling page.
// The HTML is complete without this file: every figure is pre-rendered in its final state.
// This script (1) drives the sticky chart on wide screens, (2) animates inline figures
// on narrow screens, (3) fades in closing items, (4) updates the reading-progress bar.
// It never intercepts scrolling.

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const supportsIO = 'IntersectionObserver' in window;
  if (!supportsIO) return; // Static page remains fully readable.

  // ---------- 1. Sticky chart: activate the scene + reveal level of the step at mid-screen ----------
  document.querySelectorAll('.scrolly').forEach((scrolly) => {
    const steps = Array.from(scrolly.querySelectorAll('.step'));
    const scenes = Array.from(scrolly.querySelectorAll('.scrolly__graphic .scene'));
    if (!steps.length || !scenes.length) return;

    let current = null;
    const activate = (step) => {
      if (step === current) return;
      current = step;
      const id = step.dataset.scene;
      const reveal = step.dataset.reveal;
      scenes.forEach((scene) => {
        const on = scene.dataset.scene === id;
        scene.classList.toggle('is-active', on);
        // Inactive scenes reset so they animate again when revisited.
        scene.dataset.reveal = on ? reveal : '0';
      });
      steps.forEach((s) => s.classList.toggle('is-active', s === step));
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) activate(entry.target);
        });
      },
      // A thin band across the middle of the viewport.
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    steps.forEach((s) => {
      io.observe(s);
      // Keyboard users: focusing a control inside a step shows that step's chart state.
      s.addEventListener('focusin', () => activate(s));
    });
  });

  // ---------- 2. Inline figures (narrow screens): reveal the new elements as the figure enters ----------
  const inlineScenes = Array.from(document.querySelectorAll('.step__figure .scene'));
  if (!reduceMotion.matches) {
    inlineScenes.forEach((scene) => {
      scene.dataset.final = scene.dataset.reveal;
      scene.dataset.reveal = String(Math.max(0, Number(scene.dataset.reveal) - 1));
    });
  }
  const figureIO = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const scene = entry.target;
        if (scene.dataset.final) scene.dataset.reveal = scene.dataset.final;
        obs.unobserve(scene);
      });
    },
    { rootMargin: '0px 0px -20% 0px', threshold: 0.25 }
  );
  inlineScenes.forEach((s) => figureIO.observe(s));

  // ---------- 3. Fade-in for questions and roundtable aims ----------
  const appear = Array.from(document.querySelectorAll('[data-appear]'));
  if (!reduceMotion.matches) {
    appear.forEach((el) => el.classList.add('is-pending'));
    const appearIO = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove('is-pending');
          obs.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.2 }
    );
    appear.forEach((el) => appearIO.observe(el));
  }
  // Keyboard users tabbing into a pending item should never meet invisible content.
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest && e.target.closest('[data-appear].is-pending');
    if (el) el.classList.remove('is-pending');
  });

  // ---------- 4. Reading progress ----------
  const bar = document.querySelector('.progress__bar');
  if (bar) {
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.setProperty('--p', p.toFixed(4));
      ticking = false;
    };
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    window.addEventListener('resize', update);
    update();
  }

  // ---------- Print: show every figure complete ----------
  window.addEventListener('beforeprint', () => {
    inlineScenes.forEach((s) => s.dataset.final && (s.dataset.reveal = s.dataset.final));
    appear.forEach((el) => el.classList.remove('is-pending'));
  });
})();
