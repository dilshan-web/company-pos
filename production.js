/**
 * Daily Orders, Packing Matrix & Delivery Dispatch Module
 */

const Production = {
  selectedDate: new Date().toISOString().split('T')[0],
  selectedRouteId: 'all',
  activeViewSubtab: 'packing', // 'packing' | 'dispatch'
  currentEditingOrder: null,

  setPresetDate(preset) {
    const now = new Date();
    if (preset === 'today') {
      this.selectedDate = now.toISOString().split('T')[0];
    } else if (preset === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      this.selectedDate = tomorrow.toISOString().split('T')[0];
    } else if (preset === 'all_pending') {
      this.selectedDate = 'all';
    }
    const dateInput = document.getElementById('prod-date-filter');
    if (dateInput) {
      dateInput.value = this.selectedDate === 'all' ? '' : this.selectedDate;
    }
    this.loadMatrix();
  },

  async loadMatrix() {
    try {
      await this.populateRouteFilter();
      
      const isStores = Auth.currentUser?.role === 'stores';
      if (isStores) {
        this.activeViewSubtab = 'packing';
        const btnPacking = document.getElementById('prod-subtab-packing');
        const btnDispatch = document.getElementById('prod-subtab-dispatch');
        if (btnPacking) {
          btnPacking.classList.add('bg-emerald-600', 'text-white');
          btnPacking.classList.remove('bg-slate-100', 'text-slate-700');
        }
        if (btnDispatch) {
          btnDispatch.style.display = 'none';
        }
      }

      const dateInput = document.getElementById('prod-date-filter');
      if (dateInput) {
        if (this.selectedDate === 'all') {
          dateInput.value = '';
        } else if (!dateInput.value) {
          dateInput.value = this.selectedDate;
        } else {
          this.selectedDate = dateInput.value;
        }
      }

      // Fetch all orders matching deliveryDate and route filtered by tenant
      let rawOrders = await db.sales
        .filter(s => {
          if (s.status === 'Cancelled') return false;

          const isAllPending = this.selectedDate === 'all';
          const matchDate = isAllPending
            ? (s.status === 'Pending' || !s.status)
            : ((s.deliveryDate === this.selectedDate) || (!s.deliveryDate && s.date && s.date.startsWith(this.selectedDate)));
          const matchRoute = this.selectedRouteId === 'all' || s.routeId === Number(this.selectedRouteId);
          return matchDate && matchRoute;
        })
        .toArray();
      let orders = filterByTenant(rawOrders);

      // Separate by status
      const pendingOrders = orders.filter(s => s.status === 'Pending' || !s.status);
      const deliveredOrders = orders.filter(s => s.status === 'Delivered');
      const cancelledOrders = orders.filter(s => s.status === 'Cancelled');

      // Update KPIs
      const pendingSaleIds = pendingOrders.map(s => s.id);
      let pendingSaleItems = [];
      if (pendingSaleIds.length > 0) {
        pendingSaleItems = await db.saleItems.where('saleId').anyOf(pendingSaleIds).toArray();
      }

      // Aggregate packing quantities (including free issue bonus quantities)
      const matrix = {};
      let totalCardUnits = 0;
      let totalPacketUnits = 0;

      for (const item of pendingSaleItems) {
        const key = item.productId || item.productName;
        if (!matrix[key]) {
          matrix[key] = {
            productName: item.productName,
            unit: item.unit || 'Card',
            totalQty: 0
          };
        }
        const itemTotal = (Number(item.qty) || 0) + (Number(item.freeQty) || 0);
        matrix[key].totalQty += itemTotal;
        if (item.unit === 'Card') totalCardUnits += itemTotal;
        if (item.unit === 'Packet') totalPacketUnits += itemTotal;
      }

      // Update DOM Badges
      const totalBillsEl = document.getElementById('prod-matrix-bills');
      const totalCardsEl = document.getElementById('prod-matrix-cards');
      const totalPacketsEl = document.getElementById('prod-matrix-packets');

      if (totalBillsEl) totalBillsEl.textContent = `${pendingOrders.length} Pending (${deliveredOrders.length} Done)`;
      if (totalCardsEl) totalCardsEl.textContent = totalCardUnits;
      if (totalPacketsEl) totalPacketsEl.textContent = totalPacketUnits;

      // Render Packing Checklist or Dispatch Run
      if (this.activeViewSubtab === 'packing' || isStores) {
        this.renderPackingMatrix(Object.values(matrix), pendingOrders.length);
      } else {
        await this.renderDeliveryDispatchList(orders);
      }
    } catch (err) {
      console.error('Error loading daily orders matrix:', err);
    }
  },

  switchSubtab(subtab) {
    const isStores = Auth.currentUser?.role === 'stores';
    if (isStores) {
      subtab = 'packing';
    }

    this.activeViewSubtab = subtab;
    const btnPacking = document.getElementById('prod-subtab-packing');
    const btnDispatch = document.getElementById('prod-subtab-dispatch');

    if (subtab === 'packing') {
      btnPacking?.classList.add('bg-emerald-600', 'text-white');
      btnPacking?.classList.remove('bg-slate-100', 'text-slate-700');
      btnDispatch?.classList.remove('bg-emerald-600', 'text-white');
      btnDispatch?.classList.add('bg-slate-100', 'text-slate-700');
    } else {
      btnDispatch?.classList.add('bg-emerald-600', 'text-white');
      btnDispatch?.classList.remove('bg-slate-100', 'text-slate-700');
      btnPacking?.classList.remove('bg-emerald-600', 'text-white');
      btnPacking?.classList.add('bg-slate-100', 'text-slate-700');
    }

    this.loadMatrix();
  },

  renderPackingMatrix(matrixEntries, pendingCount) {
    const container = document.getElementById('prod-matrix-items-container');
    if (!container) return;

    if (matrixEntries.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 bg-white rounded-3xl border border-slate-100 p-6 col-span-full shadow-sm">
          <div class="text-4xl mb-2">📦</div>
          <h3 class="font-extrabold text-slate-800 text-sm">No Pending Orders for Packing</h3>
          <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            All orders for ${UI.formatDate(this.selectedDate)} have either been delivered or no orders were booked.
          </p>
          <button onclick="UI.switchTab('pos')" class="mt-4 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-2xl shadow-md shadow-emerald-600/30">
            + Book New Order
          </button>
        </div>
      `;
      return;
    }

    let html = `
      <div class="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-xs text-emerald-800 font-bold mb-3 flex items-center justify-between">
        <span>Van Load Manifest (${pendingCount} Shops To Visit)</span>
        <span>${matrixEntries.length} Unique Spice Items</span>
      </div>
      <div class="space-y-2">
    `;

    for (const item of matrixEntries) {
      html += `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-emerald-300 transition-all">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xl border border-emerald-100">
              ${item.unit === 'Card' ? '🎴' : '📦'}
            </div>
            <div>
              <span class="px-2 py-0.5 text-[10px] font-black bg-slate-100 text-slate-700 rounded-md">
                ${item.unit}
              </span>
              <h4 class="font-bold text-slate-900 text-xs sm:text-sm mt-1">${item.productName}</h4>
            </div>
          </div>

          <div class="text-right">
            <div class="text-2xl font-black text-emerald-700 font-mono">${item.totalQty}</div>
            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${item.unit}s To Pack</span>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  },

  async renderDeliveryDispatchList(orders) {
    const container = document.getElementById('prod-matrix-items-container');
    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs bg-white rounded-3xl p-6">No delivery orders on this date.</div>`;
      return;
    }

    let html = '<div class="space-y-3">';
    for (const order of orders) {
      const shop = await db.shops.get(order.shopId);
      const items = await db.saleItems.where('saleId').equals(order.id).toArray();
      const status = order.status || 'Pending';

      const statusBadge = {
        'Pending': 'bg-amber-100 text-amber-800 border-amber-300',
        'Delivered': 'bg-emerald-100 text-emerald-800 border-emerald-300',
        'Cancelled': 'bg-red-100 text-red-800 border-red-300'
      }[status];

      let itemsSummary = items.map(i => `${i.qty} ${i.unit} ${i.productName}`).join(', ');

      html += `
        <div class="bg-white p-4 rounded-3xl border ${shop && shop.isOpen === false ? 'border-red-300 bg-red-50/30' : 'border-slate-200'} shadow-sm space-y-2.5 transition-all">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[10px] font-black px-2 py-0.5 rounded-full border ${statusBadge}">${status.toUpperCase()}</span>
                <span class="text-xs text-slate-400">#${order.invoiceNo}</span>
                ${shop && shop.isOpen === false ? `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">🔴 CLOSED</span>` : ''}
              </div>
              <h4 class="font-black text-slate-900 text-sm mt-1">${shop ? shop.name : 'Unknown Shop'}</h4>
              <p class="text-[11px] text-slate-500">👤 ${shop?.ownerName || '-'} ${shop?.phone ? `• 📞 <a href="tel:${shop.phone}" class="underline text-green-700 font-bold">${shop.phone}</a>` : ''}</p>
            </div>
            <div class="text-right">
              <div class="text-sm font-black text-slate-900">${UI.formatCurrency(order.totalAmount)}</div>
              ${order.cancelReason ? `<span class="text-[10px] text-red-600 block mt-0.5">Reason: ${order.cancelReason}</span>` : ''}
            </div>
          </div>

          <!-- Items Ordered preview -->
          <div class="bg-slate-50 p-2.5 rounded-2xl text-xs text-slate-700 font-medium">
            <span class="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Ordered Items:</span>
            ${itemsSummary || 'No items'}
          </div>

          <!-- Delivery Actions (If still pending) -->
          ${status === 'Pending' ? `
            <div class="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2">
              <button onclick="Production.openDeliverModal(${order.id})" class="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black py-2 rounded-xl shadow-sm flex items-center justify-center gap-1">
                <span>🚚 Deliver</span>
              </button>
              <button onclick="Production.openEditOrderItemsModal(${order.id})" class="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1">
                <span>✏️ Edit Qty</span>
              </button>
              <button onclick="Production.openCancelOrderModal(${order.id})" class="bg-red-50 hover:bg-red-100 active:scale-95 text-red-700 text-xs font-bold py-2 rounded-xl border border-red-200 flex items-center justify-center gap-1">
                <span>❌ Cancel</span>
              </button>
            </div>
          ` : (status === 'Delivered' ? `
            <div class="flex items-center justify-between pt-2 border-t border-slate-100">
              <span class="text-xs font-bold text-emerald-700">✓ Delivered (${order.paymentType || 'Cash'})</span>
              <div class="flex gap-2">
                <button onclick="Print.previewInvoice(${order.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold">👁️ View Bill</button>
                <button onclick="Print.printExistingInvoice(${order.id})" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 active:scale-95 text-emerald-800 rounded-xl text-xs font-black shadow-xs">🖨️ Print Receipt</button>
              </div>
            </div>
          ` : '')}
        </div>
      `;
    }
    html += '</div>';

    container.innerHTML = html;
  },

  async populateRouteFilter() {
    const rawRoutes = await db.routes.toArray();
    const routes = filterByTenant(rawRoutes);
    const dropdown = document.getElementById('prod-route-filter');
    if (!dropdown) return;

    let html = `<option value="all" ${this.selectedRouteId === 'all' ? 'selected' : ''}>All Routes</option>`;
    for (const r of routes) {
      html += `<option value="${r.id}" ${String(this.selectedRouteId) === String(r.id) ? 'selected' : ''}>${r.name}</option>`;
    }
    dropdown.innerHTML = html;
  },

  onDateChange(val) {
    this.selectedDate = val;
    this.loadMatrix();
  },

  resetToToday() {
    this.selectedDate = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('prod-date-filter');
    if (dateInput) dateInput.value = this.selectedDate;
    this.loadMatrix();
  },

  onRouteChange(val) {
    this.selectedRouteId = val;
    this.loadMatrix();
  },

  // 1. Deliver Order & Settle Payment Modal
  async openDeliverModal(orderId) {
    const order = await db.sales.get(orderId);
    if (!order) return;

    const shop = await db.shops.get(order.shopId);
    this.currentEditingOrder = order;

    document.getElementById('deliver-modal-order-id').value = order.id;
    document.getElementById('deliver-modal-shop-name').textContent = shop ? shop.name : 'Shop';
    document.getElementById('deliver-modal-total').textContent = UI.formatCurrency(order.totalAmount);
    document.getElementById('deliver-modal-paid').value = order.totalAmount;

    UI.openModal('modal-delivery-settle');
  },

  async submitDeliverySettlement(autoPrint = false) {
    if (!this.currentEditingOrder) return;
    const orderId = this.currentEditingOrder.id;
    const order = await db.sales.get(orderId);
    const shop = await db.shops.get(order.shopId);

    const mode = document.querySelector('input[name="deliver-payment-mode"]:checked')?.value || 'Cash';
    const totalAmount = order.totalAmount || 0;
    let paidAmount = 0;
    let creditAmount = 0;

    if (mode === 'Cash') {
      paidAmount = totalAmount;
      creditAmount = 0;
    } else if (mode === 'Credit') {
      paidAmount = 0;
      creditAmount = totalAmount;
    } else if (mode === 'Partial') {
      paidAmount = Number(document.getElementById('deliver-modal-paid').value) || 0;
      paidAmount = Math.min(totalAmount, paidAmount);
      creditAmount = Math.max(0, totalAmount - paidAmount);
    }

    // Update order status to Delivered
    const nowIso = new Date().toISOString();
    await db.sales.update(orderId, {
      status: 'Delivered',
      paidAmount: paidAmount,
      creditAmount: creditAmount,
      paymentType: mode,
      deliveryDate: nowIso.split('T')[0],
      updatedAt: nowIso,
      isSynced: false
    });

    // Update shop credit
    if (creditAmount > 0 && shop) {
      const newCredit = (shop.currentCredit || 0) + creditAmount;
      await db.shops.update(shop.id, { currentCredit: newCredit, updatedAt: nowIso, isSynced: false });
    }

    UI.closeModal('modal-delivery-settle');
    UI.showToast(`✅ Order #${order.invoiceNo} delivered & billed (${mode})!`, 'success');

    if (autoPrint) {
      await Print.printInvoice(orderId);
    }

    this.loadMatrix();
    Dashboard.loadDashboard();
    if (typeof MapView !== "undefined" && MapView.refreshMap) MapView.refreshMap();
  },

  // Helper to calculate free issue items
  calculateFreeQty(prod, qty) {
    if (!prod || !prod.freeSchemeEnabled || !prod.freeSchemeMinQty || prod.freeSchemeMinQty <= 0) {
      return 0;
    }
    const min = Number(prod.freeSchemeMinQty);
    const free = Number(prod.freeSchemeFreeQty) || 1;
    return Math.floor(qty / min) * free;
  },

  // 2. Edit Order Items / Quantities & Add / Remove items on the spot during delivery
  async openEditOrderItemsModal(orderId) {
    const order = await db.sales.get(orderId);
    if (!order) return;

    const shop = await db.shops.get(order.shopId);
    const items = await db.saleItems.where('saleId').equals(orderId).toArray();
    this.currentEditingOrder = order;

    document.getElementById('edit-order-id').value = order.id;
    const invEl = document.getElementById('edit-order-inv');
    if (invEl) invEl.textContent = `${order.invoiceNo} — ${shop ? shop.name : 'Shop'}`;

    const totalEl = document.getElementById('edit-order-live-total');
    if (totalEl) totalEl.textContent = UI.formatCurrency(order.totalAmount);

    const container = document.getElementById('edit-order-items-list');
    let html = '';

    if (items.length === 0) {
      html = `
        <div class="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4">
          No items currently in this order. Select a product below to add items.
        </div>
      `;
    } else {
      for (const item of items) {
        const freeQty = Number(item.freeQty) || 0;
        const lineTotal = Number(item.subtotal) || (item.qty * item.sellingPrice);

        html += `
          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200/80 gap-2 hover:border-emerald-300 transition-all" id="edit-row-${item.id}">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h5 class="font-bold text-xs text-slate-900 truncate">${item.productName}</h5>
                <span class="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700">${item.unit || 'Card'}</span>
                ${freeQty > 0 ? `<span class="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800">🎁 +${freeQty} FREE</span>` : ''}
              </div>
              <div class="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                <span>${UI.formatCurrency(item.sellingPrice)} / ${item.unit}</span>
                <span class="font-bold text-emerald-700" id="edit-row-subtotal-${item.id}">Total: ${UI.formatCurrency(lineTotal)}</span>
              </div>
            </div>

            <div class="flex items-center gap-1.5 flex-shrink-0">
              <!-- Stepper -->
              <div class="flex items-center bg-white rounded-xl border border-slate-200 p-0.5 shadow-xs">
                <button type="button" onclick="Production.adjustEditRowQty(${item.id}, -1)" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-black text-sm flex items-center justify-center">
                  -
                </button>
                <input type="number" min="0" value="${item.qty}" id="edit-item-qty-${item.id}" data-item-id="${item.id}" data-price="${item.sellingPrice}" data-cost="${item.costPrice}" oninput="Production.onEditItemQtyInput(${item.id})" class="w-11 text-center font-black text-xs border-0 bg-transparent focus:ring-0 p-0" />
                <button type="button" onclick="Production.adjustEditRowQty(${item.id}, 1)" class="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm flex items-center justify-center">
                  +
                </button>
              </div>

              <!-- Delete button -->
              <button type="button" onclick="Production.deleteOrderItem(${item.id})" title="Remove item from order" class="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center justify-center active:scale-95">
                🗑️
              </button>
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = html;

    // Load products for addition/substitution
    const rawProducts = await db.products.toArray();
    const products = filterByTenant(rawProducts);
    const subContainer = document.getElementById('edit-order-add-item-section');
    if (subContainer) {
      let prodOpts = `<option value="">-- Select product to add --</option>`;
      for (const p of products) {
        prodOpts += `<option value="${p.id}">${p.name} (${p.unit}) — ${UI.formatCurrency(p.sellingPrice)}</option>`;
      }
      subContainer.innerHTML = `
        <div class="pt-3 border-t border-slate-200 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black text-slate-800 flex items-center gap-1">➕ Add More Items (අමතර භාණ්ඩ එකතු කිරීම):</span>
          </div>
          <div class="flex flex-col sm:flex-row gap-2">
            <div class="flex-1 min-w-0">
              <select id="edit-order-new-product" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 sm:py-2 text-xs font-bold text-slate-800">
                ${prodOpts}
              </select>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <input type="number" id="edit-order-new-qty" min="1" value="1" placeholder="Qty" class="w-20 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2.5 sm:py-2 text-xs font-bold text-center" />
              <button type="button" onclick="Production.addSubstituteItem()" class="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2.5 sm:py-2 rounded-xl shadow-md active:scale-95 flex items-center justify-center gap-1 cursor-pointer flex-shrink-0 whitespace-nowrap">
                <span>➕ Add Item</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    this.recalculateModalLiveTotal();
    UI.openModal('modal-edit-order-items');
  },

  // Live stepper adjustment
  adjustEditRowQty(itemId, delta) {
    const input = document.getElementById(`edit-item-qty-${itemId}`);
    if (!input) return;
    let current = parseInt(input.value) || 0;
    let next = Math.max(0, current + delta);
    input.value = next;
    this.onEditItemQtyInput(itemId);
  },

  // Live input change handler
  onEditItemQtyInput(itemId) {
    const input = document.getElementById(`edit-item-qty-${itemId}`);
    if (!input) return;
    const qty = parseInt(input.value) || 0;
    const price = parseFloat(input.getAttribute('data-price')) || 0;
    const subtotalEl = document.getElementById(`edit-row-subtotal-${itemId}`);
    if (subtotalEl) {
      subtotalEl.textContent = `Total: ${UI.formatCurrency(qty * price)}`;
    }
    this.recalculateModalLiveTotal();
  },

  // Calculate live modal total from all current inputs
  recalculateModalLiveTotal() {
    let total = 0;
    const inputs = document.querySelectorAll('#edit-order-items-list input[type="number"]');
    inputs.forEach(inp => {
      const q = parseInt(inp.value) || 0;
      const p = parseFloat(inp.getAttribute('data-price')) || 0;
      total += (q * p);
    });
    const liveEl = document.getElementById('edit-order-live-total');
    if (liveEl) liveEl.textContent = UI.formatCurrency(total);
  },

  // Delete item from order
  async deleteOrderItem(itemId) {
    if (!this.currentEditingOrder) return;
    const orderId = this.currentEditingOrder.id;

    await db.saleItems.delete(itemId);

    // Recalculate remaining items
    const remainingItems = await db.saleItems.where('saleId').equals(orderId).toArray();
    const newTotal = remainingItems.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
    const newCost = remainingItems.reduce((s, i) => s + (Number(i.costTotal) || 0), 0);

    await db.sales.update(orderId, {
      totalAmount: newTotal,
      totalCost: newCost,
      profit: newTotal - newCost,
      updatedAt: new Date().toISOString(),
      isSynced: false
    });

    UI.showToast('Item removed from order 🗑️', 'info');
    await this.openEditOrderItemsModal(orderId);
  },

  // Add / substitute a new item into existing order
  async addSubstituteItem() {
    if (!this.currentEditingOrder) return;
    const orderId = this.currentEditingOrder.id;

    // First save any current input adjustments to avoid losing typed values
    await this._syncInputsToDatabase(orderId);

    const select = document.getElementById('edit-order-new-product');
    const qtyInput = document.getElementById('edit-order-new-qty');
    const productId = parseInt(select?.value);
    const qty = parseInt(qtyInput?.value) || 1;

    if (!productId) { UI.showToast('Please select a product to add', 'warning'); return; }
    if (qty <= 0) { UI.showToast('Quantity must be at least 1', 'warning'); return; }

    const product = await db.products.get(productId);
    if (!product) return;

    const tenantId = (Auth.currentUser && Auth.currentUser.tenantId) ? Auth.currentUser.tenantId : (getActiveTenantId() || 1);

    // Check if item already exists in this order
    const existing = await db.saleItems.where('saleId').equals(orderId).and(i => i.productId === productId).first();

    if (existing) {
      const newQty = existing.qty + qty;
      const freeQty = this.calculateFreeQty(product, newQty);
      const subtotal = newQty * product.sellingPrice;
      const costTotal = (newQty + freeQty) * product.costPrice;
      const profit = subtotal - costTotal;

      await db.saleItems.update(existing.id, {
        qty: newQty,
        freeQty: freeQty,
        subtotal: subtotal,
        costTotal: costTotal,
        profit: profit
      });
    } else {
      const freeQty = this.calculateFreeQty(product, qty);
      const subtotal = qty * product.sellingPrice;
      const costTotal = (qty + freeQty) * product.costPrice;
      const profit = subtotal - costTotal;

      await db.saleItems.add({
        tenantId: tenantId,
        saleId: orderId,
        productId: product.id,
        productName: product.name,
        unit: product.unit || 'Card',
        packetsPerCard: product.packetsPerCard || 20,
        qty: qty,
        freeQty: freeQty,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        subtotal: subtotal,
        costTotal: costTotal,
        profit: profit
      });
    }

    // Recalculate order totals
    const allItems = await db.saleItems.where('saleId').equals(orderId).toArray();
    const newTotal = allItems.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
    const newCost = allItems.reduce((s, i) => s + (Number(i.costTotal) || 0), 0);
    const newProfit = newTotal - newCost;

    await db.sales.update(orderId, {
      totalAmount: newTotal,
      totalCost: newCost,
      profit: newProfit,
      updatedAt: new Date().toISOString(),
      isSynced: false
    });

    UI.showToast(`✅ ${product.name} × ${qty} added to order!`, 'success');

    // Re-render the edit modal
    await this.openEditOrderItemsModal(orderId);
  },

  // Helper to sync modified input quantities to DB
  async _syncInputsToDatabase(orderId) {
    const items = await db.saleItems.where('saleId').equals(orderId).toArray();
    for (const item of items) {
      const qtyInput = document.getElementById(`edit-item-qty-${item.id}`);
      if (!qtyInput) continue;
      const newQty = parseInt(qtyInput.value) || 0;

      if (newQty <= 0) {
        await db.saleItems.delete(item.id);
      } else {
        const product = await db.products.get(item.productId);
        const freeQty = this.calculateFreeQty(product, newQty);
        const subtotal = newQty * item.sellingPrice;
        const costTotal = (newQty + freeQty) * item.costPrice;
        const profit = subtotal - costTotal;

        await db.saleItems.update(item.id, {
          qty: newQty,
          freeQty: freeQty,
          subtotal: subtotal,
          costTotal: costTotal,
          profit: profit
        });
      }
    }
  },

  async saveEditedOrderItems() {
    if (!this.currentEditingOrder) return;
    const orderId = this.currentEditingOrder.id;

    await this._syncInputsToDatabase(orderId);

    const allItems = await db.saleItems.where('saleId').equals(orderId).toArray();
    const newTotalAmount = allItems.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
    const newTotalCost = allItems.reduce((s, i) => s + (Number(i.costTotal) || 0), 0);
    const newProfit = newTotalAmount - newTotalCost;

    const existingOrder = await db.sales.get(orderId);
    let newPaid = existingOrder.paidAmount || 0;
    let newCredit = existingOrder.creditAmount || 0;

    // If order was already delivered, adjust credit / paid balances
    if (existingOrder.status === 'Delivered') {
      if (existingOrder.paymentType === 'Cash') {
        newPaid = newTotalAmount;
        newCredit = 0;
      } else if (existingOrder.paymentType === 'Credit') {
        const creditDiff = newTotalAmount - (existingOrder.totalAmount || 0);
        newCredit = newTotalAmount;
        newPaid = 0;
        if (existingOrder.shopId) {
          const shop = await db.shops.get(existingOrder.shopId);
          if (shop) {
            const updatedShopCredit = Math.max(0, (shop.currentCredit || 0) + creditDiff);
            await db.shops.update(shop.id, { currentCredit: updatedShopCredit });
          }
        }
      }
    }

    await db.sales.update(orderId, {
      totalAmount: newTotalAmount,
      totalCost: newTotalCost,
      profit: newProfit,
      paidAmount: newPaid,
      creditAmount: newCredit,
      updatedAt: new Date().toISOString(),
      isSynced: false
    });

    UI.closeModal('modal-edit-order-items');
    UI.showToast('✅ Order items & totals updated successfully!', 'success');
    this.loadMatrix();
    Dashboard.loadDashboard();
    if (typeof MapView !== "undefined" && MapView.refreshMap) MapView.refreshMap();
    if (typeof POS !== 'undefined') POS.loadRepDailySummary();
    if (typeof Reports !== 'undefined') Reports.loadReports();
    if (typeof RepBills !== 'undefined') RepBills.loadBills();
  },

  // 3. Cancel Order (Shop closed, no cash, etc.)
  async openCancelOrderModal(orderId) {
    const order = await db.sales.get(orderId);
    if (!order) return;

    this.currentEditingOrder = order;
    document.getElementById('cancel-modal-order-id').value = order.id;
    document.getElementById('cancel-modal-inv').textContent = order.invoiceNo;
    document.getElementById('cancel-modal-reason').value = 'Shop Closed (කඩය වසා ඇත)';
    document.getElementById('cancel-modal-custom-reason').value = '';

    UI.openModal('modal-cancel-order');
  },

  async confirmOrderCancellation() {
    if (!this.currentEditingOrder) return;
    const orderId = this.currentEditingOrder.id;
    const selectReason = document.getElementById('cancel-modal-reason').value;
    const customReason = document.getElementById('cancel-modal-custom-reason').value.trim();
    const finalReason = customReason ? `${selectReason} - ${customReason}` : selectReason;

    const order = await db.sales.get(orderId);
    if (order && order.creditAmount > 0 && order.shopId) {
      const shop = await db.shops.get(order.shopId);
      if (shop) {
        const newCredit = Math.max(0, (shop.currentCredit || 0) - order.creditAmount);
        await db.shops.update(shop.id, { currentCredit: newCredit });
      }
    }

    const nowIso = new Date().toISOString();
    await db.sales.update(orderId, {
      status: 'Cancelled',
      cancelReason: finalReason,
      totalAmount: 0,
      totalCost: 0,
      profit: 0,
      paidAmount: 0,
      creditAmount: 0,
      updatedAt: nowIso
    });

    UI.closeModal('modal-cancel-order');
    UI.showToast(`Order #${this.currentEditingOrder.invoiceNo} cancelled. Reason: ${finalReason}`, 'info');
    this.loadMatrix();
    Dashboard.loadDashboard();
    if (typeof MapView !== "undefined" && MapView.refreshMap) MapView.refreshMap();
    if (typeof POS !== 'undefined') POS.loadRepDailySummary();
    if (typeof Reports !== 'undefined') Reports.loadReports();
  },

  async printProductionChecklist() {
    const isStores = Auth.currentUser?.role === 'stores';
    const todayStr = new Date().toISOString().split('T')[0];

    let rawOrders = await db.sales
      .filter(s => {
        if (s.status === 'Cancelled') return false;
        if (isStores) {
          const isToday = (s.date && s.date.startsWith(todayStr)) || (s.deliveryDate === todayStr);
          const matchRoute = this.selectedRouteId === 'all' || s.routeId === Number(this.selectedRouteId);
          return isToday && matchRoute;
        }
        const isAllPending = this.selectedDate === 'all';
        const matchDate = isAllPending
          ? true
          : ((s.deliveryDate === this.selectedDate) || (!s.deliveryDate && s.date.startsWith(this.selectedDate)));
        const matchRoute = this.selectedRouteId === 'all' || s.routeId === Number(this.selectedRouteId);
        const matchStatus = s.status === 'Pending' || !s.status;
        return matchDate && matchRoute && matchStatus;
      })
      .toArray();
    let orders = filterByTenant(rawOrders);

    const saleIds = orders.map(s => s.id);
    let saleItems = [];
    if (saleIds.length > 0) {
      saleItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
    }

    const matrix = {};
    for (const item of saleItems) {
      const key = item.productId || item.productName;
      if (!matrix[key]) {
        matrix[key] = { productName: item.productName, unit: item.unit || 'Card', totalQty: 0 };
      }
      const itemTotal = (Number(item.qty) || 0) + (Number(item.freeQty) || 0);
      matrix[key].totalQty += itemTotal;
    }

    let routeName = 'All Routes';
    if (this.selectedRouteId !== 'all') {
      const r = await db.routes.get(Number(this.selectedRouteId));
      if (r) routeName = r.name;
    }

    const displayDate = isStores ? todayStr : (this.selectedDate === 'all' ? 'All Pending Orders' : this.selectedDate);
    await Print.printPackingManifest(displayDate, routeName, Object.values(matrix), orders);
  },

  async copyChecklistToClipboard() {
    const isStores = Auth.currentUser?.role === 'stores';
    const todayStr = new Date().toISOString().split('T')[0];

    let rawOrders = await db.sales
      .filter(s => {
        if (s.status === 'Cancelled') return false;
        if (isStores) {
          const isToday = (s.date && s.date.startsWith(todayStr)) || (s.deliveryDate === todayStr);
          const matchRoute = this.selectedRouteId === 'all' || s.routeId === Number(this.selectedRouteId);
          return isToday && matchRoute;
        }
        const isAllPending = this.selectedDate === 'all';
        const matchDate = isAllPending
          ? true
          : ((s.deliveryDate === this.selectedDate) || (!s.deliveryDate && s.date.startsWith(this.selectedDate)));
        const matchRoute = this.selectedRouteId === 'all' || s.routeId === Number(this.selectedRouteId);
        const matchStatus = s.status === 'Pending' || !s.status;
        return matchDate && matchRoute && matchStatus;
      })
      .toArray();
    let orders = filterByTenant(rawOrders);

    const saleIds = orders.map(s => s.id);
    let saleItems = [];
    if (saleIds.length > 0) {
      saleItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
    }

    const matrix = {};
    for (const item of saleItems) {
      const key = item.productId || item.productName;
      if (!matrix[key]) matrix[key] = { productName: item.productName, unit: item.unit || 'Card', totalQty: 0 };
      const itemTotal = (Number(item.qty) || 0) + (Number(item.freeQty) || 0);
      matrix[key].totalQty += itemTotal;
    }

    const displayDate = this.selectedDate === 'all' ? 'All Pending Orders' : UI.formatDate(this.selectedDate);
    let text = `📦 DAILY ORDERS PACKING MANIFEST (${displayDate})\n`;
    text += `====================================\n`;
    for (const item of Object.values(matrix)) {
      text += `• ${item.productName}: ${item.totalQty} ${item.unit}s\n`;
    }
    text += `====================================\n`;
    text += `Total Pending Deliveries: ${orders.length}\n`;

    navigator.clipboard.writeText(text).then(() => {
      UI.showToast('Manifest copied to clipboard!', 'success');
    }).catch(() => {
      UI.showToast('Could not copy text', 'error');
    });
  }
};
