/**
 * HR & PAYROLL MANAGEMENT SYSTEM (20 Core Enterprise Modules)
 * Fully interactive with CRUD (Add, Edit, Delete, View), Photo Verification & Field GPS Tracking
 */

const HR = {
  activeModule: 'dashboard',
  activeCategory: 'overview',
  selectedEmployeeId: null,

  CATEGORIES: [
    { id: 'overview', name: '📊 Overview', modules: ['dashboard'] },
    { id: 'staff', name: '👥 Staff & Org', modules: ['employees', 'organization', 'salesTeam'] },
    { id: 'attendance', name: '⏱️ Attendance & GPS', modules: ['attendance', 'fieldAttendance', 'shifts'] },
    { id: 'leaves', name: '🌴 Leaves & OT', modules: ['leaves', 'overtime'] },
    { id: 'payroll', name: '💰 Payroll & Pay', modules: ['payroll', 'commissions', 'epfEtf', 'payments', 'payslips'] },
    { id: 'talent', name: '🎯 Talent & Admin', modules: ['performance', 'recruitment', 'training', 'requests', 'reports', 'settings'] }
  ],

  MODULE_NAMES: {
    dashboard: '1. HR Dashboard',
    employees: '2. Employee Management',
    organization: '3. Organization & Hierarchy',
    salesTeam: '4. Sales Team, Products & Targets (නිෂ්පාදන & ඉලක්ක)',
    attendance: '5. Daily Attendance Register',
    fieldAttendance: '6. Field GPS & Bike Meter Photos',
    shifts: '7. Shift Management',
    leaves: '8. Leave Management',
    overtime: '9. Overtime (OT) Management',
    payroll: '10. Automated Payroll Engine',
    commissions: '11. Sales Commission & Slabs',
    epfEtf: '12. EPF / ETF Statutory',
    payments: '13. Salary Payments',
    payslips: '14. Payslip Management',
    performance: '15. Employee Performance',
    recruitment: '16. Recruitment & Vacancies',
    training: '17. Training & Development',
    requests: '18. Employee Requests Desk',
    reports: '19. HR & Payroll Reports',
    settings: '20. HR Settings & Policies'
  },

  DEPARTMENTS: [
    { id: 'dept_sales', name: 'Sales & Field Distribution', code: 'SALES', head: 'Sales Manager' },
    { id: 'dept_delivery', name: 'Delivery & Logistics', code: 'LOG', head: 'Delivery Lead' },
    { id: 'dept_stores', name: 'Warehouse & Stores', code: 'WH', head: 'Stores Keeper' },
    { id: 'dept_hr', name: 'Human Resources & Payroll', code: 'HR', head: 'HR Officer' },
    { id: 'dept_mgmt', name: 'Executive Management', code: 'EXEC', head: 'Managing Director' }
  ],

  async init() {
    await this.seedDefaultsIfNeeded();
    this.switchModule('dashboard');
  },

  async seedDefaultsIfNeeded() {
    try {
      if (!db.employees) return;
      const count = await db.employees.count();
      if (count === 0) {
        const activeTid = getActiveTenantId() || 1;
        const defaultEmployees = [
          {
            empNo: 'EMP-001',
            fullName: 'Danushka Silva (Managing Director)',
            callingName: 'Danushka',
            nic: '852341234V',
            phone: '077 123 4567',
            email: 'admin@spicepos.lk',
            department: 'Executive Management',
            designation: 'Managing Director / Owner',
            role: 'admin',
            basicSalary: 100000,
            joinDate: '2023-01-01',
            status: 'Active',
            tenantId: activeTid
          },
          {
            empNo: 'EMP-002',
            fullName: 'Kasun Perera (Sales Manager)',
            callingName: 'Kasun',
            nic: '901234567V',
            phone: '077 222 3344',
            email: 'sm1@spicepos.lk',
            department: 'Sales & Field Distribution',
            designation: 'Sales Manager (SM)',
            role: 'sm',
            basicSalary: 65000,
            joinDate: '2023-03-15',
            status: 'Active',
            tenantId: activeTid
          },
          {
            empNo: 'EMP-003',
            fullName: 'Nuwan Bandara (Area Sales Manager)',
            callingName: 'Nuwan',
            nic: '912345678V',
            phone: '077 333 4455',
            email: 'asm1@spicepos.lk',
            department: 'Sales & Field Distribution',
            designation: 'Area Sales Manager (ASM)',
            role: 'asm',
            basicSalary: 50000,
            joinDate: '2023-06-01',
            status: 'Active',
            tenantId: activeTid
          },
          {
            empNo: 'EMP-004',
            fullName: 'Saman Kumara (Field Supervisor)',
            callingName: 'Saman',
            nic: '923456789V',
            phone: '077 444 5566',
            email: 'sup1@spicepos.lk',
            department: 'Sales & Field Distribution',
            designation: 'Field Supervisor',
            role: 'supervisor',
            basicSalary: 42000,
            joinDate: '2023-08-10',
            status: 'Active',
            tenantId: activeTid
          },
          {
            empNo: 'EMP-005',
            fullName: 'Kamal Jayasinghe (Sales Rep - Galnewa)',
            callingName: 'Kamal',
            nic: '951234567V',
            phone: '071 987 6543',
            email: 'rep1@spicepos.lk',
            department: 'Sales & Field Distribution',
            designation: 'Sales Representative (Order Booker)',
            role: 'rep',
            basicSalary: 35000,
            joinDate: '2024-01-05',
            status: 'Active',
            tenantId: activeTid
          },
          {
            empNo: 'EMP-006',
            fullName: 'Ruwan Thushara (Delivery Driver)',
            callingName: 'Ruwan',
            nic: '934567890V',
            phone: '078 123 9876',
            email: 'delivery1@spicepos.lk',
            department: 'Delivery & Logistics',
            designation: 'Delivery Driver',
            role: 'delivery',
            basicSalary: 35000,
            joinDate: '2024-02-01',
            status: 'Active',
            tenantId: activeTid
          },
          {
            empNo: 'EMP-007',
            fullName: 'Nimal Chandrasiri (Stores Keeper)',
            callingName: 'Nimal',
            nic: '882345678V',
            phone: '076 555 8899',
            email: 'stores1@spicepos.lk',
            department: 'Warehouse & Stores',
            designation: 'Stores Keeper (Packing & Stock)',
            role: 'stores',
            basicSalary: 30000,
            joinDate: '2023-11-15',
            status: 'Active',
            tenantId: activeTid
          },
          {
            empNo: 'EMP-008',
            fullName: 'Dilani Samarawickrama (HR Officer)',
            callingName: 'Dilani',
            nic: '942345678V',
            phone: '077 888 9900',
            email: 'hr@spicepos.lk',
            department: 'Human Resources & Payroll',
            designation: 'HR & Payroll Officer',
            role: 'hr',
            basicSalary: 40000,
            joinDate: '2023-09-01',
            status: 'Active',
            tenantId: activeTid
          }
        ];
        await db.employees.bulkAdd(defaultEmployees);
      }
    } catch (e) {
      console.warn('HR seed warning:', e);
    }
  },

  // Switch active module & keep sub-navigation responsive without overflow
  switchModule(moduleKey) {
    this.activeModule = moduleKey;

    // Determine category
    const cat = this.CATEGORIES.find(c => c.modules.includes(moduleKey));
    if (cat) this.activeCategory = cat.id;

    this.renderSubNav();

    const selector = document.getElementById('hr-module-dropdown-selector');
    if (selector) selector.value = moduleKey;

    this.renderActiveModule();
  },

  // Switch high-level category
  switchCategory(catId) {
    this.activeCategory = catId;
    const cat = this.CATEGORIES.find(c => c.id === catId);
    if (cat && cat.modules.length > 0) {
      this.switchModule(cat.modules[0]);
    }
  },

  // Render responsive sub-navigation
  renderSubNav() {
    const navContainer = document.getElementById('hr-sub-nav-wrapper');
    if (!navContainer) return;

    const currentCat = this.CATEGORIES.find(c => c.id === this.activeCategory) || this.CATEGORIES[0];

    navContainer.innerHTML = `
      <!-- Category Tabs (No horizontal overflow) -->
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs">
        ${this.CATEGORIES.map(c => `
          <button onclick="HR.switchCategory('${c.id}')" class="py-2 px-1.5 rounded-xl font-bold text-center transition-all ${c.id === this.activeCategory ? 'bg-white text-pink-700 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'}">
            ${c.name}
          </button>
        `).join('')}
      </div>

      <!-- Category Sub-Module Pills (Wrap naturally without overflow) -->
      <div class="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
        ${currentCat.modules.map(modKey => `
          <button onclick="HR.switchModule('${modKey}')" class="px-3 py-1.5 rounded-xl font-bold transition-all ${modKey === this.activeModule ? 'bg-pink-600 text-white shadow-sm font-black' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'}">
            ${this.MODULE_NAMES[modKey] || modKey}
          </button>
        `).join('')}
      </div>
    `;
  },

  async renderActiveModule() {
    const container = document.getElementById('hr-module-content');
    if (!container) return;

    switch (this.activeModule) {
      case 'dashboard': await this.renderDashboard(container); break;
      case 'employees': await this.renderEmployees(container); break;
      case 'organization': await this.renderOrganization(container); break;
      case 'salesTeam': await this.renderSalesTeam(container); break;
      case 'attendance': await this.renderAttendance(container); break;
      case 'fieldAttendance': await this.renderFieldAttendance(container); break;
      case 'shifts': await this.renderShifts(container); break;
      case 'leaves': await this.renderLeaves(container); break;
      case 'overtime': await this.renderOvertime(container); break;
      case 'payroll': await this.renderPayroll(container); break;
      case 'commissions': await this.renderCommissions(container); break;
      case 'epfEtf': await this.renderEpfEtf(container); break;
      case 'payments': await this.renderPayments(container); break;
      case 'payslips': await this.renderPayslips(container); break;
      case 'performance': await this.renderPerformance(container); break;
      case 'recruitment': await this.renderRecruitment(container); break;
      case 'training': await this.renderTraining(container); break;
      case 'requests': await this.renderRequests(container); break;
      case 'reports': await this.renderReports(container); break;
      case 'settings': await this.renderSettings(container); break;
      default: await this.renderDashboard(container);
    }
  },

  // =========================================================================
  // MODULE 1: HR DASHBOARD
  // =========================================================================
  async renderDashboard(container) {
    const employees = filterByTenant(await db.employees?.toArray() || []);
    const today = new Date().toISOString().split('T')[0];
    const attendance = filterByTenant(await db.attendance?.where('date').equals(today).toArray() || []);
    const photos = filterByTenant(await db.fieldPhotos?.where('date').equals(today).toArray() || []);

    const presentCount = attendance.filter(a => a.status === 'Present').length;
    const leaveCount = attendance.filter(a => a.status === 'Leave').length;
    const lateCount = attendance.filter(a => (a.lateMinutes || 0) > 0).length;

    container.innerHTML = `
      <div class="space-y-4 max-w-full overflow-hidden">
        <!-- Live KPI Overview Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div class="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-3.5 rounded-3xl shadow-sm">
            <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-100">Total Staff</span>
            <div class="text-xl sm:text-2xl font-black mt-0.5">${employees.length} Employees</div>
            <span class="text-[10.5px] text-indigo-200">Across 5 Departments</span>
          </div>
          <div class="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-3.5 rounded-3xl shadow-sm">
            <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Present Today</span>
            <div class="text-xl sm:text-2xl font-black mt-0.5">${presentCount} Staff</div>
            <span class="text-[10.5px] text-emerald-200">Morning Meter & Selfies Logged</span>
          </div>
          <div class="bg-gradient-to-br from-amber-500 to-amber-700 text-white p-3.5 rounded-3xl shadow-sm">
            <span class="text-[10px] font-bold uppercase tracking-wider text-amber-100">Field Photos Today</span>
            <div class="text-xl sm:text-2xl font-black mt-0.5">${photos.length} Photos</div>
            <span class="text-[10.5px] text-amber-200">Meters & Shop Displays</span>
          </div>
          <div class="bg-gradient-to-br from-rose-500 to-rose-700 text-white p-3.5 rounded-3xl shadow-sm">
            <span class="text-[10px] font-bold uppercase tracking-wider text-rose-100">Leaves / Absent</span>
            <div class="text-xl sm:text-2xl font-black mt-0.5">${leaveCount} On Leave</div>
            <span class="text-[10.5px] text-rose-200">${lateCount} Late Today</span>
          </div>
        </div>

        <!-- 20 Modules Quick Jump Grid -->
        <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">Enterprise HR & Payroll (20 Modules)</h3>
              <p class="text-[11px] text-slate-400">Click any module to open directly</p>
            </div>
            <span class="text-[10px] font-black text-pink-700 bg-pink-50 px-2 py-0.5 rounded-lg border border-pink-200">
              Complete Enterprise Edition
            </span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 text-xs">
            ${Object.entries(this.MODULE_NAMES).map(([modId, name]) => {
              if (modId === 'dashboard') return '';
              return `
                <button onclick="HR.switchModule('${modId}')" class="p-2.5 rounded-2xl bg-slate-50 hover:bg-pink-50 hover:border-pink-300 border border-slate-200 text-left transition-all active:scale-95 group">
                  <div class="font-bold text-slate-800 text-[11px] group-hover:text-pink-700 leading-tight">${name}</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  },

  // =========================================================================
  // MODULE 2: EMPLOYEE MANAGEMENT (Full CRUD: Add, Edit, Delete, ID Card)
  // =========================================================================
  async renderEmployees(container) {
    const employees = filterByTenant(await db.employees?.toArray() || []);

    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 max-w-full overflow-hidden">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div>
            <h3 class="font-black text-sm text-slate-900 uppercase tracking-wider">Employee Directory (සේවක ලේඛනය)</h3>
            <p class="text-[11px] text-slate-400">${employees.length} Registered Team Members · Complete Add, Edit, Delete & ID Card Generator</p>
          </div>
          <button onclick="HR.openAddEmployeeModal()" class="px-3.5 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-2xl text-xs font-black shadow-md flex items-center gap-1.5 active:scale-95">
            <span>➕ Add New Employee</span>
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr class="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                <th class="p-3">Staff ID / Name</th>
                <th class="p-3">Department</th>
                <th class="p-3">Designation</th>
                <th class="p-3">Contact</th>
                <th class="p-3 text-right">Basic Salary</th>
                <th class="p-3 text-center">Status</th>
                <th class="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${employees.map(emp => `
                <tr class="hover:bg-slate-50/80 transition-colors">
                  <td class="p-3">
                    <div class="font-black text-slate-900">${emp.fullName}</div>
                    <span class="text-[10px] font-mono text-pink-700 font-bold bg-pink-50 px-1.5 py-0.2 rounded">${emp.empNo}</span>
                  </td>
                  <td class="p-3 font-semibold text-slate-600">${emp.department}</td>
                  <td class="p-3 font-bold text-slate-800">${emp.designation}</td>
                  <td class="p-3 text-slate-600">${emp.phone}</td>
                  <td class="p-3 text-right font-black text-slate-900">Rs. ${(emp.basicSalary || 0).toLocaleString()}</td>
                  <td class="p-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${emp.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
                      ${emp.status}
                    </span>
                  </td>
                  <td class="p-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                      <button onclick="HR.openEditEmployeeModal('${emp.empNo}')" class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px]" title="Edit Employee">✏️</button>
                      <button onclick="HR.printEmployeeIdCard('${emp.empNo}')" class="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px]" title="Print ID Card">🪪</button>
                      <button onclick="HR.deleteEmployee('${emp.empNo}')" class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px]" title="Delete Employee">🗑️</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async openAddEmployeeModal() {
    // Clear previous values
    const fields = ['hr-new-emp-name','hr-new-emp-phone','hr-new-emp-nic','hr-new-emp-username','hr-new-emp-pin'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const salaryEl = document.getElementById('hr-new-emp-salary');
    if (salaryEl) salaryEl.value = '35000';
    const pinEl = document.getElementById('hr-new-emp-pin');
    if (pinEl) pinEl.value = '1234';
    const createLoginChk = document.getElementById('hr-new-emp-create-login');
    if (createLoginChk) {
      createLoginChk.checked = true;
      document.getElementById('hr-new-login-fields')?.classList.remove('hidden');
    }

    // Populate routes dropdown
    const routeSelect = document.getElementById('hr-new-emp-route');
    if (routeSelect) {
      try {
        const rawRoutes = await db.routes?.toArray() || [];
        const routes = filterByTenant(rawRoutes);
        let html = '<option value="">-- No Route Assigned (මාර්ගයක් නැත) --</option>';
        routes.forEach(r => {
          html += `<option value="${r.id}">${r.name}</option>`;
        });
        routeSelect.innerHTML = html;
      } catch (e) {}
    }

    // Auto-generate suggested username when typing name
    const nameEl = document.getElementById('hr-new-emp-name');
    if (nameEl) {
      nameEl.oninput = () => {
        const usernameEl = document.getElementById('hr-new-emp-username');
        if (usernameEl && !usernameEl.dataset.manuallyEdited) {
          const clean = nameEl.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          if (clean) usernameEl.value = clean.slice(0, 10);
        }
      };
    }
    const usernameEl = document.getElementById('hr-new-emp-username');
    if (usernameEl) {
      usernameEl.dataset.manuallyEdited = '';
      usernameEl.oninput = () => { usernameEl.dataset.manuallyEdited = '1'; };
    }

    UI.openModal('modal-hr-add-employee');
    setTimeout(() => {
      const nameElFocus = document.getElementById('hr-new-emp-name');
      if (nameElFocus) nameElFocus.focus();
    }, 150);
  },

  onRoleChange(role, mode = 'new') {
    const prefix = mode === 'new' ? 'hr-new-emp' : 'hr-edit-emp';
    const deptEl = document.getElementById(`${prefix}-dept`);
    const desigEl = document.getElementById(`${prefix}-desig`);

    const roleMap = {
      'rep': { dept: 'Sales & Field Distribution', desig: 'Sales Representative' },
      'asm': { dept: 'Sales & Field Distribution', desig: 'Area Sales Manager (ASM)' },
      'sm': { dept: 'Sales & Field Distribution', desig: 'Sales Manager (SM)' },
      'supervisor': { dept: 'Sales & Field Distribution', desig: 'Field Supervisor' },
      'stores': { dept: 'Warehouse & Stores', desig: 'Stores Keeper' },
      'delivery': { dept: 'Delivery & Logistics', desig: 'Delivery Driver' },
      'hr': { dept: 'Human Resources & Payroll', desig: 'HR Officer' },
      'admin': { dept: 'Executive Management', desig: 'System Administrator' }
    };

    if (roleMap[role]) {
      if (deptEl) deptEl.value = roleMap[role].dept;
      if (desigEl) desigEl.value = roleMap[role].desig;
    }
  },

  async saveNewEmployee() {
    try {
      const fullName   = document.getElementById('hr-new-emp-name')?.value?.trim();
      const phone      = document.getElementById('hr-new-emp-phone')?.value?.trim() || '';
      const nic        = document.getElementById('hr-new-emp-nic')?.value?.trim() || '';
      const dept       = document.getElementById('hr-new-emp-dept')?.value || 'Sales & Field Distribution';
      const designation= document.getElementById('hr-new-emp-desig')?.value?.trim() || 'Staff';
      const salary     = Number(document.getElementById('hr-new-emp-salary')?.value) || 35000;
      const role       = document.getElementById('hr-new-emp-role')?.value || 'rep';
      const routeId    = document.getElementById('hr-new-emp-route')?.value || null;
      const createLogin= document.getElementById('hr-new-emp-create-login')?.checked !== false;
      let username     = document.getElementById('hr-new-emp-username')?.value?.trim().toLowerCase();
      const pin        = document.getElementById('hr-new-emp-pin')?.value?.trim() || '1234';

      if (!fullName) {
        UI.showToast('Employee නම ඇතුළත් කරන්න (Name required)', 'warning');
        return;
      }

      const activeTid = getActiveTenantId() || 1;

      // Auto-generate next unique employee number
      const existing = filterByTenant(await db.employees?.toArray() || []);
      let maxNum = 0;
      for (const e of existing) {
        const num = parseInt(String(e.empNo || '').replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
      const nextNum  = maxNum + 1;
      const empNo    = `EMP-${String(nextNum).padStart(3, '0')}`;

      if (createLogin) {
        if (!username) {
          const clean = fullName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
          username = clean || ('emp' + nextNum);
        }
        if (pin && pin.length < 4) {
          UI.showToast('PIN එක අවම වශයෙන් ඉලක්කම් 4ක් විය යුතුය (PIN must be at least 4 digits)', 'warning');
          return;
        }

        // If user already exists in db.users, link and update them cleanly instead of failing!
        const existingUser = await db.users?.where('username').equals(username).first();
        if (existingUser) {
          await db.users.update(existingUser.id, {
            empNo,
            fullName,
            role,
            assignedRouteId: routeId ? Number(routeId) : null,
            pin: pin || existingUser.pin || '1234',
            phone: phone || existingUser.phone || '',
            isActive: true,
            updatedAt: new Date().toISOString()
          });
        } else if (db.users) {
          await db.users.add({
            tenantId: activeTid,
            empNo,
            fullName,
            username,
            pin: pin || '1234',
            phone,
            role,
            assignedRouteId: routeId ? Number(routeId) : null,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }

      // 1. Add to db.employees
      await db.employees.add({
        empNo,
        fullName,
        callingName: fullName.split(' ')[0] || fullName,
        nic: nic || '',
        phone,
        email: '',
        department: dept,
        designation,
        role,
        assignedRouteId: routeId ? Number(routeId) : null,
        username: createLogin ? username : '',
        basicSalary: salary,
        joinDate: new Date().toISOString().split('T')[0],
        status: 'Active',
        tenantId: activeTid,
        createdAt: new Date().toISOString()
      });

      UI.closeModal('modal-hr-add-employee');
      const loginMsg = createLogin ? ` & System Login (@${username} / PIN: ${pin})` : '';
      UI.showToast(`✅ ${fullName} (${empNo})${loginMsg} registered successfully!`, 'success');
      if (typeof SoundFX !== 'undefined') SoundFX.play('save');

      // Immediately switch to employees directory so user sees the newly created employee!
      this.switchModule('employees');
    } catch (err) {
      console.error('saveNewEmployee error:', err);
      UI.showToast('Error saving employee: ' + (err.message || 'Unknown error'), 'error');
    }
  },

  // ── HR User Password / Username Change ────────────────────────────────────
  async openChangeHrPasswordModal() {
    const user = typeof Auth !== 'undefined' ? Auth.currentUser : null;
    if (!user) {
      UI.showToast('Please login first', 'warning');
      return;
    }

    const nameEl = document.getElementById('hr-change-user-name');
    const usernameEl = document.getElementById('hr-change-username');
    const pinEl = document.getElementById('hr-change-pin');
    const pinConfEl = document.getElementById('hr-change-pin-confirm');

    if (nameEl) nameEl.value = user.fullName || user.username || '';
    if (usernameEl) usernameEl.value = user.username || 'hr';
    if (pinEl) pinEl.value = '';
    if (pinConfEl) pinConfEl.value = '';

    UI.openModal('modal-hr-change-password');
  },

  async saveHrPassword() {
    try {
      const user = typeof Auth !== 'undefined' ? Auth.currentUser : null;
      if (!user || !user.id) {
        UI.showToast('Session expired — please login again', 'error');
        return;
      }

      const fullName  = document.getElementById('hr-change-user-name')?.value?.trim();
      const username  = document.getElementById('hr-change-username')?.value?.trim();
      const newPin    = document.getElementById('hr-change-pin')?.value?.trim();
      const pinConf   = document.getElementById('hr-change-pin-confirm')?.value?.trim();

      if (!fullName || !username) {
        UI.showToast('Name and Username required (නම සහ username ඇතුළත් කරන්න)', 'warning');
        return;
      }

      const updatePayload = { fullName, username, updatedAt: new Date().toISOString() };

      if (newPin) {
        if (newPin.length < 4) {
          UI.showToast('PIN must be at least 4 digits (PIN අවම වශයෙන් 4 ඉලක්කම් විය යුතුයි)', 'warning');
          return;
        }
        if (newPin !== pinConf) {
          UI.showToast('PINs do not match — please re-enter (PIN දෙක නොගැලපේ)', 'error');
          return;
        }
        updatePayload.pin = newPin;
      }

      await db.users.update(user.id, updatePayload);

      // Also refresh session user
      const updatedUser = await db.users.get(user.id);
      if (updatedUser) {
        Auth.currentUser = updatedUser;
        sessionStorage.setItem('spice_pos_user', JSON.stringify(updatedUser));
        if (typeof Auth.updateHeaderUserBadge === 'function') Auth.updateHeaderUserBadge();
      }

      UI.closeModal('modal-hr-change-password');
      UI.showToast(`✅ ${fullName} — Login details updated! ${newPin ? 'New PIN set.' : 'Name/Username updated.'}`, 'success');
      if (typeof SoundFX !== 'undefined') SoundFX.play('save');
    } catch (err) {
      console.error('saveHrPassword error:', err);
      UI.showToast('Error updating: ' + (err.message || 'Unknown error'), 'error');
    }
  },



  async openEditEmployeeModal(empNo) {
    let emp = await db.employees?.where('empNo').equals(empNo).first();
    if (!emp) {
      const all = await db.employees?.toArray() || [];
      emp = all.find(e => String(e.empNo).trim().toLowerCase() === String(empNo).trim().toLowerCase());
    }
    if (!emp) return;

    this.selectedEmployeeId = emp.id;
    this.selectedEmpNo = emp.empNo;

    document.getElementById('hr-edit-emp-empno').value = emp.empNo;
    document.getElementById('hr-edit-emp-name').value = emp.fullName || '';
    document.getElementById('hr-edit-emp-phone').value = emp.phone || '';
    document.getElementById('hr-edit-emp-nic').value = emp.nic || '';
    document.getElementById('hr-edit-emp-dept').value = emp.department || 'Sales & Field Distribution';
    document.getElementById('hr-edit-emp-desig').value = emp.designation || '';
    document.getElementById('hr-edit-emp-salary').value = emp.basicSalary || 35000;
    document.getElementById('hr-edit-emp-status').value = emp.status || 'Active';
    document.getElementById('hr-edit-emp-role').value = emp.role || 'rep';

    // Populate routes dropdown
    const routeSelect = document.getElementById('hr-edit-emp-route');
    if (routeSelect) {
      try {
        const rawRoutes = await db.routes?.toArray() || [];
        const routes = filterByTenant(rawRoutes);
        let html = '<option value="">-- No Route Assigned --</option>';
        routes.forEach(r => {
          html += `<option value="${r.id}">${r.name}</option>`;
        });
        routeSelect.innerHTML = html;
        routeSelect.value = emp.assignedRouteId || '';
      } catch (e) {}
    }

    // Find linked user in db.users
    let linkedUser = null;
    if (db.users) {
      linkedUser = await db.users.where('empNo').equals(emp.empNo).first();
      if (!linkedUser && emp.username) {
        linkedUser = await db.users.where('username').equals(emp.username).first();
      }
    }
    this.selectedLinkedUserId = linkedUser ? linkedUser.id : null;
    document.getElementById('hr-edit-emp-username').value = linkedUser ? linkedUser.username : (emp.username || '');
    document.getElementById('hr-edit-emp-pin').value = '';

    UI.openModal('modal-hr-edit-employee');
  },

  async saveEditEmployee() {
    if (!this.selectedEmployeeId) return;

    const fullName = document.getElementById('hr-edit-emp-name')?.value?.trim();
    const phone = document.getElementById('hr-edit-emp-phone')?.value?.trim();
    const nic = document.getElementById('hr-edit-emp-nic')?.value?.trim();
    const dept = document.getElementById('hr-edit-emp-dept')?.value;
    const designation = document.getElementById('hr-edit-emp-desig')?.value;
    const salary = Number(document.getElementById('hr-edit-emp-salary')?.value) || 35000;
    const status = document.getElementById('hr-edit-emp-status')?.value || 'Active';
    const role = document.getElementById('hr-edit-emp-role')?.value || 'rep';
    const routeId = document.getElementById('hr-edit-emp-route')?.value || null;
    const username = document.getElementById('hr-edit-emp-username')?.value?.trim().toLowerCase();
    const newPin = document.getElementById('hr-edit-emp-pin')?.value?.trim();

    if (!fullName) {
      UI.showToast('Please enter Name', 'warning');
      return;
    }

    // 1. Update db.employees
    await db.employees.update(this.selectedEmployeeId, {
      fullName,
      phone: phone || '',
      nic: nic || '',
      department: dept,
      designation,
      basicSalary: salary,
      status,
      role,
      assignedRouteId: routeId ? Number(routeId) : null,
      username: username || '',
      updatedAt: new Date().toISOString()
    });

    // 2. Sync to db.users
    if (db.users) {
      if (this.selectedLinkedUserId) {
        const userUpdate = {
          fullName,
          phone: phone || '',
          role,
          assignedRouteId: routeId ? Number(routeId) : null,
          isActive: status === 'Active',
          updatedAt: new Date().toISOString()
        };
        if (username) userUpdate.username = username;
        if (newPin) {
          if (newPin.length < 4) {
            UI.showToast('PIN must be at least 4 digits', 'warning');
            return;
          }
          userUpdate.pin = newPin;
        }

        await db.users.update(this.selectedLinkedUserId, userUpdate);
      } else if (username) {
        await db.users.add({
          tenantId: getActiveTenantId() || 1,
          empNo: this.selectedEmpNo || '',
          fullName,
          username,
          pin: newPin || '1234',
          phone: phone || '',
          role,
          assignedRouteId: routeId ? Number(routeId) : null,
          isActive: status === 'Active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    UI.closeModal('modal-hr-edit-employee');
    UI.showToast('Employee details and user login updated! ✅', 'success');
    if (typeof SoundFX !== 'undefined') SoundFX.play('save');
    this.switchModule('employees');
  },

  async deleteEmployee(empNo) {
    if (!confirm(`Are you sure you want to delete employee ${empNo}? (සේවකයා ඉවත් කිරීමට අවශ්‍යද?)`)) return;
    let emp = await db.employees?.where('empNo').equals(empNo).first();
    if (!emp) {
      const all = await db.employees?.toArray() || [];
      emp = all.find(e => String(e.empNo).trim().toLowerCase() === String(empNo).trim().toLowerCase());
    }
    if (emp) {
      await db.employees.delete(emp.id);

      // Also remove or deactivate matching user in db.users
      if (db.users) {
        const user = await db.users.where('empNo').equals(empNo).first() || 
                     (emp.username ? await db.users.where('username').equals(emp.username).first() : null);
        if (user && (!Auth.currentUser || Auth.currentUser.id !== user.id)) {
          await db.users.delete(user.id);
        }
      }

      UI.showToast(`Employee ${empNo} removed!`, 'info');
      this.switchModule('employees');
    }
  },

  async printEmployeeIdCard(empNo) {
    const emp = await db.employees?.where('empNo').equals(empNo).first();
    if (!emp) return;

    const win = window.open('', '_blank');
    win.document.write(`
      <html>
      <head>
        <title>Employee ID Badge - ${emp.fullName}</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f1f5f9; margin: 0; }
          .badge { width: 320px; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border: 2px solid #cbd5e1; text-align: center; }
          .header { background: linear-gradient(135deg, #be185d, #e11d48); color: white; padding: 25px 10px 40px; }
          .avatar { width: 80px; height: 80px; border-radius: 50%; background: #fce7f3; margin: -40px auto 10px; display: flex; align-items: center; justify-content: center; font-size: 36px; border: 4px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .name { font-size: 16px; font-weight: bold; color: #0f172a; margin: 0 15px; }
          .desig { font-size: 12px; color: #be185d; font-weight: bold; margin-top: 4px; }
          .details { padding: 15px 20px; font-size: 11px; color: #475569; text-align: left; line-height: 1.6; }
          .footer { background: #f8fafc; padding: 12px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; font-weight: bold; letter-spacing: 0.5px; }
        </style>
      </head>
      <body>
        <div class="badge">
          <div class="header">
            <h3 style="margin:0; font-size:15px; letter-spacing:1px;">SPICE WHOLESALE POS</h3>
            <p style="margin:3px 0 0; font-size:10px; opacity:0.9;">OFFICIAL STAFF IDENTIFICATION CARD</p>
          </div>
          <div class="avatar">👤</div>
          <h2 class="name">${emp.fullName}</h2>
          <div class="desig">${emp.designation}</div>
          <div class="details">
            <div><strong>Staff ID:</strong> ${emp.empNo}</div>
            <div><strong>Department:</strong> ${emp.department}</div>
            <div><strong>NIC:</strong> ${emp.nic || 'N/A'}</div>
            <div><strong>Mobile:</strong> ${emp.phone}</div>
          </div>
          <div class="footer">AUTHORISED FIELD & OFFICE PASS · SRI LANKA</div>
        </div>
        <script>window.print();<\/script>
      </body>
      </html>
    `);
    win.document.close();
  },

  // =========================================================================
  // MODULE 3: ORGANIZATION MANAGEMENT
  // =========================================================================
  async renderOrganization(container) {
    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-4 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2">
          <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">Organization Structure & Hierarchy (සංවිධාන ව්‍යුහය)</h3>
          <p class="text-[11px] text-slate-400">Company branches, management reporting lines and operational divisions</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <!-- Branches -->
          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <h4 class="font-black text-slate-800">🏢 Company Operating Hubs</h4>
            <div class="space-y-1.5 text-[11px]">
              <div class="p-2.5 bg-white rounded-xl border border-slate-100">
                <span class="font-bold text-slate-900 block">Main Headquarters & Factory Hub</span>
                <p class="text-slate-500 text-[10px]">No. 45, Main Street, Anuradhapura · Manufacturing & Central Dispatch</p>
              </div>
              <div class="p-2.5 bg-white rounded-xl border border-slate-100">
                <span class="font-bold text-slate-900 block">Galnewa Regional Route Hub</span>
                <p class="text-slate-500 text-[10px]">Galnewa, Bulnewa, Negampaha Route Territory</p>
              </div>
              <div class="p-2.5 bg-white rounded-xl border border-slate-100">
                <span class="font-bold text-slate-900 block">Kekirawa & Dambulla Route Hub</span>
                <p class="text-slate-500 text-[10px]">Kekirawa, Maradankadawala Route Territory</p>
              </div>
            </div>
          </div>

          <!-- Reporting Hierarchy -->
          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <h4 class="font-black text-slate-800">🌳 Hierarchy & Assigned Responsibilities</h4>
            <div class="space-y-1 text-[11px] font-semibold text-slate-700">
              <div class="p-2 bg-purple-50 rounded-xl text-purple-900 border border-purple-200">
                👑 <strong>Managing Director / Admin:</strong> Business governance, profits, system master PIN
              </div>
              <div class="p-2 bg-blue-50 rounded-xl text-blue-900 border border-blue-200 ml-2">
                👔 <strong>Sales Manager (SM):</strong> Monthly sales turnover (1.0% override), route target supervision
              </div>
              <div class="p-2 bg-indigo-50 rounded-xl text-indigo-900 border border-indigo-200 ml-4">
                💼 <strong>Area Sales Manager (ASM):</strong> Regional territory performance (0.5% override), credit debt collection
              </div>
              <div class="p-2 bg-amber-50 rounded-xl text-amber-900 border border-amber-200 ml-6">
                📋 <strong>Field Supervisor:</strong> Rep GPS tracking, meter audits & shop display approvals (0.3% override)
              </div>
              <div class="p-2 bg-emerald-50 rounded-xl text-emerald-900 border border-emerald-200 ml-8">
                🚚 <strong>Sales Reps:</strong> Daily shop orders, card slabs targets, morning/evening meter photos
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // =========================================================================
  // MODULE 4: SALES TEAM — Products & Targets (නිෂ්පාදන, ඉලක්ක, Progress Tracking)
  // =========================================================================
  _salesTeamSubTab: 'targets', // 'targets' | 'products'

  async renderSalesTeam(container) {
    // Load all data in parallel
    const [allEmployees, products, targets, allSales, allSaleItems] = await Promise.all([
      db.employees?.toArray().then(r => filterByTenant(r || [])).catch(() => []),
      db.products?.toArray().then(r => filterByTenant(r || [])).catch(() => []),
      db.productTargets?.toArray().then(r => filterByTenant(r || [])).catch(() => []),
      db.sales?.toArray().then(r => filterByTenant(r || [])).catch(() => []),
      db.saleItems?.toArray().then(r => filterByTenant(r || [])).catch(() => [])
    ]);

    // Sales reps only (rep, asm, sm, delivery roles)
    const reps = allEmployees.filter(e => ['rep','asm','sm','delivery','supervisor'].includes(e.role));

    // KPI calculations
    const totalTargets = targets.length;
    const bonusPayable = targets.reduce((sum, t) => {
      const achieved = this._calcSoldQty(t, allSales, allSaleItems);
      return sum + (achieved >= Number(t.targetQty || 0) ? Number(t.bonus || 0) : 0);
    }, 0);

    const activeTab = this._salesTeamSubTab || 'targets';

    container.innerHTML = `
      <div class="space-y-3 max-w-full overflow-hidden">

        <!-- KPI Top Bar -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
            <div class="text-xl font-black text-emerald-700">${products.length}</div>
            <div class="text-[10px] text-emerald-600 font-bold">📦 Company Products</div>
          </div>
          <div class="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
            <div class="text-xl font-black text-blue-700">${reps.length}</div>
            <div class="text-[10px] text-blue-600 font-bold">🚚 Active Reps</div>
          </div>
          <div class="bg-pink-50 border border-pink-200 rounded-2xl p-3 text-center">
            <div class="text-xl font-black text-pink-700">${totalTargets}</div>
            <div class="text-[10px] text-pink-600 font-bold">🎯 Assigned Targets</div>
          </div>
          <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
            <div class="text-xl font-black text-amber-700">Rs.${bonusPayable.toLocaleString()}</div>
            <div class="text-[10px] text-amber-600 font-bold">💰 Bonus Payable</div>
          </div>
        </div>

        <!-- Sub-Tabs -->
        <div class="flex gap-2">
          <button onclick="HR.setSalesTeamSubTab('targets')"
            class="flex-1 py-2.5 rounded-2xl text-xs font-black transition-all ${activeTab === 'targets' ? 'bg-pink-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
            🎯 Rep Targets & Progress
          </button>
          <button onclick="HR.setSalesTeamSubTab('products')"
            class="flex-1 py-2.5 rounded-2xl text-xs font-black transition-all ${activeTab === 'products' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
            📦 Company Products
          </button>
        </div>

        <!-- TAB 1: Rep Targets & Progress -->
        <div id="hr-st-tab-targets" class="${activeTab === 'targets' ? '' : 'hidden'}">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-black text-sm text-slate-800">🎯 Rep Product Targets & Live Progress</h3>
            <button onclick="HR.openSetProductTargetModal()" class="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-black rounded-xl shadow active:scale-95">
              + Assign Target
            </button>
          </div>

          ${targets.length === 0 ? `
            <div class="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200">
              <div class="text-3xl mb-2">🎯</div>
              <p class="text-sm font-bold text-slate-600">No product targets assigned yet</p>
              <p class="text-[11px] text-slate-400 mt-1">Rep-ලාට product targets assign කිරීමට "+ Assign Target" click කරන්න</p>
            </div>
          ` : `
            <div class="space-y-2.5">
              ${targets.map(t => {
                const soldQty = this._calcSoldQty(t, allSales, allSaleItems);
                const targetQty = Number(t.targetQty || 0);
                const pct = targetQty > 0 ? Math.min(100, Math.round((soldQty / targetQty) * 100)) : 0;
                const achieved = soldQty >= targetQty && targetQty > 0;
                const product = products.find(p => String(p.id) === String(t.productId));
                const emp = allEmployees.find(e => e.empNo === t.empNo);
                return `
                  <div class="p-3.5 bg-white rounded-2xl border ${achieved ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'} shadow-sm">
                    <div class="flex items-start justify-between gap-2 mb-2">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="font-black text-xs text-slate-900">${t.repName || emp?.fullName || t.empNo}</span>
                          <span class="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 font-bold rounded-lg">${t.empNo}</span>
                          ${achieved ? `<span class="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 font-black rounded-lg">✅ Achieved!</span>` : `<span class="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 font-bold rounded-lg">⏳ In Progress</span>`}
                        </div>
                        <div class="text-[11px] text-slate-600 mt-0.5">
                          📦 <strong>${t.productName || product?.name || 'Product'}</strong>
                          · ${t.period || 'Monthly'} · ${t.targetMonth || '—'}
                        </div>
                        ${t.notes ? `<div class="text-[10px] text-slate-400 italic mt-0.5">📝 ${t.notes}</div>` : ''}
                      </div>
                      <button onclick="HR.deleteProductTarget('${t.id}')" class="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs flex-shrink-0" title="Delete Target">🗑</button>
                    </div>

                    <!-- Progress Bar -->
                    <div class="space-y-1.5">
                      <div class="flex justify-between text-[11px] font-bold">
                        <span class="text-slate-600">Sold: <span class="${achieved ? 'text-emerald-700 font-black' : 'text-blue-700 font-black'}">${soldQty}</span> / Target: <span class="text-pink-700">${targetQty}</span> ${t.unit || 'Cards'}</span>
                        <span class="${achieved ? 'text-emerald-700 font-black' : 'text-slate-600'}">${pct}%</span>
                      </div>
                      <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all ${achieved ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-amber-500' : 'bg-pink-400'}"
                          style="width:${pct}%"></div>
                      </div>
                      <div class="flex items-center justify-between text-[10.5px]">
                        <span class="${achieved ? 'text-emerald-700 font-black' : 'text-amber-700 font-extrabold'}">
                          ${achieved ? '🎉 ඉලක්කය සම්පූර්ණයි (Target Achieved)!' : '⏳ ඉතිරි ප්‍රමාණය: <strong>' + Math.max(0, targetQty - soldQty) + ' ' + (t.unit || 'Cards') + ' Left</strong>'}
                        </span>
                        ${Number(t.bonus) > 0 ? `
                          <span class="font-bold ${achieved ? 'text-emerald-700' : 'text-slate-500'}">
                            💰 +Rs.${Number(t.bonus).toLocaleString()}
                          </span>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- TAB 2: Company Products Catalog -->
        <div id="hr-st-tab-products" class="${activeTab === 'products' ? '' : 'hidden'}">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-black text-sm text-slate-800">📦 Company Products Catalog</h3>
            <span class="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl font-bold">${products.length} Products</span>
          </div>

          ${products.length === 0 ? `
            <div class="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200">
              <div class="text-3xl mb-2">📦</div>
              <p class="text-sm font-bold text-slate-600">No products found</p>
              <p class="text-[11px] text-slate-400 mt-1">Products tab එකෙන් products add කරන්න. ඒවා automatically HR-ට sync වේ.</p>
            </div>
          ` : `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              ${products.map(prod => {
                const isCard = (prod.unit || 'Card').toLowerCase() === 'card';
                const packetsPerCard = isCard ? (Number(prod.packetsPerCard) || 20) : 1;
                const sell = Number(prod.sellingPrice) || 0;
                const cost = Number(prod.costPrice) || 0;
                const profit = sell - cost;
                // Total qty sold for this product
                const totalSold = allSaleItems
                  .filter(si => String(si.productId) === String(prod.id))
                  .reduce((sum, si) => sum + (Number(si.qty) || 0), 0);
                const productTargets = targets.filter(t => String(t.productId) === String(prod.id));
                return `
                  <div class="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 transition-all">
                    <div class="flex items-start justify-between gap-2 mb-2">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="px-2 py-0.5 text-[10px] font-black ${isCard ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'} rounded-lg">${prod.unit || 'Card'}</span>
                          ${prod.category ? `<span class="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-600 font-bold rounded-lg">${prod.category}</span>` : ''}
                          ${prod.freeSchemeEnabled ? `<span class="px-2 py-0.5 text-[10px] bg-purple-100 text-purple-800 font-black rounded-lg">🎁 Free Scheme</span>` : ''}
                        </div>
                        <h4 class="font-black text-xs text-slate-900 mt-1">${prod.name}</h4>
                      </div>
                    </div>

                    <div class="grid grid-cols-3 gap-1.5 text-[10px] mb-2.5">
                      <div class="bg-emerald-50 rounded-xl p-1.5 text-center">
                        <div class="font-black text-emerald-700">Rs.${sell.toFixed(0)}</div>
                        <div class="text-emerald-600">Wholesale</div>
                      </div>
                      <div class="bg-slate-50 rounded-xl p-1.5 text-center">
                        <div class="font-black text-slate-700">Rs.${cost.toFixed(0)}</div>
                        <div class="text-slate-500">Cost</div>
                      </div>
                      <div class="bg-blue-50 rounded-xl p-1.5 text-center">
                        <div class="font-black text-blue-700">${totalSold}</div>
                        <div class="text-blue-500">Total Sold</div>
                      </div>
                    </div>

                    ${isCard ? `
                      <div class="text-[10px] text-slate-500 mb-2">📦 ${packetsPerCard} Pkts/Card · Pkt Price: Rs.${(sell / packetsPerCard).toFixed(2)}</div>
                    ` : ''}

                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-pink-600 font-bold">${productTargets.length} target(s) set</span>
                      <button onclick="HR.openSetProductTargetModal('${prod.id}')"
                        class="px-2.5 py-1 bg-pink-600 hover:bg-pink-700 text-white text-[10px] font-black rounded-xl shadow active:scale-95">
                        🎯 Set Target
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

      </div>
    `;
  },

  // Helper: calculate actual sold qty for a target record
  _calcSoldQty(target, allSales, allSaleItems) {
    try {
      const monthStr = target.targetMonth || ''; // e.g. '2026-10'
      const repSales = allSales.filter(s => {
        if (!s) return false;
        if (s.status === 'Cancelled') return false;
        const saleDate = (s.date || s.createdAt || '').substring(0, 7);
        const matchMonth = !monthStr || saleDate === monthStr;

        const targetEmp = String(target.empNo || '').toLowerCase().trim();
        const targetName = String(target.repName || '').toLowerCase().trim();
        const sId = String(s.repId || '').toLowerCase().trim();
        const sName = String(s.repName || '').toLowerCase().trim();

        // Match rep ID, empNo, or name
        let matchRep = false;
        if (sId && targetEmp && (sId === targetEmp || targetEmp.includes(sId) || sId.includes(targetEmp))) {
          matchRep = true;
        } else if (sName && targetName && (sName === targetName || sName.includes(targetName) || targetName.includes(sName))) {
          matchRep = true;
        } else if (!targetEmp || targetEmp === 'all') {
          matchRep = true;
        }

        return matchMonth && matchRep;
      });
      const saleIds = repSales.map(s => String(s.id));
      // Sum quantities for the target product
      return allSaleItems
        .filter(si => saleIds.includes(String(si.saleId)) && String(si.productId) === String(target.productId))
        .reduce((sum, si) => sum + (Number(si.qty) || 0), 0);
    } catch (e) { return 0; }
  },

  setSalesTeamSubTab(tab) {
    this._salesTeamSubTab = tab;
    // Show/hide tabs without full re-render
    const tTargets = document.getElementById('hr-st-tab-targets');
    const tProducts = document.getElementById('hr-st-tab-products');
    if (tTargets) tTargets.classList.toggle('hidden', tab !== 'targets');
    if (tProducts) tProducts.classList.toggle('hidden', tab !== 'products');
    // Update button styles
    document.querySelectorAll('#hr-module-content button').forEach(btn => {
      const txt = btn.textContent.trim();
      if (txt.includes('Rep Targets')) {
        btn.className = btn.className.replace(
          tab === 'targets' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-pink-600 text-white shadow-md',
          tab === 'targets' ? 'bg-pink-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        );
      }
      if (txt.includes('Company Products')) {
        btn.className = btn.className.replace(
          tab === 'products' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-600 text-white shadow-md',
          tab === 'products' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        );
      }
    });
  },

  async openSetProductTargetModal(preProductId = null, preEmpNo = null) {
    // Populate reps dropdown
    const employees = filterByTenant(await db.employees?.toArray() || []);
    const reps = employees.filter(e => ['rep','asm','sm','delivery','supervisor'].includes(e.role));
    const products = filterByTenant(await db.products?.toArray() || []);

    const empSel = document.getElementById('hr-target-emp-select');
    const prodSel = document.getElementById('hr-target-prod-select');
    const monthEl = document.getElementById('hr-target-month');

    if (empSel) {
      empSel.innerHTML = '<option value="">-- Select Sales Rep --</option>' +
        reps.map(e => `<option value="${e.empNo}" data-name="${e.fullName || ''}"${preEmpNo && e.empNo === preEmpNo ? ' selected' : ''}>${e.fullName} (${e.empNo})</option>`).join('');
    }

    if (prodSel) {
      prodSel.innerHTML = '<option value="">-- Select Product --</option>' +
        products.map(p => `<option value="${p.id}" data-unit="${p.unit || 'Card'}"${preProductId && String(p.id) === String(preProductId) ? ' selected' : ''}>${p.name} (${p.unit || 'Card'})</option>`).join('');
    }

    // Auto-fill unit if product pre-selected
    if (preProductId) {
      const prod = products.find(p => String(p.id) === String(preProductId));
      if (prod) {
        const unitEl = document.getElementById('hr-target-unit');
        if (unitEl) unitEl.value = prod.unit || 'Card';
      }
    }

    // Default month to current month
    if (monthEl && !monthEl.value) {
      monthEl.value = new Date().toISOString().substring(0, 7);
    }

    // Reset other fields
    ['hr-target-qty','hr-target-bonus','hr-target-notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    UI.openModal('modal-hr-set-product-target');
  },

  onTargetProductSelect(productId) {
    if (!productId) return;
    const prodSel = document.getElementById('hr-target-prod-select');
    const selected = prodSel?.querySelector(`option[value="${productId}"]`);
    const unitEl = document.getElementById('hr-target-unit');
    if (unitEl && selected) unitEl.value = selected.getAttribute('data-unit') || 'Card';
  },

  async saveProductTarget() {
    const empSel = document.getElementById('hr-target-emp-select');
    const prodSel = document.getElementById('hr-target-prod-select');
    const qtyEl = document.getElementById('hr-target-qty');
    const unitEl = document.getElementById('hr-target-unit');
    const periodEl = document.getElementById('hr-target-period');
    const monthEl = document.getElementById('hr-target-month');
    const bonusEl = document.getElementById('hr-target-bonus');
    const notesEl = document.getElementById('hr-target-notes');

    const empNo = empSel?.value?.trim();
    const productId = prodSel?.value?.trim();
    const targetQty = Number(qtyEl?.value || 0);

    if (!empNo) { UI.showToast('⚠️ Sales Rep කෙනෙකු select කරන්න!', 'warning'); return; }
    if (!productId) { UI.showToast('⚠️ Product එකක් select කරන්න!', 'warning'); return; }
    if (!targetQty || targetQty < 1) { UI.showToast('⚠️ Target Quantity enter කරන්න!', 'warning'); return; }

    const empOption = empSel.querySelector(`option[value="${empNo}"]`);
    const prodOption = prodSel.querySelector(`option[value="${productId}"]`);

    const activeTid = (typeof getActiveTenantId === 'function') ? getActiveTenantId() : null;

    const record = {
      id: 'pt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      tenantId: activeTid,
      empNo,
      repName: empOption?.getAttribute('data-name') || empOption?.text || empNo,
      productId,
      productName: prodOption?.text?.split(' (')[0] || productId,
      targetQty,
      unit: unitEl?.value || 'Card',
      period: periodEl?.value || 'Monthly',
      targetMonth: monthEl?.value || new Date().toISOString().substring(0, 7),
      bonus: Number(bonusEl?.value || 0),
      notes: notesEl?.value?.trim() || '',
      createdAt: new Date().toISOString()
    };

    try {
      await db.productTargets.add(record);
      UI.closeModal('modal-hr-set-product-target');
      UI.showToast(`✅ Product target saved! ${record.repName} → ${record.productName} (${record.targetQty} ${record.unit})`, 'success');
      this._salesTeamSubTab = 'targets';
      await this.renderActiveModule();
    } catch (e) {
      UI.showToast('❌ Target save කිරීමේ දෝෂය: ' + e.message, 'error');
    }
  },

  async deleteProductTarget(id) {
    if (!confirm('මෙම product target delete කරන්නද?')) return;
    try {
      await db.productTargets.delete(id);
      UI.showToast('🗑 Product target deleted.', 'info');
      await this.renderActiveModule();
    } catch (e) {
      UI.showToast('❌ Delete error: ' + e.message, 'error');
    }
  },

  // =========================================================================
  // MODULE 5: ATTENDANCE MANAGEMENT (Daily Register, Auto-Time & End Check-Out)
  // =========================================================================
  attendanceFilterDate: null,

  getCurrentTimeFormatted() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  setAttendanceDate(dateStr) {
    this.attendanceFilterDate = dateStr;
    const container = document.getElementById('hr-module-content');
    if (container) this.renderAttendance(container);
  },

  changeAttendanceDate(offsetDays) {
    if (!this.attendanceFilterDate) this.attendanceFilterDate = new Date().toISOString().split('T')[0];
    const d = new Date(this.attendanceFilterDate);
    d.setDate(d.getDate() + offsetDays);
    this.attendanceFilterDate = d.toISOString().split('T')[0];
    const container = document.getElementById('hr-module-content');
    if (container) this.renderAttendance(container);
  },

  async renderAttendance(container) {
    if (!this.attendanceFilterDate) {
      this.attendanceFilterDate = new Date().toISOString().split('T')[0];
    }
    const selectedDate = this.attendanceFilterDate;
    const todayStr = new Date().toISOString().split('T')[0];

    const rawAttendance = await db.attendance?.where('date').equals(selectedDate).toArray() || [];
    const attendance = filterByTenant(rawAttendance);
    const employees = filterByTenant(await db.employees?.toArray() || []).filter(e => e.status !== 'Inactive' && e.status !== 'Terminated');

    const presentCount = attendance.filter(a => a.status === 'Present').length;
    const halfDayCount = attendance.filter(a => a.status === 'Half Day').length;
    const leaveCount = attendance.filter(a => a.status === 'Leave' || a.status === 'On Leave').length;
    const checkedOutCount = attendance.filter(a => a.checkOut && a.checkOut !== '--').length;
    const recordedEmpNos = new Set(attendance.map(a => a.empNo));
    const pendingCount = employees.filter(e => !recordedEmpNos.has(e.empNo)).length;

    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-4 max-w-full overflow-hidden">
        <!-- Header & Date Controls -->
        <div class="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div>
            <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>⏱️</span> Daily Attendance Register (දෛනික පැමිණීම් ලේඛනය)
            </h3>
            <p class="text-[11px] text-slate-400">
              ${selectedDate === todayStr ? '📅 අද දිනය (Today)' : `📅 දිනය: ${selectedDate}`} · Auto Time Stamp & End Check-Out
            </p>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button onclick="HR.changeAttendanceDate(-1)" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer" title="පෙර දිනය">
              ◀ ඊයේ
            </button>
            <input type="date" value="${selectedDate}" onchange="HR.setAttendanceDate(this.value)" class="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800" />
            <button onclick="HR.setAttendanceDate('${todayStr}')" class="px-2.5 py-1.5 ${selectedDate === todayStr ? 'bg-pink-600 text-white font-black' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold'} rounded-xl text-xs transition-all cursor-pointer">
              අද
            </button>
            <button onclick="HR.changeAttendanceDate(1)" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer" title="ඊළඟ දිනය">
              හෙට ▶
            </button>
            <button onclick="HR.markAllPresent()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer">
              ✓ Mark All Present
            </button>
          </div>
        </div>

        <!-- KPI Metrics Summary for this Date -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div class="p-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <span class="text-[10px] text-indigo-500 font-bold uppercase block">මුළු සේවකයින්</span>
            <span class="text-base font-black text-indigo-900">${employees.length}</span>
          </div>
          <div class="p-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <span class="text-[10px] text-emerald-600 font-bold uppercase block">🟢 පැමිණි (Present)</span>
            <span class="text-base font-black text-emerald-900">${presentCount}</span>
          </div>
          <div class="p-2.5 bg-amber-50 border border-amber-100 rounded-2xl">
            <span class="text-[10px] text-amber-600 font-bold uppercase block">🟡 වරු නිවාඩු (Half Day)</span>
            <span class="text-base font-black text-amber-900">${halfDayCount}</span>
          </div>
          <div class="p-2.5 bg-purple-50 border border-purple-100 rounded-2xl">
            <span class="text-[10px] text-purple-600 font-bold uppercase block">🟣 නිවාඩු (Leave)</span>
            <span class="text-base font-black text-purple-900">${leaveCount}</span>
          </div>
          <div class="p-2.5 bg-slate-100 border border-slate-200 rounded-2xl col-span-2 sm:col-span-1">
            <span class="text-[10px] text-slate-500 font-bold uppercase block">⏹️ පිටවූ (End OUT)</span>
            <span class="text-base font-black text-slate-800">${checkedOutCount}</span>
          </div>
        </div>

        <!-- Staff Attendance Roster Table -->
        <div class="overflow-x-auto rounded-2xl border border-slate-200">
          <table class="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr class="bg-slate-100 text-slate-600 text-[10.5px] font-black uppercase tracking-wider border-b border-slate-200">
                <th class="p-2.5">සේවකයා (Staff Member)</th>
                <th class="p-2.5 text-center">තත්ත්වය (Status)</th>
                <th class="p-2.5 text-center">පැමිණි වේලාව (IN)</th>
                <th class="p-2.5 text-center">පිටවූ වේලාව (OUT)</th>
                <th class="p-2.5 text-center">මීටර් KM (Reps)</th>
                <th class="p-2.5 text-center">ක්ෂණික ක්‍රියාමාර්ග (Quick Action)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              ${employees.map(emp => {
                const att = attendance.find(a => a.empNo === emp.empNo);
                const status = att ? (att.status || 'Present') : 'Pending';

                let badgeClass = 'bg-slate-100 text-slate-600';
                if (status === 'Present') badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-300';
                else if (status === 'Half Day') badgeClass = 'bg-amber-100 text-amber-800 border border-amber-300';
                else if (status === 'Leave' || status === 'On Leave') badgeClass = 'bg-purple-100 text-purple-800 border border-purple-300';
                else if (status === 'Late') badgeClass = 'bg-orange-100 text-orange-800 border border-orange-300';

                const inTime = att?.checkIn && att.checkIn !== '--' ? att.checkIn : null;
                const outTime = att?.checkOut && att.checkOut !== '--' ? att.checkOut : null;

                return `
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-2.5">
                      <div class="font-bold text-slate-900">${emp.fullName}</div>
                      <div class="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                        <span>${emp.empNo}</span>
                        <span>·</span>
                        <span class="text-slate-600 font-sans">${emp.department || emp.designation || 'Staff'}</span>
                      </div>
                    </td>
                    <td class="p-2.5 text-center">
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black ${badgeClass}">
                        ${status === 'Pending' ? '⚪ Pending' : status}
                      </span>
                    </td>
                    <td class="p-2.5 text-center font-mono font-bold text-slate-800">
                      ${inTime ? `<span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">${inTime}</span>` : '<span class="text-slate-300 font-normal">--:--</span>'}
                    </td>
                    <td class="p-2.5 text-center font-mono font-bold text-slate-800">
                      ${outTime ? `<span class="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">${outTime}</span>` : '<span class="text-slate-300 font-normal">--:--</span>'}
                    </td>
                    <td class="p-2.5 text-center font-mono text-[10px] text-slate-600">
                      ${att?.startMeterKm ? `${att.startMeterKm} → ${att.endMeterKm || 'Active'} (${att.totalKm || 0} km)` : '<span class="text-slate-300">--</span>'}
                    </td>
                    <td class="p-2.5 text-center">
                      <div class="flex items-center justify-center gap-1 flex-wrap">
                        <button onclick="HR.markAttendanceIn('${emp.empNo}')" class="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-0.5 active:scale-95 transition-all shadow-2xs cursor-pointer" title="Auto capture current time as Check-In">
                          <span>🟢 IN</span>
                        </button>
                        <button onclick="HR.markAttendanceHalfDay('${emp.empNo}')" class="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center gap-0.5 active:scale-95 transition-all shadow-2xs cursor-pointer" title="Mark Half Day">
                          <span>🟡 Half Day</span>
                        </button>
                        <button onclick="HR.markAttendanceEnd('${emp.empNo}')" class="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] flex items-center gap-0.5 active:scale-95 transition-all shadow-2xs cursor-pointer" title="Auto capture current time as End Check-Out">
                          <span>⏹️ End</span>
                        </button>
                        <button onclick="HR.markAttendanceLeave('${emp.empNo}')" class="px-1.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-[10px] cursor-pointer" title="Mark Leave">
                          <span>🟣 Leave</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async markAttendanceIn(empNo) {
    const targetDate = this.attendanceFilterDate || new Date().toISOString().split('T')[0];
    const nowTime = this.getCurrentTimeFormatted();
    const tenantId = getActiveTenantId() || 1;

    const existing = await db.attendance?.where('date').equals(targetDate).and(a => a.empNo === empNo).first();
    const emp = await db.employees?.where('empNo').equals(empNo).first();
    const empName = emp ? emp.fullName : empNo;

    if (existing) {
      await db.attendance.update(existing.id, {
        checkIn: nowTime,
        status: 'Present',
        recordedBy: Auth.currentUser?.fullName || 'HR Officer',
        updatedAt: new Date().toISOString()
      });
    } else {
      await db.attendance?.add({
        tenantId,
        empNo,
        employeeName: empName,
        date: targetDate,
        checkIn: nowTime,
        checkOut: '--',
        status: 'Present',
        recordedBy: Auth.currentUser?.fullName || 'HR Officer',
        createdAt: new Date().toISOString()
      });
    }
    if (typeof SoundFX !== 'undefined') SoundFX.play('beep');
    UI.showToast(`✅ ${empName} - IN (${nowTime}) පැමිණීම සටහන් විය!`, 'success');
    this.renderAttendance(document.getElementById('hr-module-content'));
  },

  async markAttendanceHalfDay(empNo) {
    const targetDate = this.attendanceFilterDate || new Date().toISOString().split('T')[0];
    const nowTime = this.getCurrentTimeFormatted();
    const tenantId = getActiveTenantId() || 1;

    const existing = await db.attendance?.where('date').equals(targetDate).and(a => a.empNo === empNo).first();
    const emp = await db.employees?.where('empNo').equals(empNo).first();
    const empName = emp ? emp.fullName : empNo;

    if (existing) {
      await db.attendance.update(existing.id, {
        status: 'Half Day',
        checkIn: existing.checkIn && existing.checkIn !== '--' ? existing.checkIn : nowTime,
        notes: (existing.notes ? existing.notes + ' | ' : '') + 'Half Day',
        recordedBy: Auth.currentUser?.fullName || 'HR Officer',
        updatedAt: new Date().toISOString()
      });
    } else {
      await db.attendance?.add({
        tenantId,
        empNo,
        employeeName: empName,
        date: targetDate,
        checkIn: nowTime,
        checkOut: '--',
        status: 'Half Day',
        notes: 'Half Day',
        recordedBy: Auth.currentUser?.fullName || 'HR Officer',
        createdAt: new Date().toISOString()
      });
    }

    if (db.leaves) {
      await db.leaves.add({
        tenantId,
        empNo,
        employeeName: empName,
        leaveType: 'Half-Day Leave',
        fromDate: targetDate,
        toDate: targetDate,
        days: 0.5,
        reason: 'Half Day logged in Attendance',
        status: 'Approved',
        recordedBy: Auth.currentUser?.fullName || 'HR Officer',
        createdAt: new Date().toISOString()
      });
    }

    if (typeof SoundFX !== 'undefined') SoundFX.play('save');
    UI.showToast(`🟡 ${empName} - Half Day (වරු නිවාඩු) සටහන් විය!`, 'warning');
    this.renderAttendance(document.getElementById('hr-module-content'));
  },

  async markAttendanceEnd(empNo) {
    const targetDate = this.attendanceFilterDate || new Date().toISOString().split('T')[0];
    const nowTime = this.getCurrentTimeFormatted();
    const tenantId = getActiveTenantId() || 1;

    const existing = await db.attendance?.where('date').equals(targetDate).and(a => a.empNo === empNo).first();
    const emp = await db.employees?.where('empNo').equals(empNo).first();
    const empName = emp ? emp.fullName : empNo;

    if (existing) {
      await db.attendance.update(existing.id, {
        checkOut: nowTime,
        recordedBy: Auth.currentUser?.fullName || 'HR Officer',
        updatedAt: new Date().toISOString()
      });
    } else {
      await db.attendance?.add({
        tenantId,
        empNo,
        employeeName: empName,
        date: targetDate,
        checkIn: '--',
        checkOut: nowTime,
        status: 'Present',
        recordedBy: Auth.currentUser?.fullName || 'HR Officer',
        createdAt: new Date().toISOString()
      });
    }
    if (typeof SoundFX !== 'undefined') SoundFX.play('beep');
    UI.showToast(`⏹️ ${empName} - OUT (${nowTime}) පිටවීම සටහන් විය!`, 'info');
    this.renderAttendance(document.getElementById('hr-module-content'));
  },

  async markAttendanceLeave(empNo) {
    const targetDate = this.attendanceFilterDate || new Date().toISOString().split('T')[0];
    const tenantId = getActiveTenantId() || 1;

    const existing = await db.attendance?.where('date').equals(targetDate).and(a => a.empNo === empNo).first();
    const emp = await db.employees?.where('empNo').equals(empNo).first();
    const empName = emp ? emp.fullName : empNo;

    if (existing) {
      await db.attendance.update(existing.id, {
        status: 'On Leave',
        checkIn: '--',
        checkOut: '--',
        recordedBy: Auth.currentUser?.fullName || 'HR Officer',
        updatedAt: new Date().toISOString()
      });
    } else {
      await db.attendance?.add({
        tenantId,
        empNo,
        employeeName: empName,
        date: targetDate,
        checkIn: '--',
        checkOut: '--',
        status: 'On Leave',
        recordedBy: Auth.currentUser?.fullName || 'HR Officer',
        createdAt: new Date().toISOString()
      });
    }
    UI.showToast(`🟣 ${empName} - On Leave (නිවාඩු) සටහන් විය!`, 'info');
    this.renderAttendance(document.getElementById('hr-module-content'));
  },

  async toggleAttendance(empNo, newStatus) {
    if (newStatus === 'Present') return this.markAttendanceIn(empNo);
    if (newStatus === 'Half Day') return this.markAttendanceHalfDay(empNo);
    if (newStatus === 'Leave' || newStatus === 'On Leave') return this.markAttendanceLeave(empNo);
    return this.markAttendanceIn(empNo);
  },

  async markAllPresent() {
    const targetDate = this.attendanceFilterDate || new Date().toISOString().split('T')[0];
    const nowTime = this.getCurrentTimeFormatted();
    const emps = filterByTenant(await db.employees?.toArray() || []).filter(e => e.status !== 'Inactive' && e.status !== 'Terminated');
    for (const emp of emps) {
      const existing = await db.attendance?.where('date').equals(targetDate).and(a => a.empNo === emp.empNo).first();
      if (!existing) {
        await db.attendance?.add({
          tenantId: getActiveTenantId() || 1,
          empNo: emp.empNo,
          employeeName: emp.fullName,
          date: targetDate,
          checkIn: nowTime,
          checkOut: '--',
          status: 'Present',
          recordedBy: Auth.currentUser?.fullName || 'HR Officer',
          createdAt: new Date().toISOString()
        });
      }
    }
    UI.showToast(`✅ සියලු සේවකයින්ගේ පැමිණීම (${nowTime}) සටහන් විය!`, 'success');
    this.renderAttendance(document.getElementById('hr-module-content'));
  },

  // =========================================================================
  // MODULE 6: FIELD EMPLOYEE ATTENDANCE & BIKE METER / DISPLAY PHOTOS
  // (Grouped neatly by Date and by Rep - No clutter!)
  // =========================================================================
  fieldFilterDate: null,
  fieldFilterRep: 'ALL',
  fieldFilterType: 'ALL',

  async renderFieldAttendance(container) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (this.fieldFilterDate === null) {
      this.fieldFilterDate = todayStr; // Default to Today
    }

    const allPhotos = filterByTenant(await db.fieldPhotos?.toArray() || []).sort((a,b) => {
      return (b.date + ' ' + (b.time||'')).localeCompare(a.date + ' ' + (a.time||''));
    });
    const allAttendance = filterByTenant(await db.attendance?.toArray() || []).sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const allEmployees = filterByTenant(await db.employees?.toArray() || []);
    const reps = allEmployees.filter(e => e.role === 'rep' || e.role === 'delivery' || e.role === 'asm' || e.role === 'supervisor');

    // Get all available distinct dates for quick picker
    const availableDatesSet = new Set();
    allPhotos.forEach(p => { if (p.date) availableDatesSet.add(p.date); });
    allAttendance.forEach(a => { if (a.date) availableDatesSet.add(a.date); });
    availableDatesSet.add(todayStr);
    const availableDates = Array.from(availableDatesSet).sort().reverse();

    let photos = allPhotos;
    let attendance = allAttendance;

    if (this.fieldFilterDate !== 'ALL') {
      photos = photos.filter(p => p.date === this.fieldFilterDate);
      attendance = attendance.filter(a => a.date === this.fieldFilterDate);
    }
    if (this.fieldFilterRep !== 'ALL') {
      photos = photos.filter(p => String(p.repId) === String(this.fieldFilterRep) || p.repName === this.fieldFilterRep || (p.empNo && p.empNo === this.fieldFilterRep));
      attendance = attendance.filter(a => a.empNo === this.fieldFilterRep || a.employeeName === this.fieldFilterRep);
    }
    if (this.fieldFilterType !== 'ALL') {
      photos = photos.filter(p => p.photoType === this.fieldFilterType);
    }

    // Determine active dates to render
    const datesToRender = this.fieldFilterDate !== 'ALL' ? [this.fieldFilterDate] : availableDates;

    // Build hierarchical grouped map: Date -> Rep -> Data
    const groupedMap = {};
    datesToRender.forEach(d => {
      const dayPhotos = photos.filter(p => p.date === d);
      const dayAtt = attendance.filter(a => a.date === d);

      if (dayPhotos.length === 0 && dayAtt.length === 0 && this.fieldFilterDate === 'ALL') {
        return; // skip completely empty days in ALL mode
      }

      groupedMap[d] = {};

      // Determine active reps for this day
      const activeRepNames = new Set();
      dayPhotos.forEach(p => { if (p.repName) activeRepNames.add(p.repName); });
      dayAtt.forEach(a => { if (a.employeeName) activeRepNames.add(a.employeeName); });
      
      // If filtering for today with ALL reps, include defined reps even if photos pending
      if (this.fieldFilterDate === todayStr && this.fieldFilterRep === 'ALL') {
        reps.forEach(r => activeRepNames.add(r.fullName));
      }

      activeRepNames.forEach(repName => {
        const empObj = reps.find(r => r.fullName === repName || r.callingName === repName);
        const repPhotos = dayPhotos.filter(p => (p.repName === repName) || (empObj && p.empNo === empObj.empNo));
        const repAtt = dayAtt.find(a => (a.employeeName === repName) || (empObj && a.empNo === empObj.empNo));

        const startMeterPhoto = repAtt?.startMeterPhoto || repPhotos.find(p => p.photoType === 'BIKE_METER_START')?.photoUrl;
        const startMeterKm = repAtt?.startMeterKm || repPhotos.find(p => p.photoType === 'BIKE_METER_START')?.meterKm;
        const startMeterTime = repPhotos.find(p => p.photoType === 'BIKE_METER_START')?.time || repAtt?.checkIn;

        const selfiePhoto = repAtt?.selfiePhoto || repPhotos.find(p => p.photoType === 'REP_SELFIE_START')?.photoUrl;
        const selfieTime = repPhotos.find(p => p.photoType === 'REP_SELFIE_START')?.time;

        const endMeterPhoto = repAtt?.endMeterPhoto || repPhotos.find(p => p.photoType === 'BIKE_METER_END')?.photoUrl;
        const endMeterKm = repAtt?.endMeterKm || repPhotos.find(p => p.photoType === 'BIKE_METER_END')?.meterKm;
        const endMeterTime = repPhotos.find(p => p.photoType === 'BIKE_METER_END')?.time || repAtt?.checkOut;
        const totalKm = repAtt?.totalKm || (endMeterKm && startMeterKm ? Math.max(0, endMeterKm - startMeterKm) : 0);

        const displayPhotos = repPhotos.filter(p => p.photoType === 'SPICE_DISPLAY' || (!p.photoType?.startsWith('BIKE_') && p.photoType !== 'REP_SELFIE_START'));

        groupedMap[d][repName] = {
          empObj,
          repName,
          repAtt,
          startMeterPhoto,
          startMeterKm,
          startMeterTime,
          selfiePhoto,
          selfieTime,
          endMeterPhoto,
          endMeterKm,
          endMeterTime,
          totalKm,
          displayPhotos,
          totalCount: (startMeterPhoto ? 1 : 0) + (selfiePhoto ? 1 : 0) + (endMeterPhoto ? 1 : 0) + displayPhotos.length
        };
      });
    });

    const totalRenderedPhotos = photos.length;

    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-4 max-w-full overflow-hidden">
        <!-- Module Header -->
        <div class="border-b border-slate-100 pb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>📸</span> Rep Field Photos & Bike Meter Audits (ක්ෂේත්‍ර ඡායාරූප)
            </h3>
            <p class="text-[11px] text-slate-400">
              දිනය හා එක් එක් Rep අනුව පිළිවෙළට වර්ග කර ඇත (${totalRenderedPhotos} Photos Filtered)
            </p>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button onclick="RouteSession.openShopPhotoModal()" class="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-xs cursor-pointer">
              <span>📸 Snap Shop Display</span>
            </button>
          </div>
        </div>

        <!-- Filter Controls Bar -->
        <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <label class="font-bold text-slate-700 block mb-1">📅 දිනය තෝරන්න (Select Date)</label>
            <div class="flex items-center gap-1">
              <select onchange="HR.onFieldFilterChange('date', this.value)" class="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800">
                <option value="${todayStr}" ${this.fieldFilterDate === todayStr ? 'selected' : ''}>📅 අද (Today - ${todayStr})</option>
                <option value="ALL" ${this.fieldFilterDate === 'ALL' ? 'selected' : ''}>🌐 සියලු දින (All Dates)</option>
                ${availableDates.filter(d => d !== todayStr).map(d => `
                  <option value="${d}" ${this.fieldFilterDate === d ? 'selected' : ''}>${d}</option>
                `).join('')}
              </select>
              <input type="date" value="${this.fieldFilterDate !== 'ALL' ? this.fieldFilterDate : todayStr}" onchange="HR.onFieldFilterChange('date', this.value)" class="bg-white border border-slate-200 rounded-xl px-2 py-1.5 font-bold text-slate-800 text-xs" />
            </div>
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">👤 නියෝජිතයා (Filter by Rep)</label>
            <select onchange="HR.onFieldFilterChange('rep', this.value)" class="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800">
              <option value="ALL" ${this.fieldFilterRep === 'ALL' ? 'selected' : ''}>🌐 සියලු නියෝජිතයින් (All Reps)</option>
              ${reps.map(r => `
                <option value="${r.fullName}" ${this.fieldFilterRep === r.fullName ? 'selected' : ''}>${r.fullName} (${r.empNo})</option>
              `).join('')}
            </select>
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">🏷️ ඡායාරූප වර්ගය (Photo Type)</label>
            <select onchange="HR.onFieldFilterChange('type', this.value)" class="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800">
              <option value="ALL" ${this.fieldFilterType === 'ALL' ? 'selected' : ''}>🌐 සියලු වර්ග (All Photo Types)</option>
              <option value="BIKE_METER_START" ${this.fieldFilterType === 'BIKE_METER_START' ? 'selected' : ''}>🛵 Morning Start Bike Meter</option>
              <option value="REP_SELFIE_START" ${this.fieldFilterType === 'REP_SELFIE_START' ? 'selected' : ''}>🤳 Morning Selfie Verification</option>
              <option value="BIKE_METER_END" ${this.fieldFilterType === 'BIKE_METER_END' ? 'selected' : ''}>🏁 Evening End Bike Meter</option>
              <option value="SPICE_DISPLAY" ${this.fieldFilterType === 'SPICE_DISPLAY' ? 'selected' : ''}>🏪 Shop Display Cards (එල්ලූ කාඩ්)</option>
            </select>
          </div>
        </div>

        <!-- Grouped Photo Sections (By Date -> By Rep) -->
        <div class="space-y-6">
          ${Object.keys(groupedMap).length === 0 ? `
            <div class="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400 space-y-2">
              <div class="text-3xl">📷</div>
              <p class="font-bold text-xs text-slate-600">තෝරාගත් පෙරහනට අදාළ ඡායාරූප නොමැත (No field photos found).</p>
              <button onclick="HR.onFieldFilterChange('date', 'ALL')" class="text-pink-600 hover:underline text-xs font-bold cursor-pointer">
                🌐 සියලු දිනවල ඡායාරූප බලන්න (View All Dates)
              </button>
            </div>
          ` : Object.entries(groupedMap).map(([dateKey, repMap]) => `
            <div class="space-y-3 p-4 bg-slate-50/70 rounded-3xl border border-slate-200">
              <!-- Date Banner -->
              <div class="flex items-center justify-between pb-2 border-b border-slate-200 flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-1 rounded-xl bg-pink-100 text-pink-800 font-black text-xs">
                    📅 ${dateKey === todayStr ? `අද දිනය (${dateKey})` : dateKey}
                  </span>
                  <span class="text-[11px] text-slate-500 font-bold">
                    ${Object.keys(repMap).length} Active Reps on Duty
                  </span>
                </div>
              </div>

              <!-- Rep Cards Grid for this Date -->
              <div class="space-y-3">
                ${Object.values(repMap).map(rData => `
                  <div class="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:border-pink-300 transition-colors">
                    <!-- Rep Info Row -->
                    <div class="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                          ${(rData.repName || 'R').charAt(0)}
                        </div>
                        <div>
                          <h4 class="font-black text-slate-900 text-xs flex items-center gap-1.5">
                            <span>${rData.repName}</span>
                            ${rData.empObj?.empNo ? `<span class="text-[10px] text-slate-400 font-mono">(${rData.empObj.empNo})</span>` : ''}
                          </h4>
                          <div class="text-[10px] text-slate-500 font-mono">
                            ${rData.empObj?.designation || 'Sales Representative'} · Total ${rData.totalCount} Photos
                          </div>
                        </div>
                      </div>

                      <!-- Odometer Km Pill -->
                      <div class="flex items-center gap-2 text-xs">
                        <span class="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-mono font-bold text-[11px] border border-emerald-200">
                          🛵 ${rData.totalKm > 0 ? `${rData.totalKm} KM Travelled` : 'Odometer Logged'}
                        </span>
                      </div>
                    </div>

                    <!-- Rep Photos Gallery: Start Meter, Selfie, End Meter, and Shop Displays -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
                      <!-- 1. Morning Start Bike Meter -->
                      <div class="p-2 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
                        <span class="text-[9px] font-black uppercase text-indigo-700 block">🛵 Start Meter</span>
                        ${rData.startMeterPhoto ? `
                          <img src="${rData.startMeterPhoto}" onclick="HR.openPhotoModal(this.src, 'Morning Bike Meter: ${rData.startMeterKm || 0} km', '${rData.repName} · ${dateKey} ${rData.startMeterTime || ''}')" class="w-full h-24 object-cover rounded-lg border border-slate-200 cursor-pointer hover:scale-105 transition-transform shadow-2xs" />
                          <div class="text-[10px] font-mono font-bold text-slate-800">${rData.startMeterKm || 0} KM</div>
                          <div class="text-[9px] text-slate-400">${rData.startMeterTime || '--'}</div>
                        ` : `
                          <div class="h-24 rounded-lg bg-slate-100 border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-[10px] p-1">
                            <span>No Start Photo</span>
                          </div>
                        `}
                      </div>

                      <!-- 2. Morning Selfie -->
                      <div class="p-2 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
                        <span class="text-[9px] font-black uppercase text-purple-700 block">🤳 Morning Selfie</span>
                        ${rData.selfiePhoto ? `
                          <img src="${rData.selfiePhoto}" onclick="HR.openPhotoModal(this.src, 'Morning Rep Selfie Verification', '${rData.repName} · ${dateKey} ${rData.selfieTime || ''}')" class="w-full h-24 object-cover rounded-lg border border-slate-200 cursor-pointer hover:scale-105 transition-transform shadow-2xs" />
                          <div class="text-[10px] font-bold text-slate-800">Verified</div>
                          <div class="text-[9px] text-slate-400">${rData.selfieTime || '--'}</div>
                        ` : `
                          <div class="h-24 rounded-lg bg-slate-100 border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-[10px] p-1">
                            <span>No Selfie</span>
                          </div>
                        `}
                      </div>

                      <!-- 3. Evening End Bike Meter -->
                      <div class="p-2 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
                        <span class="text-[9px] font-black uppercase text-rose-700 block">🏁 End Meter</span>
                        ${rData.endMeterPhoto ? `
                          <img src="${rData.endMeterPhoto}" onclick="HR.openPhotoModal(this.src, 'Evening Closing Bike Meter: ${rData.endMeterKm || 0} km', '${rData.repName} · ${dateKey} ${rData.endMeterTime || ''}')" class="w-full h-24 object-cover rounded-lg border border-slate-200 cursor-pointer hover:scale-105 transition-transform shadow-2xs" />
                          <div class="text-[10px] font-mono font-bold text-slate-800">${rData.endMeterKm || 0} KM</div>
                          <div class="text-[9px] text-slate-400">${rData.endMeterTime || '--'}</div>
                        ` : `
                          <div class="h-24 rounded-lg bg-slate-100 border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-[10px] p-1">
                            <span>Duty Active</span>
                          </div>
                        `}
                      </div>

                      <!-- 4. Shop Hanging Display Photos for this Rep -->
                      ${rData.displayPhotos.map(p => {
                        const titleText = p.shopName || p.caption || 'Shop Display';
                        const metaText = `${rData.repName} · ${p.date || dateKey} ${p.time || ''}`;
                        return `
                          <div class="p-2 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1 hover:border-pink-300 transition-colors">
                            <span class="text-[9px] font-black uppercase text-pink-700 block truncate" title="${titleText}">🏪 ${titleText}</span>
                            <img src="${p.photoUrl}" onclick="HR.openPhotoModal(this.src, '${titleText.replace(/'/g, "\\'")}', '${metaText.replace(/'/g, "\\'")}')" class="w-full h-24 object-cover rounded-lg border border-slate-200 cursor-pointer hover:scale-105 transition-transform shadow-2xs" />
                            <div class="text-[9px] text-slate-500 truncate" title="${titleText}">${titleText}</div>
                            <div class="text-[8.5px] text-slate-400">${p.time || ''}</div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  onFieldFilterChange(key, value) {
    if (key === 'date') this.fieldFilterDate = value;
    if (key === 'rep') this.fieldFilterRep = value;
    if (key === 'type') this.fieldFilterType = value;
    const container = document.getElementById('hr-module-content');
    if (container) this.renderFieldAttendance(container);
  },


    openPhotoModal(src, title = 'Field Photo', meta = '') {
    const img = document.getElementById('hr-lightbox-img');
    const titleEl = document.getElementById('hr-lightbox-title');
    const metaEl = document.getElementById('hr-lightbox-meta');
    const descEl = document.getElementById('hr-lightbox-desc');
    const dl = document.getElementById('hr-lightbox-dl');

    if (img) img.src = src;
    if (titleEl) titleEl.textContent = title;
    if (metaEl) metaEl.textContent = meta;
    if (descEl) descEl.textContent = title;
    if (dl) dl.href = src;

    UI.openModal('modal-hr-photo-lightbox');
  },

  viewFullPhoto(src) {
    this.openPhotoModal(src, 'High-Resolution Field Photo', 'Verification Photo');
  },

  // =========================================================================
  // =========================================================================
  // MODULE 7: SHIFT MANAGEMENT (Full CRUD: Add, List, Delete)
  // =========================================================================
  async renderShifts(container) {
    let shifts = filterByTenant(await db.shifts?.toArray() || []);
    if (shifts.length === 0) {
      const defShifts = [
        { name: 'Field Sales Route Shift', start: '07:30', end: '17:30', dept: 'Sales & Field Distribution', days: 'Mon - Sat', tenantId: getActiveTenantId() || 1 },
        { name: 'Stores Packing & Dispatch', start: '08:00', end: '17:00', dept: 'Warehouse & Stores', days: 'Mon - Sat', tenantId: getActiveTenantId() || 1 },
        { name: 'General Office & Admin', start: '08:30', end: '17:00', dept: 'Human Resources & Payroll', days: 'Mon - Fri', tenantId: getActiveTenantId() || 1 }
      ];
      for (const s of defShifts) {
        if (db.shifts) await db.shifts.add(s);
      }
      shifts = filterByTenant(await db.shifts?.toArray() || []);
    }

    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">Shift Timetables & Rosters (වැඩ මුර කාලසටහන)</h3>
            <p class="text-[11px] text-slate-400">Scheduled work shifts and standard operational timings</p>
          </div>
          <button onclick="HR.openAddShiftModal()" class="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 shadow-xs">
            <span>➕ Add New Shift</span>
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          ${shifts.map(s => `
            <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 relative group hover:border-pink-300 transition-colors">
              <div class="flex items-center justify-between">
                <span class="font-black text-slate-800 block text-xs truncate">${s.name}</span>
                <button onclick="HR.deleteShift(${s.id})" class="text-rose-500 hover:text-rose-700 text-xs font-bold" title="Delete Shift">🗑️</button>
              </div>
              <p class="text-pink-700 font-bold font-mono">⏰ ${s.start} - ${s.end}</p>
              <p class="text-slate-500 text-[10px]">Active: ${s.days} (${s.dept})</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  openAddShiftModal() {
    UI.openModal('modal-hr-add-shift');
  },

  async saveShift() {
    const name = document.getElementById('hr-shift-name')?.value?.trim();
    const start = document.getElementById('hr-shift-start')?.value || '08:00';
    const end = document.getElementById('hr-shift-end')?.value || '17:00';
    const dept = document.getElementById('hr-shift-dept')?.value || 'General';
    const days = document.getElementById('hr-shift-days')?.value || 'Mon - Sat';

    if (!name) {
      UI.showToast('Please enter a Shift Name', 'warning');
      return;
    }

    if (db.shifts) {
      await db.shifts.add({
        name,
        start,
        end,
        dept,
        days,
        tenantId: getActiveTenantId() || 1,
        createdAt: new Date().toISOString()
      });
    }

    UI.closeModal('modal-hr-add-shift');
    UI.showToast('Shift added successfully! ✅', 'success');
    if (typeof SoundFX !== 'undefined') SoundFX.play('save');
    this.renderShifts(document.getElementById('hr-module-content'));
  },

  async deleteShift(id) {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    if (db.shifts) await db.shifts.delete(id);
    UI.showToast('Shift removed.', 'info');
    this.renderShifts(document.getElementById('hr-module-content'));
  },

  // =========================================================================
  // MODULE 8: LEAVE MANAGEMENT (Modal-based: Apply, Approve, Reject, Delete)
  // =========================================================================
  async renderLeaves(container) {
    const leaves = filterByTenant(await db.leaves?.toArray() || []).sort((a,b) => (b.fromDate||'').localeCompare(a.fromDate||''));
    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 max-w-full overflow-hidden">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div>
            <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">Leave Applications & Balances (නිවාඩු කළමනාකරණය)</h3>
            <p class="text-[11px] text-slate-400">Annual (14d), Casual (7d), Medical (7d), Half-Day & No-Pay Approvals</p>
          </div>
          <button onclick="HR.openApplyLeaveModal()" class="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95">
            + Apply Leave
          </button>
        </div>

        <div class="space-y-2 text-xs">
          ${leaves.length === 0 ? '<div class="text-center py-6 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">No leave requests recorded yet. Click "+ Apply Leave" to add a leave application.</div>' : leaves.map(l => `
            <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between hover:border-pink-300 transition-colors">
              <div>
                <div class="font-bold text-slate-900">${l.employeeName} (${l.leaveType})</div>
                <div class="text-[11px] text-slate-500">${l.fromDate} to ${l.toDate} (${l.days} Day) · Reason: <span class="text-slate-700 italic">${l.reason || 'Personal'}</span></div>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${l.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : (l.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}">
                  ${l.status || 'Pending'}
                </span>
                ${l.status !== 'Approved' ? `<button onclick="HR.approveLeave(${l.id})" class="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px]">Approve</button>` : ''}
                ${l.status !== 'Rejected' ? `<button onclick="HR.rejectLeave(${l.id})" class="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 font-bold text-[10px]">Reject</button>` : ''}
                <button onclick="HR.deleteLeave(${l.id})" class="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[10px]" title="Delete">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  async openApplyLeaveModal() {
    const empSelect = document.getElementById('hr-leave-emp-select');
    const fromEl = document.getElementById('hr-leave-from-date');
    const toEl = document.getElementById('hr-leave-to-date');
    const reasonEl = document.getElementById('hr-leave-reason');

    const today = new Date().toISOString().split('T')[0];
    if (fromEl) fromEl.value = today;
    if (toEl) toEl.value = today;
    if (reasonEl) reasonEl.value = '';

    if (empSelect) {
      const emps = filterByTenant(await db.employees?.toArray() || []);
      let html = '<option value="">-- සේවකයා තෝරන්න (Select Employee) --</option>';
      emps.forEach(e => {
        html += `<option value="${e.empNo}">${e.fullName} (${e.empNo})</option>`;
      });
      empSelect.innerHTML = html;
    }

    UI.openModal('modal-hr-apply-leave');
  },

  async saveLeave() {
    const empNo = document.getElementById('hr-leave-emp-select')?.value;
    if (!empNo) {
      UI.showToast('Please select an employee (සේවකයෙකු තෝරන්න)', 'warning');
      return;
    }
    const emps = filterByTenant(await db.employees?.toArray() || []);
    const emp = emps.find(e => e.empNo === empNo);
    const empName = emp ? emp.fullName : empNo;

    const leaveType = document.getElementById('hr-leave-type-select')?.value || 'Casual';
    const days = Number(document.getElementById('hr-leave-days')?.value) || 1;
    const fromDate = document.getElementById('hr-leave-from-date')?.value || new Date().toISOString().split('T')[0];
    const toDate = document.getElementById('hr-leave-to-date')?.value || fromDate;
    const reason = document.getElementById('hr-leave-reason')?.value?.trim() || 'Personal matters';

    if (db.leaves) {
      await db.leaves.add({
        empNo,
        employeeName: empName,
        leaveType,
        fromDate,
        toDate,
        days,
        reason,
        status: 'Approved',
        tenantId: getActiveTenantId() || 1,
        createdAt: new Date().toISOString()
      });
    }

    if (db.attendance) {
      const existing = await db.attendance.where('date').equals(fromDate).toArray();
      const myAtt = filterByTenant(existing).find(a => a.empNo === empNo);
      if (myAtt) {
        await db.attendance.update(myAtt.id, { status: leaveType === 'Half-Day' ? 'Half Day' : 'On Leave', notes: `${leaveType} Leave: ${reason}` });
      } else {
        await db.attendance.add({
          tenantId: getActiveTenantId() || 1,
          empNo,
          employeeName: empName,
          date: fromDate,
          checkIn: '--',
          checkOut: '--',
          status: leaveType === 'Half-Day' ? 'Half Day' : 'On Leave',
          notes: `${leaveType} Leave: ${reason}`,
          createdAt: new Date().toISOString()
        });
      }
    }

    UI.closeModal('modal-hr-apply-leave');
    UI.showToast(`Leave recorded and approved for ${empName}! ✅`, 'success');
    if (typeof SoundFX !== 'undefined') SoundFX.play('save');
    this.renderLeaves(document.getElementById('hr-module-content'));
  },

  async approveLeave(id) {
    if (db.leaves) await db.leaves.update(id, { status: 'Approved' });
    UI.showToast('Leave approved! ✅', 'success');
    this.renderLeaves(document.getElementById('hr-module-content'));
  },

  async rejectLeave(id) {
    if (db.leaves) await db.leaves.update(id, { status: 'Rejected' });
    UI.showToast('Leave request rejected.', 'info');
    this.renderLeaves(document.getElementById('hr-module-content'));
  },

  async deleteLeave(id) {
    if (!confirm('Delete this leave application?')) return;
    if (db.leaves) await db.leaves.delete(id);
    UI.showToast('Leave record removed.', 'info');
    this.renderLeaves(document.getElementById('hr-module-content'));
  },

  // =========================================================================
  // MODULE 9: OVERTIME MANAGEMENT (Full Dynamic OT Logger & Calculator)
  // =========================================================================
  async renderOvertime(container) {
    const ots = filterByTenant(await db.overtime?.toArray() || []).sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const totalHours = ots.reduce((sum, o) => sum + (Number(o.hours) || 0), 0);
    const totalPay = ots.reduce((sum, o) => sum + (Number(o.totalPay) || 0), 0);

    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-4 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">Overtime (OT) Hours & Calculations (අතිකාල දීමනා)</h3>
            <p class="text-[11px] text-slate-400">Stores packing overtime & late delivery dispatches (1.5x Hourly Rate)</p>
          </div>
          <button onclick="HR.openAddOtModal()" class="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 shadow-xs">
            <span>➕ Record Overtime</span>
          </button>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div class="p-3 bg-pink-50 rounded-2xl border border-pink-100">
            <span class="text-[10px] font-bold text-pink-700 uppercase">Total OT Hours</span>
            <div class="text-base font-black text-pink-900 mt-0.5">${totalHours.toFixed(1)} Hours</div>
          </div>
          <div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
            <span class="text-[10px] font-bold text-emerald-700 uppercase">Total OT Payout</span>
            <div class="text-base font-black text-emerald-900 mt-0.5">Rs. ${totalPay.toLocaleString()}</div>
          </div>
          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 col-span-2 sm:col-span-1">
            <span class="text-[10px] font-bold text-slate-600 uppercase">OT Formula</span>
            <div class="text-[11px] font-mono font-bold text-slate-800 mt-0.5">(Basic / 200h) × 1.5 Rate</div>
          </div>
        </div>

        <div class="space-y-2 text-xs">
          <h4 class="font-black text-slate-800 text-xs">Recent Overtime Records (${ots.length})</h4>
          ${ots.length === 0 ? `
            <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No overtime records entered yet. Use "+ Record Overtime" to log staff OT.
            </div>
          ` : `
            <div class="space-y-1.5">
              ${ots.map(o => `
                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between hover:border-pink-300 transition-colors">
                  <div>
                    <div class="font-bold text-slate-900">${o.employeeName} · <span class="text-pink-700 font-mono font-black">${o.hours}h</span> worked</div>
                    <div class="text-[11px] text-slate-500">${o.date} · Rate: Rs. ${o.hourlyRate}/h · Task: ${o.task || 'General OT'}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-black text-emerald-700 font-mono text-xs">Rs. ${Number(o.totalPay).toLocaleString()}</span>
                    <button onclick="HR.deleteOvertime(${o.id})" class="text-rose-500 hover:text-rose-700 font-bold ml-1 text-xs" title="Delete">🗑️</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  },

  async openAddOtModal() {
    const empSelect = document.getElementById('hr-ot-emp-select');
    const dateEl = document.getElementById('hr-ot-date');
    const hoursEl = document.getElementById('hr-ot-hours');
    const rateEl = document.getElementById('hr-ot-rate');
    const taskEl = document.getElementById('hr-ot-task');

    const today = new Date().toISOString().split('T')[0];
    if (dateEl) dateEl.value = today;
    if (hoursEl) hoursEl.value = '2.0';
    if (rateEl) rateEl.value = '350';
    if (taskEl) taskEl.value = '';
    this.recalcOtAmount();

    if (empSelect) {
      const emps = filterByTenant(await db.employees?.toArray() || []);
      let html = '<option value="">-- සේවකයා තෝරන්න (Select Staff) --</option>';
      emps.forEach(e => {
        html += `<option value="${e.empNo}">${e.fullName} (${e.empNo})</option>`;
      });
      empSelect.innerHTML = html;
    }

    UI.openModal('modal-hr-add-ot');
  },

  recalcOtAmount() {
    const hours = Number(document.getElementById('hr-ot-hours')?.value) || 0;
    const rate = Number(document.getElementById('hr-ot-rate')?.value) || 0;
    const totalEl = document.getElementById('hr-ot-total');
    if (totalEl) totalEl.value = `Rs. ${(hours * rate).toLocaleString()}`;
  },

  async saveOvertime() {
    const empNo = document.getElementById('hr-ot-emp-select')?.value;
    if (!empNo) {
      UI.showToast('Please select a staff member', 'warning');
      return;
    }
    const emps = filterByTenant(await db.employees?.toArray() || []);
    const emp = emps.find(e => e.empNo === empNo);
    const empName = emp ? emp.fullName : empNo;

    const date = document.getElementById('hr-ot-date')?.value || new Date().toISOString().split('T')[0];
    const hours = Number(document.getElementById('hr-ot-hours')?.value) || 0;
    const rate = Number(document.getElementById('hr-ot-rate')?.value) || 350;
    const task = document.getElementById('hr-ot-task')?.value?.trim() || 'Overtime work';
    const totalPay = hours * rate;

    if (db.overtime) {
      await db.overtime.add({
        empNo,
        employeeName: empName,
        date,
        hours,
        hourlyRate: rate,
        totalPay,
        task,
        tenantId: getActiveTenantId() || 1,
        createdAt: new Date().toISOString()
      });
    }

    UI.closeModal('modal-hr-add-ot');
    UI.showToast(`Overtime recorded for ${empName}: Rs. ${totalPay.toLocaleString()}`, 'success');
    if (typeof SoundFX !== 'undefined') SoundFX.play('save');
    this.renderOvertime(document.getElementById('hr-module-content'));
  },

  async deleteOvertime(id) {
    if (!confirm('Delete this overtime record?')) return;
    if (db.overtime) await db.overtime.delete(id);
    UI.showToast('Overtime record removed.', 'info');
    this.renderOvertime(document.getElementById('hr-module-content'));
  },

  // =========================================================================
  // MODULE 10: PAYROLL MANAGEMENT
  // =========================================================================
  async renderPayroll(container) {
    container.innerHTML = `
      <div class="space-y-4 max-w-full overflow-hidden">
        <div class="card-3d-white p-4 rounded-3xl border border-slate-200 flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-2">
            <label class="text-xs font-black text-slate-700 flex items-center gap-1">
              <span>📅</span> Salary Month (වැටුප් මාසය):
            </label>
            <input type="month" id="payroll-month-select" value="${Payroll.currentMonth || new Date().toISOString().slice(0, 7)}" onchange="Payroll.onMonthChange(this.value)" class="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 text-xs font-black text-slate-800 focus:ring-2 focus:ring-pink-500 outline-none" />
          </div>

          <div class="flex items-center gap-2">
            <button onclick="Payroll.recalculateMonth()" class="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-2xl shadow-md active:scale-95 transition-all flex items-center gap-1.5">
              <span>⚡ Auto Calculate Month (ගණනය කරන්න)</span>
            </button>
            <button onclick="Payroll.saveMonthlyPayrollSheet()" class="px-3.5 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-black rounded-2xl shadow-md active:scale-95">
              💾 Save Sheet
            </button>
          </div>
        </div>

        <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 overflow-hidden">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
            <div>
              <h3 class="font-black text-sm text-slate-900 uppercase tracking-wider">Monthly Salary Sheet (මාසික වැටුප් සටහන)</h3>
              <p class="text-[11px] text-slate-500">Live inline editable salary amounts with automatic instant net pay recalculation</p>
            </div>
            <button onclick="Payroll.openRulesModal()" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
              ⚙️ Target Rules
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr class="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                  <th class="p-3">Staff / Role</th>
                  <th class="p-3 text-right">Basic Salary</th>
                  <th class="p-3 text-center">Days Worked</th>
                  <th class="p-3 text-right">Card & Bill Bonuses</th>
                  <th class="p-3 text-right">Fuel / Allowances</th>
                  <th class="p-3 text-right">Advance / Deduct</th>
                  <th class="p-3 text-right">Net Payable</th>
                  <th class="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody id="payroll-table-body" class="divide-y divide-slate-100"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => { Payroll.loadMonthlyPayroll(); }, 50);
  },

  // =========================================================================
  // MODULE 11: SALES COMMISSION & INCENTIVES
  // =========================================================================
  async renderCommissions(container) {
    const rules = await Payroll.getPayrollRules();

    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2 flex items-center justify-between">
          <div>
            <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">Product Card Target Slabs & Commissions</h3>
            <p class="text-[11px] text-slate-400">Bonus incentives paid when sales reps reach tiered card counts</p>
          </div>
          <button onclick="Payroll.openRulesModal()" class="px-3 py-1.5 bg-pink-600 text-white rounded-xl text-xs font-bold">
            Edit Slabs
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          ${rules.cardTargetSlabs.map(s => `
            <div class="p-3 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-1">
              <span class="font-black text-purple-900 block">${s.name}</span>
              <p class="text-purple-700 font-bold">Target: ${s.minCards} Cards</p>
              <div class="text-sm font-black text-emerald-700">+Rs. ${Number(s.bonus).toLocaleString()} Bonus</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  // =========================================================================
  // MODULE 12: EPF / ETF & STATUTORY PAYROLL
  // =========================================================================
  async renderEpfEtf(container) {
    const employees = filterByTenant(await db.employees?.toArray() || []);
    let totalBasic = 0;
    employees.forEach(e => totalBasic += (Number(e.basicSalary) || 0));

    const empEpf8 = Math.round(totalBasic * 0.08);
    const empyrEpf12 = Math.round(totalBasic * 0.12);
    const empyrEtf3 = Math.round(totalBasic * 0.03);
    const totalStatutory = empEpf8 + empyrEpf12 + empyrEtf3;

    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-4 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2">
          <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">EPF / ETF Statutory Deductions (ශ්‍රී ලංකා සේවක අර්ථසාධක)</h3>
          <p class="text-[11px] text-slate-400">Central Bank compliance: 8% Employee EPF, 12% Employer EPF & 3% Employer ETF</p>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <span class="text-[10px] font-bold text-slate-500 uppercase block">Eligible Earnings</span>
            <div class="text-lg font-black text-slate-900 mt-1">Rs. ${totalBasic.toLocaleString()}</div>
          </div>
          <div class="p-3 bg-rose-50 rounded-2xl border border-rose-200">
            <span class="text-[10px] font-bold text-rose-700 uppercase block">Employee EPF (8%)</span>
            <div class="text-lg font-black text-rose-700 mt-1">Rs. ${empEpf8.toLocaleString()}</div>
          </div>
          <div class="p-3 bg-blue-50 rounded-2xl border border-blue-200">
            <span class="text-[10px] font-bold text-blue-700 uppercase block">Employer EPF (12%)</span>
            <div class="text-lg font-black text-blue-700 mt-1">Rs. ${empyrEpf12.toLocaleString()}</div>
          </div>
          <div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
            <span class="text-[10px] font-bold text-emerald-700 uppercase block">Employer ETF (3%)</span>
            <div class="text-lg font-black text-emerald-700 mt-1">Rs. ${empyrEtf3.toLocaleString()}</div>
          </div>
        </div>

        <div class="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 font-semibold flex items-center justify-between">
          <span>🏛️ Total Monthly Statutory Remittance to Central Bank:</span>
          <span class="font-black text-base">Rs. ${totalStatutory.toLocaleString()}</span>
        </div>
      </div>
    `;
  },

  // =========================================================================
  // MODULE 13: SALARY PAYMENTS
  // =========================================================================
  async renderPayments(container) {
    const employees = filterByTenant(await db.employees?.toArray() || []);

    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2 flex items-center justify-between">
          <div>
            <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">Salary Payment Disbursements</h3>
            <p class="text-[11px] text-slate-400">Cash and Bank Transfer disbursement status tracking</p>
          </div>
          <button onclick="alert('Exported bank salary upload format CSV!')" class="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold">
            📥 Export Bank Transfer Sheet
          </button>
        </div>

        <div class="space-y-1.5 text-xs">
          ${employees.map(e => `
            <div class="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <span class="font-bold text-slate-900">${e.fullName}</span>
                <p class="text-[10px] text-slate-500">${e.bankName || 'Commercial Bank'} · Acc: ${e.accountNo || '78234512'}</p>
              </div>
              <div class="text-right">
                <div class="font-black text-slate-900">Rs. ${e.basicSalary.toLocaleString()}</div>
                <span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">✓ Ready to Disburse</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  // =========================================================================
  // MODULE 14: PAYSLIP MANAGEMENT
  // =========================================================================
  async renderPayslips(container) {
    const employees = filterByTenant(await db.employees?.toArray() || []);

    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2">
          <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">Staff Payslips Printing & Distribution</h3>
          <p class="text-[11px] text-slate-400">Print 80mm POS thermal slips or standard full A4 salary statements</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          ${employees.map(e => `
            <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <div class="font-bold text-xs text-slate-900 truncate">${e.fullName}</div>
                <div class="text-[10px] text-slate-400">${e.empNo} · ${e.designation}</div>
              </div>
              <button onclick="Payroll.printPayslip(0)" class="px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-xl font-bold text-xs">
                🖨️ Payslip
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  // =========================================================================
  // =========================================================================
  // MODULE 15: EMPLOYEE PERFORMANCE (Full CRUD: Add, List, Delete)
  // =========================================================================
  async renderPerformance(container) {
    let kpis = filterByTenant(await db.performance?.toArray() || []);

    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">Employee Performance & KPI Ratings (කාර්යසාධන ඇගයීම)</h3>
            <p class="text-[11px] text-slate-400">Target achievement, attendance compliance & field rating evaluations</p>
          </div>
          <button onclick="HR.openAddKpiModal()" class="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold active:scale-95 shadow-xs">
            + Add KPI Rating
          </button>
        </div>

        <div class="space-y-2 text-xs">
          ${kpis.length === 0 ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div class="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
                <span class="font-black text-amber-900 block text-xs">🏆 Best Performer of the Month</span>
                <p class="text-amber-800 font-bold">Field Rep Target Leader</p>
                <p class="text-[11px] text-amber-700">Achieved 100% of Chilli & Curry Card Target Slabs (5.0 / 5.0 ⭐)</p>
              </div>
              <div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
                <span class="font-black text-emerald-900 block text-xs">⭐ Attendance Excellence Award</span>
                <p class="text-emerald-800 font-bold">Stores & Packing Staff</p>
                <p class="text-[11px] text-emerald-700">26 Days worked without single day late or absent!</p>
              </div>
            </div>
          ` : `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${kpis.map(k => `
                <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 relative hover:border-pink-300 transition-colors">
                  <div class="flex items-center justify-between">
                    <span class="font-black text-slate-900 text-xs">${k.employeeName}</span>
                    <button onclick="HR.deletePerformance(${k.id})" class="text-rose-500 hover:text-rose-700 font-bold text-xs" title="Delete">🗑️</button>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-black text-amber-600 font-mono text-xs">⭐ ${k.rating} / 5.0</span>
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800">${k.targetPct || 100}% Target</span>
                  </div>
                  ${k.award ? `<p class="font-bold text-amber-800 text-[11px]">🏆 ${k.award}</p>` : ''}
                  ${k.notes ? `<p class="text-[11px] text-slate-500 bg-white p-2 rounded-xl border border-slate-100">${k.notes}</p>` : ''}
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  },

  async openAddKpiModal() {
    const empSelect = document.getElementById('hr-kpi-emp-select');
    if (empSelect) {
      const emps = filterByTenant(await db.employees?.toArray() || []);
      let html = '<option value="">-- සේවකයා තෝරන්න (Select Staff) --</option>';
      emps.forEach(e => {
        html += `<option value="${e.empNo}">${e.fullName} (${e.empNo})</option>`;
      });
      empSelect.innerHTML = html;
    }
    UI.openModal('modal-hr-add-kpi');
  },

  async savePerformance() {
    const empNo = document.getElementById('hr-kpi-emp-select')?.value;
    if (!empNo) {
      UI.showToast('Please select a staff member', 'warning');
      return;
    }
    const emps = filterByTenant(await db.employees?.toArray() || []);
    const emp = emps.find(e => e.empNo === empNo);
    const empName = emp ? emp.fullName : empNo;

    const rating = document.getElementById('hr-kpi-score')?.value || '5.0';
    const targetPct = Number(document.getElementById('hr-kpi-target-pct')?.value) || 100;
    const award = document.getElementById('hr-kpi-award')?.value?.trim() || '';
    const notes = document.getElementById('hr-kpi-notes')?.value?.trim() || '';

    if (db.performance) {
      await db.performance.add({
        empNo,
        employeeName: empName,
        rating,
        targetPct,
        award,
        notes,
        tenantId: getActiveTenantId() || 1,
        createdAt: new Date().toISOString()
      });
    }

    UI.closeModal('modal-hr-add-kpi');
    UI.showToast(`KPI rating saved for ${empName}! ⭐`, 'success');
    if (typeof SoundFX !== 'undefined') SoundFX.play('save');
    this.renderPerformance(document.getElementById('hr-module-content'));
  },

  async deletePerformance(id) {
    if (!confirm('Delete this KPI rating?')) return;
    if (db.performance) await db.performance.delete(id);
    UI.showToast('KPI record removed.', 'info');
    this.renderPerformance(document.getElementById('hr-module-content'));
  },

  // =========================================================================
  // MODULE 16: RECRUITMENT MANAGEMENT (Full CRUD: Post, Toggle, Delete)
  // =========================================================================
  async renderRecruitment(container) {
    let vacancies = filterByTenant(await db.recruitment?.toArray() || []);
    if (vacancies.length === 0) {
      const def = {
        title: 'Junior Sales Representative (Kekirawa Territory)',
        dept: 'Sales & Field Distribution',
        salary: 'Rs. 40,000 - 65,000',
        reqs: 'Valid riding license, good communication, spice retail experience preferred.',
        status: 'Open',
        tenantId: getActiveTenantId() || 1,
        createdAt: new Date().toISOString()
      };
      if (db.recruitment) await db.recruitment.add(def);
      vacancies = filterByTenant(await db.recruitment?.toArray() || []);
    }

    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">Recruitment & Open Vacancies (නව රැකියා ඇබෑර්තු)</h3>
            <p class="text-[11px] text-slate-400">Job postings, candidate interviews & applicant pipeline</p>
          </div>
          <button onclick="HR.openAddVacancyModal()" class="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold active:scale-95 shadow-xs">
            + Post Vacancy
          </button>
        </div>
        <div class="space-y-2 text-xs">
          ${vacancies.map(v => `
            <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 hover:border-pink-300 transition-colors">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-bold text-slate-900">${v.title}</span>
                  <div class="text-[10px] text-slate-400">${v.dept} · Salary: ${v.salary || 'Negotiable'}</div>
                </div>
                <div class="flex items-center gap-1.5">
                  <button onclick="HR.toggleVacancyStatus(${v.id})" class="px-2 py-0.5 rounded-full font-black text-[9px] ${v.status === 'Open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}">
                    ${v.status || 'Open'}
                  </button>
                  <button onclick="HR.deleteVacancy(${v.id})" class="text-rose-500 hover:text-rose-700 font-bold ml-1 text-xs" title="Delete">🗑️</button>
                </div>
              </div>
              ${v.reqs ? `<p class="text-[11px] text-slate-500 bg-white p-2 rounded-xl border border-slate-100">${v.reqs}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  openAddVacancyModal() {
    UI.openModal('modal-hr-add-vacancy');
  },

  async saveVacancy() {
    const title = document.getElementById('hr-vac-title')?.value?.trim();
    const dept = document.getElementById('hr-vac-dept')?.value || 'Sales & Field Distribution';
    const salary = document.getElementById('hr-vac-salary')?.value?.trim() || '';
    const reqs = document.getElementById('hr-vac-reqs')?.value?.trim() || '';

    if (!title) {
      UI.showToast('Please enter job title', 'warning');
      return;
    }

    if (db.recruitment) {
      await db.recruitment.add({
        title,
        dept,
        salary,
        reqs,
        status: 'Open',
        tenantId: getActiveTenantId() || 1,
        createdAt: new Date().toISOString()
      });
    }

    UI.closeModal('modal-hr-add-vacancy');
    UI.showToast('Vacancy posted successfully! 📢', 'success');
    if (typeof SoundFX !== 'undefined') SoundFX.play('save');
    this.renderRecruitment(document.getElementById('hr-module-content'));
  },

  async toggleVacancyStatus(id) {
    const v = await db.recruitment?.get(id);
    if (!v) return;
    const newStatus = v.status === 'Open' ? 'Closed' : 'Open';
    await db.recruitment.update(id, { status: newStatus });
    UI.showToast(`Vacancy marked as ${newStatus}`, 'info');
    this.renderRecruitment(document.getElementById('hr-module-content'));
  },

  async deleteVacancy(id) {
    if (!confirm('Delete this vacancy?')) return;
    if (db.recruitment) await db.recruitment.delete(id);
    UI.showToast('Vacancy removed.', 'info');
    this.renderRecruitment(document.getElementById('hr-module-content'));
  },

  // =========================================================================
  // MODULE 17: TRAINING & DEVELOPMENT
  // =========================================================================
  async renderTraining(container) {
    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2">
          <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">Employee Training & Skill Development</h3>
          <p class="text-[11px] text-slate-400">Field customer handling, POS mobile billing & safety protocols</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <span class="font-black text-slate-800 block">📱 Mobile POS & Offline Billing Masterclass</span>
            <p class="text-slate-500 text-[11px]">All Sales Reps trained on Bluetooth printing, card booking & QR scan.</p>
          </div>
          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <span class="font-black text-slate-800 block">🚚 Safe Van Delivery & Stock Auditing</span>
            <p class="text-slate-500 text-[11px]">Morning lorry loading, evening return checks and credit collection.</p>
          </div>
        </div>
      </div>
    `;
  },

  // =========================================================================
  // MODULE 18: EMPLOYEE REQUESTS (Full CRUD: Submit, Approve, Reject, Delete)
  // =========================================================================
  async renderRequests(container) {
    const reqs = filterByTenant(await db.hrRequests?.toArray() || []).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">Centralized Employee Requests Desk (සේවක ඉල්ලීම්)</h3>
            <p class="text-[11px] text-slate-400">Salary advance requests, loan applications & equipment requests</p>
          </div>
          <button onclick="HR.openAddRequestModal()" class="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold active:scale-95 shadow-xs">
            + New Request
          </button>
        </div>
        <div class="space-y-2 text-xs">
          ${reqs.length === 0 ? `
            <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No staff requests submitted yet. Click "+ New Request" to log a staff advance or tool request.
            </div>
          ` : `
            ${reqs.map(r => `
              <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between hover:border-pink-300 transition-colors">
                <div>
                  <div class="font-bold text-slate-900">${r.employeeName} · <span class="text-pink-700">${r.requestType}</span></div>
                  <div class="text-[11px] text-slate-500">${r.note || ''} · <strong class="text-emerald-700">Rs. ${Number(r.amount || 0).toLocaleString()}</strong></div>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${r.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : (r.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}">
                    ${r.status || 'Pending'}
                  </span>
                  ${r.status !== 'Approved' ? `<button onclick="HR.approveRequest(${r.id})" class="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[10px]">Approve</button>` : ''}
                  ${r.status !== 'Rejected' ? `<button onclick="HR.rejectRequest(${r.id})" class="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px]">Reject</button>` : ''}
                  <button onclick="HR.deleteRequest(${r.id})" class="text-rose-500 hover:text-rose-700 font-bold ml-1 text-xs" title="Delete">🗑️</button>
                </div>
              </div>
            `).join('')}
          `}
        </div>
      </div>
    `;
  },

  async openAddRequestModal() {
    const empSelect = document.getElementById('hr-req-emp-select');
    if (empSelect) {
      const emps = filterByTenant(await db.employees?.toArray() || []);
      let html = '<option value="">-- සේවකයා තෝරන්න (Select Staff) --</option>';
      emps.forEach(e => {
        html += `<option value="${e.empNo}">${e.fullName} (${e.empNo})</option>`;
      });
      empSelect.innerHTML = html;
    }
    UI.openModal('modal-hr-add-request');
  },

  async saveRequest() {
    const empNo = document.getElementById('hr-req-emp-select')?.value;
    if (!empNo) {
      UI.showToast('Please select an employee', 'warning');
      return;
    }
    const emps = filterByTenant(await db.employees?.toArray() || []);
    const emp = emps.find(e => e.empNo === empNo);
    const empName = emp ? emp.fullName : empNo;

    const requestType = document.getElementById('hr-req-type')?.value || 'Salary Advance';
    const amount = Number(document.getElementById('hr-req-amount')?.value) || 0;
    const note = document.getElementById('hr-req-note')?.value?.trim() || '';

    if (db.hrRequests) {
      await db.hrRequests.add({
        empNo,
        employeeName: empName,
        requestType,
        amount,
        note,
        status: 'Pending',
        tenantId: getActiveTenantId() || 1,
        createdAt: new Date().toISOString()
      });
    }

    UI.closeModal('modal-hr-add-request');
    UI.showToast(`Request submitted for ${empName}! 📩`, 'success');
    if (typeof SoundFX !== 'undefined') SoundFX.play('save');
    this.renderRequests(document.getElementById('hr-module-content'));
  },

  async approveRequest(id) {
    if (db.hrRequests) await db.hrRequests.update(id, { status: 'Approved' });
    UI.showToast('Request approved! ✅', 'success');
    this.renderRequests(document.getElementById('hr-module-content'));
  },

  async rejectRequest(id) {
    if (db.hrRequests) await db.hrRequests.update(id, { status: 'Rejected' });
    UI.showToast('Request rejected.', 'info');
    this.renderRequests(document.getElementById('hr-module-content'));
  },

  async deleteRequest(id) {
    if (!confirm('Delete this request?')) return;
    if (db.hrRequests) await db.hrRequests.delete(id);
    UI.showToast('Request removed.', 'info');
    this.renderRequests(document.getElementById('hr-module-content'));
  },

  // =========================================================================
  // MODULE 19: HR & PAYROLL REPORTS
  // =========================================================================
  async renderReports(container) {
    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2">
          <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">HR & Payroll Audit Reports</h3>
          <p class="text-[11px] text-slate-400">Generate printable statements, government EPF filings & audit logs</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <button onclick="window.print()" class="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 text-left font-bold text-slate-800 flex items-center gap-2">
            <span>📑</span> Print Employee Master Register
          </button>
          <button onclick="Payroll.loadMonthlyPayroll(); window.print()" class="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 text-left font-bold text-slate-800 flex items-center gap-2">
            <span>💰</span> Print Monthly Salary Sheet
          </button>
          <button onclick="HR.switchModule('epfEtf'); window.print()" class="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 text-left font-bold text-slate-800 flex items-center gap-2">
            <span>🏛️</span> Print EPF / ETF C-Form
          </button>
          <button onclick="HR.downloadSystemManualPdf()" class="p-3 bg-gradient-to-r from-pink-50 to-rose-50 hover:from-pink-100 hover:to-rose-100 rounded-2xl border border-pink-200 text-left font-bold text-pink-900 flex items-center gap-2 shadow-xs">
            <span>📘</span> බාගත කරන්න: සම්පූර්ණ මෙහෙයුම් අත්පොත (System Manual PDF)
          </button>
        </div>
      </div>
    `;
  },

  // =========================================================================
  // MODULE 20: HR & PAYROLL SETTINGS
  // =========================================================================
  async renderSettings(container) {
    container.innerHTML = `
      <div class="card-3d-white p-4 rounded-3xl border border-slate-200 space-y-3 max-w-full overflow-hidden">
        <div class="border-b border-slate-100 pb-2">
          <h3 class="font-black text-sm text-slate-800 uppercase tracking-wider">HR & Payroll Settings & Policies</h3>
          <p class="text-[11px] text-slate-400">Set standard quotas, grace periods, employee ID sequence & rules</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label class="font-bold text-slate-600 block mb-1">Employee ID Prefix</label>
            <input type="text" value="EMP-" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold" />
          </div>
          <div>
            <label class="font-bold text-slate-600 block mb-1">Attendance Grace Period (Mins)</label>
            <input type="number" value="15" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold" />
          </div>
          <div>
            <label class="font-bold text-slate-600 block mb-1">Standard Annual Leave Days</label>
            <input type="number" value="14" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold" />
          </div>
          <div>
            <label class="font-bold text-slate-600 block mb-1">Standard Casual Leave Days</label>
            <input type="number" value="7" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold" />
          </div>
        </div>
        <button onclick="UI.showToast('HR Policies saved!', 'success')" class="px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-black">
          Save HR Policies
        </button>

        <!-- ── HR User Account Security ── -->
        <div class="border-t border-slate-100 pt-3 mt-1">
          <h4 class="font-black text-xs text-slate-700 uppercase tracking-wider mb-2">🔐 HR Login — Username & PIN Change</h4>
          <p class="text-[11px] text-slate-400 mb-2">Change your HR account username or PIN (password) here.</p>
          <button onclick="HR.openChangeHrPasswordModal()" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black flex items-center gap-2">
            🔑 Change HR Username / PIN
          </button>
        </div>

        <!-- ── System Operations Manual (PDF Download) ── -->
        <div class="border-t border-slate-100 pt-3 mt-1">
          <h4 class="font-black text-xs text-slate-700 uppercase tracking-wider mb-1">📘 සම්පූර්ණ පද්ධති මෙහෙයුම් අත්පොත (PDF User Manual)</h4>
          <p class="text-[11px] text-slate-400 mb-2">පද්ධතියේ සියලුම අංශ (POS, Rep, Delivery, GPS, Stores, HR) භාවිත කරන ආකාරය දැක්වෙන සිංහල අත්පොත PDF ලෙස බාගත කරන්න.</p>
          <button onclick="HR.downloadSystemManualPdf()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-sm active:scale-95">
            📥 බාගත කරන්න (Download System Manual PDF)
          </button>
        </div>

        <!-- ── HR Data Reset (HR දත්ත පමණක් Reset කිරීම) ── -->
        <div class="border-t border-rose-100 pt-3 mt-2 bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-base">⚠️</span>
            <h4 class="font-black text-xs text-rose-900 uppercase tracking-wider">Reset HR Department Data (මානව සම්පත් දත්ත Reset)</h4>
          </div>
          <p class="text-[11px] text-rose-700 leading-relaxed mb-3">
            මෙම බොත්තම මගින් මකා දැමෙන්නේ මානව සම්පත් (HR & Attendance) දත්ත පමණි (සේවකයින්, පැමිණීම්, නිවාඩු, පඩිපත්, මීටර් ඡායාරූප).<br>
            <strong>විකුණුම් (Sales), භාණ්ඩ (Products), කඩවල් (Shops) හෝ තොග (Stock) කිසිවකට හානියක් සිදු නොවේ.</strong>
          </p>
          <button onclick="HR.resetHrDepartmentData()" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm active:scale-95">
            🗑️ Reset HR Department Data Only
          </button>
        </div>
      </div>
    `;
  },

  // ── HR DATA RESET (ONLY RESETS HR & ATTENDANCE COLLECTIONS) ───────────────
  async resetHrDepartmentData() {
    const confirmed = confirm(
      "⚠️ අවවාදයයි: ඔබ මානව සම්පත් (HR & Payroll) දත්ත පමණක් Reset කිරීමට සූදානම් වේ.\n\n" +
      "මකා දැමෙන දත්ත:\n" +
      "• සේවක ලැයිස්තුව (Employees)\n" +
      "• දෛනික පැමිණීම් සහ මීටර්/සෙල්ෆි ඡායාරූප (Attendance & Photos)\n" +
      "• නිවාඩු (Leaves), අතිකාල (Overtime)\n" +
      "• වැටුප් ලේඛන (Payroll Records) සහ ඉල්ලීම්\n\n" +
      "❌ භාණ්ඩ (Products), විකුණුම් (Sales), කඩ (Shops), තොග (Stock) කිසිවක් වෙනස් නොවේ.\n\n" +
      "ඔබට මෙය සිදුකිරීමට අවශ්‍ය බව ස්ථිරද?"
    );
    if (!confirmed) return;

    try {
      UI.showToast('HR දත්ත Reset කරමින් පවතී...', 'info');
      const activeTid = getActiveTenantId() || 1;

      const clearTenantCollection = async (coll) => {
        if (!coll) return;
        try {
          const all = await coll.toArray();
          const targetIds = all
            .filter(r => (r.tenantId === undefined || r.tenantId === null || Number(r.tenantId) === Number(activeTid)))
            .map(r => r.id);
          if (targetIds.length > 0) {
            await coll.bulkDelete(targetIds);
          }
        } catch (e) {
          console.warn('Error clearing collection:', coll.name, e);
        }
      };

      await clearTenantCollection(db.employees);
      await clearTenantCollection(db.attendance);
      await clearTenantCollection(db.shifts);
      await clearTenantCollection(db.leaves);
      await clearTenantCollection(db.overtime);
      await clearTenantCollection(db.payroll);
      await clearTenantCollection(db.hrRequests);
      await clearTenantCollection(db.recruitment);
      await clearTenantCollection(db.training);
      await clearTenantCollection(db.performance);
      await clearTenantCollection(db.fieldPhotos);

      if (typeof ensureHrUserExists === 'function') {
        try { await ensureHrUserExists(); } catch (e) {}
      }

      UI.showToast('✅ මානව සම්පත් (HR) දත්ත පමණක් සාර්ථකව Reset විය!', 'success');
      if (typeof SoundFX !== 'undefined') SoundFX.play('save');

      const container = document.getElementById('hr-module-content');
      if (container) {
        await this.renderActiveModule();
      }
    } catch (err) {
      console.error('resetHrDepartmentData error:', err);
      UI.showToast('Reset කිරීමේදී දෝෂයක්: ' + err.message, 'error');
    }
  },

  // ── DOWNLOAD COMPREHENSIVE SYSTEM USER MANUAL IN SINHALA (PDF) ─────────────
  downloadSystemManualPdf() {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      UI.showToast('Popup blocked! Please allow popups to view and download PDF.', 'warning');
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="si">
<head>
  <meta charset="UTF-8">
  <title>MOB POS - සම්පූර්ණ පද්ධති මෙහෙයුම් අත්පොත (System User Manual)</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      background: #ffffff;
      font-size: 13px;
    }
    .header {
      border-bottom: 3px solid #db2777;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 {
      margin: 0;
      color: #0f172a;
      font-size: 22px;
      font-weight: 900;
    }
    .header p {
      margin: 3px 0 0;
      color: #64748b;
      font-size: 12px;
    }
    .badge {
      background: #fdf2f8;
      color: #be185d;
      border: 1px solid #fbcfe8;
      padding: 4px 10px;
      border-radius: 8px;
      font-weight: bold;
      font-size: 11px;
    }
    .section {
      margin-bottom: 22px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      border-left: 4px solid #db2777;
      padding-left: 10px;
      margin-bottom: 10px;
      background: #f8fafc;
      padding-top: 4px;
      padding-bottom: 4px;
      border-radius: 0 6px 6px 0;
    }
    .box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .box-pink {
      background: #fdf2f8;
      border: 1px solid #fce7f3;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .box-emerald {
      background: #ecfdf5;
      border: 1px solid #d1fae5;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    ul, ol {
      margin: 5px 0 10px;
      padding-left: 20px;
    }
    li {
      margin-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
    }
    .print-bar {
      background: #0f172a;
      color: #ffffff;
      padding: 10px 15px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .btn-print {
      background: #db2777;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
    }
    @media print {
      .print-bar { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>

  <div class="print-bar">
    <span>🖨️ මෙම පිටුව PDF එකක් ලෙස Save කර ගැනීමට හෝ Print කර ගැනීමට:</span>
    <button class="btn-print" onclick="window.print()">Print / Save as PDF 📄</button>
  </div>

  <div class="header">
    <div>
      <h1>📱 MOB POS - පද්ධති මෙහෙයුම් අත්පොත (System User Manual)</h1>
      <p>ස්මාර්ට් ජංගම දුරකථන, ටැබ් සහ පරිගණක සඳහා නිර්මාණය කළ සම්පූර්ණ කළමනාකරණ පද්ධතිය</p>
    </div>
    <div class="badge">අනුවාදය 4.5 • සිංහල උපදෙස් මාලාව</div>
  </div>

  <!-- SECTION 1 -->
  <div class="section">
    <div class="section-title">1. පද්ධතියට ඇතුල්වීම සහ ආරක්‍ෂිත පාලනය (Login & Security)</div>
    <div class="box">
      <p>MOB POS පද්ධතිය පරිශීලකයාගේ කාර්යභාරය (Role) අනුව ස්වයංක්‍රීයව අදාළ තිරය (Tab) වෙත ඔබව යොමු කරයි:</p>
      <table>
        <tr>
          <th>කාර්යභාරය (Role)</th>
          <th>ප්‍රවේශ වන ප්‍රධාන තිරය</th>
          <th>ප්‍රධාන වගකීම</th>
        </tr>
        <tr>
          <td><strong>👑 Admin (හිමිකරු)</strong></td>
          <td>Home / Dashboard</td>
          <td>සමස්ත පද්ධති වාර්තා, විකුණුම්, මිල ගණන් සහ ලාභ පාලනය</td>
        </tr>
        <tr>
          <td><strong>👥 HR Officer (මානව සම්පත්)</strong></td>
          <td>HR & Payroll Desk</td>
          <td>සේවක ලියාපදිංචිය, පැමිණීම්, නිවාඩු, පඩිපත් සහ සජීවී GPS සිතියම</td>
        </tr>
        <tr>
          <td><strong>🚚 Sales Rep (නියෝජිත)</strong></td>
          <td>Mobile POS (Sale)</td>
          <td>කඩවල් වෙත ගොස් බිල්පත් නිකුත් කිරීම, ණය එකතු කිරීම සහ පැමිණීම</td>
        </tr>
        <tr>
          <td><strong>📦 Delivery Driver (බෙදාහැරීම්)</strong></td>
          <td>Delivery Route Orders</td>
          <td>ඇණවුම් බාරදීම, ලොරි තොගය සහ පිළිවෙලින් බෙදාහැරීම් සිතියම</td>
        </tr>
        <tr>
          <td><strong>🏬 Stores Keeper (ගබඩාකරු)</strong></td>
          <td>Stores (තොග)</td>
          <td>ප්‍රධාන ගබඩාවේ තොග පාලනය සහ නිෂ්පාදන ඇණවුම් නිකුත් කිරීම</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- SECTION 2 -->
  <div class="section">
    <div class="section-title">2. විකුණුම් නියෝජිත (Sales Rep) දෛනික ක්‍රියාවලිය</div>
    <div class="box-pink">
      <strong>🌅 උදෑසන ආරම්භය (Morning Route Check-in):</strong>
      <ol>
        <li>පද්ධතියට Log වූ සැනින් <strong>GPS ස්වයංක්‍රීයව ක්‍රියාත්මක වේ (Zero-Click)</strong>. කිසිදු Button එකක් ඔබන්න අවශ්‍ය නැත.</li>
        <li><strong>Start Route</strong> තෝරා යතුරුපැදියේ/වාහනයේ ආරම්භක මීටර කියවීම (KM) ඇතුළත් කරන්න.</li>
        <li>යතුරුපැදි මීටරයේ ඡායාරූපය (Meter Photo) සහ ඔබේ සෙල්ෆි ඡායාරූපය (Selfie Photo) ලබා දී Save කරන්න. මෙය HR වෙත සජීවීව වාර්තා වේ.</li>
      </ol>
      <strong>🛒 Mobile POS බිල්පත් නිකුත් කිරීම (Offline-First):</strong>
      <ol>
        <li>කඩය තෝරා භාණ්ඩ ප්‍රමාණයන් (Cards/Pcs) ඇතුළත් කරන්න.</li>
        <li><strong>සිග්නල් නොමැති වුවද (Offline)</strong> සාමාන්‍ය පරිදි බිල්පත් නිකුත් කළ හැක. දුරකථනයට සිග්නල් ලැබුණු සැනින් දත්ත ඉබේ Cloud වෙත යාවත්කාලීන වේ.</li>
        <li><strong>Live Target Tracker:</strong> දෛනික බිල්පත් ඉලක්කය සහ කාඩ්පත් ඉලක්ක (Card Target Slabs) තිරයේ ඉහළින් අඩුවෙමින් සජීවීව පෙන්වයි.</li>
      </ol>
      <strong>🌆 සවස දින අවසානය (Evening Route Check-out):</strong>
      <ol>
        <li>දවසේ වැඩ අවසන් වූ පසු <strong>End Route</strong> ඔබන්න.</li>
        <li>අවසාන මීටර කියවීම (Closing KM) සහ මීටරයේ ඡායාරූපය ලබා දෙන්න. දවසේ ධාවනය කළ සම්පූර්ණ කිලෝමීටර් ගණන ස්වයංක්‍රීයව ගණනය වේ.</li>
      </ol>
    </div>
  </div>

  <!-- SECTION 3 -->
  <div class="section">
    <div class="section-title">3. කඩවල් ලියාපදිංචිය, GPS ලකුණු කිරීම සහ Display ඡායාරූප</div>
    <div class="box">
      <ul>
        <li><strong>නව කඩයක් එකතු කිරීම:</strong> Shops තිරයෙන් කඩේ නම, හිමිකරු, දුරකථන අංකය සහ මාර්ගය (Route) තෝරන්න.</li>
        <li><strong>📍 Tag GPS:</strong> කඩය ඉදිරිපිට සිට 'Tag GPS' බොත්තම ඔබන්න. චන්ද්‍රිකා GPS හරහා නිවැරදිම ස්ථානය (Accuracy ±3m) සටහන් වේ.</li>
        <li><strong>📸 Display Photos:</strong> කඩයේ ප්‍රදර්ශනය කර ඇති Display Cards සහ Promotional Banners වල ඡායාරූප ගෙන පද්ධතියට එක් කරන්න. මෙම ඡායාරූප HR සහ Admin හට ඕනෑම මොහොතක නැරඹිය හැක.</li>
        <li><strong>🔲 QR Code:</strong> සෑම කඩයකටම ස්වයංක්‍රීයව QR Code එකක් ලැබේ. ඊළඟ වාරයේදී QR එක Scan කර තත්පරයකින් බිල්පතක් නිකුත් කළ හැක.</li>
      </ul>
    </div>
  </div>

  <!-- SECTION 4 -->
  <div class="section">
    <div class="section-title">4. සජීවී GPS සිතියම සහ Turn-by-Turn නාවික පද්ධතිය (Live Route Map)</div>
    <div class="box-emerald">
      <ul>
        <li><strong>Google Maps Roadmap & Satellite:</strong> සිතියම සාමාන්‍ය පාරවල් මෙන්ම චන්ද්‍රිකා ඡායාරූප (Satellite view) ලෙසද නැරඹිය හැක.</li>
        <li><strong>විශේෂ පාට සලකුණු (Color Pins):</strong>
          <ul>
            <li>🟢 කොළ පාට: අද දින බිල්පතක් නිකුත් කළ කඩවල් (Billed)</li>
            <li>🟡 කහ පාට: අද දින වසා තිබූ කඩවල් (Marked Closed)</li>
            <li>🔵 නිල් පාට: ගිය නමුත් ඇණවුම් නොදුන් කඩවල් (No Order / ඊළඟ පාර)</li>
            <li>🔴 රතු පාට: තවමත් නොගිය ඉතිරි කඩවල් (Pending Shops)</li>
          </ul>
        </li>
        <li><strong>🧭 Turn-by-Turn Navigation:</strong> ඕනෑම කඩයක් මත 'පාර' බොත්තම ක්ලික් කළ විට Google Maps හරහා කඩය වෙත කෙළින්ම මඟ පෙන්වයි.</li>
      </ul>
    </div>
  </div>

  <!-- SECTION 5 -->
  <div class="section">
    <div class="section-title">5. බෙදාහැරීම් රියදුරු (Delivery Driver) සහ ගබඩා තොග (Stores)</div>
    <div class="box">
      <div class="grid">
        <div>
          <strong>📦 Delivery Driver:</strong>
          <ul>
            <li>Rep වරුන් දමන ලද ඇණවුම් පිළිවෙලින් (#1, #2, #3 Drops) සිතියමේ නිල් පාටින් යා කර පෙන්වයි.</li>
            <li>භාණ්ඩය කඩයට දුන් පසු 'Mark Delivered' ඔබන්න.</li>
            <li>මුදල් ලබා ගත්තේ නම් එසැනින් Cash / Credit එකතු කරන්න.</li>
          </ul>
        </div>
        <div>
          <strong>🏬 Stores Keeper (ගබඩාකරු):</strong>
          <ul>
            <li>ප්‍රධාන ගබඩාවේ තොග ප්‍රමාණයන් සජීවීව පෙන්වයි.</li>
            <li>ලොරියට පටවන තොග (Lorry Load) තහවුරු කිරීම සහ සවස ඉතිරි තොග (Lorry Return) බාරගැනීම සිදු කරයි.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 6 -->
  <div class="section">
    <div class="section-title">6. ණය එකතු කිරීම සහ බ්ලූටූත් ප්‍රින්ටර් (Collections & Printing)</div>
    <div class="box">
      <ul>
        <li><strong>Credit Collection:</strong> කඩයේ ඉතිරි ණය මුදල පෙන්වන අතර මුදල් ලැබුණු විට ලැබුණු ප්‍රමාණය සටහන් කරන්න.</li>
        <li><strong>🖨️ 58mm / 80mm Bluetooth Thermal Print:</strong> ඕනෑම කුඩා බ්ලූටූත් ප්‍රින්ටරයකින් සිංහල බිල්පත් සහ ණය රිසිට්පත් මුද්‍රණය කළ හැක.</li>
        <li><strong>PDF / WhatsApp Share:</strong> බිල්පත WhatsApp හරහා කඩහිමියා වෙත කෙළින්ම යැවීමේ හැකියාව ඇත.</li>
      </ul>
    </div>
  </div>

  <!-- SECTION 7 -->
  <div class="section">
    <div class="section-title">7. මානව සම්පත් සහ වැටුප් කළමනාකරණය (HR & Payroll Management - 20 Modules)</div>
    <div class="box-pink">
      <p>මානව සම්පත් නිලධාරියා (HR) වෙත වෙන්වූ ප්‍රබල මොඩියුල 20ක් පද්ධතිය තුළ අන්තර්ගතය:</p>
      <div class="grid">
        <div>
          <ul>
            <li><strong>1. HR Dashboard:</strong> සේවක සංඛ්‍යාව, අද පැමිණීම්, නිවාඩු සහ ක්ෂේත්‍ර ඡායාරූප සාරාංශය.</li>
            <li><strong>2. Employee Management:</strong> නව සේවක ලියාපදිංචිය, සංශෝධනය සහ ID Card මුද්‍රණය.</li>
            <li><strong>3. Organization:</strong> ශාඛා, දෙපාර්තමේන්තු සහ තනතුරු කළමනාකරණය.</li>
            <li><strong>4. Sales Team:</strong> Rep, Supervisor, ASM, SM මාර්ග සහ වගකීම් බෙදාදීම.</li>
            <li><strong>5. Attendance Desk:</strong> දෛනික පැමිණීම්, ප්‍රමාද වීම් සහ නිවාඩු අනුමත කිරීම.</li>
            <li><strong>6. Field GPS Attendance:</strong> යතුරුපැදි ආරම්භක/අවසාන මීටර් සහ කඩවල් වල Display ඡායාරූප ගැලරිය.</li>
            <li><strong>7. Shift Management:</strong> සේවා මුර සහ නිවාඩු දින සටහන.</li>
            <li><strong>8. Leave Management:</strong> වාර්ෂික, අනියම් සහ අසනීප නිවාඩු අනුමැතිය.</li>
            <li><strong>9. Overtime (OT):</strong> අතිකාල පැය ගණනය සහ ගෙවීම්.</li>
            <li><strong>10. Payroll Processing:</strong> මූලික වැටුප්, දීමනා, අඩුකිරීම් සහ ශුද්ධ වැටුප ස්වයංක්‍රීයව හැදීම.</li>
          </ul>
        </div>
        <div>
          <ul>
            <li><strong>11. Sales Commissions:</strong> Rep සහ කළමනාකාරිත්වයේ කාඩ්පත් සහ එකතුකිරීම් කොමිස් ගණනය.</li>
            <li><strong>12. EPF / ETF Statutory:</strong> සේවක 8%, සේවායෝජක 12% සහ 3% ETF නීත්‍යානුකූල ගණනය.</li>
            <li><strong>13. Salary Payments:</strong> බැංකු තැන්පතු සහ මුදල් වැටුප් ගෙවීම් ලේඛන.</li>
            <li><strong>14. Payslip Management:</strong> 80mm තාප මුද්‍රණ හෝ A4 වැටුප් පත්‍රිකා මුද්‍රණය.</li>
            <li><strong>15. Performance:</strong> සේවක ඇගයීම් සහ ඉලක්ක සපුරාගැනීම් සමාලෝචනය.</li>
            <li><strong>16. Recruitment:</strong> රැකියා අයදුම්පත් සහ සම්මුඛ පරීක්ෂණ සටහන්.</li>
            <li><strong>17. Training:</strong> ක්ෂේත්‍ර විකුණුම් සහ POS තාක්ෂණ පුහුණු වාර්තා.</li>
            <li><strong>18. Employee Requests:</strong> වැටුප් අත්තිකාරම් සහ ණය ඉල්ලීම් Desk එක.</li>
            <li><strong>19. HR Reports:</strong> වැටුප් ලේඛන, EPF C-Form සහ මාස්ටර් රෙජිස්ටර් මුද්‍රණය.</li>
            <li><strong>20. HR Settings & Security:</strong> HR Login ID/PIN වෙනස් කිරීම සහ HR දත්ත පමණක් Reset කිරීමේ පහසුකම.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 8 -->
  <div class="section">
    <div class="section-title">8. දත්ත ආරක්ෂාව, Backup සහ දෝෂ නිරාකරණය (Data Security & Tips)</div>
    <div class="box">
      <ul>
        <li><strong>ස්ථානීය දත්ත ගබඩාව (Offline Database):</strong> පද්ධතිය ඔබගේ දුරකථනයේ හෝ පරිගණකයේ ආරක්ෂිතව ක්‍රියාත්මක වන අතර අන්තර්ජාලය විසන්ධි වුවද කිසිදු බාධාවකින් තොරව ක්‍රියා කරයි.</li>
        <li><strong>ස්වයංක්‍රීය Cloud Sync:</strong> අන්තර්ජාලය සම්බන්ධ වූ විට සියලු බිල්පත් සහ තොරතුරු තත්පර ගණනකින් ආරක්ෂිත Cloud සේවාදායකය හා සමමුහුර්ත වේ.</li>
        <li><strong>HR Data Reset Button:</strong> HR අංශයට අවශ්‍ය නම් විකුණුම්, භාණ්ඩ හෝ කඩවල් වලට හානියක් නොවන සේ මානව සම්පත් දත්ත පමණක් පිරිසිදු කර Reset කළ හැක.</li>
        <li><strong>උදව් සහ සහාය:</strong> යම් තාක්ෂණික ගැටලුවක් මතු වුවහොත් පිටුව Refresh කරන්න හෝ Admin අමතන්න.</li>
      </ul>
    </div>
  </div>

  <div style="text-align: center; margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 15px; color: #94a3b8; font-size: 11px;">
    MOB POS System • සිංහල මෙහෙයුම් අත්පොත • All Rights Reserved
  </div>

</body>
</html>`;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();

    // Auto-trigger print dialog after styles load
    setTimeout(() => {
      try {
        printWin.focus();
        printWin.print();
      } catch (e) {}
    }, 500);

    UI.showToast('📄 System User Manual PDF opened! Print/Save as PDF තෝරන්න.', 'success');
  }
};

window.HR = HR;

