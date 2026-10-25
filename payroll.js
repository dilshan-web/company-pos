/**
 * HR & Payroll / Salary Management Module for MOB POS
 * 1. Automatic Salary Engine:
 *    - Basic Salary (with toggle/checkbox support)
 *    - Attendance Incentive (e.g. 25 days worked -> +Rs. 5,000)
 *    - Daily Bill Count Target (e.g. >= 20 bills/day -> +Rs. 3,000)
 *    - Product / Category Card Target Commission (Tiered Slabs: e.g. 100 cards -> +1,000, 200 cards -> +2,000)
 *    - Stores Keeper Card Packing / Dispatch Commission (e.g. Rs. 2.00 / card dispatched)
 *    - Team Turnover Commission for SM / ASM / Supervisor (e.g. 0.5% - 1.0%)
 *    - Allowances (Fuel / Bike, Phone, Food) & Deductions (Advance, EPF, Shortage)
 * 2. Role Support:
 *    - Company Owner / Director
 *    - Sales Manager (SM)
 *    - Area Sales Manager (ASM)
 *    - Field Supervisor (SV)
 *    - Sales Reps (Reps)
 *    - Delivery Drivers
 *    - Stores Keepers (With basic salary toggle)
 *    - HR & Office Staff
 * 3. Interactive Monthly Payroll Dashboard with Live Edit
 * 4. 1-Click Professional 80mm Thermal & A4 Payslip Printing
 * 5. Security: Strictly restricted to Admin, SuperAdmin, and HR roles
 */

const Payroll = {
  currentMonth: '',
  payrollSheetCache: [],
  selectedPayslipId: null,

  // Default Salary & Target Rules
  DEFAULT_RULES: {
    // Role-wise default basic salaries
    basicSalaries: {
      'owner': 100000,
      'sm': 65000,
      'asm': 50000,
      'supervisor': 42000,
      'rep': 35000,
      'delivery': 35000,
      'stores': 30000,
      'hr': 40000
    },
    // Attendance Incentive
    attendanceMinDays: 25,
    attendanceBonus: 5000,
    // Daily Bill Count Target
    dailyBillMinAvg: 20,
    dailyBillBonus: 3000,
    // Stores Keeper Commission
    storesRatePerCard: 2.00,
    storesEnableBasic: true,
    // Team Sales Overrides
    smCommissionPct: 1.0,
    asmCommissionPct: 0.5,
    supervisorCommissionPct: 0.3,
    // Product Card Target Slabs (e.g. Chilli, Curry, Meat Curry)
    cardTargetSlabs: [
      { id: 1, name: 'Chilli Powder Card (මිරිස් කුඩු)', categoryKey: 'chilli', minCards: 100, bonus: 1000 },
      { id: 2, name: 'Chilli Powder Card (මිරිස් කුඩු 200+)', categoryKey: 'chilli', minCards: 200, bonus: 2000 },
      { id: 3, name: 'Curry Powder Card (තුනපහ කුඩු)', categoryKey: 'curry', minCards: 100, bonus: 1500 },
      { id: 4, name: 'Meat Curry Card (මස් කුඩු)', categoryKey: 'meat', minCards: 80, bonus: 1000 },
      { id: 5, name: 'Total All Cards (සියලු කාඩ්පත් 500+)', categoryKey: 'all', minCards: 500, bonus: 3500 }
    ],
    // Default Allowances
    repFuelAllowance: 8000,
    deliveryFuelAllowance: 6000
  },

  async init() {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = String(today.getMonth() + 1).padStart(2, '0');
    this.currentMonth = `${curYear}-${curMonth}`;

    const monthInput = document.getElementById('payroll-month-select');
    if (monthInput) monthInput.value = this.currentMonth;

    await this.loadMonthlyPayroll();
  },

  async getPayrollRules() {
    try {
      const activeTid = getActiveTenantId() || 1;
      const rawRules = await db.payrollRules?.toArray();
      const rules = filterByTenant(rawRules);
      if (rules.length > 0) {
        return Object.assign({}, this.DEFAULT_RULES, rules[0]);
      }
    } catch (e) {}
    return Object.assign({}, this.DEFAULT_RULES);
  },

  async savePayrollRules(newRules) {
    try {
      const activeTid = getActiveTenantId() || 1;
      const rawRules = await db.payrollRules?.toArray();
      const rules = filterByTenant(rawRules);
      const payload = Object.assign({}, this.DEFAULT_RULES, newRules, {
        tenantId: activeTid,
        updatedAt: new Date().toISOString()
      });

      if (rules.length > 0) {
        await db.payrollRules.update(rules[0].id, payload);
      } else {
        await db.payrollRules.add(payload);
      }
      UI.showToast('Salary & Card Target Rules saved successfully! ⚙️✓', 'success');
      if (typeof SoundFX !== 'undefined') SoundFX.play('save');
    } catch (err) {
      UI.showToast('Error saving payroll rules: ' + err.message, 'error');
    }
  },

  async onMonthChange(monthStr) {
    this.currentMonth = monthStr;
    await this.loadMonthlyPayroll();
  },

  /** Load payroll sheet for selected month (either from DB or auto-generate) */
  async loadMonthlyPayroll() {
    const tableBody = document.getElementById('payroll-table-body');
    if (!tableBody) return;

    try {
      const activeTid = getActiveTenantId() || 1;
      const monthStr = this.currentMonth || new Date().toISOString().slice(0, 7);

      // Check if finalized/draft records exist for this month in db.payroll
      let records = [];
      if (db.payroll) {
        const rawPayroll = await db.payroll.toArray();
        const allPayroll = filterByTenant(rawPayroll);
        records = allPayroll.filter(p => p.month === monthStr);
      }

      // If no records saved yet, automatically generate fresh live calculation
      if (records.length === 0) {
        records = await this.computeFreshMonthlyPayroll(monthStr);
      }

      this.payrollSheetCache = records;
      this.renderPayrollTable(records);
      this.updatePayrollKpiChips(records);
    } catch (err) {
      console.error('Error loading payroll:', err);
      UI.showToast('Error loading payroll: ' + err.message, 'error');
    }
  },

  /** Trigger automatic full recalculation for the selected month */
  async recalculateMonth() {
    UI.showToast(`⚡ Calculating automated salaries for ${this.currentMonth}...`, 'info');
    const records = await this.computeFreshMonthlyPayroll(this.currentMonth);
    this.payrollSheetCache = records;
    this.renderPayrollTable(records);
    this.updatePayrollKpiChips(records);
    UI.showToast(`✅ Salaries calculated based on real sales, attendance & card targets!`, 'success');
    if (typeof SoundFX !== 'undefined') SoundFX.play('sale');
  },

  /** Compute fresh monthly payroll by querying DB sales, GPS visits, stocks, and staff */
  async computeFreshMonthlyPayroll(monthStr) {
    const activeTid = getActiveTenantId() || 1;
    const rules = await this.getPayrollRules();

    // 1. Load Staff Users
    const rawUsers = await db.users.toArray();
    const users = filterByTenant(rawUsers).filter(u => u.isActive !== false);

    // Add Company Owner entry if not in users
    const allStaff = [...users];
    const hasOwner = allStaff.some(u => u.role === 'admin' || u.role === 'owner');
    if (!hasOwner) {
      allStaff.unshift({
        id: 'owner_1',
        fullName: 'Company Owner / Director (අයිතිකරු)',
        username: 'owner',
        role: 'owner',
        phone: '077 123 4567'
      });
    }

    // 2. Load Sales for this Month
    const rawSales = await db.sales.toArray();
    const allSales = filterByTenant(rawSales);
    const monthSales = allSales.filter(s => s.status !== 'Cancelled' && s.date && s.date.startsWith(monthStr));

    // 3. Load Sale Items for this Month
    const rawItems = await db.saleItems?.toArray() || [];
    const allItems = filterByTenant(rawItems);
    const saleIdSet = new Set(monthSales.map(s => s.id));
    const monthSaleItems = allItems.filter(i => saleIdSet.has(i.saleId));

    // 4. Load GPS Visits / Attendance for this Month
    const rawVisits = await db.gpsVisits?.toArray() || [];
    const allVisits = filterByTenant(rawVisits);
    const monthVisits = allVisits.filter(v => v.date && v.date.startsWith(monthStr));

    // 5. Calculate Total Company Sales (Turnover) for Management Commissions
    const totalCompanyTurnover = monthSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

    // 6. Calculate Stores Dispatched Card Quantity
    let totalCardsDispatched = 0;
    monthSaleItems.forEach(item => {
      const isCard = (item.unit && item.unit.toLowerCase().includes('card')) || (item.productName && item.productName.toLowerCase().includes('card'));
      if (isCard) {
        totalCardsDispatched += (Number(item.quantity) || 0);
      }
    });

    const computedList = [];

    for (const staff of allStaff) {
      const role = staff.role || 'rep';
      const staffId = String(staff.id);

      // A. Basic Salary
      let basic = rules.basicSalaries[role] !== undefined ? Number(rules.basicSalaries[role]) : 35000;
      let isBasicEnabled = true;
      if (role === 'stores') {
        isBasicEnabled = rules.storesEnableBasic !== false;
        if (!isBasicEnabled) basic = 0;
      }

      // B. Attendance & Working Days Calculation
      const staffSales = monthSales.filter(s => String(s.repId) === staffId);
      const staffVisits = monthVisits.filter(v => String(v.repId) === staffId);
      
      const activeDates = new Set();
      staffSales.forEach(s => s.date && activeDates.add(s.date.split('T')[0]));
      staffVisits.forEach(v => v.date && activeDates.add(v.date));
      
      const workingDays = Math.max(activeDates.size, role === 'admin' || role === 'owner' || role === 'hr' || role === 'stores' ? 26 : activeDates.size);
      const isAttendanceQualified = workingDays >= rules.attendanceMinDays;
      const attendanceBonus = isAttendanceQualified ? Number(rules.attendanceBonus) : 0;

      // C. Daily Bill Count Target Calculation
      const totalBills = staffSales.length;
      const avgDailyBills = workingDays > 0 ? Number((totalBills / workingDays).toFixed(1)) : 0;
      const isBillTargetAchieved = avgDailyBills >= rules.dailyBillMinAvg && totalBills >= (rules.dailyBillMinAvg * 10);
      const dailyBillBonus = isBillTargetAchieved ? Number(rules.dailyBillBonus) : 0;

      // D. Product / Category Card Target Slabs Commission
      let cardCommission = 0;
      const cardBreakdown = [];

      if (role === 'rep') {
        const staffSaleIds = new Set(staffSales.map(s => s.id));
        const staffItems = monthSaleItems.filter(i => staffSaleIds.has(i.saleId));

        const cardCounts = { chilli: 0, curry: 0, meat: 0, all: 0 };

        staffItems.forEach(item => {
          const name = (item.productName || '').toLowerCase();
          const qty = Number(item.quantity) || 0;
          const isCard = (item.unit && item.unit.toLowerCase().includes('card')) || name.includes('card') || name.includes('කාඩ්');

          if (isCard) {
            cardCounts.all += qty;
            if (name.includes('chilli') || name.includes('මිරිස්')) cardCounts.chilli += qty;
            if (name.includes('curry') || name.includes('තුනපහ')) cardCounts.curry += qty;
            if (name.includes('meat') || name.includes('මස්')) cardCounts.meat += qty;
          }
        });

        // Evaluate Card Target Slabs
        rules.cardTargetSlabs.forEach(slab => {
          const key = slab.categoryKey || 'all';
          const achievedQty = cardCounts[key] || 0;
          if (achievedQty >= slab.minCards) {
            cardCommission += Number(slab.bonus);
            cardBreakdown.push({
              slabName: slab.name,
              minCards: slab.minCards,
              achievedQty: achievedQty,
              bonus: slab.bonus
            });
          }
        });
      }

      // E. Stores Keeper Packing / Dispatch Commission
      let storesBonus = 0;
      if (role === 'stores') {
        const rate = Number(rules.storesRatePerCard) || 2.00;
        storesBonus = Math.round(totalCardsDispatched * rate);
      }

      // F. Team Turnover Commission (SM / ASM / Supervisor)
      let teamCommission = 0;
      if (role === 'sm') {
        teamCommission = Math.round(totalCompanyTurnover * (Number(rules.smCommissionPct || 1.0) / 100));
      } else if (role === 'asm') {
        teamCommission = Math.round(totalCompanyTurnover * (Number(rules.asmCommissionPct || 0.5) / 100));
      } else if (role === 'supervisor') {
        teamCommission = Math.round(totalCompanyTurnover * (Number(rules.supervisorCommissionPct || 0.3) / 100));
      }

      // G. Allowances & Deductions
      let fuelAllowance = (role === 'rep') ? Number(rules.repFuelAllowance || 8000) : ((role === 'delivery') ? Number(rules.deliveryFuelAllowance || 6000) : 0);
      let otherAllowances = 0;
      let salaryAdvance = 0;
      let otherDeductions = 0;

      const totalAllowances = fuelAllowance + otherAllowances;
      const totalIncentives = attendanceBonus + dailyBillBonus + cardCommission + storesBonus + teamCommission;
      const totalDeductions = salaryAdvance + otherDeductions;
      const netSalary = Math.max(0, basic + totalIncentives + totalAllowances - totalDeductions);

      computedList.push({
        id: `pay_${monthStr}_${staff.id}`,
        tenantId: activeTid,
        month: monthStr,
        userId: staff.id,
        userName: staff.fullName || staff.username,
        userUsername: staff.username,
        userRole: role,
        userPhone: staff.phone || '',
        basicSalary: basic,
        isBasicEnabled: isBasicEnabled,
        workingDays: workingDays,
        isAttendanceQualified: isAttendanceQualified,
        attendanceBonus: attendanceBonus,
        totalBills: totalBills,
        avgDailyBills: avgDailyBills,
        isBillTargetAchieved: isBillTargetAchieved,
        dailyBillBonus: dailyBillBonus,
        cardCommission: cardCommission,
        cardBreakdown: cardBreakdown,
        storesCardsDispatched: totalCardsDispatched,
        storesBonus: storesBonus,
        teamCommission: teamCommission,
        fuelAllowance: fuelAllowance,
        otherAllowances: otherAllowances,
        salaryAdvance: salaryAdvance,
        otherDeductions: otherDeductions,
        netSalary: netSalary,
        status: 'Draft', // 'Draft' | 'Approved' | 'Paid'
        notes: '',
        updatedAt: new Date().toISOString()
      });
    }

    return computedList;
  },

  renderPayrollTable(records) {
    const container = document.getElementById('payroll-table-body');
    if (!container) return;

    if (records.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-8 text-slate-400 font-bold text-xs">
            No employees found for this month. Click '⚡ Auto Calculate Salaries' to compute.
          </td>
        </tr>
      `;
      return;
    }

    const roleBadgeMap = {
      'owner': '<span class="px-2 py-0.5 rounded-lg text-[9px] font-black bg-purple-100 text-purple-700">👑 Owner</span>',
      'sm': '<span class="px-2 py-0.5 rounded-lg text-[9px] font-black bg-blue-100 text-blue-700">👔 SM</span>',
      'asm': '<span class="px-2 py-0.5 rounded-lg text-[9px] font-black bg-indigo-100 text-indigo-700">💼 ASM</span>',
      'supervisor': '<span class="px-2 py-0.5 rounded-lg text-[9px] font-black bg-amber-100 text-amber-700">📋 Supervisor</span>',
      'rep': '<span class="px-2 py-0.5 rounded-lg text-[9px] font-black bg-emerald-100 text-emerald-700">🚚 Rep</span>',
      'delivery': '<span class="px-2 py-0.5 rounded-lg text-[9px] font-black bg-sky-100 text-sky-700">📦 Delivery</span>',
      'stores': '<span class="px-2 py-0.5 rounded-lg text-[9px] font-black bg-teal-100 text-teal-700">🏬 Stores</span>',
      'hr': '<span class="px-2 py-0.5 rounded-lg text-[9px] font-black bg-pink-100 text-pink-700">👥 HR</span>'
    };

    let html = '';
    records.forEach((row, idx) => {
      const roleBadge = roleBadgeMap[row.userRole] || `<span class="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-slate-100 text-slate-700">${row.userRole}</span>`;
      const totalIncentives = (row.attendanceBonus || 0) + (row.dailyBillBonus || 0) + (row.cardCommission || 0) + (row.storesBonus || 0) + (row.teamCommission || 0);
      const totalAllowances = (row.fuelAllowance || 0) + (row.otherAllowances || 0);
      const totalDeductions = (row.salaryAdvance || 0) + (row.otherDeductions || 0);

      html += `
        <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs font-semibold text-slate-700">
          <!-- Employee & Role -->
          <td class="p-3">
            <div class="font-black text-slate-900 text-xs sm:text-sm leading-tight">${row.userName}</div>
            <div class="flex items-center gap-1.5 mt-0.5">
              ${roleBadge}
              <span class="text-[10px] text-slate-400 font-mono">@${row.userUsername}</span>
            </div>
          </td>

          <!-- Basic Salary (Editable with Checkbox toggle) -->
          <td class="p-3 text-right">
            <div class="flex items-center justify-end gap-1">
              <input type="checkbox" onchange="Payroll.toggleBasicSalary(${idx}, this.checked)" ${row.isBasicEnabled !== false ? 'checked' : ''} title="Toggle Basic Salary" class="w-3.5 h-3.5 text-emerald-600 rounded" />
              <input type="number" step="500" value="${row.basicSalary || 0}" onchange="Payroll.updateCell(${idx}, 'basicSalary', this.value)" class="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1 text-right text-xs font-black text-slate-900 focus:ring-1 focus:ring-emerald-500 outline-none" />
            </div>
            <span class="text-[9px] text-slate-400 block mt-0.5">LKR</span>
          </td>

          <!-- Attendance & Working Days -->
          <td class="p-3 text-center">
            <div class="font-black ${row.isAttendanceQualified ? 'text-emerald-700' : 'text-slate-600'}">
              ${row.workingDays || 0} Days
            </div>
            ${row.attendanceBonus > 0 ? `
              <span class="text-[9.5px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 block mt-0.5">+Rs. ${row.attendanceBonus.toLocaleString()}</span>
            ` : `<span class="text-[9px] text-slate-400 block mt-0.5">&lt; 25 Days</span>`}
          </td>

          <!-- Card Target & Daily Bill Commission -->
          <td class="p-3 text-right">
            <div class="font-black text-emerald-700">
              Rs. ${totalIncentives.toLocaleString()}
            </div>
            <div class="text-[9.5px] text-slate-500 mt-0.5 space-y-0.5">
              ${row.cardCommission > 0 ? `<span class="block text-purple-700">🏷️ Cards: +Rs. ${row.cardCommission.toLocaleString()}</span>` : ''}
              ${row.dailyBillBonus > 0 ? `<span class="block text-blue-700">📋 Bills: +Rs. ${row.dailyBillBonus.toLocaleString()}</span>` : ''}
              ${row.storesBonus > 0 ? `<span class="block text-teal-700">🏬 Dispatch: +Rs. ${row.storesBonus.toLocaleString()}</span>` : ''}
              ${row.teamCommission > 0 ? `<span class="block text-amber-700">👑 Team: +Rs. ${row.teamCommission.toLocaleString()}</span>` : ''}
            </div>
          </td>

          <!-- Allowances (Fuel, Bike, Phone) -->
          <td class="p-3 text-right">
            <input type="number" step="500" value="${totalAllowances}" onchange="Payroll.updateCell(${idx}, 'fuelAllowance', this.value)" class="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1 text-right text-xs font-black text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none" />
            <span class="text-[9px] text-slate-400 block mt-0.5">Fuel / Bike</span>
          </td>

          <!-- Deductions (Advance, EPF) -->
          <td class="p-3 text-right">
            <input type="number" step="500" value="${totalDeductions}" onchange="Payroll.updateCell(${idx}, 'salaryAdvance', this.value)" class="w-20 bg-rose-50/60 border border-rose-200 rounded-lg px-2 py-1 text-right text-xs font-black text-rose-700 focus:ring-1 focus:ring-rose-500 outline-none" />
            <span class="text-[9px] text-rose-500 block mt-0.5">Advance / Cut</span>
          </td>

          <!-- Net Salary Payable (Bold Highlighted) -->
          <td class="p-3 text-right">
            <div class="text-sm font-black text-emerald-700 bg-emerald-50/80 px-2 py-1 rounded-xl border border-emerald-200 inline-block shadow-xs">
              Rs. ${(row.netSalary || 0).toLocaleString()}
            </div>
          </td>

          <!-- Status & Actions -->
          <td class="p-3 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="Payroll.printPayslip(${idx})" class="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl border border-blue-200 active:scale-95 transition-all" title="Print 80mm / A4 Payslip">
                🖨️ Slip
              </button>
              <button onclick="Payroll.openAdjustModal(${idx})" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl active:scale-95 transition-all" title="Detailed Edit & Custom Bonus">
                ⚙️ Edit
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    container.innerHTML = html;
  },

  updatePayrollKpiChips(records) {
    let totalBasic = 0;
    let totalIncentives = 0;
    let totalNet = 0;

    records.forEach(r => {
      totalBasic += (Number(r.basicSalary) || 0);
      totalIncentives += (Number(r.attendanceBonus) || 0) + (Number(r.dailyBillBonus) || 0) + (Number(r.cardCommission) || 0) + (Number(r.storesBonus) || 0) + (Number(r.teamCommission) || 0);
      totalNet += (Number(r.netSalary) || 0);
    });

    const totalNetEl = document.getElementById('payroll-kpi-total-net');
    const totalBasicEl = document.getElementById('payroll-kpi-total-basic');
    const totalIncentivesEl = document.getElementById('payroll-kpi-total-incentives');
    const totalStaffEl = document.getElementById('payroll-kpi-total-staff');

    if (totalNetEl) totalNetEl.textContent = `Rs. ${totalNet.toLocaleString()}`;
    if (totalBasicEl) totalBasicEl.textContent = `Rs. ${totalBasic.toLocaleString()}`;
    if (totalIncentivesEl) totalIncentivesEl.textContent = `Rs. ${totalIncentives.toLocaleString()}`;
    if (totalStaffEl) totalStaffEl.textContent = `${records.length} Staff`;
  },

  /** Inline Cell Update with instantaneous live math */
  updateCell(index, field, value) {
    const row = this.payrollSheetCache[index];
    if (!row) return;

    row[field] = Number(value) || 0;
    this.recalculateRowNet(row);
    this.renderPayrollTable(this.payrollSheetCache);
    this.updatePayrollKpiChips(this.payrollSheetCache);
  },

  toggleBasicSalary(index, isChecked) {
    const row = this.payrollSheetCache[index];
    if (!row) return;

    row.isBasicEnabled = isChecked;
    if (!isChecked) {
      row._previousBasic = row.basicSalary;
      row.basicSalary = 0;
    } else {
      row.basicSalary = row._previousBasic || 30000;
    }
    this.recalculateRowNet(row);
    this.renderPayrollTable(this.payrollSheetCache);
    this.updatePayrollKpiChips(this.payrollSheetCache);
  },

  recalculateRowNet(row) {
    const basic = row.isBasicEnabled !== false ? (Number(row.basicSalary) || 0) : 0;
    const totalIncentives = (Number(row.attendanceBonus) || 0) + (Number(row.dailyBillBonus) || 0) + (Number(row.cardCommission) || 0) + (Number(row.storesBonus) || 0) + (Number(row.teamCommission) || 0);
    const totalAllowances = (Number(row.fuelAllowance) || 0) + (Number(row.otherAllowances) || 0);
    const totalDeductions = (Number(row.salaryAdvance) || 0) + (Number(row.otherDeductions) || 0);
    row.netSalary = Math.max(0, basic + totalIncentives + totalAllowances - totalDeductions);
  },

  /** Save entire monthly payroll sheet to Cloud Database */
  async saveMonthlyPayrollSheet() {
    if (!this.payrollSheetCache || this.payrollSheetCache.length === 0) {
      UI.showToast('No payroll records to save.', 'warning');
      return;
    }

    try {
      const activeTid = getActiveTenantId() || 1;
      const monthStr = this.currentMonth;

      for (const row of this.payrollSheetCache) {
        const payload = Object.assign({}, row, {
          tenantId: activeTid,
          month: monthStr,
          status: 'Approved',
          updatedAt: new Date().toISOString()
        });

        const existing = await db.payroll?.where('id').equals(row.id).first();
        if (existing) {
          await db.payroll.update(existing.id, payload);
        } else {
          await db.payroll?.add(payload);
        }
      }

      UI.showToast(`💾 Monthly Payroll for ${monthStr} saved & approved successfully!`, 'success');
      if (typeof SoundFX !== 'undefined') SoundFX.play('save');
    } catch (err) {
      UI.showToast('Error saving payroll sheet: ' + err.message, 'error');
    }
  },

  /** Open Employee Salary Adjustment Modal */
  openAdjustModal(index) {
    const row = this.payrollSheetCache[index];
    if (!row) return;

    this.selectedPayslipId = index;
    document.getElementById('payroll-adj-name').textContent = `${row.userName} (${row.userRole.toUpperCase()})`;
    document.getElementById('payroll-adj-basic').value = row.basicSalary || 0;
    document.getElementById('payroll-adj-attendance').value = row.attendanceBonus || 0;
    document.getElementById('payroll-adj-card-bonus').value = row.cardCommission || 0;
    document.getElementById('payroll-adj-bill-bonus').value = row.dailyBillBonus || 0;
    document.getElementById('payroll-adj-stores-bonus').value = row.storesBonus || 0;
    document.getElementById('payroll-adj-team-bonus').value = row.teamCommission || 0;
    document.getElementById('payroll-adj-fuel').value = row.fuelAllowance || 0;
    document.getElementById('payroll-adj-other-allow').value = row.otherAllowances || 0;
    document.getElementById('payroll-adj-advance').value = row.salaryAdvance || 0;
    document.getElementById('payroll-adj-other-deduct').value = row.otherDeductions || 0;
    document.getElementById('payroll-adj-notes').value = row.notes || '';

    UI.openModal('modal-payroll-adjust');
  },

  saveAdjustModal() {
    if (this.selectedPayslipId === null) return;
    const row = this.payrollSheetCache[this.selectedPayslipId];
    if (!row) return;

    row.basicSalary = Number(document.getElementById('payroll-adj-basic').value) || 0;
    row.attendanceBonus = Number(document.getElementById('payroll-adj-attendance').value) || 0;
    row.cardCommission = Number(document.getElementById('payroll-adj-card-bonus').value) || 0;
    row.dailyBillBonus = Number(document.getElementById('payroll-adj-bill-bonus').value) || 0;
    row.storesBonus = Number(document.getElementById('payroll-adj-stores-bonus').value) || 0;
    row.teamCommission = Number(document.getElementById('payroll-adj-team-bonus').value) || 0;
    row.fuelAllowance = Number(document.getElementById('payroll-adj-fuel').value) || 0;
    row.otherAllowances = Number(document.getElementById('payroll-adj-other-allow').value) || 0;
    row.salaryAdvance = Number(document.getElementById('payroll-adj-advance').value) || 0;
    row.otherDeductions = Number(document.getElementById('payroll-adj-other-deduct').value) || 0;
    row.notes = document.getElementById('payroll-adj-notes').value.trim();

    this.recalculateRowNet(row);
    UI.closeModal('modal-payroll-adjust');
    this.renderPayrollTable(this.payrollSheetCache);
    this.updatePayrollKpiChips(this.payrollSheetCache);
    UI.showToast('Adjustments applied! ✅', 'success');
  },

  /** Print 80mm POS Thermal Payslip or A4 Format */
  async printPayslip(index) {
    const row = this.payrollSheetCache[index];
    if (!row) return;

    const company = filterByTenant(await db.company.toArray())[0] || {
      name: 'LANKA SPICE DISTRIBUTORS',
      tagline: 'Wholesale Card & Sachet Distribution',
      phone: '077 123 4567 / 025 222 3456'
    };

    const monthLabel = this.currentMonth;
    const datePrinted = new Date().toLocaleString();

    const slipHtml = `
      <div style="font-family: 'Courier New', monospace; width: 100%; max-width: 320px; margin: 0 auto; color: #000; font-size: 11.5px; padding: 10px 4px; line-height: 1.35;">
        <!-- Header -->
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          <div style="font-size: 15px; font-weight: 900; text-transform: uppercase;">${company.name}</div>
          <div style="font-size: 10px; font-weight: bold;">${company.tagline || 'Wholesale Distribution'}</div>
          <div style="font-size: 10px;">📞 ${company.phone || ''}</div>
          <div style="font-size: 13px; font-weight: 900; margin-top: 4px; background: #000; color: #fff; padding: 2px 4px; border-radius: 4px; display: inline-block;">
            SALARY PAYSLIP / වැටුප් පත්‍රිකාව
          </div>
        </div>

        <!-- Staff Info -->
        <div style="border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 6px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Staff Name:</span>
            <strong>${row.userName}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Role/Designation:</span>
            <strong>${row.userRole.toUpperCase()}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Salary Month:</span>
            <strong>${monthLabel}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Working Days:</span>
            <span>${row.workingDays} Days</span>
          </div>
        </div>

        <!-- Earnings Section -->
        <div style="font-weight: 900; font-size: 11px; margin-bottom: 2px; text-decoration: underline;">EARNINGS & INCENTIVES (ඉපැයීම්):</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px;">
          ${row.isBasicEnabled !== false ? `
            <tr><td>Basic Salary:</td><td style="text-align: right; font-weight: bold;">Rs. ${(row.basicSalary || 0).toLocaleString()}</td></tr>
          ` : '<tr><td>Basic Salary:</td><td style="text-align: right; color: #666;">(Commission Only)</td></tr>'}
          ${row.attendanceBonus > 0 ? `
            <tr><td>Attendance Bonus (25+ Days):</td><td style="text-align: right;">+Rs. ${row.attendanceBonus.toLocaleString()}</td></tr>
          ` : ''}
          ${row.dailyBillBonus > 0 ? `
            <tr><td>Daily Bill Target Bonus:</td><td style="text-align: right;">+Rs. ${row.dailyBillBonus.toLocaleString()}</td></tr>
          ` : ''}
          ${row.cardCommission > 0 ? `
            <tr><td>Card Target Commission:</td><td style="text-align: right;">+Rs. ${row.cardCommission.toLocaleString()}</td></tr>
          ` : ''}
          ${row.storesBonus > 0 ? `
            <tr><td>Stores Dispatch Bonus:</td><td style="text-align: right;">+Rs. ${row.storesBonus.toLocaleString()}</td></tr>
          ` : ''}
          ${row.teamCommission > 0 ? `
            <tr><td>Team Turnover Commission:</td><td style="text-align: right;">+Rs. ${row.teamCommission.toLocaleString()}</td></tr>
          ` : ''}
          ${row.fuelAllowance > 0 ? `
            <tr><td>Fuel / Bike Allowance:</td><td style="text-align: right;">+Rs. ${row.fuelAllowance.toLocaleString()}</td></tr>
          ` : ''}
          ${row.otherAllowances > 0 ? `
            <tr><td>Other Allowance:</td><td style="text-align: right;">+Rs. ${row.otherAllowances.toLocaleString()}</td></tr>
          ` : ''}
        </table>

        <!-- Deductions Section -->
        ${(row.salaryAdvance > 0 || row.otherDeductions > 0) ? `
          <div style="font-weight: 900; font-size: 11px; margin-top: 4px; margin-bottom: 2px; text-decoration: underline; color: #900;">DEDUCTIONS (අඩුකිරීම්):</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px;">
            ${row.salaryAdvance > 0 ? `
              <tr><td>Salary Advance (අත්තිකාරම්):</td><td style="text-align: right; color: #900;">-Rs. ${row.salaryAdvance.toLocaleString()}</td></tr>
            ` : ''}
            ${row.otherDeductions > 0 ? `
              <tr><td>Other Deductions:</td><td style="text-align: right; color: #900;">-Rs. ${row.otherDeductions.toLocaleString()}</td></tr>
            ` : ''}
          </table>
        ` : ''}

        <!-- Net Salary Box -->
        <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; margin: 6px 0; text-align: center;">
          <div style="font-size: 11px; font-weight: bold; text-transform: uppercase;">NET SALARY PAYABLE (ශුද්ධ වැටුප):</div>
          <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px;">
            Rs. ${(row.netSalary || 0).toLocaleString()}.00
          </div>
        </div>

        ${row.notes ? `
          <div style="font-size: 10px; font-style: italic; margin-bottom: 6px;">Note: ${row.notes}</div>
        ` : ''}

        <!-- Signatures -->
        <div style="display: flex; justify-content: space-between; margin-top: 25px; padding-top: 5px; border-top: 1px dotted #999; font-size: 9.5px; text-align: center;">
          <div>
            ...........................<br>
            Prepared By (HR)
          </div>
          <div>
            ...........................<br>
            Approved (Owner)
          </div>
          <div>
            ...........................<br>
            Employee Signature
          </div>
        </div>

        <div style="text-align: center; font-size: 9px; color: #666; margin-top: 8px;">
          Printed: ${datePrinted} • MOB POS HR Engine
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Payslip - ${row.userName} (${monthLabel})</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                @page { margin: 2mm; size: auto; }
              }
            </style>
          </head>
          <body onload="window.print();">
            ${slipHtml}
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  },

  /** Open Payroll Rules & Card Target Slab Settings Modal */
  async openRulesModal() {
    const rules = await this.getPayrollRules();

    document.getElementById('rule-basic-owner').value = rules.basicSalaries['owner'] || 100000;
    document.getElementById('rule-basic-sm').value = rules.basicSalaries['sm'] || 65000;
    document.getElementById('rule-basic-asm').value = rules.basicSalaries['asm'] || 50000;
    document.getElementById('rule-basic-supervisor').value = rules.basicSalaries['supervisor'] || 42000;
    document.getElementById('rule-basic-rep').value = rules.basicSalaries['rep'] || 35000;
    document.getElementById('rule-basic-delivery').value = rules.basicSalaries['delivery'] || 35000;
    document.getElementById('rule-basic-stores').value = rules.basicSalaries['stores'] || 30000;
    document.getElementById('rule-basic-hr').value = rules.basicSalaries['hr'] || 40000;

    document.getElementById('rule-attendance-days').value = rules.attendanceMinDays || 25;
    document.getElementById('rule-attendance-bonus').value = rules.attendanceBonus || 5000;
    document.getElementById('rule-bill-target').value = rules.dailyBillMinAvg || 20;
    document.getElementById('rule-bill-bonus').value = rules.dailyBillBonus || 3000;

    document.getElementById('rule-stores-rate').value = rules.storesRatePerCard || 2.00;
    document.getElementById('rule-stores-basic-toggle').checked = rules.storesEnableBasic !== false;

    document.getElementById('rule-sm-comm').value = rules.smCommissionPct || 1.0;
    document.getElementById('rule-asm-comm').value = rules.asmCommissionPct || 0.5;

    // Populate Card Target Slabs Table
    this.renderCardSlabsEditor(rules.cardTargetSlabs || []);

    UI.openModal('modal-payroll-rules');
  },

  renderCardSlabsEditor(slabs) {
    const container = document.getElementById('payroll-card-slabs-list');
    if (!container) return;

    let html = '';
    slabs.forEach((s, idx) => {
      html += `
        <div class="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl" id="slab-row-${idx}">
          <input type="text" value="${s.name}" placeholder="Slab Description" class="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 slab-name-input" />
          <select class="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 slab-key-input">
            <option value="chilli" ${s.categoryKey === 'chilli' ? 'selected' : ''}>🌶️ Chilli (මිරිස්)</option>
            <option value="curry" ${s.categoryKey === 'curry' ? 'selected' : ''}>🌿 Curry (තුනපහ)</option>
            <option value="meat" ${s.categoryKey === 'meat' ? 'selected' : ''}>🍖 Meat (මස් කුඩු)</option>
            <option value="all" ${s.categoryKey === 'all' ? 'selected' : ''}>📦 All Cards (සියල්ල)</option>
          </select>
          <input type="number" value="${s.minCards}" placeholder="Min Cards" class="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1 text-right text-xs font-black text-slate-800 slab-min-input" title="Target Cards Required" />
          <input type="number" value="${s.bonus}" placeholder="Bonus Rs" class="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1 text-right text-xs font-black text-emerald-700 slab-bonus-input" title="Bonus Cash LKR" />
          <button type="button" onclick="this.parentElement.remove()" class="text-rose-500 hover:text-rose-700 font-bold px-1.5 text-base">✕</button>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  addNewCardSlabRow() {
    const container = document.getElementById('payroll-card-slabs-list');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl';
    div.innerHTML = `
      <input type="text" value="New Card Target" placeholder="Slab Description" class="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 slab-name-input" />
      <select class="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 slab-key-input">
        <option value="chilli">🌶️ Chilli (මිරිස්)</option>
        <option value="curry">🌿 Curry (තුනපහ)</option>
        <option value="meat">🍖 Meat (මස් කුඩු)</option>
        <option value="all">📦 All Cards (සියල්ල)</option>
      </select>
      <input type="number" value="100" placeholder="Min Cards" class="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1 text-right text-xs font-black text-slate-800 slab-min-input" />
      <input type="number" value="1000" placeholder="Bonus Rs" class="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1 text-right text-xs font-black text-emerald-700 slab-bonus-input" />
      <button type="button" onclick="this.parentElement.remove()" class="text-rose-500 hover:text-rose-700 font-bold px-1.5 text-base">✕</button>
    `;
    container.appendChild(div);
  },

  async saveRulesModal() {
    const slabs = [];
    const slabRows = document.querySelectorAll('#payroll-card-slabs-list > div');
    slabRows.forEach((row, idx) => {
      const name = row.querySelector('.slab-name-input')?.value.trim() || `Slab ${idx + 1}`;
      const categoryKey = row.querySelector('.slab-key-input')?.value || 'all';
      const minCards = Number(row.querySelector('.slab-min-input')?.value) || 100;
      const bonus = Number(row.querySelector('.slab-bonus-input')?.value) || 1000;
      slabs.push({ id: idx + 1, name, categoryKey, minCards, bonus });
    });

    const newRules = {
      basicSalaries: {
        'owner': Number(document.getElementById('rule-basic-owner')?.value) || 100000,
        'sm': Number(document.getElementById('rule-basic-sm')?.value) || 65000,
        'asm': Number(document.getElementById('rule-basic-asm')?.value) || 50000,
        'supervisor': Number(document.getElementById('rule-basic-supervisor')?.value) || 42000,
        'rep': Number(document.getElementById('rule-basic-rep')?.value) || 35000,
        'delivery': Number(document.getElementById('rule-basic-delivery')?.value) || 35000,
        'stores': Number(document.getElementById('rule-basic-stores')?.value) || 30000,
        'hr': Number(document.getElementById('rule-basic-hr')?.value) || 40000
      },
      attendanceMinDays: Number(document.getElementById('rule-attendance-days')?.value) || 25,
      attendanceBonus: Number(document.getElementById('rule-attendance-bonus')?.value) || 5000,
      dailyBillMinAvg: Number(document.getElementById('rule-bill-target')?.value) || 20,
      dailyBillBonus: Number(document.getElementById('rule-bill-bonus')?.value) || 3000,
      storesRatePerCard: Number(document.getElementById('rule-stores-rate')?.value) || 2.00,
      storesEnableBasic: Boolean(document.getElementById('rule-stores-basic-toggle')?.checked),
      smCommissionPct: Number(document.getElementById('rule-sm-comm')?.value) || 1.0,
      asmCommissionPct: Number(document.getElementById('rule-asm-comm')?.value) || 0.5,
      cardTargetSlabs: slabs
    };

    await this.savePayrollRules(newRules);
    UI.closeModal('modal-payroll-rules');
    await this.recalculateMonth();
  }
};

window.Payroll = Payroll;
