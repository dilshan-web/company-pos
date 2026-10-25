/**
 * Delivery Driver Lorry Loading & Unloading Module
 * Allows Delivery Drivers & Stores Keepers to:
 * 1. Morning Lorry Loading: Record spice cards loaded into the vehicle before dispatch (with auto-fill from rep orders).
 * 2. Real-time Trip Tracking: Live compare loaded cards vs delivered cards on route.
 * 3. Evening Lorry Unloading: Count returned leftover cards at day-end, complete the trip,
 *    and automatically transfer the remaining stock back to Production Stores inventory!
 */

const Lorry = {
  activeTrip: null,
  activeRouteId: null,

  async init() {
    await this.loadActiveTrip();
    await this.loadRecentTrips();
  },

  // 1. Load Current Active Trip on Route
  async loadActiveTrip() {
    const statusContainer = document.getElementById('lorry-active-status-card');
    const actionContainer = document.getElementById('lorry-main-action-buttons');
    if (!statusContainer) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      // Find any ongoing loaded trip filtered by tenant
      const rawActiveTrips = await db.lorryTrips.where('status').equals('loaded').toArray();
      const activeTrips = filterByTenant(rawActiveTrips);
      this.activeTrip = activeTrips.length > 0 ? activeTrips[0] : null;

      if (!this.activeTrip) {
        // No active trip: Show Morning Load CTA
        statusContainer.innerHTML = `
          <div class="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 border border-slate-700 space-y-3 shadow-xl">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-2xl">🚚</span>
                <div>
                  <h3 class="font-black text-sm text-white">Lorry Status: Ready to Load (පැටවීමට සූදානම්)</h3>
                  <p class="text-[10px] text-slate-400">No active lorry trip currently on route today</p>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Idle / Warehouse
              </span>
            </div>

            <div class="pt-2">
              <button onclick="Lorry.openMorningLoadModal()" class="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs sm:text-sm py-3.5 rounded-2xl shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all">
                <span>☀️ Step 1: Morning Lorry Loading (උදෑසන ලොරිය පැටවීම)</span>
              </button>
            </div>
          </div>
        `;
        return;
      }

      // Active trip exists: Calculate delivered items live
      const trip = this.activeTrip;
      const rawRoutes = await db.routes.toArray();
      const routes = filterByTenant(rawRoutes);
      const route = routes.find(r => r.id === trip.routeId) || { name: 'Assigned Route' };

      // Calculate delivered invoices for this trip
      const rawDeliveredSales = await db.sales
        .where('routeId')
        .equals(trip.routeId)
        .filter(s => s.status === 'Delivered' && (s.deliveryDate === trip.date || s.date === trip.date))
        .toArray();
      const deliveredSales = filterByTenant(rawDeliveredSales);

      const deliveredSaleIds = deliveredSales.map(s => s.id);
      let deliveredSaleItems = [];
      if (deliveredSaleIds.length > 0) {
        deliveredSaleItems = await db.saleItems.where('saleId').anyOf(deliveredSaleIds).toArray();
      }

      // Map delivered quantities by productId
      const deliveredMap = {};
      deliveredSaleItems.forEach(item => {
        const totalDelivered = (Number(item.qty) || 0) + (Number(item.freeQty) || 0);
        deliveredMap[item.productId] = (deliveredMap[item.productId] || 0) + totalDelivered;
      });

      const loadedItems = trip.loadedItems || [];
      const totalLoadedCards = loadedItems.reduce((sum, it) => sum + (Number(it.qtyLoaded) || 0), 0);
      let totalDeliveredCards = 0;

      let itemsHtml = '';
      loadedItems.forEach(item => {
        const delQty = deliveredMap[item.productId] || 0;
        totalDeliveredCards += delQty;
        const remainingExpected = Math.max(0, (Number(item.qtyLoaded) || 0) - delQty);

        itemsHtml += `
          <div class="bg-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs border border-slate-700/60">
            <div class="min-w-0 flex-1">
              <span class="font-black text-white block truncate">${item.productName}</span>
              <span class="text-[10px] text-slate-400">Loaded: ${item.qtyLoaded} | Delivered: ${delQty}</span>
            </div>
            <div class="text-right">
              <span class="text-[10px] text-slate-400 font-bold block">In Lorry</span>
              <span class="font-black text-emerald-400 text-sm">${remainingExpected} Cards</span>
            </div>
          </div>
        `;
      });

      statusContainer.innerHTML = `
        <div class="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-5 border border-emerald-500/40 space-y-3.5 shadow-2xl">
          <div class="flex items-center justify-between pb-2 border-b border-slate-700/80">
            <div class="flex items-center gap-2">
              <span class="text-2xl animate-pulse">🚚</span>
              <div>
                <h3 class="font-black text-sm text-emerald-300">Active Lorry Trip #${trip.id} (මාර්ගයේ ඇත)</h3>
                <p class="text-[10px] text-slate-300 font-medium">Route: <strong class="text-white">${route.name}</strong> • Loaded: ${trip.startedAt ? trip.startedAt.slice(11, 16) : 'Morning'}</p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              ● ON ROUTE
            </span>
          </div>

          <!-- Trip Overview Stats -->
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-slate-800/90 p-2.5 rounded-2xl border border-slate-700">
              <span class="text-[9px] uppercase font-bold text-slate-400 block">Total Loaded</span>
              <span class="text-sm sm:text-base font-black text-amber-400">${totalLoadedCards} Cards</span>
            </div>
            <div class="bg-slate-800/90 p-2.5 rounded-2xl border border-slate-700">
              <span class="text-[9px] uppercase font-bold text-slate-400 block">Delivered</span>
              <span class="text-sm sm:text-base font-black text-sky-400">${totalDeliveredCards} Cards</span>
            </div>
            <div class="bg-emerald-950/60 p-2.5 rounded-2xl border border-emerald-600/50">
              <span class="text-[9px] uppercase font-bold text-emerald-300 block">Remaining</span>
              <span class="text-sm sm:text-base font-black text-emerald-300">${Math.max(0, totalLoadedCards - totalDeliveredCards)} Cards</span>
            </div>
          </div>

          <!-- Loaded Items Breakdown -->
          <div class="space-y-1.5 pt-1">
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Lorry Inventory Manifest:</span>
            <div class="space-y-1 max-h-48 overflow-y-auto pr-1">
              ${itemsHtml}
            </div>
          </div>

          <!-- Evening Unload CTA Button -->
          <div class="pt-2 border-t border-slate-700/80">
            <button onclick="Lorry.openEveningUnloadModal(${trip.id})" class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs sm:text-sm py-3.5 rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all">
              <span>🌙 Step 2: Evening Lorry Unloading & Return to Stores (ඉතුරු තොග බෑම)</span>
            </button>
          </div>
        </div>
      `;
    } catch (e) {
      console.error('Error loading active lorry trip status:', e);
      statusContainer.innerHTML = `<div class="p-3 text-xs text-red-500">Error: ${e.message}</div>`;
    }
  },

  // 2. Open Morning Lorry Loading Modal
  async openMorningLoadModal() {
    const routeSelect = document.getElementById('lorry-load-route-select');
    const dateInput = document.getElementById('lorry-load-date');
    const vehicleInput = document.getElementById('lorry-load-vehicle');
    const itemsContainer = document.getElementById('lorry-load-items-container');

    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    if (vehicleInput) vehicleInput.value = 'Lorry 01';

    try {
      const rawRoutes = await db.routes.toArray();
      const routes = filterByTenant(rawRoutes);
      let routeHtml = '<option value="">-- Select Target Delivery Route --</option>';
      routes.forEach(r => {
        routeHtml += `<option value="${r.id}">${r.name}</option>`;
      });
      if (routeSelect) {
        routeSelect.innerHTML = routeHtml;
        routeSelect.onchange = () => this.autoFillFromRouteOrders();
      }

      const rawProducts = await db.products.toArray();
      const products = filterByTenant(rawProducts);
      let itemsHtml = '';
      products.filter(p => p.isActive !== false).forEach(p => {
        itemsHtml += `
          <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
            <div class="min-w-0 flex-1">
              <span class="font-black text-slate-800 block truncate">${p.name}</span>
              <span class="text-[10px] text-slate-400 font-semibold">Wh. Stock: ${p.currentStock || 0} ${p.unit || 'Cards'}</span>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <input type="number" min="0" data-product-id="${p.id}" data-product-name="${p.name}" placeholder="0" class="lorry-load-qty-input w-20 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-right font-black text-xs text-emerald-800 focus:bg-white" />
              <span class="text-[10px] font-bold text-slate-400">Cards</span>
            </div>
          </div>
        `;
      });
      if (itemsContainer) itemsContainer.innerHTML = itemsHtml;

      UI.openModal('modal-lorry-load');
    } catch (e) {
      console.error('Error opening morning load modal:', e);
    }
  },

  // Auto-fill loading inputs based on today's booked orders for the selected route
  async autoFillFromRouteOrders() {
    const routeSelect = document.getElementById('lorry-load-route-select');
    const dateInput = document.getElementById('lorry-load-date');
    const routeId = Number(routeSelect?.value);
    const dateStr = dateInput?.value || new Date().toISOString().split('T')[0];

    if (!routeId) return;

    try {
      const rawSales = await db.sales
        .where('routeId')
        .equals(routeId)
        .filter(s => s.status !== 'Cancelled' && (s.deliveryDate === dateStr || s.date === dateStr))
        .toArray();
      const sales = filterByTenant(rawSales);

      const saleIds = sales.map(s => s.id);
      let saleItems = [];
      if (saleIds.length > 0) {
        saleItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
      }

      // Aggregate required quantity by productId
      const reqMap = {};
      saleItems.forEach(item => {
        const total = (Number(item.qty) || 0) + (Number(item.freeQty) || 0);
        reqMap[item.productId] = (reqMap[item.productId] || 0) + total;
      });

      // Fill in the input values
      document.querySelectorAll('.lorry-load-qty-input').forEach(input => {
        const prodId = Number(input.getAttribute('data-product-id'));
        if (reqMap[prodId] !== undefined) {
          input.value = reqMap[prodId];
          input.classList.add('bg-emerald-50', 'border-emerald-500');
        } else {
          input.value = '';
          input.classList.remove('bg-emerald-50', 'border-emerald-500');
        }
      });

      UI.showToast(`✨ Auto-filled ${sales.length} orders for this route!`, 'info');
    } catch (e) {
      console.error('Error auto-filling lorry load quantities:', e);
    }
  },

  // 3. Submit Morning Lorry Load
  async submitMorningLoad() {
    const routeSelect = document.getElementById('lorry-load-route-select');
    const dateInput = document.getElementById('lorry-load-date');
    const vehicleInput = document.getElementById('lorry-load-vehicle');

    const routeId = Number(routeSelect?.value);
    const date = dateInput?.value || new Date().toISOString().split('T')[0];
    const vehicleNo = vehicleInput?.value?.trim() || 'Lorry 01';

    if (!routeId) {
      UI.showToast('Please select a delivery route', 'warning');
      return;
    }

    const loadedItems = [];
    document.querySelectorAll('.lorry-load-qty-input').forEach(input => {
      const prodId = Number(input.getAttribute('data-product-id'));
      const prodName = input.getAttribute('data-product-name');
      const qty = Number(input.value) || 0;
      if (qty > 0) {
        loadedItems.push({
          productId: prodId,
          productName: prodName,
          qtyLoaded: qty
        });
      }
    });

    if (loadedItems.length === 0) {
      UI.showToast('Please enter loaded quantity for at least one spice product', 'warning');
      return;
    }

    try {
      const driver = Auth.currentUser || { id: 6, fullName: 'Delivery Driver' };
      const tenantId = (Auth.currentUser && Auth.currentUser.tenantId) ? Auth.currentUser.tenantId : (getActiveTenantId() || 1);

      // 1. Create active trip in DB
      const tripId = await db.lorryTrips.add({
        tenantId: tenantId,
        date: date,
        routeId: routeId,
        driverId: driver.id,
        driverName: driver.fullName || driver.username,
        vehicleNo: vehicleNo,
        status: 'loaded',
        loadedItems: loadedItems,
        startedAt: new Date().toISOString(),
        completedAt: null,
        returnedItems: []
      });

      // 2. Deduct from warehouse stock & record in stock ledger
      for (const item of loadedItems) {
        const prod = await db.products.get(item.productId);
        if (prod) {
          const prevStock = Number(prod.currentStock) || 0;
          const newStock = Math.max(0, prevStock - item.qtyLoaded);

          await db.products.update(item.productId, {
            currentStock: newStock,
            updatedAt: new Date().toISOString()
          });

          await db.stockLedger.add({
            tenantId: tenantId,
            productId: item.productId,
            productName: item.productName,
            type: 'lorry_load',
            qty: -item.qtyLoaded,
            previousStock: prevStock,
            newStock: newStock,
            reference: `Trip #${tripId} Dispatch`,
            date: date,
            note: `Loaded into ${vehicleNo} for route dispatch`
          });
        }
      }

      UI.closeModal('modal-lorry-load');
      UI.showToast('🚚 Morning Lorry Loaded successfully! Have a safe route trip.', 'success');

      await this.init();
      if (typeof Stores !== 'undefined' && Stores.init) {
        Stores.init();
      }
    } catch (e) {
      console.error('Error submitting morning lorry load:', e);
      UI.showToast(`Error: ${e.message}`, 'error');
    }
  },

  // 4. Open Evening Lorry Unload Modal
  async openEveningUnloadModal(tripId) {
    try {
      const trip = await db.lorryTrips.get(Number(tripId));
      if (!trip) {
        UI.showToast('Trip record not found', 'error');
        return;
      }

      const modalTripId = document.getElementById('lorry-unload-trip-id');
      if (modalTripId) modalTripId.value = trip.id;

      // Calculate delivered quantities on route today
      const rawDeliveredSales = await db.sales
        .where('routeId')
        .equals(trip.routeId)
        .filter(s => s.status === 'Delivered' && (s.deliveryDate === trip.date || s.date === trip.date))
        .toArray();
      const deliveredSales = filterByTenant(rawDeliveredSales);

      const deliveredSaleIds = deliveredSales.map(s => s.id);
      let deliveredSaleItems = [];
      if (deliveredSaleIds.length > 0) {
        deliveredSaleItems = await db.saleItems.where('saleId').anyOf(deliveredSaleIds).toArray();
      }

      const deliveredMap = {};
      deliveredSaleItems.forEach(item => {
        const totalDelivered = (Number(item.qty) || 0) + (Number(item.freeQty) || 0);
        deliveredMap[item.productId] = (deliveredMap[item.productId] || 0) + totalDelivered;
      });

      const container = document.getElementById('lorry-unload-items-container');
      if (!container) return;

      let html = '';
      (trip.loadedItems || []).forEach(item => {
        const delQty = deliveredMap[item.productId] || 0;
        const expectedReturn = Math.max(0, (Number(item.qtyLoaded) || 0) - delQty);

        html += `
          <div class="bg-white p-3 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-black text-slate-900 block">${item.productName}</span>
                <span class="text-[10px] text-slate-400">Loaded: ${item.qtyLoaded} | Delivered on Bills: ${delQty}</span>
              </div>
              <div class="text-right">
                <span class="text-[10px] text-slate-400 font-bold block">Expected Return</span>
                <span class="font-black text-amber-700">${expectedReturn} Cards</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <div>
                <label class="text-[10px] font-bold text-slate-600 block mb-0.5">Actual Returned Cards *</label>
                <input type="number" min="0" value="${expectedReturn}" data-product-id="${item.productId}" data-product-name="${item.productName}" class="lorry-unload-return-input w-full bg-slate-50 border border-emerald-400 rounded-xl px-2.5 py-1.5 font-black text-xs text-emerald-800 focus:bg-white" />
              </div>
              <div>
                <label class="text-[10px] font-bold text-slate-600 block mb-0.5">Damaged / Expired</label>
                <input type="number" min="0" value="0" data-product-id="${item.productId}" class="lorry-unload-damage-input w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold text-xs text-red-600" />
              </div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      UI.openModal('modal-lorry-unload');
    } catch (e) {
      console.error('Error opening evening unload modal:', e);
      UI.showToast(`Error: ${e.message}`, 'error');
    }
  },

  // 5. Submit Evening Lorry Unload & Return Stock to Stores
  async submitEveningUnload() {
    const tripIdInput = document.getElementById('lorry-unload-trip-id');
    const tripId = Number(tripIdInput?.value);

    if (!tripId) {
      UI.showToast('Invalid trip ID', 'error');
      return;
    }

    try {
      const trip = await db.lorryTrips.get(tripId);
      if (!trip) {
        UI.showToast('Trip not found', 'error');
        return;
      }

      const returnedItems = [];
      const returnInputs = document.querySelectorAll('.lorry-unload-return-input');
      const damageInputs = document.querySelectorAll('.lorry-unload-damage-input');

      returnInputs.forEach((input, index) => {
        const prodId = Number(input.getAttribute('data-product-id'));
        const prodName = input.getAttribute('data-product-name');
        const qtyReturned = Number(input.value) || 0;
        const dmgQty = Number(damageInputs[index]?.value) || 0;

        returnedItems.push({
          productId: prodId,
          productName: prodName,
          qtyReturned: qtyReturned,
          damageQty: dmgQty
        });
      });

      // 1. Update Lorry Trip record to completed
      await db.lorryTrips.update(tripId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        returnedItems: returnedItems
      });

      const tenantId = (Auth.currentUser && Auth.currentUser.tenantId) ? Auth.currentUser.tenantId : (getActiveTenantId() || 1);

      // 2. Return remaining cards back to Production Stores Warehouse Inventory
      for (const item of returnedItems) {
        if (item.qtyReturned > 0) {
          const prod = await db.products.get(item.productId);
          if (prod) {
            const prevStock = Number(prod.currentStock) || 0;
            const newStock = prevStock + item.qtyReturned;

            await db.products.update(item.productId, {
              currentStock: newStock,
              updatedAt: new Date().toISOString()
            });

            await db.stockLedger.add({
              tenantId: tenantId,
              productId: item.productId,
              productName: item.productName,
              type: 'lorry_return',
              qty: item.qtyReturned,
              previousStock: prevStock,
              newStock: newStock,
              reference: `Lorry Return #${trip.id}`,
              date: new Date().toISOString().split('T')[0],
              note: `Returned from evening unloading (${trip.vehicleNo || 'Lorry'})`
            });
          }
        }
      }

      UI.closeModal('modal-lorry-unload');
      const totalReturned = returnedItems.reduce((s, it) => s + it.qtyReturned, 0);
      UI.showToast(`✅ Trip #${trip.id} completed! +${totalReturned} cards safely returned to Production Stores.`, 'success');

      await this.init();
      if (typeof Stores !== 'undefined' && Stores.init) {
        Stores.init();
      }
    } catch (e) {
      console.error('Error submitting evening unload:', e);
      UI.showToast(`Error: ${e.message}`, 'error');
    }
  },

  // 6. Load Completed Lorry Trips History
  async loadRecentTrips() {
    const container = document.getElementById('lorry-recent-trips-container');
    if (!container) return;

    try {
      const rawTrips = await db.lorryTrips.reverse().limit(20).toArray();
      const trips = filterByTenant(rawTrips).slice(0, 10);

      if (trips.length === 0) {
        container.innerHTML = `
          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-slate-400 text-xs font-semibold">
            No lorry trips logged yet.
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
        const isCompleted = trip.status === 'completed';
        const routeName = routeMap[trip.routeId] || 'Assigned Route';
        const totalLoaded = (trip.loadedItems || []).reduce((s, it) => s + (Number(it.qtyLoaded) || 0), 0);
        const totalReturned = (trip.returnedItems || []).reduce((s, it) => s + (Number(it.qtyReturned) || 0), 0);

        html += `
          <div class="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs space-y-2">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-black text-xs text-slate-900">Trip #${trip.id} • ${routeName}</span>
                <div class="text-[10px] text-slate-400 font-semibold">${trip.date} • Vehicle: ${trip.vehicleNo || 'Lorry'} • Driver: ${trip.driverName || 'Driver'}</div>
              </div>
              <span class="px-2.5 py-1 rounded-xl text-[10px] font-black ${isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                ${isCompleted ? '✅ COMPLETED' : '🚚 ACTIVE ON ROUTE'}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-xl text-center text-xs">
              <div>
                <span class="text-[9px] text-slate-400 font-bold block">Loaded Morning</span>
                <span class="font-black text-slate-800">${totalLoaded} Cards</span>
              </div>
              <div>
                <span class="text-[9px] text-emerald-600 font-bold block">Returned Evening</span>
                <span class="font-black text-emerald-700">${isCompleted ? `+${totalReturned} Cards` : 'Pending'}</span>
              </div>
            </div>
          </div>
        `;
      });
      html += '</div>';

      container.innerHTML = html;
    } catch (e) {
      console.error('Error loading recent trips:', e);
    }
  }
};

window.Lorry = Lorry;
