/**
 * Executive Dashboard Module
 */

const Dashboard = {
  async loadDashboard() {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      // 1. Get today's sales (Delivered Direct Sales + Rep Booked Orders, excluding Cancelled) filtered by tenant
      const rawSalesToday = await db.sales
        .filter(sale => {
          const d = new Date(sale.date);
          return d >= todayStart && d <= todayEnd;
        })
        .toArray();
      let salesToday = filterByTenant(rawSalesToday);
      if (typeof Hierarchy !== 'undefined') {
        salesToday = await Hierarchy.filterSales(salesToday);
      }

      const activeSalesToday = salesToday.filter(s => s.status !== 'Cancelled');
      const deliveredSalesToday = activeSalesToday.filter(s => s.status === 'Delivered');
      const pendingSalesToday = activeSalesToday.filter(s => s.status === 'Pending' || !s.status);

      // Total Day Revenue & Day Profit includes all active orders booked or delivered today
      const totalRevenueToday = activeSalesToday.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
      const totalCostToday = activeSalesToday.reduce((sum, s) => sum + (Number(s.totalCost) || 0), 0);
      const totalProfitToday = totalRevenueToday - totalCostToday;
      const totalBillsToday = activeSalesToday.length;

      // 2. Get today's collections
      const rawPaymentsToday = await db.creditPayments
        .filter(p => {
          const d = new Date(p.date);
          return d >= todayStart && d <= todayEnd;
        })
        .toArray();
      let paymentsToday = filterByTenant(rawPaymentsToday);
      if (typeof Hierarchy !== 'undefined') {
        paymentsToday = await Hierarchy.filterSales(paymentsToday);
      }
      const totalCollectionsToday = paymentsToday.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);

      // 3. Get total outstanding credit across all shops
      const rawShops = await db.shops.toArray();
      let allShops = filterByTenant(rawShops);
      if (typeof Hierarchy !== 'undefined') {
        allShops = await Hierarchy.filterShops(allShops);
      }
      const totalOutstandingCredit = allShops.reduce((sum, s) => sum + (Number(s.currentCredit) || 0), 0);

      // 4. Calculate All-Time Lifetime Performance (Total Sales & Total Profit across all days)
      const rawAllSales = await db.sales.toArray();
      let allSales = filterByTenant(rawAllSales);
      if (typeof Hierarchy !== 'undefined') {
        allSales = await Hierarchy.filterSales(allSales);
      }
      const activeAllSales = allSales.filter(s => s.status !== 'Cancelled');
      const allTimeRevenue = activeAllSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
      const allTimeCost = activeAllSales.reduce((sum, s) => sum + (Number(s.totalCost) || 0), 0);
      const allTimeProfit = allTimeRevenue - allTimeCost;
      const allTimeBills = activeAllSales.length;

      // 5. Update Dashboard 3D KPI DOM Elements
      const domRevenue = document.getElementById('dash-today-sales');
      const domBills = document.getElementById('dash-today-bills');
      const domProfit = document.getElementById('dash-today-profit');
      const domCredit = document.getElementById('dash-total-credit');
      const domCollections = document.getElementById('dash-today-collections');

      if (domRevenue) domRevenue.textContent = UI.formatCurrency(totalRevenueToday);
      if (domBills) {
        domBills.textContent = `${totalBillsToday} (${pendingSalesToday.length} Booked / ${deliveredSalesToday.length} Delivered)`;
      }
      if (domProfit) domProfit.textContent = UI.formatCurrency(totalProfitToday);
      if (domCredit) domCredit.textContent = UI.formatCurrency(totalOutstandingCredit);
      if (domCollections) domCollections.textContent = UI.formatCurrency(totalCollectionsToday);

      // Update All-Time Lifetime DOM Elements
      const domAllTimeRevenue = document.getElementById('dash-alltime-sales');
      const domAllTimeProfit = document.getElementById('dash-alltime-profit');
      const domAllTimeBills = document.getElementById('dash-alltime-bills');
      if (domAllTimeRevenue) domAllTimeRevenue.textContent = UI.formatCurrency(allTimeRevenue);
      if (domAllTimeProfit) domAllTimeProfit.textContent = UI.formatCurrency(allTimeProfit);
      if (domAllTimeBills) domAllTimeBills.textContent = `${allTimeBills} Bills Total`;

      // 6. Populate Today's Recent Sales list
      await this.renderRecentSales(salesToday);

      // 6. Update Company Header Name
      const companies = filterByTenant(await db.company.toArray());
      const company = companies.length > 0 ? companies[0] : await db.company.toCollection().first();
      const headerTitle = document.getElementById('app-company-name-header');
      if (headerTitle && company?.name) {
        headerTitle.textContent = company.name;
      }

      // 7. Render Admin Analytics Charts
      await this.renderCharts(activeSalesToday, paymentsToday);

      // 8. Check and Display SaaS Subscription Expiry Warning with Bank & Hotline Details
      await this.checkSubscriptionWarning();
    } catch (err) {
      console.error('Error loading dashboard:', err);
    }
  },

  // Subscription Expiry Warning & Cloud-Synced Bank Details Check
  async checkSubscriptionWarning() {
    try {
      const banner = document.getElementById('dash-subscription-warning-banner');
      if (!banner) return;

      const user = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
      if (!user || user.role === 'superadmin') {
        banner.classList.add('hidden');
        return;
      }

      // Determine tenant / company subscription
      let tenant = null;
      if (typeof db !== 'undefined') {
        if (db.tenants) {
          const allTenants = await db.tenants.toArray().catch(() => []);
          if (user.tenantId) {
            tenant = allTenants.find(t => String(t.id) === String(user.tenantId) || String(t.tenantId) === String(user.tenantId));
          }
          if (!tenant && user.username) {
            tenant = allTenants.find(t => t.adminUsername?.toLowerCase() === user.username.toLowerCase());
          }
          if (!tenant && allTenants.length > 0) {
            tenant = allTenants[0];
          }
        }
        if (!tenant && db.company) {
          tenant = await db.company.toCollection().first().catch(() => null);
        }
      }

      if (!tenant) {
        banner.classList.add('hidden');
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const validToStr = tenant.validTo || '';

      if (!validToStr && tenant.status !== 'expired' && tenant.status !== 'suspended') {
        banner.classList.add('hidden');
        return;
      }

      let diffDays = 999;
      if (validToStr) {
        const todayTime = new Date(todayStr).getTime();
        const validTime = new Date(validToStr).getTime();
        diffDays = Math.ceil((validTime - todayTime) / (1000 * 60 * 60 * 24));
      } else if (tenant.status === 'expired' || tenant.status === 'suspended') {
        diffDays = -1;
      }

      // Show warning if expiring within 7 days, or already expired/suspended
      if (diffDays <= 7 || tenant.status === 'expired' || tenant.status === 'suspended' || tenant.isActive === false) {
        let saasConf = (typeof CompanyControl !== 'undefined' && CompanyControl.getSaaSSettings)
          ? CompanyControl.getSaaSSettings()
          : {};

        if (typeof db !== 'undefined' && db.systemSettings) {
          try {
            const cloudConf = await db.systemSettings.get('saas_config');
            if (cloudConf) {
              saasConf = Object.assign({}, saasConf, cloudConf);
            }
          } catch (e) {
            console.warn('Dashboard SaaS cloud settings fetch error:', e);
          }
        }

        const daysBadge = document.getElementById('dash-subscription-warning-days');
        const titleEl = document.getElementById('dash-subscription-warning-title');
        const textEl = document.getElementById('dash-subscription-warning-text');
        const bankEl = document.getElementById('dash-subscription-warning-bank');
        const hotlineEl = document.getElementById('dash-subscription-warning-hotline');
        const waBtn = document.getElementById('dash-subscription-warning-wa-btn');
        const callBtn = document.getElementById('dash-subscription-warning-call-btn');

        if (diffDays <= 0) {
          if (daysBadge) {
            daysBadge.textContent = 'Expired (කල් ඉකුත් විය)';
            daysBadge.className = 'text-xs font-black px-2.5 py-1 rounded-xl bg-red-600 text-white border border-red-400 flex-shrink-0';
          }
          if (titleEl) titleEl.textContent = 'Software Subscription Expired! (සේවා කාලය අවසන්)';
        } else {
          if (daysBadge) {
            daysBadge.textContent = `Expires in ${diffDays} Day${diffDays === 1 ? '' : 's'} (${diffDays} දිනකින්)`;
            daysBadge.className = 'text-xs font-black px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 border border-amber-300 flex-shrink-0';
          }
          if (titleEl) titleEl.textContent = `Software Service Renewal Notice (අවසන් වීමට තව දින ${diffDays}යි)`;
        }

        if (textEl) {
          textEl.textContent = saasConf.lockoutNoticeText ||
            `ඔබගේ මෘදුකාංග සේවා කාලය ${validToStr} දිනෙන් අවසන් වේ. සේවාව අඛණ්ඩව පවත්වා ගැනීමට කරුණාකර පහත බැංකු ගිණුමට ගෙවීම් සිදුකර WhatsApp කරන්න.`;
        }

        if (bankEl) {
          const bName = saasConf.bankName || 'Commercial Bank / BOC';
          const bAcc = saasConf.accountNumber || '1234 5678 9012';
          const bHolder = saasConf.accountName ? ` (${saasConf.accountName})` : '';
          const bBranch = saasConf.bankBranch ? ` • ${saasConf.bankBranch}` : '';
          bankEl.textContent = `${bName} — Acc: ${bAcc}${bHolder}${bBranch}`;
        }

        if (hotlineEl) {
          hotlineEl.textContent = saasConf.hotlineNumbers || '077 123 4567 / 071 987 6543';
        }

        if (waBtn) {
          const rawWa = (saasConf.whatsappNumber || saasConf.hotlineNumbers || '0771234567').split('/')[0].replace(/[^0-9]/g, '');
          const cleanWa = rawWa.startsWith('0') ? '94' + rawWa.substring(1) : (rawWa.startsWith('94') ? rawWa : '94' + rawWa);
          const msg = encodeURIComponent(`Renewal Request for ${tenant.companyName || 'Business'} (Expiring: ${validToStr})`);
          waBtn.href = `https://wa.me/${cleanWa}?text=${msg}`;
        }

        if (callBtn) {
          const firstNum = (saasConf.hotlineNumbers || '0771234567').split('/')[0].trim().replace(/[^0-9+]/g, '');
          callBtn.href = `tel:${firstNum}`;
        }

        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    } catch (err) {
      console.warn('checkSubscriptionWarning error:', err);
    }
  },

  // Setup High-DPI Crisp Native Canvas
  setupCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const parent = canvas.parentElement;
    if (!parent) return null;

    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 320;
    const height = rect.height > 0 ? rect.height : 176;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  },

  async renderCharts(activeToday, paymentsToday) {
    await this.renderSalesTrendChart();
    this.renderPaymentBreakdownChart(activeToday, paymentsToday);
    await this.renderTopProductsChart();
    await this.renderRouteShareChart();
  },

  // 1. 7-Day Sales Trend Bar Chart
  async renderSalesTrendChart() {
    const setup = this.setupCanvas('dash-canvas-trend');
    if (!setup) return;
    const { ctx, width, height } = setup;

    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      days.push({
        date: d,
        endDate: end,
        label: `${dayNames[d.getDay()]}`,
        isToday: i === 0,
        total: 0
      });
    }

    const rawSalesPast7d = await db.sales.filter(s => {
      const d = new Date(s.date);
      return d >= days[0].date && s.status !== 'Cancelled';
    }).toArray();
    let salesPast7d = filterByTenant(rawSalesPast7d);
    if (typeof Hierarchy !== 'undefined') {
      salesPast7d = await Hierarchy.filterSales(salesPast7d);
    }

    for (const s of salesPast7d) {
      const sDate = new Date(s.date);
      for (const day of days) {
        if (sDate >= day.date && sDate <= day.endDate) {
          day.total += (s.totalAmount || 0);
          break;
        }
      }
    }

    const grandTotal = days.reduce((sum, d) => sum + d.total, 0);
    const totalEl = document.getElementById('dash-chart-7d-total');
    if (totalEl) totalEl.textContent = UI.formatCurrency(grandTotal);

    const maxVal = Math.max(...days.map(d => d.total), 1000) * 1.25;
    const paddingBottom = 26;
    const paddingTop = 22;
    const chartHeight = height - paddingBottom - paddingTop;
    const barWidth = Math.min(28, (width - 40) / 7 - 6);
    const step = (width - 20) / 7;

    // Background horizontal guide lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (let g = 1; g <= 3; g++) {
      const gy = paddingTop + (chartHeight * (1 - g / 3));
      ctx.beginPath();
      ctx.moveTo(10, gy);
      ctx.lineTo(width - 10, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw bars
    days.forEach((day, idx) => {
      const x = 10 + (idx * step) + (step - barWidth) / 2;
      const barH = Math.max(4, (day.total / maxVal) * chartHeight);
      const y = paddingTop + chartHeight - barH;

      // Rounded Bar
      ctx.beginPath();
      const radius = 6;
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, y + barH);
      ctx.lineTo(x, y + barH);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();

      if (day.isToday) {
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#2563eb');
        ctx.fillStyle = grad;
      } else if (day.total > 0) {
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, '#60a5fa');
        grad.addColorStop(1, '#1d4ed8');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = '#e2e8f0';
      }
      ctx.fill();

      // Top value label
      if (day.total > 0) {
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.fillStyle = day.isToday ? '#1d4ed8' : '#3b82f6';
        ctx.textAlign = 'center';
        const valText = day.total >= 1000 ? `${(day.total / 1000).toFixed(1)}k` : `${Math.round(day.total)}`;
        ctx.fillText(valText, x + barWidth / 2, y - 5);
      }

      // Bottom label
      ctx.font = day.isToday ? 'bold 10px system-ui, sans-serif' : '9px system-ui, sans-serif';
      ctx.fillStyle = day.isToday ? '#1e40af' : '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText(day.label, x + barWidth / 2, height - 8);
    });
  },

  // 2. Cash vs Credit vs Booked vs Recovery Donut Chart
  async renderPaymentBreakdownChart(activeToday, paymentsToday) {
    const setup = this.setupCanvas('dash-canvas-payment');
    if (!setup) return;
    const { ctx, width, height } = setup;

    let cash = activeToday ? activeToday.reduce((s, x) => s + (Number(x.paidAmount) || 0), 0) : 0;
    let credit = activeToday ? activeToday.reduce((s, x) => s + (Number(x.creditAmount) || 0), 0) : 0;
    let booked = activeToday ? activeToday.filter(x => x.status === 'Pending' || !x.status).reduce((s, x) => s + (Number(x.totalAmount) || 0), 0) : 0;
    let recovery = paymentsToday ? paymentsToday.reduce((s, x) => s + (Number(x.amountPaid) || 0), 0) : 0;
    let total = cash + credit + booked + recovery;
    let periodLabel = 'Today';

    // If today has 0 activity, automatically fallback to all recorded sales & collections so chart is always alive!
    if (total === 0) {
      try {
        const rawSales = await db.sales.filter(s => s.status !== 'Cancelled').toArray();
        let sales = filterByTenant(rawSales);
        if (typeof Hierarchy !== 'undefined') {
          sales = await Hierarchy.filterSales(sales);
        }
        const rawPayments = await db.creditPayments.toArray();
        let payments = filterByTenant(rawPayments);
        if (typeof Hierarchy !== 'undefined') {
          payments = await Hierarchy.filterSales(payments);
        }

        cash = sales.reduce((s, x) => s + (Number(x.paidAmount) || 0), 0);
        credit = sales.reduce((s, x) => s + (Number(x.creditAmount) || 0), 0);
        booked = sales.filter(x => x.status === 'Pending' || !x.status).reduce((s, x) => s + (Number(x.totalAmount) || 0), 0);
        recovery = payments.reduce((s, x) => s + (Number(x.amountPaid) || 0), 0);
        total = cash + credit + booked + recovery;
        periodLabel = '7-Day';
      } catch (e) {
        console.warn('Payment breakdown fallback query error:', e);
      }
    }

    const centerX = width * 0.32;
    const centerY = height * 0.5;
    const outerR = Math.min(centerX - 10, height * 0.42);
    const innerR = outerR * 0.58;

    if (total === 0) {
      // Empty placeholder ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerR, 0, 2 * Math.PI);
      ctx.arc(centerX, centerY, innerR, 0, 2 * Math.PI, true);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();

      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('No Activity', centerX, centerY + 4);

      // Legend
      this.drawLegend(ctx, width * 0.58, centerY - 32, [
        { label: 'Cash: Rs. 0', color: '#10b981' },
        { label: 'Booked: Rs. 0', color: '#38bdf8' },
        { label: 'Credit: Rs. 0', color: '#ef4444' },
        { label: 'Recovery: Rs. 0', color: '#f59e0b' }
      ]);
      return;
    }

    const segments = [
      { label: 'Cash Paid', amount: cash, color: '#10b981', pct: (cash / total) },
      { label: 'Booked Orders', amount: booked, color: '#38bdf8', pct: (booked / total) },
      { label: 'Credit Given', amount: credit, color: '#ef4444', pct: (credit / total) },
      { label: 'Debt Recovery', amount: recovery, color: '#f59e0b', pct: (recovery / total) }
    ].filter(s => s.amount > 0);

    let currentAngle = -0.5 * Math.PI;

    segments.forEach(seg => {
      const sliceAngle = seg.pct * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerR, currentAngle, currentAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerR, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      currentAngle += sliceAngle;
    });

    // Center Text
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(periodLabel, centerX, centerY - 3);
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Flow', centerX, centerY + 9);

    // Legend
    const legendItems = [
      { label: `Cash: ${UI.formatCurrency(cash)}`, color: '#10b981' },
      { label: `Booked: ${UI.formatCurrency(booked)}`, color: '#38bdf8' },
      { label: `Credit: ${UI.formatCurrency(credit)}`, color: '#ef4444' },
      { label: `Recovery: ${UI.formatCurrency(recovery)}`, color: '#f59e0b' }
    ];
    this.drawLegend(ctx, width * 0.58, centerY - 40, legendItems);
  },

  drawLegend(ctx, startX, startY, items) {
    items.forEach((item, i) => {
      const y = startY + (i * 22);
      ctx.beginPath();
      ctx.arc(startX, y + 4, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = item.color;
      ctx.fill();

      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, startX + 10, y + 8);
    });
  },

  // 3. Top Products Velocity Chart
  async renderTopProductsChart() {
    const setup = this.setupCanvas('dash-canvas-products');
    if (!setup) return;
    const { ctx, width, height } = setup;

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const rawSales = await db.sales.filter(s => {
      const d = new Date(s.date);
      return d >= weekAgo && s.status !== 'Cancelled';
    }).toArray();
    let sales = filterByTenant(rawSales);
    if (typeof Hierarchy !== 'undefined') {
      sales = await Hierarchy.filterSales(sales);
    }

    const saleIds = sales.map(s => s.id);
    let items = [];
    if (saleIds.length > 0) {
      const rawItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
      items = filterByTenant(rawItems);
    }

    const prodCounts = {};
    for (const item of items) {
      const key = item.productId || item.productName;
      if (!prodCounts[key]) {
        prodCounts[key] = { name: item.productName, unit: item.unit || 'Card', qty: 0 };
      }
      prodCounts[key].qty += (item.qty || 0) + (Number(item.freeQty) || 0);
    }

    const top = Object.values(prodCounts).sort((a, b) => b.qty - a.qty).slice(0, 4);

    if (top.length === 0) {
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('No completed sales this week', width / 2, height / 2);
      return;
    }

    const maxQty = Math.max(...top.map(t => t.qty), 1);
    const rowH = (height - 10) / top.length;

    top.forEach((prod, idx) => {
      const y = 8 + (idx * rowH);
      const rank = idx + 1;

      // Rank Badge
      ctx.beginPath();
      ctx.arc(16, y + 14, 8, 0, 2 * Math.PI);
      ctx.fillStyle = rank === 1 ? '#fef08a' : (rank === 2 ? '#e2e8f0' : '#fed7aa');
      ctx.fill();
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillStyle = rank === 1 ? '#854d0e' : (rank === 2 ? '#475569' : '#9a3412');
      ctx.textAlign = 'center';
      ctx.fillText(`${rank}`, 16, y + 17);

      // Name
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      let displayName = prod.name.length > 22 ? prod.name.substring(0, 20) + '..' : prod.name;
      ctx.fillText(displayName, 30, y + 12);

      // Qty label
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillStyle = '#15803d';
      ctx.textAlign = 'right';
      ctx.fillText(`${prod.qty} ${prod.unit}s`, width - 10, y + 12);

      // Progress bar background
      const barX = 30;
      const barMaxW = width - barX - 10;
      const barY = y + 18;
      const barH = 7;

      ctx.beginPath();
      ctx.roundRect(barX, barY, barMaxW, barH, 3.5);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();

      // Foreground bar
      const fillW = Math.max(8, (prod.qty / maxQty) * barMaxW);
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH, 3.5);
      const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
      grad.addColorStop(0, '#34d399');
      grad.addColorStop(1, '#059669');
      ctx.fillStyle = grad;
      ctx.fill();
    });
  },

  // 4. Route Performance Share Chart
  async renderRouteShareChart() {
    const setup = this.setupCanvas('dash-canvas-routes');
    if (!setup) return;
    const { ctx, width, height } = setup;

    let routes = filterByTenant(rawRoutes);
    if (typeof Hierarchy !== 'undefined') {
      routes = await Hierarchy.filterRoutes(routes);
    }
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const rawSales = await db.sales.filter(s => {
      const d = new Date(s.date);
      return d >= weekAgo && s.status !== 'Cancelled';
    }).toArray();
    let sales = filterByTenant(rawSales);
    if (typeof Hierarchy !== 'undefined') {
      sales = await Hierarchy.filterSales(sales);
    }

    const routeTotals = {};
    for (const r of routes) {
      routeTotals[r.id] = { name: r.name, revenue: 0, count: 0 };
    }

    for (const s of sales) {
      if (routeTotals[s.routeId]) {
        routeTotals[s.routeId].revenue += (s.totalAmount || 0);
        routeTotals[s.routeId].count++;
      }
    }

    const routeList = Object.values(routeTotals).sort((a, b) => b.revenue - a.revenue).slice(0, 4);
    const maxRev = Math.max(...routeList.map(r => r.revenue), 1000);

    if (routeList.length === 0 || routeList.every(r => r.revenue === 0)) {
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('No route sales recorded yet', width / 2, height / 2);
      return;
    }

    const rowH = (height - 10) / routeList.length;

    routeList.forEach((r, idx) => {
      const y = 8 + (idx * rowH);

      // Route Name
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      let rName = r.name.length > 20 ? r.name.substring(0, 18) + '..' : r.name;
      ctx.fillText(`🗺️ ${rName}`, 10, y + 12);

      // Amount
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillStyle = '#0284c7';
      ctx.textAlign = 'right';
      ctx.fillText(UI.formatCurrency(r.revenue), width - 10, y + 12);

      // Bar
      const barX = 10;
      const barMaxW = width - barX - 10;
      const barY = y + 18;
      const barH = 7;

      ctx.beginPath();
      ctx.roundRect(barX, barY, barMaxW, barH, 3.5);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();

      if (r.revenue > 0) {
        const fillW = Math.max(8, (r.revenue / maxRev) * barMaxW);
        ctx.beginPath();
        ctx.roundRect(barX, barY, fillW, barH, 3.5);
        const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#0284c7');
        ctx.fillStyle = grad;
        ctx.fill();
      }
    });
  },

  async renderRecentSales(salesList) {
    const listContainer = document.getElementById('dash-recent-sales-list');
    if (!listContainer) return;

    if (!salesList || salesList.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-8 bg-white rounded-3xl border border-slate-100 p-6 text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <p class="text-xs font-bold text-slate-600">No orders or sales recorded today yet.</p>
          <button onclick="UI.switchTab('pos')" class="mt-3 inline-flex items-center px-4 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-md shadow-emerald-600/30">
            + Take Order / Sale
          </button>
        </div>
      `;
      return;
    }

    // Sort descending by date
    const sorted = [...salesList].sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = '';
    for (const sale of sorted) {
      const shop = await db.shops.get(sale.shopId);
      const status = sale.status || 'Delivered';

      const statusBadge = {
        'Pending': 'bg-amber-100 text-amber-800 border-amber-300',
        'Delivered': 'bg-emerald-100 text-emerald-800 border-emerald-300',
        'Cancelled': 'bg-red-100 text-red-800 border-red-300'
      }[status];

      html += `
        <div class="bg-white p-3.5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-emerald-200 transition-all">
          <div class="flex items-start gap-3 min-w-0">
            <div class="w-10 h-10 rounded-2xl ${status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : (status === 'Cancelled' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100')} flex items-center justify-center font-bold text-sm border flex-shrink-0">
              ${status === 'Pending' ? '📦' : (status === 'Cancelled' ? '❌' : '💵')}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-[9px] font-black px-1.5 py-0.5 rounded-full border ${statusBadge}">${status}</span>
                <span class="text-[10px] text-slate-400">#${sale.invoiceNo}</span>
              </div>
              <h4 class="font-bold text-slate-800 text-xs sm:text-sm leading-tight truncate mt-0.5">${shop ? shop.name : 'Unknown Shop'}</h4>
              <p class="text-[10px] text-slate-500">${new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${sale.deliveryDate ? `• For ${UI.formatDate(sale.deliveryDate)}` : ''}</p>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="font-black text-slate-900 text-xs sm:text-sm">${UI.formatCurrency(sale.totalAmount)}</div>
            <div class="flex items-center justify-end gap-1.5 mt-1">
              ${status === 'Pending' ? `
                <button onclick="UI.switchTab('production'); Production.switchSubtab('dispatch');" class="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-lg border border-emerald-200">
                  Deliver ➔
                </button>
              ` : (status === 'Delivered' ? `
                <button onclick="Print.printExistingInvoice(${sale.id})" title="Print Invoice" class="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50">
                  🖨️
                </button>
              ` : '')}
              <button onclick="Production.openEditOrderItemsModal(${sale.id})" title="Edit Order Items" class="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                ✏️
              </button>
              <button onclick="Dashboard.confirmDeleteSale(${sale.id})" title="Delete Invoice" class="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                🗑️
              </button>
            </div>
          </div>
        </div>
      `;
    }

    listContainer.innerHTML = html;
  },

  async confirmDeleteSale(saleId) {
    const sale = await db.sales.get(saleId);
    if (!sale) return;
    if (!confirm(`Delete invoice #${sale.invoiceNo}?\n\nThis will permanently remove the bill. If it had credit, the shop credit balance will be reversed.`)) return;

    // Reverse credit if applicable
    if (sale.creditAmount > 0 && sale.shopId) {
      const shop = await db.shops.get(sale.shopId);
      if (shop) {
        const newCredit = Math.max(0, (shop.currentCredit || 0) - sale.creditAmount);
        await db.shops.update(sale.shopId, { currentCredit: newCredit });
      }
    }

    await db.saleItems.where('saleId').equals(saleId).delete();
    await db.sales.delete(saleId);

    UI.showToast('Invoice deleted! 🗑️', 'success');
    this.loadDashboard();
  }
};
