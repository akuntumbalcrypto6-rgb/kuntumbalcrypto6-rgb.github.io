import { birthdayConfig } from './config.js';
import { soundManager } from './audio.js';

export class Terminal {
  constructor({ onStart, onSkip }) {
    this.container = document.getElementById('terminal-overlay');
    this.output = document.getElementById('terminal-content');
    this.btnStart = document.getElementById('btn-start');
    this.btnSkip = document.getElementById('btn-skip');
    this.controls = document.getElementById('terminal-controls');
    
    this.onStart = onStart;
    this.onSkip = onSkip;

    this.isSkipped = false;
    this.isFinished = false;
    this.typingTimeouts = [];

    this.lines = [
      { text: "INITIALIZING BIRTHDAY.EXE...", speed: 30, pause: 300 },
      { text: "> Booting special birthday experience...", speed: 25, pause: 200 },
      { text: "> Loading memories...", speed: 25, pause: 200 },
      { text: "> Preparing something special...", speed: 25, pause: 200 },
      { text: "> Lighting up the night sky...", speed: 25, pause: 350 },
      { text: "", pause: 150 },
      { text: "[OK] Birthday cake: READY", speed: 20, pause: 150, class: "ok-line" },
      { text: "[OK] Photo memories: READY", speed: 20, pause: 150, class: "ok-line" },
      { text: "[OK] Birthday letter: READY", speed: 20, pause: 250, class: "ok-line" },
      { text: "", pause: 200 },
      { text: `> ${birthdayConfig.terminalTitle}`, speed: 25, pause: 300 },
      { text: `Happy Birthday, ${birthdayConfig.recipientName}!`, speed: 35, pause: 400, class: "highlight-line" },
      { text: "", pause: 200 },
      { text: `> ${birthdayConfig.terminalSubtitle}`, speed: 25, pause: 200 }
    ];

    this.initEvents();
  }

  initEvents() {
    this.btnStart.addEventListener('click', () => {
      soundManager.playChime(659.25, 0.6);
      this.finish();
      if (this.onStart) this.onStart();
    });

    this.btnSkip.addEventListener('click', () => {
      soundManager.playChime(523.25, 0.4);
      this.skip();
    });
  }

  start() {
    this.typeNextLine(0);
  }

  typeNextLine(lineIndex) {
    if (this.isSkipped || this.isFinished) return;

    if (lineIndex >= this.lines.length) {
      this.showFullControls();
      return;
    }

    const lineData = this.lines[lineIndex];
    const lineEl = document.createElement('div');
    lineEl.className = `term-line ${lineData.class || ''}`;
    this.output.appendChild(lineEl);

    if (!lineData.text) {
      lineEl.innerHTML = '&nbsp;';
      const t = setTimeout(() => this.typeNextLine(lineIndex + 1), lineData.pause || 100);
      this.typingTimeouts.push(t);
      return;
    }

    let charIdx = 0;
    const text = lineData.text;

    const cursor = document.createElement('span');
    cursor.className = 'term-cursor';
    cursor.textContent = '█';
    lineEl.appendChild(cursor);

    const typeChar = () => {
      if (this.isSkipped || this.isFinished) return;

      if (charIdx < text.length) {
        cursor.before(document.createTextNode(text[charIdx]));
        charIdx++;
        
        if (charIdx % 4 === 0) {
          soundManager.playKeyClick();
        }

        this.scrollBottom();
        const t = setTimeout(typeChar, lineData.speed || 25);
        this.typingTimeouts.push(t);
      } else {
        cursor.remove();
        // If this was the highlight line, activate start button early!
        if (lineData.class === "highlight-line") {
          this.btnStart.classList.add('visible');
        }
        const t = setTimeout(() => this.typeNextLine(lineIndex + 1), lineData.pause || 200);
        this.typingTimeouts.push(t);
      }
    };

    typeChar();
  }

  scrollBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }

  skip() {
    if (this.isSkipped) {
      // Second click on skip/start directly launches scene
      this.finish();
      if (this.onStart) this.onStart();
      return;
    }

    this.isSkipped = true;
    this.clearTimeouts();
    this.output.innerHTML = '';

    this.lines.forEach((line) => {
      const lineEl = document.createElement('div');
      lineEl.className = `term-line ${line.class || ''}`;
      lineEl.textContent = line.text || ' ';
      this.output.appendChild(lineEl);
    });

    this.showFullControls();
    this.scrollBottom();
  }

  showFullControls() {
    this.isFinished = true;
    this.btnStart.classList.add('visible', 'pulse-btn');
    this.btnSkip.textContent = 'Masuk Langsung';
  }

  clearTimeouts() {
    this.typingTimeouts.forEach(t => clearTimeout(t));
    this.typingTimeouts = [];
  }

  finish() {
    this.clearTimeouts();
    this.container.classList.add('fade-out');
    setTimeout(() => {
      this.container.style.display = 'none';
    }, 900);
  }
}
