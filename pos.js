/**
 * Field Point of Sale (POS) & Order Booking Module
 */

const POS = {
  activeRouteId: null,
  activeShopId: null,
  showAllShops: false,
  orderType: 'BookTomorrow', // 'BookTomorrow' | 'DirectSale'
  productsCache: [],
  shopsCache: [],
  _qrScanInterval: null,
  _qrStream: null,
  _activePromoProductId: null,

  async init() {
    State.clearCart();
    await this.populateRoutes();
    await this.loadProductsCatalog();
    await this.loadRepDailySummary();
    this.renderCartUI();
    this.renderReturnsUI();
    this.renderPaymentSummary();
    this.setOrderType('BookTomorrow');
  },

  // ── Sales Rep Daily Performance Summary (Live Cards & Sales Counter) ──
  async loadRepDailySummary() {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Fetch today's sales filtered by tenant
      const rawSales = await db.sales
        .filter(s => new Date(s.date) >= todayStart)
        .toArray();
      let sales = filterByTenant(rawSales);
      if (typeof Hierarchy !== 'undefined') {
        sales = await Hierarchy.filterSales(sales);
      }

      const user = Auth.currentUser;
      const isRep = user && (user.role === 'rep' || user.role === 'supervisor' || user.role === 'asm');

      // Hierarchy already filtered down to allowed sales for rep, supervisor, asm, admin
      const repSales = sales;

      const deliveredOrPending = repSales.filter(s => s.status !== 'Cancelled');
      const totalAmount = deliveredOrPending.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
      const totalBills = deliveredOrPending.length;

      // Calculate total card units sold today
      const saleIds = deliveredOrPending.map(s => s.id);
      let totalCardsCount = 0;

      if (saleIds.length > 0) {
        const rawItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
        const items = filterByTenant(rawItems);
        for (const item of items) {
          const qty = Number(item.qty) || 0;
          if ((item.unit || '').toLowerCase() === 'card') {
            totalCardsCount += qty;
          } else {
            totalCardsCount += Math.floor(qty / 20); // convert loose to cards if applicable
          }
        }
      }

      // Calculate today's returns
      let totalReturnsCount = 0;
      if (db.salesReturns) {
        const rawReturns = await db.salesReturns
          .filter(r => new Date(r.date) >= todayStart)
          .toArray();
        const returns = filterByTenant(rawReturns);
        const repReturns = isRep
          ? returns.filter(r => r.repId === user.id || r.repName === user.fullName || r.repName === user.username)
          : returns;
        totalReturnsCount = repReturns.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
      }

      // Update DOM
      const salesEl = document.getElementById('pos-rep-today-sales');
      const billsEl = document.getElementById('pos-rep-today-bills');
      const cardsEl = document.getElementById('pos-rep-today-cards');
      const returnsEl = document.getElementById('pos-rep-today-returns');

      if (salesEl) salesEl.textContent = UI.formatCurrency(totalAmount);
      if (billsEl) billsEl.textContent = `${totalBills} Bills`;
      if (cardsEl) cardsEl.textContent = totalCardsCount;
      if (returnsEl) returnsEl.textContent = `${totalReturnsCount} Items`;

      // ── Populate Live HR Target & Incentive Countdown Widget ──
      const trackerEl = document.getElementById('pos-live-target-tracker');
      if (trackerEl) {
        let rules = null;
        if (typeof Payroll !== 'undefined' && Payroll.getPayrollRules) {
          rules = await Payroll.getPayrollRules();
        } else {
          rules = {
            dailyBillMinAvg: 20,
            dailyBillBonus: 3000,
            cardTargetSlabs: [
              { id: 1, name: '100 Cards Slab', minCards: 100, bonus: 1000 },
              { id: 2, name: '200 Cards Slab', minCards: 200, bonus: 2000 },
              { id: 3, name: '500 Cards Slab', minCards: 500, bonus: 3500 }
            ]
          };
        }

        const dailyBillTarget = Number(rules.dailyBillMinAvg) || 20;
        const dailyBillBonus = Number(rules.dailyBillBonus) || 3000;
        const remainingBills = Math.max(0, dailyBillTarget - totalBills);
        const billPct = Math.min(100, Math.round((totalBills / dailyBillTarget) * 100));

        // Find next card slab target
        const slabs = (rules.cardTargetSlabs || [
          { minCards: 100, bonus: 1000 },
          { minCards: 200, bonus: 2000 },
          { minCards: 500, bonus: 3500 }
        ]).slice().sort((a, b) => (a.minCards || 0) - (b.minCards || 0));

        let currentSlab = null;
        let nextSlab = null;

        for (const slab of slabs) {
          if (totalCardsCount >= (slab.minCards || 0)) {
            currentSlab = slab;
          } else if (!nextSlab) {
            nextSlab = slab;
          }
        }
        if (!nextSlab && slabs.length > 0) {
          nextSlab = slabs[slabs.length - 1]; // All slabs completed!
        }

        const targetCards = nextSlab ? (nextSlab.minCards || 100) : 100;
        const targetBonus = nextSlab ? (nextSlab.bonus || 1000) : 1000;
        const remainingCards = Math.max(0, targetCards - totalCardsCount);
        const cardPct = Math.min(100, Math.round((totalCardsCount / targetCards) * 100));

        // ── Fetch & calculate individual Product Item Targets for this Rep ──
        const curMonth = new Date().toISOString().substring(0, 7);
        let assignedTargets = [];
        if (db.productTargets) {
          const allT = filterByTenant(await db.productTargets.toArray());
          const curMonthTargets = allT.filter(t => !t.targetMonth || t.targetMonth === curMonth);
          if (isRep && curMonthTargets.length > 0) {
            const repSpecific = curMonthTargets.filter(t => {
              if (t.empNo && user.empNo && String(t.empNo) === String(user.empNo)) return true;
              if (t.repId && (String(t.repId) === String(user.id) || t.repId == user.id)) return true;
              const tRep = (t.repName || '').toLowerCase().trim();
              if (uName && (tRep.includes(uName) || uName.includes(tRep))) return true;
              if (fName && (tRep.includes(fName) || fName.includes(tRep))) return true;
              return false;
            });
            assignedTargets = repSpecific.length > 0 ? repSpecific : curMonthTargets;
          } else {
            assignedTargets = curMonthTargets;
          }
        }

        // Fetch monthly sales for calculating live item targets
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const rawMonthSales = await db.sales.filter(s => new Date(s.date) >= monthStart).toArray();
        const monthSales = filterByTenant(rawMonthSales);
        const activeMonthSales = monthSales.filter(s => s.status !== 'Cancelled');

        const repMonthSales = isRep
          ? activeMonthSales.filter(s => {
              if (s.repId && (String(s.repId) === String(user.id) || s.repId == user.id)) return true;
              const repNameLower = (s.repName || '').toLowerCase().trim();
              const uName = (user.username || '').toLowerCase().trim();
              const fName = (user.fullName || '').toLowerCase().trim();
              return (uName && repNameLower.includes(uName)) || (fName && repNameLower.includes(fName));
            })
          : activeMonthSales;

        const repMonthSaleIds = repMonthSales.map(s => s.id);
        let repMonthItems = [];
        if (repMonthSaleIds.length > 0) {
          const rawMItems = await db.saleItems.where('saleId').anyOf(repMonthSaleIds).toArray();
          repMonthItems = filterByTenant(rawMItems);
        }

        // Calculate progress & countdown for each item target
        const itemTargetsData = assignedTargets.map(t => {
          const soldQty = repMonthItems
            .filter(si => String(si.productId) === String(t.productId))
            .reduce((sum, si) => sum + (Number(si.qty) || 0), 0);
          const targetQty = Number(t.targetQty) || 0;
          const remainingQty = Math.max(0, targetQty - soldQty); // Countdown decreases with every completed sale!
          const pct = targetQty > 0 ? Math.min(100, Math.round((soldQty / targetQty) * 100)) : 0;
          const isWon = targetQty > 0 && soldQty >= targetQty;
          return { ...t, soldQty, targetQty, remainingQty, pct, isWon };
        });

        trackerEl.innerHTML = `
          <div class="flex items-center justify-between border-b border-purple-800/40 pb-2">
            <div class="flex items-center gap-1.5">
              <span class="text-sm">🎯</span>
              <h4 class="text-xs font-black tracking-wide uppercase text-purple-200">Daily Sales Goals & Commission Slabs (දෛනික ඉලක්ක)</h4>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-900/80 text-purple-300 border border-purple-700/60">Live Countdown</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
            <!-- Daily Bill Target Countdown -->
            <div class="p-2.5 bg-black/25 rounded-2xl border border-purple-800/40 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-300 text-[11px]">🧾 Daily Bill Target (${dailyBillTarget} Bills)</span>
                <span class="font-black text-xs ${remainingBills === 0 ? 'text-emerald-400' : 'text-amber-300'}">
                  ${remainingBills === 0 ? '🎉 TARGET WON (+Rs. ' + dailyBillBonus.toLocaleString() + ')' : remainingBills + ' Bills Left'}
                </span>
              </div>
              <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div class="bg-gradient-to-r from-blue-500 to-emerald-400 h-2 rounded-full transition-all duration-500" style="width: ${billPct}%"></div>
              </div>
              <div class="flex justify-between text-[10px] text-slate-400">
                <span>Completed: <strong>${totalBills}</strong> / ${dailyBillTarget}</span>
                <span>${billPct}% reached</span>
              </div>
            </div>

            <!-- Card Slab Target Countdown -->
            <div class="p-2.5 bg-black/25 rounded-2xl border border-purple-800/40 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-300 text-[11px]">🌶️ Card Bonus Slab (${targetCards} Cards)</span>
                <span class="font-black text-xs ${remainingCards === 0 ? 'text-emerald-400' : 'text-pink-300'}">
                  ${remainingCards === 0 ? '🏆 SLAB WON (+Rs. ' + targetBonus.toLocaleString() + ')' : remainingCards + ' Cards Left'}
                </span>
              </div>
              <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div class="bg-gradient-to-r from-purple-500 to-pink-400 h-2 rounded-full transition-all duration-500" style="width: ${cardPct}%"></div>
              </div>
              <div class="flex justify-between text-[10px] text-slate-400">
                <span>Sold: <strong>${totalCardsCount}</strong> / ${targetCards} cards</span>
                <span>Reward: <strong>+Rs. ${targetBonus.toLocaleString()}</strong></span>
              </div>
            </div>
          </div>

          <!-- Product Item Targets Countdown (නිෂ්පාදන අනුව ඉලක්ක Countdown) -->
          ${itemTargetsData.length > 0 ? `
            <div class="pt-3 border-t border-purple-800/40 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs">📦</span>
                  <h5 class="text-[11px] font-black uppercase text-purple-200">
                    Product Item Targets (නිෂ්පාදන අනුව ඉලක්ක Countdown)
                  </h5>
                </div>
                <span class="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-pink-900/60 text-pink-300 border border-pink-700/50">
                  Bill දැමූ පසු ඉතිරි ගණන අඩු වේ
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                ${itemTargetsData.map(item => `
                  <div class="p-2.5 rounded-2xl border transition-all ${item.isWon ? 'bg-emerald-950/40 border-emerald-500/70' : 'bg-black/30 border-purple-800/50 hover:border-purple-600'} space-y-1.5">
                    <div class="flex items-start justify-between gap-1.5">
                      <span class="font-extrabold text-white text-[11px] truncate flex-1" title="${item.productName}">
                        ${item.productName}
                      </span>
                      <span class="text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 ${item.isWon ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}">
                        ${item.isWon ? '🏆 WON!' : item.remainingQty + ' ' + (item.unit || 'Cards') + ' Left'}
                      </span>
                    </div>

                    <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div class="h-2 rounded-full transition-all duration-500 ${item.isWon ? 'bg-emerald-400' : 'bg-gradient-to-r from-pink-500 via-purple-400 to-amber-400'}" style="width: ${item.pct}%"></div>
                    </div>

                    <div class="flex justify-between items-center text-[10px]">
                      <span class="text-slate-300">Sold: <strong class="text-white">${item.soldQty}</strong> / ${item.targetQty} ${item.unit || 'Cards'}</span>
                      <span class="font-bold ${item.isWon ? 'text-emerald-400 font-black' : 'text-amber-400'}">
                        ${item.isWon ? '🎉 සම්පූර්ණයි!' : '⏳ ඉතිරි: ' + item.remainingQty}
                      </span>
                    </div>

                    ${Number(item.bonus) > 0 ? `
                      <div class="text-[9.5px] font-bold flex justify-between pt-1 border-t border-purple-900/30">
                        <span class="text-slate-400">Bonus Reward:</span>
                        <span class="${item.isWon ? 'text-emerald-400' : 'text-pink-300'} font-black">+Rs. ${Number(item.bonus).toLocaleString()}</span>
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        `;
      }
    } catch (err) {
      console.error('Error loading Rep daily summary:', err);
    }
  },

  setOrderType(type) {
    this.orderType = type;
    const btnBook = document.getElementById('pos-type-book');
    const btnDirect = document.getElementById('pos-type-direct');
    const deliveryDateGroup = document.getElementById('pos-delivery-date-group');
    const paymentModeGroup = document.getElementById('pos-checkout-payment-group');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const deliveryDateInput = document.getElementById('pos-booking-delivery-date');
    if (deliveryDateInput && !deliveryDateInput.value) {
      deliveryDateInput.value = tomorrowStr;
    }

    if (type === 'BookTomorrow') {
      btnBook?.classList.add('bg-emerald-600', 'text-white', 'shadow-sm');
      btnBook?.classList.remove('bg-white', 'text-slate-700');
      btnDirect?.classList.remove('bg-emerald-600', 'text-white', 'shadow-sm');
      btnDirect?.classList.add('bg-white', 'text-slate-700');

      if (deliveryDateGroup) deliveryDateGroup.classList.remove('hidden');
      if (paymentModeGroup) paymentModeGroup.classList.add('hidden');
    } else {
      btnDirect?.classList.add('bg-emerald-600', 'text-white', 'shadow-sm');
      btnDirect?.classList.remove('bg-white', 'text-slate-700');
      btnBook?.classList.remove('bg-emerald-600', 'text-white', 'shadow-sm');
      btnBook?.classList.add('bg-white', 'text-slate-700');

      if (deliveryDateGroup) deliveryDateGroup.classList.add('hidden');
      if (paymentModeGroup) paymentModeGroup.classList.remove('hidden');
    }
  },

  async populateRoutes() {
    const rawRoutes = await db.routes.toArray();
    let routes = filterByTenant(rawRoutes);
    if (typeof Hierarchy !== 'undefined') {
      routes = await Hierarchy.filterRoutes(routes);
    }
    const routeSelect = document.getElementById('pos-route-select');
    if (!routeSelect) return;

    let html = `<option value="">-- Select Delivery Route --</option>`;
    for (const r of routes) {
      html += `<option value="${r.id}" ${this.activeRouteId == r.id ? 'selected' : ''}>${r.name}</option>`;
    }
    routeSelect.innerHTML = html;

    // Check active locked route session
    if (typeof RouteSession !== 'undefined' && RouteSession.isRouteActive()) {
      const activeSess = RouteSession.getActiveSession();
      this.activeRouteId = Number(activeSess.routeId);
      routeSelect.value = this.activeRouteId;
      routeSelect.disabled = true; // LOCK dropdown
      await this.onRouteSelected(this.activeRouteId);
    } else if (this.activeRouteId) {
      routeSelect.disabled = false;
      await this.onRouteSelected(this.activeRouteId);
    } else {
      routeSelect.disabled = false;
      await this.onRouteSelected(null);
    }
    if (typeof RouteSession !== 'undefined') RouteSession.renderBanners();
  },

  async onRouteSelected(routeId) {
    this.activeRouteId = routeId ? Number(routeId) : null;
    this.activeShopId = null;
    State.selectedShopId = null;

    const shopSearchInput = document.getElementById('pos-shop-search-input');
    if (shopSearchInput) shopSearchInput.value = '';

    const shopDetailsCard = document.getElementById('pos-shop-details-card');
    if (shopDetailsCard) shopDetailsCard.classList.add('hidden');

    if (this.activeRouteId) {
      const rawShops = await db.shops.where('routeId').equals(this.activeRouteId).toArray();
      let shops = filterByTenant(rawShops);
      if (typeof Hierarchy !== 'undefined') {
        shops = await Hierarchy.filterShops(shops);
      }
      this.shopsCache = shops;
    } else {
      const rawShops = await db.shops.toArray();
      let shops = filterByTenant(rawShops);
      if (typeof Hierarchy !== 'undefined') {
        shops = await Hierarchy.filterShops(shops);
      }
      this.shopsCache = shops;
    }

    this.renderShopSearchResults('');
  },

  onToggleShowAllShops(checked) {
    this.showAllShops = Boolean(checked);
    const searchVal = document.getElementById('pos-shop-search-input')?.value || '';
    this.renderShopSearchResults(searchVal);
  },

  onShopSearchFocus() {
    const searchVal = document.getElementById('pos-shop-search-input')?.value || '';
    if (searchVal || this.showAllShops) {
      this.renderShopSearchResults(searchVal);
    }
  },

  onShopSearchInput(val) {
    this.renderShopSearchResults(val);
  },

  renderShopSearchResults(searchVal) {
    const resultsContainer = document.getElementById('pos-shop-search-results');
    if (!resultsContainer) return;

    const term = (searchVal || '').trim().toLowerCase();
    
    // Clean UI: Keep hidden if no search query AND browse all toggle is off, or if shop is already selected
    if (!term && !this.showAllShops) {
      resultsContainer.classList.add('hidden');
      return;
    }

    const filtered = this.shopsCache.filter(s =>
      !term ||
      s.name.toLowerCase().includes(term) ||
      (s.ownerName && s.ownerName.toLowerCase().includes(term)) ||
      (s.phone && s.phone.includes(term))
    );

    if (filtered.length === 0) {
      resultsContainer.innerHTML = `
        <div class="p-3 text-center text-xs text-slate-400">
          No shop matching "${searchVal}". <button onclick="Shops.openShopModal()" class="text-emerald-700 font-bold underline">+ Add New Shop</button>
        </div>
      `;
      resultsContainer.classList.remove('hidden');
      return;
    }

    let html = '';
    for (const s of filtered.slice(0, 15)) {
      const hasCredit = (s.currentCredit || 0) > 0;
      html += `
        <div onclick="POS.selectShop(${s.id})" class="p-3 border-b border-slate-100 last:border-0 hover:bg-emerald-50/60 cursor-pointer flex items-center justify-between transition-colors">
          <div class="min-w-0">
            <h5 class="font-bold text-xs text-slate-800 truncate">${s.name}</h5>
            <p class="text-[11px] text-slate-500 truncate">👤 ${s.ownerName || 'Owner'} ${s.phone ? `• 📞 ${s.phone}` : ''}</p>
          </div>
          <div class="text-right flex-shrink-0">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${hasCredit ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">
              ${hasCredit ? 'Credit: ' + UI.formatCurrency(s.currentCredit) : '✓ Cleared'}
            </span>
          </div>
        </div>
      `;
    }

    resultsContainer.innerHTML = html;
    resultsContainer.classList.remove('hidden');
  },

  
  /** Mark shop as closed for today */
  
  /** Record Visit when shop owner says "No money / Next time" (සල්ලි නෑ / ඊළඟ පාර ගමු) */
  async markNoOrder(shopId = null) {
    const sid = shopId || this.activeShopId;
    if (!sid) {
      UI.showToast('Please select a shop first (කඩයක් තෝරන්න)', 'warning');
      return;
    }
    const shop = await db.shops.get(Number(sid));
    if (!shop) return;

    if (!confirm(`Record Visit for "${shop.name}" as NO ORDER / NEXT TIME? (අද දින මෙම කඩයට ගිය නමුත් ඇණවුමක් නැත / ඊළඟ පාර ගමු ලෙස සටහන් කරන්නද?)`)) {
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const pos = (typeof GPS !== 'undefined' && GPS.currentPos) ? GPS.currentPos : { lat: shop.lat || 8.0886, lng: shop.lng || 80.4578 };

    if (typeof GPS !== 'undefined' && GPS.recordBreadcrumb) {
      await GPS.recordBreadcrumb(pos, 'no_order', shop.id, shop.name);
    }

    UI.showToast(`🤝 "${shop.name}" - Visited (සල්ලි නෑ / ඊළඟ පාර) logged! Map updated.`, 'success');
    if (typeof SoundFX !== 'undefined') SoundFX.play('collect');

    if (typeof MapView !== 'undefined' && MapView.refreshMap) {
      MapView.refreshMap();
    }
  },

  async markShopClosed(shopId = null) {
    const sid = shopId || this.activeShopId;
    if (!sid) {
      UI.showToast('Please select a shop first (කඩයක් තෝරන්න)', 'warning');
      return;
    }
    const shop = await db.shops.get(Number(sid));
    if (!shop) return;

    if (!confirm(`Mark "${shop.name}" as CLOSED today? (අද දින මෙම කඩය වසා ඇති බව සටහන් කරන්නද?)`)) {
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const pos = (typeof GPS !== 'undefined' && GPS.currentPos) ? GPS.currentPos : { lat: shop.lat || 8.0886, lng: shop.lng || 80.4578 };

    if (typeof GPS !== 'undefined' && GPS.recordBreadcrumb) {
      await GPS.recordBreadcrumb(pos, 'shop_closed', shop.id, shop.name);
    }

    UI.showToast(`🔒 "${shop.name}" marked as CLOSED for today!`, 'info');
    if (typeof SoundFX !== 'undefined') SoundFX.play('shop');

    if (typeof MapView !== 'undefined' && MapView.refreshMap) {
      MapView.refreshMap();
    }
  },

  async selectShop(shopId) {
    this.activeShopId = Number(shopId);
    State.selectedShopId = this.activeShopId;

    const shop = await db.shops.get(this.activeShopId);
    if (!shop) return;

    const resultsContainer = document.getElementById('pos-shop-search-results');
    if (resultsContainer) resultsContainer.classList.add('hidden');

    const shopSearchInput = document.getElementById('pos-shop-search-input');
    if (shopSearchInput) shopSearchInput.value = shop.name;

    const card = document.getElementById('pos-shop-details-card');
    const nameEl = document.getElementById('pos-selected-shop-name');
    const phoneEl = document.getElementById('pos-selected-shop-phone');
    const creditEl = document.getElementById('pos-selected-shop-credit');

    if (nameEl) nameEl.textContent = shop.name;
    if (phoneEl) {
      phoneEl.innerHTML = `👤 ${shop.ownerName || 'Owner'} ${shop.phone ? `• <a href="tel:${shop.phone}" class="underline font-bold text-green-700">📞 ${shop.phone}</a>` : ''}`;
    }
    if (creditEl) {
      const credit = Number(shop.currentCredit) || 0;
      creditEl.textContent = `Old Credit: ${UI.formatCurrency(credit)}`;
      creditEl.className = `text-xs font-black px-2.5 py-1 rounded-xl ${credit > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`;
    }

    if (card) card.classList.remove('hidden');
    this.renderPaymentSummary();
  },

  clearSelectedShop() {
    this.activeShopId = null;
    State.selectedShopId = null;
    const shopSearchInput = document.getElementById('pos-shop-search-input');
    if (shopSearchInput) {
      shopSearchInput.value = '';
      shopSearchInput.focus();
    }
    const card = document.getElementById('pos-shop-details-card');
    if (card) card.classList.add('hidden');
    this.renderShopSearchResults('');
    this.renderPaymentSummary();
  },

  async loadProductsCatalog() {
    const rawProducts = await db.products.toArray();
    this.productsCache = filterByTenant(rawProducts);
    this.renderProductsList();
  },

  renderProductsList() {
    const container = document.getElementById('pos-products-list');
    if (!container) return;

    if (this.productsCache.length === 0) {
      container.innerHTML = `
        <div class="p-6 text-center text-slate-400 col-span-full">
          භාණ්ඩ හමු නොවීය. Product Master වෙතින් අයිතම එකතු කරන්න.
        </div>
      `;
      return;
    }

    const searchInput = document.getElementById('pos-product-search')?.value.toLowerCase() || '';

    let html = '';
    const filtered = this.productsCache.filter(p => 
      p.name.toLowerCase().includes(searchInput) || 
      (p.category && p.category.toLowerCase().includes(searchInput))
    );

    for (const prod of filtered) {
      const inCart = State.cart.find(item => item.productId === prod.id);
      const qty = inCart ? inCart.qty : 0;
      const freeQty = inCart ? inCart.freeQty : 0;
      const isCard = (prod.unit || 'Card').toLowerCase() === 'card';
      const packetsPerCard = prod.packetsPerCard || 20;
      const stock = prod.currentStock !== undefined ? Number(prod.currentStock) : (prod.stock !== undefined ? Number(prod.stock) : 0);
      const isLowStock = stock <= 5;

      html += `
        <div class="bg-white p-2.5 sm:p-3 rounded-2xl border ${qty > 0 ? 'border-emerald-500 shadow-md ring-2 ring-emerald-200 bg-emerald-50/25' : 'border-slate-200/90 shadow-2xs hover:border-slate-300'} flex flex-col justify-between transition-all relative overflow-hidden group">
          <!-- Top Unit & Stock Badge -->
          <div>
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="text-[9px] font-black px-1.5 py-0.5 rounded-md ${isCard ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}">
                ${prod.unit || 'Card'}
              </span>
              <span class="text-[9px] font-bold ${stock > 0 ? (isLowStock ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-slate-500 bg-slate-100') : 'text-rose-600 bg-rose-50 border border-rose-200'} px-1.5 py-0.5 rounded-md truncate max-w-[75px]">
                📦 ${stock}
              </span>
            </div>

            <!-- Product Title (2-line clamp) -->
            <h4 class="font-black text-slate-900 text-xs line-clamp-2 leading-tight tracking-tight min-h-[2rem]" title="${prod.name}">
              ${prod.name}
            </h4>

            <!-- Wholesale Price & Packets per Card -->
            <div class="flex items-baseline justify-between gap-1 mt-1 flex-wrap">
              <span class="font-black text-emerald-700 text-xs sm:text-sm">
                ${UI.formatCurrency(prod.sellingPrice)}
              </span>
              ${isCard ? `
                <span class="text-[9px] text-slate-400 font-medium">${packetsPerCard} pkts</span>
              ` : ''}
            </div>

            <!-- Free Issue Slab Info -->
            ${prod.freeSchemeEnabled ? `
              <div class="mt-1">
                <span class="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-900 inline-block truncate max-w-full">
                  🎁 Buy ${prod.freeSlabs?.[0]?.minQty || prod.freeSchemeMinQty || 12}+${prod.freeSlabs?.[0]?.freeQty || prod.freeSchemeFreeQty || 1} Free
                </span>
              </div>
            ` : ''}
          </div>

          <!-- Stepper Controls (Bottom Box) -->
          <div class="mt-2 pt-1.5 border-t border-slate-100">
            <div class="flex items-center justify-between bg-slate-100/90 rounded-xl p-0.5">
              <button type="button" onclick="POS.updateProductQty(${prod.id}, -1)" class="w-7 h-7 rounded-lg bg-white shadow-2xs font-black text-slate-700 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 active:scale-90 text-sm">
                -
              </button>
              <input type="number" min="0" value="${qty}" onchange="POS.setProductQty(${prod.id}, this.value)" class="w-9 text-center font-black text-xs bg-transparent border-0 focus:ring-0 p-0 ${qty > 0 ? 'text-emerald-700 font-extrabold' : 'text-slate-500'}" />
              <button type="button" onclick="POS.updateProductQty(${prod.id}, 1)" class="w-7 h-7 rounded-lg bg-emerald-600 shadow-2xs font-black text-white flex items-center justify-center hover:bg-emerald-700 active:scale-90 text-sm">
                +
              </button>
            </div>
            ${qty > 0 && freeQty > 0 ? `
              <div class="text-center mt-1">
                <span class="text-[9px] font-black text-purple-800 bg-purple-100 px-1.5 py-0.2 rounded-md">
                  🎁 +${freeQty} Free
                </span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  },

  onProductSearch(val) {
    this.renderProductsList();
  },

  calculateFreeQty(prod, qty) {
    if (!prod) return 0;
    const q = Number(qty) || 0;
    if (q <= 0) return 0;

    // Check custom free slabs configured on product (e.g. [{minQty: 12, freeQty: 1}, {minQty: 25, freeQty: 2}, ...])
    if (Array.isArray(prod.freeSlabs) && prod.freeSlabs.length > 0) {
      const sorted = prod.freeSlabs.slice().sort((a, b) => Number(b.minQty) - Number(a.minQty));
      const matched = sorted.find(s => q >= Number(s.minQty));
      if (matched) return Number(matched.freeQty) || 0;
      return 0;
    }

    // Tiered slabs compatibility
    if (Array.isArray(prod.tieredSlabs) && prod.tieredSlabs.length > 0) {
      const sorted = prod.tieredSlabs.slice().sort((a, b) => Number(b.minQty) - Number(a.minQty));
      const matched = sorted.find(s => q >= Number(s.minQty));
      if (matched) return Number(matched.freeQty) || 0;
      return 0;
    }

    if (!prod.freeSchemeEnabled) return 0;

    // Standard FMCG Slabs fallback (e.g. Soya meat 40g: 12/1, 25/2, 50/5, 100/12, 300/50)
    if (q >= 300) return Math.floor(q / 300) * 50;
    if (q >= 100) return Math.floor(q / 100) * 12;
    if (q >= 50)  return Math.floor(q / 50) * 5;
    if (q >= 25)  return Math.floor(q / 25) * 2;

    const min = Number(prod.freeSchemeMinQty) || 12;
    const free = Number(prod.freeSchemeFreeQty) || 1;
    if (min > 0 && q >= min) {
      return Math.floor(q / min) * free;
    }
    return 0;
  },

  updateProductQty(productId, delta) {
    const prod = this.productsCache.find(p => p.id === productId);
    if (!prod) return;

    if (delta > 0) {
      if (typeof SoundFX !== 'undefined') SoundFX.play('add_item');
    } else if (delta < 0) {
      if (typeof SoundFX !== 'undefined') SoundFX.play('remove_item');
    }

    const existingIndex = State.cart.findIndex(i => i.productId === productId);

    if (existingIndex >= 0) {
      const item = State.cart[existingIndex];
      item.qty += delta;
      if (item.qty <= 0) {
        State.cart.splice(existingIndex, 1);
      } else {
        if (!item.isCustomFree) {
          item.freeQty = this.calculateFreeQty(prod, item.qty);
        }
        item.subtotal = item.qty * item.sellingPrice;
        item.costTotal = (item.qty + (item.freeQty || 0)) * item.costPrice;
        item.profit = item.subtotal - item.costTotal;
      }
    } else if (delta > 0) {
      const freeQty = this.calculateFreeQty(prod, delta);
      State.cart.push({
        productId: prod.id,
        productName: prod.name,
        unit: prod.unit,
        packetsPerCard: prod.packetsPerCard || 20,
        costPrice: Number(prod.costPrice) || 0,
        standardPrice: Number(prod.sellingPrice) || 0,
        sellingPrice: Number(prod.sellingPrice) || 0,
        qty: delta,
        freeQty: freeQty,
        isCustomPrice: false,
        isCustomFree: false,
        dealType: freeQty > 0 ? 'volume_scheme' : 'standard',
        dealNote: '',
        subtotal: delta * prod.sellingPrice,
        costTotal: (delta + freeQty) * prod.costPrice,
        profit: (delta * prod.sellingPrice) - ((delta + freeQty) * prod.costPrice)
      });
    }

    this.renderProductsList();
    this.renderCartUI();
    this.renderPaymentSummary();
  },

  setProductQty(productId, value) {
    const val = parseInt(value) || 0;
    const prod = this.productsCache.find(p => p.id === productId);
    if (!prod) return;

    if (val > 0) {
      if (typeof SoundFX !== 'undefined') SoundFX.play('add_item');
    } else {
      if (typeof SoundFX !== 'undefined') SoundFX.play('remove_item');
    }

    const existingIndex = State.cart.findIndex(i => i.productId === productId);

    if (val <= 0) {
      if (existingIndex >= 0) State.cart.splice(existingIndex, 1);
    } else {
      if (existingIndex >= 0) {
        const item = State.cart[existingIndex];
        item.qty = val;
        if (!item.isCustomFree) {
          item.freeQty = this.calculateFreeQty(prod, val);
        }
        item.subtotal = val * item.sellingPrice;
        item.costTotal = (val + (item.freeQty || 0)) * item.costPrice;
        item.profit = item.subtotal - item.costTotal;
      } else {
        const freeQty = this.calculateFreeQty(prod, val);
        State.cart.push({
          productId: prod.id,
          productName: prod.name,
          unit: prod.unit,
          packetsPerCard: prod.packetsPerCard || 20,
          costPrice: Number(prod.costPrice) || 0,
          standardPrice: Number(prod.sellingPrice) || 0,
          sellingPrice: Number(prod.sellingPrice) || 0,
          qty: val,
          freeQty: freeQty,
          isCustomPrice: false,
          isCustomFree: false,
          dealType: freeQty > 0 ? 'volume_scheme' : 'standard',
          dealNote: '',
          subtotal: val * prod.sellingPrice,
          costTotal: (val + freeQty) * prod.costPrice,
          profit: (val * prod.sellingPrice) - ((val + freeQty) * prod.costPrice)
        });
      }
    }

    this.renderProductsList();
    this.renderCartUI();
    this.renderPaymentSummary();
  },

  onCartItemPriceChange(productId, val) {
    const item = State.cart.find(i => i.productId === productId);
    const prod = this.productsCache.find(p => p.id === productId);
    if (!item) return;

    const newPrice = Math.max(0, parseFloat(val) || 0);
    const stdPrice = Number(item.standardPrice || prod?.sellingPrice) || 0;
    item.sellingPrice = newPrice;
    item.isCustomPrice = (newPrice !== stdPrice);
    item.subtotal = item.qty * item.sellingPrice;
    item.costTotal = (item.qty + (item.freeQty || 0)) * item.costPrice;
    item.profit = item.subtotal - item.costTotal;

    if (item.sellingPrice < stdPrice) {
      item.dealType = 'net_rate';
    } else if (item.freeQty > 0) {
      item.dealType = 'volume_scheme';
    } else {
      item.dealType = 'standard';
    }

    this.renderProductsList();
    this.renderCartUI();
    this.renderPaymentSummary();
  },

  onCartItemFreeQtyChange(productId, val) {
    const item = State.cart.find(i => i.productId === productId);
    const prod = this.productsCache.find(p => p.id === productId);
    if (!item) return;

    const newFree = Math.max(0, parseInt(val) || 0);
    const defaultFree = prod ? this.calculateFreeQty(prod, item.qty) : 0;
    item.freeQty = newFree;
    item.isCustomFree = (newFree !== defaultFree);
    item.costTotal = (item.qty + item.freeQty) * item.costPrice;
    item.profit = item.subtotal - item.costTotal;

    if (item.freeQty > 0) {
      item.dealType = item.dealType || 'volume_scheme';
    }

    this.renderCartUI();
    this.renderPaymentSummary();
  },

  onCartItemQtyChange(productId, val) {
    this.setProductQty(productId, val);
  },

  adjustCartItemQty(productId, delta) {
    this.updateProductQty(productId, delta);
  },

  resetCartItemDeal(productId) {
    const item = State.cart.find(i => i.productId === productId);
    const prod = this.productsCache.find(p => p.id === productId);
    if (!item || !prod) return;

    item.sellingPrice = Number(item.standardPrice || prod.sellingPrice) || 0;
    item.isCustomPrice = false;
    item.isCustomFree = false;
    item.dealType = 'standard';
    item.dealNote = '';
    item.freeQty = this.calculateFreeQty(prod, item.qty);
    item.subtotal = item.qty * item.sellingPrice;
    item.costTotal = (item.qty + item.freeQty) * item.costPrice;
    item.profit = item.subtotal - item.costTotal;

    this.renderProductsList();
    this.renderCartUI();
    this.renderPaymentSummary();
    UI.showToast(`Reset ${item.productName} to standard catalog price & slabs.`, 'info');
  },

  renderCartUI() {
    const isAdmin = typeof Auth !== 'undefined' && (Auth.currentUser?.role === 'admin' || Auth.currentUser?.role === 'superadmin');
    const totalItems = State.cart.reduce((sum, i) => sum + i.qty, 0);
    const totalFree = State.cart.reduce((sum, i) => sum + (i.freeQty || 0), 0);
    const netTotal = State.getCartNetTotal();
    const totalSubsidy = State.getCartTotalSubsidy();
    const totalProfit = State.getCartTotalProfit();

    const badge = document.getElementById('pos-cart-badge');
    const totalPreview = document.getElementById('pos-cart-total-preview');
    if (badge) badge.textContent = totalFree > 0 ? `${totalItems} (+${totalFree})` : totalItems;
    if (totalPreview) totalPreview.textContent = UI.formatCurrency(netTotal);

    const cartDrawerList = document.getElementById('pos-cart-drawer-list');
    if (!cartDrawerList) return;

    if (State.cart.length === 0) {
      cartDrawerList.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs font-medium">ඔබගේ ඇණවුම් බෑගය හිස්ය (Cart is empty).</div>`;
      return;
    }

    let html = '';
    for (const item of State.cart) {
      const stdPrice = Number(item.standardPrice || item.sellingPrice) || 0;
      const isCustomPrice = item.sellingPrice !== stdPrice;
      const isNetRate = item.sellingPrice < stdPrice;
      const isBelowCost = item.sellingPrice < item.costPrice;
      const hasCustomDeal = isCustomPrice || item.isCustomFree;
      const totalPacks = item.qty + (item.freeQty || 0);

      // Shop Profit / Savings Calculation:
      const unitDiscount = Math.max(0, stdPrice - item.sellingPrice);
      const discountSavings = unitDiscount * item.qty;
      const freeGoodsSavings = (item.freeQty || 0) * stdPrice;
      const itemShopSavings = discountSavings + freeGoodsSavings;

      html += `
        <div class="p-3 bg-white rounded-2xl border ${isBelowCost && isAdmin ? 'border-red-300 bg-red-50/20' : (hasCustomDeal || item.freeQty > 0 ? 'border-purple-200 bg-purple-50/15' : 'border-slate-200')} shadow-xs space-y-2">
          <!-- Item Header & Badges -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h5 class="font-bold text-xs text-slate-900 truncate">${item.productName}</h5>
                <span class="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md">
                  සාමාන්‍ය: Rs. ${stdPrice.toFixed(0)}
                </span>
                ${isNetRate ? `
                  <span class="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[9px] font-black border border-amber-300">
                    🏷️ එකකින් Rs. ${unitDiscount.toFixed(0)} අඩුයි
                  </span>
                ` : ''}
                ${item.freeQty > 0 ? `
                  <span class="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[9px] font-black">
                    🎁 +${item.freeQty} Free ${item.isCustomFree ? '(විශේෂ)' : ''}
                  </span>
                ` : ''}
                ${isBelowCost && isAdmin ? `
                  <span class="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-md text-[9px] font-black admin-profit-only">
                    ⚠️ Below Cost!
                  </span>
                ` : ''}
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              ${hasCustomDeal ? `
                <button type="button" onclick="POS.resetCartItemDeal(${item.productId})" class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold active:scale-95" title="Reset to standard catalog price & slabs">
                  ↺ Auto
                </button>
              ` : ''}
              <button type="button" onclick="POS.setProductQty(${item.productId}, 0)" class="p-1 text-slate-300 hover:text-red-500 rounded-lg active:scale-95 text-xs font-bold" title="Remove">
                ✕
              </button>
            </div>
          </div>

          <!-- Direct In-Cart Editable Controls (Qty, Unit Price, Free Qty) -->
          <div class="grid grid-cols-12 gap-1.5 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
            <!-- Quantity [-] [val] [+] -->
            <div class="col-span-4 flex items-center bg-white rounded-lg border border-slate-200 px-1 py-0.5" title="ප්‍රමාණය (Quantity)">
              <button type="button" onclick="POS.adjustCartItemQty(${item.productId}, -1)" class="w-6 h-6 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded active:scale-90">-</button>
              <input type="number" min="1" value="${item.qty}" onchange="POS.onCartItemQtyChange(${item.productId}, this.value)" class="w-full text-center text-xs font-black text-slate-900 border-0 p-0 focus:ring-0 bg-transparent" />
              <button type="button" onclick="POS.adjustCartItemQty(${item.productId}, 1)" class="w-6 h-6 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded active:scale-90">+</button>
            </div>

            <!-- Billed Unit Price (Rs. [ 35 ]) -->
            <div class="col-span-5 flex items-center gap-1 bg-white rounded-lg border ${isNetRate ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200'} px-2 py-0.5" title="බිල් කරන මිල (Billed Price) - රු. 60 වෙනුවට 35 දෙන්න මෙතනට 35 ගසන්න">
              <span class="text-[9px] font-bold text-slate-400 whitespace-nowrap">බිල් මිල: Rs.</span>
              <input type="number" step="0.5" min="0" value="${item.sellingPrice}" onchange="POS.onCartItemPriceChange(${item.productId}, this.value)" class="w-full text-xs font-black ${isNetRate ? 'text-amber-900 font-extrabold' : 'text-slate-800'} border-0 p-0 focus:ring-0 bg-transparent text-right" />
            </div>

            <!-- Free Quantity (🎁 [ 2 ]) -->
            <div class="col-span-3 flex items-center gap-1 bg-white rounded-lg border ${item.freeQty > 0 ? 'border-purple-300 bg-purple-50/40' : 'border-slate-200'} px-1.5 py-0.5" title="නොමිලේ ප්‍රමාණය (Free Qty)">
              <span class="text-[10px] font-bold text-purple-700">Free:</span>
              <input type="number" min="0" value="${item.freeQty}" onchange="POS.onCartItemFreeQtyChange(${item.productId}, this.value)" class="w-full text-xs font-black text-purple-900 border-0 p-0 focus:ring-0 bg-transparent text-center" />
            </div>
          </div>

          <!-- Bottom Line: Total Dispensed, Billed Subtotal & Shop Profit/Savings -->
          <div class="flex items-center justify-between text-[11px] pt-0.5 px-0.5">
            <div>
              <span class="text-slate-500 text-[10px]">දෙන ප්‍රමාණය: <b>${totalPacks}</b> pkts (${item.qty} බිලට + ${item.freeQty} Free)</span>
              ${itemShopSavings > 0 ? `
                <span class="text-[10px] font-black text-emerald-700 block">
                  🛍️ කඩේට වාසිය: Rs. ${itemShopSavings.toFixed(2)} ${unitDiscount > 0 ? `(එකකින් Rs. ${unitDiscount.toFixed(0)} අඩුයි)` : ''}
                </span>
              ` : ''}
            </div>
            <div class="text-right">
              <span class="font-black text-xs text-slate-900 block">${UI.formatCurrency(item.subtotal)}</span>
              ${isAdmin ? `
                <span class="text-[9px] font-bold ${item.profit >= 0 ? 'text-teal-700' : 'text-red-600'} block admin-profit-only">
                  👑 Profit: ${UI.formatCurrency(item.profit)}
                </span>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }

    // Calculate total shop savings across entire cart:
    const cartShopSavingsTotal = State.cart.reduce((sum, item) => {
      const std = Number(item.standardPrice || item.sellingPrice) || 0;
      const sell = Number(item.sellingPrice) || std;
      const fQ = Number(item.freeQty) || 0;
      const discount = Math.max(0, std - sell) * (Number(item.qty) || 0);
      const freeVal = fQ * std;
      return sum + discount + freeVal;
    }, 0);

    if (cartShopSavingsTotal > 0) {
      html += `
        <div class="p-2.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-[11px] mt-2">
          <div>
            <span class="font-black text-emerald-950 block">🛍️ කඩේට ලැබෙන මුළු වාසිය (Shop Savings):</span>
            <span class="text-[10px] text-emerald-700">මිල අඩු කිරීම් + නොමිලේ භාණ්ඩවල සම්පූර්ණ ලාභය</span>
          </div>
          <div class="text-right">
            <span class="font-black text-emerald-800 text-sm block">Rs. ${cartShopSavingsTotal.toFixed(2)}</span>
            ${isAdmin ? `
              <span class="text-[9px] font-bold text-teal-700 block admin-profit-only">👑 Admin Profit: ${UI.formatCurrency(totalProfit)}</span>
            ` : ''}
          </div>
        </div>
      `;
    }

    cartDrawerList.innerHTML = html;
    // Apply role-based profit visibility after dynamic render
    if (typeof Auth !== 'undefined' && Auth.applyRoleRestrictions) {
      try { Auth.applyRoleRestrictions(); } catch(e) {}
    }
  },

    setPaymentMode(mode) {
    State.paymentMode = mode;
    const buttons = document.querySelectorAll('.payment-mode-btn');
    buttons.forEach(btn => {
      if (btn.getAttribute('data-mode') === mode) {
        btn.classList.add('bg-emerald-600', 'text-white', 'border-emerald-600', 'shadow-sm');
        btn.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');
      } else {
        btn.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-600', 'shadow-sm');
        btn.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
      }
    });

    const partialGroup = document.getElementById('pos-partial-amount-group');
    if (partialGroup) {
      if (mode === 'Partial') {
        partialGroup.classList.remove('hidden');
      } else {
        partialGroup.classList.add('hidden');
      }
    }

    this.renderPaymentSummary();
  },

  onDiscountChange(val) {
    State.discount = Math.max(0, Number(val) || 0);
    this.renderCartUI();
    this.renderPaymentSummary();
  },

  onPaidAmountChange(val) {
    State.paidAmount = Math.max(0, Number(val) || 0);
    this.renderPaymentSummary();
  },

  // ── Sales Returns & Replacements (සේල්ස් රිටන්ස් & භාණ්ඩ මාරු කිරීම්) ──
  async openAddReturnModal() {
    const select = document.getElementById('return-modal-product');
    if (select) {
      const products = this.productsCache.length > 0 ? this.productsCache : filterByTenant(await db.products.toArray());
      let html = '<option value="">-- Select Product to Return --</option>';
      for (const p of products) {
        const packets = p.packetsPerCard || 20;
        html += `<option value="${p.id}" data-price="${p.sellingPrice}" data-packets="${packets}" data-unit="${p.unit || 'Card'}">${p.name} (${p.unit || 'Card'}) - Rs. ${p.sellingPrice}</option>`;
      }
      select.innerHTML = html;
    }

    const modalQty = document.getElementById('return-modal-qty');
    if (modalQty) modalQty.value = '1';

    const modalAction = document.getElementById('return-modal-action');
    if (modalAction) modalAction.value = 'deduct';

    const modalType = document.getElementById('return-modal-type');
    if (modalType) modalType.value = 'Card';

    const modalReason = document.getElementById('return-modal-reason');
    if (modalReason) modalReason.value = 'Damaged (හානිවූ)';

    this.onReturnProductChange();
    UI.openModal('modal-add-return');
  },

  onReturnProductChange() {
    const select = document.getElementById('return-modal-product');
    const selectedOpt = select?.options[select.selectedIndex];
    const price = selectedOpt ? Number(selectedOpt.getAttribute('data-price')) || 0 : 0;
    const packets = selectedOpt ? Math.max(1, Number(selectedOpt.getAttribute('data-packets')) || 20) : 20;

    const typeSelect = document.getElementById('return-modal-type');
    const returnType = typeSelect?.value || 'Card';
    const qty = Math.max(1, Number(document.getElementById('return-modal-qty')?.value) || 1);
    const action = document.getElementById('return-modal-action')?.value || 'deduct';

    let unitRefund = price;
    if (returnType === 'Unit') {
      unitRefund = price / packets; // accurate proportional packet wholesale value
    }

    const refundPreview = document.getElementById('return-modal-refund-preview');
    if (refundPreview) {
      if (action === 'deduct') {
        const totalRefund = qty * unitRefund;
        refundPreview.textContent = `Deduction from Bill: -${UI.formatCurrency(totalRefund)} (${returnType === 'Unit' ? `${qty} pkts @ Rs. ${unitRefund.toFixed(2)}/pkt (${packets}s card)` : `${qty} full card(s)`})`;
        refundPreview.className = 'text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl text-center border border-red-200';
      } else {
        refundPreview.textContent = `1-to-1 Replacement: Exchange ${qty} ${returnType === 'Unit' ? 'Loose Packets' : 'Cards'} (භාණ්ඩය මාරු කිරීම)`;
        refundPreview.className = 'text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl text-center border border-emerald-200';
      }
    }
  },

  onReturnTypeChange() {
    this.onReturnProductChange();
  },

  onReturnActionChange() {
    this.onReturnProductChange();
  },

  onReturnQtyChange() {
    this.onReturnProductChange();
  },

  saveReturnFromModal() {
    const select = document.getElementById('return-modal-product');
    const productId = select?.value ? Number(select.value) : null;
    const selectedOpt = select?.options[select.selectedIndex];

    if (!productId || !selectedOpt) {
      UI.showToast('Please select a product to return.', 'warning');
      return;
    }

    const productName = selectedOpt.text.split(' - ')[0];
    const fullPrice = Number(selectedOpt.getAttribute('data-price')) || 0;
    const packets = Math.max(1, Number(selectedOpt.getAttribute('data-packets')) || 20);
    const returnType = document.getElementById('return-modal-type')?.value || 'Card';
    const qty = Math.max(1, Number(document.getElementById('return-modal-qty')?.value) || 1);
    const action = document.getElementById('return-modal-action')?.value || 'deduct';
    const reason = document.getElementById('return-modal-reason')?.value || 'Damaged';

    let unitRefund = fullPrice;
    if (returnType === 'Unit') {
      unitRefund = fullPrice / packets;
    }
    const refundAmount = action === 'deduct' ? (qty * unitRefund) : 0;

    State.returns.push({
      productId,
      productName,
      returnType,
      qty,
      packetsPerCard: packets,
      unitRefund,
      refundAmount,
      action,
      reason
    });

    UI.closeModal('modal-add-return');
    UI.showToast(action === 'deduct' ? `Return added: -${UI.formatCurrency(refundAmount)} deducted` : `Exchange item recorded!`, 'success');

    this.renderReturnsUI();
    this.renderCartUI();
    this.renderPaymentSummary();
  },

  removeReturnItem(index) {
    if (index >= 0 && index < State.returns.length) {
      State.returns.splice(index, 1);
      this.renderReturnsUI();
      this.renderCartUI();
      this.renderPaymentSummary();
      UI.showToast('Return item removed.', 'info');
    }
  },

  renderReturnsUI() {
    const container = document.getElementById('pos-returns-list-container');
    const checkoutContainer = document.getElementById('pos-checkout-returns-list');
    const badge = document.getElementById('pos-returns-badge');

    const count = State.returns.length;
    if (badge) {
      badge.textContent = count;
      if (count > 0) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }

    const renderList = (el) => {
      if (!el) return;
      if (State.returns.length === 0) {
        el.innerHTML = '<div class="text-xs text-slate-400 py-2 text-center">No returns or exchanges added.</div>';
        return;
      }
      let html = '';
      State.returns.forEach((r, idx) => {
        const isDeduct = r.action === 'deduct';
        html += `
          <div class="flex items-center justify-between p-2.5 bg-red-50/60 rounded-2xl border border-red-200">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-[9px] font-black px-1.5 py-0.5 rounded-md ${isDeduct ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}">
                  ${isDeduct ? 'DEDUCT (අඩු)' : 'EXCHANGE (මාරු)'}
                </span>
                <span class="text-[10px] text-slate-500 font-bold">${r.reason}</span>
              </div>
              <h5 class="font-bold text-xs text-slate-900 truncate mt-0.5">${r.productName}</h5>
              <span class="text-[10px] text-slate-600">${r.qty} × ${r.returnType === 'Unit' ? 'Loose Pkts' : 'Cards'}</span>
            </div>
            <div class="text-right flex-shrink-0 flex items-center gap-2">
              <div class="font-black text-xs ${isDeduct ? 'text-red-600' : 'text-emerald-700'}">
                ${isDeduct ? '-' + UI.formatCurrency(r.refundAmount) : '🔁 Replaced'}
              </div>
              <button onclick="POS.removeReturnItem(${idx})" class="text-red-500 font-black hover:text-red-700 text-sm px-1">✕</button>
            </div>
          </div>
        `;
      });
      el.innerHTML = html;
    };

    renderList(container);
    renderList(checkoutContainer);
  },

  async renderPaymentSummary() {
    const grossSubtotal = State.getCartSubtotal();
    const returnDeduction = State.getReturnDeductionTotal();
    const netTotal = State.getCartNetTotal();
    const mode = State.paymentMode;
    let paidAmount = 0;
    let creditAmount = 0;

    if (mode === 'Cash') {
      paidAmount = netTotal;
      creditAmount = 0;
    } else if (mode === 'Credit') {
      paidAmount = 0;
      creditAmount = netTotal;
    } else if (mode === 'Partial') {
      paidAmount = Math.min(netTotal, State.paidAmount || 0);
      creditAmount = Math.max(0, netTotal - paidAmount);
    }

    const shop = this.activeShopId ? await db.shops.get(this.activeShopId) : null;
    const oldCredit = shop ? (shop.currentCredit || 0) : 0;
    const updatedShopCredit = oldCredit + creditAmount;

    const netTotalEl = document.getElementById('pos-summary-net-total');
    const returnDeductEl = document.getElementById('pos-summary-return-deduction');
    const paidAmountEl = document.getElementById('pos-summary-paid');
    const creditAmountEl = document.getElementById('pos-summary-credit');
    const updatedCreditEl = document.getElementById('pos-summary-updated-credit');

    if (netTotalEl) netTotalEl.textContent = UI.formatCurrency(netTotal);
    if (returnDeductEl) returnDeductEl.textContent = `-${UI.formatCurrency(returnDeduction)}`;
    if (paidAmountEl) paidAmountEl.textContent = UI.formatCurrency(paidAmount);
    if (creditAmountEl) creditAmountEl.textContent = UI.formatCurrency(creditAmount);
    if (updatedCreditEl) updatedCreditEl.textContent = UI.formatCurrency(updatedShopCredit);
  },

  openCheckoutModal() {
    if (!this.activeShopId) {
      UI.showToast('Please search and select a shop first', 'warning');
      return;
    }
    if (State.cart.length === 0 && State.returns.length === 0) {
      UI.showToast('Cart is empty. Please add items.', 'warning');
      return;
    }
    this.renderReturnsUI();
    this.renderPaymentSummary();
    UI.openModal('modal-pos-checkout');
  },

  _isSubmittingSale: false,
  async submitSale(autoPrint = true) {
    if (this._isSubmittingSale) {
      console.warn('Sale submission already in progress. Ignoring duplicate click.');
      return;
    }
    this._isSubmittingSale = true;

    if (!this.activeShopId) {
      UI.showToast('Please select a shop', 'warning');
      this._isSubmittingSale = false;
      return;
    }
    if (State.cart.length === 0 && State.returns.length === 0) {
      UI.showToast('Order is empty', 'warning');
      this._isSubmittingSale = false;
      return;
    }

    const shop = await db.shops.get(this.activeShopId);
    if (!shop) {
      UI.showToast('Shop not found', 'error');
      this._isSubmittingSale = false;
      return;
    }

    try {
      const netTotal = State.getCartNetTotal();
      const totalCost = State.getCartTotalCost();
      const profit = netTotal - totalCost;
      const isBooking = this.orderType === 'BookTomorrow';

      let deliveryDate = new Date().toISOString().split('T')[0];
      if (isBooking) {
        deliveryDate = document.getElementById('pos-booking-delivery-date')?.value || deliveryDate;
      }

      const mode = isBooking ? 'Pending' : State.paymentMode;
      let paidAmount = 0;
      let creditAmount = 0;

      if (!isBooking) {
        if (mode === 'Cash') {
          paidAmount = netTotal;
          creditAmount = 0;
        } else if (mode === 'Credit') {
          paidAmount = 0;
          creditAmount = netTotal;
        } else if (mode === 'Partial') {
          paidAmount = Math.min(netTotal, State.paidAmount || 0);
          creditAmount = Math.max(0, netTotal - paidAmount);
        }
      }

      const invoiceNo = (isBooking ? 'ORD-' : 'INV-') + String(Date.now()).slice(-6);
      const date = new Date().toISOString();

      const currentUser = Auth.currentUser;
      const repId = currentUser ? currentUser.id : null;
      const repName = currentUser ? (currentUser.fullName || currentUser.username) : 'Sales Rep';
      const tenantId = (currentUser && currentUser.tenantId) ? currentUser.tenantId : (getActiveTenantId() || 1);

      // 1. Calculate promotional metrics and deals
      const totalStandardAmount = State.getCartStandardSubtotal();
      const specialPriceDiscount = State.getCartPriceDiscountTotal();
      const totalFreeCost = State.getCartFreeCostTotal();
      const totalSubsidy = State.getCartTotalSubsidy();
      const totalFreeQty = State.cart.reduce((sum, i) => sum + (Number(i.freeQty) || 0), 0);
      const hasSpecialDeal = State.cart.some(i => (i.sellingPrice < (i.standardPrice || i.sellingPrice)) || (i.freeQty > 0) || (i.isCustomPrice || i.isCustomFree));
      const dealSummary = State.cart
        .filter(i => (i.sellingPrice < (i.standardPrice || i.sellingPrice)) || (i.freeQty > 0) || (i.isCustomPrice || i.isCustomFree))
        .map(i => {
          const parts = [];
          const std = Number(i.standardPrice || i.sellingPrice) || 0;
          if (i.sellingPrice < std) {
            parts.push(`Net Rs. ${i.sellingPrice.toFixed(0)} (Std Rs. ${std.toFixed(0)})`);
          }
          if (i.freeQty > 0) {
            parts.push(`+${i.freeQty} Free`);
          }
          return `${i.productName} (${parts.join(', ')})`;
        }).join(' | ');

      // 1. Record Sale / Booked Order
      const saleId = await db.sales.add({
        tenantId,
        invoiceNo,
        date,
        deliveryDate: deliveryDate,
        status: isBooking ? 'Pending' : 'Delivered',
        shopId: shop.id,
        routeId: shop.routeId,
        repId: repId,
        repName: repName,
        totalAmount: netTotal,
        totalStandardAmount: totalStandardAmount,
        specialPriceDiscount: specialPriceDiscount,
        totalFreeQty: totalFreeQty,
        totalFreeCost: totalFreeCost,
        totalSubsidy: totalSubsidy,
        hasSpecialDeal: hasSpecialDeal,
        dealSummary: dealSummary,
        totalCost: totalCost,
        profit: profit,
        paidAmount: paidAmount,
        creditAmount: creditAmount,
        paymentType: mode,
        cancelReason: '',
        note: document.getElementById('pos-checkout-note')?.value || '',
        updatedAt: date,
        isSynced: false
      });

      // 2. Record Sale Items with complete promo audit details
      if (State.cart.length > 0) {
        const itemsToAdd = State.cart.map(item => {
          const std = Number(item.standardPrice || item.sellingPrice) || 0;
          const sell = Number(item.sellingPrice) || 0;
          const cost = Number(item.costPrice) || 0;
          const q = Number(item.qty) || 0;
          const fQ = Number(item.freeQty) || 0;
          const markdown = Math.max(0, std - sell) * q;
          const freeC = fQ * cost;
          const isDeal = markdown > 0 || fQ > 0 || Boolean(item.isCustomPromo);

          return {
            tenantId: tenantId,
            saleId: saleId,
            productId: item.productId,
            productName: item.productName,
            unit: item.unit,
            qty: q,
            freeQty: fQ,
            costPrice: cost,
            standardPrice: std,
            sellingPrice: sell,
            subtotal: item.subtotal,
            costTotal: item.costTotal,
            profit: item.profit,
            isSpecialDeal: isDeal,
            dealType: item.dealType || (markdown > 0 ? 'net_rate' : (fQ > 0 ? 'volume_scheme' : 'standard')),
            dealNote: item.dealNote || '',
            priceDiscount: markdown,
            freeCost: freeC,
            totalSubsidy: markdown + freeC
          };
        });
        await db.saleItems.bulkAdd(itemsToAdd);
      }

      // 3. Record Sales Returns & Exchanges
      if (State.returns.length > 0 && db.salesReturns) {
        const returnsToAdd = State.returns.map(r => ({
          tenantId: tenantId,
          saleId: saleId,
          invoiceNo: invoiceNo,
          shopId: shop.id,
          repId: repId,
          repName: repName,
          productId: r.productId,
          productName: r.productName,
          returnType: r.returnType,
          qty: r.qty,
          refundAmount: r.refundAmount,
          action: r.action,
          reason: r.reason,
          date: date,
          updatedAt: date,
          isSynced: false
        }));
        await db.salesReturns.bulkAdd(returnsToAdd);
      }

      // 4. Update Shop's Credit only if direct delivered sale with credit
      if (!isBooking && creditAmount > 0) {
        const finalCredit = (shop.currentCredit || 0) + creditAmount;
        await db.shops.update(shop.id, { currentCredit: finalCredit });
      }

      // 4b. Record GPS breadcrumb for sale
      try {
        if (typeof GPS !== 'undefined' && GPS.recordBreadcrumb) {
          const pos = (GPS.currentPos && GPS.currentPos.lat)
            ? GPS.currentPos
            : { lat: Number(shop.lat) || 8.0886, lng: Number(shop.lng) || 80.4578, speed: 0 };
          await GPS.recordBreadcrumb(pos, 'sale', shop.id, shop.name);
        }
      } catch (gpsErr) {}

      UI.closeModal('modal-pos-checkout');
      UI.showToast(isBooking ? `Order #${invoiceNo} booked for delivery on ${UI.formatDate(deliveryDate)}!` : `Invoice #${invoiceNo} saved & billed!`, 'success');
      if (typeof SoundFX !== 'undefined') SoundFX.play('success');

      // Realtime Order Notification for Store Keepers & Admin across tabs
      try {
        const orderBroadcastData = {
          type: 'NEW_ORDER_ALERT',
          saleId: saleId,
          invoiceNo: invoiceNo,
          repName: repName || (Auth.currentUser ? (Auth.currentUser.fullName || Auth.currentUser.username) : 'Sales Rep'),
          shopName: shop ? shop.name : 'Shop',
          totalAmount: netTotal,
          isBooking: isBooking,
          deliveryDate: deliveryDate,
          time: new Date().toLocaleTimeString(),
          timestamp: Date.now()
        };
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('mob_pos_order_channel');
          bc.postMessage(orderBroadcastData);
          bc.close();
        }
        localStorage.setItem('mob_pos_last_order_broadcast', JSON.stringify(orderBroadcastData));
      } catch (bcErr) {
        console.warn('Realtime order broadcast warning:', bcErr);
      }

      // 5. Trigger Print if instant sale
      if (!isBooking) {
        if (autoPrint) {
          await Print.printInvoice(saleId);
        } else {
          await Print.previewInvoice(saleId);
        }
      }

      // 6. Reset POS
      State.clearCart();
      this.renderProductsList();
      this.renderCartUI();
      this.renderReturnsUI();
      this.selectShop(shop.id);
      await this.loadRepDailySummary();
      Dashboard.loadDashboard();
      if (typeof RepBills !== 'undefined' && RepBills.loadBills) RepBills.loadBills();
    } catch (err) {
      console.error('Error submitting sale:', err);
      UI.showToast('Error saving order: ' + err.message, 'error');
    } finally {
      this._isSubmittingSale = false;
    }
  },

  // ── QR Scanner Methods ─────────────────────────────────────
  async openQRScanner() {
    UI.openModal('modal-qr-scanner');
    const video = document.getElementById('qr-scanner-video');
    const canvas = document.getElementById('qr-scanner-canvas');
    const ctx = canvas.getContext('2d');

    try {
      this._qrStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      video.srcObject = this._qrStream;
      video.setAttribute('playsinline', true);
      video.play();

      this._qrScanInterval = setInterval(() => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });
          if (code && code.data.startsWith('SHOPPOS:')) {
            const shopId = parseInt(code.data.replace('SHOPPOS:', ''));
            if (shopId) {
              this.stopQRScanner();
              this.selectShopByQR(shopId);
            }
          }
        }
      }, 300);
    } catch (err) {
      UI.showToast('Camera access denied. Allow camera to scan QR.', 'error');
      UI.closeModal('modal-qr-scanner');
    }
  },

  stopQRScanner() {
    if (this._qrScanInterval) {
      clearInterval(this._qrScanInterval);
      this._qrScanInterval = null;
    }
    if (this._qrStream) {
      this._qrStream.getTracks().forEach(t => t.stop());
      this._qrStream = null;
    }
    UI.closeModal('modal-qr-scanner');
  },

  async selectShopByQR(shopId) {
    const shop = await db.shops.get(shopId);
    if (!shop) {
      UI.showToast('Shop not found for this QR code!', 'error');
      return;
    }
    // Load shops cache if needed
    if (this.shopsCache.length === 0) {
      const rawShops = await db.shops.toArray();
      this.shopsCache = filterByTenant(rawShops);
    }
    await this.selectShop(shopId);
    UI.showToast(`✅ Shop selected: ${shop.name}`, 'success');
  }
};
