/**
 * RouteSession — Daily Active Route Lifecycle, Field Attendance & Photo Verification for MOB POS
 * 1. Morning Route Start:
 *    - Captures Bike Meter Photo & Starting KM Reading
 *    - Captures Rep Morning Selfie Photo
 *    - Automatically Clocks Today's Attendance as "Present" with GPS & Check-In Time
 * 2. Route Lock:
 *    - Locks POS & Map to that specific route
 * 3. Evening Route End:
 *    - Captures Closing Bike Meter Photo & Ending KM Reading
 *    - Captures Rep Closing Selfie Photo
 *    - Automatically calculates Total Distance (KM) traveled today
 *    - Automatically clocks Attendance "Check-Out" Time
 * 4. Shop Display & Promotion Photos:
 *    - Snaps & saves Hanging Spice Display Card photos and Promotion Banner photos
 *    - Saves with Shop, Rep, GPS, and timestamp into db.fieldPhotos
 * 5. Manager Live Alerts (Admin, SM, ASM, Supervisor)
 */

const RouteSession = {
  _activeSession: null,
  _pendingRouteId: null,

  init() {
    this.loadSession();
    this.renderBanners();
    this.initManagerListener();
  },

  /** Helper to compress uploaded / captured image file to lightweight Base64 */
  compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /** Load current session for today from storage */
  loadSession() {
    const todayStr = new Date().toISOString().split('T')[0];
    const repId = (Auth.currentUser && Auth.currentUser.id) ? Auth.currentUser.id : 1;
    const key = `mob_pos_route_session_${repId}_${todayStr}`;
    
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.status === 'active') {
          this._activeSession = parsed;
          return this._activeSession;
        }
      }
    } catch (e) {}

    this._activeSession = null;
    return null;
  },

  getActiveSession() {
    if (!this._activeSession) this.loadSession();
    return this._activeSession;
  },

  isRouteActive() {
    const sess = this.getActiveSession();
    return Boolean(sess && sess.status === 'active' && sess.routeId);
  },

  /** Prompt Rep to pick and start route with Attendance & Bike Meter */
  async openStartRoutePrompt(presetRouteId = null) {
    let routeId = presetRouteId;
    if (!routeId) {
      const sel = document.getElementById('pos-route-select');
      routeId = sel ? sel.value : null;
    }

    if (!routeId) {
      UI.showToast('කරුණාකර අද යන Route එක තෝරා "Start Route" ඔබන්න.', 'warning');
      return;
    }

    const route = await db.routes.get(Number(routeId));
    if (!route) {
      UI.showToast('Route not found', 'error');
      return;
    }

    this._pendingRouteId = Number(routeId);

    // Populate Modal
    const titleEl = document.getElementById('start-route-modal-name');
    if (titleEl) titleEl.textContent = route.name;

    const repNameEl = document.getElementById('start-route-modal-rep');
    if (repNameEl) repNameEl.textContent = Auth.currentUser?.fullName || 'Sales Rep';

    // Clear previous inputs
    const meterKmInput = document.getElementById('start-route-meter-km');
    if (meterKmInput) meterKmInput.value = '';

    const meterPhotoInput = document.getElementById('start-route-meter-photo');
    if (meterPhotoInput) meterPhotoInput.value = '';

    const selfiePhotoInput = document.getElementById('start-route-selfie-photo');
    if (selfiePhotoInput) selfiePhotoInput.value = '';

    const previewMeter = document.getElementById('start-route-preview-meter');
    if (previewMeter) { previewMeter.src = ''; previewMeter.classList.add('hidden'); }

    const previewSelfie = document.getElementById('start-route-preview-selfie');
    if (previewSelfie) { previewSelfie.src = ''; previewSelfie.classList.add('hidden'); }

    UI.openModal('modal-start-route-attendance');
  },

  /** Image preview handlers */
  handlePhotoPreview(inputEl, previewImgId) {
    const file = inputEl.files?.[0];
    const previewEl = document.getElementById(previewImgId);
    if (!file || !previewEl) return;
    const url = URL.createObjectURL(file);
    previewEl.src = url;
    previewEl.classList.remove('hidden');
  },

  /** Submit Start Route with Attendance, Meter & Selfie */
  async submitStartRouteAttendance() {
    const routeId = this._pendingRouteId;
    if (!routeId) return;

    const route = await db.routes.get(Number(routeId));
    if (!route) return;

    const meterKmVal = document.getElementById('start-route-meter-km')?.value?.trim();
    const startKm = Number(meterKmVal) || 0;

    const meterFile = document.getElementById('start-route-meter-photo')?.files?.[0];
    const selfieFile = document.getElementById('start-route-selfie-photo')?.files?.[0];

    // Compress photos
    let meterPhotoB64 = '';
    let selfiePhotoB64 = '';

    if (meterFile) {
      try { meterPhotoB64 = await this.compressImage(meterFile); } catch (e) {}
    }
    if (selfieFile) {
      try { selfiePhotoB64 = await this.compressImage(selfieFile); } catch (e) {}
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const user = Auth.currentUser || { id: 1, username: 'rep', fullName: 'Sales Rep' };
    const repId = user.id || 1;
    const repName = user.fullName || user.username || 'Sales Rep';
    const gpsPos = (typeof GPS !== 'undefined' && GPS.currentPos) ? GPS.currentPos : null;

    const session = {
      tenantId: getActiveTenantId() || 1,
      routeId: Number(route.id),
      routeName: route.name,
      repId: repId,
      repName: repName,
      startedAt: new Date().toISOString(),
      startedTimeText: timeStr,
      startKm: startKm,
      startMeterPhoto: meterPhotoB64,
      selfiePhoto: selfiePhotoB64,
      status: 'active',
      date: todayStr,
      timestamp: Date.now()
    };

    this._activeSession = session;
    const key = `mob_pos_route_session_${repId}_${todayStr}`;
    localStorage.setItem(key, JSON.stringify(session));

    // 1. Auto-Log Attendance in db.attendance
    try {
      if (db.attendance) {
        const empNo = `EMP-${String(repId).padStart(3, '0')}`;
        const existingAtt = await db.attendance.where('date').equals(todayStr).and(a => a.empNo === empNo || a.employeeName === repName).first();
        const attPayload = {
          empNo: empNo,
          employeeName: repName,
          date: todayStr,
          checkIn: timeStr,
          status: 'Present',
          startMeterKm: startKm,
          startMeterPhoto: meterPhotoB64,
          selfiePhoto: selfiePhotoB64,
          gpsLat: gpsPos?.lat || null,
          gpsLng: gpsPos?.lng || null,
          tenantId: getActiveTenantId() || 1,
          updatedAt: new Date().toISOString()
        };

        if (existingAtt) {
          await db.attendance.update(existingAtt.id, attPayload);
        } else {
          await db.attendance.add(attPayload);
        }
      }

      // 2. Save Photos to db.fieldPhotos for HR/Supervisor inspection
      if (db.fieldPhotos) {
        if (meterPhotoB64) {
          await db.fieldPhotos.add({
            tenantId: getActiveTenantId() || 1,
            repId: repId,
            repName: repName,
            routeId: Number(route.id),
            routeName: route.name,
            photoType: 'BIKE_METER_START',
            photoUrl: meterPhotoB64,
            caption: `Morning Bike Meter: ${startKm} km`,
            date: todayStr,
            time: timeStr,
            gps: gpsPos
          });
        }
        if (selfiePhotoB64) {
          await db.fieldPhotos.add({
            tenantId: getActiveTenantId() || 1,
            repId: repId,
            repName: repName,
            routeId: Number(route.id),
            routeName: route.name,
            photoType: 'REP_SELFIE_START',
            photoUrl: selfiePhotoB64,
            caption: `Rep Morning Check-in Selfie`,
            date: todayStr,
            time: timeStr,
            gps: gpsPos
          });
        }
      }
    } catch (attErr) {
      console.warn('Attendance auto-clock warning:', attErr);
    }

    // 3. Lock POS to this route
    if (typeof POS !== 'undefined' && POS.onRouteSelected) {
      POS.activeRouteId = Number(route.id);
      const sel = document.getElementById('pos-route-select');
      if (sel) {
        sel.value = route.id;
        sel.disabled = true;
      }
      await POS.onRouteSelected(route.id);
    }

    // 4. Lock Map
    if (typeof MapView !== 'undefined') {
      MapView.activeRouteId = String(route.id);
      const mapRouteSel = document.getElementById('map-route-filter');
      if (mapRouteSel) mapRouteSel.value = String(route.id);
      MapView.refreshMap();
    }

    // 5. Broadcast to managers
    this.broadcastSessionEvent('ROUTE_STARTED', session);

    UI.closeModal('modal-start-route-attendance');
    if (typeof SoundFX !== 'undefined') SoundFX.play('route');
    UI.showToast(`🚀 Route Started & Attendance Recorded! Meter: ${startKm} KM`, 'success');

    this.renderBanners();
  },

  /** End Route Modal Prompt */
  async endRoute() {
    const session = this.getActiveSession();
    if (!session) {
      UI.showToast('No active route session found', 'info');
      return;
    }

    const todayStr = session.date || new Date().toISOString().split('T')[0];
    const rawSales = await db.sales.toArray();
    const routeSales = rawSales.filter(s =>
      s.status !== 'Cancelled' &&
      s.date && s.date.startsWith(todayStr) &&
      Number(s.routeId) === Number(session.routeId) &&
      String(s.repId) === String(session.repId)
    );

    const totalSalesAmount = routeSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const visitedShopsSet = new Set(routeSales.map(s => Number(s.shopId)));
    const rawShops = await db.shops.where('routeId').equals(Number(session.routeId)).toArray();

    // Populate End Route Modal
    document.getElementById('end-route-modal-name').textContent = session.routeName;
    document.getElementById('end-route-modal-start-km').textContent = `${session.startKm || 0} KM`;
    document.getElementById('end-route-modal-sales').textContent = UI.formatCurrency(totalSalesAmount);
    document.getElementById('end-route-modal-shops').textContent = `${visitedShopsSet.size} / ${rawShops.length} Shops`;

    const endKmInput = document.getElementById('end-route-meter-km');
    if (endKmInput) {
      endKmInput.value = '';
      endKmInput.min = session.startKm || 0;
    }

    const previewEndMeter = document.getElementById('end-route-preview-meter');
    if (previewEndMeter) { previewEndMeter.src = ''; previewEndMeter.classList.add('hidden'); }

    const previewEndSelfie = document.getElementById('end-route-preview-selfie');
    if (previewEndSelfie) { previewEndSelfie.src = ''; previewEndSelfie.classList.add('hidden'); }

    UI.openModal('modal-end-route-attendance');
  },

  /** Live calculate distance traveled on end modal input */
  onEndKmInput(val) {
    const session = this.getActiveSession();
    const startKm = Number(session?.startKm) || 0;
    const endKm = Number(val) || 0;
    const diff = Math.max(0, endKm - startKm);
    const diffEl = document.getElementById('end-route-modal-diff-km');
    if (diffEl) diffEl.textContent = `${diff} KM Total`;
  },

  /** Submit End Route with Closing Meter & Closing Selfie */
  async submitEndRouteAttendance() {
    const session = this.getActiveSession();
    if (!session) return;

    const endKmVal = document.getElementById('end-route-meter-km')?.value?.trim();
    const endKm = Number(endKmVal) || (Number(session.startKm) || 0);
    const startKm = Number(session.startKm) || 0;
    const totalKmTravelled = Math.max(0, endKm - startKm);

    const meterFile = document.getElementById('end-route-meter-photo')?.files?.[0];
    const selfieFile = document.getElementById('end-route-selfie-photo')?.files?.[0];

    let meterPhotoB64 = '';
    let selfiePhotoB64 = '';

    if (meterFile) {
      try { meterPhotoB64 = await this.compressImage(meterFile); } catch (e) {}
    }
    if (selfieFile) {
      try { selfiePhotoB64 = await this.compressImage(selfieFile); } catch (e) {}
    }

    const todayStr = session.date || new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const repId = session.repId || 1;
    const repName = session.repName || 'Sales Rep';

    // 1. Update Attendance Check-out in db.attendance
    try {
      if (db.attendance) {
        const empNo = `EMP-${String(repId).padStart(3, '0')}`;
        const existingAtt = await db.attendance.where('date').equals(todayStr).and(a => a.empNo === empNo || a.employeeName === repName).first();
        if (existingAtt) {
          await db.attendance.update(existingAtt.id, {
            checkOut: timeStr,
            endMeterKm: endKm,
            endMeterPhoto: meterPhotoB64,
            closingSelfiePhoto: selfiePhotoB64,
            totalKm: totalKmTravelled,
            updatedAt: new Date().toISOString()
          });
        }
      }

      // 2. Save Closing Photos in db.fieldPhotos
      if (db.fieldPhotos && meterPhotoB64) {
        await db.fieldPhotos.add({
          tenantId: getActiveTenantId() || 1,
          repId: repId,
          repName: repName,
          routeId: session.routeId,
          routeName: session.routeName,
          photoType: 'BIKE_METER_END',
          photoUrl: meterPhotoB64,
          caption: `Closing Bike Meter: ${endKm} km (Distance: ${totalKmTravelled} km)`,
          date: todayStr,
          time: timeStr
        });
      }
    } catch (e) {
      console.warn('Attendance checkout warning:', e);
    }

    // Complete session
    const key = `mob_pos_route_session_${repId}_${todayStr}`;
    session.status = 'ended';
    session.endedAt = new Date().toISOString();
    session.endedTimeText = timeStr;
    session.endKm = endKm;
    session.totalKm = totalKmTravelled;
    localStorage.removeItem(key);

    this._activeSession = null;

    // Unlock POS dropdown
    const sel = document.getElementById('pos-route-select');
    if (sel) sel.disabled = false;

    this.broadcastSessionEvent('ROUTE_ENDED', session);

    UI.closeModal('modal-end-route-attendance');
    if (typeof SoundFX !== 'undefined') SoundFX.play('save');
    UI.showToast(`🏁 Route Completed! Total Bike Travel: ${totalKmTravelled} KM. Attendance Checked Out!`, 'success');

    this.renderBanners();
  },

  /** Open Shop Display / Promotion Photo Modal */
  async openShopPhotoModal(shopId = null) {
    let targetShopId = shopId;
    if (!targetShopId && typeof POS !== 'undefined' && POS.activeShopId) {
      targetShopId = POS.activeShopId;
    }

    const shop = targetShopId ? await db.shops.get(Number(targetShopId)) : null;
    const shopName = shop ? shop.name : 'Current Field Shop';

    document.getElementById('shop-photo-modal-shop-name').textContent = shopName;
    document.getElementById('shop-photo-modal-shop-id').value = targetShopId || '';
    document.getElementById('shop-photo-notes').value = '';

    const preview = document.getElementById('shop-photo-preview');
    if (preview) { preview.src = ''; preview.classList.add('hidden'); }

    UI.openModal('modal-shop-display-photos');
  },

  /** Submit Shop Display / Promotion Photo */
  async submitShopPhoto() {
    const file = document.getElementById('shop-photo-file')?.files?.[0];
    if (!file) {
      UI.showToast('Please capture or select a photo', 'warning');
      return;
    }

    const shopId = document.getElementById('shop-photo-modal-shop-id')?.value;
    const shop = shopId ? await db.shops.get(Number(shopId)) : null;
    const shopName = shop ? shop.name : 'Unknown Shop';

    const photoType = document.getElementById('shop-photo-type')?.value || 'SPICE_DISPLAY';
    const notes = document.getElementById('shop-photo-notes')?.value?.trim() || '';

    let photoB64 = '';
    try {
      photoB64 = await this.compressImage(file);
    } catch (e) {
      UI.showToast('Failed to process image', 'error');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const user = Auth.currentUser || { id: 1, username: 'rep', fullName: 'Sales Rep' };
    const gpsPos = (typeof GPS !== 'undefined' && GPS.currentPos) ? GPS.currentPos : null;

    if (db.fieldPhotos) {
      await db.fieldPhotos.add({
        tenantId: getActiveTenantId() || 1,
        shopId: shopId ? Number(shopId) : null,
        shopName: shopName,
        repId: user.id || 1,
        repName: user.fullName || user.username || 'Sales Rep',
        photoType: photoType,
        photoUrl: photoB64,
        notes: notes,
        date: todayStr,
        time: timeStr,
        gps: gpsPos
      });
    }

    UI.closeModal('modal-shop-display-photos');
    UI.showToast(`📸 ${photoType === 'SPICE_DISPLAY' ? 'Card Display' : 'Promotion'} Photo Saved Successfully!`, 'success');
  },

  /** Broadcast event to manager screens */
  broadcastSessionEvent(type, session) {
    try {
      const payload = { type, session, timestamp: Date.now() };
      localStorage.setItem('mob_pos_last_route_session_broadcast', JSON.stringify(payload));
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('mob_pos_route_session_channel');
        bc.postMessage(payload);
      }
    } catch (e) {}
  },

  /** Listen for events */
  initManagerListener() {
    const handleEvent = (data) => {
      if (!data || !data.session) return;
      const role = Auth.currentUser?.role;
      const isManager = role === 'admin' || role === 'superadmin' || role === 'sm' || role === 'asm' || role === 'supervisor' || role === 'hr';

      if (isManager) {
        if (data.type === 'ROUTE_STARTED') {
          if (typeof SoundFX !== 'undefined') SoundFX.play('order_alert');
          UI.showToast(`🚚 🔔 REP STARTED ROUTE: ${data.session.repName} started "${data.session.routeName}" (Meter: ${data.session.startKm || 0} KM)!`, 'info');
        } else if (data.type === 'ROUTE_ENDED') {
          if (typeof SoundFX !== 'undefined') SoundFX.play('order_alert');
          UI.showToast(`🏁 🔔 REP ENDED ROUTE: ${data.session.repName} completed "${data.session.routeName}" (Travelled: ${data.session.totalKm || 0} KM)`, 'success');
        }
      }
    };

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('mob_pos_route_session_channel');
        bc.onmessage = (e) => handleEvent(e.data);
      }
    } catch (e) {}

    window.addEventListener('storage', (e) => {
      if (e.key === 'mob_pos_last_route_session_broadcast' && e.newValue) {
        try { handleEvent(JSON.parse(e.newValue)); } catch (err) {}
      }
    });
  },

  /** Render dynamic status banner in POS */
  renderBanners() {
    const session = this.getActiveSession();
    const posBanner = document.getElementById('pos-active-route-banner');
    if (!posBanner) return;

    if (session && session.status === 'active') {
      posBanner.innerHTML = `
        <div class="bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 text-white p-3 rounded-2xl shadow-lg border border-emerald-500/40 flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-base">🔒</div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-black uppercase tracking-wider text-emerald-300">Active Route Locked (අද මාර්ගය)</span>
              </div>
              <h4 class="font-black text-xs sm:text-sm text-white">${session.routeName}</h4>
              <span class="text-[10px] text-emerald-200">Started: ${session.startedTimeText || 'Today'} · Start Meter: ${session.startKm || 0} KM · Attendance Marked Present ✓</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="RouteSession.openShopPhotoModal()" class="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl active:scale-95 flex items-center gap-1">
              <span>📸 Display Photo</span>
            </button>
            <button onclick="RouteSession.endRoute()" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1">
              <span>🛑 End Route</span>
            </button>
          </div>
        </div>
      `;
      posBanner.classList.remove('hidden');
    } else {
      posBanner.innerHTML = `
        <div class="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent p-3 rounded-2xl border border-amber-300/60 flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-xl">🛵</span>
            <div>
              <span class="font-black text-xs text-amber-900 block">Start Today's Route & Clock Attendance</span>
              <span class="text-[10px] text-amber-800">Select route, take bike meter & selfie to clock attendance</span>
            </div>
          </div>
          <button onclick="RouteSession.openStartRoutePrompt()" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow active:scale-95">
            ▶️ Start Route (අරඹන්න)
          </button>
        </div>
      `;
      posBanner.classList.remove('hidden');
    }
  }
};

window.RouteSession = RouteSession;
