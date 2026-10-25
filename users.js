/**
 * User & Staff Management Module
 * Supports 8 Specialized Roles with Complete Hierarchy:
 * 1. Admin (👑 Master Owner - All Access, All Territories & Profit)
 * 2. SM (👔 Sales Manager - Dashboard, Reports, Top 10, No Profit)
 * 3. ASM (💼 Area Sales Manager - Manages assigned Supervisors & Reps)
 * 4. Supervisor (📋 Field Supervisor - Manages 3 to 5 assigned Reps)
 * 5. Rep (🚚 Sales Rep - Field Booking, Direct Sales, Returns, assigned territory only)
 * 6. Delivery (📦 Delivery Driver - Dispatch, Morning Lorry Load, Evening Lorry Unload, Collect)
 * 7. Stores (🏬 Production Stores Keeper - Live Packing Orders, Stock Intake, Lorry Return Audit)
 * 8. HR (👥 HR & Payroll Officer - Staff, Payroll, Attendance, Field Photos)
 */

const Users = {
  currentEditUserId: null,

  async init() {
    if (typeof ensureHrUserExists === 'function') {
      try { await ensureHrUserExists(); } catch (e) {}
    }
    this.bindEvents();
    await this.loadUsers();
  },

  bindEvents() {
    const roleSelect = document.getElementById('user-form-role');
    if (roleSelect && !roleSelect._boundHierarchy) {
      roleSelect._boundHierarchy = true;
      roleSelect.addEventListener('change', () => this.onRoleChanged());
    }
  },

  onRoleChanged() {
    const role = document.getElementById('user-form-role')?.value || 'rep';
    const repRoutesBox = document.getElementById('user-form-rep-routes-container');
    const supBox = document.getElementById('user-form-supervisor-container');
    const repsBox = document.getElementById('user-form-assigned-reps-container');
    const asmBox = document.getElementById('user-form-asm-team-container');

    // Hide all first
    if (repRoutesBox) repRoutesBox.classList.add('hidden');
    if (supBox) supBox.classList.add('hidden');
    if (repsBox) repsBox.classList.add('hidden');
    if (asmBox) asmBox.classList.add('hidden');

    if (role === 'rep') {
      if (repRoutesBox) repRoutesBox.classList.remove('hidden');
      if (supBox) supBox.classList.remove('hidden');
    } else if (role === 'supervisor') {
      if (repsBox) repsBox.classList.remove('hidden');
    } else if (role === 'asm') {
      if (asmBox) asmBox.classList.remove('hidden');
    } else if (role === 'delivery') {
      if (repRoutesBox) repRoutesBox.classList.remove('hidden');
    }
  },

  async loadUsers() {
    const listContainer = document.getElementById('users-list-container');
    if (!listContainer) return;

    try {
      if (typeof ensureHrUserExists === 'function') {
        try { await ensureHrUserExists(); } catch (e) {}
      }
      const rawUsers = await db.users.toArray();
      const users = filterByTenant(rawUsers);
      const rawRoutes = await db.routes.toArray();
      const routes = filterByTenant(rawRoutes);
      const routeMap = Object.fromEntries(routes.map(r => [r.id, r.name]));
      const userMap = Object.fromEntries(users.map(u => [u.id, u.fullName || u.username]));

      // Update Metric Counters
      const totalCount = users.length;
      const adminCount = users.filter(u => u.role === 'admin' && u.isActive !== false).length;
      const repCount = users.filter(u => u.role === 'rep' && u.isActive !== false).length;
      const deliveryCount = users.filter(u => u.role === 'delivery' && u.isActive !== false).length;

      const totalEl = document.getElementById('users-total-count');
      const adminEl = document.getElementById('users-admin-count');
      const repEl = document.getElementById('users-rep-count');
      const deliveryEl = document.getElementById('users-delivery-count');

      if (totalEl) totalEl.textContent = totalCount;
      if (adminEl) adminEl.textContent = adminCount;
      if (repEl) repEl.textContent = repCount;
      if (deliveryEl) deliveryEl.textContent = deliveryCount;

      if (users.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center py-10 bg-white rounded-3xl border border-slate-100 p-6">
            <div class="text-4xl mb-2">👥</div>
            <h3 class="font-black text-slate-700 text-sm">No Users Found</h3>
            <p class="text-xs text-slate-400 mt-1">Add your team members and sales staff below.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = users.map(user => {
        const role = user.role || 'rep';
        const roleConf = {
          'admin': {
            icon: '👑',
            badge: '<span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200">👑 Admin (Master Owner)</span>',
            iconBg: 'bg-purple-600 shadow-purple-600/30'
          },
          'sm': {
            icon: '👔',
            badge: '<span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-200">👔 Sales Manager (SM)</span>',
            iconBg: 'bg-blue-600 shadow-blue-600/30'
          },
          'asm': {
            icon: '💼',
            badge: '<span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-indigo-100 text-indigo-700 border border-indigo-200">💼 Area Sales Manager (ASM)</span>',
            iconBg: 'bg-indigo-600 shadow-indigo-600/30'
          },
          'supervisor': {
            icon: '📋',
            badge: '<span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">📋 Field Supervisor</span>',
            iconBg: 'bg-amber-600 shadow-amber-600/30'
          },
          'rep': {
            icon: '🚚',
            badge: '<span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">🚚 Sales Rep (Field POS)</span>',
            iconBg: 'bg-emerald-600 shadow-emerald-600/30'
          },
          'delivery': {
            icon: '📦',
            badge: '<span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-sky-100 text-sky-700 border border-sky-200">📦 Delivery Driver (බෙදාහැරීම්)</span>',
            iconBg: 'bg-sky-600 shadow-sky-600/30'
          },
          'stores': {
            icon: '🏬',
            badge: '<span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-teal-100 text-teal-700 border border-teal-200">🏬 Stores Keeper (තොග)</span>',
            iconBg: 'bg-teal-600 shadow-teal-600/30'
          },
          'hr': {
            icon: '👥',
            badge: '<span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-pink-100 text-pink-700 border border-pink-200">👥 HR & Payroll Officer</span>',
            iconBg: 'bg-pink-600 shadow-pink-600/30'
          }
        }[role] || {
          icon: '👤',
          badge: '<span class="px-2.5 py-1 rounded-xl text-[10px] font-black bg-slate-100 text-slate-700">User</span>',
          iconBg: 'bg-slate-600 shadow-slate-600/30'
        };

        // Format Territory Routes
        let routeNames = [];
        if (Array.isArray(user.assignedRouteIds) && user.assignedRouteIds.length > 0) {
          routeNames = user.assignedRouteIds.map(id => routeMap[id]).filter(Boolean);
        } else if (user.assignedRouteId && routeMap[user.assignedRouteId]) {
          routeNames = [routeMap[user.assignedRouteId]];
        }
        const routeText = routeNames.length > 0
          ? `📍 Route: <strong class="text-slate-800">${routeNames.join(', ')}</strong>`
          : `📍 Route: <span class="text-slate-400">All Routes</span>`;

        // Format Hierarchy Team Details
        let hierarchyBadge = '';
        if (role === 'rep' && user.supervisorId && userMap[user.supervisorId]) {
          hierarchyBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">📋 Supervisor: <strong>${userMap[user.supervisorId]}</strong></span>`;
        } else if (role === 'supervisor') {
          const repNames = Array.isArray(user.assignedRepIds)
            ? user.assignedRepIds.map(id => userMap[id]).filter(Boolean)
            : [];
          hierarchyBadge = repNames.length > 0
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">👥 Assigned Team (${repNames.length} Reps): ${repNames.join(', ')}</span>`
            : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500">No Reps Assigned</span>`;
        } else if (role === 'asm') {
          const supNames = Array.isArray(user.assignedSupervisorIds) ? user.assignedSupervisorIds.map(id => userMap[id]).filter(Boolean) : [];
          const repNames = Array.isArray(user.assignedRepIds) ? user.assignedRepIds.map(id => userMap[id]).filter(Boolean) : [];
          hierarchyBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-200">💼 Managed Team: ${supNames.length} Supervisors, ${repNames.length} Reps</span>`;
        }

        const statusBadge = user.isActive !== false
          ? `<span class="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active</span>`
          : `<span class="text-[10px] text-red-500 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-red-400"></span> Inactive</span>`;

        return `
          <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-start sm:items-center gap-3.5">
              <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-inner ${roleConf.iconBg}">
                ${roleConf.icon}
              </div>
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="font-black text-slate-900 text-sm sm:text-base">${user.fullName || user.username}</h4>
                  ${roleConf.badge}
                  ${statusBadge}
                </div>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                  <span>👤 @${user.username}</span>
                  <span>🔒 PIN: <strong class="text-slate-800 font-mono tracking-widest">${user.pin}</strong></span>
                  ${user.phone ? `<span>📞 ${user.phone}</span>` : ''}
                  ${role === 'rep' || role === 'delivery' ? `<span>${routeText}</span>` : ''}
                </div>
                ${hierarchyBadge ? `<div class="pt-0.5">${hierarchyBadge}</div>` : ''}
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-1.5 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end flex-wrap">
              ${role === 'rep' ? `
                <button onclick="Users.openTransferModal(${user.id})" class="px-3 py-2 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-black active:scale-95 transition-all flex items-center gap-1 border border-amber-200 shadow-xs">
                  🔄 Replace Rep
                </button>
              ` : ''}
              <button onclick="Users.openEditModal(${user.id})" class="px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold active:scale-95 transition-all flex items-center gap-1">
                ✏️ Edit
              </button>
              <button onclick="Users.deleteUser(${user.id})" class="px-3.5 py-2 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold active:scale-95 transition-all flex items-center gap-1">
                🗑️ Delete
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error loading users:', err);
      UI.showToast('Failed to load users: ' + err.message, 'error');
    }
  },

  async openAddModal() {
    this.currentEditUserId = null;
    document.getElementById('user-modal-title').textContent = '➕ Add New User';
    document.getElementById('user-form-id').value = '';
    document.getElementById('user-form-fullname').value = '';
    document.getElementById('user-form-username').value = '';
    document.getElementById('user-form-pin').value = '';
    document.getElementById('user-form-phone').value = '';
    document.getElementById('user-form-role').value = 'rep';
    document.getElementById('user-form-active').checked = true;

    await this.populateHierarchyControls();
    this.onRoleChanged();
    UI.openModal('modal-user-form');
  },

  async openEditModal(id) {
    this.currentEditUserId = id;
    const user = await db.users.get(id);
    if (!user) return;

    document.getElementById('user-modal-title').textContent = '✏️ Edit User Details';
    document.getElementById('user-form-id').value = user.id;
    document.getElementById('user-form-fullname').value = user.fullName || '';
    document.getElementById('user-form-username').value = user.username || '';
    document.getElementById('user-form-pin').value = user.pin || '';
    document.getElementById('user-form-phone').value = user.phone || '';
    document.getElementById('user-form-role').value = user.role || 'rep';
    document.getElementById('user-form-active').checked = user.isActive !== false;

    await this.populateHierarchyControls(user);
    this.onRoleChanged();
    UI.openModal('modal-user-form');
  },

  /**
   * Populates Route dropdowns, Supervisor selection, and Rep checkboxes
   */
  async populateHierarchyControls(currentUser = null) {
    const rawRoutes = await db.routes.toArray();
    const routes = filterByTenant(rawRoutes);
    const rawUsers = await db.users.toArray();
    const allUsers = filterByTenant(rawUsers);

    // 1. Calculate shop counts per route for live counter
    const rawShops = (typeof db !== 'undefined' && db.shops) ? await db.shops.toArray() : [];
    const shopsByRoute = {};
    filterByTenant(rawShops).forEach(s => {
      shopsByRoute[Number(s.routeId)] = (shopsByRoute[Number(s.routeId)] || 0) + 1;
    });

    // 2. Multi-Route Checkboxes with shop count badge per route
    const multiRoutesList = document.getElementById('user-form-multi-routes-list');
    if (multiRoutesList) {
      const selectedRouteIds = new Set(Array.isArray(currentUser?.assignedRouteIds) ? currentUser.assignedRouteIds.map(Number) : (currentUser?.assignedRouteId ? [Number(currentUser.assignedRouteId)] : []));
      multiRoutesList.innerHTML = routes.length > 0 ? routes.map(r => {
        const count = shopsByRoute[Number(r.id)] || 0;
        const isChecked = selectedRouteIds.has(Number(r.id));
        return `
          <label class="flex items-center justify-between p-2 bg-white rounded-xl border border-emerald-200 text-xs font-bold text-slate-800 cursor-pointer hover:bg-emerald-50/50">
            <div class="flex items-center gap-2">
              <input type="checkbox" name="user-rep-route" value="${r.id}" ${isChecked ? 'checked' : ''} onchange="Users.onRouteCheckboxChanged()" class="w-4 h-4 rounded text-emerald-600 focus:ring-0" />
              <span>📍 ${r.name}</span>
            </div>
            <span class="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg">${count} Shops</span>
          </label>
        `;
      }).join('') : '<p class="text-xs text-slate-400">No routes available yet.</p>';
      this.onRouteCheckboxChanged();
    }

    // 3. Inherit Territory from Past/Existing Rep Dropdown
    const inheritSelect = document.getElementById('user-form-inherit-rep');
    if (inheritSelect) {
      const otherReps = allUsers.filter(u => u.role === 'rep' && (!currentUser || u.id !== currentUser.id));
      let inheritOpts = '<option value="">-- Manual Selection (අතින් මාර්ග තෝරන්න) --</option>';
      for (const rep of otherReps) {
        const repRoutes = Array.isArray(rep.assignedRouteIds) ? rep.assignedRouteIds.map(Number) : (rep.assignedRouteId ? [Number(rep.assignedRouteId)] : []);
        const repShopsCount = filterByTenant(rawShops).filter(s => repRoutes.includes(Number(s.routeId)) || Number(s.repId) === rep.id).length;
        const statusNote = rep.isActive === false ? ' [Inactive/Departed]' : '';
        inheritOpts += `<option value="${rep.id}">🚚 ${rep.fullName || rep.username}${statusNote} (${repRoutes.length} Routes, ${repShopsCount} Shops)</option>`;
      }
      inheritSelect.innerHTML = inheritOpts;
      inheritSelect.value = '';
      const deactRow = document.getElementById('user-form-inherit-deactivate-row');
      if (deactRow) deactRow.classList.add('hidden');
    }

    // 4. Supervisor Dropdown for Rep
    const supSelect = document.getElementById('user-form-supervisor');
    if (supSelect) {
      const supervisors = allUsers.filter(u => u.role === 'supervisor' && u.isActive !== false);
      supSelect.innerHTML = '<option value="">-- No Supervisor Assigned --</option>' +
        supervisors.map(s => `<option value="${s.id}" ${s.id == currentUser?.supervisorId ? 'selected' : ''}>📋 ${s.fullName || s.username}</option>`).join('');
    }

    // 5. Supervisor's Rep Assignment Checkbox List (3 to 5 Reps)
    const repsList = document.getElementById('user-form-reps-checkbox-list');
    const repCountBadge = document.getElementById('user-form-rep-count-badge');
    if (repsList) {
      const allReps = allUsers.filter(u => u.role === 'rep' && u.isActive !== false);
      const assignedRepIds = new Set(Array.isArray(currentUser?.assignedRepIds) ? currentUser.assignedRepIds.map(Number) : []);

      const updateCountBadge = () => {
        const checkedCount = repsList.querySelectorAll('input[type="checkbox"]:checked').length;
        if (repCountBadge) repCountBadge.textContent = `${checkedCount} Rep${checkedCount === 1 ? '' : 's'} Selected`;
      };

      if (allReps.length === 0) {
        repsList.innerHTML = '<p class="text-xs text-amber-800">No sales reps found in system yet. Create Rep accounts first.</p>';
      } else {
        repsList.innerHTML = allReps.map(rep => {
          const isChecked = assignedRepIds.has(Number(rep.id));
          return `
            <label class="flex items-center justify-between p-2 bg-white rounded-xl border border-amber-200 text-xs font-bold text-slate-800 cursor-pointer hover:bg-amber-50/50">
              <div class="flex items-center gap-2">
                <input type="checkbox" name="sup-assigned-rep" value="${rep.id}" ${isChecked ? 'checked' : ''} onchange="Users.onRepCheckboxChanged()" class="w-4 h-4 rounded text-amber-600 focus:ring-0" />
                <span>🚚 ${rep.fullName || rep.username} (@${rep.username})</span>
              </div>
              <span class="text-[10px] text-slate-400 font-mono font-normal">${rep.phone || ''}</span>
            </label>
          `;
        }).join('');
      }
      updateCountBadge();
    }

    // 6. ASM Team Controls (Supervisors + Reps)
    const asmSupsList = document.getElementById('user-form-asm-supervisors-list');
    const asmRepsList = document.getElementById('user-form-asm-reps-list');
    if (asmSupsList) {
      const supervisors = allUsers.filter(u => u.role === 'supervisor' && u.isActive !== false);
      const assignedSupIds = new Set(Array.isArray(currentUser?.assignedSupervisorIds) ? currentUser.assignedSupervisorIds.map(Number) : []);
      asmSupsList.innerHTML = supervisors.length > 0 ? supervisors.map(s => `
        <label class="flex items-center gap-2 p-1.5 bg-white rounded-xl border border-indigo-200 text-xs font-bold text-slate-800 cursor-pointer hover:bg-indigo-50/50">
          <input type="checkbox" name="asm-assigned-sup" value="${s.id}" ${assignedSupIds.has(Number(s.id)) ? 'checked' : ''} class="w-4 h-4 rounded text-indigo-600 focus:ring-0" />
          <span>📋 ${s.fullName || s.username}</span>
        </label>
      `).join('') : '<p class="text-[10px] text-slate-400">No supervisors found.</p>';
    }
    if (asmRepsList) {
      const reps = allUsers.filter(u => u.role === 'rep' && u.isActive !== false);
      const assignedRepIds = new Set(Array.isArray(currentUser?.assignedRepIds) ? currentUser.assignedRepIds.map(Number) : []);
      asmRepsList.innerHTML = reps.length > 0 ? reps.map(r => `
        <label class="flex items-center gap-2 p-1.5 bg-white rounded-xl border border-indigo-200 text-xs font-bold text-slate-800 cursor-pointer hover:bg-indigo-50/50">
          <input type="checkbox" name="asm-assigned-rep" value="${r.id}" ${assignedRepIds.has(Number(r.id)) ? 'checked' : ''} class="w-4 h-4 rounded text-indigo-600 focus:ring-0" />
          <span>🚚 ${r.fullName || r.username}</span>
        </label>
      `).join('') : '<p class="text-[10px] text-slate-400">No reps found.</p>';
    }
  },

  toggleAllRoutes(select) {
    const cbs = document.querySelectorAll('input[name="user-rep-route"]');
    cbs.forEach(cb => { cb.checked = Boolean(select); });
    this.onRouteCheckboxChanged();
  },

  async onRouteCheckboxChanged() {
    const cbs = document.querySelectorAll('input[name="user-rep-route"]:checked');
    const routeCountEl = document.getElementById('user-form-route-count-badge');
    const shopCountEl = document.getElementById('user-form-shop-count-badge');
    const selectedRouteIds = Array.from(cbs).map(cb => Number(cb.value));

    if (routeCountEl) {
      routeCountEl.textContent = `${selectedRouteIds.length} Route${selectedRouteIds.length === 1 ? '' : 's'} Selected`;
    }

    if (shopCountEl && typeof db !== 'undefined' && db.shops) {
      try {
        const rawShops = await db.shops.toArray();
        const totalShops = filterByTenant(rawShops).filter(s => selectedRouteIds.includes(Number(s.routeId))).length;
        shopCountEl.textContent = `${totalShops} Shop${totalShops === 1 ? '' : 's'} Linked`;
      } catch (e) {}
    }
  },

  async onInheritRepChanged(repId) {
    const deactRow = document.getElementById('user-form-inherit-deactivate-row');
    if (!repId) {
      if (deactRow) deactRow.classList.add('hidden');
      return;
    }
    if (deactRow) deactRow.classList.remove('hidden');

    const rep = await db.users.get(Number(repId));
    if (!rep) return;

    const repRoutes = new Set(Array.isArray(rep.assignedRouteIds) ? rep.assignedRouteIds.map(Number) : (rep.assignedRouteId ? [Number(rep.assignedRouteId)] : []));

    // Check checkboxes matching old rep's routes
    const cbs = document.querySelectorAll('input[name="user-rep-route"]');
    cbs.forEach(cb => {
      cb.checked = repRoutes.has(Number(cb.value));
    });

    // Match Supervisor if exists
    if (rep.supervisorId) {
      const supSelect = document.getElementById('user-form-supervisor');
      if (supSelect) supSelect.value = rep.supervisorId;
    }

    this.onRouteCheckboxChanged();
    UI.showToast(`Inherited ${repRoutes.size} routes from @${rep.username}`, 'info');
  },

  onRepCheckboxChanged() {
    const list = document.getElementById('user-form-reps-checkbox-list');
    const badge = document.getElementById('user-form-rep-count-badge');
    if (list && badge) {
      const count = list.querySelectorAll('input[type="checkbox"]:checked').length;
      badge.textContent = `${count} Rep${count === 1 ? '' : 's'} Selected`;
      if (count >= 3 && count <= 5) {
        badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300';
      } else {
        badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900';
      }
    }
  },

  async saveUserFromForm(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const fullName = document.getElementById('user-form-fullname')?.value?.trim() || '';
    const username = document.getElementById('user-form-username')?.value?.trim()?.toLowerCase() || '';
    const pin = document.getElementById('user-form-pin')?.value?.trim() || '';
    const phone = document.getElementById('user-form-phone')?.value?.trim() || '';
    const role = document.getElementById('user-form-role')?.value || 'rep';
    const isActive = document.getElementById('user-form-active')?.checked !== false;

    if (!fullName || !username || !pin) {
      UI.showToast('Please fill in Name, Username, and 4-digit PIN.', 'warning');
      return;
    }

    if (pin.length < 4) {
      UI.showToast('PIN must be at least 4 digits.', 'warning');
      return;
    }

    // Collect Hierarchy Assignment Values
    let assignedRouteId = null;
    let assignedRouteIds = [];
    let supervisorId = null;
    let assignedRepIds = [];
    let assignedSupervisorIds = [];

    if (role === 'rep') {
      const routeCheckboxes = document.querySelectorAll('input[name="user-rep-route"]:checked');
      assignedRouteIds = Array.from(routeCheckboxes).map(cb => Number(cb.value));
      if (assignedRouteIds.length === 0) {
        UI.showToast('කරුණාකර Rep හට අවම වශයෙන් එක් Route එකක් තෝරන්න (Please select at least 1 Route).', 'warning');
        return;
      }
      assignedRouteId = assignedRouteIds[0];
      const supVal = document.getElementById('user-form-supervisor')?.value;
      supervisorId = supVal ? Number(supVal) : null;
    } else if (role === 'supervisor') {
      const repCheckboxes = document.querySelectorAll('input[name="sup-assigned-rep"]:checked');
      assignedRepIds = Array.from(repCheckboxes).map(cb => Number(cb.value));
    } else if (role === 'asm') {
      const supCheckboxes = document.querySelectorAll('input[name="asm-assigned-sup"]:checked');
      assignedSupervisorIds = Array.from(supCheckboxes).map(cb => Number(cb.value));
      const repCheckboxes = document.querySelectorAll('input[name="asm-assigned-rep"]:checked');
      assignedRepIds = Array.from(repCheckboxes).map(cb => Number(cb.value));
    } else if (role === 'delivery') {
      const routeCheckboxes = document.querySelectorAll('input[name="user-rep-route"]:checked');
      assignedRouteIds = Array.from(routeCheckboxes).map(cb => Number(cb.value));
      assignedRouteId = assignedRouteIds.length > 0 ? assignedRouteIds[0] : null;
    }

    const tenantId = (Auth.currentUser && Auth.currentUser.tenantId) ? Auth.currentUser.tenantId : (getActiveTenantId() || 1);

    const userPayload = {
      fullName,
      username,
      pin,
      phone,
      role,
      assignedRouteId,
      assignedRouteIds,
      supervisorId,
      assignedRepIds,
      assignedSupervisorIds,
      isActive,
      updatedAt: new Date().toISOString()
    };

    try {
      let savedUserId = null;
      if (this.currentEditUserId) {
        // Update Existing User
        savedUserId = this.currentEditUserId;
        await db.users.update(this.currentEditUserId, userPayload);

        // If this is a supervisor, link these reps back to supervisor
        if (role === 'supervisor' && assignedRepIds.length > 0) {
          for (const repId of assignedRepIds) {
            await db.users.update(repId, { supervisorId: this.currentEditUserId });
          }
        }

        // If updated user is admin, sync PIN to db.tenants and db.company
        if (role === 'admin' && typeof db !== 'undefined') {
          if (db.tenants) {
            const matchedTenant = await db.tenants.where('adminUsername').equals(username).first();
            if (matchedTenant) {
              await db.tenants.update(matchedTenant.id, { adminPin: pin, phone: phone || matchedTenant.phone, updatedAt: new Date().toISOString() });
            }
          }
          if (db.company) {
            const comps = filterByTenant(await db.company.toArray());
            const comp = comps.length > 0 ? comps[0] : await db.company.toCollection().first();
            if (comp) {
              await db.company.update(comp.id, { pin: pin });
            }
          }
        }

        UI.showToast('User & Territory updated successfully! ✓', 'success');
      } else {
        // Check username uniqueness
        const existing = await db.users.where('username').equals(username).first();
        if (existing) {
          UI.showToast(`Username '@${username}' is already taken.`, 'warning');
          return;
        }

        // Add New User
        savedUserId = await db.users.add(Object.assign({
          tenantId: tenantId,
          createdAt: new Date().toISOString()
        }, userPayload));

        // If this is a supervisor, link these reps back to supervisor
        if (role === 'supervisor' && assignedRepIds.length > 0 && savedUserId) {
          for (const repId of assignedRepIds) {
            await db.users.update(repId, { supervisorId: savedUserId });
          }
        }

        // If new user is admin, sync to db.tenants
        if (role === 'admin' && typeof db !== 'undefined' && db.tenants) {
          const matchedTenant = await db.tenants.where('adminUsername').equals(username).first();
          if (!matchedTenant) {
            const todayStr = new Date().toISOString().split('T')[0];
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            await db.tenants.add({
              tenantId: tenantId,
              companyName: `${fullName}'s Business`,
              ownerName: fullName,
              adminUsername: username,
              adminPin: pin,
              phone: phone,
              validFrom: todayStr,
              validTo: nextYear.toISOString().split('T')[0],
              isActive: isActive,
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }

        UI.showToast('New User & Territory provisioned successfully! 🎉', 'success');
      }

      // Close modal and refresh users list INSTANTLY
      UI.closeModal('modal-user-form');
      await this.loadUsers();

      // Auto-assign shops and deactivate old rep in background without freezing UI
      (async () => {
        if (role === 'rep' && assignedRouteIds.length > 0 && savedUserId) {
          try {
            const rawShops = await db.shops.toArray();
            const targetShops = filterByTenant(rawShops).filter(s => assignedRouteIds.includes(Number(s.routeId)));
            for (const s of targetShops) {
              await db.shops.update(s.id, {
                repId: savedUserId,
                repName: fullName || username,
                updatedAt: new Date().toISOString()
              });
            }
          } catch (e) {
            console.warn('Auto-assign shops to rep notice:', e);
          }
        }

        const inheritRepId = document.getElementById('user-form-inherit-rep')?.value;
        const deactivateOld = document.getElementById('user-form-deactivate-old-rep')?.checked;
        if (inheritRepId && deactivateOld) {
          try {
            await db.users.update(Number(inheritRepId), {
              isActive: false,
              updatedAt: new Date().toISOString()
            });
            UI.showToast('Previous rep account marked inactive! 🚫', 'info');
            if (typeof Users !== 'undefined' && Users.loadUsers) Users.loadUsers();
          } catch (e) {}
        }
      })();
    } catch (err) {
      console.error('Error saving user:', err);
      UI.showToast('Error saving user: ' + err.message, 'error');
    }
  },

  // ── 🔄 REASSIGN / REPLACE SALES REP MODAL METHODS ─────────────────────────
  async openTransferModal(departingRepId = null) {
    const rawUsers = await db.users.toArray();
    const allUsers = filterByTenant(rawUsers);
    const reps = allUsers.filter(u => u.role === 'rep');

    if (reps.length === 0) {
      UI.showToast('No Sales Reps found in the system yet.', 'info');
      return;
    }

    const oldRep = departingRepId ? reps.find(r => r.id === Number(departingRepId)) : reps[0];
    if (!oldRep) return;

    document.getElementById('transfer-old-rep-id').value = oldRep.id;
    document.getElementById('transfer-old-rep-name').textContent = oldRep.fullName || oldRep.username;
    document.getElementById('transfer-old-rep-username').textContent = `@${oldRep.username} (PIN: ${oldRep.pin})`;

    const oldRoutes = Array.isArray(oldRep.assignedRouteIds) ? oldRep.assignedRouteIds.map(Number) : (oldRep.assignedRouteId ? [Number(oldRep.assignedRouteId)] : []);
    document.getElementById('transfer-old-rep-routes-count').textContent = `${oldRoutes.length} Route${oldRoutes.length === 1 ? '' : 's'}`;

    const rawShops = await db.shops.toArray();
    const shopsCount = filterByTenant(rawShops).filter(s => oldRoutes.includes(Number(s.routeId)) || Number(s.repId) === oldRep.id).length;
    document.getElementById('transfer-old-rep-shops-count').textContent = `${shopsCount} Shop${shopsCount === 1 ? '' : 's'}`;

    // Target rep dropdown
    const targetSelect = document.getElementById('transfer-target-rep-select');
    const otherActiveReps = reps.filter(r => r.id !== oldRep.id && r.isActive !== false);

    let opts = '<option value="">-- Select Target Rep --</option>';
    opts += '<option value="new_rep">➕ Create & Provision New Rep Right Now</option>';
    for (const r of otherActiveReps) {
      opts += `<option value="${r.id}">🚚 ${r.fullName || r.username} (@${r.username})</option>`;
    }
    targetSelect.innerHTML = opts;
    targetSelect.value = otherActiveReps.length > 0 ? otherActiveReps[0].id : 'new_rep';
    this.onTransferTargetSelectChanged(targetSelect.value);

    // Reset new rep inputs
    const fn = document.getElementById('transfer-new-fullname');
    if (fn) fn.value = '';
    const un = document.getElementById('transfer-new-username');
    if (un) un.value = '';
    const pn = document.getElementById('transfer-new-pin');
    if (pn) pn.value = '';
    const ph = document.getElementById('transfer-new-phone');
    if (ph) ph.value = '';

    document.getElementById('transfer-deactivate-old').checked = true;

    UI.openModal('modal-transfer-rep');
  },

  onTransferTargetSelectChanged(val) {
    const fields = document.getElementById('transfer-new-rep-fields');
    if (fields) {
      if (val === 'new_rep') {
        fields.classList.remove('hidden');
      } else {
        fields.classList.add('hidden');
      }
    }
  },

  async executeTransferTerritory() {
    const oldRepId = Number(document.getElementById('transfer-old-rep-id').value);
    const oldRep = await db.users.get(oldRepId);
    if (!oldRep) {
      UI.showToast('Departing Rep not found.', 'error');
      return;
    }

    const targetVal = document.getElementById('transfer-target-rep-select').value;
    if (!targetVal) {
      UI.showToast('Please select a target Rep or choose Create New Rep.', 'warning');
      return;
    }

    let targetRepId = null;
    let targetRepName = '';

    const oldRoutes = Array.isArray(oldRep.assignedRouteIds) ? oldRep.assignedRouteIds.map(Number) : (oldRep.assignedRouteId ? [Number(oldRep.assignedRouteId)] : []);

    if (targetVal === 'new_rep') {
      const fullName = document.getElementById('transfer-new-fullname')?.value?.trim();
      const username = document.getElementById('transfer-new-username')?.value?.trim()?.toLowerCase();
      const pin = document.getElementById('transfer-new-pin')?.value?.trim();
      const phone = document.getElementById('transfer-new-phone')?.value?.trim() || '';

      if (!fullName || !username || !pin) {
        UI.showToast('Please enter Name, Username, and 4-digit PIN for the new Rep.', 'warning');
        return;
      }
      if (pin.length < 4) {
        UI.showToast('PIN must be at least 4 digits.', 'warning');
        return;
      }

      const existing = await db.users.where('username').equals(username).first();
      if (existing) {
        UI.showToast(`Username '@${username}' is already in use.`, 'warning');
        return;
      }

      const tenantId = (Auth.currentUser && Auth.currentUser.tenantId) ? Auth.currentUser.tenantId : (getActiveTenantId() || 1);
      targetRepId = await db.users.add({
        tenantId,
        fullName,
        username,
        pin,
        phone,
        role: 'rep',
        assignedRouteId: oldRoutes[0] || null,
        assignedRouteIds: oldRoutes,
        supervisorId: oldRep.supervisorId || null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      targetRepName = fullName;
    } else {
      targetRepId = Number(targetVal);
      const targetUser = await db.users.get(targetRepId);
      if (!targetUser) return;
      targetRepName = targetUser.fullName || targetUser.username;

      const currentRoutes = Array.isArray(targetUser.assignedRouteIds) ? targetUser.assignedRouteIds.map(Number) : (targetUser.assignedRouteId ? [Number(targetUser.assignedRouteId)] : []);
      const mergedRoutes = Array.from(new Set([...currentRoutes, ...oldRoutes]));

      await db.users.update(targetRepId, {
        assignedRouteIds: mergedRoutes,
        assignedRouteId: mergedRoutes[0] || targetUser.assignedRouteId,
        supervisorId: targetUser.supervisorId || oldRep.supervisorId || null,
        updatedAt: new Date().toISOString()
      });
    }

    // Close modal and show initial toast INSTANTLY
    UI.closeModal('modal-transfer-rep');
    UI.showToast(`Transferring ${oldRoutes.length} routes to ${targetRepName}... 🚀`, 'info');
    await this.loadUsers();

    // Reassign shops and deactivate old rep in background
    (async () => {
      try {
        const rawShops = await db.shops.toArray();
        const shopsToUpdate = filterByTenant(rawShops).filter(s =>
          oldRoutes.includes(Number(s.routeId)) ||
          Number(s.repId) === oldRepId ||
          (s.createdBy && String(s.createdBy).toLowerCase() === String(oldRep.username).toLowerCase())
        );

        let updatedShopCount = 0;
        for (const s of shopsToUpdate) {
          await db.shops.update(s.id, {
            repId: targetRepId,
            repName: targetRepName,
            updatedAt: new Date().toISOString()
          });
          updatedShopCount++;
        }

        const deactivateOld = document.getElementById('transfer-deactivate-old')?.checked;
        if (deactivateOld) {
          await db.users.update(oldRepId, {
            isActive: false,
            updatedAt: new Date().toISOString()
          });
        }

        UI.showToast(`🎉 ${oldRoutes.length} Routes and ${updatedShopCount} Shops transferred to ${targetRepName}!`, 'success');
        if (typeof Users !== 'undefined' && Users.loadUsers) Users.loadUsers();
      } catch (e) {
        console.warn('Background shop transfer notice:', e);
      }
    })();
  },

  async deleteUser(id) {
    const user = await db.users.get(id);
    if (!user) return;

    // Check if current user
    if (Auth.currentUser && Auth.currentUser.id === id) {
      UI.showToast('You cannot delete your own currently active account.', 'error');
      return;
    }

    const rawUsers = await db.users.toArray();
    const allUsers = filterByTenant(rawUsers);
    const adminCount = allUsers.filter(u => u.role === 'admin' && u.isActive !== false).length;
    if (user.role === 'admin' && adminCount <= 1) {
      UI.showToast('Cannot delete the only active Admin account.', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to delete user "${user.fullName || user.username}"?`)) {
      return;
    }

    try {
      await db.users.delete(id);
      UI.showToast(`User @${user.username} deleted.`, 'info');
      await this.loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      UI.showToast('Failed to delete user: ' + err.message, 'error');
    }
  }
};

window.Users = Users;
