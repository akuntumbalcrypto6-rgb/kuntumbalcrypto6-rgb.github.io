import confetti from 'canvas-confetti';

export function fireConfetti() {
  // Multistage burst celebration
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    colors: ['#FFE066', '#FF8C00', '#F7F2E8']
  });

  fire(0.2, {
    spread: 60,
    colors: ['#A78BFA', '#F472B6', '#38BDF8']
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    colors: ['#E9B44C', '#FFD700', '#FFFFFF']
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 45
  });
}

export function fireSparklesAt(x, y) {
  confetti({
    particleCount: 25,
    spread: 40,
    startVelocity: 20,
    origin: {
      x: x / window.innerWidth,
      y: y / window.innerHeight
    },
    colors: ['#FFD700', '#FFF', '#FFE066'],
    zIndex: 9999
  });
}
