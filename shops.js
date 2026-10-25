/**
 * Shop / Customer Directory — QR Code, Open/Closed Status, Delete Cascade
 */

const Shops = {
  currentPhotoBase64: '',
  selectedRouteFilter: 'all',
  _searchTerm: '',

  async loadShops() {
    try {
      await this.populateRouteFilterDropdown();

      const rawShops = await db.shops.toArray();
      let shops = filterByTenant(rawShops);
      if (typeof Hierarchy !== 'undefined') {
        shops = await Hierarchy.filterShops(shops);
      }
      if (this.selectedRouteFilter !== 'all') {
        shops = shops.filter(s => String(s.routeId) === String(this.selectedRouteFilter));
      }

      // Apply search filter
      if (this._searchTerm) {
        const t = this._searchTerm.toLowerCase();
        shops = shops.filter(s =>
          s.name.toLowerCase().includes(t) ||
          (s.ownerName && s.ownerName.toLowerCase().includes(t)) ||
          (s.phone && s.phone.includes(t))
        );
      }

      const container = document.getElementById('shops-list-container');
      if (!container) return;

      if (shops.length === 0) {
        container.innerHTML = `
          <div class="text-center py-10 bg-white rounded-2xl border border-gray-100 p-6 col-span-full shadow-sm">
            <div class="text-5xl mb-3">🏪</div>
            <h3 class="font-bold text-gray-700 text-sm">No Shops Found</h3>
            <p class="text-xs text-gray-400 mt-1">Add shops under your routes with location details and photos.</p>
            <button onclick="Shops.openShopModal()" class="mt-4 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-400/30 active:scale-95">
              + Add New Shop
            </button>
          </div>
        `;
        return;
      }

      const role = (typeof Auth !== 'undefined' && Auth.currentUser?.role) || 'admin';
      const isDelivery = (role === 'delivery');
      const canEdit = (role === 'admin') || (role === 'rep' && Auth.can('rep_can_edit_shops'));
      const canDelete = (role === 'admin') || (role === 'rep' && Auth.can('rep_can_delete_shops'));
      const canViewHistory = (role === 'admin') || (role === 'rep' && Auth.can('rep_can_view_history'));
      const canViewQR = (role === 'admin') || (role === 'rep' && Auth.can('rep_can_view_qr'));

      let html = '';
      for (const shop of shops) {
        const route = await db.routes.get(shop.routeId);
        const credit = Number(shop.currentCredit) || 0;
        const hasCredit = credit > 0;
        const isOpen = shop.isOpen !== false; // default open

        html += `
          <div class="bg-white rounded-2xl border ${isOpen ? 'border-gray-100' : 'border-red-200 bg-red-50/30'} shadow-sm flex flex-col justify-between hover:shadow-md transition-all overflow-hidden">
            <!-- Status bar top -->
            <div class="h-1.5 w-full ${isOpen ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-red-400 to-rose-500'}"></div>
            
            <div class="p-4">
              <div class="flex items-start gap-3">
                <!-- Shop Photo / Placeholder -->
                <div class="relative cursor-pointer flex-shrink-0" onclick="Shops.viewShopPhoto('${shop.photoBase64 || ''}', '${shop.name.replace(/'/g,"\\'")}')">
                  ${shop.photoBase64
                    ? `<img src="${shop.photoBase64}" class="w-14 h-14 rounded-xl object-cover border border-gray-200 shadow-sm" alt="Shop Photo"/>`
                    : `<div class="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-100 to-amber-50 border border-orange-200 flex items-center justify-center text-2xl shadow-inner">🏪</div>`
                  }
                  ${isOpen
                    ? `<span class="absolute -bottom-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white shadow">OPEN</span>`
                    : `<span class="absolute -bottom-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white shadow">CLOSED</span>`
                  }
                </div>

                <!-- Shop Details -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-md">
                      🗺️ ${route ? route.name : 'Unassigned'}
                    </span>
                  </div>
                  <h3 class="font-bold text-gray-900 text-sm mt-1 truncate">${shop.name}</h3>
                  <p class="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <span>👤 ${shop.ownerName || 'Owner'}</span>
                  </p>
                  <p class="text-xs text-gray-400 truncate mt-0.5">
                    📍 ${shop.address || 'No address note'}
                  </p>
                </div>

                <!-- Action Buttons -->
                <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
                  ${canEdit ? `
                    <button onclick="Shops.editShop(${shop.id})" class="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Edit">
                      ✏️
                    </button>
                  ` : ''}
                  ${shop.phone ? `
                    <a href="tel:${shop.phone}" class="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg flex items-center justify-center" title="Call Shop">
                      📞
                    </a>
                  ` : ''}
                  ${canDelete ? `
                    <button onclick="Shops.confirmDeleteShop(${shop.id})" class="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Delete Shop">
                      🗑️
                    </button>
                  ` : ''}
                </div>
              </div>

              <!-- Credit Balance -->
              <div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span class="text-[10px] text-gray-400 block font-medium">Outstanding Credit</span>
                  <span class="font-bold text-xs ${hasCredit ? 'text-red-600' : 'text-emerald-600'}">
                    ${hasCredit ? '⚠️ ' + UI.formatCurrency(credit) : '✓ Cleared (Rs. 0)'}
                  </span>
                </div>

                <div class="flex items-center gap-1.5">
                  ${hasCredit ? `
                    <button onclick="Shops.openDebtCollectionModal(${shop.id})" class="px-2.5 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 border border-green-200 active:scale-95">
                      Collect 💵
                    </button>
                  ` : ''}
                  ${canViewHistory ? `
                    <button onclick="Shops.viewShopHistory(${shop.id})" class="px-2.5 py-1.5 bg-gray-50 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-100 border border-gray-200 active:scale-95">
                      History 📜
                    </button>
                  ` : ''}
                </div>
              </div>

              <!-- GPS Location & Navigation Bar -->
              <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                <div class="flex items-center gap-1">
                  ${shop.lat && shop.lng ? `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      📍 GPS Tagged
                    </span>
                  ` : `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                      ⚠️ No GPS
                    </span>
                  `}
                </div>
                <div class="flex items-center gap-1">
                  ${shop.lat && shop.lng ? `
                    <button onclick="GPS.navigateToShop(${shop.id})" class="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold rounded-xl border border-sky-200 flex items-center gap-1 active:scale-95 transition-all" title="Turn-by-turn Navigation">
                      🧭 Navigate (පාර)
                    </button>
                  ` : `
                    <button onclick="GPS.tagShopCurrentLocation(${shop.id})" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-xl shadow-xs flex items-center gap-1 active:scale-95 transition-all" title="Tag phone's current GPS location">
                      📍 Tag GPS
                    </button>
                    <button onclick="MapView.openLocationPicker(${shop.id})" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-xl active:scale-95" title="Pin on interactive map">
                      🗺️ Map
                    </button>
                  `}
                </div>
              </div>

              <!-- Bottom action bar: Open/Closed + QR -->
              ${!isDelivery ? `
                <div class="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                  <button onclick="Shops.toggleShopStatus(${shop.id}, ${isOpen})"
                    class="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${isOpen
                      ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}">
                    ${isOpen ? '🔴 Mark Closed' : '🟢 Mark Open'}
                  </button>
                  ${canViewQR ? `
                    <button onclick="Shops.viewShopQR(${shop.id})"
                      class="flex-1 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all">
                      🔲 View QR
                    </button>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      container.innerHTML = html;
    } catch (err) {
      console.error('Error loading shops:', err);
    }
  },

  onShopSearch(val) {
    this._searchTerm = val || '';
    this.loadShops();
  },

  async populateRouteFilterDropdown() {
    let routes = await db.routes.toArray();
    routes = filterByTenant(routes);
    if (typeof Hierarchy !== 'undefined') {
      routes = await Hierarchy.filterRoutes(routes);
    }
    const dropdown = document.getElementById('shop-route-filter');
    if (!dropdown) return;

    let html = `<option value="all" ${this.selectedRouteFilter === 'all' ? 'selected' : ''}>All Routes (${routes.length})</option>`;
    for (const r of routes) {
      html += `<option value="${r.id}" ${String(this.selectedRouteFilter) === String(r.id) ? 'selected' : ''}>${r.name}</option>`;
    }
    dropdown.innerHTML = html;
  },

  onRouteFilterChange(val) {
    this.selectedRouteFilter = val;
    this.loadShops();
  },

  async openShopModal(shop = null) {
    let routes = await db.routes.toArray();
    routes = filterByTenant(routes);
    if (typeof Hierarchy !== 'undefined') {
      routes = await Hierarchy.filterRoutes(routes);
    }
    // If no routes exist in database, automatically create a default route
    if (routes.length === 0) {
      const activeTid = getActiveTenantId() || 1;
      await db.routes.add({
        tenantId: activeTid,
        name: 'Main Route (ප්‍රධාන මාර්ගය)',
        description: 'Default Sales & Delivery Route'
      });
      routes = await db.routes.toArray();
      routes = filterByTenant(routes);
      if (typeof Hierarchy !== 'undefined') {
        routes = await Hierarchy.filterRoutes(routes);
      }
    }

    const routeSelect = document.getElementById('shop-modal-route');
    if (routeSelect) {
      routeSelect.innerHTML = routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    }

    document.getElementById('shop-modal-id').value = shop ? shop.id : '';
    document.getElementById('shop-modal-name').value = shop ? shop.name : '';
    document.getElementById('shop-modal-owner').value = shop ? (shop.ownerName || '') : '';
    document.getElementById('shop-modal-phone').value = shop ? (shop.phone || '') : '';
    document.getElementById('shop-modal-address').value = shop ? (shop.address || '') : '';
    document.getElementById('shop-modal-credit').value = shop ? (shop.currentCredit || 0) : '0';

    const latEl = document.getElementById('shop-modal-lat');
    const lngEl = document.getElementById('shop-modal-lng');
    if (latEl) latEl.value = shop ? (shop.lat || '') : '';
    if (lngEl) lngEl.value = shop ? (shop.lng || '') : '';

    // Auto-fetch GPS in background for new shop ONLY for field mobile reps/delivery with real GPS (never desktop PC IP)
    const isFieldRole = (typeof Auth !== 'undefined' && Auth.currentUser && (Auth.currentUser.role === 'rep' || Auth.currentUser.role === 'delivery'));
    if (!shop && typeof GPS !== 'undefined' && isFieldRole) {
      GPS.getCurrentPosition().then(pos => {
        if (!pos || !pos.lat || !pos.lng) return;
        const isColombo = (pos.lat >= 6.8 && pos.lat <= 7.15 && pos.lng >= 79.75 && pos.lng <= 80.05 && (pos.accuracy || 0) > 300);
        if (isColombo) return;
        if (latEl && !latEl.value) latEl.value = Number(pos.lat).toFixed(7);
        if (lngEl && !lngEl.value) lngEl.value = Number(pos.lng).toFixed(7);
      }).catch(() => {});
    }
    if (shop && shop.routeId && routeSelect) {
      routeSelect.value = shop.routeId;
    } else if (routes.length > 0 && routeSelect) {
      routeSelect.value = routes[0].id;
    }

    this.currentPhotoBase64 = shop ? (shop.photoBase64 || '') : '';
    this.updatePhotoPreview();

    document.getElementById('shop-modal-title').textContent = shop ? 'Edit Shop' : 'Add New Shop';
    UI.openModal('modal-shop-form');
  },

  async handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file) {
      try {
        UI.showToast('Optimizing photo...', 'info');
        const compressedBase64 = await UI.compressImage(file, 600, 0.75);
        this.currentPhotoBase64 = compressedBase64;
        this.updatePhotoPreview();
        UI.showToast('Photo attached!', 'success');
      } catch (err) {
        UI.showToast('Failed to process photo', 'error');
      }
    }
  },

  removePhoto() {
    this.currentPhotoBase64 = '';
    this.updatePhotoPreview();
  },

  updatePhotoPreview() {
    const previewImg = document.getElementById('shop-photo-preview-img');
    const placeholder = document.getElementById('shop-photo-placeholder');
    const removeBtn = document.getElementById('shop-photo-remove-btn');

    if (this.currentPhotoBase64) {
      if (previewImg) { previewImg.src = this.currentPhotoBase64; previewImg.classList.remove('hidden'); }
      if (placeholder) placeholder.classList.add('hidden');
      if (removeBtn) removeBtn.classList.remove('hidden');
    } else {
      if (previewImg) { previewImg.src = ''; previewImg.classList.add('hidden'); }
      if (placeholder) placeholder.classList.remove('hidden');
      if (removeBtn) removeBtn.classList.add('hidden');
    }
  },

  viewShopPhoto(base64, shopName) {
    if (!base64) return;
    const modalImg = document.getElementById('view-photo-modal-img');
    const modalTitle = document.getElementById('view-photo-modal-title');
    if (modalImg) modalImg.src = base64;
    if (modalTitle) modalTitle.textContent = shopName;
    UI.openModal('modal-view-photo');
  },

  async editShop(id) {
    const shop = await db.shops.get(id);
    if (shop) this.openShopModal(shop);
  },

  async saveShop() {
    const id = document.getElementById('shop-modal-id').value;
    let routeId = Number(document.getElementById('shop-modal-route')?.value);
    const name = document.getElementById('shop-modal-name').value.trim();
    const ownerName = document.getElementById('shop-modal-owner').value.trim();
    const phone = document.getElementById('shop-modal-phone').value.trim();
    const address = document.getElementById('shop-modal-address').value.trim();
    const currentCredit = Number(document.getElementById('shop-modal-credit').value) || 0;
    const activeTid = getActiveTenantId() || 1;

    if (!name) { UI.showToast('Please enter Shop Name (කඩේ නම ඇතුලත් කරන්න)', 'warning'); return; }

    // Fallback if routeId is missing or empty
    if (!routeId || isNaN(routeId)) {
      let routes = await db.routes.toArray();
      routes = filterByTenant(routes);
      if (routes.length === 0) {
        routeId = await db.routes.add({
          tenantId: activeTid,
          name: 'Main Route (ප්‍රධාන මාර්ගය)',
          description: 'Default Sales & Delivery Route'
        });
      } else {
        routeId = routes[0].id;
      }
    }

    try {
      let latVal = Number(document.getElementById('shop-modal-lat')?.value) || null;
      let lngVal = Number(document.getElementById('shop-modal-lng')?.value) || null;

      const currentUser = (typeof Auth !== 'undefined' && Auth.currentUser) || null;
      let repId = currentUser ? currentUser.id : null;
      let repName = currentUser ? (currentUser.fullName || currentUser.username) : '';

      // Fallback to live GPS ONLY for field reps/delivery with real GPS (never desktop ISP)
      const isFieldUser = (currentUser && (currentUser.role === 'rep' || currentUser.role === 'delivery'));
      if ((!latVal || !lngVal) && typeof GPS !== 'undefined' && GPS.currentPos && isFieldUser) {
        const cp = GPS.currentPos;
        const isColombo = (cp.lat >= 6.8 && cp.lat <= 7.15 && cp.lng >= 79.75 && cp.lng <= 80.05 && (cp.accuracy || 0) > 300);
        if (!isColombo) {
          latVal = Number(cp.lat.toFixed(7));
          lngVal = Number(cp.lng.toFixed(7));
        }
      }

      // If created/edited by Admin, automatically link to the active Rep assigned to this route
      if (currentUser && currentUser.role === 'admin' && routeId && typeof db !== 'undefined' && db.users) {
        try {
          const allUsers = filterByTenant(await db.users.toArray());
          const routeRep = allUsers.find(u => u.role === 'rep' && u.isActive !== false && (
            (Array.isArray(u.assignedRouteIds) && u.assignedRouteIds.includes(Number(routeId))) ||
            Number(u.assignedRouteId) === Number(routeId)
          ));
          if (routeRep) {
            repId = routeRep.id;
            repName = routeRep.fullName || routeRep.username;
          }
        } catch(e) {}
      }

      let savedShopId = null;
      if (id) {
        // Edit existing shop
        savedShopId = Number(id);
        const existing = await db.shops.get(savedShopId);
        const payload = {
          tenantId: activeTid,
          routeId, name, ownerName, phone, address,
          photoBase64: this.currentPhotoBase64,
          currentCredit,
          lat: latVal || (existing ? existing.lat : null),
          lng: lngVal || (existing ? existing.lng : null),
          gpsTaggedAt: (latVal && lngVal) ? new Date().toISOString() : (existing ? existing.gpsTaggedAt : null),
          isOpen: true,
          qrData: `SHOPPOS:${savedShopId}`,
          updatedAt: new Date().toISOString(),
          isSynced: false,
          repId: existing?.repId || repId,
          repName: existing?.repName || repName,
          createdBy: existing?.createdBy || (currentUser ? currentUser.username : 'admin')
        };
        await db.shops.update(savedShopId, payload);
        UI.showToast('Shop details updated! ✅', 'success');
        if (typeof SoundFX !== 'undefined') SoundFX.play('shop');
      } else {
        // Add new shop
        savedShopId = await db.shops.add({
          tenantId: activeTid,
          routeId, name, ownerName, phone, address,
          photoBase64: this.currentPhotoBase64,
          currentCredit,
          lat: latVal,
          lng: lngVal,
          gpsTaggedAt: (latVal && lngVal) ? new Date().toISOString() : null,
          isOpen: true,
          qrData: '',
          updatedAt: new Date().toISOString(),
          isSynced: false,
          repId: repId,
          repName: repName,
          createdBy: currentUser ? currentUser.username : 'admin'
        });
        // Now set qrData with actual ID
        await db.shops.update(savedShopId, { qrData: `SHOPPOS:${savedShopId}` });

        // Record opening credit into sales ledger if set
        if (currentCredit > 0) {
          try {
            await db.sales.add({
              tenantId: activeTid,
              shopId: savedShopId,
              shopName: name,
              routeId: routeId,
              date: new Date().toISOString(),
              total: currentCredit,
              discount: 0,
              netTotal: currentCredit,
              amountPaid: 0,
              balance: currentCredit,
              paymentMethod: 'credit',
              status: 'completed',
              isOpeningCredit: true,
              repId: repId,
              repName: repName,
              notes: 'පැරණි බිල්පත් ණය ශේෂය (Opening Credit Balance)'
            });
          } catch (e) {}
        }

        UI.showToast('New shop registered! 🏪✓', 'success');
        if (typeof SoundFX !== 'undefined') SoundFX.play('shop');
      }

      UI.closeModal('modal-shop-form');
      this.loadShops();

      // Refresh MapView in background
      if (typeof MapView !== 'undefined' && MapView.refreshMap) {
        MapView.refreshMap();
      }

      // Refresh POS cache and auto-select shop if in POS
      if (typeof POS !== 'undefined') {
        POS.shopsCache = await db.shops.toArray();
        if (State.activeTab === 'pos' && savedShopId) {
          await POS.selectShop(savedShopId);
        }
      }

      if (typeof Dashboard !== 'undefined' && typeof Dashboard.loadDashboard === 'function') {
        Dashboard.loadDashboard();
      }

      if (typeof CloudSync !== 'undefined' && typeof CloudSync.syncNow === 'function') {
        CloudSync.syncNow(false).catch(() => {});
      }
    } catch (err) {
      console.error('Save shop error:', err);
      UI.showToast(`Error saving shop: ${err.message || err}`, 'error');
    }
  },

  // Toggle Open / Closed status
  async toggleShopStatus(shopId, currentIsOpen) {
    const newStatus = !currentIsOpen;
    await db.shops.update(shopId, { isOpen: newStatus });
    UI.showToast(newStatus ? '🟢 Shop marked as OPEN' : '🔴 Shop marked as CLOSED', newStatus ? 'success' : 'warning');
    this.loadShops();
  },

  // Download QR Code as PNG image (Gallery save)
  async downloadQRImage() {
    const shopId = Number(document.getElementById('qr-modal-shop-id').value);
    const shop = await db.shops.get(shopId);
    const company = await db.company.toCollection().first();

    // Get the QR canvas/img
    const qrContainer = document.getElementById('qr-code-canvas-container');
    const qrCanvas = qrContainer.querySelector('canvas');
    const qrImg   = qrContainer.querySelector('img');

    // Build a combined canvas: QR + company name + shop name
    const canvas = document.createElement('canvas');
    const padding = 24;
    const qrSize  = 200;
    const textH   = 70;
    canvas.width  = qrSize + padding * 2;
    canvas.height = qrSize + textH + padding * 2;

    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw QR image
    let qrSource = null;
    if (qrCanvas) {
      qrSource = qrCanvas;
    } else if (qrImg) {
      qrSource = qrImg;
    }
    if (qrSource) {
      ctx.drawImage(qrSource, padding, padding, qrSize, qrSize);
    }

    // Company name
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      (company?.name || 'SPICE WHOLESALE POS').substring(0, 30),
      canvas.width / 2,
      padding + qrSize + 22
    );

    // Shop name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(
      (shop?.name || '').substring(0, 28),
      canvas.width / 2,
      padding + qrSize + 46
    );

    // Thin border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    // Download as PNG
    const link = document.createElement('a');
    link.download = `QR_${(shop?.name || 'shop').replace(/\s+/g, '_')}_${shopId}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    UI.showToast('📥 QR image downloaded!', 'success');
  },

  // View QR Code modal
  async viewShopQR(shopId) {
    const shop = await db.shops.get(shopId);
    if (!shop) return;

    const company = await db.company.toCollection().first();
    const qrData = shop.qrData || `SHOPPOS:${shopId}`;

    document.getElementById('qr-modal-shop-name').textContent = shop.name;
    document.getElementById('qr-modal-company-name').textContent = company?.name || 'SPICE WHOLESALE POS';
    document.getElementById('qr-modal-shop-id').value = shopId;

    // Render QR
    const qrContainer = document.getElementById('qr-code-canvas-container');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: qrData,
      width: 180,
      height: 180,
      colorDark: '#1e293b',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });

    UI.openModal('modal-shop-qr');
  },

  // Print QR Sticker
  async printShopSticker() {
    const shopId = Number(document.getElementById('qr-modal-shop-id').value);
    const shop = await db.shops.get(shopId);
    const company = await db.company.toCollection().first();

    const qrContainer = document.getElementById('qr-code-canvas-container');
    const qrImg = qrContainer.querySelector('img') || qrContainer.querySelector('canvas');
    let qrSrc = '';
    if (qrImg && qrImg.tagName === 'IMG') {
      qrSrc = qrImg.src;
    } else if (qrImg && qrImg.tagName === 'CANVAS') {
      qrSrc = qrImg.toDataURL();
    }

    const receiptContainer = document.getElementById('thermal-receipt-container');
    receiptContainer.innerHTML = `
      <div class="thermal-receipt" style="text-align:center; font-family: 'Courier New', monospace; padding: 8px;">
        <div style="font-size:11px; font-weight:bold;">${company?.name || 'SPICE WHOLESALE POS'}</div>
        <div style="font-size:9px;">${company?.phone || ''}</div>
        <div style="margin: 6px 0;">
          ${qrSrc ? `<img src="${qrSrc}" style="width:160px; height:160px;" />` : '[QR CODE]'}
        </div>
        <div style="font-size:12px; font-weight:bold; margin-top:4px;">${shop?.name || ''}</div>
        <div style="font-size:9px; margin-top:2px;">Route: ${shop?.routeId ? '' : ''}</div>
        <div style="border-top: 1px dashed #000; margin-top:6px; padding-top:4px; font-size:8px;">Scan to access shop in POS</div>
      </div>
    `;
    setTimeout(() => window.print(), 150);
  },

  // Confirm Delete Shop
  async confirmDeleteShop(shopId) {
    const shop = await db.shops.get(shopId);
    if (!shop) return;

    const salesCount = await db.sales.where('shopId').equals(shopId).count();
    document.getElementById('delete-shop-modal-name').textContent = shop.name;
    document.getElementById('delete-shop-modal-count').textContent = `${salesCount} invoice(s) will also be deleted.`;
    document.getElementById('delete-shop-modal-id').value = shopId;
    UI.openModal('modal-delete-shop');
  },

  async deleteShop() {
    const shopId = Number(document.getElementById('delete-shop-modal-id').value);
    try {
      // Get all sales for this shop
      const sales = await db.sales.where('shopId').equals(shopId).toArray();
      const saleIds = sales.map(s => s.id);

      // Delete sale items
      if (saleIds.length > 0) {
        await db.saleItems.where('saleId').anyOf(saleIds).delete();
      }

      // Delete sales
      await db.sales.where('shopId').equals(shopId).delete();

      // Delete credit payments
      await db.creditPayments.where('shopId').equals(shopId).delete();

      // Delete shop
      await db.shops.delete(shopId);

      UI.closeModal('modal-delete-shop');
      UI.showToast('Shop and all related data deleted! 🗑️', 'success');
      this.loadShops();
      Dashboard.loadDashboard();
    } catch (err) {
      UI.showToast('Error deleting shop', 'error');
      console.error(err);
    }
  },

  // Debt Collection Modal
  async openDebtCollectionModal(shopId) {
    const shop = await db.shops.get(shopId);
    if (!shop) return;

    document.getElementById('debt-modal-shop-id').value = shop.id;
    document.getElementById('debt-modal-shop-name').textContent = shop.name;
    document.getElementById('debt-modal-current-credit').textContent = UI.formatCurrency(shop.currentCredit);
    document.getElementById('debt-modal-amount').value = '';
    document.getElementById('debt-modal-note').value = '';

    UI.openModal('modal-debt-collection');
  },

  async submitDebtCollection() {
    const shopId = Number(document.getElementById('debt-modal-shop-id').value);
    const amountPaid = Number(document.getElementById('debt-modal-amount').value) || 0;
    const note = document.getElementById('debt-modal-note').value.trim();

    if (amountPaid <= 0) { UI.showToast('Please enter a valid amount paid', 'warning'); return; }

    const shop = await db.shops.get(shopId);
    if (!shop) return;

    const previousCredit = shop.currentCredit || 0;
    const newCredit = Math.max(0, previousCredit - amountPaid);

    await db.creditPayments.add({
      shopId: shop.id, routeId: shop.routeId,
      date: new Date().toISOString(),
      amountPaid, previousCredit, newCredit,
      note: note || 'Credit collection'
    });

    await db.shops.update(shop.id, { currentCredit: newCredit });

    UI.closeModal('modal-debt-collection');
    UI.showToast(`Collected ${UI.formatCurrency(amountPaid)}. Balance: ${UI.formatCurrency(newCredit)}`, 'success');
    this.loadShops();
    Dashboard.loadDashboard();
  },

  // View Comprehensive Shop Transaction & Order History
  _cachedHistoryEvents: [],
  _currentHistoryShopId: null,

  async viewShopHistory(shopId) {
    if (!shopId) {
      UI.showToast('Please select a shop first to view history (කරුණාකර පළමුව කඩය තෝරන්න)', 'warning');
      return;
    }
    const numId = Number(shopId);
    const shop = await db.shops.get(numId);
    if (!shop) {
      UI.showToast('Shop details not found', 'error');
      return;
    }
    this._currentHistoryShopId = numId;

    const route = shop.routeId ? await db.routes.get(Number(shop.routeId)) : null;
    
    // Type-resilient fetch for sales and payments
    const allSales = await db.sales.toArray();
    const sales = allSales.filter(s => Number(s.shopId) === numId);

    let payments = [];
    if (db.creditPayments) {
      const allPayments = await db.creditPayments.toArray();
      payments = allPayments.filter(p => Number(p.shopId) === numId);
    }

    // Header Details
    const nameEl = document.getElementById('hist-modal-shop-name');
    const subEl = document.getElementById('hist-modal-shop-sub');
    if (nameEl) nameEl.textContent = shop.name;
    if (subEl) subEl.textContent = `${shop.ownerName || 'Owner'} • ${shop.phone || 'No phone'} • 🗺️ ${route ? route.name : 'Unassigned'}`;

    const totalBills = sales.length;
    const totalSpent = sales.filter(s => s.status !== 'Cancelled').reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const currentCredit = Number(shop.currentCredit) || 0;

    const totalBillsEl = document.getElementById('hist-modal-total-bills');
    const totalSpentEl = document.getElementById('hist-modal-total-spent');
    const currentCreditEl = document.getElementById('hist-modal-current-credit');

    if (totalBillsEl) totalBillsEl.textContent = `${totalBills} Bills`;
    if (totalSpentEl) totalSpentEl.textContent = UI.formatCurrency(totalSpent);
    if (currentCreditEl) currentCreditEl.textContent = UI.formatCurrency(currentCredit);

    // Combine & Sort Events
    const events = [];
    const allSaleItems = await db.saleItems.toArray();
    const allReturns = db.salesReturns ? await db.salesReturns.toArray() : [];

    for (const sale of sales) {
      const saleId = Number(sale.id);
      const items = allSaleItems.filter(i => Number(i.saleId) === saleId);
      const returns = allReturns.filter(r => Number(r.saleId) === saleId);

      events.push({
        type: 'sale',
        id: sale.id,
        invoiceNo: sale.invoiceNo,
        date: sale.date,
        deliveryDate: sale.deliveryDate,
        totalAmount: sale.totalAmount,
        paidAmount: sale.paidAmount,
        creditAmount: sale.creditAmount,
        paymentType: sale.paymentType,
        status: sale.status || (sale.deliveryDate ? 'Pending' : 'Delivered'),
        repName: sale.repName || 'Admin',
        orderType: sale.orderType || (sale.deliveryDate ? 'BookTomorrow' : 'DirectSale'),
        items: items,
        returns: returns,
        note: sale.note || ''
      });
    }

    for (const pay of payments) {
      events.push({
        type: 'payment',
        id: pay.id,
        date: pay.date,
        amountPaid: pay.amountPaid,
        previousCredit: pay.previousCredit,
        newCredit: pay.newCredit,
        note: pay.note || 'Debt payment collection'
      });
    }

    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    this._cachedHistoryEvents = events;

    const searchInput = document.getElementById('hist-search-input');
    if (searchInput) searchInput.value = '';

    this.renderHistoryList(events, numId);
    UI.openModal('modal-shop-history');
  },

  renderHistoryList(events, shopId) {
    const listContainer = document.getElementById('hist-modal-list-container');
    if (!listContainer) return;
    const targetShopId = shopId || this._currentHistoryShopId;

    if (!events || events.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 p-4">
          <div class="text-3xl mb-1">📜</div>
          <p class="text-xs font-bold">No past orders or payments recorded yet.</p>
          <p class="text-[10px] text-slate-400 mt-0.5">Orders and bill history will appear here automatically.</p>
        </div>
      `;
      return;
    }

    let html = '';
    for (const ev of events) {
      if (ev.type === 'sale') {
        const isCancelled = ev.status === 'Cancelled';
        const isBooking = ev.orderType === 'BookTomorrow' || ev.status === 'Pending';

        let itemsHtml = '';
        if (ev.items && ev.items.length > 0) {
          itemsHtml = `
            <div class="mt-2 pt-2 border-t border-slate-100 space-y-1">
              <span class="text-[10px] font-black text-slate-500 uppercase tracking-wider block">📦 Items Purchased (ගනුදෙනු කල භාණ්ඩ):</span>
              <div class="bg-slate-50 rounded-xl p-2 space-y-1">
                ${ev.items.map(it => `
                  <div class="flex items-center justify-between text-xs py-0.5">
                    <span class="font-bold text-slate-800">
                      • ${it.productName} <span class="text-slate-500 font-semibold">(${it.qty} ${it.unit})</span>
                      ${it.freeQty > 0 ? `<span class="ml-1 px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 text-[9px] font-black">🎁 +${it.freeQty} FREE</span>` : ''}
                    </span>
                    <span class="font-bold text-slate-700">
                      Rs. ${(Number(it.sellingPrice) * Number(it.qty)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }

        let returnsHtml = '';
        if (ev.returns && ev.returns.length > 0) {
          returnsHtml = `
            <div class="mt-1.5 bg-red-50/70 border border-red-200/60 rounded-xl p-2 space-y-1">
              <span class="text-[10px] font-black text-red-700 uppercase tracking-wider block">🔄 Returns / Replacements (ආපසු/මාරු):</span>
              ${ev.returns.map(r => `
                <div class="flex items-center justify-between text-[11px] text-red-800 font-bold">
                  <span>${r.action === 'deduct' ? '• [Deducted]' : '• [Exchange]'} ${r.productName} (${r.qty} ${r.returnType === 'Unit' ? 'Loose Pkts' : 'Cards'})</span>
                  <span>${r.action === 'deduct' ? '-' + UI.formatCurrency(r.refundAmount) : '✓ Replaced'}</span>
                </div>
              `).join('')}
            </div>
          `;
        }

        html += `
          <div class="bg-white rounded-2xl border ${isCancelled ? 'border-red-200 bg-red-50/30' : 'border-slate-200'} p-3.5 shadow-sm space-y-2 hover:border-indigo-300 transition-all">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="px-2 py-0.5 rounded-lg text-[10px] font-black ${isBooking ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}">
                    ${isBooking ? '📦 DELIVERY BOOKING' : '⚡ DIRECT SALE'}
                  </span>
                  <span class="text-xs font-black text-slate-900">#${ev.invoiceNo}</span>
                  <span class="text-[10px] font-semibold text-slate-500">by ${ev.repName}</span>
                </div>
                <div class="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                  <span>📅 ${UI.formatDateTime(ev.date)}</span>
                  ${ev.deliveryDate ? `<span>• Del: ${UI.formatDate(ev.deliveryDate)}</span>` : ''}
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-black text-slate-900">${UI.formatCurrency(ev.totalAmount)}</div>
                <span class="inline-block text-[10px] font-black px-2 py-0.5 rounded-full ${
                  ev.paymentType === 'Cash' ? 'bg-emerald-100 text-emerald-800' :
                  ev.paymentType === 'Credit' ? 'bg-red-100 text-red-800' :
                  'bg-amber-100 text-amber-800'
                }">
                  ${ev.paymentType || 'Cash'}
                </span>
              </div>
            </div>

            ${itemsHtml}
            ${returnsHtml}

            <!-- Bill Footer Actions -->
            <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs flex-wrap gap-1">
              <span class="text-[10px] text-slate-400">Paid: ${UI.formatCurrency(ev.paidAmount || 0)} | Credit: ${UI.formatCurrency(ev.creditAmount || 0)}</span>
              <div class="flex items-center gap-1.5">
                <button onclick="Print.previewInvoice(${ev.id})" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold rounded-xl active:scale-95 flex items-center gap-1 border border-indigo-200" title="Preview Thermal Receipt">
                  <span>👁️ Preview</span>
                </button>
                <button onclick="Print.printExistingInvoice(${ev.id})" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl active:scale-95 flex items-center gap-1 border border-slate-200" title="Print Receipt">
                  <span>🖨️ Print</span>
                </button>
                <button onclick="Shops.confirmDeleteSale(${ev.id}, ${targetShopId})" class="p-1 text-red-400 hover:text-red-600 rounded-lg" title="Delete Invoice">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        `;
      } else if (ev.type === 'payment') {
        html += `
          <div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-200/80 shadow-xs flex items-center justify-between gap-2">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-200 text-emerald-900">💵 DEBT PAYMENT</span>
                <span class="text-xs text-emerald-800 font-bold">${UI.formatDateTime(ev.date)}</span>
              </div>
              <p class="text-[11px] text-emerald-700 mt-1">${ev.note || 'Debt Collection'}</p>
              <p class="text-[10px] text-slate-500 mt-0.5">Credit: ${UI.formatCurrency(ev.previousCredit)} ➔ ${UI.formatCurrency(ev.newCredit)}</p>
            </div>
            <div class="text-right flex flex-col items-end gap-1.5 flex-shrink-0">
              <div class="text-sm font-black text-emerald-800">+${UI.formatCurrency(ev.amountPaid)}</div>
              <button onclick="Print.printCollectionReceipt(${ev.id})" class="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all" title="Print Collection Receipt">
                🖨️ Print
              </button>
            </div>
          </div>
        `;
      }
    }

    listContainer.innerHTML = html;
  },

  filterHistoryList(searchTerm) {
    if (!this._cachedHistoryEvents) return;
    if (!searchTerm || !searchTerm.trim()) {
      this.renderHistoryList(this._cachedHistoryEvents, this._currentHistoryShopId);
      return;
    }
    const t = searchTerm.toLowerCase().trim();
    const filtered = this._cachedHistoryEvents.filter(ev => {
      if (ev.type === 'sale') {
        const matchInv = String(ev.invoiceNo || '').toLowerCase().includes(t);
        const matchRep = String(ev.repName || '').toLowerCase().includes(t);
        const matchDate = String(ev.date || '').toLowerCase().includes(t);
        const matchStatus = String(ev.status || '').toLowerCase().includes(t);
        const matchItems = (ev.items || []).some(it => String(it.productName || '').toLowerCase().includes(t));
        const matchReturns = (ev.returns || []).some(r => String(r.productName || '').toLowerCase().includes(t));
        return matchInv || matchRep || matchDate || matchStatus || matchItems || matchReturns;
      } else {
        const matchNote = String(ev.note || '').toLowerCase().includes(t);
        const matchDate = String(ev.date || '').toLowerCase().includes(t);
        return matchNote || matchDate;
      }
    });
    this.renderHistoryList(filtered, this._currentHistoryShopId);
  },

  // Confirm delete a single sale from history
  async confirmDeleteSale(saleId, shopId) {
    if (!confirm('Delete this invoice? Credit will be reversed if applicable.')) return;
    await this._deleteSaleRecord(saleId);
    UI.showToast('Invoice deleted! 🗑️', 'success');
    await this.viewShopHistory(shopId || this._currentHistoryShopId);
    Dashboard.loadDashboard();
  },

  async grabCurrentGpsForModal() {
    try {
      UI.showToast('📡 Satellite GPS fix ලබා ගනිමින්... (Acquiring GPS)', 'info');
      let pos = null;
      if (typeof GPS !== 'undefined' && GPS.requestImmediateFix) {
        pos = await GPS.requestImmediateFix();
      } else if (navigator.geolocation) {
        pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
            err => reject(err),
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
          );
        });
      }

      if (pos && pos.lat && pos.lng) {
        // Discard Colombo ISP gateway fallback if accuracy is coarse (>300m)
        const isColombo = (pos.lat >= 6.8 && pos.lat <= 7.15 && pos.lng >= 79.75 && pos.lng <= 80.05 && (pos.accuracy || 0) > 300);
        if (isColombo) {
          UI.showToast('⚠️ Desktop/ISP Location Detected (Colombo). Phone GPS භාවිතා කරන්න හෝ Map එකෙන් ලකුණු කරන්න.', 'warning');
          return;
        }
        const latEl = document.getElementById('shop-modal-lat');
        const lngEl = document.getElementById('shop-modal-lng');
        if (latEl) latEl.value = Number(pos.lat).toFixed(7);
        if (lngEl) lngEl.value = Number(pos.lng).toFixed(7);
        if (typeof SoundFX !== 'undefined') SoundFX.play('shop');
        UI.showToast(`📍 GPS Captured! [${Number(pos.lat).toFixed(5)}, ${Number(pos.lng).toFixed(5)}] ±${Math.round(pos.accuracy || 5)}m`, 'success');
      } else {
        UI.showToast('GPS coordinates not available — please turn on Phone Location', 'warning');
      }
    } catch (e) {
      UI.showToast('Could not acquire GPS: ' + (e.message || 'Please enable Location'), 'error');
    }
  },

  async _deleteSaleRecord(saleId) {
    const sale = await db.sales.get(saleId);
    if (!sale) return;

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
  }
};
