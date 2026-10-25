/**
 * Rep Bills Module — "My Bills" Tab
 * Shows all bills (invoices) created by the currently logged-in rep.
 * Supports Edit (adjust qty / add items) and Delete (reverses sale, adjusts totals).
 * Visible for: rep role (and admin can also access).
 */

const RepBills = {

  _currentFilter: 'all',   // 'all' | 'Pending' | 'Delivered' | 'Cancelled'
  _searchQuery: '',

  async init() {
    this._currentFilter = 'all';
    this._searchQuery = '';
    const searchEl = document.getElementById('rep-bills-search');
    if (searchEl) searchEl.value = '';
    this.setFilter('all');
  },

  // ── Filters ──────────────────────────────────────────────────────────────
  setFilter(status) {
    this._currentFilter = status;
    document.querySelectorAll('.rep-bills-filter-btn').forEach(btn => {
      const s = btn.getAttribute('data-status');
      if (s === status) {
        btn.classList.add('bg-blue-600', 'text-white', 'shadow');
        btn.classList.remove('bg-slate-100', 'text-slate-700');
      } else {
        btn.classList.remove('bg-blue-600', 'text-white', 'shadow');
        btn.classList.add('bg-slate-100', 'text-slate-700');
      }
    });
    this.loadBills();
  },

  onSearchInput(val) {
    this._searchQuery = (val || '').trim().toLowerCase();
    this.loadBills();
  },

  // ── Main loader ───────────────────────────────────────────────────────────
  async loadBills() {
    const listEl    = document.getElementById('rep-bills-list');
    const kpiTotal  = document.getElementById('rep-bills-kpi-total');
    const kpiCount  = document.getElementById('rep-bills-kpi-count');
    const kpiPend   = document.getElementById('rep-bills-kpi-pending');
    const kpiDel    = document.getElementById('rep-bills-kpi-delivered');
    if (!listEl) return;

    listEl.innerHTML = `<div class="flex items-center justify-center py-10 text-slate-400 text-sm gap-2"><span class="animate-spin text-xl">⏳</span> Loading…</div>`;

    try {
      const user = Auth.currentUser;
      const role = user?.role;

      let rawSales = await db.sales.toArray();
      let allSales = filterByTenant(rawSales);

      if (typeof Hierarchy !== 'undefined') {
        allSales = await Hierarchy.filterSales(allSales);
      }

      // KPIs (exclude cancelled)
      const kpiSales   = allSales.filter(s => s.status !== 'Cancelled');
      const totalAmt   = kpiSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
      const countAll   = kpiSales.length;
      const countPend  = allSales.filter(s => s.status === 'Pending' || !s.status).length;
      const countDeliv = allSales.filter(s => s.status === 'Delivered').length;

      if (kpiTotal) kpiTotal.textContent = UI.formatCurrency(totalAmt);
      if (kpiCount) kpiCount.textContent = countAll;
      if (kpiPend)  kpiPend.textContent  = countPend;
      if (kpiDel)   kpiDel.textContent   = countDeliv;

      // Filter by status
      let sales = [...allSales];
      if (this._currentFilter !== 'all') {
        sales = sales.filter(s => (s.status || 'Delivered') === this._currentFilter);
      } else {
        sales = sales.filter(s => (s.status || 'Delivered') !== 'Cancelled');
      }

      // Search
      if (this._searchQuery) {
        const q = this._searchQuery;
        const rawShops = await db.shops.toArray();
        const shopIds  = new Set(filterByTenant(rawShops).filter(sh => sh.name && sh.name.toLowerCase().includes(q)).map(sh => sh.id));
        sales = sales.filter(s =>
          (s.invoiceNo && String(s.invoiceNo).toLowerCase().includes(q)) ||
          shopIds.has(s.shopId)
        );
      }

      // Sort latest first
      sales.sort((a, b) => new Date(b.date) - new Date(a.date));

      if (sales.length === 0) {
        listEl.innerHTML = `
          <div class="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200 p-6">
            <div class="text-4xl mb-2">🧾</div>
            <p class="text-sm font-bold text-slate-600">No bills found</p>
            <p class="text-xs text-slate-400 mt-1">Create a sale from the POS tab to see bills here</p>
            <button onclick="UI.switchTab('pos')" class="mt-3 inline-flex items-center px-4 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-md">
              + New Sale
            </button>
          </div>`;
        return;
      }

      // Shop map for lookup
      const shopMap = {};
      filterByTenant(await db.shops.toArray()).forEach(sh => { shopMap[sh.id] = sh; });

      let html = '';
      for (const sale of sales) {
        const shop   = shopMap[sale.shopId];
        const status = sale.status || 'Delivered';

        const SC = {
          Pending:   { badge: 'bg-amber-100 text-amber-800 border-amber-300',      icon: '📦', iconBg: 'bg-amber-50  border-amber-100  text-amber-600' },
          Delivered: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '💵', iconBg: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
          Cancelled: { badge: 'bg-red-100 text-red-800 border-red-300',            icon: '❌', iconBg: 'bg-red-50     border-red-100     text-red-600' }
        };
        const sc = SC[status] || SC['Delivered'];

        const payBadge = sale.paymentType === 'Cash'
          ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold">💵 Cash</span>`
          : sale.paymentType === 'Credit'
            ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-bold">🔴 Credit</span>`
            : '';

        const dateStr = new Date(sale.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
        const timeStr = new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const editBtn = status !== 'Cancelled' ? `
          <button onclick="RepBills.openEdit(${sale.id})" title="Edit Bill"
            class="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center text-sm border border-blue-200 active:scale-95 transition-all">
            ✏️
          </button>` : '';

        const delBtn = status !== 'Cancelled' ? `
          <button onclick="RepBills.confirmDelete(${sale.id})" title="Delete Bill"
            class="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center text-sm border border-red-200 active:scale-95 transition-all">
            🗑️
          </button>` : '';

        const printBtn = status === 'Delivered' ? `
          <button onclick="Print.printExistingInvoice(${sale.id})" title="Print Invoice"
            class="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center text-sm border border-slate-200 active:scale-95 transition-all">
            🖨️
          </button>` : '';

        html += `
          <div class="bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all overflow-hidden">
            <div class="flex items-center gap-3 p-3.5">
              <div class="w-11 h-11 rounded-2xl ${sc.iconBg} flex items-center justify-center text-xl border flex-shrink-0">${sc.icon}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span class="text-[9px] font-black px-1.5 py-0.5 rounded-full border ${sc.badge}">${status}</span>
                  ${payBadge}
                  <span class="text-[10px] text-slate-400">#${sale.invoiceNo}</span>
                </div>
                <h4 class="font-bold text-slate-800 text-xs sm:text-sm leading-tight truncate">${shop ? shop.name : 'Unknown Shop'}</h4>
                <p class="text-[10px] text-slate-400 mt-0.5">${dateStr} · ${timeStr}${sale.deliveryDate ? ` · Delivery: ${UI.formatDate(sale.deliveryDate)}` : ''}</p>
              </div>
              <div class="text-right flex-shrink-0 flex flex-col items-end gap-1.5">
                <div class="font-black text-slate-900 text-sm">${UI.formatCurrency(sale.totalAmount)}</div>
                <div class="flex items-center gap-1">
                  ${printBtn}${editBtn}${delBtn}
                </div>
              </div>
            </div>

            <!-- Expandable items row -->
            <div id="rep-bill-items-${sale.id}" class="hidden border-t border-slate-100 bg-slate-50 px-4 py-2.5 space-y-1"></div>

            <button onclick="RepBills.toggleItems(${sale.id})"
              class="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all border-t border-slate-100">
              <span id="rep-bill-toggle-icon-${sale.id}">▼</span>
              <span id="rep-bill-toggle-label-${sale.id}">Items details</span>
            </button>
          </div>
        `;
      }

      listEl.innerHTML = html;

    } catch (err) {
      console.error('RepBills.loadBills error:', err);
      listEl.innerHTML = `<div class="text-center py-8 text-red-500 text-xs">Error loading bills. Please refresh.</div>`;
    }
  },

  // ── Expand item details ───────────────────────────────────────────────────
  async toggleItems(saleId) {
    const panel = document.getElementById(`rep-bill-items-${saleId}`);
    const icon  = document.getElementById(`rep-bill-toggle-icon-${saleId}`);
    const label = document.getElementById(`rep-bill-toggle-label-${saleId}`);
    if (!panel) return;

    if (!panel.classList.contains('hidden')) {
      panel.classList.add('hidden');
      if (icon)  icon.textContent  = '▼';
      if (label) label.textContent = 'Items details';
      return;
    }

    const items = await db.saleItems.where('saleId').equals(saleId).toArray();
    if (items.length === 0) {
      panel.innerHTML = `<p class="text-[10px] text-slate-400">No items recorded.</p>`;
    } else {
      let html = `<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Order Items</p>`;
      for (const it of items) {
        const lineTotal = Number(it.subtotal) || (it.qty * it.sellingPrice);
        html += `
          <div class="flex justify-between items-center text-[11px]">
            <span class="font-semibold text-slate-700 truncate flex-1 mr-2">${it.productName}
              ${it.freeQty > 0 ? `<span class="text-purple-600 font-bold">+${it.freeQty}🎁</span>` : ''}
            </span>
            <span class="text-slate-500 flex-shrink-0">${it.qty} ${it.unit || 'Card'} × ${UI.formatCurrency(it.sellingPrice)} = <strong class="text-slate-800">${UI.formatCurrency(lineTotal)}</strong></span>
          </div>`;
      }
      panel.innerHTML = html;
    }
    panel.classList.remove('hidden');
    if (icon)  icon.textContent  = '▲';
    if (label) label.textContent = 'Hide details';
  },

  // ── Edit — reuses Production edit modal (already handles qty + add items) ─
  openEdit(saleId) {
    if (typeof Production !== 'undefined') {
      Production.openEditOrderItemsModal(saleId);
    }
  },

  // ── Delete with credit reversal ───────────────────────────────────────────
  async confirmDelete(saleId) {
    const sale = await db.sales.get(saleId);
    if (!sale) return;

    const shop = sale.shopId ? await db.shops.get(sale.shopId) : null;
    const shopName = shop ? shop.name : 'Unknown Shop';

    if (!confirm(`Delete invoice #${sale.invoiceNo}?\n\nShop: ${shopName}\nTotal: ${UI.formatCurrency(sale.totalAmount)}\n\n⚠️ This is permanent. If the bill had credit, the shop credit balance will be corrected.`)) return;

    // Reverse credit on shop record
    if ((sale.creditAmount || 0) > 0 && sale.shopId) {
      const shopRec = await db.shops.get(sale.shopId);
      if (shopRec) {
        const newCredit = Math.max(0, (shopRec.currentCredit || 0) - sale.creditAmount);
        await db.shops.update(sale.shopId, { currentCredit: newCredit });
      }
    }

    // Remove line items then the sale
    await db.saleItems.where('saleId').equals(saleId).delete();
    await db.sales.delete(saleId);

    UI.showToast(`🗑️ Invoice #${sale.invoiceNo} deleted!`, 'success');

    // Reload lists
    await this.loadBills();
    if (typeof Dashboard !== 'undefined') Dashboard.loadDashboard();
  }
};
