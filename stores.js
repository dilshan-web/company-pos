/**
 * Production Stores Management Module
 * Allows Stores Keepers to:
 * 1. View live Reps booked orders (exact cards & packets required for delivery packing)
 * 2. Manage warehouse stock balances with low stock alerts
 * 3. Intake new manufactured stock (+ Add Stock) from factory
 * 4. Audit stock returns from delivery lorry trips
 * 5. View complete Stock Ledger audit log
 */

const Stores = {
  activeDate: null,
  activeRouteId: 'all',
  activeSearch: '',

  init() {
    const todayStr = new Date().toISOString().split('T')[0];
    this.activeDate = todayStr;

    const dateInput = document.getElementById('stores-target-date');
    if (dateInput) {
      dateInput.value = this.activeDate;
    }

    this.populateRouteFilters();
    this.loadRepOrdersSummary();
    this.loadWarehouseStock();
    this.loadLorryReturnsHistory();
    this.loadStockLedgerHistory();
    this.initStaffAttendance();
    this.initLiveOrderListener();
  },

  async populateRouteFilters() {
    const routeSelect = document.getElementById('stores-route-filter');
    if (!routeSelect) return;

    try {
      const rawRoutes = await db.routes.toArray();
      const routes = filterByTenant(rawRoutes);
      let html = '<option value="all">🌐 All Routes (සියලු මාර්ග)</option>';
      routes.forEach(r => {
        html += `<option value="${r.id}">${r.name}</option>`;
      });
      routeSelect.innerHTML = html;
      routeSelect.value = this.activeRouteId;
    } catch (e) {
      console.error('Error populating stores route filter:', e);
    }
  },

  onDateChange(dateStr) {
    this.activeDate = dateStr;
    this.loadRepOrdersSummary();
  },

  onRouteChange(routeVal) {
    this.activeRouteId = routeVal;
    this.loadRepOrdersSummary();
  },

  setPresetDate(type) {
    const now = new Date();
    if (type === 'today') {
      this.activeDate = now.toISOString().split('T')[0];
    } else if (type === 'tomorrow') {
      now.setDate(now.getDate() + 1);
      this.activeDate = now.toISOString().split('T')[0];
    } else if (type === 'all_pending') {
      this.activeDate = 'all';
    }

    const dateInput = document.getElementById('stores-target-date');
    if (dateInput && this.activeDate !== 'all') {
      dateInput.value = this.activeDate;
    }
    this.loadRepOrdersSummary();
  },

  // 1. Live Rep Booked Orders Matrix
  async loadRepOrdersSummary() {
    const container = document.getElementById('stores-orders-matrix-container');
    const badgeCards = document.getElementById('stores-total-req-cards');
    const badgePkts = document.getElementById('stores-total-req-pkts');
    const badgeBills = document.getElementById('stores-total-req-bills');

    if (!container) return;

    try {
      let salesQuery = db.sales.filter(s => s.status !== 'Cancelled');
      let rawSales = await salesQuery.toArray();
      let allSales = filterByTenant(rawSales);

      // Apply date and route filters
      if (this.activeDate !== 'all') {
        allSales = allSales.filter(s => (s.deliveryDate === this.activeDate) || (!s.deliveryDate && s.date && s.date.startsWith(this.activeDate)));
      }
      if (this.activeRouteId !== 'all') {
        allSales = allSales.filter(s => String(s.routeId) === String(this.activeRouteId));
      }

      const saleIds = allSales.map(s => s.id);
      let saleItems = [];
      if (saleIds.length > 0) {
        saleItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
      }

      const rawProducts = await db.products.toArray();
      const products = filterByTenant(rawProducts);
      const productMap = {};
      products.forEach(p => {
        productMap[p.id] = p;
      });

      // Aggregate by product
      const itemSummary = {};
      let totalCards = 0;
      let totalPackets = 0;

      saleItems.forEach(item => {
        const prod = productMap[item.productId] || { name: item.productName, unit: item.unit || 'Card', packetsPerCard: 20 };
        const key = item.productId || item.productName;
        const totalItemQty = (Number(item.qty) || 0) + (Number(item.freeQty) || 0);

        if (!itemSummary[key]) {
          itemSummary[key] = {
            productId: item.productId,
            name: item.productName || prod.name,
            unit: item.unit || prod.unit || 'Card',
            orderedQty: 0,
            freeQty: 0,
            totalQty: 0,
            currentStock: prod.currentStock !== undefined ? prod.currentStock : 0,
            packetsPerCard: Number(prod.packetsPerCard) || 20
          };
        }

        itemSummary[key].orderedQty += (Number(item.qty) || 0);
        itemSummary[key].freeQty += (Number(item.freeQty) || 0);
        itemSummary[key].totalQty += totalItemQty;

        if (itemSummary[key].unit === 'Card') {
          totalCards += totalItemQty;
          totalPackets += (totalItemQty * (Number(prod.packetsPerCard) || 20));
        } else {
          totalPackets += totalItemQty;
        }
      });

      // Update KPI Badges
      if (badgeBills) badgeBills.textContent = `${allSales.length} Orders`;
      if (badgeCards) badgeCards.textContent = `${totalCards} Cards`;
      if (badgePkts) badgePkts.textContent = `${totalPackets.toLocaleString()} Pkts`;

      const summaryList = Object.values(itemSummary);
      if (summaryList.length === 0) {
        container.innerHTML = `
          <div class="bg-slate-50 border border-slate-200 rounded-3xl p-6 text-center text-slate-500 space-y-2">
            <span class="text-3xl block">📦</span>
            <p class="text-xs font-bold text-slate-700">No active orders booked for this date / route.</p>
            <p class="text-[11px] text-slate-400">Reps' booked orders will show up here automatically when entered.</p>
          </div>
        `;
        return;
      }

      let html = '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
      summaryList.forEach(item => {
        const isShortage = item.currentStock < item.totalQty;
        const shortageAmount = item.totalQty - item.currentStock;

        html += `
          <div class="bg-white rounded-2xl p-3.5 shadow-sm border ${isShortage ? 'border-red-300 bg-red-50/20' : 'border-slate-200'} space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h4 class="font-black text-xs sm:text-sm text-slate-900">${item.name}</h4>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">${item.unit}</span>
                  ${item.unit === 'Card' ? `<span class="text-[10px] text-amber-700 font-semibold">${item.packetsPerCard} pkts/card</span>` : ''}
                </div>
              </div>
              <div class="text-right">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Required</span>
                <span class="text-base font-black text-emerald-700">${item.totalQty} ${item.unit}s</span>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2 rounded-xl border border-slate-100 text-[11px]">
              <div>
                <span class="text-[9px] text-slate-400 font-bold block">Bill Qty</span>
                <span class="font-extrabold text-slate-700">${item.orderedQty}</span>
              </div>
              <div>
                <span class="text-[9px] text-purple-600 font-bold block">🎁 Free</span>
                <span class="font-extrabold text-purple-700">${item.freeQty}</span>
              </div>
              <div>
                <span class="text-[9px] text-slate-500 font-bold block">Wh. Stock</span>
                <span class="font-extrabold ${item.currentStock > 0 ? 'text-slate-900' : 'text-red-600'}">${item.currentStock}</span>
              </div>
            </div>

            ${isShortage ? `
              <div class="flex items-center justify-between bg-red-100/70 border border-red-200 px-2.5 py-1.5 rounded-xl">
                <span class="text-[10px] font-bold text-red-700">⚠️ Stock Shortage: ${shortageAmount} ${item.unit}s short!</span>
                <button onclick="Stores.openAddStockModal(${item.productId})" class="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold active:scale-95">
                  + Add Stock
                </button>
              </div>
            ` : `
              <div class="flex items-center justify-between text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded-xl border border-emerald-100">
                <span>✅ Stock available in warehouse (${item.currentStock - item.totalQty} surplus)</span>
              </div>
            `}
          </div>
        `;
      });
      html += '</div>';

      container.innerHTML = html;
    } catch (e) {
      console.error('Error loading stores rep orders matrix:', e);
      container.innerHTML = `<div class="p-4 text-xs text-red-500">Error loading orders matrix: ${e.message}</div>`;
    }
  },

  // 2. Warehouse Stock Management & Intake
  async loadWarehouseStock() {
    const container = document.getElementById('stores-warehouse-stock-list');
    if (!container) return;

    try {
      const rawProducts = await db.products.toArray();
      const products = filterByTenant(rawProducts);
      const term = (this.activeSearch || '').toLowerCase().trim();

      const filtered = products.filter(p => {
        if (p.isActive === false) return false;
        if (!term) return true;
        return (p.name || '').toLowerCase().includes(term) || (p.category || '').toLowerCase().includes(term);
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="text-center py-6 text-slate-400 text-xs font-bold">
            No products match search criteria.
          </div>
        `;
        return;
      }

      let html = '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
      filtered.forEach(p => {
        const stock = p.currentStock !== undefined ? Number(p.currentStock) : 0;
        const isLow = stock <= 10;

        html += `
          <div class="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 flex flex-col justify-between space-y-2.5">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h4 class="font-black text-xs sm:text-sm text-slate-900">${p.name}</h4>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">${p.unit || 'Card'}</span>
                  <span class="text-[10px] text-slate-400 font-semibold">${p.category || 'General'}</span>
                  ${p.packetsPerCard ? `<span class="text-[10px] text-amber-700 font-bold">(${p.packetsPerCard} pkts)</span>` : ''}
                </div>
              </div>
              <div class="text-right">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Available</span>
                <span class="text-lg font-black ${isLow ? 'text-red-600' : 'text-emerald-700'}">${stock}</span>
              </div>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
              <span class="text-[10px] ${isLow ? 'text-red-600 font-bold' : 'text-slate-400 font-semibold'}">
                ${isLow ? '⚠️ Low warehouse balance' : 'In Stock'}
              </span>
              <button onclick="Stores.openAddStockModal(${p.id})" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 flex items-center gap-1">
                <span>➕ Add Stock</span>
              </button>
            </div>
          </div>
        `;
      });
      html += '</div>';

      container.innerHTML = html;
    } catch (e) {
      console.error('Error loading warehouse stock:', e);
      container.innerHTML = `<div class="p-4 text-xs text-red-500">Error loading warehouse stock: ${e.message}</div>`;
    }
  },

  onStockSearch(term) {
    this.activeSearch = term;
    this.loadWarehouseStock();
  },

  // 3. Open Stock Intake Modal
  async openAddStockModal(productId = null) {
    const modal = document.getElementById('modal-add-stock');
    const selectEl = document.getElementById('stock-modal-product-select');
    const qtyInput = document.getElementById('stock-modal-qty');
    const noteInput = document.getElementById('stock-modal-note');
    const dateInput = document.getElementById('stock-modal-date');

    if (!modal) return;

    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    if (qtyInput) qtyInput.value = '';
    if (noteInput) noteInput.value = 'Production intake from factory';

    try {
      const rawProducts = await db.products.toArray();
      const products = filterByTenant(rawProducts);
      let html = '<option value="">-- Select Spice Card / Packet --</option>';
      products.filter(p => p.isActive !== false).forEach(p => {
        const isSel = (productId && p.id === Number(productId)) ? 'selected' : '';
        html += `<option value="${p.id}" ${isSel}>${p.name} (Current: ${p.currentStock || 0} ${p.unit || 'Card'})</option>`;
      });
      if (selectEl) selectEl.innerHTML = html;
    } catch (e) {
      console.error('Error filling product select:', e);
    }

    UI.openModal('modal-add-stock');
  },

  // 4. Save Stock Intake to Database
  async saveStockIntake() {
    const selectEl = document.getElementById('stock-modal-product-select');
    const qtyInput = document.getElementById('stock-modal-qty');
    const noteInput = document.getElementById('stock-modal-note');
    const dateInput = document.getElementById('stock-modal-date');

    const productId = Number(selectEl?.value);
    const qty = Number(qtyInput?.value);
    const note = noteInput?.value?.trim() || 'Factory intake';
    const date = dateInput?.value || new Date().toISOString().split('T')[0];

    if (!productId) {
      UI.showToast('Please select a spice product', 'warning');
      return;
    }
    if (!qty || qty <= 0) {
      UI.showToast('Please enter a valid stock quantity', 'warning');
      return;
    }

    try {
      const prod = await db.products.get(productId);
      if (!prod) {
        UI.showToast('Product not found', 'error');
        return;
      }

      const prevStock = Number(prod.currentStock) || 0;
      const newStock = prevStock + qty;
      const tenantId = (Auth.currentUser && Auth.currentUser.tenantId) ? Auth.currentUser.tenantId : (getActiveTenantId() || 1);

      // 1. Update product balance
      await db.products.update(productId, {
        currentStock: newStock,
        updatedAt: new Date().toISOString()
      });

      // 2. Record in Stock Ledger
      await db.stockLedger.add({
        tenantId: tenantId,
        productId: prod.id,
        productName: prod.name,
        type: 'production_intake',
        qty: qty,
        previousStock: prevStock,
        newStock: newStock,
        reference: `Intake-${Date.now().toString().slice(-4)}`,
        date: date,
        note: note
      });

      UI.closeModal('modal-add-stock');
      UI.showToast(`✅ Successfully added +${qty} ${prod.unit || 'Cards'} of ${prod.name}!`, 'success');

      this.loadWarehouseStock();
      this.loadRepOrdersSummary();
      this.loadStockLedgerHistory();
    } catch (e) {
      console.error('Error saving stock intake:', e);
      UI.showToast(`Error saving stock: ${e.message}`, 'error');
    }
  },

  // 5. Audit Returned Cards from Lorry Trips
  async loadLorryReturnsHistory() {
    const container = document.getElementById('stores-lorry-returns-container');
    if (!container) return;

    try {
      const rawTrips = await db.lorryTrips.where('status').equals('completed').reverse().limit(20).toArray();
      const trips = filterByTenant(rawTrips).slice(0, 10);

      if (trips.length === 0) {
        container.innerHTML = `
          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-slate-400 text-xs font-semibold">
            No completed lorry trips with returned stock yet today.
          </div>
        `;
        return;
      }

      const rawRoutes = await db.routes.toArray();
      const routes = filterByTenant(rawRoutes);
      const routeMap = {};
      routes.forEach(r => routeMap[r.id] = r.name);

      let html = '<div class="space-y-2.5">';
      trips.forEach(trip => {
        const returnedItems = trip.returnedItems || [];
        const totalReturned = returnedItems.reduce((sum, it) => sum + (Number(it.qtyReturned) || 0), 0);
        const routeName = routeMap[trip.routeId] || 'Assigned Route';

        html += `
          <div class="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-black text-xs text-slate-900">🚚 Trip #${trip.id} - ${routeName}</span>
                <div class="text-[10px] text-slate-400 font-semibold">Driver: ${trip.driverName || 'Driver'} • Ended: ${trip.completedAt ? trip.completedAt.slice(11, 16) : 'Evening'}</div>
              </div>
              <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black">
                +${totalReturned} Cards Returned
              </span>
            </div>

            <div class="bg-slate-50 rounded-xl p-2 text-[11px] space-y-1">
              ${returnedItems.map(item => `
                <div class="flex items-center justify-between text-slate-700">
                  <span>${item.productName}</span>
                  <span class="font-black text-emerald-700">+${item.qtyReturned} returned to stock</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });
      html += '</div>';

      container.innerHTML = html;
    } catch (e) {
      console.error('Error loading lorry returns in stores:', e);
      container.innerHTML = `<div class="p-2 text-xs text-red-500">${e.message}</div>`;
    }
  },

  // 6. Complete Stock Ledger Audit Trail
  async loadStockLedgerHistory() {
    const container = document.getElementById('stores-stock-ledger-container');
    if (!container) return;

    try {
      const rawLogs = await db.stockLedger.reverse().limit(50).toArray();
      const logs = filterByTenant(rawLogs).slice(0, 30);

      if (logs.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4 text-slate-400 text-xs font-semibold">
            No stock transactions recorded yet.
          </div>
        `;
        return;
      }

      let html = '<div class="space-y-1.5">';
      logs.forEach(log => {
        let badge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">+ Intake</span>';
        if (log.type === 'lorry_return') {
          badge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800">🚚 Lorry Return</span>';
        } else if (log.type === 'lorry_load') {
          badge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">📦 Lorry Dispatch</span>';
        } else if (log.type === 'adjustment') {
          badge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800">⚙️ Adjustment</span>';
        }

        html += `
          <div class="bg-white rounded-xl p-2.5 border border-slate-200 flex items-center justify-between text-xs">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                ${badge}
                <span class="font-black text-slate-800 truncate">${log.productName}</span>
              </div>
              <div class="text-[10px] text-slate-400 mt-0.5 truncate">${log.note || log.reference || 'Stock change'} • ${log.date}</div>
            </div>
            <div class="text-right flex-shrink-0">
              <span class="font-black text-xs ${log.qty > 0 ? 'text-emerald-700' : 'text-red-600'}">
                ${log.qty > 0 ? '+' : ''}${log.qty}
              </span>
              <div class="text-[10px] text-slate-400 font-semibold">Bal: ${log.newStock || '-'}</div>
            </div>
          </div>
        `;
      });
      html += '</div>';

      container.innerHTML = html;
    } catch (e) {
      console.error('Error loading stock ledger:', e);
      container.innerHTML = `<div class="p-2 text-xs text-red-500">${e.message}</div>`;
    }
  },

  _liveListenerInit: false,
  _lastPolledSaleId: 0,

  initLiveOrderListener() {
    if (this._liveListenerInit) return;
    this._liveListenerInit = true;

    const onIncomingOrder = (orderData) => {
      // Check if logged in user is stores role or admin, or current tab is stores
      const isStoreRole = Auth.currentUser && (
        Auth.currentUser.role === 'stores' || 
        Auth.currentUser.role === 'admin' || 
        Auth.currentUser.role === 'superadmin' ||
        Auth.currentUser.role === 'sm' ||
        Auth.currentUser.role === 'asm'
      );
      const isStoresTabActive = !document.getElementById('tab-stores')?.classList.contains('hidden');

      if (isStoreRole || isStoresTabActive) {
        // 1. Play ringing bell alert sound (Ding-Dong! Ding-Dong!)
        if (typeof SoundFX !== 'undefined') {
          SoundFX.play('order_alert');
        }

        // 2. Display loud visible toast notification
        const repText = orderData.repName ? `🚚 Rep: ${orderData.repName}` : '';
        const shopText = orderData.shopName ? `• 🏪 ${orderData.shopName}` : '';
        const amtText = orderData.totalAmount ? `• Rs. ${Number(orderData.totalAmount).toLocaleString()}` : '';
        UI.showToast(`🏬 🔔 NEW ORDER RECEIVED! #${orderData.invoiceNo || ''} ${repText} ${shopText} ${amtText}`, 'success');

        // 3. Refresh live packing orders matrix and rep bills
        this.loadRepOrdersSummary();
        if (typeof RepBills !== 'undefined' && RepBills.loadBills) {
          RepBills.loadBills();
        }
      }
    };

    // 1. BroadcastChannel (fast multi-tab listener)
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('mob_pos_order_channel');
        bc.onmessage = (event) => {
          if (event.data && event.data.type === 'NEW_ORDER_ALERT') {
            onIncomingOrder(event.data);
          }
        };
      }
    } catch (e) {}

    // 2. Storage Event (cross-tab listener)
    window.addEventListener('storage', (e) => {
      if (e.key === 'mob_pos_last_order_broadcast' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && parsed.type === 'NEW_ORDER_ALERT') {
            onIncomingOrder(parsed);
          }
        } catch (err) {}
      }
    });

    // 3. Dexie Sales Poller (detects newly added sales every 3.5s)
    const startPoller = async () => {
      try {
        const latest = await db.sales.orderBy('id').last();
        if (latest) {
          this._lastPolledSaleId = latest.id;
        }
      } catch (e) {}

      setInterval(async () => {
        try {
          const isStoreRole = Auth.currentUser && (
            Auth.currentUser.role === 'stores' || 
            Auth.currentUser.role === 'admin'
          );
          const isStoresTabActive = !document.getElementById('tab-stores')?.classList.contains('hidden');
          if (!isStoreRole && !isStoresTabActive) return;

          const latest = await db.sales.orderBy('id').last();
          if (latest && latest.id > this._lastPolledSaleId) {
            this._lastPolledSaleId = latest.id;
            onIncomingOrder({
              invoiceNo: latest.invoiceNo,
              repName: latest.repName,
              shopName: latest.shopName || '',
              totalAmount: latest.totalAmount,
              isBooking: latest.status === 'Pending'
            });
          }
        } catch (pollErr) {}
      }, 3500);
    };

    startPoller();
  },

  // =========================================================================
  // 7. Stores Keeper Staff Attendance & Leave Clocking (Sync with HR)
  // =========================================================================
  async initStaffAttendance() {
    const empSelect = document.getElementById('stores-att-emp-select');
    const dateInput = document.getElementById('stores-att-date');
    const timeInput = document.getElementById('stores-att-time');

    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (dateInput && !dateInput.value) dateInput.value = todayStr;
    if (timeInput && !timeInput.value) timeInput.value = timeStr;

    if (empSelect) {
      try {
        const rawEmps = await db.employees?.toArray() || [];
        const emps = filterByTenant(rawEmps).filter(e => e.status !== 'Inactive' && e.status !== 'Terminated');
        let html = '<option value="">-- සේවකයා තෝරන්න (Select Staff) --</option>';
        emps.forEach(emp => {
          html += `<option value="${emp.empNo}">${emp.fullName} (${emp.designation || emp.role || 'Staff'}) [${emp.empNo}]</option>`;
        });
        empSelect.innerHTML = html;
      } catch (err) {
        console.warn('Error loading employees for stores attendance:', err);
      }
    }

    await this.loadStaffAttendanceLogs();
  },

  onAttendanceTypeChange(val) {
    const notesInput = document.getElementById('stores-att-notes');
    if (!notesInput) return;
    if (val === 'LEAVE_FULL') {
      notesInput.placeholder = 'සම්පූර්ණ නිවාඩු හේතුව (e.g. අසනීප නිවාඩු / Sick leave, Personal...)';
    } else if (val === 'LEAVE_HALF') {
      notesInput.placeholder = 'වරු නිවාඩු හේතුව (e.g. උදෑසන / සවස වරු නිවාඩු, Doctor visit...)';
    } else if (val === 'IN') {
      notesInput.placeholder = 'e.g. Regular on-time, Morning shift...';
    } else if (val === 'OUT') {
      notesInput.placeholder = 'e.g. Duty completed, Evening checkout...';
    }
  },

  async submitStaffAttendance() {
    try {
      const empSelect = document.getElementById('stores-att-emp-select');
      const typeSelect = document.getElementById('stores-att-type-select');
      const dateInput = document.getElementById('stores-att-date');
      const timeInput = document.getElementById('stores-att-time');
      const notesInput = document.getElementById('stores-att-notes');

      const empNo = empSelect?.value;
      if (!empNo) {
        UI.showToast('කරුණාකර සේවකයෙකු තෝරන්න (Please select a staff member)', 'warning');
        return;
      }

      const rawEmps = await db.employees?.toArray() || [];
      const emp = filterByTenant(rawEmps).find(e => e.empNo === empNo);
      const empName = emp ? emp.fullName : empNo;
      const type = typeSelect?.value || 'IN';
      const date = dateInput?.value || new Date().toISOString().split('T')[0];
      const time = timeInput?.value || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const notes = notesInput?.value?.trim() || '';
      const tenantId = getActiveTenantId() || 1;

      if (type === 'IN') {
        const existing = await db.attendance?.where('date').equals(date).toArray() || [];
        const myAtt = filterByTenant(existing).find(a => a.empNo === empNo || a.employeeName === empName);
        if (myAtt) {
          await db.attendance.update(myAtt.id, {
            checkIn: time,
            status: 'Present',
            notes: notes || myAtt.notes,
            recordedBy: 'Stores Keeper',
            updatedAt: new Date().toISOString()
          });
        } else {
          await db.attendance.add({
            tenantId,
            empNo,
            employeeName: empName,
            date,
            checkIn: time,
            checkOut: '',
            status: 'Present',
            notes,
            recordedBy: 'Stores Keeper',
            createdAt: new Date().toISOString()
          });
        }
        UI.showToast(`✅ ${empName} - IN (${time}) පැමිණීම HR වෙත සටහන් විය!`, 'success');
      } else if (type === 'OUT') {
        const existing = await db.attendance?.where('date').equals(date).toArray() || [];
        const myAtt = filterByTenant(existing).find(a => a.empNo === empNo || a.employeeName === empName);
        if (myAtt) {
          await db.attendance.update(myAtt.id, {
            checkOut: time,
            status: 'Present',
            notes: notes ? (myAtt.notes ? myAtt.notes + ' | ' + notes : notes) : myAtt.notes,
            recordedBy: 'Stores Keeper',
            updatedAt: new Date().toISOString()
          });
        } else {
          await db.attendance.add({
            tenantId,
            empNo,
            employeeName: empName,
            date,
            checkIn: '--',
            checkOut: time,
            status: 'Present',
            notes,
            recordedBy: 'Stores Keeper',
            createdAt: new Date().toISOString()
          });
        }
        UI.showToast(`🔴 ${empName} - OUT (${time}) පිටවීම HR වෙත සටහන් විය!`, 'info');
      } else if (type === 'LEAVE_FULL' || type === 'LEAVE_HALF') {
        const isHalf = type === 'LEAVE_HALF';
        const leaveLabel = isHalf ? 'Half Day' : 'Full Day';

        await db.leaves?.add({
          tenantId,
          empNo,
          employeeName: empName,
          leaveType: isHalf ? 'Half-Day Leave' : 'Casual Leave',
          fromDate: date,
          toDate: date,
          days: isHalf ? 0.5 : 1,
          reason: notes || `${leaveLabel} logged by Stores Keeper`,
          status: 'Approved',
          recordedBy: 'Stores Keeper',
          createdAt: new Date().toISOString()
        });

        const existing = await db.attendance?.where('date').equals(date).toArray() || [];
        const myAtt = filterByTenant(existing).find(a => a.empNo === empNo || a.employeeName === empName);
        if (myAtt) {
          await db.attendance.update(myAtt.id, {
            status: isHalf ? 'Half Day' : 'On Leave',
            notes: notes || `${leaveLabel} (Stores)`,
            recordedBy: 'Stores Keeper',
            updatedAt: new Date().toISOString()
          });
        } else {
          await db.attendance.add({
            tenantId,
            empNo,
            employeeName: empName,
            date,
            checkIn: '--',
            checkOut: '--',
            status: isHalf ? 'Half Day' : 'On Leave',
            notes: notes || `${leaveLabel} (Stores)`,
            recordedBy: 'Stores Keeper',
            createdAt: new Date().toISOString()
          });
        }
        UI.showToast(`🟡 ${empName} - ${leaveLabel} නිවාඩු HR වෙත සටහන් විය!`, 'warning');
      }

      if (typeof SoundFX !== 'undefined') SoundFX.play('save');
      if (notesInput) notesInput.value = '';
      await this.loadStaffAttendanceLogs();
    } catch (err) {
      console.error('submitStaffAttendance error:', err);
      UI.showToast('පැමිණීම සටහන් කිරීමේ දෝෂයක්: ' + err.message, 'error');
    }
  },

  async quickAttendanceAction(empNo, actionType) {
    const todayStr = document.getElementById('stores-att-date')?.value || new Date().toISOString().split('T')[0];
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const nowTime = `${hours}:${minutes}`;
    const tenantId = getActiveTenantId() || 1;

    const rawEmps = await db.employees?.toArray() || [];
    const emp = filterByTenant(rawEmps).find(e => e.empNo === empNo);
    const empName = emp ? emp.fullName : empNo;

    const existing = await db.attendance?.where('date').equals(todayStr).toArray() || [];
    const myAtt = filterByTenant(existing).find(a => a.empNo === empNo || a.employeeName === empName);

    if (actionType === 'IN') {
      if (myAtt) {
        await db.attendance.update(myAtt.id, {
          checkIn: nowTime,
          status: 'Present',
          recordedBy: 'Stores Keeper',
          updatedAt: new Date().toISOString()
        });
      } else {
        await db.attendance.add({
          tenantId,
          empNo,
          employeeName: empName,
          date: todayStr,
          checkIn: nowTime,
          checkOut: '--',
          status: 'Present',
          recordedBy: 'Stores Keeper',
          createdAt: new Date().toISOString()
        });
      }
      if (typeof SoundFX !== 'undefined') SoundFX.play('beep');
      UI.showToast(`✅ ${empName} - IN (${nowTime}) පැමිණීම සටහන් විය!`, 'success');
    } else if (actionType === 'HALF_DAY') {
      if (myAtt) {
        await db.attendance.update(myAtt.id, {
          status: 'Half Day',
          checkIn: myAtt.checkIn && myAtt.checkIn !== '--' ? myAtt.checkIn : nowTime,
          recordedBy: 'Stores Keeper',
          updatedAt: new Date().toISOString()
        });
      } else {
        await db.attendance.add({
          tenantId,
          empNo,
          employeeName: empName,
          date: todayStr,
          checkIn: nowTime,
          checkOut: '--',
          status: 'Half Day',
          recordedBy: 'Stores Keeper',
          createdAt: new Date().toISOString()
        });
      }
      if (db.leaves) {
        await db.leaves.add({
          tenantId,
          empNo,
          employeeName: empName,
          leaveType: 'Half-Day Leave',
          fromDate: todayStr,
          toDate: todayStr,
          days: 0.5,
          reason: 'Half Day logged by Stores Keeper',
          status: 'Approved',
          recordedBy: 'Stores Keeper',
          createdAt: new Date().toISOString()
        });
      }
      if (typeof SoundFX !== 'undefined') SoundFX.play('save');
      UI.showToast(`🟡 ${empName} - Half Day (වරු නිවාඩු) සටහන් විය!`, 'warning');
    } else if (actionType === 'OUT') {
      if (myAtt) {
        await db.attendance.update(myAtt.id, {
          checkOut: nowTime,
          recordedBy: 'Stores Keeper',
          updatedAt: new Date().toISOString()
        });
      } else {
        await db.attendance.add({
          tenantId,
          empNo,
          employeeName: empName,
          date: todayStr,
          checkIn: '--',
          checkOut: nowTime,
          status: 'Present',
          recordedBy: 'Stores Keeper',
          createdAt: new Date().toISOString()
        });
      }
      if (typeof SoundFX !== 'undefined') SoundFX.play('beep');
      UI.showToast(`⏹️ ${empName} - OUT (${nowTime}) පිටවීම සටහන් විය!`, 'info');
    } else if (actionType === 'LEAVE') {
      if (myAtt) {
        await db.attendance.update(myAtt.id, {
          status: 'On Leave',
          checkIn: '--',
          checkOut: '--',
          recordedBy: 'Stores Keeper',
          updatedAt: new Date().toISOString()
        });
      } else {
        await db.attendance.add({
          tenantId,
          empNo,
          employeeName: empName,
          date: todayStr,
          checkIn: '--',
          checkOut: '--',
          status: 'On Leave',
          recordedBy: 'Stores Keeper',
          createdAt: new Date().toISOString()
        });
      }
      UI.showToast(`🟣 ${empName} - On Leave (නිවාඩු) සටහන් විය!`, 'info');
    }

    await this.loadStaffAttendanceLogs();
  },

  async loadStaffAttendanceLogs() {
    const container = document.getElementById('stores-att-today-log');
    if (!container) return;

    try {
      const todayStr = document.getElementById('stores-att-date')?.value || new Date().toISOString().split('T')[0];
      const rawAtt = await db.attendance?.where('date').equals(todayStr).toArray() || [];
      const atts = filterByTenant(rawAtt);

      const rawEmps = await db.employees?.toArray() || [];
      const emps = filterByTenant(rawEmps).filter(e => e.status !== 'Inactive' && e.status !== 'Terminated');

      let html = '';

      // 1. One-Tap Staff Roster Table for Quick Marking
      html += `
        <div class="space-y-2 mb-3">
          <div class="text-[11px] font-black uppercase text-teal-800 tracking-wider flex items-center justify-between">
            <span>⚡ ක්ෂණික පැමිණීම් ලකුණු කිරීම (One-Tap Attendance)</span>
            <span class="text-[10px] text-slate-500 font-mono">${todayStr}</span>
          </div>
          <div class="divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            ${emps.map(emp => {
              const myAtt = atts.find(a => a.empNo === emp.empNo || a.employeeName === emp.fullName);
              const status = myAtt ? (myAtt.status || 'Present') : 'Pending';
              let badgeColor = 'bg-slate-100 text-slate-600';
              if (status === 'Present') badgeColor = 'bg-emerald-100 text-emerald-800 font-black';
              else if (status === 'Half Day') badgeColor = 'bg-amber-100 text-amber-800 font-black';
              else if (status === 'On Leave' || status === 'Leave') badgeColor = 'bg-purple-100 text-purple-800 font-black';

              const inTime = myAtt?.checkIn && myAtt.checkIn !== '--' ? myAtt.checkIn : null;
              const outTime = myAtt?.checkOut && myAtt.checkOut !== '--' ? myAtt.checkOut : null;

              return `
                <div class="p-2 sm:p-2.5 flex items-center justify-between flex-wrap gap-1.5 hover:bg-slate-50 transition-colors">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-slate-900 text-xs">${emp.fullName}</span>
                      <span class="px-2 py-0.5 rounded-full text-[9px] ${badgeColor}">${status}</span>
                    </div>
                    <div class="text-[10px] text-slate-400 font-mono">
                      IN: <strong class="text-emerald-700">${inTime || '--:--'}</strong> · OUT: <strong class="text-rose-700">${outTime || '--:--'}</strong>
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <button onclick="Stores.quickAttendanceAction('${emp.empNo}', 'IN')" class="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-2xs active:scale-95 cursor-pointer" title="Record Morning Check-In with current time">
                      🟢 IN
                    </button>
                    <button onclick="Stores.quickAttendanceAction('${emp.empNo}', 'HALF_DAY')" class="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] shadow-2xs active:scale-95 cursor-pointer" title="Mark Half Day">
                      🟡 Half Day
                    </button>
                    <button onclick="Stores.quickAttendanceAction('${emp.empNo}', 'OUT')" class="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] shadow-2xs active:scale-95 cursor-pointer" title="Record Evening Check-Out with current time">
                      ⏹️ End
                    </button>
                    <button onclick="Stores.quickAttendanceAction('${emp.empNo}', 'LEAVE')" class="px-1.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-[10px] cursor-pointer" title="Mark Leave">
                      🟣 Leave
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      if (atts.length > 0) {
        html += `
          <div class="space-y-1.5 pt-2">
            <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider block">දවසේ සටහන් වූ ලඝු-ලේඛන (Logged Records)</span>
            ${atts.map(a => {
              let badgeColor = 'bg-emerald-100 text-emerald-800';
              if (a.status === 'On Leave') badgeColor = 'bg-amber-100 text-amber-800';
              else if (a.status === 'Half Day') badgeColor = 'bg-orange-100 text-orange-800';

              return `
                <div class="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs hover:border-teal-300 transition-colors">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-black text-slate-800">${a.employeeName}</span>
                      <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${badgeColor}">${a.status || 'Present'}</span>
                    </div>
                    <div class="text-[10px] text-slate-500 mt-0.5">
                      IN: <strong>${a.checkIn || '--'}</strong> · OUT: <strong>${a.checkOut || '--'}</strong>
                      ${a.notes ? ` · <span class="italic text-slate-600">${a.notes}</span>` : ''}
                    </div>
                  </div>
                  <div class="text-right flex items-center gap-2">
                    <span class="text-[9px] text-slate-400 font-mono">By: ${a.recordedBy || 'Stores'}</span>
                    <button onclick="Stores.deleteAttendanceLog(${a.id})" class="text-rose-500 hover:text-rose-700 font-bold text-xs cursor-pointer" title="Delete">🗑️</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      container.innerHTML = html;
    } catch (e) {
      console.warn('loadStaffAttendanceLogs error:', e);
    }
  },


    async deleteAttendanceLog(id) {
    if (!confirm('මෙම පැමිණීම් සටහන ඉවත් කිරීමට අවශ්‍යද? (Remove this attendance record?)')) return;
    try {
      await db.attendance?.delete(id);
      UI.showToast('පැමිණීම් සටහන ඉවත් කරන ලදී.', 'info');
      await this.loadStaffAttendanceLogs();
    } catch (e) {
      UI.showToast('දෝෂයක්: ' + e.message, 'error');
    }
  }
};

window.Stores = Stores;
