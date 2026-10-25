/**
 * Dedicated Debt Collections & Recovery Module
 */

const Collections = {
  selectedRouteFilter: 'all',
  selectedShop: null,
  shopsWithCredit: [],

  async init() {
    await this.populateRouteFilter();
    await this.loadDebtors();
    await this.loadRecentCollections();
  },

  async populateRouteFilter() {
    const rawRoutes = await db.routes.toArray();
    let routes = filterByTenant(rawRoutes);
    if (typeof Hierarchy !== 'undefined') {
      routes = await Hierarchy.filterRoutes(routes);
    }
    const dropdown = document.getElementById('coll-route-filter');
    if (!dropdown) return;

    let html = `<option value="all" ${this.selectedRouteFilter === 'all' ? 'selected' : ''}>All Routes (${routes.length})</option>`;
    for (const r of routes) {
      html += `<option value="${r.id}" ${String(this.selectedRouteFilter) === String(r.id) ? 'selected' : ''}>${r.name}</option>`;
    }
    dropdown.innerHTML = html;
  },

  onRouteFilterChange(val) {
    this.selectedRouteFilter = val;
    this.loadDebtors();
  },

  async loadDebtors() {
    let rawShops = await db.shops.filter(s => s.currentCredit > 0).toArray();
    let shops = filterByTenant(rawShops);
    if (typeof Hierarchy !== 'undefined') {
      shops = await Hierarchy.filterShops(shops);
    }

    if (this.selectedRouteFilter !== 'all') {
      shops = shops.filter(s => s.routeId === Number(this.selectedRouteFilter));
    }

    // Sort by highest credit
    shops.sort((a, b) => b.currentCredit - a.currentCredit);
    this.shopsWithCredit = shops;

    // Calculate Total Outstanding Debt for this view
    const totalDebt = shops.reduce((sum, s) => sum + (s.currentCredit || 0), 0);
    const totalDebtEl = document.getElementById('coll-total-outstanding');
    if (totalDebtEl) totalDebtEl.textContent = UI.formatCurrency(totalDebt);

    const debtorsCountEl = document.getElementById('coll-debtors-count');
    if (debtorsCountEl) debtorsCountEl.textContent = `${shops.length} Shops with Credit`;

    this.renderDebtorCards();
  },

  renderDebtorCards() {
    const container = document.getElementById('coll-debtors-list');
    if (!container) return;

    const searchTerm = document.getElementById('coll-shop-search')?.value.toLowerCase() || '';
    const filtered = this.shopsWithCredit.filter(s =>
      s.name.toLowerCase().includes(searchTerm) ||
      (s.ownerName && s.ownerName.toLowerCase().includes(searchTerm)) ||
      (s.phone && s.phone.includes(searchTerm))
    );

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 bg-white rounded-3xl border border-slate-100 p-6">
          <div class="text-3xl mb-2">🎉</div>
          <h4 class="font-bold text-slate-800 text-sm">No Outstanding Debts Found</h4>
          <p class="text-xs text-slate-400 mt-1">All shops in this filter have 0 credit balance.</p>
        </div>
      `;
      return;
    }

    let html = '';
    for (const shop of filtered) {
      html += `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between gap-3 hover:border-green-300 transition-all">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg border border-red-100 flex-shrink-0">
              💳
            </div>
            <div class="min-w-0">
              <h4 class="font-bold text-slate-900 text-xs sm:text-sm truncate">${shop.name}</h4>
              <p class="text-[11px] text-slate-500 truncate">👤 ${shop.ownerName || 'Owner'} ${shop.phone ? `• 📞 ${shop.phone}` : ''}</p>
              <div class="text-xs font-black text-red-600 mt-0.5">
                Due: ${UI.formatCurrency(shop.currentCredit)}
              </div>
            </div>
          </div>

          <button onclick="Collections.openCollectModal(${shop.id})" class="px-4 py-2.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-green-600/30 flex-shrink-0 flex items-center gap-1.5">
            <span>Collect</span> 💵
          </button>
        </div>
      `;
    }

    container.innerHTML = html;
  },

  onSearchChange(val) {
    this.renderDebtorCards();
  },

  async openCollectModal(shopId) {
    const shop = await db.shops.get(shopId);
    if (!shop) return;

    this.selectedShop = shop;
    document.getElementById('coll-modal-shop-name').textContent = shop.name;
    document.getElementById('coll-modal-owner').textContent = `Owner: ${shop.ownerName || '-'} | Phone: ${shop.phone || '-'}`;
    document.getElementById('coll-modal-current-debt').textContent = UI.formatCurrency(shop.currentCredit);
    document.getElementById('coll-modal-amount').value = '';
    document.getElementById('coll-modal-note').value = '';

    UI.openModal('modal-dedicated-collection');
  },

  async submitCollection(forcePrint) {
    if (!this.selectedShop) return;

    const amountPaid = Number(document.getElementById('coll-modal-amount').value) || 0;
    const note = document.getElementById('coll-modal-note').value.trim();
    const shouldPrint = forcePrint !== undefined ? forcePrint : (document.getElementById('coll-modal-autoprint')?.checked !== false);

    if (amountPaid <= 0) {
      UI.showToast('Please enter a valid payment amount', 'warning');
      return;
    }

    const previousCredit = this.selectedShop.currentCredit || 0;
    const newCredit = Math.max(0, previousCredit - amountPaid);
    const date = new Date().toISOString();
    const tenantId = (Auth.currentUser && Auth.currentUser.tenantId) ? Auth.currentUser.tenantId : (getActiveTenantId() || 1);
    const repId = Auth.currentUser ? Auth.currentUser.id : null;
    const collectedByName = (Auth.currentUser && (Auth.currentUser.fullName || Auth.currentUser.username)) || 'Sales Rep';

    // 1. Add creditPayment record
    const paymentId = await db.creditPayments.add({
      tenantId: tenantId,
      shopId: this.selectedShop.id,
      routeId: this.selectedShop.routeId,
      repId: repId,
      date: date,
      amountPaid: amountPaid,
      previousCredit: previousCredit,
      newCredit: newCredit,
      note: note || 'Field Debt Collection',
      collectedBy: collectedByName
    });

    // 2. Update Shop Credit
    await db.shops.update(this.selectedShop.id, { currentCredit: newCredit });

    UI.closeModal('modal-dedicated-collection');
    UI.showToast(`Collected ${UI.formatCurrency(amountPaid)} from ${this.selectedShop.name}!`, 'success');
    if (typeof SoundFX !== 'undefined') SoundFX.play('collect');

    // 3. Print receipt if requested
    if (shouldPrint && typeof Print !== 'undefined' && Print.printCollectionReceipt) {
      setTimeout(() => {
        Print.printCollectionReceipt(paymentId);
      }, 250);
    }

    // Refresh views
    await this.loadDebtors();
    await this.loadRecentCollections();
    if (typeof Dashboard !== 'undefined') Dashboard.loadDashboard();
  },

  async loadRecentCollections() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const rawPayments = await db.creditPayments
      .filter(p => new Date(p.date) >= todayStart)
      .reverse()
      .toArray();
    let payments = filterByTenant(rawPayments);
    if (typeof Hierarchy !== 'undefined') {
      payments = await Hierarchy.filterSales(payments);
    }

    const totalCollectedToday = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const collTodayEl = document.getElementById('coll-today-collected');
    if (collTodayEl) collTodayEl.textContent = UI.formatCurrency(totalCollectedToday);

    const container = document.getElementById('coll-recent-history-list');
    if (!container) return;

    if (payments.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-xs text-slate-400">No collections recorded today yet.</div>`;
      return;
    }

    let html = '';
    for (const p of payments) {
      const shop = await db.shops.get(p.shopId);
      html += `
        <div class="bg-green-50/70 border border-green-200 p-3 rounded-2xl flex items-center justify-between gap-2">
          <div>
            <h5 class="font-bold text-xs text-slate-800">${shop ? shop.name : 'Unknown Shop'}</h5>
            <div class="text-[10px] text-slate-500 mt-0.5">${UI.formatDateTime(p.date)} ${p.note ? `• ${p.note}` : ''}</div>
            <div class="text-[10px] text-green-800 font-semibold mt-0.5">
              Old: ${UI.formatCurrency(p.previousCredit)} ➔ New: ${UI.formatCurrency(p.newCredit)}
            </div>
          </div>
          <div class="text-right flex flex-col items-end gap-1 flex-shrink-0">
            <div class="font-black text-xs sm:text-sm text-green-700">+${UI.formatCurrency(p.amountPaid)}</div>
            <button onclick="Print.printCollectionReceipt(${p.id})" class="px-2.5 py-1 bg-white hover:bg-green-100 text-green-800 border border-green-300 rounded-xl font-black text-[11px] flex items-center gap-1 shadow-xs active:scale-95 transition-all">
              🖨️ Print
            </button>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  },

  // ── OPENING CREDIT / PAST BILL BOOK CREDIT ENTRY ──
  openingCreditMode: 'existing',

  setOpeningCreditMode(mode) {
    this.openingCreditMode = mode;
    const btnExisting = document.getElementById('btn-tab-existing-shop');
    const btnNew = document.getElementById('btn-tab-new-shop');
    const boxExisting = document.getElementById('opening-credit-existing-box');
    const boxNew = document.getElementById('opening-credit-new-box');

    if (mode === 'existing') {
      if (btnExisting) {
        btnExisting.className = 'py-2 text-xs font-black rounded-xl transition-all bg-white text-emerald-700 shadow-sm cursor-pointer';
      }
      if (btnNew) {
        btnNew.className = 'py-2 text-xs font-black rounded-xl transition-all text-slate-500 hover:text-slate-800 cursor-pointer';
      }
      if (boxExisting) boxExisting.classList.remove('hidden');
      if (boxNew) boxNew.classList.add('hidden');
    } else {
      if (btnExisting) {
        btnExisting.className = 'py-2 text-xs font-black rounded-xl transition-all text-slate-500 hover:text-slate-800 cursor-pointer';
      }
      if (btnNew) {
        btnNew.className = 'py-2 text-xs font-black rounded-xl transition-all bg-white text-emerald-700 shadow-sm cursor-pointer';
      }
      if (boxExisting) boxExisting.classList.add('hidden');
      if (boxNew) boxNew.classList.remove('hidden');
    }
  },

  async openOpeningCreditModal() {
    this.setOpeningCreditMode('existing');

    // Set today's date
    const dateEl = document.getElementById('opening-credit-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

    // Clear inputs
    const amtEl = document.getElementById('opening-credit-amount');
    if (amtEl) amtEl.value = '';
    const noteEl = document.getElementById('opening-credit-note');
    if (noteEl) noteEl.value = '';
    const newNameEl = document.getElementById('opening-credit-new-name');
    if (newNameEl) newNameEl.value = '';
    const newOwnerEl = document.getElementById('opening-credit-new-owner');
    if (newOwnerEl) newOwnerEl.value = '';
    const newPhoneEl = document.getElementById('opening-credit-new-phone');
    if (newPhoneEl) newPhoneEl.value = '';
    const newAddrEl = document.getElementById('opening-credit-new-address');
    if (newAddrEl) newAddrEl.value = '';

    // Populate existing shops dropdown
    const shopSelect = document.getElementById('opening-credit-shop-select');
    if (shopSelect) {
      let rawShops = await db.shops.toArray();
      let shops = filterByTenant(rawShops);
      shops.sort((a, b) => a.name.localeCompare(b.name));

      let rawRoutes = await db.routes.toArray();
      const routeMap = {};
      rawRoutes.forEach(r => { routeMap[r.id] = r.name; });

      if (shops.length === 0) {
        shopSelect.innerHTML = `<option value="">කඩ ඇතුළත් කර නැත (කරුණාකර අලුත් කඩයක් තෝරන්න)</option>`;
        this.setOpeningCreditMode('new');
      } else {
        shopSelect.innerHTML = shops.map(s => {
          const rName = routeMap[s.routeId] ? ` [${routeMap[s.routeId]}]` : '';
          const dueText = (s.currentCredit > 0) ? ` (Due: Rs. ${s.currentCredit})` : '';
          return `<option value="${s.id}">${s.name}${rName}${dueText}</option>`;
        }).join('');
        this.onExistingShopSelected(shops[0].id);
      }
    }

    // Populate routes dropdown for new shop
    const routeSelect = document.getElementById('opening-credit-new-route');
    if (routeSelect) {
      let rawRoutes = await db.routes.toArray();
      let routes = filterByTenant(rawRoutes);
      routeSelect.innerHTML = routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    }

    UI.openModal('modal-opening-credit');
  },

  async onExistingShopSelected(shopId) {
    const debtInfoBox = document.getElementById('opening-credit-current-debt-info');
    const debtAmtEl = document.getElementById('opening-credit-existing-amount');
    if (!shopId) {
      if (debtInfoBox) debtInfoBox.classList.add('hidden');
      return;
    }
    const shop = await db.shops.get(Number(shopId));
    if (shop && Number(shop.currentCredit) > 0) {
      if (debtAmtEl) debtAmtEl.textContent = UI.formatCurrency(shop.currentCredit);
      if (debtInfoBox) debtInfoBox.classList.remove('hidden');
    } else {
      if (debtInfoBox) debtInfoBox.classList.add('hidden');
    }
  },

  async saveOpeningCredit() {
    const amount = Number(document.getElementById('opening-credit-amount')?.value) || 0;
    const note = document.getElementById('opening-credit-note')?.value?.trim() || '';
    const billDate = document.getElementById('opening-credit-date')?.value || new Date().toISOString().split('T')[0];
    const activeTid = getActiveTenantId() || 1;

    if (amount <= 0) {
      UI.showToast('කරුණාකර වලංගු ණය මුදලක් ඇතුළත් කරන්න (Enter valid amount)', 'warning');
      return;
    }

    let shopId = null;
    let shopName = '';
    let targetRouteId = 1;

    if (this.openingCreditMode === 'existing') {
      const selectEl = document.getElementById('opening-credit-shop-select');
      shopId = Number(selectEl?.value);
      if (!shopId) {
        UI.showToast('කරුණාකර කඩයක් තෝරන්න (Select a shop)', 'warning');
        return;
      }
      const existingShop = await db.shops.get(shopId);
      if (!existingShop) {
        UI.showToast('තෝරාගත් කඩය සොයාගත නොහැක', 'error');
        return;
      }
      shopName = existingShop.name;
      targetRouteId = existingShop.routeId || 1;

      // Update shop debt
      const prevDebt = Number(existingShop.currentCredit) || 0;
      const newDebt = prevDebt + amount;
      await db.shops.update(shopId, {
        currentCredit: newDebt,
        updatedAt: new Date().toISOString()
      });
    } else {
      shopName = document.getElementById('opening-credit-new-name')?.value?.trim();
      const routeSelect = document.getElementById('opening-credit-new-route');
      targetRouteId = Number(routeSelect?.value) || 1;
      const ownerName = document.getElementById('opening-credit-new-owner')?.value?.trim() || '';
      const phone = document.getElementById('opening-credit-new-phone')?.value?.trim() || '';
      const address = document.getElementById('opening-credit-new-address')?.value?.trim() || '';

      if (!shopName) {
        UI.showToast('කරුණාකර අලුත් කඩේ නම ඇතුළත් කරන්න (Shop name required)', 'warning');
        return;
      }

      // Create new shop with credit
      shopId = await db.shops.add({
        tenantId: activeTid,
        name: shopName,
        ownerName,
        phone,
        address,
        routeId: targetRouteId,
        currentCredit: amount,
        isOpen: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Create an Opening Credit Sale entry so it is auditable in sales ledger
    try {
      await db.sales.add({
        tenantId: activeTid,
        shopId: shopId,
        shopName: shopName,
        routeId: targetRouteId,
        date: new Date(billDate + 'T12:00:00').toISOString(),
        total: amount,
        discount: 0,
        netTotal: amount,
        amountPaid: 0,
        balance: amount,
        paymentMethod: 'credit',
        status: 'completed',
        isOpeningCredit: true,
        notes: `පැරණි බිල්පත් ණය: ${note || 'Opening Credit Balance'}`
      });
    } catch (e) {
      console.warn('Opening credit sales ledger notice:', e);
    }

    UI.closeModal('modal-opening-credit');
    UI.showToast(`✅ ${shopName} - පැරණි ණය Rs. ${UI.formatCurrency(amount)} සාර්ථකව එකතු විය!`, 'success');
    if (typeof SoundFX !== 'undefined') SoundFX.play('save');

    // Refresh debtors list and dashboard
    await this.loadDebtors();
    if (typeof Dashboard !== 'undefined' && Dashboard.loadDashboard) Dashboard.loadDashboard();
    if (typeof Shops !== 'undefined' && Shops.loadShops) Shops.loadShops();
  }
};
