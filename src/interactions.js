import { birthdayConfig } from './config.js';
import { soundManager } from './audio.js';
import { fireConfetti } from './animations.js';

export class InteractionsManager {
  constructor(scene) {
    this.scene = scene;
    this.currentModal = null;

    // Elements
    this.modalOverlay = document.getElementById('modal-overlay');
    this.cakeModal = document.getElementById('cake-modal');
    this.photoModal = document.getElementById('photo-modal');
    this.cardModal = document.getElementById('card-modal');
    this.finaleModal = document.getElementById('finale-modal');
    this.quickNav = document.getElementById('quick-nav');

    // Cake controls
    this.btnBlowCandle = document.getElementById('btn-blow-candle');
    this.cakeWishText = document.getElementById('cake-wish-text');
    this.btnCloseCake = document.getElementById('btn-close-cake');

    // Photo controls
    this.btnClosePhoto = document.getElementById('btn-close-photo');
    this.photoImg = document.getElementById('photo-modal-img');
    this.photoCaption = document.getElementById('photo-modal-caption');

    // Card controls
    this.btnCloseCard = document.getElementById('btn-close-card');

    // Floating Book Reading Controls
    this.bookReadingBar = document.getElementById('book-reading-bar');
    this.btnCloseBook = document.getElementById('btn-close-book');
    this.btnOpenCardText = document.getElementById('btn-open-card-text');

    // Finale controls
    this.btnOneLastThing = document.getElementById('btn-one-last-thing');
    this.btnCloseFinale = document.getElementById('btn-close-finale');

    // Navigation State & Elements
    this.currentFocusId = 'overview';
    this.objectSequence = ['photo', 'cake', 'card'];
    this.visitedObjects = new Set();
    this.sideNav = document.getElementById('hud-side-nav');
    this.btnNavPrev = document.getElementById('btn-nav-prev');
    this.btnNavNext = document.getElementById('btn-nav-next');

    // Progress Indicators
    this.dotPhoto = document.getElementById('dot-photo');
    this.dotCake = document.getElementById('dot-cake');
    this.dotCard = document.getElementById('dot-card');

    this.init();
  }

  init() {
    this.populateConfigData();
    this.bindEvents();
    this.updateNavigationUI();
  }

  populateConfigData() {
    if (this.photoCaption) {
      this.photoCaption.textContent = birthdayConfig.photoCaption;
    }

    const cardTitleEl = document.getElementById('card-modal-title');
    if (cardTitleEl) cardTitleEl.textContent = birthdayConfig.cardTitle;

    const cardBodyEl = document.getElementById('card-modal-body');
    if (cardBodyEl) {
      cardBodyEl.innerHTML = birthdayConfig.cardParagraphs
        .map(p => `<p>${p}</p>`)
        .join('');
    }

    const cardSenderEl = document.getElementById('card-modal-sender');
    if (cardSenderEl) cardSenderEl.textContent = birthdayConfig.cardSender;

    const finaleTitleEl = document.getElementById('finale-title');
    if (finaleTitleEl) finaleTitleEl.textContent = birthdayConfig.finalTitle;

    const finaleSubtitleEl = document.getElementById('finale-subtitle');
    if (finaleSubtitleEl) finaleSubtitleEl.textContent = birthdayConfig.finalSubtitle;
  }

  bindEvents() {
    // 3D Canvas Click Handler
    window.addEventListener('click', (e) => {
      // Ignore if clicking on UI overlays or buttons
      if (e.target.closest('#terminal-overlay') || 
          e.target.closest('.modal-content') || 
          e.target.closest('#hud') ||
          this.currentModal) {
        return;
      }

      const hitId = this.scene.getClickedObject(e.clientX, e.clientY);
      if (hitId) {
        this.openInteraction(hitId);
      }
    });

    // Cake Blow Button
    this.btnBlowCandle.addEventListener('click', () => {
      if (this.scene.isCandleLit) {
        soundManager.playExtinguish();
        this.scene.extinguishCandle();
        fireConfetti();
        this.cakeWishText.innerHTML = "Lilin telah ditiup. Semoga semua harapan dan doamu terkabul dengan indah.";
        this.cakeWishText.classList.add('wish-granted');
        this.btnBlowCandle.textContent = "Nyalakan Lilin Kembali";
      } else {
        soundManager.playChime(659.25, 0.5);
        this.scene.relightCandle();
        this.cakeWishText.innerHTML = "Make a wish. Pejamkan mata, panjatkan doa terbaikmu, lalu tiup lilinnya.";
        this.cakeWishText.classList.remove('wish-granted');
        this.btnBlowCandle.textContent = "Tiup Lilin";
      }
    });

    // Book Reading Controls
    if (this.btnCloseBook) {
      this.btnCloseBook.addEventListener('click', () => this.closeModals());
    }

    if (this.btnOpenCardText) {
      this.btnOpenCardText.addEventListener('click', () => {
        soundManager.playKeyClick();
        this.currentModal = this.cardModal;
        this.modalOverlay.classList.add('active');
        this.cardModal.classList.add('active');
      });
    }

    this.btnCloseCake.addEventListener('click', () => this.closeModals());
    this.btnClosePhoto.addEventListener('click', () => this.closeModals());
    this.btnCloseCard.addEventListener('click', () => this.closeModals());
    this.btnCloseFinale.addEventListener('click', () => this.closeModals());

    // Finale button
    this.btnOneLastThing.addEventListener('click', () => {
      soundManager.playChime(783.99, 1.2);
      this.openInteraction('finale');
    });

    // Quick nav pills
    document.querySelectorAll('.nav-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        if (target === 'overview') {
          this.closeModals();
        } else {
          this.openInteraction(target);
        }
      });
    });

    // Side direct navigation buttons
    this.btnNavPrev?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.cycleObject(-1);
    });

    this.btnNavNext?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.cycleObject(1);
    });

    // Progress dots direct jumps
    this.dotPhoto?.addEventListener('click', () => this.openInteraction('photo'));
    this.dotCake?.addEventListener('click', () => this.openInteraction('cake'));
    this.dotCard?.addEventListener('click', () => this.openInteraction('card'));

    // Close on overlay backdrop click
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) {
        this.closeModals();
      }
    });

    // Touch swipe gestures for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        const elapsed = Date.now() - touchStartTime;

        if (elapsed < 500) {
          const absX = Math.abs(deltaX);
          const absY = Math.abs(deltaY);

          // Horizontal swipe: Next / Prev
          if (absX > 45 && absX > absY * 1.5) {
            if (deltaX < 0) {
              this.cycleObject(1); // Swipe left -> Next
            } else {
              this.cycleObject(-1); // Swipe right -> Prev
            }
          }
          // Vertical swipe down: Dismiss / Return to Overview
          else if (deltaY > 60 && absY > absX * 1.5) {
            if (this.currentFocusId !== 'overview') {
              this.closeModals();
            }
          }
        }
      }
    }, { passive: true });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        if (this.currentModal || this.scene.isBookOpen || this.currentFocusId !== 'overview') {
          this.closeModals();
        }
      } else if (e.key === '1') {
        this.closeModals();
      } else if (e.key === '2') {
        this.openInteraction('cake');
      } else if (e.key === '3') {
        this.openInteraction('photo');
      } else if (e.key === '4') {
        this.openInteraction('card');
      } else if (e.key === '5') {
        this.openInteraction('finale');
      } else if (e.key === 'ArrowLeft') {
        this.cycleObject(-1);
      } else if (e.key === 'ArrowRight') {
        this.cycleObject(1);
      } else if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (this.currentFocusId === 'cake') {
          this.btnBlowCandle.click();
        } else if (this.currentFocusId === 'card') {
          if (this.currentModal === this.cardModal) {
            this.closeModals();
          } else {
            this.btnOpenCardText?.click();
          }
        } else {
          this.cycleObject(1);
        }
      }
    });
  }

  cycleObject(direction) {
    const seq = this.objectSequence;
    let currentIndex = seq.indexOf(this.currentFocusId);
    let nextIndex;
    if (currentIndex === -1) {
      nextIndex = direction > 0 ? 0 : seq.length - 1;
    } else {
      nextIndex = (currentIndex + direction + seq.length) % seq.length;
    }
    this.openInteraction(seq[nextIndex]);
  }

  updateNavigationUI() {
    // Update progress dots completed state
    if (this.visitedObjects.has('photo')) this.dotPhoto?.classList.add('completed');
    if (this.visitedObjects.has('cake')) this.dotCake?.classList.add('completed');
    if (this.visitedObjects.has('card')) this.dotCard?.classList.add('completed');

    // Highlight active dot
    [this.dotPhoto, this.dotCake, this.dotCard].forEach(dot => dot?.classList.remove('active'));
    if (this.currentFocusId === 'photo') this.dotPhoto?.classList.add('active');
    else if (this.currentFocusId === 'cake') this.dotCake?.classList.add('active');
    else if (this.currentFocusId === 'card') this.dotCard?.classList.add('active');

    // Highlight quick nav pill
    document.querySelectorAll('.nav-pill').forEach(pill => {
      const target = pill.getAttribute('data-target');
      if (target === this.currentFocusId) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    // Show side direct navigation buttons when focused on objects, hide in overview or finale
    if (this.sideNav) {
      if (this.objectSequence.includes(this.currentFocusId)) {
        this.sideNav.classList.add('active');
      } else {
        this.sideNav.classList.remove('active');
      }
    }
  }

  openInteraction(id) {
    if (this.currentFocusId === id) return;

    if (this.currentModal || this.scene.isBookOpen) {
      this.closeModals(() => this.doOpenInteraction(id), true);
    } else {
      this.doOpenInteraction(id);
    }
  }

  doOpenInteraction(id) {
    this.currentFocusId = id;
    if (this.objectSequence.includes(id)) {
      this.visitedObjects.add(id);
    }
    this.updateNavigationUI();

    // Interactive 3D Book Lift and Open
    if (id === 'card') {
      soundManager.playBookOpen();
      if (this.quickNav) this.quickNav.style.display = 'none';
      this.currentModal = this.bookReadingBar;
      this.scene.setCameraView('card', 1.5);
      this.scene.openBook(1.5, () => {
        if (this.bookReadingBar) {
          this.bookReadingBar.classList.add('active');
        }
      });
      return;
    }

    soundManager.playChime(587.33, 0.4);

    let modalToOpen = null;
    let cameraView = id;

    if (id === 'cake') {
      modalToOpen = this.cakeModal;
    } else if (id === 'photo') {
      modalToOpen = this.photoModal;
    } else if (id === 'finale') {
      modalToOpen = this.finaleModal;
      cameraView = 'finale';
      setTimeout(() => fireConfetti(), 800);
    }

    if (modalToOpen) {
      this.scene.setCameraView(cameraView, 1.2, () => {
        this.currentModal = modalToOpen;
        this.modalOverlay.classList.add('active');
        modalToOpen.classList.add('active');
      });
    }
  }

  closeModals(callback, isTransition = false) {
    if (!this.currentModal && !this.scene.isBookOpen && this.currentFocusId === 'overview') {
      if (callback) callback();
      return;
    }

    soundManager.playKeyClick();
    this.modalOverlay.classList.remove('active');

    if (this.bookReadingBar) {
      this.bookReadingBar.classList.remove('active');
    }
    if (this.quickNav) {
      this.quickNav.style.display = 'flex';
    }

    if (this.currentModal) {
      this.currentModal.classList.remove('active');
      this.currentModal = null;
    }

    if (this.scene.isBookOpen) {
      soundManager.playBookClose();
      this.scene.closeBook(1.0, () => {
        if (!isTransition) {
          this.currentFocusId = 'overview';
          this.updateNavigationUI();
          this.scene.setCameraView('overview', 1.2, () => {
            if (callback) callback();
          });
        } else {
          if (callback) callback();
        }
      });
    } else {
      if (!isTransition) {
        this.currentFocusId = 'overview';
        this.updateNavigationUI();
        this.scene.setCameraView('overview', 1.0, () => {
          if (callback) callback();
        });
      } else {
        if (callback) callback();
      }
    }
  }
}
