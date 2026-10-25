/**
 * Best Shops (Top 10 Customers Leaderboard) Module
 */

const BestShops = {
  selectedPeriod: 'alltime', // 'alltime' | 'month' | 'week' | 'today'
  selectedRouteId: 'all',

  async init() {
    await this.populateRouteDropdown();
    await this.load();
  },

  async populateRouteDropdown() {
    const rawRoutes = await db.routes.toArray();
    let routes = filterByTenant(rawRoutes);
    if (typeof Hierarchy !== 'undefined') {
      routes = await Hierarchy.filterRoutes(routes);
    }
    const dropdown = document.getElementById('best-shops-route-filter');
    if (!dropdown) return;

    let html = `<option value="all">All Routes (${routes.length})</option>`;
    for (const r of routes) {
      html += `<option value="${r.id}" ${String(this.selectedRouteId) === String(r.id) ? 'selected' : ''}>${r.name}</option>`;
    }
    dropdown.innerHTML = html;
  },

  onRouteFilterChange(val) {
    this.selectedRouteId = val;
    this.load();
  },

  setPeriod(period) {
    this.selectedPeriod = period;
    document.querySelectorAll('.best-shops-period-pill').forEach(btn => {
      if (btn.getAttribute('data-period') === period) {
        btn.classList.add('bg-amber-500', 'text-white', 'shadow-md');
        btn.classList.remove('bg-white', 'text-slate-600');
      } else {
        btn.classList.remove('bg-amber-500', 'text-white', 'shadow-md');
        btn.classList.add('bg-white', 'text-slate-600');
      }
    });
    this.load();
  },

  async load() {
    const container = document.getElementById('best-shops-full-list');
    const podiumContainer = document.getElementById('best-shops-podium');
    const totalStatsContainer = document.getElementById('best-shops-summary-stats');
    if (!container) return;

    // Calculate start date
    let startDate = new Date(0);
    const now = new Date();
    if (this.selectedPeriod === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (this.selectedPeriod === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
    } else if (this.selectedPeriod === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    }

    // Fetch sales
    let rawSales = await db.sales.filter(s => {
      if (s.status === 'Cancelled') return false;
      if (this.selectedPeriod === 'alltime') return true;
      return new Date(s.date) >= startDate;
    }).toArray();
    let sales = filterByTenant(rawSales);
    if (typeof Hierarchy !== 'undefined') {
      sales = await Hierarchy.filterSales(sales);
    }

    // Filter by route if selected
    if (this.selectedRouteId !== 'all') {
      sales = sales.filter(s => String(s.routeId) === String(this.selectedRouteId));
    }

    // Aggregate by shopId
    const shopMap = {};
    for (const s of sales) {
      if (!s.shopId) continue;
      if (!shopMap[s.shopId]) {
        shopMap[s.shopId] = {
          shopId: s.shopId,
          totalAmount: 0,
          totalCost: 0,
          profit: 0,
          billCount: 0,
          paidAmount: 0,
          creditAmount: 0,
          lastDate: s.date
        };
      }
      shopMap[s.shopId].totalAmount += (s.totalAmount || 0);
      shopMap[s.shopId].totalCost   += (s.totalCost || 0);
      shopMap[s.shopId].profit      += (s.profit || 0);
      shopMap[s.shopId].paidAmount  += (s.paidAmount || 0);
      shopMap[s.shopId].creditAmount+= (s.creditAmount || 0);
      shopMap[s.shopId].billCount   += 1;
      if (new Date(s.date) > new Date(shopMap[s.shopId].lastDate)) {
        shopMap[s.shopId].lastDate = s.date;
      }
    }

    // Sort by totalAmount desc and slice top 10
    const top10 = Object.values(shopMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    // Summary statistics for Top 10
    const top10TotalRevenue = top10.reduce((sum, item) => sum + item.totalAmount, 0);
    const top10TotalBills   = top10.reduce((sum, item) => sum + item.billCount, 0);
    const top10TotalProfit  = top10.reduce((sum, item) => sum + item.profit, 0);

    const isAdmin = (typeof Auth !== 'undefined' && Auth.currentUser?.role === 'admin');

    if (totalStatsContainer) {
      totalStatsContainer.innerHTML = `
        <div class="grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-2">
          <div class="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3 text-center shadow-xs">
            <span class="text-[10px] uppercase font-black text-amber-700 block">Top 10 Business</span>
            <span class="text-sm sm:text-base font-black text-slate-900 mt-0.5 block">${UI.formatCurrency(top10TotalRevenue)}</span>
          </div>
          <div class="bg-white border border-slate-200 rounded-2xl p-3 text-center shadow-xs">
            <span class="text-[10px] uppercase font-black text-slate-500 block">Total Invoices</span>
            <span class="text-sm sm:text-base font-black text-slate-800 mt-0.5 block">${top10TotalBills} Bills</span>
          </div>
          ${isAdmin ? `
            <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center shadow-xs admin-profit-only">
              <span class="text-[10px] uppercase font-black text-emerald-700 block">Total Profit</span>
              <span class="text-sm sm:text-base font-black text-emerald-700 mt-0.5 block">${UI.formatCurrency(top10TotalProfit)}</span>
            </div>
          ` : ''}
        </div>
      `;
    }

    if (top10.length === 0) {
      if (podiumContainer) podiumContainer.innerHTML = '';
      container.innerHTML = `
        <div class="text-center py-12 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm col-span-full">
          <div class="text-5xl mb-3">🏪</div>
          <h3 class="font-bold text-slate-700 text-sm">No Sales Data Found</h3>
          <p class="text-xs text-slate-400 mt-1">Make sales to shops to populate the Best Shops Leaderboard.</p>
          <button onclick="UI.switchTab('pos')" class="mt-4 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-500/30 active:scale-95">
            + Take Order / Sale
          </button>
        </div>
      `;
      return;
    }

    const maxAmount = top10[0].totalAmount || 1;

    // Render Top 3 Podium if we have at least 1 shop
    if (podiumContainer) {
      let podiumHtml = '';
      const p1 = top10[0];
      const p2 = top10[1];
      const p3 = top10[2];

      const s1 = p1 ? await db.shops.get(p1.shopId) : null;
      const s2 = p2 ? await db.shops.get(p2.shopId) : null;
      const s3 = p3 ? await db.shops.get(p3.shopId) : null;

      podiumHtml = `
        <div class="grid grid-cols-3 gap-2 items-end pt-4 pb-2">
          <!-- 2nd Place -->
          ${s2 ? `
            <div class="bg-white rounded-3xl border-2 border-slate-200 p-3 text-center shadow-md flex flex-col items-center relative order-1">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-400 text-white flex items-center justify-center font-black text-lg shadow-md -mt-7 border-2 border-white">
                🥈
              </div>
              <span class="text-[10px] font-black uppercase text-slate-400 mt-1.5">Place 02</span>
              <h4 class="font-black text-xs text-slate-900 truncate max-w-full mt-0.5">${s2.name}</h4>
              <div class="font-black text-xs text-slate-700 mt-1">${UI.formatCurrency(p2.totalAmount)}</div>
              <span class="text-[9px] text-slate-400 mt-0.5">${p2.billCount} bills</span>
            </div>
          ` : '<div class="order-1"></div>'}

          <!-- 1st Place (Champion / Center) -->
          ${s1 ? `
            <div class="bg-gradient-to-b from-amber-500/10 via-white to-white rounded-3xl border-2 border-amber-400 p-4 text-center shadow-xl shadow-amber-500/15 flex flex-col items-center relative order-2 transform -translate-y-2">
              <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-amber-400/40 -mt-9 border-2 border-white animate-bounce">
                👑
              </div>
              <span class="text-[10px] font-black uppercase tracking-wider text-amber-600 mt-1">Place 01 (Best)</span>
              <h4 class="font-black text-sm text-slate-900 truncate max-w-full mt-0.5">${s1.name}</h4>
              <div class="font-black text-sm text-amber-600 mt-1">${UI.formatCurrency(p1.totalAmount)}</div>
              <span class="text-[10px] font-bold text-emerald-600 mt-0.5">+${UI.formatCurrency(p1.profit)} profit</span>
            </div>
          ` : '<div class="order-2"></div>'}

          <!-- 3rd Place -->
          ${s3 ? `
            <div class="bg-white rounded-3xl border-2 border-orange-200 p-3 text-center shadow-md flex flex-col items-center relative order-3">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 text-white flex items-center justify-center font-black text-lg shadow-md -mt-7 border-2 border-white">
                🥉
              </div>
              <span class="text-[10px] font-black uppercase text-amber-700 mt-1.5">Place 03</span>
              <h4 class="font-black text-xs text-slate-900 truncate max-w-full mt-0.5">${s3.name}</h4>
              <div class="font-black text-xs text-slate-700 mt-1">${UI.formatCurrency(p3.totalAmount)}</div>
              <span class="text-[9px] text-slate-400 mt-0.5">${p3.billCount} bills</span>
            </div>
          ` : '<div class="order-3"></div>'}
        </div>
      `;
      podiumContainer.innerHTML = podiumHtml;
    }

    // Render 01 to 10 Ranked List
    let listHtml = '';
    for (let i = 0; i < top10.length; i++) {
      const item = top10[i];
      const shop = await db.shops.get(item.shopId);
      if (!shop) continue;

      const route = await db.routes.get(shop.routeId);
      const rankNum = i + 1;
      const rankFormatted = rankNum < 10 ? `0${rankNum}` : `${rankNum}`;
      const percentage = Math.round((item.totalAmount / maxAmount) * 100);

      // Rank styling
      let rankBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
      let cardBorderClass = 'border-slate-100';
      let medalIcon = '';
      let progressColor = 'bg-gradient-to-r from-emerald-400 to-teal-500';

      if (rankNum === 1) {
        rankBadgeClass = 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-md shadow-amber-400/40 border-amber-300';
        cardBorderClass = 'border-2 border-amber-300 shadow-lg shadow-amber-100 bg-gradient-to-r from-amber-50/40 via-white to-white';
        medalIcon = '🥇';
        progressColor = 'bg-gradient-to-r from-yellow-400 to-amber-500';
      } else if (rankNum === 2) {
        rankBadgeClass = 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-md shadow-slate-300/40 border-slate-300';
        cardBorderClass = 'border-2 border-slate-300 shadow-md bg-gradient-to-r from-slate-50/40 via-white to-white';
        medalIcon = '🥈';
        progressColor = 'bg-gradient-to-r from-slate-300 to-slate-500';
      } else if (rankNum === 3) {
        rankBadgeClass = 'bg-gradient-to-br from-amber-600 to-orange-700 text-white shadow-md shadow-orange-500/40 border-amber-500';
        cardBorderClass = 'border-2 border-orange-200 shadow-md bg-gradient-to-r from-orange-50/40 via-white to-white';
        medalIcon = '🥉';
        progressColor = 'bg-gradient-to-r from-amber-500 to-orange-600';
      }

      listHtml += `
        <div class="bg-white rounded-3xl ${cardBorderClass} p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
          <div class="flex items-start justify-between gap-3">
            <!-- Rank Number & Shop Name -->
            <div class="flex items-start gap-3 min-w-0">
              <div class="w-11 h-11 rounded-2xl ${rankBadgeClass} border flex flex-col items-center justify-center font-black flex-shrink-0">
                <span class="text-xs leading-none">${medalIcon || rankFormatted}</span>
                ${medalIcon ? `<span class="text-[8px] font-black leading-tight">${rankFormatted}</span>` : ''}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="px-2 py-0.5 text-[9px] font-black bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                    🗺️ ${route ? route.name : 'Direct'}
                  </span>
                  <span class="text-[10px] text-slate-400 font-bold">#${item.billCount} Invoices</span>
                </div>
                <h4 class="font-black text-sm text-slate-900 truncate mt-0.5">${shop.name}</h4>
                <p class="text-xs text-slate-500 truncate mt-0.5">
                  👤 ${shop.ownerName || '-'} ${shop.phone ? `• 📞 <a href="tel:${shop.phone}" class="text-green-600 font-bold hover:underline">${shop.phone}</a>` : ''}
                </p>
              </div>
            </div>

            <!-- Revenue -->
            <div class="text-right flex-shrink-0">
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Business</span>
              <div class="text-base sm:text-lg font-black ${rankNum === 1 ? 'text-amber-600' : 'text-slate-900'} leading-tight mt-0.5">
                ${UI.formatCurrency(item.totalAmount)}
              </div>
              ${isAdmin ? `
                <span class="text-[10px] font-bold text-emerald-600 block mt-0.5 admin-profit-only">
                  +${UI.formatCurrency(item.profit)} Profit
                </span>
              ` : ''}
            </div>
          </div>

          <!-- Progress Bar relative to Top 1 -->
          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] font-bold text-slate-400">
              <span>Performance vs #1 Rank</span>
              <span>${percentage}%</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div class="${progressColor} h-2 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div class="text-[10px] text-slate-500">
              ${shop.currentCredit > 0 ? `<span class="text-red-600 font-bold">⚠️ Credit: ${UI.formatCurrency(shop.currentCredit)}</span>` : '<span class="text-emerald-600 font-bold">✓ Credit Clear</span>'}
            </div>

            <div class="flex items-center gap-1.5">
              <button onclick="POS.selectShop(${shop.id}); UI.switchTab('pos');" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 flex items-center gap-1">
                🛒 Take Order
              </button>
              <button onclick="Shops.viewShopHistory(${shop.id})" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl active:scale-95">
                📜 History
              </button>
              <button onclick="Shops.viewShopQR(${shop.id})" class="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl" title="View QR">
                🔲
              </button>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = listHtml;
  }
};
