import { BirthdayScene } from './scene.js';
import { Terminal } from './terminal.js';
import { InteractionsManager } from './interactions.js';
import { soundManager } from './audio.js';
import { birthdayConfig } from './config.js';

window.addEventListener('DOMContentLoaded', () => {
  // Check WebGL availability
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      throw new Error('WebGL not supported');
    }
  } catch (err) {
    document.body.innerHTML = `
      <div style="color: #f7f2e8; background: #101827; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem;">
        <h1 style="color: #e9b44c; margin-bottom: 1rem;">Perangkat Belum Mendukung 3D WebGL</h1>
        <p>Silakan aktifkan hardware acceleration pada browser Anda atau buka di browser modern lain.</p>
      </div>
    `;
    return;
  }

  // Update top badge
  const hudBadge = document.getElementById('hud-badge');
  if (hudBadge && birthdayConfig.recipientName) {
    hudBadge.textContent = `A Little Night for You — ${birthdayConfig.recipientName}`;
  }

  // Init 3D Scene
  const sceneContainer = document.getElementById('scene-container');
  const scene = new BirthdayScene(sceneContainer);

  // Init Interactions
  const interactions = new InteractionsManager(scene);

  // Sound toggle button
  const btnSound = document.getElementById('btn-sound-toggle');
  const iconSoundOff = document.getElementById('icon-sound-off');
  const iconSoundOn = document.getElementById('icon-sound-on');

  btnSound.addEventListener('click', () => {
    const isPlaying = soundManager.toggleMute();
    if (iconSoundOff && iconSoundOn) {
      iconSoundOff.style.display = isPlaying ? 'none' : 'block';
      iconSoundOn.style.display = isPlaying ? 'block' : 'none';
    }
    btnSound.classList.toggle('active', isPlaying);
  });

  // Terminal Flow
  const terminal = new Terminal({
    onStart: () => {
      // Cinematic transition to overview scene
      scene.setCameraView('overview', 2.0, () => {
        // Show subtle tip helper
        const tipEl = document.getElementById('hud-tip');
        if (tipEl) {
          tipEl.style.display = 'block';
          setTimeout(() => {
            tipEl.style.transition = 'opacity 1s ease';
            tipEl.style.opacity = '0';
          }, 6000);
        }
      });
    },
    onSkip: () => {
      // Skip fast forwards terminal
    }
  });

  // Start terminal typing sequence
  terminal.start();
});
