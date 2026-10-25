/**
 * Main Application Bootstrap & Lifecycle
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 0. Ensure all popup modals start hidden
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    if (modal.id !== 'lock-screen-modal') {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      modal.style.display = 'none';
    }
  });

  // 1. Initialize Database Defaults (Company + Default Users)
  try {
    await initDatabaseDefaults();
  } catch (err) {
    console.warn('DB defaults init error:', err);
  }

  // 1.5 Initialize GPS Watchdog & Map (background warm-up; user login triggers full start)
  try {
    if (typeof GPS !== 'undefined' && GPS.init) GPS.init();
    if (typeof MapView !== 'undefined' && MapView.init) MapView.init();
    if (typeof RouteSession !== 'undefined' && RouteSession.init) RouteSession.init();
  } catch (gpsErr) {
    console.warn('GPS init error:', gpsErr);
  }

  // 2. Initialize UI Clock & Timers
  try {
    UI.init();
  } catch (err) {
    console.warn('UI init error:', err);
  }

  // 3. Register Service Worker for Offline PWA (when hosted via HTTP/HTTPS)
  try {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
          // Check for SW update
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New version available; will activate on next reload.');
                }
              };
            }
          };
        })
        .catch(err => console.warn('[PWA] Service Worker registration failed:', err));
    }
  } catch (swErr) {
    console.warn('[PWA] Service worker setup error:', swErr);
  }

  // 4. Check Multi-User PIN Security Lock (Guaranteed to execute)
  try {
    await Auth.checkInitialLock();
  } catch (authErr) {
    console.error('Auth lock check error:', authErr);
    Auth.showLockScreen();
  }

  // 5. Initialize Live Stores Order Monitoring
  try {
    if (typeof Stores !== 'undefined' && Stores.initLiveOrderListener) {
      Stores.initLiveOrderListener();
    }
  } catch (e) {}

  // 6. Load Dashboard if admin session active
  try {
    if (Auth.currentUser && Auth.currentUser.role === 'admin') {
      Dashboard.loadDashboard();
    }
  } catch (dashErr) {
    console.warn('Dashboard load error:', dashErr);
  }

  // 7. Setup Keyboard shortcut for modal close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
        if (modal.id !== 'lock-screen-modal') {
          modal.classList.add('hidden');
          modal.classList.remove('flex');
        }
      });
    }
  });

  console.log('Spice Wholesale Card POS v4.5 - Local Offline & Multi-Role Active');
});

// ── PWA One-Tap Install Event Listeners (Mobile & Desktop Standalone) ──
window.deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredInstallPrompt = e;
  console.log('[PWA] beforeinstallprompt captured! Ready for native installation.');

  document.querySelectorAll('.pwa-install-btn, #pwa-install-container, #header-install-btn').forEach(el => {
    el.classList.remove('hidden');
    el.style.display = '';
  });
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installed successfully!');
  window.deferredInstallPrompt = null;
  document.querySelectorAll('.pwa-install-btn, #pwa-install-container, #header-install-btn').forEach(el => {
    el.classList.add('hidden');
    el.style.display = 'none';
  });
  if (typeof UI !== 'undefined' && UI.showToast) {
    UI.showToast('🎉 App එක සාර්ථකව Install විය! දැන් Home screen / Desktop එකෙන් Open කරන්න.', 'success');
  }
});
