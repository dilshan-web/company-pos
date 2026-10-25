/**
 * Software Company Control Module (SaaS Master Controller / Super Admin Portal)
 * 
 * Allows the Software Provider / Super Master Admin (PIN: 9999) to:
 * 1. Create and manage multiple Client Companies & Business Admins
 * 2. View and track live Admin PINs/passwords even when changed
 * 3. Set subscription payment validity dates (Valid From - Valid To)
 * 4. Automatic date-based expiration with interactive ON/OFF switch
 * 5. Block expired accounts with customized payment due lockout screen
 * 6. Directly inspect any client company's live dashboard and data
 */

const CompanyControl = {
  currentEditTenantId: null,
  activeInspectTenantId: null,
  activeSearch: '',

  async init() {
    await this.loadSaaSSettingsFromCloud();
    await this.autoCheckAllSubscriptions();
    await this.loadTenants();
  },

  // 1. Auto-check and synchronize expiration for all tenants (Auto turns OFF when date reaches 0 / expired)
  async autoCheckAllSubscriptions() {
    if (!db.tenants) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const allTenants = await db.tenants.toArray();

      for (const tenant of allTenants) {
        // Protect tenant 1 & admin from accidental lockouts
        if (!tenant.validTo || tenant.validTo < '2030-01-01' || tenant.id === 1 || tenant.adminUsername === 'admin') {
          await db.tenants.update(tenant.id, {
            validTo: '2099-12-31',
            isActive: true,
            status: 'active',
            updatedAt: new Date().toISOString()
          });
          continue;
        }

        let diffDays = 999;
        if (tenant.validTo) {
          const diffMs = new Date(tenant.validTo) - new Date(todayStr);
          diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }

        const isPastDue = Boolean(tenant.validTo && todayStr > tenant.validTo && diffDays < 0);

        if (isPastDue) {
          // When expired (date reached 0 or passed), automatically set isActive: false (OFF) and status: 'expired'
          if (tenant.isActive !== false || tenant.status !== 'expired') {
            await db.tenants.update(tenant.id, {
              isActive: false,
              status: 'expired',
              updatedAt: new Date().toISOString()
            });

            // Also deactivate matching admin user in db.users
            if (db.users && tenant.adminUsername) {
              const matchedUsers = await db.users.where('username').equals(tenant.adminUsername).toArray();
              for (const u of matchedUsers) {
                await db.users.update(u.id, {
                  isActive: false,
                  updatedAt: new Date().toISOString()
                });
              }
            }
          }
        } else if (tenant.isActive === false) {
          if (tenant.status !== 'suspended') {
            await db.tenants.update(tenant.id, {
              status: 'suspended',
              updatedAt: new Date().toISOString()
            });
          }
        } else {
          if (tenant.status !== 'active') {
            await db.tenants.update(tenant.id, {
              status: 'active',
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {
      console.warn('Error auto-checking tenant subscriptions:', e);
    }
  },

  // 2. Load & Render All Admins / Companies in Super Admin Dashboard
  async loadTenants() {
    const listContainer = document.getElementById('superadmin-tenants-list');
    if (!listContainer) return;

    try {
      const allTenants = await db.tenants.toArray();
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const searchTerm = (this.activeSearch || '').toLowerCase().trim();

      const filtered = allTenants.filter(t => {
        if (!searchTerm) return true;
        return (t.companyName || '').toLowerCase().includes(searchTerm) ||
               (t.ownerName || '').toLowerCase().includes(searchTerm) ||
               (t.adminUsername || '').toLowerCase().includes(searchTerm) ||
               (t.phone || '').includes(searchTerm);
      });

      // Calculate Super Admin Master KPIs
      const totalCount = allTenants.length;
      const activeCount = allTenants.filter(t => t.isActive !== false && (!t.validTo || t.validTo >= todayStr)).length;
      const expiredCount = allTenants.filter(t => t.validTo && t.validTo < todayStr).length;
      const suspendedCount = allTenants.filter(t => t.isActive === false).length;

      const totalEl = document.getElementById('superadmin-kpi-total');
      const activeEl = document.getElementById('superadmin-kpi-active');
      const expiredEl = document.getElementById('superadmin-kpi-expired');
      const suspendedEl = document.getElementById('superadmin-kpi-suspended');

      if (totalEl) totalEl.textContent = totalCount;
      if (activeEl) activeEl.textContent = activeCount;
      if (expiredEl) expiredEl.textContent = expiredCount;
      if (suspendedEl) suspendedEl.textContent = suspendedCount;

      if (filtered.length === 0) {
        listContainer.innerHTML = `
          <div class="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-500 space-y-2">
            <span class="text-4xl block">🏢</span>
            <h4 class="font-black text-sm text-slate-800">No Client Companies Found</h4>
            <p class="text-xs text-slate-400">Click "+ Add Client Company" above to provision a new business admin.</p>
          </div>
        `;
        return;
      }

      const allSales = (typeof db !== 'undefined' && db.sales) ? await db.sales.toArray() : [];
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      let html = '<div class="space-y-3">';
      for (const tenant of filtered) {
        const isDateExpired = tenant.validTo && todayStr > tenant.validTo;
        const isEffectivelyActive = (tenant.isActive !== false) && !isDateExpired;

        // Calculate Day Sale, Day Profit & All-Time Performance for this tenant
        const tenantSales = allSales.filter(s => (s.tenantId || 1) === tenant.id && s.status !== 'Cancelled');
        const todaySales = tenantSales.filter(s => {
          const d = new Date(s.date);
          return d >= todayStart && d <= todayEnd;
        });
        const todayRevenue = todaySales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
        const todayCost = todaySales.reduce((sum, s) => sum + (Number(s.totalCost) || 0), 0);
        const todayProfit = todayRevenue - todayCost;
        const allTimeRevenue = tenantSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

        // Calculate days remaining or days overdue
        let daysText = '';
        let daysBadgeClass = '';
        if (tenant.validTo) {
          const diffMs = new Date(tenant.validTo) - new Date(todayStr);
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays >= 0) {
            daysText = `🟢 ${diffDays} Days Remaining`;
            daysBadgeClass = diffDays <= 7 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200';
          } else {
            daysText = `🔴 Expired ${Math.abs(diffDays)} Days Ago`;
            daysBadgeClass = 'bg-red-100 text-red-800 border-red-200';
          }
        }

        const statusBadge = isEffectivelyActive
          ? `<span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">● ACTIVE (ක්‍රියාකාරී)</span>`
          : (isDateExpired
              ? `<span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-red-100 text-red-700 border border-red-200">⚠️ EXPIRED (කල් ඉකුත් වී ඇත)</span>`
              : `<span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-slate-200 text-slate-700">⚪ SUSPENDED (අත්හිටුවා ඇත)</span>`);

        html += `
          <div class="bg-white rounded-3xl p-4 sm:p-5 border ${isEffectivelyActive ? 'border-slate-200' : 'border-red-200 bg-red-50/15'} shadow-md hover:shadow-lg transition-all space-y-3.5">
            <!-- Header Row: Company Name & Active Switch -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3 min-w-0">
                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br ${isEffectivelyActive ? 'from-emerald-500 to-teal-700' : 'from-red-500 to-rose-700'} text-white flex items-center justify-center text-xl font-black shadow-md flex-shrink-0">
                  🏢
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="font-black text-slate-900 text-sm sm:text-base truncate">${tenant.companyName || 'Spice Company'}</h4>
                    ${statusBadge}
                  </div>
                  <div class="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5 flex-wrap">
                    <span>👤 Owner: <strong class="text-slate-700">${tenant.ownerName || '-'}</strong></span>
                    ${tenant.phone ? `<span>📞 ${tenant.phone}</span>` : ''}
                  </div>
                </div>
              </div>

              <!-- Interactive ON / OFF Toggle Switch -->
              <div class="flex flex-col items-end gap-1 flex-shrink-0">
                <span class="text-[9px] uppercase font-black text-slate-400">System Access</span>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" onchange="CompanyControl.toggleTenantStatus(${tenant.id}, this.checked)" ${isEffectivelyActive ? 'checked' : ''} class="sr-only peer">
                  <div class="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
                <span class="text-[10px] font-black ${isEffectivelyActive ? 'text-emerald-700' : 'text-red-600'}">
                  ${isEffectivelyActive ? 'ON (සක්‍රියයි)' : 'OFF (අක්‍රියයි)'}
                </span>
              </div>
            </div>

            <!-- Financial Performance Card: Today's Sales & Net Profit -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-3 rounded-2xl border border-indigo-950 text-white shadow-inner">
              <div class="p-1">
                <span class="text-[9px] uppercase font-extrabold text-slate-400 block tracking-wider">Today's Sale (අද විකුණුම්)</span>
                <span class="text-xs sm:text-sm font-black text-emerald-400 font-mono block mt-0.5">Rs. ${todayRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div class="p-1">
                <span class="text-[9px] uppercase font-extrabold text-slate-400 block tracking-wider">Today's Profit (අද ලාභය)</span>
                <span class="text-xs sm:text-sm font-black text-teal-300 font-mono block mt-0.5">Rs. ${todayProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div class="p-1">
                <span class="text-[9px] uppercase font-extrabold text-slate-400 block tracking-wider">Today's Orders</span>
                <span class="text-xs sm:text-sm font-black text-amber-300 font-mono block mt-0.5">${todaySales.length} Bills</span>
              </div>
              <div class="p-1">
                <span class="text-[9px] uppercase font-extrabold text-slate-400 block tracking-wider">All-Time Revenue</span>
                <span class="text-xs sm:text-sm font-black text-indigo-300 font-mono block mt-0.5">Rs. ${allTimeRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
            </div>

            <!-- Credentials & Subscription Dates Row -->
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
              <!-- Admin Login & Live PIN -->
              <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span class="text-[9px] uppercase font-bold text-slate-400 block">Admin Login</span>
                  <span class="font-black text-slate-800">@${tenant.adminUsername}</span>
                </div>
                <div class="text-right">
                  <span class="text-[9px] uppercase font-bold text-slate-400 block">Live PIN</span>
                  <span class="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 tracking-wider">
                    🔑 ${tenant.adminPin || '1234'}
                  </span>
                </div>
              </div>

              <!-- Validity Date Range -->
              <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-center">
                <span class="text-[9px] uppercase font-bold text-slate-400 block">Payment Valid Dates</span>
                <span class="font-black text-slate-800 text-[11px] mt-0.5 whitespace-nowrap">
                  📅 ${tenant.validFrom || 'Start'} ➔ ${tenant.validTo || 'End'}
                </span>
              </div>

              <!-- Days Left Badge -->
              <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between col-span-1 sm:col-span-2 md:col-span-1">
                <div>
                  <span class="text-[9px] uppercase font-bold text-slate-400 block">Subscription Status</span>
                  <span class="text-[11px] font-black px-2 py-0.5 rounded-lg border ${daysBadgeClass} inline-block mt-0.5">
                    ${daysText}
                  </span>
                </div>
                <button onclick="CompanyControl.openExtendModal(${tenant.id})" class="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-[10px] font-black shadow-xs active:scale-95">
                  📅 Renew
                </button>
              </div>
            </div>

            <!-- Action Controls Bar -->
            <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 flex-wrap">
              <div class="flex items-center gap-1.5">
                <button onclick="CompanyControl.inspectTenantDashboard(${tenant.id})" class="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black rounded-xl shadow-md active:scale-95 flex items-center gap-1.5 transition-all">
                  <span>📊 Inspect Dashboard (ඩෑෂ්බෝර්ඩ් බලන්න)</span>
                </button>
                <button onclick="CompanyControl.openExtendModal(${tenant.id})" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl active:scale-95 flex items-center gap-1">
                  <span>📅 Extend Validity</span>
                </button>
              </div>

              <div class="flex items-center gap-1.5">
                <button onclick="CompanyControl.openEditTenantModal(${tenant.id})" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl active:scale-95">
                  ✏️ Edit
                </button>
                <button onclick="CompanyControl.deleteTenant(${tenant.id})" class="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl active:scale-95">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        `;
      }
      html += '</div>';

      listContainer.innerHTML = html;
    } catch (e) {
      console.error('Error loading tenants in CompanyControl:', e);
      listContainer.innerHTML = `<div class="p-4 text-xs text-red-500">Error loading companies: ${e.message}</div>`;
    }
  },

  onSearch(term) {
    this.activeSearch = term;
    this.loadTenants();
  },

  // 3. Toggle Tenant Access ON / OFF
  async toggleTenantStatus(tenantId, isChecked) {
    try {
      const tenant = await db.tenants.get(Number(tenantId));
      if (!tenant) return;

      const todayStr = new Date().toISOString().split('T')[0];
      let diffDays = 999;
      if (tenant.validTo) {
        const diffMs = new Date(tenant.validTo) - new Date(todayStr);
        diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }
      const isPastDue = Boolean(tenant.validTo && (todayStr > tenant.validTo || diffDays <= 0));

      if (isChecked && isPastDue) {
        UI.showToast(`මෙම ගිණුමේ කාලය ඉකුත් වී ඇත (${tenant.validTo || '0 days'}). කරුණාකර පළමුව 'Renew' මඟින් දිනය අලුත් කරන්න!`, 'warning');
        CompanyControl.openExtendModal(tenant.id);
        await this.loadTenants();
        return;
      }

      const newIsActive = isChecked;
      let newStatus = newIsActive ? 'active' : 'suspended';

      await db.tenants.update(Number(tenantId), {
        isActive: newIsActive,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      // Also update linked users in db.users for this tenant
      if (db.users && tenant.adminUsername) {
        const matchedUsers = await db.users.where('username').equals(tenant.adminUsername).toArray();
        for (const u of matchedUsers) {
          await db.users.update(u.id, {
            isActive: newIsActive,
            updatedAt: new Date().toISOString()
          });
        }
      }

      UI.showToast(`Company "${tenant.companyName}" is now ${newIsActive ? '🟢 ACTIVATED (ON)' : '🔴 DEACTIVATED (OFF)'}!`, newIsActive ? 'success' : 'warning');
      await this.loadTenants();
    } catch (e) {
      console.error('Error toggling tenant status:', e);
      UI.showToast(`Error: ${e.message}`, 'error');
    }
  },

  // 4. Open Add Client Company / Admin Modal
  openAddTenantModal() {
    this.currentEditTenantId = null;
    document.getElementById('tenant-modal-title').textContent = '➕ Provision New Business Admin & Company';
    document.getElementById('tenant-form-id').value = '';
    document.getElementById('tenant-form-company-name').value = '';
    document.getElementById('tenant-form-owner-name').value = '';
    document.getElementById('tenant-form-username').value = '';
    document.getElementById('tenant-form-pin').value = '';
    document.getElementById('tenant-form-phone').value = '';

    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(now.getMonth() + 1);

    document.getElementById('tenant-form-valid-from').value = now.toISOString().split('T')[0];
    document.getElementById('tenant-form-valid-to').value = nextMonth.toISOString().split('T')[0];
    document.getElementById('tenant-form-active').checked = true;

    UI.openModal('modal-add-tenant');
  },

  // 5. Open Edit Tenant Modal
  async openEditTenantModal(tenantId) {
    this.currentEditTenantId = Number(tenantId);
    const tenant = await db.tenants.get(this.currentEditTenantId);
    if (!tenant) return;

    document.getElementById('tenant-modal-title').textContent = '✏️ Edit Company Details & PIN';
    document.getElementById('tenant-form-id').value = tenant.id;
    document.getElementById('tenant-form-company-name').value = tenant.companyName || '';
    document.getElementById('tenant-form-owner-name').value = tenant.ownerName || '';
    document.getElementById('tenant-form-username').value = tenant.adminUsername || '';
    document.getElementById('tenant-form-pin').value = tenant.adminPin || '';
    document.getElementById('tenant-form-phone').value = tenant.phone || '';
    document.getElementById('tenant-form-valid-from').value = tenant.validFrom || '';
    document.getElementById('tenant-form-valid-to').value = tenant.validTo || '';
    document.getElementById('tenant-form-active').checked = tenant.isActive !== false;

    UI.openModal('modal-add-tenant');
  },

  // 6. Save New / Updated Tenant
  async saveTenantForm(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const companyName = document.getElementById('tenant-form-company-name')?.value?.trim();
    const ownerName = document.getElementById('tenant-form-owner-name')?.value?.trim();
    const username = document.getElementById('tenant-form-username')?.value?.trim()?.toLowerCase();
    const pin = document.getElementById('tenant-form-pin')?.value?.trim();
    const phone = document.getElementById('tenant-form-phone')?.value?.trim() || '';
    const validFrom = document.getElementById('tenant-form-valid-from')?.value;
    const validTo = document.getElementById('tenant-form-valid-to')?.value;
    const isActive = document.getElementById('tenant-form-active')?.checked !== false;

    if (!companyName || !username || !pin || !validFrom || !validTo) {
      UI.showToast('Please fill in Company Name, Admin Username, PIN, and Validity Dates.', 'warning');
      return;
    }

    if (pin.length < 4) {
      UI.showToast('PIN must be at least 4 digits.', 'warning');
      return;
    }

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const isPastDue = todayStr > validTo;
      const status = isActive ? (isPastDue ? 'expired' : 'active') : 'suspended';

      if (this.currentEditTenantId) {
        // Update Existing
        await db.tenants.update(this.currentEditTenantId, {
          companyName,
          ownerName,
          adminUsername: username,
          adminPin: pin,
          phone,
          validFrom,
          validTo,
          isActive,
          status,
          updatedAt: new Date().toISOString()
        });

        // Sync with db.users and db.company for this tenant
        const user = await db.users.where('username').equals(username).first();
        if (user) {
          await db.users.update(user.id, {
            fullName: `${ownerName} (${companyName})`,
            pin: pin,
            phone: phone,
            isActive: isActive,
            updatedAt: new Date().toISOString()
          });
        }

        const comp = await db.company.where('tenantId').equals(this.currentEditTenantId).first();
        if (comp) {
          await db.company.update(comp.id, {
            name: companyName,
            phone: phone,
            pin: pin
          });
        }

        UI.showToast('Company details updated successfully!', 'success');
      } else {
        // Uniqueness check
        const existingTenant = await db.tenants.where('adminUsername').equals(username).first();
        if (existingTenant) {
          UI.showToast(`Username '@${username}' is already in use by another admin.`, 'warning');
          return;
        }

        // Add to db.tenants
        const newTenantId = await db.tenants.add({
          companyName,
          ownerName,
          adminUsername: username,
          adminPin: pin,
          phone,
          validFrom,
          validTo,
          isActive,
          status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Also add Admin user record in db.users with tenantId
        const existingUser = await db.users.where('username').equals(username).first();
        if (!existingUser) {
          await db.users.add({
            tenantId: newTenantId,
            username,
            fullName: `${ownerName} (${companyName})`,
            role: 'admin',
            pin,
            phone,
            assignedRouteId: null,
            isActive,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        // Seed initial Company profile for the new tenant
        await db.company.add({
          tenantId: newTenantId,
          name: companyName,
          tagline: 'Quality Products & Wholesale Distribution',
          phone: phone,
          address: '',
          receiptHeader: `Welcome to ${companyName}!`,
          receiptFooter: 'Thank you for your business!',
          pin: pin
        });

        // Seed default delivery route for the new tenant
        await db.routes.add({
          tenantId: newTenantId,
          name: 'Main Route 01',
          description: 'Primary delivery distribution route',
          isActive: true
        });

        UI.showToast('🎉 New Company & Admin provisioned successfully!', 'success');
      }

      UI.closeModal('modal-add-tenant');
      await this.loadTenants();
    } catch (e) {
      console.error('Error saving tenant:', e);
      UI.showToast(`Error: ${e.message}`, 'error');
    }
  },

  // 7. Open Extend / Renew Validity Modal
  async openExtendModal(tenantId) {
    const tenant = await db.tenants.get(Number(tenantId));
    if (!tenant) return;

    document.getElementById('extend-modal-tenant-id').value = tenant.id;
    document.getElementById('extend-modal-company-name').textContent = tenant.companyName;
    document.getElementById('extend-modal-current-to').textContent = tenant.validTo || 'N/A';
    document.getElementById('extend-modal-new-to').value = tenant.validTo || new Date().toISOString().split('T')[0];

    UI.openModal('modal-extend-tenant');
  },

  // Helper preset extension buttons (+1 Month, +3 Months, +1 Year)
  addExtensionMonths(months) {
    const input = document.getElementById('extend-modal-new-to');
    if (!input) return;

    let baseDate = new Date();
    if (input.value && new Date(input.value) > baseDate) {
      baseDate = new Date(input.value);
    }
    baseDate.setMonth(baseDate.getMonth() + months);
    input.value = baseDate.toISOString().split('T')[0];
  },

  // Save Extended Validity
  async saveExtension() {
    const tenantId = Number(document.getElementById('extend-modal-tenant-id')?.value);
    const newValidTo = document.getElementById('extend-modal-new-to')?.value;

    if (!tenantId || !newValidTo) {
      UI.showToast('Please select a valid expiry date.', 'warning');
      return;
    }

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const diffMs = new Date(newValidTo) - new Date(todayStr);
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const isPastDue = todayStr > newValidTo || diffDays <= 0;
      const status = isPastDue ? 'expired' : 'active';
      const isActive = !isPastDue;

      await db.tenants.update(tenantId, {
        validTo: newValidTo,
        isActive: isActive,
        status: status,
        updatedAt: new Date().toISOString()
      });

      const tenant = await db.tenants.get(tenantId);
      if (tenant && db.users && tenant.adminUsername) {
        const matchedUsers = await db.users.where('username').equals(tenant.adminUsername).toArray();
        for (const u of matchedUsers) {
          await db.users.update(u.id, { isActive: isActive, updatedAt: new Date().toISOString() });
        }
      }

      UI.closeModal('modal-extend-tenant');
      UI.showToast(`✅ Subscription renewed until ${newValidTo}! ${isActive ? 'Company is now ON 🟢' : 'Company is OFF 🔴'}`, 'success');
      await this.loadTenants();
    } catch (e) {
      console.error('Error saving subscription extension:', e);
      UI.showToast(`Error: ${e.message}`, 'error');
    }
  },

  // 8. Super Admin Inspects Client Dashboard
  async inspectTenantDashboard(tenantId) {
    try {
      const tenant = await db.tenants.get(Number(tenantId));
      if (!tenant) return;

      this.activeInspectTenantId = Number(tenantId);

      // Show persistent top inspection banner
      const banner = document.getElementById('superadmin-inspection-banner');
      const bannerTitle = document.getElementById('inspection-banner-company-title');
      if (banner && bannerTitle) {
        bannerTitle.textContent = `${tenant.companyName} (Admin: ${tenant.ownerName || tenant.adminUsername})`;
        banner.classList.remove('hidden');
      }

      // Switch to standard dashboard view and load that company's isolated metrics
      UI.switchTab('dashboard');
      if (typeof Dashboard !== 'undefined') {
        await Dashboard.loadDashboard();
      }
      UI.showToast(`👁️ Now inspecting dashboard for "${tenant.companyName}"`, 'info');
    } catch (e) {
      console.error('Error inspecting tenant dashboard:', e);
    }
  },

  // Exit Inspection and return to Super Admin Dashboard
  async exitInspection() {
    this.activeInspectTenantId = null;
    const banner = document.getElementById('superadmin-inspection-banner');
    if (banner) banner.classList.add('hidden');

    UI.switchTab('superadmin');
    await this.loadTenants();
    UI.showToast('Returned to Software Company Control Dashboard', 'info');
  },

  // 9. Delete Tenant
  async deleteTenant(tenantId) {
    const tenant = await db.tenants.get(Number(tenantId));
    if (!tenant) return;

    if (!confirm(`Are you sure you want to delete company "${tenant.companyName}" (@${tenant.adminUsername})?`)) {
      return;
    }

    try {
      if (this.activeInspectTenantId === Number(tenantId)) {
        this.activeInspectTenantId = null;
      }
      await db.tenants.delete(Number(tenantId));
      UI.showToast(`Company "${tenant.companyName}" removed.`, 'info');
      await this.loadTenants();
    } catch (e) {
      console.error('Error deleting tenant:', e);
      UI.showToast(`Error: ${e.message}`, 'error');
    }
  },

  // 10. SaaS Master Controller Settings (Support Numbers, Branding, Bank Details, Custom Long PIN)
  async loadSaaSSettingsFromCloud() {
    if (typeof db !== 'undefined' && db.systemSettings) {
      try {
        const cloudConf = await db.systemSettings.get('saas_config');
        if (cloudConf) {
          localStorage.setItem('spice_pos_saas_settings', JSON.stringify(cloudConf));
          if (cloudConf.superadminUsername) {
            localStorage.setItem('spice_pos_superadmin_username', cloudConf.superadminUsername);
          }
          if (cloudConf.superadminPin) {
            localStorage.setItem('spice_pos_superadmin_pin', cloudConf.superadminPin);
          }
          return cloudConf;
        }
      } catch (e) {
        console.warn('Error loading cloud SaaS settings:', e);
      }
    }
    return this.getSaaSSettings();
  },

  getSaaSSettings() {
    try {
      const stored = localStorage.getItem('spice_pos_saas_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        return Object.assign({
          providerName: 'Spice POS SaaS Master Controller',
          hotlineNumbers: '077 123 4567 / 071 987 6543',
          whatsappNumber: '077 123 4567',
          lockoutNoticeText: 'ඔබගේ මෘදුකාංග සේවා ගාස්තු ගෙවීමේ කාලය (Subscription Period) අවසන් වී ඇත. කරුණාකර පහත බැංකු ගිණුමට ගෙවීම් සිදුකර සේවාව දීර්ඝ කරගන්න.',
          bankName: 'Commercial Bank / BOC',
          accountNumber: '1234 5678 9012',
          accountName: 'Software Solutions',
          bankBranch: 'Main Branch',
          paymentNote: 'මුදල් තැන්පත් කර රිසිට්පත (Slip) WhatsApp කරන්න.'
        }, parsed);
      }
    } catch (e) {
      console.warn('Error reading SaaS settings:', e);
    }
    return {
      providerName: 'Spice POS SaaS Master Controller',
      hotlineNumbers: '077 123 4567 / 071 987 6543',
      whatsappNumber: '077 123 4567',
      lockoutNoticeText: 'ඔබගේ මෘදුකාංග සේවා ගාස්තු ගෙවීමේ කාලය (Subscription Period) අවසන් වී ඇත. කරුණාකර පහත බැංකු ගිණුමට ගෙවීම් සිදුකර සේවාව දීර්ඝ කරගන්න.',
      bankName: 'Commercial Bank / BOC',
      accountNumber: '1234 5678 9012',
      accountName: 'Software Solutions',
      bankBranch: 'Main Branch',
      paymentNote: 'මුදල් තැන්පත් කර රිසිට්පත (Slip) WhatsApp කරන්න.'
    };
  },

  async openSaaSSettingsModal() {
    await this.loadSaaSSettingsFromCloud();
    const conf = this.getSaaSSettings();
    const brandEl = document.getElementById('saas-sett-brand');
    const hotlineEl = document.getElementById('saas-sett-hotline');
    const whatsappEl = document.getElementById('saas-sett-whatsapp');
    const noticeEl = document.getElementById('saas-sett-notice');
    const bankNameEl = document.getElementById('saas-sett-bank-name');
    const bankAccEl = document.getElementById('saas-sett-bank-acc');
    const bankHolderEl = document.getElementById('saas-sett-bank-holder');
    const bankBranchEl = document.getElementById('saas-sett-bank-branch');
    const bankNoteEl = document.getElementById('saas-sett-bank-note');
    const usernameEl = document.getElementById('saas-sett-username');
    const curPinEl = document.getElementById('saas-sett-current-pin');
    const newPinEl = document.getElementById('saas-sett-new-pin');
    const confPinEl = document.getElementById('saas-sett-confirm-pin');

    if (brandEl) brandEl.value = conf.providerName || '';
    if (hotlineEl) hotlineEl.value = conf.hotlineNumbers || '';
    if (whatsappEl) whatsappEl.value = conf.whatsappNumber || '';
    if (noticeEl) noticeEl.value = conf.lockoutNoticeText || '';
    if (bankNameEl) bankNameEl.value = conf.bankName || '';
    if (bankAccEl) bankAccEl.value = conf.accountNumber || '';
    if (bankHolderEl) bankHolderEl.value = conf.accountName || '';
    if (bankBranchEl) bankBranchEl.value = conf.bankBranch || '';
    if (bankNoteEl) bankNoteEl.value = conf.paymentNote || '';
    if (usernameEl) usernameEl.value = Auth.getSuperAdminUsername ? Auth.getSuperAdminUsername() : 'superadmin';
    if (curPinEl) curPinEl.value = '';
    if (newPinEl) newPinEl.value = '';
    if (confPinEl) confPinEl.value = '';

    UI.openModal('modal-superadmin-settings');
  },

  async saveSaaSSettingsForm(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const brand = document.getElementById('saas-sett-brand')?.value?.trim() || 'Spice POS Master Controller';
    const hotline = document.getElementById('saas-sett-hotline')?.value?.trim() || '077 123 4567 / 071 987 6543';
    const whatsapp = document.getElementById('saas-sett-whatsapp')?.value?.trim() || '';
    const notice = document.getElementById('saas-sett-notice')?.value?.trim() || '';
    const bankName = document.getElementById('saas-sett-bank-name')?.value?.trim() || 'Commercial Bank / BOC';
    const bankAcc = document.getElementById('saas-sett-bank-acc')?.value?.trim() || '';
    const bankHolder = document.getElementById('saas-sett-bank-holder')?.value?.trim() || '';
    const bankBranch = document.getElementById('saas-sett-bank-branch')?.value?.trim() || '';
    const bankNote = document.getElementById('saas-sett-bank-note')?.value?.trim() || '';
    const newUsernameInput = document.getElementById('saas-sett-username')?.value?.trim()?.toLowerCase() || 'superadmin';

    const currentMasterPinInput = document.getElementById('saas-sett-current-pin')?.value?.trim();
    const newMasterPinInput = document.getElementById('saas-sett-new-pin')?.value?.trim();
    const confirmMasterPinInput = document.getElementById('saas-sett-confirm-pin')?.value?.trim();

    // Handle Master Username update
    if (newUsernameInput) {
      localStorage.setItem('spice_pos_superadmin_username', newUsernameInput);
    }

    // Handle Master Security PIN update if filled
    if (newMasterPinInput || currentMasterPinInput) {
      const actualMasterPin = Auth.getSuperAdminPin();
      if (currentMasterPinInput !== actualMasterPin) {
        UI.showToast('Current Super Master PIN is incorrect.', 'error');
        return;
      }
      if (newMasterPinInput.length < 4) {
        UI.showToast('New Master PIN must be at least 4 digits/characters.', 'warning');
        return;
      }
      if (newMasterPinInput !== confirmMasterPinInput) {
        UI.showToast('New Master PIN and Confirm PIN do not match.', 'warning');
        return;
      }

      localStorage.setItem('spice_pos_superadmin_pin', newMasterPinInput);
      UI.showToast('🔐 Super Master Controller PIN updated successfully!', 'success');
    }

    const activeMasterPin = newMasterPinInput || (typeof Auth !== 'undefined' ? Auth.getSuperAdminPin() : '0000');

    // Save SaaS Settings
    const newSettings = {
      providerName: brand,
      hotlineNumbers: hotline,
      whatsappNumber: whatsapp,
      lockoutNoticeText: notice,
      bankName: bankName,
      accountNumber: bankAcc,
      accountName: bankHolder,
      bankBranch: bankBranch,
      paymentNote: bankNote,
      superadminUsername: newUsernameInput,
      superadminPin: activeMasterPin,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('spice_pos_saas_settings', JSON.stringify(newSettings));

    // Save to Firestore Cloud for real-time synchronization across all devices
    if (typeof db !== 'undefined' && db.systemSettings) {
      try {
        await db.systemSettings.put(Object.assign({ id: 'saas_config' }, newSettings));
      } catch (cloudErr) {
        console.warn('Error saving SaaS settings to Firestore:', cloudErr);
      }
    }

    // Sync display elements in expired modal
    const hotlineDisplay = document.getElementById('subscription-expired-hotline');
    if (hotlineDisplay) hotlineDisplay.textContent = hotline;

    const bankNameDisplay = document.getElementById('subscription-expired-bank-name');
    if (bankNameDisplay) bankNameDisplay.textContent = bankName;

    const bankAccDisplay = document.getElementById('subscription-expired-bank-acc');
    if (bankAccDisplay) bankAccDisplay.textContent = bankAcc;

    const bankHolderDisplay = document.getElementById('subscription-expired-bank-holder');
    if (bankHolderDisplay) bankHolderDisplay.textContent = bankHolder;

    const bankBranchDisplay = document.getElementById('subscription-expired-bank-branch');
    if (bankBranchDisplay) bankBranchDisplay.textContent = bankBranch;

    const bankNoteDisplay = document.getElementById('subscription-expired-bank-note');
    if (bankNoteDisplay) bankNoteDisplay.textContent = bankNote;

    UI.closeModal('modal-superadmin-settings');
    UI.showToast('✅ Software Master Controller Settings saved successfully!', 'success');
  },

  // 1-Click Copy Bank Account Number
  copyBankAccountNumber() {
    const accEl = document.getElementById('subscription-expired-bank-acc');
    const text = accEl ? accEl.textContent.trim() : '';
    if (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          UI.showToast('📋 Account number copied to clipboard!', 'success');
        }).catch(() => {
          UI.showToast(`Account Number: ${text}`, 'info');
        });
      } else {
        UI.showToast(`Account Number: ${text}`, 'info');
      }
    }
  }
};

window.CompanyControl = CompanyControl;
