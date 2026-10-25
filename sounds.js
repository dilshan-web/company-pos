/**
 * SoundFX — High-Fidelity Web Audio API Sound Engine for MOB POS
 * Fully self-contained, offline, and zero external assets required.
 * Generates crisp, pleasant acoustic tones and alerts with smooth envelopes.
 */
const SoundFX = {
  _ctx: null,
  _enabled: true,
  _unlocked: false,

  /** Initialize or return existing AudioContext */
  _getCtx() {
    if (!this._ctx || this._ctx.state === 'closed') {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this._ctx = new AudioCtx();
        }
      } catch (e) {
        console.warn('[SoundFX] AudioContext not available:', e);
        return null;
      }
    }
    return this._ctx;
  },

  /** Unlock audio on any user gesture */
  unlock() {
    const ctx = this._getCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        this._unlocked = true;
      }).catch(() => {});
    } else if (ctx && ctx.state === 'running') {
      this._unlocked = true;
    }
  },

  /** Load saved setting from localStorage */
  loadSettings() {
    const val = localStorage.getItem('soundfx_enabled');
    this._enabled = (val === null) ? true : (val === '1');
  },

  /** Save setting to localStorage */
  saveSettings(enabled) {
    this._enabled = !!enabled;
    localStorage.setItem('soundfx_enabled', enabled ? '1' : '0');
  },

  /**
   * Play an array of sequenced tone notes
   * @param {Array<{freq: number, duration: number, delay?: number, gain?: number, type?: OscillatorType}>} notes
   */
  _playSequence(notes) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const execute = () => {
      try {
        const baseTime = ctx.currentTime;
        notes.forEach(n => {
          const startTime = baseTime + (n.delay || 0);
          const duration = n.duration || 0.1;
          const stopTime = startTime + duration;
          const gainVal = Math.max(0.001, Math.min(1.0, (n.gain !== undefined ? n.gain : 0.7)));
          const type = n.type || 'sine';
          const freq = n.freq || 600;

          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = type;
          osc.frequency.setValueAtTime(freq, startTime);

          // Envelope shaping (fast attack, sustained body, smooth decay)
          const attack = Math.min(0.015, duration * 0.2);
          const release = Math.min(0.025, duration * 0.3);

          gainNode.gain.setValueAtTime(0.0001, startTime);
          gainNode.gain.linearRampToValueAtTime(gainVal, startTime + attack);
          gainNode.gain.setValueAtTime(gainVal, Math.max(startTime + attack, stopTime - release));
          gainNode.gain.linearRampToValueAtTime(0.0001, stopTime);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(stopTime + 0.05);
        });
      } catch (err) {
        console.warn('[SoundFX] Play sequence error:', err);
      }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(execute).catch(execute);
    } else {
      execute();
    }
  },

  /**
   * Play a named sound effect
   * @param {'add_item'|'remove_item'|'success'|'order_alert'|'print'|'collect'|'shop'|'route'|'error'|'click'} name
   */
  play(name) {
    if (!this._enabled) return;
    try {
      switch (name) {
        // 🛍️ POS Cart Item Added / Incremented
        case 'add_item':
        case 'item_add':
          this._playSequence([
            { freq: 1100, duration: 0.045, delay: 0.00, gain: 0.75, type: 'sine' },
            { freq: 1450, duration: 0.055, delay: 0.045, gain: 0.80, type: 'sine' }
          ]);
          break;

        // ➖ POS Cart Item Decremented / Removed
        case 'remove_item':
        case 'item_remove':
          this._playSequence([
            { freq: 480, duration: 0.04, delay: 0.00, gain: 0.50, type: 'sine' },
            { freq: 360, duration: 0.06, delay: 0.04, gain: 0.45, type: 'sine' }
          ]);
          break;

        // 🧾 Sale / Bill / Order Successfully Saved
        case 'success':
          this._playSequence([
            { freq: 523.25, duration: 0.10, delay: 0.00, gain: 0.75, type: 'sine' }, // C5
            { freq: 659.25, duration: 0.10, delay: 0.09, gain: 0.80, type: 'sine' }, // E5
            { freq: 783.99, duration: 0.12, delay: 0.18, gain: 0.85, type: 'sine' }, // G5
            { freq: 1046.50, duration: 0.26, delay: 0.29, gain: 0.90, type: 'sine' } // C6
          ]);
          break;

        // 🔔 Stores Keeper New Order Ringing Bell Alert (Ding-Dong! Ding-Dong!)
        case 'order_alert':
        case 'order_received':
          this._playSequence([
            // First Ding-Dong
            { freq: 659.25, duration: 0.18, delay: 0.00, gain: 0.90, type: 'triangle' }, // E5
            { freq: 880.00, duration: 0.22, delay: 0.16, gain: 0.95, type: 'sine' },     // A5
            { freq: 1318.51, duration: 0.38, delay: 0.34, gain: 1.00, type: 'sine' },    // E6
            // Second Ding-Dong
            { freq: 880.00, duration: 0.20, delay: 0.75, gain: 0.95, type: 'sine' },     // A5
            { freq: 1318.51, duration: 0.45, delay: 0.92, gain: 1.00, type: 'sine' }     // E6
          ]);
          break;

        // 🖨️ Thermal Print Triggered
        case 'print':
          this._playSequence([
            { freq: 880.00, duration: 0.16, delay: 0.00, gain: 0.75, type: 'sine' }
          ]);
          break;

        // 💳 Debt / Credit Collection Recorded (Cash Chime)
        case 'collect':
          this._playSequence([
            { freq: 587.33, duration: 0.09, delay: 0.00, gain: 0.75, type: 'sine' }, // D5
            { freq: 783.99, duration: 0.11, delay: 0.08, gain: 0.80, type: 'sine' }, // G5
            { freq: 1174.66, duration: 0.24, delay: 0.17, gain: 0.85, type: 'sine' } // D6
          ]);
          break;

        // 🏪 Shop Registered / Updated
        case 'shop':
          this._playSequence([
            { freq: 523.25, duration: 0.10, delay: 0.00, gain: 0.70, type: 'sine' },
            { freq: 698.46, duration: 0.18, delay: 0.10, gain: 0.75, type: 'sine' }
          ]);
          break;

        // 🛣️ Route Created / Updated
        case 'route':
          this._playSequence([
            { freq: 587.33, duration: 0.16, delay: 0.00, gain: 0.70, type: 'sine' }
          ]);
          break;

        // ⚠️ Error or Warning
        case 'error':
          this._playSequence([
            { freq: 300, duration: 0.12, delay: 0.00, gain: 0.75, type: 'sawtooth' },
            { freq: 190, duration: 0.22, delay: 0.12, gain: 0.70, type: 'sawtooth' }
          ]);
          break;

        // 🔘 Button Click / Interaction Feedback
        case 'click':
          this._playSequence([
            { freq: 900, duration: 0.035, delay: 0.00, gain: 0.40, type: 'sine' }
          ]);
          break;

        default:
          this._playSequence([
            { freq: 750, duration: 0.08, delay: 0.00, gain: 0.60, type: 'sine' }
          ]);
      }
    } catch (e) {
      console.warn('[SoundFX] Play error:', e);
    }
  }
};

// Auto-unlock AudioContext on first user interaction anywhere
if (typeof document !== 'undefined') {
  const unlockEvents = ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown'];
  const handleInteraction = () => {
    SoundFX.unlock();
  };
  unlockEvents.forEach(evt => {
    document.addEventListener(evt, handleInteraction, { passive: true });
  });
}

// Load user preference on startup
SoundFX.loadSettings();
window.SoundFX = SoundFX;
