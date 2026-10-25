/**
 * New Rep Onboarding Wizard — 3-Step Setup
 * Step 1: Create Rep Account (name, username, PIN, phone, supervisor)
 * Step 2: Assign existing routes or create a new route inline
 * Step 3: Bulk-add shop names to the selected route (optional)
 *
 * After finish: Users list auto-refreshes so new rep name appears instantly.
 */

const RepOnboard = {
  currentStep: 1,
  savedRepId: null,
  savedRepName: '',
  savedRouteIds: [],

  // ─── Open Wizard ─────────────────────────────────────────────────────────
  async open() {
    this.currentStep = 1;
    this.savedRepId = null;
    this.savedRepName = '';
    this.savedRouteIds = [];

    // Clear Step 1 fields
    ['ob-rep-fullname', 'ob-rep-username', 'ob-rep-pin', 'ob-rep-phone'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Populate supervisor dropdown
    try {
      const rawUsers = await db.users.toArray();
      const sups = filterByTenant(rawUsers).filter(u => u.role === 'supervisor' && u.isActive !== false);
      const supSel = document.getElementById('ob-rep-supervisor');
      if (supSel) {
        supSel.innerHTML = '<option value="">-- No Supervisor --</option>' +
          sups.map(s => `<option value="${s.id}">📋 ${s.fullName || s.username}</option>`).join('');
      }
    } catch (e) {}

    this.renderStep(1);
    UI.openModal('modal-rep-onboard');
  },

  // ─── Render Step UI ───────────────────────────────────────────────────────
  renderStep(step) {
    this.currentStep = step;

    // Show/hide step panels
    [1, 2, 3].forEach(n => {
      const el = document.getElementById(`onboard-step-${n}`);
      if (el) el.classList.toggle('hidden', n !== step);
      const dot = document.getElementById(`onboard-step-dot-${n}`);
      if (dot) {
        dot.className = `flex-1 h-1.5 rounded-full transition-all ${n <= step ? 'bg-emerald-500' : 'bg-slate-200'}`;
      }
    });

    // Title
    const titles = {
      1: 'Step 1 of 3 — Rep Account (ගිණුම)',
      2: 'Step 2 of 3 — Assign Route (මාර්ගය)',
      3: 'Step 3 of 3 — Add Shops (කඩ සාප්පු)'
    };
    const titleEl = document.getElementById('onboard-title');
    if (titleEl) titleEl.textContent = titles[step] || '';

    // Back button
    const backBtn = document.getElementById('onboard-btn-back');
    if (backBtn) backBtn.classList.toggle('hidden', step === 1);

    // Skip button — only on step 3
    const skipBtn = document.getElementById('onboard-btn-skip');
    if (skipBtn) skipBtn.classList.toggle('hidden', step !== 3);

    // Next / Finish toggle
    const nextBtn = document.getElementById('onboard-btn-next');
    const finBtn = document.getElementById('onboard-btn-finish');
    if (nextBtn) nextBtn.classList.toggle('hidden', step === 3);
    if (finBtn) finBtn.classList.toggle('hidden', step !== 3);
  },

  // ─── Step Navigation ──────────────────────────────────────────────────────
  async nextStep() {
    if (this.currentStep === 1) {
      const ok = await this.saveStep1();
      if (!ok) return;
      await this.prepStep2();
      this.renderStep(2);
    } else if (this.currentStep === 2) {
      await this.saveStep2Routes();
      await this.prepStep3();
      this.renderStep(3);
    }
  },

  prevStep() {
    if (this.currentStep > 1) {
      this.renderStep(this.currentStep - 1);
    }
  },

  skipStep() {
    // Only Step 3 is skippable
    if (this.currentStep === 3) {
      this.finish();
    }
  },

  // ─── STEP 1: Save Rep Account ─────────────────────────────────────────────
  async saveStep1() {
    const fullName = document.getElementById('ob-rep-fullname')?.value?.trim() || '';
    const username = document.getElementById('ob-rep-username')?.value?.trim()?.toLowerCase() || '';
    const pin = document.getElementById('ob-rep-pin')?.value?.trim() || '';
    const phone = document.getElementById('ob-rep-phone')?.value?.trim() || '';
    const supervisorId = document.getElementById('ob-rep-supervisor')?.value;

    if (!fullName || !username || !pin) {
      UI.showToast('Name, Username and PIN ඇතුලත් කරන්න! ❌', 'warning');
      return false;
    }
    if (pin.length < 4) {
      UI.showToast('PIN අවම වශයෙන් ඉලක්කම් 4ක් විය යුතුයි.', 'warning');
      return false;
    }

    try {
      // Check username unique
      const existing = await db.users.where('username').equals(username).first();
      if (existing) {
        UI.showToast(`Username "@${username}" already used. වෙනත් නමක් දන්න.`, 'warning');
        return false;
      }

      const tenantId = (Auth.currentUser && Auth.currentUser.tenantId) ? Auth.currentUser.tenantId : (getActiveTenantId() || 1);

      this.savedRepId = await db.users.add({
        tenantId,
        fullName,
        username,
        pin,
        phone,
        role: 'rep',
        supervisorId: supervisorId ? Number(supervisorId) : null,
        assignedRouteId: null,
        assignedRouteIds: [],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      this.savedRepName = fullName;
      UI.showToast(`✅ Rep "${fullName}" created! Step 2 ට යමු.`, 'success');
      return true;
    } catch (e) {
      UI.showToast('Error creating rep: ' + e.message, 'error');
      return false;
    }
  },

  // ─── STEP 2: Populate Route Checklist ────────────────────────────────────
  async prepStep2() {
    try {
      const rawRoutes = await db.routes.toArray();
      const routes = filterByTenant(rawRoutes);
      const rawShops = await db.shops.toArray();
      const shopsByRoute = {};
      filterByTenant(rawShops).forEach(s => {
        shopsByRoute[Number(s.routeId)] = (shopsByRoute[Number(s.routeId)] || 0) + 1;
      });

      const list = document.getElementById('ob-routes-checklist');
      if (list) {
        if (routes.length === 0) {
          list.innerHTML = '<p class="text-xs text-slate-400">Routes නෑ — පහත New Route හදන්න.</p>';
        } else {
          list.innerHTML = routes.map(r => {
            const cnt = shopsByRoute[Number(r.id)] || 0;
            return `
              <label class="flex items-center justify-between p-2 bg-white rounded-xl border border-orange-200 text-xs font-bold text-slate-800 cursor-pointer hover:bg-orange-50">
                <div class="flex items-center gap-2">
                  <input type="checkbox" name="ob-route-cb" value="${r.id}" onchange="RepOnboard.onRouteCheckChange()" class="w-4 h-4 rounded text-orange-600 focus:ring-0" />
                  <span>📍 ${r.name}</span>
                </div>
                <span class="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-lg font-black">${cnt} Shops</span>
              </label>
            `;
          }).join('');
        }
      }

      // Clear new route fields
      const nrn = document.getElementById('ob-new-route-name');
      const nrd = document.getElementById('ob-new-route-desc');
      if (nrn) nrn.value = '';
      if (nrd) nrd.value = '';

      this.onRouteCheckChange();
    } catch (e) {}
  },

  async onRouteCheckChange() {
    const cbs = document.querySelectorAll('input[name="ob-route-cb"]:checked');
    const ids = Array.from(cbs).map(cb => Number(cb.value));
    const badge = document.getElementById('ob-route-count-badge');
    const shopBadge = document.getElementById('ob-shop-count-badge');

    if (badge) badge.textContent = `${ids.length} Route${ids.length === 1 ? '' : 's'} Selected`;

    if (shopBadge && ids.length > 0) {
      try {
        const rawShops = await db.shops.toArray();
        const cnt = filterByTenant(rawShops).filter(s => ids.includes(Number(s.routeId))).length;
        shopBadge.textContent = `${cnt} Shops`;
      } catch (e) {}
    } else if (shopBadge) {
      shopBadge.textContent = '0 Shops';
    }
  },

  // ─── Create Route Inline (Step 2 inline button) ───────────────────────────
  async createRouteInline() {
    const name = document.getElementById('ob-new-route-name')?.value?.trim();
    const desc = document.getElementById('ob-new-route-desc')?.value?.trim() || '';
    if (!name) {
      UI.showToast('Route name ලිවිය යුතුයි!', 'warning');
      return;
    }

    try {
      const tenantId = getActiveTenantId() || 1;
      const newRouteId = await db.routes.add({
        tenantId,
        name,
        description: desc,
        createdBy: Auth.currentUser?.username || 'admin',
        updatedAt: new Date().toISOString()
      });

      UI.showToast(`✅ Route "${name}" created!`, 'success');

      // Refresh checklist and auto-check new route
      await this.prepStep2();
      const cbs = document.querySelectorAll(`input[name="ob-route-cb"][value="${newRouteId}"]`);
      cbs.forEach(cb => { cb.checked = true; });
      this.onRouteCheckChange();

      // Clear name/desc inputs
      const nrn = document.getElementById('ob-new-route-name');
      const nrd = document.getElementById('ob-new-route-desc');
      if (nrn) nrn.value = '';
      if (nrd) nrd.value = '';
    } catch (e) {
      UI.showToast('Error creating route: ' + e.message, 'error');
    }
  },

  // ─── STEP 2: Save selected routes to Rep ─────────────────────────────────
  async saveStep2Routes() {
    const cbs = document.querySelectorAll('input[name="ob-route-cb"]:checked');
    this.savedRouteIds = Array.from(cbs).map(cb => Number(cb.value));

    if (this.savedRepId && this.savedRouteIds.length > 0) {
      try {
        await db.users.update(this.savedRepId, {
          assignedRouteIds: this.savedRouteIds,
          assignedRouteId: this.savedRouteIds[0],
          updatedAt: new Date().toISOString()
        });

        // Auto-link existing shops in these routes to this rep
        const rawShops = await db.shops.toArray();
        const toUpdate = filterByTenant(rawShops).filter(s => this.savedRouteIds.includes(Number(s.routeId)));
        for (const s of toUpdate) {
          await db.shops.update(s.id, {
            repId: this.savedRepId,
            repName: this.savedRepName,
            updatedAt: new Date().toISOString()
          });
        }

        if (this.savedRouteIds.length > 0) {
          UI.showToast(`✅ ${this.savedRouteIds.length} Route(s) linked to ${this.savedRepName}!`, 'success');
        }
      } catch (e) {
        console.warn('Route assign warn:', e);
      }
    }
  },

  // ─── STEP 3: Prep shop step UI ───────────────────────────────────────────
  async prepStep3() {
    // Populate route select for shops
    const sel = document.getElementById('ob-shops-route-select');
    if (sel && this.savedRouteIds.length > 0) {
      const rawRoutes = await db.routes.toArray();
      const routes = filterByTenant(rawRoutes).filter(r => this.savedRouteIds.includes(Number(r.id)));
      sel.innerHTML = routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    }

    // Show existing shops note
    const note = document.getElementById('ob-existing-shops-note');
    const cnt = document.getElementById('ob-existing-shops-count');
    if (note && this.savedRouteIds.length > 0) {
      try {
        const rawShops = await db.shops.toArray();
        const existing = filterByTenant(rawShops).filter(s => this.savedRouteIds.includes(Number(s.routeId)));
        if (existing.length > 0) {
          if (cnt) cnt.textContent = existing.length;
          note.classList.remove('hidden');
        } else {
          note.classList.add('hidden');
        }
      } catch (e) {}
    }

    // Clear textarea
    const ta = document.getElementById('ob-shops-bulk');
    if (ta) ta.value = '';
  },

  // ─── STEP 3: Finish — Bulk add shops + close ─────────────────────────────
  async finish() {
    const bulkText = document.getElementById('ob-shops-bulk')?.value?.trim() || '';
    const routeIdForShops = Number(document.getElementById('ob-shops-route-select')?.value) || this.savedRouteIds[0] || null;

    if (bulkText && routeIdForShops) {
      const shopNames = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let addedCount = 0;
      const tenantId = getActiveTenantId() || 1;

      for (const shopName of shopNames) {
        try {
          await db.shops.add({
            tenantId,
            routeId: routeIdForShops,
            name: shopName,
            ownerName: '',
            phone: '',
            address: '',
            currentCredit: 0,
            lat: null,
            lng: null,
            repId: this.savedRepId,
            repName: this.savedRepName,
            isOpen: true,
            createdBy: Auth.currentUser?.username || 'admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isSynced: false
          });
          addedCount++;
        } catch (e) {
          console.warn('Shop add warn:', e);
        }
      }

      if (addedCount > 0) {
        UI.showToast(`🏪 ${addedCount} Shops added to route!`, 'success');
      }
    }

    UI.closeModal('modal-rep-onboard');

    // ── KEY FIX: Immediately refresh Users list so new rep name appears ──
    if (typeof Users !== 'undefined' && Users.loadUsers) {
      await Users.loadUsers();
    }

    UI.showToast(`🎉 ${this.savedRepName} — Setup Complete! Rep ගිණුම, Routes & Shops සෑදීම ඉවරයි!`, 'success');
  }
};

window.RepOnboard = RepOnboard;
