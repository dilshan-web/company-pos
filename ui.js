/**
 * UI Controller, Formatting Utilities, Live Clock & Camera Helpers
 */

const UI = {
  currentTheme: 'velvet',

  init() {
    this.initTheme();
    this.initLiveClock();
    this.updateCompanyBranding();
    this.checkPwaInstallState();
  },

  initTheme() {
    const savedTheme = localStorage.getItem('mob_pos_theme') || 'velvet';
    this.setTheme(savedTheme, false);
  },

  setTheme(themeName, showToast = true) {
    const validThemes = ['velvet', 'white', 'dark'];
    if (!validThemes.includes(themeName)) themeName = 'velvet';
    this.currentTheme = themeName;
    localStorage.setItem('mob_pos_theme', themeName);

    // Update body classes
    document.body.classList.remove('theme-velvet', 'theme-white', 'theme-dark');
    document.body.classList.add(`theme-${themeName}`);

    // Update Theme Switcher Button UI
    const iconEl = document.getElementById('theme-btn-icon');
    const labelEl = document.getElementById('theme-btn-label');
    const btnEl = document.getElementById('btn-theme-switcher');

    if (themeName === 'velvet') {
      if (iconEl) iconEl.textContent = '🎨';
      if (labelEl) labelEl.textContent = 'දම්+රෝස';
      if (btnEl) btnEl.className = 'px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1 active:scale-95 border cursor-pointer bg-gradient-to-r from-purple-700 via-fuchsia-700 to-rose-700 text-white border-rose-300/40 hover:opacity-95 flex-shrink-0';
      if (showToast) UI.showToast('🎨 Theme: Velvet Purple-Rose (දම් + රෝස) සක්‍රියයි', 'success');
    } else if (themeName === 'white') {
      if (iconEl) iconEl.textContent = '☀️';
      if (labelEl) labelEl.textContent = 'සුදු';
      if (btnEl) btnEl.className = 'px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1 active:scale-95 border cursor-pointer bg-white text-slate-800 border-slate-300 hover:bg-slate-100 flex-shrink-0';
      if (showToast) UI.showToast('☀️ Theme: Pure White (පිරිසිදු සුදු) සක්‍රියයි', 'info');
    } else if (themeName === 'dark') {
      if (iconEl) iconEl.textContent = '🌙';
      if (labelEl) labelEl.textContent = 'කළු';
      if (btnEl) btnEl.className = 'px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1 active:scale-95 border cursor-pointer bg-slate-900 text-cyan-300 border-slate-700 hover:bg-slate-800 flex-shrink-0';
      if (showToast) UI.showToast('🌙 Theme: Midnight Black (කළු පැහැය) සක්‍රියයි', 'info');
    }
  },

  cycleTheme() {
    const cycle = { 'velvet': 'white', 'white': 'dark', 'dark': 'velvet' };
    const nextTheme = cycle[this.currentTheme] || 'velvet';
    this.setTheme(nextTheme, true);
  },

  checkPwaInstallState() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      document.querySelectorAll('.pwa-install-btn, #pwa-install-container, #header-install-btn').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
      });
    }
  },

  async updateCompanyBranding() {
    try {
      let company = null;
      if (typeof db !== 'undefined' && db.company) {
        if (typeof filterByTenant === 'function') {
          const comps = filterByTenant(await db.company.toArray());
          if (comps.length > 0) company = comps[0];
        }
        if (!company) {
          company = await db.company.toCollection().first();
        }
      }

      if (!company && typeof firestore !== 'undefined' && firestore) {
        try {
          const cSnap = await firestore.collection('company').limit(1).get();
          if (!cSnap.empty) {
            const cData = cSnap.docs[0].data();
            const cId = cData.id !== undefined ? cData.id : cSnap.docs[0].id;
            company = Object.assign({}, cData, { id: cId });
            if (db && db.company) db.company._cache.set(String(cId), company);
          }
        } catch (fErr) {}
      }

      let localSaved = null;
      try {
        const stored = localStorage.getItem('pos_company_profile');
        if (stored) localSaved = JSON.parse(stored);
      } catch (e) {}

      const name = company?.name || localSaved?.name || 'SPICE WHOLESALE POS';
      const tagline = company?.tagline || localSaved?.tagline || 'Enterprise Distribution System';
      const logo = company?.logoBase64 || localSaved?.logoBase64 || '';

      // 1. Update Top Header Bar
      const headerTitle = document.getElementById('app-company-name-header');
      if (headerTitle) headerTitle.textContent = name;

      const headerLogo = document.getElementById('app-company-logo-header');
      if (headerLogo) {
        headerLogo.onerror = () => { headerLogo.src = 'icon-192.png'; };
        if (logo && logo.trim()) {
          headerLogo.src = logo;
        } else {
          headerLogo.src = 'icon-192.png';
        }
      }

      // 2. Update Login Screen
      const loginTitle = document.getElementById('login-brand-title');
      if (loginTitle) loginTitle.textContent = name;

      const loginSubtitle = document.getElementById('login-brand-subtitle');
      if (loginSubtitle) loginSubtitle.textContent = tagline;

      const loginLogo = document.getElementById('login-brand-logo');
      if (loginLogo) {
        loginLogo.onerror = () => { loginLogo.src = 'icon-192.png'; };
        if (logo && logo.trim()) {
          loginLogo.src = logo;
        } else {
          loginLogo.src = 'icon-192.png';
        }
      }

      // 3. Dynamic browser favicon update with company logo
      if (logo && logo.trim()) {
        try {
          const favicons = document.querySelectorAll("link[rel*='icon']");
          favicons.forEach(fav => { fav.href = logo; });
        } catch (_) {}
      }
    } catch (e) {
      console.warn('updateCompanyBranding notice:', e);
    }
  },

  initLiveClock() {
    let lastDateStr = new Date().toISOString().split('T')[0];

    const checkDateRollover = () => {
      const nowDateStr = new Date().toISOString().split('T')[0];
      if (nowDateStr !== lastDateStr) {
        lastDateStr = nowDateStr;
        console.log(`[Day-End Reset] New calendar day detected (${nowDateStr}). Resetting Day Sale counters.`);
        
        // Auto-refresh Dashboard and POS summary to reset Day Sale to Rs. 0.00
        try {
          if (typeof Dashboard !== 'undefined') Dashboard.loadDashboard();
          if (typeof POS !== 'undefined') POS.loadRepDailySummary();
          if (typeof Production !== 'undefined') Production.resetToToday();
        } catch (e) {
          console.warn('Day rollover refresh error:', e);
        }
      }
    };

    const updateTime = () => {
      const now = new Date();
      const timeEl = document.getElementById('header-live-time');
      const dateEl = document.getElementById('header-live-date');

      if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      }
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
      }

      checkDateRollover();
    };

    updateTime();
    setInterval(updateTime, 1000);

    // Refresh on screen wake / focus
    window.addEventListener('focus', checkDateRollover);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkDateRollover();
    });
  },

  switchTab(tabId) {
    // If app is currently locked, keep lock screen and do not switch
    if (typeof Auth !== 'undefined' && Auth.isLocked) {
      Auth.showLockScreen();
      return;
    }

    // Role-based security guard
    const role = (typeof Auth !== 'undefined' && Auth.currentUser?.role) || 'admin';
    if (tabId === 'superadmin' && role !== 'superadmin') {
      console.warn(`Restricted access: Only Software Controller can access 'superadmin' tab. Redirecting to Dashboard.`);
      tabId = 'dashboard';
    } else if (role === 'rep') {
      const allowed = ['pos', 'rep-bills', 'shops', 'routes', 'map'];
      if (!allowed.includes(tabId)) {
        console.warn(`Restricted access: Sales Rep cannot access tab '${tabId}'. Redirecting to POS.`);
        tabId = 'pos';
      }
    } else if (role === 'delivery') {
      const allowed = ['production', 'lorry', 'collections', 'shops', 'map'];
      if (!allowed.includes(tabId)) {
        console.warn(`Restricted access: Delivery Driver cannot access tab '${tabId}'. Redirecting to Orders.`);
        tabId = 'production';
      }
    } else if (role === 'stores') {
      const allowed = ['stores', 'production', 'lorry'];
      if (!allowed.includes(tabId)) {
        console.warn(`Restricted access: Stores Keeper cannot access tab '${tabId}'. Redirecting to Stores.`);
        tabId = 'stores';
      }
    } else if (role === 'hr') {
      const allowed = ['payroll', 'map', 'users'];
      if (!allowed.includes(tabId)) {
        console.warn(`Restricted access: HR cannot access tab '${tabId}'. Redirecting to Payroll.`);
        tabId = 'payroll';
      }
    }

    State.activeTab = tabId;

    // Update section visibility
    document.querySelectorAll('.app-tab-page').forEach(page => {
      page.classList.add('hidden');
      page.style.display = 'none';
    });

    const targetPage = document.getElementById(`tab-${tabId}`);
    if (targetPage) {
      targetPage.classList.remove('hidden');
      targetPage.style.display = 'block';
    }

    // Update Bottom Navigation Active States
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      const btnTab = btn.getAttribute('data-tab');
      if (btnTab === tabId) {
        btn.classList.add('text-emerald-600', 'font-black');
        btn.classList.remove('text-slate-500');
        const iconWrap = btn.querySelector('.nav-icon-wrap');
        if (iconWrap) iconWrap.classList.add('bg-emerald-100', 'text-emerald-700');
      } else {
        btn.classList.remove('text-emerald-600', 'font-black');
        btn.classList.add('text-slate-500');
        const iconWrap = btn.querySelector('.nav-icon-wrap');
        if (iconWrap) iconWrap.classList.remove('bg-emerald-100', 'text-emerald-700');
      }
    });

    // Update Desktop Navigation Bar Active States
    document.querySelectorAll('.desktop-nav-btn').forEach(btn => {
      const btnTab = btn.getAttribute('data-tab');
      if (btnTab === tabId) {
        btn.classList.add('ring-2', 'ring-blue-600', 'ring-offset-1', 'shadow-md', 'scale-[1.02]', 'opacity-100');
        btn.classList.remove('opacity-75');
      } else {
        btn.classList.remove('ring-2', 'ring-blue-600', 'ring-offset-1', 'shadow-md', 'scale-[1.02]', 'opacity-100');
        btn.classList.add('opacity-75');
      }
    });

    // Refresh specific tab contents (wrapped in try/catch)
    try { if (tabId === 'superadmin' && typeof CompanyControl !== 'undefined') CompanyControl.init(); } catch(e) {}
    try { if (tabId === 'dashboard' && typeof Dashboard !== 'undefined') Dashboard.loadDashboard(); } catch(e) { console.warn('Dashboard load err:', e); }
    try { if (tabId === 'best-shops' && typeof BestShops !== 'undefined') BestShops.init(); } catch(e) {}
    try { if (tabId === 'pos' && typeof POS !== 'undefined') POS.init(); } catch(e) {}
    try { if (tabId === 'rep-bills' && typeof RepBills !== 'undefined') RepBills.init(); } catch(e) {}
    try { if (tabId === 'production' && typeof Production !== 'undefined') Production.loadMatrix(); } catch(e) {}
    try { if (tabId === 'stores' && typeof Stores !== 'undefined') Stores.init(); } catch(e) {}
    try { if (tabId === 'lorry' && typeof Lorry !== 'undefined') Lorry.init(); } catch(e) {}
    if (tabId === 'collections' && typeof Collections !== 'undefined') Collections.init();
    if (tabId === 'shops' && typeof Shops !== 'undefined') Shops.loadShops();
    if (tabId === 'routes' && typeof Routes !== 'undefined') Routes.loadRoutes();
    if (tabId === 'map' && typeof MapView !== 'undefined') {
      setTimeout(() => {
        if (MapView.map) MapView.map.invalidateSize(true);
        MapView.refreshMap();
      }, 50);
      setTimeout(() => {
        if (MapView.map) MapView.map.invalidateSize(true);
      }, 300);
    }
    if (tabId === 'products' && typeof Products !== 'undefined') Products.loadProducts();
    if (tabId === 'reports' && typeof Reports !== 'undefined') Reports.loadReports();
    if (tabId === 'users' && typeof Users !== 'undefined') Users.loadUsers();
    if (tabId === 'payroll') {
      if (typeof HR !== 'undefined') HR.init();
      else if (typeof Payroll !== 'undefined') Payroll.init();
    }

    if (typeof Auth !== 'undefined' && Auth.applyRoleRestrictions) {
      Auth.applyRoleRestrictions();
    }

    // Scroll back to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async refreshCurrentTab(showToast = true) {
    // 1. Trigger spin animations on any refresh icons
    const icons = document.querySelectorAll('#icon-global-refresh, .refresh-icon-spin');
    icons.forEach(el => el.classList.add('animate-spin'));

    // 2. Identify active tab
    const activeTabPage = document.querySelector('.app-tab-page:not(.hidden)');
    const tabId = State.activeTab || (activeTabPage ? activeTabPage.id.replace('tab-', '') : 'dashboard');

    try {
      if (tabId === 'superadmin' && typeof CompanyControl !== 'undefined' && CompanyControl.loadTenants) {
        await CompanyControl.loadTenants();
      } else if (tabId === 'dashboard' && typeof Dashboard !== 'undefined' && Dashboard.loadDashboard) {
        await Dashboard.loadDashboard();
      } else if (tabId === 'pos' && typeof POS !== 'undefined') {
        if (POS.loadRepDailySummary) await POS.loadRepDailySummary();
        if (POS.loadProductsCatalog) await POS.loadProductsCatalog();
        if (POS.loadShopsDropdown) await POS.loadShopsDropdown();
      } else if (tabId === 'rep-bills' && typeof RepBills !== 'undefined' && RepBills.loadBills) {
        await RepBills.loadBills();
      } else if (tabId === 'production' && typeof Production !== 'undefined' && Production.loadMatrix) {
        await Production.loadMatrix();
      } else if (tabId === 'stores' && typeof Stores !== 'undefined') {
        if (Stores.loadWarehouseStock) await Stores.loadWarehouseStock();
        if (Stores.loadOrdersMatrix) await Stores.loadOrdersMatrix();
      } else if (tabId === 'lorry' && typeof Lorry !== 'undefined' && Lorry.loadActiveTrip) {
        await Lorry.loadActiveTrip();
      } else if (tabId === 'collections' && typeof Collections !== 'undefined' && Collections.loadDebtors) {
        await Collections.loadDebtors();
      } else if (tabId === 'best-shops' && typeof BestShops !== 'undefined' && BestShops.load) {
        await BestShops.load();
      } else if (tabId === 'shops' && typeof Shops !== 'undefined' && Shops.loadShops) {
        await Shops.loadShops();
      } else if (tabId === 'routes' && typeof Routes !== 'undefined' && Routes.loadRoutes) {
        await Routes.loadRoutes();
      } else if (tabId === 'products' && typeof Products !== 'undefined' && Products.loadProducts) {
        await Products.loadProducts();
      } else if (tabId === 'reports' && typeof Reports !== 'undefined' && Reports.loadReports) {
        await Reports.loadReports();
      } else if (tabId === 'users' && typeof Users !== 'undefined' && Users.loadUsers) {
        await Users.loadUsers();
      } else if (tabId === 'settings' && typeof Settings !== 'undefined' && Settings.loadSettings) {
        await Settings.loadSettings();
      }
    } catch (err) {
      console.warn('Manual refresh notice:', err);
    }

    setTimeout(() => {
      icons.forEach(el => el.classList.remove('animate-spin'));
      if (showToast) {
        this.showToast('Cloud Data Synced & Refreshed (දත්ත සාර්ථකව යාවත්කාලීන විය)', 'success');
      }
    }, 450);
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-600 text-white shadow-emerald-600/30',
      error: 'bg-red-600 text-white shadow-red-600/30',
      warning: 'bg-amber-600 text-white shadow-amber-600/30',
      info: 'bg-slate-900 text-white shadow-slate-900/30'
    };

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.className = `flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold transition-all duration-300 transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `<span class="font-extrabold text-sm">${icons[type] || '•'}</span> <span>${message}</span>`;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      modal.style.display = 'flex';
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      modal.style.display = 'none';
    }
  },

  formatCurrency(amount) {
    const num = Number(amount) || 0;
    return 'Rs. ' + num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  formatDate(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  formatDateTime(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
           d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  // Image compressor for Shop Photos & Logo
  compressImage(file, maxDimension = 600, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const base64 = canvas.toDataURL('image/jpeg', quality);
          resolve(base64);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  },

  // ── PWA One-Tap Install App Method (Mobile & PC) ──
  async triggerPwaInstall() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      this.showToast('✅ මෙම පද්ධතිය දැනටමත් App එකක් ලෙස ක්‍රියාත්මක වේ.', 'info');
      return;
    }

    // If prompt is not ready yet, wait briefly up to 600ms in case browser is still evaluating PWA criteria
    if (!window.deferredInstallPrompt) {
      await new Promise(r => setTimeout(r, 600));
    }

    if (window.deferredInstallPrompt) {
      try {
        window.deferredInstallPrompt.prompt();
        const choice = await window.deferredInstallPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          this.showToast('🎉 App එක සාර්ථකව Install වෙමින් පවතී... Home Screen / Desktop බලන්න.', 'success');
        } else {
          this.showToast('Install කිරීම අවලංගු කරන ලදී.', 'info');
        }
        window.deferredInstallPrompt = null;
        return;
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }

    // Fallback: Open friendly, device-tailored visual Install Guide Modal
    const guideModal = document.getElementById('modal-pwa-install-guide');
    if (guideModal) {
      this.openModal('modal-pwa-install-guide');
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        alert("📲 iPhone / iPad වල App එකක් ලෙස ස්ථාපනය කිරීමට:\n\n1. Safari බ්‍රවුසරයේ පහළ ඇති Share (📤) බොත්තම ඔබන්න.\n2. පහළට ගොස් 'Add to Home Screen ➕' (මුල් තිරයට එක් කරන්න) තෝරන්න.\n3. 'Add' ඔබන්න.\n\nඑවිට මුල් තිරයේ App Icon එක දිස්වේ!");
      } else {
        alert("📲 මෙම පද්ධතිය App එකක් ලෙස Install කිරීමට:\n\nChrome / Edge බ්‍රවුසරයේ ඉහළ දකුණු කෙළවරේ ඇති තිත් 3 (⋮) හෝ Address bar හි ඇති Install (⬇️) Icon එක ඔබා 'Install App' (හෝ 'Add to Home screen') තෝරන්න.\n\nඑවිට Browser එක නැතිව කෙළින්ම Native App එකක් ලෙස Home Screen / Desktop එකෙන් Open කළ හැක!");
      }
    }
  }
};
