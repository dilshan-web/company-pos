/**
 * Reports & Custom Analytics Module
 * Comprehensive financial, sales, free issues, returns, collections, and multi-type PDF generation
 */

const Reports = {
  currentFilterType: 'today', // today | yesterday | week | month | custom
  startDate: null,
  endDate: null,

  async loadReports() {
    this.calculateDateRange();
    
    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');
    if (startInput && this.startDate) startInput.value = this.startDate.toISOString().split('T')[0];
    if (endInput && this.endDate) endInput.value = this.endDate.toISOString().split('T')[0];

    // 1. Fetch sales in range filtered by tenant
    const rawAllSales = await db.sales
      .filter(s => {
        const d = new Date(s.date);
        return d >= this.startDate && d <= this.endDate;
      })
      .toArray();
    const allSales = filterByTenant(rawAllSales);

    const activeSales    = allSales.filter(s => s.status !== 'Cancelled');
    const deliveredSales = allSales.filter(s => s.status === 'Delivered');
    const pendingSales   = allSales.filter(s => s.status === 'Pending' || !s.status);
    const cancelledSales = allSales.filter(s => s.status === 'Cancelled');

    // 2. Fetch sale items associated with active sales
    const saleIds = activeSales.map(s => s.id);
    let allItems = [];
    if (saleIds.length > 0) {
      const rawItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
      allItems = filterByTenant(rawItems);
    }

    // 3. Fetch debt payments in range
    const rawPayments = await db.creditPayments
      .filter(p => {
        const d = new Date(p.date);
        return d >= this.startDate && d <= this.endDate;
      })
      .toArray();
    const payments = filterByTenant(rawPayments);

    // 4. Fetch sales returns in range
    let allReturns = [];
    if (typeof db !== 'undefined' && db.salesReturns) {
      try {
        const rawReturns = await db.salesReturns
          .filter(r => {
            const d = new Date(r.date);
            return d >= this.startDate && d <= this.endDate;
          })
          .toArray();
        allReturns = filterByTenant(rawReturns);
      } catch (e) {
        console.warn('Sales returns fetch warning:', e);
      }
    }

    // 5. Calculate Core Financial Metrics
    const totalRevenue = activeSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const totalCost = activeSales.reduce((sum, s) => sum + (Number(s.totalCost) || 0), 0);
    const netProfit = totalRevenue - totalCost;
    const profitMarginPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;
    const totalCreditIssued = activeSales.reduce((sum, s) => sum + (Number(s.creditAmount) || 0), 0);
    const totalCreditCollected = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);

    // 6. Calculate Free Issues Metrics
    let totalFreeQty = 0;
    let totalFreeRetailValue = 0;
    let totalFreeCostValue = 0;
    for (const item of allItems) {
      const fQty = Number(item.freeQty) || 0;
      if (fQty > 0) {
        totalFreeQty += fQty;
        totalFreeRetailValue += fQty * (Number(item.sellingPrice) || 0);
        totalFreeCostValue += fQty * (Number(item.costPrice) || 0);
      }
    }

    // 7. Calculate Returns Metrics
    const totalReturnQty = allReturns.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
    const totalReturnValue = allReturns.reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);

    // Update DOM KPIs
    const revEl = document.getElementById('report-total-revenue');
    const costEl = document.getElementById('report-total-cost');
    const profitEl = document.getElementById('report-net-profit');
    const marginEl = document.getElementById('report-margin-pct');
    const creditIssuedEl = document.getElementById('report-credit-issued');
    const creditCollectedEl = document.getElementById('report-credit-collected');
    const freeQtyEl = document.getElementById('report-free-qty');
    const freeValEl = document.getElementById('report-free-val');
    const returnQtyEl = document.getElementById('report-returns-qty');
    const returnValEl = document.getElementById('report-returns-val');

    if (revEl) revEl.textContent = UI.formatCurrency(totalRevenue);
    if (costEl) costEl.textContent = UI.formatCurrency(totalCost);
    if (profitEl) profitEl.textContent = UI.formatCurrency(netProfit);
    if (marginEl) marginEl.textContent = `${profitMarginPct}%`;
    if (creditIssuedEl) creditIssuedEl.textContent = UI.formatCurrency(totalCreditIssued);
    if (creditCollectedEl) creditCollectedEl.textContent = UI.formatCurrency(totalCreditCollected);
    if (freeQtyEl) freeQtyEl.textContent = `${totalFreeQty} pkts`;
    if (freeValEl) freeValEl.textContent = `Val: ${UI.formatCurrency(totalFreeRetailValue)}`;
    if (returnQtyEl) returnQtyEl.textContent = `${totalReturnQty} pkts`;
    if (returnValEl) returnValEl.textContent = `Val: ${UI.formatCurrency(totalReturnValue)}`;

    // Render detailed visual lists
    await this.renderTopProducts(deliveredSales, allItems);
    await this.renderFreeIssuesBreakdown(allItems, deliveredSales);
    await this.renderReturnsBreakdown(allReturns);
    await this.renderRoutePerformance(deliveredSales);
    await this.renderDebtorsList();
    // Render Admin & HR trade deals audit (includes net rates, heavy free, subsidies)
    this._lastPromoSales = activeSales;
    this._lastPromoItems = allItems;
    await this.renderSpecialDiscountsAudit();
  },

  calculateDateRange() {
    const now = new Date();
    if (this.currentFilterType === 'today') {
      this.startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      this.endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (this.currentFilterType === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      this.startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
      this.endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    } else if (this.currentFilterType === 'week') {
      const firstDayOfWeek = new Date(now);
      firstDayOfWeek.setDate(now.getDate() - now.getDay());
      this.startDate = new Date(firstDayOfWeek.getFullYear(), firstDayOfWeek.getMonth(), firstDayOfWeek.getDate(), 0, 0, 0);
      this.endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (this.currentFilterType === 'month') {
      this.startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      this.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
  },

  setFilter(type) {
    this.currentFilterType = type;
    document.querySelectorAll('.report-filter-pill').forEach(btn => {
      if (btn.getAttribute('data-filter') === type) {
        btn.classList.add('bg-emerald-600', 'text-white');
        btn.classList.remove('bg-white', 'text-slate-600');
      } else {
        btn.classList.remove('bg-emerald-600', 'text-white');
        btn.classList.add('bg-white', 'text-slate-600');
      }
    });

    const customRow = document.getElementById('report-custom-date-row');
    if (customRow) {
      if (type === 'custom') customRow.classList.remove('hidden');
      else customRow.classList.add('hidden');
    }

    this.loadReports();
  },

  applyCustomDates() {
    const s = document.getElementById('report-start-date').value;
    const e = document.getElementById('report-end-date').value;
    if (s && e) {
      this.startDate = new Date(s + 'T00:00:00');
      this.endDate = new Date(e + 'T23:59:59.999');
      this.loadReports();
    }
  },

  getPeriodLabel() {
    if (this.currentFilterType === 'today') return 'Today (' + new Date().toLocaleDateString('en-GB') + ')';
    if (this.currentFilterType === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return 'Yesterday (' + y.toLocaleDateString('en-GB') + ')';
    }
    if (this.currentFilterType === 'week') return 'This Week (' + this.startDate.toLocaleDateString('en-GB') + ' – ' + this.endDate.toLocaleDateString('en-GB') + ')';
    if (this.currentFilterType === 'month') return 'This Month (' + this.startDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }) + ')';
    return `${this.startDate.toLocaleDateString('en-GB')} – ${this.endDate.toLocaleDateString('en-GB')}`;
  },

  // ── Render Top Selling Products ──────────────────────────────────────────
  async renderTopProducts(sales, items) {
    const container = document.getElementById('report-top-products-container');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-slate-400 text-xs">No completed sales data in this period.</div>`;
      return;
    }

    const productStats = {};
    for (const item of items) {
      const key = item.productId || item.productName;
      if (!productStats[key]) {
        productStats[key] = {
          name: item.productName,
          unit: item.unit,
          qty: 0,
          freeQty: 0,
          revenue: 0,
          profit: 0
        };
      }
      productStats[key].qty += (Number(item.qty) || 0);
      productStats[key].freeQty += (Number(item.freeQty) || 0);
      productStats[key].revenue += (Number(item.subtotal) || 0);
      productStats[key].profit += (Number(item.profit) || 0);
    }

    const sorted = Object.values(productStats).sort((a, b) => b.qty - a.qty).slice(0, 5);

    let html = '';
    for (const p of sorted) {
      html += `
        <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
          <div>
            <h5 class="font-bold text-xs text-slate-800">${p.name}</h5>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="text-[10px] text-slate-500 font-semibold">${p.qty} ${p.unit}s sold</span>
              ${p.freeQty > 0 ? `<span class="text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded-md">🎁 +${p.freeQty} FREE</span>` : ''}
            </div>
          </div>
          <div class="text-right">
            <div class="font-bold text-xs text-slate-900">${UI.formatCurrency(p.revenue)}</div>
            <span class="text-[10px] font-bold text-emerald-700 admin-profit-only">+${UI.formatCurrency(p.profit)} profit</span>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  // ── Render Free Issues Breakdown ─────────────────────────────────────────
  async renderFreeIssuesBreakdown(items, sales) {
    const container = document.getElementById('report-free-issues-container');
    if (!container) return;

    const freeItems = (items || []).filter(i => (Number(i.freeQty) || 0) > 0);
    if (freeItems.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-slate-400 text-xs">🎁 No free issues or promotional gifts given in this period.</div>`;
      return;
    }

    // Group free issues by product
    const prodMap = {};
    for (const item of freeItems) {
      const key = item.productId || item.productName;
      if (!prodMap[key]) {
        prodMap[key] = {
          name: item.productName,
          unit: item.unit || 'pkt',
          freeQty: 0,
          retailVal: 0,
          costVal: 0
        };
      }
      const fQty = Number(item.freeQty) || 0;
      prodMap[key].freeQty += fQty;
      prodMap[key].retailVal += fQty * (Number(item.sellingPrice) || 0);
      prodMap[key].costVal += fQty * (Number(item.costPrice) || 0);
    }

    let html = '';
    for (const p of Object.values(prodMap)) {
      html += `
        <div class="p-3 bg-purple-50/60 rounded-2xl border border-purple-100 flex items-center justify-between">
          <div>
            <h5 class="font-black text-xs text-slate-800">${p.name}</h5>
            <span class="text-[10px] font-bold text-purple-700">🎁 ${p.freeQty} ${p.unit}s given free</span>
          </div>
          <div class="text-right">
            <div class="font-black text-xs text-purple-900">${UI.formatCurrency(p.retailVal)}</div>
            <span class="text-[10px] text-slate-500 font-semibold">Cost: ${UI.formatCurrency(p.costVal)}</span>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  // ── Render Returns Breakdown ─────────────────────────────────────────────
  async renderReturnsBreakdown(allReturns) {
    const container = document.getElementById('report-returns-container');
    if (!container) return;

    if (!allReturns || allReturns.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-emerald-700 text-xs font-bold">✓ No returned or damaged items recorded in this period.</div>`;
      return;
    }

    // Group returns by product
    const returnMap = {};
    for (const r of allReturns) {
      const key = r.productId || r.productName;
      if (!returnMap[key]) {
        returnMap[key] = {
          name: r.productName,
          qty: 0,
          refundAmount: 0,
          reasons: {}
        };
      }
      const q = Number(r.qty) || 0;
      returnMap[key].qty += q;
      returnMap[key].refundAmount += (Number(r.refundAmount) || 0);
      const reason = r.returnType || r.reason || 'Damaged';
      returnMap[key].reasons[reason] = (returnMap[key].reasons[reason] || 0) + q;
    }

    let html = '';
    for (const r of Object.values(returnMap)) {
      const reasonsStr = Object.entries(r.reasons).map(([k, v]) => `${k}: ${v}`).join(', ');
      html += `
        <div class="p-3 bg-rose-50/60 rounded-2xl border border-rose-100 flex items-center justify-between">
          <div>
            <h5 class="font-black text-xs text-slate-800">${r.name}</h5>
            <span class="text-[10px] font-bold text-rose-700">🔄 ${r.qty} returned (${reasonsStr})</span>
          </div>
          <div class="text-right">
            <div class="font-black text-xs text-rose-700">${UI.formatCurrency(r.refundAmount)}</div>
            <span class="text-[10px] text-slate-500 font-semibold">Refund / Deducted</span>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  // ── Render Route Performance ─────────────────────────────────────────────
  async renderRoutePerformance(sales) {
    const container = document.getElementById('report-route-performance-container');
    if (!container) return;

    const rawRoutes = await db.routes.toArray();
    const routes = filterByTenant(rawRoutes);
    const routeStats = {};

    for (const r of routes) {
      routeStats[r.id] = { name: r.name, bills: 0, revenue: 0 };
    }

    for (const s of sales) {
      if (routeStats[s.routeId]) {
        routeStats[s.routeId].bills += 1;
        routeStats[s.routeId].revenue += (s.totalAmount || 0);
      }
    }

    let html = '';
    for (const r of Object.values(routeStats)) {
      html += `
        <div class="p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
          <div>
            <h5 class="font-bold text-xs text-slate-800">${r.name}</h5>
            <span class="text-[10px] text-slate-500">${r.bills} delivered invoices</span>
          </div>
          <div class="text-right">
            <div class="font-bold text-xs text-emerald-700">${UI.formatCurrency(r.revenue)}</div>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  // ── Render Outstanding Debtors List ──────────────────────────────────────
  async renderDebtorsList() {
    const container = document.getElementById('report-debtors-container');
    if (!container) return;

    const rawShopsWithCredit = await db.shops.filter(s => s.currentCredit > 0).toArray();
    const shopsWithCredit = filterByTenant(rawShopsWithCredit);
    const sorted = shopsWithCredit.sort((a, b) => b.currentCredit - a.currentCredit);

    if (sorted.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-emerald-700 text-xs font-bold">✓ All shop credits are completely cleared!</div>`;
      return;
    }

    let html = '';
    for (const s of sorted) {
      const route = await db.routes.get(s.routeId);
      html += `
        <div class="p-3 bg-red-50/50 rounded-2xl border border-red-100 flex items-center justify-between">
          <div>
            <h5 class="font-bold text-xs text-slate-800">${s.name}</h5>
            <span class="text-[10px] text-slate-500">${route ? route.name : 'Unknown'} • 👤 ${s.ownerName || '-'}</span>
          </div>
          <div class="text-right">
            <div class="font-bold text-xs text-red-600">${UI.formatCurrency(s.currentCredit)}</div>
            <button onclick="Collections.openCollectModal(${s.id})" class="text-[10px] font-bold text-emerald-700 hover:underline">Collect 💵</button>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  // ── Helper: Open Report in Print / Save as PDF Window ────────────────────
  openReportWindow(reportHTML, title) {
    const win = window.open('', '_blank', 'width=950,height=750');
    if (!win) {
      UI.showToast('Please allow pop-ups to print or download PDF report.', 'warning');
      return;
    }
    win.document.open();
    win.document.write(reportHTML);
    win.document.close();
    UI.showToast('📄 Report ready! Use "Save as PDF" in the print dialog.', 'success');
  },

  // ── Shared Base CSS for All A4 PDF Reports ───────────────────────────────
  getBaseReportStyles(accentColor = '#16a34a') {
    return `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: A4 portrait; margin: 12mm 10mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Sinhala", Arial, sans-serif; font-size: 10.5px; color: #1e293b; background: #fff; line-height: 1.35; }
      
      .report-header {
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 3px solid ${accentColor}; padding-bottom: 10px; margin-bottom: 14px;
      }
      .company-block { display: flex; align-items: center; gap: 12px; }
      .company-info h1 { font-size: 17px; font-weight: 900; color: #0f172a; line-height: 1.1; }
      .company-info p  { font-size: 9.5px; color: #64748b; margin-top: 2px; }
      .report-meta { text-align: right; }
      .report-meta h2 { font-size: 13px; font-weight: 800; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.5px; }
      .report-meta p  { font-size: 9px; color: #94a3b8; margin-top: 2px; }
      .report-badge {
        background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;
        padding: 3px 8px; font-size: 10px; font-weight: 700; color: #334155; margin-top: 5px; display: inline-block;
      }

      .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 14px; }
      .kpi-card {
        border-radius: 8px; padding: 8px 10px;
        border: 1px solid #e2e8f0; background: #f8fafc;
      }
      .kpi-card.green { background: #f0fdf4; border-color: #86efac; }
      .kpi-card.purple { background: #faf5ff; border-color: #d8b4fe; }
      .kpi-card.red   { background: #fff1f2; border-color: #fca5a5; }
      .kpi-card.blue  { background: #eff6ff; border-color: #93c5fd; }
      .kpi-card.amber { background: #fffbeb; border-color: #fcd34d; }
      .kpi-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #64748b; }
      .kpi-value { font-size: 13px; font-weight: 900; margin-top: 2px; color: #0f172a; }
      .kpi-card.green .kpi-value { color: #15803d; }
      .kpi-card.purple .kpi-value { color: #7e22ce; }
      .kpi-card.red   .kpi-value { color: #dc2626; }
      .kpi-card.blue  .kpi-value { color: #1d4ed8; }
      .kpi-card.amber .kpi-value { color: #b45309; }

      .section-title {
        font-size: 11px; font-weight: 800; color: #0f172a;
        border-left: 3.5px solid ${accentColor}; padding-left: 6px;
        margin: 12px 0 6px; text-transform: uppercase; letter-spacing: 0.3px;
      }

      table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 6px; }
      thead tr { background: #0f172a; color: #fff; }
      thead th { padding: 5px 6px; text-align: left; font-weight: 700; font-size: 8.5px; letter-spacing: .3px; }
      tbody tr:nth-child(even) { background: #f8fafc; }
      tbody tr:hover { background: #f1f5f9; }
      tbody td { padding: 4.5px 6px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
      tfoot tr { background: #f8fafc; font-weight: 800; }
      tfoot td { padding: 5px 6px; border-top: 2px solid ${accentColor}; color: #0f172a; font-size: 10px; }

      .badge-tag { display: inline-block; padding: 2px 5px; border-radius: 4px; font-size: 8.5px; font-weight: 700; }
      .badge-purple { background: #f3e8ff; color: #6b21a8; }
      .badge-rose { background: #ffe4e6; color: #be123c; }
      .badge-green { background: #dcfce7; color: #15803d; }

      .report-footer {
        margin-top: 18px; padding-top: 8px;
        border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between;
        font-size: 8.5px; color: #94a3b8;
      }
      .page-break { page-break-before: always; }

      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none !important; }
      }
    `;
  },

  // ── 1. MASTER SUMMARY PDF (All-in-One Comprehensive A4 Report) ───────────
  async generateA4Report() {
    return this.generateMasterSummaryPDF();
  },

  async generateMasterSummaryPDF() {
    UI.showToast('Generating Master Summary A4 PDF...', 'info');
    this.calculateDateRange();
    const companies = filterByTenant(await db.company.toArray());
    const company = companies.length > 0 ? companies[0] : await db.company.toCollection().first();
    const rawRoutes = await db.routes.toArray();
    const routes = filterByTenant(rawRoutes);

    // Data fetching
    const rawAllSales = await db.sales.filter(s => {
      const d = new Date(s.date);
      return d >= this.startDate && d <= this.endDate;
    }).toArray();
    const allSales = filterByTenant(rawAllSales);

    const deliveredSales = allSales.filter(s => s.status === 'Delivered' || !s.status);
    const pendingSales   = allSales.filter(s => s.status === 'Pending');
    const cancelledSales = allSales.filter(s => s.status === 'Cancelled');

    const saleIds = deliveredSales.map(s => s.id);
    let allItems = [];
    if (saleIds.length > 0) {
      const rawItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
      allItems = filterByTenant(rawItems);
    }

    const rawPayments = await db.creditPayments.filter(p => {
      const d = new Date(p.date);
      return d >= this.startDate && d <= this.endDate;
    }).toArray();
    const payments = filterByTenant(rawPayments);

    let allReturns = [];
    if (typeof db !== 'undefined' && db.salesReturns) {
      try {
        const rawReturns = await db.salesReturns.filter(r => {
          const d = new Date(r.date);
          return d >= this.startDate && d <= this.endDate;
        }).toArray();
        allReturns = filterByTenant(rawReturns);
      } catch (e) {
        console.warn('Returns query error:', e);
      }
    }

    // Financial calculations
    const totalRevenue    = deliveredSales.reduce((s, x) => s + (x.totalAmount || 0), 0);
    const totalCost       = deliveredSales.reduce((s, x) => s + (x.totalCost || 0), 0);
    const netProfit       = totalRevenue - totalCost;
    const marginPct       = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';
    const creditIssued    = deliveredSales.reduce((s, x) => s + (x.creditAmount || 0), 0);
    const cashCollected   = deliveredSales.reduce((s, x) => s + (x.paidAmount || 0), 0);
    const debtRecovered   = payments.reduce((s, x) => s + (x.amountPaid || 0), 0);

    // Free issues calculations
    let totalFreeQty = 0;
    let totalFreeValue = 0;
    const freeProdStats = {};
    for (const item of allItems) {
      const fQty = Number(item.freeQty) || 0;
      if (fQty > 0) {
        totalFreeQty += fQty;
        const val = fQty * (Number(item.sellingPrice) || 0);
        totalFreeValue += val;
        const key = item.productId || item.productName;
        if (!freeProdStats[key]) {
          freeProdStats[key] = { name: item.productName, unit: item.unit || 'pkt', qty: 0, value: 0 };
        }
        freeProdStats[key].qty += fQty;
        freeProdStats[key].value += val;
      }
    }

    // Returns calculations
    const totalReturnQty = allReturns.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const totalReturnValue = allReturns.reduce((s, r) => s + (Number(r.refundAmount) || 0), 0);
    const returnProdStats = {};
    for (const r of allReturns) {
      const key = r.productId || r.productName;
      if (!returnProdStats[key]) {
        returnProdStats[key] = { name: r.productName, qty: 0, value: 0, reason: r.returnType || r.reason || 'Damaged' };
      }
      returnProdStats[key].qty += (Number(r.qty) || 0);
      returnProdStats[key].value += (Number(r.refundAmount) || 0);
    }

    // Top products
    const prodStats = {};
    for (const item of allItems) {
      const key = item.productId || item.productName;
      if (!prodStats[key]) prodStats[key] = { name: item.productName, unit: item.unit, qty: 0, freeQty: 0, revenue: 0, profit: 0 };
      prodStats[key].qty     += (Number(item.qty) || 0);
      prodStats[key].freeQty += (Number(item.freeQty) || 0);
      prodStats[key].revenue += (item.subtotal || 0);
      prodStats[key].profit  += (item.profit   || 0);
    }
    const topProducts = Object.values(prodStats).sort((a, b) => b.qty - a.qty).slice(0, 10);

    // Route stats
    const routeStats = {};
    for (const r of routes) routeStats[r.id] = { name: r.name, bills: 0, revenue: 0, profit: 0 };
    for (const s of deliveredSales) {
      if (routeStats[s.routeId]) {
        routeStats[s.routeId].bills   += 1;
        routeStats[s.routeId].revenue += (s.totalAmount || 0);
        routeStats[s.routeId].profit  += (s.profit || 0);
      }
    }

    // Outstanding debtors
    const rawDebtors = await db.shops.filter(s => s.currentCredit > 0).toArray();
    const debtorShops = filterByTenant(rawDebtors);
    const totalOutstanding = debtorShops.reduce((s, x) => s + x.currentCredit, 0);

    // Build Product Rows
    let prodRows = '';
    for (const p of topProducts) {
      prodRows += `
        <tr>
          <td>${p.name}</td>
          <td style="text-align:center">${p.qty} ${p.unit}s</td>
          <td style="text-align:center">${p.freeQty > 0 ? `<span class="badge-tag badge-purple">+${p.freeQty} Free</span>` : '-'}</td>
          <td style="text-align:right">Rs. ${Number(p.revenue).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;color:#16a34a">Rs. ${Number(p.profit).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
        </tr>`;
    }

    // Build Free Issues Rows
    let freeRows = '';
    for (const f of Object.values(freeProdStats)) {
      freeRows += `
        <tr>
          <td>${f.name}</td>
          <td style="text-align:center;font-weight:bold;color:#7e22ce">${f.qty} ${f.unit}s</td>
          <td style="text-align:right">Rs. ${Number(f.value).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
        </tr>`;
    }

    // Build Returns Rows
    let returnRows = '';
    for (const r of Object.values(returnProdStats)) {
      returnRows += `
        <tr>
          <td>${r.name}</td>
          <td><span class="badge-tag badge-rose">${r.reason}</span></td>
          <td style="text-align:center;font-weight:bold;color:#be123c">${r.qty} pkts</td>
          <td style="text-align:right;color:#dc2626">Rs. ${Number(r.value).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
        </tr>`;
    }

    // Build Route Rows
    let routeRows = '';
    for (const r of Object.values(routeStats)) {
      if (r.bills > 0) {
        routeRows += `
          <tr>
            <td>${r.name}</td>
            <td style="text-align:center">${r.bills}</td>
            <td style="text-align:right">Rs. ${Number(r.revenue).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
            <td style="text-align:right;color:#16a34a">Rs. ${Number(r.profit).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
          </tr>`;
      }
    }

    // Build Debtor Rows
    let debtorRows = '';
    for (const s of debtorShops.sort((a,b) => b.currentCredit - a.currentCredit).slice(0, 25)) {
      const route = await db.routes.get(s.routeId);
      debtorRows += `
        <tr>
          <td>${s.name}</td>
          <td>${s.ownerName || '-'}</td>
          <td>${route ? route.name : '-'}</td>
          <td>${s.phone || '-'}</td>
          <td style="text-align:right;color:#dc2626;font-weight:bold">Rs. ${Number(s.currentCredit).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
        </tr>`;
    }

    const periodLabel = this.getPeriodLabel();
    const logoTag = company?.logoBase64
      ? `<img src="${company.logoBase64}" style="height:55px;object-fit:contain;margin-bottom:4px;">`
      : '<div style="font-size:28px;margin-bottom:2px;">🌿</div>';

    const reportHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Master Summary Report — ${company?.name || 'SPICE POS'} — ${periodLabel}</title>
<style>
${this.getBaseReportStyles('#16a34a')}
</style>
</head>
<body>

<!-- ═══ HEADER ═══════════════════════════════════════ -->
<div class="report-header">
  <div class="company-block">
    ${logoTag}
    <div class="company-info">
      <h1>${company?.name || 'SPICE WHOLESALE POS'}</h1>
      <p>${company?.tagline || 'Mobile Distribution & Point of Sale'}</p>
      <p>${company?.address || ''} ${company?.phone ? '| Tel: ' + company.phone : ''}</p>
    </div>
  </div>
  <div class="report-meta">
    <h2>👑 MASTER SUMMARY REPORT</h2>
    <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
    <div class="report-badge">📅 Period: ${periodLabel}</div>
  </div>
</div>

<!-- ═══ KPI SUMMARY GRID ═════════════════════════════ -->
<div class="kpi-grid">
  <div class="kpi-card green">
    <div class="kpi-label">Total Revenue</div>
    <div class="kpi-value">Rs. ${Number(totalRevenue).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Cost of Goods (COGS)</div>
    <div class="kpi-value">Rs. ${Number(totalCost).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
  <div class="kpi-card green">
    <div class="kpi-label">Net Profit (${marginPct}%)</div>
    <div class="kpi-value">Rs. ${Number(netProfit).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
  <div class="kpi-card blue">
    <div class="kpi-label">Cash Collected</div>
    <div class="kpi-value">Rs. ${Number(cashCollected).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
  <div class="kpi-card red">
    <div class="kpi-label">Credit Issued</div>
    <div class="kpi-value">Rs. ${Number(creditIssued).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
  <div class="kpi-card amber">
    <div class="kpi-label">Debt Recovered</div>
    <div class="kpi-value">Rs. ${Number(debtRecovered).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
  <div class="kpi-card purple">
    <div class="kpi-label">Free Issues Given</div>
    <div class="kpi-value">${totalFreeQty} pkts <span style="font-size:10px;font-weight:normal">(Rs. ${Number(totalFreeValue).toLocaleString('en-LK',{minimumFractionDigits:2})})</span></div>
  </div>
  <div class="kpi-card red">
    <div class="kpi-label">Returns / Damages</div>
    <div class="kpi-value">${totalReturnQty} pkts <span style="font-size:10px;font-weight:normal">(Rs. ${Number(totalReturnValue).toLocaleString('en-LK',{minimumFractionDigits:2})})</span></div>
  </div>
</div>

<!-- ═══ TWO COLUMNS: FREE ISSUES & RETURNS ════════════ -->
<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom: 10px;">
  <div>
    <div class="section-title" style="border-color:#9333ea;color:#7e22ce">🎁 Free Issues Given in Period</div>
    <table>
      <thead><tr><th>Product</th><th style="text-align:center">Free Qty</th><th style="text-align:right">Market Value</th></tr></thead>
      <tbody>${freeRows || '<tr><td colspan="3" style="text-align:center;color:#94a3b8">No free issues given</td></tr>'}</tbody>
      <tfoot><tr>
        <td>TOTAL FREE</td>
        <td style="text-align:center;color:#7e22ce">${totalFreeQty} pkts</td>
        <td style="text-align:right;color:#7e22ce">Rs. ${Number(totalFreeValue).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
      </tr></tfoot>
    </table>
  </div>
  <div>
    <div class="section-title" style="border-color:#e11d48;color:#be123c">🔄 Returns & Damaged Goods</div>
    <table>
      <thead><tr><th>Product</th><th>Reason</th><th style="text-align:center">Qty</th><th style="text-align:right">Refund</th></tr></thead>
      <tbody>${returnRows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No returns recorded</td></tr>'}</tbody>
      <tfoot><tr>
        <td colspan="2">TOTAL RETURNS</td>
        <td style="text-align:center;color:#be123c">${totalReturnQty} pkts</td>
        <td style="text-align:right;color:#dc2626">Rs. ${Number(totalReturnValue).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
      </tr></tfoot>
    </table>
  </div>
</div>

<!-- ═══ TOP SELLING PRODUCTS ════════════════════════ -->
<div class="section-title">🏆 Top Selling Products & Movement</div>
<table>
  <thead><tr><th>Product Name</th><th style="text-align:center">Sold Qty</th><th style="text-align:center">Free Scheme</th><th style="text-align:right">Revenue</th><th style="text-align:right">Profit</th></tr></thead>
  <tbody>${prodRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">No sales items in this period</td></tr>'}</tbody>
</table>

<!-- ═══ ROUTE PERFORMANCE ════════════════════════════ -->
<div class="section-title">🗺️ Route Performance Summary</div>
<table>
  <thead><tr><th>Route Name</th><th style="text-align:center">Bills Delivered</th><th style="text-align:right">Total Revenue</th><th style="text-align:right">Total Profit</th></tr></thead>
  <tbody>${routeRows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No delivered sales</td></tr>'}</tbody>
  <tfoot><tr>
    <td>TOTAL</td>
    <td style="text-align:center">${deliveredSales.length}</td>
    <td style="text-align:right">Rs. ${Number(totalRevenue).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
    <td style="text-align:right">Rs. ${Number(netProfit).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
  </tr></tfoot>
</table>

${debtorShops.length > 0 ? `
<div class="page-break"></div>
<!-- ═══ PAGE 2: OUTSTANDING DEBTORS ══════════════════ -->
<div class="report-header">
  <div class="company-block">
    ${logoTag}
    <div class="company-info">
      <h1>${company?.name || 'SPICE WHOLESALE POS'}</h1>
    </div>
  </div>
  <div class="report-meta">
    <h2 style="color:#dc2626">OUTSTANDING CREDIT & DEBTORS</h2>
    <p>As at: ${new Date().toLocaleDateString('en-GB')}</p>
    <div class="report-badge" style="background:#fff1f2;border-color:#fca5a5;color:#dc2626">⚠️ Total Debt: Rs. ${Number(totalOutstanding).toLocaleString('en-LK',{minimumFractionDigits:2})}</div>
  </div>
</div>
<div class="section-title" style="border-color:#dc2626">⚠️ Shops with Outstanding Credit Balance</div>
<table>
  <thead style="background:#7f1d1d"><tr><th>Shop Name</th><th>Owner Name</th><th>Route</th><th>Phone</th><th style="text-align:right">Credit Balance</th></tr></thead>
  <tbody>${debtorRows}</tbody>
  <tfoot style="background:#fff1f2"><tr>
    <td colspan="4" style="color:#dc2626">TOTAL OUTSTANDING DEBT</td>
    <td style="text-align:right;color:#dc2626">Rs. ${Number(totalOutstanding).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
  </tr></tfoot>
</table>
` : ''}

<!-- ═══ FOOTER ═══════════════════════════════════════ -->
<div class="report-footer">
  <span>${company?.name || 'SPICE POS'} — Master Summary Confidential Report</span>
  <span>${company?.receiptFooter || 'Thank you for your business!'}</span>
  <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
</div>

<script>
  window.addEventListener('load', function() {
    setTimeout(() => window.print(), 350);
  });
<\/script>
</body>
</html>`;

    this.openReportWindow(reportHTML, 'Master Summary Report');
  },

  // ── 2. FREE ISSUES & PROMOTIONS REPORT (PDF) ─────────────────────────────
  async generateFreeIssuesPDF() {
    UI.showToast('Generating Free Issues PDF Report...', 'info');
    this.calculateDateRange();
    const companies = filterByTenant(await db.company.toArray());
    const company = companies.length > 0 ? companies[0] : await db.company.toCollection().first();

    const rawDeliveredSales = await db.sales.filter(s => {
      const d = new Date(s.date);
      return d >= this.startDate && d <= this.endDate && (s.status === 'Delivered' || !s.status);
    }).toArray();
    const deliveredSales = filterByTenant(rawDeliveredSales);

    const saleIds = deliveredSales.map(s => s.id);
    let allItems = [];
    if (saleIds.length > 0) {
      const rawItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
      allItems = filterByTenant(rawItems);
    }

    const freeItems = allItems.filter(i => (Number(i.freeQty) || 0) > 0);
    const periodLabel = this.getPeriodLabel();

    // Group by Product
    const prodMap = {};
    let totalFreeQty = 0;
    let totalRetailVal = 0;
    let totalCostVal = 0;

    for (const item of freeItems) {
      const key = item.productId || item.productName;
      if (!prodMap[key]) {
        prodMap[key] = { name: item.productName, unit: item.unit || 'pkt', freeQty: 0, retailVal: 0, costVal: 0, count: 0 };
      }
      const q = Number(item.freeQty) || 0;
      prodMap[key].freeQty += q;
      prodMap[key].retailVal += q * (Number(item.sellingPrice) || 0);
      prodMap[key].costVal += q * (Number(item.costPrice) || 0);
      prodMap[key].count += 1;

      totalFreeQty += q;
      totalRetailVal += q * (Number(item.sellingPrice) || 0);
      totalCostVal += q * (Number(item.costPrice) || 0);
    }

    // Group by Shop
    const shopMap = {};
    for (const s of deliveredSales) {
      const saleFreeItems = freeItems.filter(i => i.saleId === s.id);
      if (saleFreeItems.length > 0) {
        const shop = await db.shops.get(s.shopId);
        const route = await db.routes.get(s.routeId);
        const shopName = shop ? shop.name : 'Unknown Shop';
        if (!shopMap[s.shopId]) {
          shopMap[s.shopId] = { name: shopName, route: route ? route.name : '-', freeQty: 0, retailVal: 0, invoices: 0 };
        }
        for (const item of saleFreeItems) {
          const q = Number(item.freeQty) || 0;
          shopMap[s.shopId].freeQty += q;
          shopMap[s.shopId].retailVal += q * (Number(item.sellingPrice) || 0);
        }
        shopMap[s.shopId].invoices += 1;
      }
    }

    // Product rows
    let prodRows = '';
    for (const p of Object.values(prodMap)) {
      prodRows += `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td style="text-align:center;font-weight:bold;color:#7e22ce">${p.freeQty} ${p.unit}s</td>
          <td style="text-align:right">Rs. ${Number(p.costVal).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;font-weight:bold">Rs. ${Number(p.retailVal).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
        </tr>`;
    }

    // Shop rows
    let shopRows = '';
    for (const sh of Object.values(shopMap).sort((a,b) => b.freeQty - a.freeQty)) {
      shopRows += `
        <tr>
          <td>${sh.name}</td>
          <td>${sh.route}</td>
          <td style="text-align:center">${sh.invoices}</td>
          <td style="text-align:center;font-weight:bold;color:#7e22ce">${sh.freeQty} pkts</td>
          <td style="text-align:right">Rs. ${Number(sh.retailVal).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
        </tr>`;
    }

    const logoTag = company?.logoBase64
      ? `<img src="${company.logoBase64}" style="height:50px;object-fit:contain;">`
      : '<div style="font-size:26px;">🎁</div>';

    const reportHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Free Issues Report — ${company?.name || 'SPICE POS'} — ${periodLabel}</title>
<style>
${this.getBaseReportStyles('#7e22ce')}
</style>
</head>
<body>
<div class="report-header">
  <div class="company-block">
    ${logoTag}
    <div class="company-info">
      <h1>${company?.name || 'SPICE WHOLESALE POS'}</h1>
      <p>Free Issues & Promotion Schemes Log</p>
    </div>
  </div>
  <div class="report-meta">
    <h2>🎁 FREE ISSUES REPORT</h2>
    <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
    <div class="report-badge">📅 Period: ${periodLabel}</div>
  </div>
</div>

<div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
  <div class="kpi-card purple">
    <div class="kpi-label">Total Free Items Issued</div>
    <div class="kpi-value">${totalFreeQty} pkts / units</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Total Free Cost to Business</div>
    <div class="kpi-value">Rs. ${Number(totalCostVal).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
  <div class="kpi-card purple">
    <div class="kpi-label">Total Free Market Value Given</div>
    <div class="kpi-value">Rs. ${Number(totalRetailVal).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
</div>

<div class="section-title">📦 Product-Wise Free Issues Breakdown</div>
<table>
  <thead style="background:#581c87"><tr><th>Product Name</th><th style="text-align:center">Free Qty Given</th><th style="text-align:right">Cost Value</th><th style="text-align:right">Retail Value Given</th></tr></thead>
  <tbody>${prodRows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No free issues given in this period</td></tr>'}</tbody>
  <tfoot style="background:#faf5ff"><tr>
    <td>TOTAL</td>
    <td style="text-align:center;color:#7e22ce">${totalFreeQty} pkts</td>
    <td style="text-align:right">Rs. ${Number(totalCostVal).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
    <td style="text-align:right;color:#7e22ce">Rs. ${Number(totalRetailVal).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
  </tr></tfoot>
</table>

<div class="section-title" style="margin-top:16px;">🏪 Shop-Wise Free Issues Summary</div>
<table>
  <thead style="background:#581c87"><tr><th>Shop Name</th><th>Route</th><th style="text-align:center">Bills with Free Items</th><th style="text-align:center">Total Free Qty</th><th style="text-align:right">Free Value Received</th></tr></thead>
  <tbody>${shopRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">No shop free issues</td></tr>'}</tbody>
</table>

<div class="report-footer">
  <span>${company?.name || 'SPICE POS'} — Free Issues Audit Log</span>
  <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
</div>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 350));<\/script>
</body>
</html>`;

    this.openReportWindow(reportHTML, 'Free Issues Report');
  },

  // ── 3. RETURNS & DAMAGES REPORT (PDF) ────────────────────────────────────
  async generateReturnsPDF() {
    UI.showToast('Generating Returns & Damages PDF Report...', 'info');
    this.calculateDateRange();
    const companies = filterByTenant(await db.company.toArray());
    const company = companies.length > 0 ? companies[0] : await db.company.toCollection().first();

    let allReturns = [];
    if (typeof db !== 'undefined' && db.salesReturns) {
      try {
        const rawReturns = await db.salesReturns.filter(r => {
          const d = new Date(r.date);
          return d >= this.startDate && d <= this.endDate;
        }).toArray();
        allReturns = filterByTenant(rawReturns);
      } catch (e) {
        console.warn('Returns query error:', e);
      }
    }

    const periodLabel = this.getPeriodLabel();
    const totalReturnQty = allReturns.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const totalReturnValue = allReturns.reduce((s, r) => s + (Number(r.refundAmount) || 0), 0);

    // Group by Reason
    const reasonCounts = { Damaged: 0, Expired: 0, Exchange: 0, Other: 0 };
    for (const r of allReturns) {
      const reason = r.returnType || r.reason || 'Damaged';
      if (reasonCounts[reason] !== undefined) reasonCounts[reason] += (Number(r.qty) || 0);
      else reasonCounts.Other += (Number(r.qty) || 0);
    }

    // Detail rows
    let rows = '';
    for (const r of allReturns) {
      const shop = await db.shops.get(r.shopId);
      rows += `
        <tr>
          <td>${r.invoiceNo || '-'}</td>
          <td>${new Date(r.date).toLocaleDateString('en-GB')}</td>
          <td>${shop ? shop.name : 'Unknown Shop'}</td>
          <td><strong>${r.productName}</strong></td>
          <td><span class="badge-tag badge-rose">${r.returnType || r.reason || 'Damaged'}</span></td>
          <td style="text-align:center;font-weight:bold;color:#be123c">${r.qty}</td>
          <td style="text-align:right;color:#dc2626;font-weight:bold">Rs. ${Number(r.refundAmount).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
          <td>${r.action || 'Deducted from bill'}</td>
        </tr>`;
    }

    const logoTag = company?.logoBase64
      ? `<img src="${company.logoBase64}" style="height:50px;object-fit:contain;">`
      : '<div style="font-size:26px;">🔄</div>';

    const reportHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Returns & Damages Report — ${company?.name || 'SPICE POS'} — ${periodLabel}</title>
<style>
${this.getBaseReportStyles('#be123c')}
</style>
</head>
<body>
<div class="report-header">
  <div class="company-block">
    ${logoTag}
    <div class="company-info">
      <h1>${company?.name || 'SPICE WHOLESALE POS'}</h1>
      <p>Sales Returns, Damages & Expired Packets Audit</p>
    </div>
  </div>
  <div class="report-meta">
    <h2>🔄 RETURNS & DAMAGES REPORT</h2>
    <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
    <div class="report-badge">📅 Period: ${periodLabel}</div>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi-card red">
    <div class="kpi-label">Total Returned Packs</div>
    <div class="kpi-value">${totalReturnQty} pkts</div>
  </div>
  <div class="kpi-card red">
    <div class="kpi-label">Total Refund / Deduction</div>
    <div class="kpi-value">Rs. ${Number(totalReturnValue).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Damaged Packs</div>
    <div class="kpi-value">${reasonCounts.Damaged} pkts</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Expired / Other</div>
    <div class="kpi-value">${reasonCounts.Expired + reasonCounts.Other} pkts</div>
  </div>
</div>

<div class="section-title">📋 Detailed Returns & Damages Log</div>
<table>
  <thead style="background:#881337">
    <tr>
      <th>Invoice #</th>
      <th>Date</th>
      <th>Shop Name</th>
      <th>Product</th>
      <th>Condition</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">Refund / Value</th>
      <th>Action Taken</th>
    </tr>
  </thead>
  <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:#94a3b8">No returned items recorded in this period</td></tr>'}</tbody>
  <tfoot style="background:#fff1f2">
    <tr>
      <td colspan="5">TOTAL RETURNS</td>
      <td style="text-align:center;color:#be123c">${totalReturnQty} pkts</td>
      <td style="text-align:right;color:#dc2626">Rs. ${Number(totalReturnValue).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
      <td></td>
    </tr>
  </tfoot>
</table>

<div class="report-footer">
  <span>${company?.name || 'SPICE POS'} — Returns & Damage Control</span>
  <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
</div>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 350));<\/script>
</body>
</html>`;

    this.openReportWindow(reportHTML, 'Returns & Damages Report');
  },

  // ── 4. SALES & INVOICES REPORT (PDF) ─────────────────────────────────────
  async generateSalesPDF() {
    UI.showToast('Generating Sales & Invoices PDF Report...', 'info');
    this.calculateDateRange();
    const companies = filterByTenant(await db.company.toArray());
    const company = companies.length > 0 ? companies[0] : await db.company.toCollection().first();

    const rawDeliveredSales = await db.sales.filter(s => {
      const d = new Date(s.date);
      return d >= this.startDate && d <= this.endDate && (s.status === 'Delivered' || !s.status);
    }).toArray();
    const deliveredSales = filterByTenant(rawDeliveredSales);

    const totalRevenue = deliveredSales.reduce((s, x) => s + (x.totalAmount || 0), 0);
    const totalCost = deliveredSales.reduce((s, x) => s + (x.totalCost || 0), 0);
    const netProfit = totalRevenue - totalCost;
    const periodLabel = this.getPeriodLabel();

    let rows = '';
    for (const s of deliveredSales) {
      const shop = await db.shops.get(s.shopId);
      const route = await db.routes.get(s.routeId);
      rows += `
        <tr>
          <td><strong>${s.invoiceNo}</strong></td>
          <td>${new Date(s.date).toLocaleDateString('en-GB')}</td>
          <td>${shop ? shop.name : 'Unknown Shop'}</td>
          <td>${route ? route.name : '-'}</td>
          <td>${s.paymentType}</td>
          <td style="text-align:right">Rs. ${Number(s.paidAmount || 0).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;color:#dc2626">Rs. ${Number(s.creditAmount || 0).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;font-weight:bold">Rs. ${Number(s.totalAmount).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;color:#16a34a">Rs. ${Number(s.profit || 0).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
        </tr>`;
    }

    const logoTag = company?.logoBase64
      ? `<img src="${company.logoBase64}" style="height:50px;object-fit:contain;">`
      : '<div style="font-size:26px;">🛒</div>';

    const reportHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Sales & Invoices Report — ${company?.name || 'SPICE POS'} — ${periodLabel}</title>
<style>
${this.getBaseReportStyles('#0284c7')}
</style>
</head>
<body>
<div class="report-header">
  <div class="company-block">
    ${logoTag}
    <div class="company-info">
      <h1>${company?.name || 'SPICE WHOLESALE POS'}</h1>
      <p>Sales, Delivery & Invoice Register</p>
    </div>
  </div>
  <div class="report-meta">
    <h2>🛒 SALES & INVOICES REPORT</h2>
    <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
    <div class="report-badge">📅 Period: ${periodLabel}</div>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi-card blue">
    <div class="kpi-label">Delivered Invoices</div>
    <div class="kpi-value">${deliveredSales.length} bills</div>
  </div>
  <div class="kpi-card green">
    <div class="kpi-label">Total Revenue</div>
    <div class="kpi-value">Rs. ${Number(totalRevenue).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Cost of Goods</div>
    <div class="kpi-value">Rs. ${Number(totalCost).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
  <div class="kpi-card green">
    <div class="kpi-label">Net Profit</div>
    <div class="kpi-value">Rs. ${Number(netProfit).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
</div>

<div class="section-title">🧾 Delivered Invoices Log</div>
<table>
  <thead style="background:#0369a1">
    <tr>
      <th>Invoice #</th>
      <th>Date</th>
      <th>Shop Name</th>
      <th>Route</th>
      <th>Type</th>
      <th style="text-align:right">Paid (LKR)</th>
      <th style="text-align:right">Credit (LKR)</th>
      <th style="text-align:right">Total (LKR)</th>
      <th style="text-align:right">Profit (LKR)</th>
    </tr>
  </thead>
  <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:#94a3b8">No delivered sales in this period</td></tr>'}</tbody>
  <tfoot style="background:#f0f9ff">
    <tr>
      <td colspan="5">TOTAL (${deliveredSales.length} Invoices)</td>
      <td style="text-align:right">Rs. ${Number(deliveredSales.reduce((s,x)=>s+(x.paidAmount||0),0)).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;color:#dc2626">Rs. ${Number(deliveredSales.reduce((s,x)=>s+(x.creditAmount||0),0)).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;font-weight:bold">Rs. ${Number(totalRevenue).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;color:#16a34a">Rs. ${Number(netProfit).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
    </tr>
  </tfoot>
</table>

<div class="report-footer">
  <span>${company?.name || 'SPICE POS'} — Sales Register</span>
  <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
</div>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 350));<\/script>
</body>
</html>`;

    this.openReportWindow(reportHTML, 'Sales Report');
  },

  // ── 5. COLLECTIONS & CREDIT RECOVERY REPORT (PDF) ────────────────────────
  async generateCollectionsPDF() {
    UI.showToast('Generating Collections & Debtors PDF Report...', 'info');
    this.calculateDateRange();
    const companies = filterByTenant(await db.company.toArray());
    const company = companies.length > 0 ? companies[0] : await db.company.toCollection().first();

    const rawPayments = await db.creditPayments.filter(p => {
      const d = new Date(p.date);
      return d >= this.startDate && d <= this.endDate;
    }).toArray();
    const payments = filterByTenant(rawPayments);

    const totalCollected = payments.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
    const rawDebtors = await db.shops.filter(s => s.currentCredit > 0).toArray();
    const debtorShops = filterByTenant(rawDebtors);
    const totalOutstanding = debtorShops.reduce((s, x) => s + x.currentCredit, 0);
    const periodLabel = this.getPeriodLabel();

    let payRows = '';
    for (const p of payments) {
      const shop = await db.shops.get(p.shopId);
      const route = await db.routes.get(p.routeId || shop?.routeId);
      payRows += `
        <tr>
          <td>${new Date(p.date).toLocaleString('en-GB')}</td>
          <td><strong>${shop ? shop.name : 'Unknown Shop'}</strong></td>
          <td>${route ? route.name : '-'}</td>
          <td>${p.repName || 'Cashier / Admin'}</td>
          <td style="text-align:right;font-weight:bold;color:#15803d">Rs. ${Number(p.amountPaid).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
          <td style="text-align:right">Rs. ${Number(p.newCredit || 0).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
          <td>${p.note || '-'}</td>
        </tr>`;
    }

    let debtorRows = '';
    for (const s of debtorShops.sort((a,b) => b.currentCredit - a.currentCredit)) {
      const route = await db.routes.get(s.routeId);
      debtorRows += `
        <tr>
          <td><strong>${s.name}</strong></td>
          <td>${s.ownerName || '-'}</td>
          <td>${route ? route.name : '-'}</td>
          <td>${s.phone || '-'}</td>
          <td style="text-align:right;color:#dc2626;font-weight:bold">Rs. ${Number(s.currentCredit).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
        </tr>`;
    }

    const logoTag = company?.logoBase64
      ? `<img src="${company.logoBase64}" style="height:50px;object-fit:contain;">`
      : '<div style="font-size:26px;">💳</div>';

    const reportHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Collections & Debtors Report — ${company?.name || 'SPICE POS'} — ${periodLabel}</title>
<style>
${this.getBaseReportStyles('#059669')}
</style>
</head>
<body>
<div class="report-header">
  <div class="company-block">
    ${logoTag}
    <div class="company-info">
      <h1>${company?.name || 'SPICE WHOLESALE POS'}</h1>
      <p>Credit Collections & Outstanding Balance Log</p>
    </div>
  </div>
  <div class="report-meta">
    <h2>💳 COLLECTIONS & DEBTORS REPORT</h2>
    <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
    <div class="report-badge">📅 Period: ${periodLabel}</div>
  </div>
</div>

<div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
  <div class="kpi-card green">
    <div class="kpi-label">Debt Recovered in Period</div>
    <div class="kpi-value">Rs. ${Number(totalCollected).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Collections Logged</div>
    <div class="kpi-value">${payments.length} transactions</div>
  </div>
  <div class="kpi-card red">
    <div class="kpi-label">Total Outstanding Shop Debt</div>
    <div class="kpi-value">Rs. ${Number(totalOutstanding).toLocaleString('en-LK', {minimumFractionDigits:2})}</div>
  </div>
</div>

<div class="section-title">💵 Payments Collected in Period</div>
<table>
  <thead style="background:#047857"><tr><th>Date / Time</th><th>Shop Name</th><th>Route</th><th>Collected By</th><th style="text-align:right">Amount Paid</th><th style="text-align:right">Remaining Credit</th><th>Note</th></tr></thead>
  <tbody>${payRows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8">No credit payments collected in this period</td></tr>'}</tbody>
  <tfoot style="background:#ecfdf5"><tr>
    <td colspan="4">TOTAL COLLECTED</td>
    <td style="text-align:right;color:#15803d;font-weight:bold">Rs. ${Number(totalCollected).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
    <td colspan="2"></td>
  </tr></tfoot>
</table>

<div class="section-title" style="margin-top:16px;border-color:#dc2626">⚠️ Current Outstanding Debtors (${debtorShops.length} Shops)</div>
<table>
  <thead style="background:#7f1d1d"><tr><th>Shop Name</th><th>Owner Name</th><th>Route</th><th>Phone</th><th style="text-align:right">Outstanding Debt</th></tr></thead>
  <tbody>${debtorRows || '<tr><td colspan="5" style="text-align:center;color:#16a34a">✓ No outstanding credit</td></tr>'}</tbody>
  <tfoot style="background:#fff1f2"><tr>
    <td colspan="4" style="color:#dc2626">TOTAL OUTSTANDING</td>
    <td style="text-align:right;color:#dc2626">Rs. ${Number(totalOutstanding).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
  </tr></tfoot>
</table>

<div class="report-footer">
  <span>${company?.name || 'SPICE POS'} — Collections Register</span>
  <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
</div>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 350));<\/script>
</body>
</html>`;

    this.openReportWindow(reportHTML, 'Collections Report');
  },

  // ── 6. PRODUCT MOVEMENT & STOCK OUTFLOW REPORT (PDF) ─────────────────────
  async generateProductMovementPDF() {
    UI.showToast('Generating Stock Movement PDF Report...', 'info');
    this.calculateDateRange();
    const companies = filterByTenant(await db.company.toArray());
    const company = companies.length > 0 ? companies[0] : await db.company.toCollection().first();

    const rawDeliveredSales = await db.sales.filter(s => {
      const d = new Date(s.date);
      return d >= this.startDate && d <= this.endDate && (s.status === 'Delivered' || !s.status);
    }).toArray();
    const deliveredSales = filterByTenant(rawDeliveredSales);

    const saleIds = deliveredSales.map(s => s.id);
    let allItems = [];
    if (saleIds.length > 0) {
      const rawItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
      allItems = filterByTenant(rawItems);
    }

    let allReturns = [];
    if (typeof db !== 'undefined' && db.salesReturns) {
      try {
        const rawReturns = await db.salesReturns.filter(r => {
          const d = new Date(r.date);
          return d >= this.startDate && d <= this.endDate;
        }).toArray();
        allReturns = filterByTenant(rawReturns);
      } catch (e) {
        console.warn('Returns query error:', e);
      }
    }

    const periodLabel = this.getPeriodLabel();

    // Group movement by Product
    const moveStats = {};
    for (const item of allItems) {
      const key = item.productId || item.productName;
      if (!moveStats[key]) {
        moveStats[key] = {
          name: item.productName,
          unit: item.unit || 'pkt',
          soldQty: 0,
          freeQty: 0,
          returnQty: 0,
          revenue: 0,
          profit: 0
        };
      }
      moveStats[key].soldQty += (Number(item.qty) || 0);
      moveStats[key].freeQty += (Number(item.freeQty) || 0);
      moveStats[key].revenue += (Number(item.subtotal) || 0);
      moveStats[key].profit += (Number(item.profit) || 0);
    }

    for (const r of allReturns) {
      const key = r.productId || r.productName;
      if (!moveStats[key]) {
        moveStats[key] = {
          name: r.productName,
          unit: 'pkt',
          soldQty: 0,
          freeQty: 0,
          returnQty: 0,
          revenue: 0,
          profit: 0
        };
      }
      moveStats[key].returnQty += (Number(r.qty) || 0);
    }

    let totalSold = 0;
    let totalFree = 0;
    let totalRet = 0;
    let totalNetOutflow = 0;
    let totalRev = 0;

    let rows = '';
    for (const p of Object.values(moveStats).sort((a,b) => (b.soldQty + b.freeQty) - (a.soldQty + a.freeQty))) {
      const netOut = p.soldQty + p.freeQty - p.returnQty;
      totalSold += p.soldQty;
      totalFree += p.freeQty;
      totalRet += p.returnQty;
      totalNetOutflow += netOut;
      totalRev += p.revenue;

      rows += `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td style="text-align:center">${p.soldQty} ${p.unit}s</td>
          <td style="text-align:center">${p.freeQty > 0 ? `<span class="badge-tag badge-purple">+${p.freeQty} Free</span>` : '-'}</td>
          <td style="text-align:center">${p.returnQty > 0 ? `<span class="badge-tag badge-rose">-${p.returnQty} Ret</span>` : '-'}</td>
          <td style="text-align:center;font-weight:bold;color:#0f172a">${netOut} ${p.unit}s</td>
          <td style="text-align:right">Rs. ${Number(p.revenue).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;color:#16a34a">Rs. ${Number(p.profit).toLocaleString('en-LK', {minimumFractionDigits:2})}</td>
        </tr>`;
    }

    const logoTag = company?.logoBase64
      ? `<img src="${company.logoBase64}" style="height:50px;object-fit:contain;">`
      : '<div style="font-size:26px;">📦</div>';

    const reportHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Product Stock Outflow Report — ${company?.name || 'SPICE POS'} — ${periodLabel}</title>
<style>
${this.getBaseReportStyles('#d97706')}
</style>
</head>
<body>
<div class="report-header">
  <div class="company-block">
    ${logoTag}
    <div class="company-info">
      <h1>${company?.name || 'SPICE WHOLESALE POS'}</h1>
      <p>Product Movement, Schemes & Stock Outflow Matrix</p>
    </div>
  </div>
  <div class="report-meta">
    <h2>📦 STOCK MOVEMENT REPORT</h2>
    <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
    <div class="report-badge">📅 Period: ${periodLabel}</div>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi-card green">
    <div class="kpi-label">Total Sold Packs</div>
    <div class="kpi-value">${totalSold} pkts</div>
  </div>
  <div class="kpi-card purple">
    <div class="kpi-label">Total Free Schemes</div>
    <div class="kpi-value">${totalFree} pkts</div>
  </div>
  <div class="kpi-card red">
    <div class="kpi-label">Total Returned</div>
    <div class="kpi-value">${totalRet} pkts</div>
  </div>
  <div class="kpi-card amber">
    <div class="kpi-label">Net Stock Outflow</div>
    <div class="kpi-value">${totalNetOutflow} pkts</div>
  </div>
</div>

<div class="section-title">📊 Product Movement & Net Outflow Matrix (Sold + Free - Returned)</div>
<table>
  <thead style="background:#78350f">
    <tr>
      <th>Product Name</th>
      <th style="text-align:center">Sold Qty</th>
      <th style="text-align:center">Free Issues</th>
      <th style="text-align:center">Returns</th>
      <th style="text-align:center">Net Outflow</th>
      <th style="text-align:right">Revenue (LKR)</th>
      <th style="text-align:right">Profit (LKR)</th>
    </tr>
  </thead>
  <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8">No product movement in this period</td></tr>'}</tbody>
  <tfoot style="background:#fffbeb">
    <tr>
      <td>TOTAL</td>
      <td style="text-align:center">${totalSold}</td>
      <td style="text-align:center;color:#7e22ce">${totalFree}</td>
      <td style="text-align:center;color:#be123c">${totalRet}</td>
      <td style="text-align:center;font-weight:bold">${totalNetOutflow}</td>
      <td style="text-align:right">Rs. ${Number(totalRev).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
      <td></td>
    </tr>
  </tfoot>
</table>

<div class="report-footer">
  <span>${company?.name || 'SPICE POS'} — Stock Velocity & Outflow</span>
  <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
</div>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 350));<\/script>
</body>
</html>`;

    this.openReportWindow(reportHTML, 'Stock Movement Report');
  },

  // ── CSV EXPORTS ───────────────────────────────────────────────────────────
  downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  },

  async exportSalesCSV() {
    this.calculateDateRange();
    const rawSales = await db.sales
      .filter(s => {
        const d = new Date(s.date);
        return d >= this.startDate && d <= this.endDate;
      })
      .toArray();
    const sales = filterByTenant(rawSales);

    if (sales.length === 0) {
      UI.showToast('No sales data to export', 'warning');
      return;
    }

    let csv = 'Invoice No,Date,Delivery Date,Status,Shop Name,Route Name,Payment Type,Total Amount,Total Cost,Profit,Paid Amount,Credit Amount\n';
    for (const s of sales) {
      const shop = await db.shops.get(s.shopId);
      const route = await db.routes.get(s.routeId);
      const row = [
        `"${s.invoiceNo}"`,
        `"${new Date(s.date).toLocaleString()}"`,
        `"${s.deliveryDate || ''}"`,
        `"${s.status || 'Delivered'}"`,
        `"${shop ? shop.name.replace(/"/g, '""') : 'Unknown'}"`,
        `"${route ? route.name.replace(/"/g, '""') : 'Unknown'}"`,
        `"${s.paymentType}"`,
        s.totalAmount,
        s.totalCost,
        s.profit,
        s.paidAmount,
        s.creditAmount
      ];
      csv += row.join(',') + '\n';
    }

    this.downloadFile(csv, `sales_report_${this.startDate.toISOString().split('T')[0]}.csv`, 'text/csv');
    UI.showToast('Sales CSV exported successfully!', 'success');
  },

  async exportDebtorsCSV() {
    const rawShops = await db.shops.filter(s => s.currentCredit > 0).toArray();
    const shops = filterByTenant(rawShops);
    if (shops.length === 0) {
      UI.showToast('No outstanding credit records', 'warning');
      return;
    }

    let csv = 'Shop ID,Shop Name,Owner Name,Phone,Route,Outstanding Credit (LKR)\n';
    for (const s of shops) {
      const route = await db.routes.get(s.routeId);
      const row = [
        s.id,
        `"${s.name.replace(/"/g, '""')}"`,
        `"${(s.ownerName || '').replace(/"/g, '""')}"`,
        `"${s.phone || ''}"`,
        `"${route ? route.name.replace(/"/g, '""') : 'Unknown'}"`,
        s.currentCredit
      ];
      csv += row.join(',') + '\n';
    }

    this.downloadFile(csv, `debtors_report_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    UI.showToast('Debtors CSV exported successfully!', 'success');
  },

  async exportFreeIssuesCSV() {
    this.calculateDateRange();
    const rawSales = await db.sales
      .filter(s => {
        const d = new Date(s.date);
        return d >= this.startDate && d <= this.endDate && (s.status === 'Delivered' || !s.status);
      })
      .toArray();
    const sales = filterByTenant(rawSales);

    const saleIds = sales.map(s => s.id);
    let allItems = [];
    if (saleIds.length > 0) {
      const rawItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
      allItems = filterByTenant(rawItems);
    }

    const freeItems = allItems.filter(i => (Number(i.freeQty) || 0) > 0);
    if (freeItems.length === 0) {
      UI.showToast('No free issues data in this period', 'warning');
      return;
    }

    let csv = 'Sale ID,Product Name,Free Qty,Unit,Selling Price,Retail Value,Cost Price,Cost Value\n';
    for (const f of freeItems) {
      const fQty = Number(f.freeQty) || 0;
      const sp = Number(f.sellingPrice) || 0;
      const cp = Number(f.costPrice) || 0;
      csv += `"${f.saleId}","${f.productName.replace(/"/g, '""')}",${fQty},"${f.unit || 'pkt'}",${sp},${fQty * sp},${cp},${fQty * cp}\n`;
    }

    this.downloadFile(csv, `free_issues_${this.startDate.toISOString().split('T')[0]}.csv`, 'text/csv');
    UI.showToast('Free Issues CSV exported successfully!', 'success');
  },

  async exportReturnsCSV() {
    this.calculateDateRange();
    let allReturns = [];
    if (typeof db !== 'undefined' && db.salesReturns) {
      const rawReturns = await db.salesReturns.filter(r => {
        const d = new Date(r.date);
        return d >= this.startDate && d <= this.endDate;
      }).toArray();
      allReturns = filterByTenant(rawReturns);
    }

    if (allReturns.length === 0) {
      UI.showToast('No returns data in this period', 'warning');
      return;
    }

    let csv = 'Return ID,Invoice No,Date,Shop ID,Product Name,Return Type,Qty,Refund Amount,Action,Reason\n';
    for (const r of allReturns) {
      csv += `${r.id},"${r.invoiceNo || ''}","${new Date(r.date).toLocaleString()}","${r.shopId || ''}","${(r.productName || '').replace(/"/g, '""')}","${r.returnType || ''}",${r.qty || 0},${r.refundAmount || 0},"${(r.action || '').replace(/"/g, '""')}","${(r.reason || '').replace(/"/g, '""')}"\n`;
    }

    this.downloadFile(csv, `returns_${this.startDate.toISOString().split('T')[0]}.csv`, 'text/csv');
    UI.showToast('Returns CSV exported successfully!', 'success');
  },

  // ── Admin & HR: Special Trade Discounts & Free Schemes Audit ──────────────
  async renderSpecialDiscountsAudit() {
    const tbody = document.getElementById('report-special-deals-table-body');
    const markdownEl = document.getElementById('report-promo-total-markdown');
    const freeQtyEl = document.getElementById('report-promo-total-free-qty');
    const freeCostEl = document.getElementById('report-promo-total-free-cost');
    const subsidyEl = document.getElementById('report-promo-total-subsidy');
    const profitEl = document.getElementById('report-promo-company-profit');
    const marginEl = document.getElementById('report-promo-profit-margin');

    // Populate Rep & Route filter dropdowns on first run
    const repSel = document.getElementById('report-promo-filter-rep');
    const routeSel = document.getElementById('report-promo-filter-route');
    if (repSel && repSel.options.length <= 1) {
      const rawReps = filterByTenant(await db.users.toArray());
      const reps = rawReps.filter(u => u.role === 'rep' || u.role === 'supervisor');
      reps.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.fullName || r.username;
        repSel.appendChild(opt);
      });
    }
    if (routeSel && routeSel.options.length <= 1) {
      const rawRoutes = filterByTenant(await db.routes.toArray());
      rawRoutes.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        routeSel.appendChild(opt);
      });
    }

    const filterRep = repSel?.value || 'all';
    const filterRoute = routeSel?.value || 'all';
    const filterType = document.getElementById('report-promo-filter-type')?.value || 'all';

    const allSales = this._lastPromoSales || [];
    const allItems = this._lastPromoItems || [];

    // Match items to sales
    const salesMap = {};
    for (const s of allSales) salesMap[s.id] = s;

    // Filter to only promotional line items
    let promoItems = allItems.filter(item => {
      const isDeal = (item.isSpecialDeal === true) ||
        ((Number(item.freeQty) || 0) > 0) ||
        (item.standardPrice && item.standardPrice > item.sellingPrice) ||
        (Number(item.priceDiscount) > 0);
      return isDeal;
    });

    // Apply sale-level rep/route filters
    promoItems = promoItems.filter(item => {
      const sale = salesMap[item.saleId];
      if (!sale) return false;
      if (filterRep !== 'all' && String(sale.repId) !== String(filterRep)) return false;
      if (filterRoute !== 'all' && String(sale.routeId) !== String(filterRoute)) return false;
      return true;
    });

    // Apply deal type filter
    if (filterType !== 'all') {
      promoItems = promoItems.filter(item => {
        const t = item.dealType || '';
        return t === filterType;
      });
    }

    if (!tbody) return;

    if (promoItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-6 text-slate-400 text-xs font-bold">
            ✓ No special trade deals or promotional discounts found in this period.
          </td>
        </tr>
      `;
      if (markdownEl) markdownEl.textContent = UI.formatCurrency(0);
      if (freeQtyEl) freeQtyEl.textContent = '0 units';
      if (freeCostEl) freeCostEl.textContent = 'COGS: Rs. 0.00';
      if (subsidyEl) subsidyEl.textContent = UI.formatCurrency(0);
      if (profitEl) profitEl.textContent = UI.formatCurrency(0);
      if (marginEl) marginEl.textContent = 'Margin: 0%';
      return;
    }

    // Fetch shops map for address & phone
    const shopIds = [...new Set(allSales.map(s => s.shopId).filter(Boolean))];
    const shopsArr = shopIds.length > 0 ? filterByTenant(await db.shops.where('id').anyOf(shopIds).toArray()) : [];
    const shopMap = {};
    for (const sh of shopsArr) shopMap[sh.id] = sh;

    // KPI totals
    let totalMarkdown = 0;
    let totalFreeQty = 0;
    let totalFreeCOGS = 0;
    let totalBilledRevenue = 0;
    let totalCOGS = 0;

    let html = '';
    for (const item of promoItems) {
      const sale = salesMap[item.saleId];
      if (!sale) continue;
      const shop = shopMap[sale.shopId] || {};

      const qty = Number(item.qty) || 0;
      const fQ = Number(item.freeQty) || 0;
      const stdPrice = Number(item.standardPrice || item.sellingPrice) || 0;
      const sellPrice = Number(item.sellingPrice) || 0;
      const costPrice = Number(item.costPrice) || 0;
      const markdown = Math.max(0, stdPrice - sellPrice) * qty;
      const freeCOGS = fQ * costPrice;
      const subsidy = markdown + freeCOGS;
      const billedSubtotal = qty * sellPrice;
      const totalLineCOGS = (qty + fQ) * costPrice;
      const lineProfit = billedSubtotal - totalLineCOGS;
      const marginPct = billedSubtotal > 0 ? ((lineProfit / billedSubtotal) * 100).toFixed(1) : '0.0';

      totalMarkdown += markdown;
      totalFreeQty += fQ;
      totalFreeCOGS += freeCOGS;
      totalBilledRevenue += billedSubtotal;
      totalCOGS += totalLineCOGS;

      // Audit badge
      let badge = '';
      if (sellPrice < costPrice) {
        badge = `<span class="px-1.5 py-0.5 rounded-lg text-[9px] font-black bg-red-100 text-red-800 border border-red-300">🚨 BELOW COST</span>`;
      } else if (lineProfit < 0) {
        badge = `<span class="px-1.5 py-0.5 rounded-lg text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300">🔴 LOSS DEAL</span>`;
      } else if (Number(marginPct) < 10) {
        badge = `<span class="px-1.5 py-0.5 rounded-lg text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300">🟡 LOW MARGIN</span>`;
      } else if (fQ > 30 || subsidy > 500) {
        badge = `<span class="px-1.5 py-0.5 rounded-lg text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-300">🟣 HEAVY FREE</span>`;
      } else {
        badge = `<span class="px-1.5 py-0.5 rounded-lg text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">🟢 STANDARD</span>`;
      }

      const dealLabel = {
        'volume_scheme': '🎁 Volume Slab',
        'net_rate': '🏷️ Net Rate',
        'heavy_free': '🔥 VIP Heavy Free',
        'custom': '🤝 Custom Deal',
        'standard': '—'
      }[item.dealType || 'standard'] || item.dealType || '—';

      const priceInfo = stdPrice > sellPrice
        ? `<span class="font-black text-amber-900">Rs. ${sellPrice.toFixed(0)}</span> <s class="text-slate-400 text-[9px]">Rs. ${stdPrice.toFixed(0)}</s>`
        : `Rs. ${sellPrice.toFixed(0)}`;

      html += `
        <tr class="hover:bg-slate-50 ${lineProfit < 0 ? 'bg-red-50/30' : ''}">
          <td class="p-2 whitespace-nowrap">
            <div class="font-bold text-slate-900">${UI.formatDate ? UI.formatDate(sale.date) : new Date(sale.date).toLocaleDateString()}</div>
            <div class="text-[10px] text-indigo-700 font-black">${sale.invoiceNo || ''}</div>
          </td>
          <td class="p-2">
            <div class="font-bold text-slate-900 text-[11px]">${shop.name || 'Unknown'}</div>
            <div class="text-[10px] text-slate-500">${shop.address || shop.area || '—'}</div>
            <div class="text-[10px] text-slate-500 font-medium">${shop.ownerName ? `👤 ${shop.ownerName}` : ''} ${shop.phone ? `📞 ${shop.phone}` : ''}</div>
          </td>
          <td class="p-2">
            <div class="font-bold text-slate-900 text-[11px]">${sale.repName || '—'}</div>
          </td>
          <td class="p-2">
            <div class="font-bold text-slate-900 text-[11px]">${item.productName}</div>
            <div class="text-[10px] text-slate-500">${qty} ${item.unit || 'pcs'} billed${fQ > 0 ? ` + ${fQ} Free` : ''}</div>
            <div class="text-[10px] text-purple-700 font-black">${dealLabel}</div>
          </td>
          <td class="p-2">
            <div class="text-[11px]">${priceInfo}</div>
            ${fQ > 0 ? `<div class="text-[10px] font-black text-purple-700">+${fQ} Free ✕ Rs. ${costPrice.toFixed(0)} COGS</div>` : ''}
          </td>
          <td class="p-2 text-right">
            <div class="font-black text-rose-700">${UI.formatCurrency(subsidy)}</div>
            ${markdown > 0 ? `<div class="text-[9px] text-amber-700">Markdown: Rs. ${markdown.toFixed(0)}</div>` : ''}
            ${freeCOGS > 0 ? `<div class="text-[9px] text-purple-700">Free COGS: Rs. ${freeCOGS.toFixed(0)}</div>` : ''}
          </td>
          <td class="p-2 text-right">
            <div class="font-black ${lineProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}">${UI.formatCurrency(lineProfit)}</div>
            <div class="text-[9px] text-slate-500">${marginPct}% margin</div>
          </td>
          <td class="p-2 text-center">${badge}</td>
        </tr>
      `;
    }
    tbody.innerHTML = html;

    // Update KPI cards
    const totalSubsidy = totalMarkdown + totalFreeCOGS;
    const totalProfit = totalBilledRevenue - totalCOGS;
    const overallMargin = totalBilledRevenue > 0 ? ((totalProfit / totalBilledRevenue) * 100).toFixed(1) : '0.0';

    if (markdownEl) markdownEl.textContent = UI.formatCurrency(totalMarkdown);
    if (freeQtyEl) freeQtyEl.textContent = `${totalFreeQty} units`;
    if (freeCostEl) freeCostEl.textContent = `COGS: ${UI.formatCurrency(totalFreeCOGS)}`;
    if (subsidyEl) subsidyEl.textContent = UI.formatCurrency(totalSubsidy);
    if (profitEl) profitEl.textContent = UI.formatCurrency(totalProfit);
    if (marginEl) marginEl.textContent = `Margin: ${overallMargin}%`;
  },

  // ── Generate A4 PDF: Special Trade Deals & Net Rate Audit ────────────────
  async generateSpecialDiscountsPDF() {
    UI.showToast('Generating Trade Deals & Free Schemes Audit PDF...', 'info');
    this.calculateDateRange();

    const companies = filterByTenant(await db.company.toArray());
    const company = companies.length > 0 ? companies[0] : { name: 'Wholesale Distributors' };

    const rawSales = await db.sales.filter(s => {
      const d = new Date(s.date);
      return d >= this.startDate && d <= this.endDate;
    }).toArray();
    const allSales = filterByTenant(rawSales).filter(s => s.status !== 'Cancelled');
    const saleIds = allSales.map(s => s.id);

    let allItems = [];
    if (saleIds.length > 0) {
      const rawItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
      allItems = filterByTenant(rawItems);
    }

    const promoItems = allItems.filter(item => {
      return (item.isSpecialDeal === true) ||
        ((Number(item.freeQty) || 0) > 0) ||
        (item.standardPrice && item.standardPrice > item.sellingPrice) ||
        (Number(item.priceDiscount) > 0);
    });

    const salesMap = {};
    for (const s of allSales) salesMap[s.id] = s;
    const shopIds = [...new Set(allSales.map(s => s.shopId).filter(Boolean))];
    const shopsArr = shopIds.length > 0 ? filterByTenant(await db.shops.where('id').anyOf(shopIds).toArray()) : [];
    const shopMap = {};
    for (const sh of shopsArr) shopMap[sh.id] = sh;

    let totalMarkdown = 0, totalFreeQty = 0, totalFreeCOGS = 0, totalBilled = 0, totalCOGS = 0;

    let rows = '';
    for (const item of promoItems) {
      const sale = salesMap[item.saleId];
      if (!sale) continue;
      const shop = shopMap[sale.shopId] || {};
      const qty = Number(item.qty) || 0;
      const fQ = Number(item.freeQty) || 0;
      const stdPrice = Number(item.standardPrice || item.sellingPrice) || 0;
      const sellPrice = Number(item.sellingPrice) || 0;
      const costPrice = Number(item.costPrice) || 0;
      const markdown = Math.max(0, stdPrice - sellPrice) * qty;
      const freeCOGS = fQ * costPrice;
      const subsidy = markdown + freeCOGS;
      const billed = qty * sellPrice;
      const cogs = (qty + fQ) * costPrice;
      const profit = billed - cogs;
      const marginPct = billed > 0 ? ((profit / billed) * 100).toFixed(1) : '0.0';

      totalMarkdown += markdown;
      totalFreeQty += fQ;
      totalFreeCOGS += freeCOGS;
      totalBilled += billed;
      totalCOGS += cogs;

      const badgeColor = profit < 0 ? '#dc2626' : (Number(marginPct) < 10 ? '#d97706' : '#16a34a');
      const badgeLabel = profit < 0 ? 'LOSS' : (Number(marginPct) < 10 ? 'LOW MARGIN' : 'OK');

      rows += `
        <tr>
          <td>${new Date(sale.date).toLocaleDateString('si-LK')}<br/><span style="font-size:8px;color:#6366f1;font-weight:900">${sale.invoiceNo || ''}</span></td>
          <td><b>${shop.name || '—'}</b><br/><span style="font-size:8px;color:#64748b">${shop.address || shop.area || ''}</span><br/><span style="font-size:8px;color:#475569">${shop.ownerName || ''} ${shop.phone || ''}</span></td>
          <td>${sale.repName || '—'}</td>
          <td><b>${item.productName}</b><br/>${qty}${item.unit || ''} billed${fQ > 0 ? ` +${fQ} FREE` : ''}</td>
          <td style="text-align:right">Rs. ${sellPrice.toFixed(2)}<br/>${stdPrice > sellPrice ? `<s style="font-size:8px;color:#94a3b8">Rs. ${stdPrice.toFixed(0)}</s>` : ''}</td>
          <td style="text-align:right;color:#7c3aed;font-weight:900">Rs. ${subsidy.toFixed(2)}</td>
          <td style="text-align:right;font-weight:900;color:${profit >= 0 ? '#15803d' : '#dc2626'}">Rs. ${profit.toFixed(2)}</td>
          <td style="text-align:center"><span style="background:${badgeColor};color:#fff;padding:2px 5px;border-radius:3px;font-size:8px;font-weight:900">${badgeLabel}</span></td>
        </tr>
      `;
    }

    const totalSubsidy = totalMarkdown + totalFreeCOGS;
    const totalProfit = totalBilled - totalCOGS;
    const margin = totalBilled > 0 ? ((totalProfit / totalBilled) * 100).toFixed(1) : '0.0';
    const css = this.getBaseReportStyles('#7c3aed');
    const dateRange = `${this.startDate.toLocaleDateString()} – ${this.endDate.toLocaleDateString()}`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Trade Deals Audit</title><style>${css}</style></head><body>
      <div class="report-header">
        <div class="company-block"><div class="company-info"><h1>${company.name || 'Wholesale Distributors'}</h1><p>${company.address || ''} ${company.phone || ''}</p></div></div>
        <div class="report-meta"><h2>Trade Deals & Free Schemes Audit</h2><p>Period: ${dateRange}</p><div class="report-badge">Admin & HR Confidential</div></div>
      </div>
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi-card amber"><div class="kpi-label">Unit Price Markdown</div><div class="kpi-value">Rs. ${totalMarkdown.toFixed(2)}</div></div>
        <div class="kpi-card purple"><div class="kpi-label">Free Units Given</div><div class="kpi-value">${totalFreeQty} units<br/><span style="font-size:10px">COGS: Rs. ${totalFreeCOGS.toFixed(0)}</span></div></div>
        <div class="kpi-card red"><div class="kpi-label">Total Subsidy Absorbed</div><div class="kpi-value">Rs. ${totalSubsidy.toFixed(2)}</div></div>
        <div class="kpi-card green"><div class="kpi-label">Company Net Profit (${margin}%)</div><div class="kpi-value" style="color:${totalProfit >= 0 ? '#15803d' : '#dc2626'}">Rs. ${totalProfit.toFixed(2)}</div></div>
      </div>
      <div class="section-title">Promotional Deals Line Item Audit</div>
      ${promoItems.length === 0 ? '<p style="text-align:center;color:#94a3b8;padding:16px">No promotional deals found in this period.</p>' : `
      <table>
        <thead><tr><th>Date & Inv</th><th>Shop Name, Address & Owner</th><th>Rep</th><th>Product & Qty</th><th style="text-align:right">Rate Given</th><th style="text-align:right">Subsidy Absorbed</th><th style="text-align:right">Company Profit</th><th style="text-align:center">Status</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="5"><b>Period Totals</b></td><td style="text-align:right"><b>Rs. ${totalSubsidy.toFixed(2)}</b></td><td style="text-align:right" style="color:${totalProfit>=0?'#15803d':'#dc2626'}"><b>Rs. ${totalProfit.toFixed(2)}</b></td><td style="text-align:center"><b>${margin}% Margin</b></td></tr></tfoot>
      </table>`}
      <div class="report-footer"><span>Generated: ${new Date().toLocaleString()}</span><span>CONFIDENTIAL – Admin & HR Use Only</span></div>
    </body></html>`;

    this.openReportWindow(html, 'Trade Deals Audit');
  },

  // ── CSV Export: Special Trade Deals ──────────────────────────────────────
  async exportSpecialDiscountsCSV() {
    this.calculateDateRange();
    const rawSales = await db.sales.filter(s => {
      const d = new Date(s.date);
      return d >= this.startDate && d <= this.endDate;
    }).toArray();
    const allSales = filterByTenant(rawSales).filter(s => s.status !== 'Cancelled');
    const saleIds = allSales.map(s => s.id);

    let allItems = [];
    if (saleIds.length > 0) {
      const rawItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
      allItems = filterByTenant(rawItems);
    }

    const promoItems = allItems.filter(item =>
      (item.isSpecialDeal === true) ||
      ((Number(item.freeQty) || 0) > 0) ||
      (item.standardPrice && item.standardPrice > item.sellingPrice) ||
      (Number(item.priceDiscount) > 0)
    );

    const salesMap = {};
    for (const s of allSales) salesMap[s.id] = s;
    const shopIds = [...new Set(allSales.map(s => s.shopId).filter(Boolean))];
    const shopsArr = shopIds.length > 0 ? filterByTenant(await db.shops.where('id').anyOf(shopIds).toArray()) : [];
    const shopMap = {};
    for (const sh of shopsArr) shopMap[sh.id] = sh;

    if (promoItems.length === 0) {
      UI.showToast('No special deals data in this period', 'warning');
      return;
    }

    let csv = 'Date,Invoice No,Shop Name,Shop Address,Shop Phone,Owner,Route ID,Sales Rep,Product,Qty,Free Qty,Standard Price,Billed Price,Unit Markdown,Billed Subtotal,Free COGS,Total Subsidy,Company Profit,Margin %,Deal Type,Deal Note\n';
    for (const item of promoItems) {
      const sale = salesMap[item.saleId] || {};
      const shop = shopMap[sale.shopId] || {};
      const qty = Number(item.qty) || 0;
      const fQ = Number(item.freeQty) || 0;
      const stdPrice = Number(item.standardPrice || item.sellingPrice) || 0;
      const sellPrice = Number(item.sellingPrice) || 0;
      const costPrice = Number(item.costPrice) || 0;
      const markdown = Math.max(0, stdPrice - sellPrice) * qty;
      const freeCOGS = fQ * costPrice;
      const subsidy = markdown + freeCOGS;
      const billed = qty * sellPrice;
      const cogs = (qty + fQ) * costPrice;
      const profit = billed - cogs;
      const marginPct = billed > 0 ? ((profit / billed) * 100).toFixed(1) : '0.0';

      csv += `"${new Date(sale.date).toLocaleDateString()}","${sale.invoiceNo || ''}","${(shop.name || '').replace(/"/g, '""')}","${(shop.address || shop.area || '').replace(/"/g, '""')}","${shop.phone || ''}","${(shop.ownerName || '').replace(/"/g, '""')}","${sale.routeId || ''}","${(sale.repName || '').replace(/"/g, '""')}","${(item.productName || '').replace(/"/g, '""')}",${qty},${fQ},${stdPrice},${sellPrice},${(stdPrice - sellPrice).toFixed(2)},${billed.toFixed(2)},${freeCOGS.toFixed(2)},${subsidy.toFixed(2)},${profit.toFixed(2)},${marginPct},"${item.dealType || 'standard'}","${(item.dealNote || '').replace(/"/g, '""')}"\n`;
    }

    this.downloadFile(csv, `trade_deals_${this.startDate.toISOString().split('T')[0]}.csv`, 'text/csv');
    UI.showToast('Trade Deals CSV exported successfully!', 'success');
  }
};
