/**
 * Company Profile & Settings Module
 */

const Settings = {
  currentLogoBase64: '',

  async loadSettings() {
    try {
      let company = null;
      if (typeof filterByTenant === 'function') {
        const comps = filterByTenant(await db.company.toArray());
        if (comps.length > 0) company = comps[0];
      }
      if (!company) {
        company = await db.company.toCollection().first();
      }

      let localSaved = null;
      try {
        const stored = localStorage.getItem('pos_company_profile');
        if (stored) localSaved = JSON.parse(stored);
      } catch (e) {}

      const name = company?.name || localSaved?.name || '';
      const tagline = company?.tagline || localSaved?.tagline || '';
      const address = company?.address || localSaved?.address || '';
      const phone = company?.phone || localSaved?.phone || '';
      const regNo = company?.regNo || localSaved?.regNo || '';
      const receiptFooter = company?.receiptFooter || localSaved?.receiptFooter || 'Thank you for your business! / ස්තූතියි!';
      const printerWidth = company?.printerWidth || localSaved?.printerWidth || '80mm';
      this.currentLogoBase64 = company?.logoBase64 || localSaved?.logoBase64 || '';

      const nameEl = document.getElementById('sett-company-name');
      if (nameEl) nameEl.value = name;
      const tagEl = document.getElementById('sett-tagline');
      if (tagEl) tagEl.value = tagline;
      const addrEl = document.getElementById('sett-address');
      if (addrEl) addrEl.value = address;
      const phoneEl = document.getElementById('sett-phone');
      if (phoneEl) phoneEl.value = phone;
      const regEl = document.getElementById('sett-regno');
      if (regEl) regEl.value = regNo;
      const footEl = document.getElementById('sett-footer');
      if (footEl) footEl.value = receiptFooter;
      const printEl = document.getElementById('sett-printer-width');
      if (printEl) printEl.value = printerWidth;

      this.updateLogoPreview();

      // Load Role Permissions Panel
      this.renderPermissionsPanel();
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  },

  // Render Dynamic Role Permissions Toggle Switchboard
  renderPermissionsPanel() {
    const container = document.getElementById('sett-permissions-container');
    if (!container) return;

    const perms = Auth.getPermissions();

    const repPermItems = [
      { key: 'rep_can_add_shops', title: 'Add New Shops (කඩ ලියාපදිංචි කිරීම)', desc: 'Allow Sales Rep to register and save new retail shops' },
      { key: 'rep_can_edit_shops', title: 'Edit Shops (කඩ විස්තර වෙනස් කිරීම)', desc: 'Allow Sales Rep to edit names, owners, phones & addresses' },
      { key: 'rep_can_delete_shops', title: 'Delete Shops (කඩ ඉවත් කිරීම)', desc: 'Allow Sales Rep to permanently delete shops and billing records' },
      { key: 'rep_can_view_history', title: 'View Shop History (කඩ ඉතිහාසය)', desc: 'Allow Sales Rep to preview past orders and thermal invoices' },
      { key: 'rep_can_take_returns', title: 'Process Returns (ආපසු/මාරු භාරගැනීම)', desc: 'Allow Sales Rep to issue return deductions & item replacements' },
      { key: 'rep_can_give_credit', title: 'Issue Credit (ණයට බිල්පත් නිකුත් කිරීම)', desc: 'Allow Sales Rep to book credit & partial payment bills' },
      { key: 'rep_can_view_qr', title: 'View & Download QR (QR කේත)', desc: 'Allow Sales Rep to view and print shop QR stickers' },
      { key: 'rep_can_edit_orders', title: 'Edit / Adjust Orders (ඇණවුම් වෙනස් කිරීම)', desc: 'Allow Sales Rep to adjust item quantities on booked orders' },
      { key: 'rep_can_add_items_on_order', title: 'Add Extra Items (අමතර භාණ්ඩ එකතු කිරීම)', desc: 'Allow Sales Rep to add extra products into existing orders' }
    ];

    const driverPermItems = [
      { key: 'delivery_can_edit_orders', title: 'Adjust Quantities (භාණ්ඩ ගණන අඩු/වැඩි)', desc: 'Allow Driver to change item quantities if customer requests less' },
      { key: 'delivery_can_add_items', title: 'Add Extra Items on Delivery (අමතර භාණ්ඩ)', desc: 'Allow Driver to add new products into orders during spot delivery' },
      { key: 'delivery_can_cancel_orders', title: 'Cancel Orders (ඇණවුම් අවලංගු කිරීම)', desc: 'Allow Driver to cancel orders if shop is closed or no cash' },
      { key: 'delivery_can_collect_debt', title: 'Collect Debt (පැරණි ණය එකතු කිරීම)', desc: 'Allow Driver to record outstanding credit debt collections' },
      { key: 'delivery_can_view_shops', title: 'View Shop Directory (කඩ විස්තර & ඇමතුම්)', desc: 'Allow Driver to view shop list and direct phone call links' },
      { key: 'delivery_can_print_manifest', title: 'Print Van Packing Manifest (පැකින් පත්‍රිකා)', desc: 'Allow Driver to print A4 Van Loading manifest sheets' }
    ];

    let html = `
      <!-- Sales Rep Section -->
      <div class="bg-gradient-to-r from-orange-50 to-amber-50 p-3.5 sm:p-4 rounded-3xl border border-orange-200/80 space-y-3">
        <div class="flex items-center gap-2 pb-2 border-b border-orange-200">
          <span class="text-xl">🚚</span>
          <div>
            <h4 class="text-xs font-black text-slate-900 uppercase tracking-wider">Sales Rep Permissions (සේල්ස් රෙප් අවසර)</h4>
            <p class="text-[10px] text-slate-500 font-semibold">Enable or disable features accessible when Rep logs in</p>
          </div>
        </div>
        <div class="space-y-2">
    `;

    for (const item of repPermItems) {
      const isChecked = Boolean(perms[item.key]);
      html += `
        <div class="flex items-center justify-between p-2.5 bg-white rounded-2xl border border-orange-100 shadow-xs">
          <div class="pr-2">
            <h5 class="text-xs font-black text-slate-800">${item.title}</h5>
            <p class="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">${item.desc}</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input type="checkbox" data-perm-key="${item.key}" ${isChecked ? 'checked' : ''} onchange="Settings.togglePermission('${item.key}', this.checked)" class="sr-only peer" />
            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      `;
    }

    html += `
        </div>
      </div>

      <!-- Delivery Driver Section -->
      <div class="bg-gradient-to-r from-sky-50 to-blue-50 p-3.5 sm:p-4 rounded-3xl border border-sky-200/80 space-y-3 mt-3">
        <div class="flex items-center gap-2 pb-2 border-b border-sky-200">
          <span class="text-xl">📦</span>
          <div>
            <h4 class="text-xs font-black text-slate-900 uppercase tracking-wider">Delivery Driver Permissions (බෙදාහැරීම් රියදුරු අවසර)</h4>
            <p class="text-[10px] text-slate-500 font-semibold">Enable or disable features accessible on Driver login</p>
          </div>
        </div>
        <div class="space-y-2">
    `;

    for (const item of driverPermItems) {
      const isChecked = Boolean(perms[item.key]);
      html += `
        <div class="flex items-center justify-between p-2.5 bg-white rounded-2xl border border-sky-100 shadow-xs">
          <div class="pr-2">
            <h5 class="text-xs font-black text-slate-800">${item.title}</h5>
            <p class="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">${item.desc}</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input type="checkbox" data-perm-key="${item.key}" ${isChecked ? 'checked' : ''} onchange="Settings.togglePermission('${item.key}', this.checked)" class="sr-only peer" />
            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  togglePermission(key, value) {
    const update = {};
    update[key] = Boolean(value);
    Auth.savePermissions(update);
    UI.showToast(`Permission updated! 🔐`, 'info');
  },

  resetPermissionsToDefault() {
    if (confirm('Reset all role permissions to standard recommended defaults?')) {
      Auth.resetPermissions();
      this.renderPermissionsPanel();
      UI.showToast('Permissions reset to defaults! ✅', 'success');
    }
  },

  async handleLogoUpload(event) {
    const file = event.target.files[0];
    if (file) {
      try {
        UI.showToast('Processing logo...', 'info');
        const compressed = await UI.compressImage(file, 400, 0.85);
        this.currentLogoBase64 = compressed;
        this.updateLogoPreview();
        UI.showToast('Logo updated! Click Save Profile to apply.', 'success');
      } catch (err) {
        UI.showToast('Failed to process logo image', 'error');
      }
    }
  },

  removeLogo() {
    this.currentLogoBase64 = '';
    this.updateLogoPreview();
  },

  updateLogoPreview() {
    const preview = document.getElementById('sett-logo-preview-img');
    const placeholder = document.getElementById('sett-logo-placeholder');
    const removeBtn = document.getElementById('sett-logo-remove-btn');

    if (this.currentLogoBase64) {
      if (preview) {
        preview.src = this.currentLogoBase64;
        preview.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (removeBtn) removeBtn.classList.remove('hidden');
    } else {
      if (preview) {
        preview.src = '';
        preview.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (removeBtn) removeBtn.classList.add('hidden');
    }
  },

  async saveCompanyProfile() {
    const name = document.getElementById('sett-company-name').value.trim();
    const tagline = document.getElementById('sett-tagline').value.trim();
    const address = document.getElementById('sett-address').value.trim();
    const phone = document.getElementById('sett-phone').value.trim();
    const regNo = document.getElementById('sett-regno').value.trim();
    const receiptFooter = document.getElementById('sett-footer').value.trim();
    const printerWidth = document.getElementById('sett-printer-width').value || '80mm';

    if (!name) {
      UI.showToast('Company name is required', 'warning');
      return;
    }

    const tenantId = (Auth.currentUser && Auth.currentUser.tenantId) ? Auth.currentUser.tenantId : (getActiveTenantId() || 1);
    
    // Save to localStorage immediately as persistent mirror
    const profileObj = {
      tenantId,
      name,
      tagline,
      address,
      phone,
      regNo,
      receiptFooter,
      printerWidth,
      logoBase64: this.currentLogoBase64 || ''
    };
    try {
      localStorage.setItem('pos_company_profile', JSON.stringify(profileObj));
    } catch (e) {}

    // Update all matching or primary company records in IndexedDB
    const allComps = await db.company.toArray();
    if (allComps.length > 0) {
      for (const comp of allComps) {
        if (Number(comp.tenantId) === Number(tenantId) || comp.id === 1) {
          await db.company.update(comp.id, profileObj);
        }
      }
    } else {
      await db.company.add({
        id: 1,
        ...profileObj,
        pin: '1234'
      });
    }

    // Also sync tenant companyName in db.tenants if tenant record exists
    if (db.tenants) {
      try {
        const tenant = await db.tenants.where('tenantId').equals(tenantId).first();
        if (tenant) {
          await db.tenants.update(tenant.id, { companyName: name, phone: phone || tenant.phone });
        }
      } catch (tErr) {
        console.warn('Tenant sync notice:', tErr);
      }
    }

    // Update Header and Branding Immediately
    if (typeof UI !== 'undefined' && UI.updateCompanyBranding) {
      UI.updateCompanyBranding();
    }

    UI.showToast('Company profile & printer settings saved! ✅', 'success');
    if (typeof Dashboard !== 'undefined' && Dashboard.loadDashboard) {
      Dashboard.loadDashboard();
    }
  },

  async handleTestPrint() {
    try {
      UI.showToast('Preparing test receipt for Epson TM-T82...', 'info');
      await Print.printTestReceipt();
    } catch (err) {
      console.error('Test print error:', err);
      UI.showToast('Failed to print test receipt: ' + err.message, 'error');
    }
  },

  async handleChangePin() {
    const oldPin = document.getElementById('sett-old-pin').value.trim();
    const newPin = document.getElementById('sett-new-pin').value.trim();
    const confirmPin = document.getElementById('sett-confirm-pin').value.trim();

    if (newPin !== confirmPin) {
      UI.showToast('New PIN and Confirm PIN do not match', 'warning');
      return;
    }

    const result = await Auth.updatePin(oldPin, newPin);
    if (result.success) {
      UI.showToast(result.message, 'success');
      document.getElementById('sett-old-pin').value = '';
      document.getElementById('sett-new-pin').value = '';
      document.getElementById('sett-confirm-pin').value = '';
    } else {
      UI.showToast(result.message, 'error');
    }
  },

  async triggerBackup() {
    try {
      const json = await exportDatabaseToJson();
      const dateStr = new Date().toISOString().split('T')[0];
      Reports.downloadFile(json, `spice_pos_backup_${dateStr}.json`, 'application/json');
      UI.showToast('Backup JSON downloaded successfully!', 'success');
    } catch (err) {
      UI.showToast('Failed to create backup: ' + err.message, 'error');
    }
  },

  async handleRestore(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('Restoring will replace all current data with the backup file. Proceed?')) {
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = await importDatabaseFromJson(e.target.result);
      if (result.success) {
        UI.showToast(result.message, 'success');
        Dashboard.loadDashboard();
        UI.switchTab('dashboard');
      } else {
        UI.showToast('Restore failed: ' + result.message, 'error');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  },

  async handleSeedSampleData() {
    if (confirm('Load sample Sri Lankan spice routes, hanging cards, shops, and orders for testing?')) {
      UI.showToast('Loading demo data...', 'info');
      const result = await seedSampleData();
      if (result.success) {
        UI.showToast(result.message, 'success');
        await Dashboard.loadDashboard();
        UI.switchTab('dashboard');
      } else {
        UI.showToast(result.message, 'warning');
      }
    }
  },

  async handleClearDatabase() {
    if (confirm('WARNING: Are you sure you want to erase all transactions, shops, and products? This cannot be undone.')) {
      if (confirm('Please confirm one more time to reset database:')) {
        await clearAllDatabase();
        UI.showToast('Database reset complete', 'info');
        await Dashboard.loadDashboard();
        UI.switchTab('dashboard');
      }
    }
  },

};

