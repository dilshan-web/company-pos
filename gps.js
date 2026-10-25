/**
 * GPS & Real-Time Geolocation Tracking Engine for MOB POS
 * 1. Step-Level Pinpoint Accuracy (Tracks movements of 1-2 meters instantly)
 * 2. Automatic Zero-Click Background Activation on ANY User Login
 * 3. High-Frequency Real-Time Sync (Syncs every 3-4s to Cloud & Broadcast)
 * 4. Automatic Wake-up / Keep-Alive Watchdog (No timeouts, auto-recovers)
 * 5. Visual Live Status Indicator in Top Header Bar
 * 6. Turn-by-Turn Navigation with Google Maps & Live Directions
 * 7. Breadcrumb route recording & Out-of-route detection
 */

const GPS = {
  currentPos: null, // { lat, lng, accuracy, speed, heading, timestamp }
  lastSyncedPos: null,
  watchId: null,
  isTracking: false,
  isGpsAvailable: false,
  lastRecordedTime: 0,
  lastPositionTime: 0,
  _heartbeatInterval: null,
  _autoRetryTimer: null,
  _isAcquiringFix: false,

  /** Haversine formula to compute exact distance in meters between two coordinates */
  getDistanceMeters(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  init() {
    this.restoreCachedPosition();

    // Listen for phone wake-up / network reconnect to instantly refresh GPS
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && typeof Auth !== 'undefined' && Auth.currentUser) {
        this.startTracking();
        this.requestImmediateFix();
      }
    });

    window.addEventListener('online', () => {
      if (typeof Auth !== 'undefined' && Auth.currentUser) {
        this.startTracking();
        this.requestImmediateFix();
      }
    });

    // Start background tracking watchdog
    this.startWatchdog();
  },

  /** Zero-Click Auto-Activation called as soon as ANY user logs in */
  async onUserLogin(user) {
    console.log('[GPS] User logged in, auto-starting live tracking for:', user?.username, user?.role);
    this.updateHeaderIndicator(true, 'GPS Live');

    // ── INSTANT ONLINE BEACON ──────────────────────────────────────────────────
    // Signal admin map immediately that this user is ONLINE, even before GPS fix
    try {
      if (typeof db !== 'undefined' && db.repLocations && user) {
        const tenantId = (user.tenantId) ? user.tenantId : (typeof getActiveTenantId === 'function' ? getActiveTenantId() : 1) || 1;
        const cleanUsername = String(user.username || user.id).toLowerCase().replace(/[^a-z0-9]/g, '_');
        const docId = `rep_${cleanUsername}`;
        // Use cached last position if available, otherwise write zeros (admin will see Online badge)
        const cachedPos = this.currentPos;
        const beaconPayload = {
          id: docId,
          tenantId,
          repId: user.id || 1,
          repUsername: user.username,
          repName: user.fullName || user.username,
          role: user.role,
          lat: cachedPos ? Number(cachedPos.lat) : 0,
          lng: cachedPos ? Number(cachedPos.lng) : 0,
          accuracy: cachedPos ? (cachedPos.accuracy || 10) : 0,
          speed: 0,
          heading: 0,
          isOnline: true,
          loginAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          timestamp: Date.now()
        };
        await db.repLocations.put(beaconPayload);
        // Broadcast login beacon immediately to admin map on same device
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('mob_pos_location_channel');
            bc.postMessage({ type: 'REP_LOCATION_UPDATE', data: beaconPayload });
            bc.close();
          } catch (e) {}
        }
      }
    } catch (beaconErr) {
      console.warn('[GPS] Login beacon error (non-fatal):', beaconErr);
    }

    this.startTracking();
    await this.requestImmediateFix();

    // Auto-sync initial login location immediately (with real GPS fix if available)
    if (this.currentPos && this.currentPos.lat) {
      await this.syncLiveLocation(this.currentPos);
      await this.recordBreadcrumb(this.currentPos, 'login');
    }
  },

  onUserLock() {
    this.updateHeaderIndicator(false, 'GPS Standby');
  },

  updateHeaderIndicator(isLive, customText = null) {
    const statusWrap = document.getElementById('header-gps-status');
    if (!statusWrap) return;

    if (isLive) {
      statusWrap.className = 'flex items-center gap-1 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default';
      statusWrap.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span id="header-gps-text">${customText || 'GPS Live'}</span>
      `;
    } else {
      statusWrap.className = 'flex items-center gap-1 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 cursor-default';
      statusWrap.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        <span id="header-gps-text">${customText || 'GPS Syncing...'}</span>
      `;
    }
  },

  restoreCachedPosition() {
    try {
      const cached = localStorage.getItem('mob_pos_last_gps_pos');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Purge any Colombo ISP gateway coordinates (6.8 to 7.1 lat, 79.7 to 80.0 lng)
        const isColomboArea = parsed && (parsed.lat >= 6.8 && parsed.lat <= 7.15 && parsed.lng >= 79.75 && parsed.lng <= 80.05);
        if (isColomboArea) {
          localStorage.removeItem('mob_pos_last_gps_pos');
          this.currentPos = null;
        } else if (parsed && parsed.lat && parsed.lng) {
          this.currentPos = parsed;
          this.isGpsAvailable = true;
          return;
        }
      }
    } catch (e) {}

    // No cached position — keep null so any GPS-dependent actions wait for real satellite fix
    // (Do NOT set a hardcoded default — it causes wrong shop locations to be saved)
    this.currentPos = null;
    this.isGpsAvailable = false;
  },

  startTracking() {
    if (!navigator.geolocation) {
      console.warn('[GPS] Geolocation is not supported by this browser.');
      return;
    }

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 20000, // 20s avoids rapid timeout errors on mobile devices
      maximumAge: 5000 // 5s cache allows immediate fix while refining accuracy
    };

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this.onPositionUpdate(pos),
        (err) => this.onPositionError(err),
        options
      );
      this.isTracking = true;
    } catch (e) {
      console.warn('[GPS] watchPosition error:', e);
    }
  },

  startWatchdog() {
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);

    // Watchdog heartbeat runs every 4 seconds
    this._heartbeatInterval = setInterval(() => {
      const user = typeof Auth !== 'undefined' ? Auth.currentUser : null;
      if (!user) return;

      const now = Date.now();

      // If watchPosition has been silent for > 15 seconds, ping getCurrentPosition to keep sensor active
      if (this.isTracking && (now - this.lastPositionTime > 15000) && !this._isAcquiringFix) {
        this.requestImmediateFix();
      }

      // Automatically sync live location for ANY active user
      if (this.currentPos) {
        // If device has been stationary (no new position updates) for > 10 seconds, set speed to 0 (halted/stopped)
        if (now - this.lastPositionTime > 10000 && this.currentPos.speed > 0) {
          this.currentPos.speed = 0;
        }
        this.syncLiveLocation(this.currentPos);
      }
    }, 4000);
  },

  /** Request an instant coordinate update directly */
  async requestImmediateFix() {
    if (!navigator.geolocation || this._isAcquiringFix) return this.currentPos;
    this._isAcquiringFix = true;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this._isAcquiringFix = false;
          this.onPositionUpdate(pos);
          resolve(this.currentPos);
        },
        (err) => {
          this._isAcquiringFix = false;
          // Fallback to low-accuracy request if high-accuracy timed out
          if (err && err.code === 3) {
            navigator.geolocation.getCurrentPosition(
              (lowPos) => {
                this.onPositionUpdate(lowPos);
                resolve(this.currentPos);
              },
              () => resolve(this.currentPos),
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
            );
          } else {
            resolve(this.currentPos);
          }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
      );
    });
  },

  onPositionUpdate(pos) {
    const coords = pos.coords;
    const lat = Number(coords.latitude.toFixed(7));
    const lng = Number(coords.longitude.toFixed(7));
    const accuracy = Math.round(coords.accuracy || 5);

    // If accuracy is very low (>1000m) and in Colombo ISP zone, ignore desktop IP fallback if user is in Galnewa area
    const isColomboIpFallback = (lat >= 6.8 && lat <= 7.15 && lng >= 79.75 && lng <= 80.05 && accuracy > 500);
    if (isColomboIpFallback && this.currentPos && this.currentPos.lat && (this.currentPos.lat > 7.5 || this.currentPos.isManual)) {
      return;
    }

    this.isGpsAvailable = true;
    this.lastPositionTime = Date.now();
    this.currentPos = {
      lat: lat,
      lng: lng,
      accuracy: accuracy,
      speed: coords.speed ? Math.round(coords.speed * 3.6) : 0, // km/h
      heading: coords.heading || 0,
      isManual: false,
      timestamp: pos.timestamp || Date.now()
    };

    try {
      localStorage.setItem('mob_pos_last_gps_pos', JSON.stringify(this.currentPos));
    } catch (e) {}

    this.updateHeaderIndicator(true, `GPS Live (±${accuracy}m)`);

    if (typeof MapView !== 'undefined' && MapView.updateLiveUserMarker) {
      MapView.updateLiveUserMarker(this.currentPos);
    }

    const now = Date.now();
    const distMoved = this.lastSyncedPos ? this.getDistanceMeters(
      this.lastSyncedPos.lat, this.lastSyncedPos.lng,
      this.currentPos.lat, this.currentPos.lng
    ) : 999;

    if (distMoved >= 2 || (now - this.lastRecordedTime > 3500)) {
      this.lastRecordedTime = now;
      this.lastSyncedPos = { lat: this.currentPos.lat, lng: this.currentPos.lng };

      if (typeof Auth !== 'undefined' && Auth.currentUser) {
        this.syncLiveLocation(this.currentPos);
        if (distMoved >= 4) {
          this.recordBreadcrumb(this.currentPos);
        }
      }
    }
  },

  onPositionError(err) {
    console.warn('[GPS] Position event notice:', err.code, err.message);

    // If timeout or temporarily unavailable, silently schedule auto-retry without annoying user
    if (err.code === 2 || err.code === 3) {
      this.updateHeaderIndicator(false, 'GPS Connecting...');
      if (!this._autoRetryTimer) {
        this._autoRetryTimer = setTimeout(() => {
          this._autoRetryTimer = null;
          this.startTracking();
        }, 4000);
      }
    } else if (err.code === 1) {
      // Permission denied
      this.updateHeaderIndicator(false, 'Location Off');
    }
  },

  /** Calculate total KM traveled and speed stats for a Rep today */
  async calculateRepTripStats(repId, dateStr = null) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    try {
      if (typeof db === 'undefined') return { totalKm: 0, currentSpeed: 0, maxSpeed: 0, count: 0 };
      let totalMeters = 0;
      let maxSpeed = 0;
      let lastSpeed = 0;
      let count = 0;

      if (db.gpsVisits) {
        const rawVisits = await db.gpsVisits.toArray();
        const allVisits = filterByTenant(rawVisits);
        
        const trail = allVisits
          .filter(v => String(v.repId) === String(repId) && v.date === targetDate && v.lat && v.lng)
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        count = trail.length;

        for (let i = 0; i < trail.length; i++) {
          const p = trail[i];
          const spd = Number(p.speed) || 0;
          if (spd > maxSpeed) maxSpeed = spd;
          lastSpeed = spd;

          if (i > 0) {
            const prev = trail[i - 1];
            const dist = this.getDistanceMeters(prev.lat, prev.lng, p.lat, p.lng);
            // Only add realistic bike/vehicle movement (< 50km per step)
            if (dist > 3 && dist < 50000) {
              totalMeters += dist;
            }
          }
        }
      }

      // If breadcrumbs were sparse (phone in pocket/screen off), calculate KM between billed/visited shops in order!
      if (totalMeters < 500 && db.sales && db.shops) {
        const rawSales = await db.sales.toArray();
        const repSalesToday = filterByTenant(rawSales)
          .filter(s => String(s.repId) === String(repId) && s.status !== 'Cancelled' && s.date && s.date.startsWith(targetDate))
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        const rawShops = await db.shops.toArray();
        const shopMap = Object.fromEntries(filterByTenant(rawShops).map(s => [Number(s.id), s]));

        let prevShop = null;
        for (const s of repSalesToday) {
          const shop = shopMap[Number(s.shopId)];
          if (shop && shop.lat && shop.lng) {
            if (prevShop) {
              const d = this.getDistanceMeters(prevShop.lat, prevShop.lng, shop.lat, shop.lng);
              if (d > 10 && d < 50000) totalMeters += d;
            }
            prevShop = shop;
          }
        }
      }

      // Get real-time live speed from db.repLocations
      let currentSpeed = lastSpeed;
      if (db.repLocations) {
        const rawLocs = await db.repLocations.toArray();
        const repLoc = filterByTenant(rawLocs).find(l => String(l.repId) === String(repId));
        if (repLoc && typeof repLoc.speed !== 'undefined') {
          currentSpeed = Number(repLoc.speed) || 0;
          if (currentSpeed > maxSpeed) maxSpeed = currentSpeed;
        }
      }

      return {
        totalKm: Number((totalMeters / 1000).toFixed(1)),
        currentSpeed: currentSpeed,
        maxSpeed: maxSpeed,
        count: count
      };
    } catch (e) {
      return { totalKm: 0, currentSpeed: 0, maxSpeed: 0, count: 0 };
    }
  },

  /** Check if Rep/Driver is Out of Route (> 1.5 km from all shops in their assigned routes) */
  async checkOutOfRoute(pos, routeId) {
    if (!pos || !pos.lat || !pos.lng || !routeId || routeId === 'all') {
      return { isOutOfRoute: false, minDistanceKm: 0, statusText: 'Normal' };
    }

    try {
      if (typeof db === 'undefined' || !db.shops) return { isOutOfRoute: false, minDistanceKm: 0, statusText: 'Normal' };
      const rawShops = await db.shops.toArray();
      const rIds = (Array.isArray(routeId) ? routeId : [routeId]).map(String);
      const routeShops = filterByTenant(rawShops).filter(s =>
        rIds.includes(String(s.routeId)) && s.lat && s.lng && !isNaN(Number(s.lat)) && Number(s.lat) !== 0
      );

      if (routeShops.length === 0) {
        return { isOutOfRoute: false, minDistanceKm: 0, statusText: 'No Shop Coords' };
      }

      let minMeters = Infinity;
      for (const shop of routeShops) {
        const dist = this.getDistanceMeters(pos.lat, pos.lng, Number(shop.lat), Number(shop.lng));
        if (dist < minMeters) minMeters = dist;
      }

      const minKm = Number((minMeters / 1000).toFixed(1));
      // Out of route if further than 1.5 km (1500 meters) from any route shop
      const isOut = minMeters > 1500;

      return {
        isOutOfRoute: isOut,
        minDistanceKm: minKm,
        minDistanceMeters: minMeters,
        statusText: isOut ? `🚨 Out of Route (${minKm} km)` : `🛣️ On Route`
      };
    } catch (e) {
      return { isOutOfRoute: false, minDistanceKm: 0, statusText: 'Normal' };
    }
  },

  /** Allow user to manually set / drag their location for 100% pinpoint accuracy */
  async setManualPosition(lat, lng, label = 'Manual Set') {
    this.currentPos = {
      lat: Number(Number(lat).toFixed(7)),
      lng: Number(Number(lng).toFixed(7)),
      accuracy: 3,
      speed: 0,
      heading: 0,
      isManual: true,
      timestamp: Date.now()
    };

    this.isGpsAvailable = true;
    try {
      localStorage.setItem('mob_pos_last_gps_pos', JSON.stringify(this.currentPos));
    } catch (e) {}

    await this.syncLiveLocation(this.currentPos);
    await this.recordBreadcrumb(this.currentPos, 'checkin', null, label);

    if (typeof MapView !== 'undefined' && MapView.updateLiveUserMarker) {
      MapView.updateLiveUserMarker(this.currentPos);
    }
    if (typeof MapView !== 'undefined' && MapView.refreshMap) {
      MapView.refreshMap();
    }
  },

  /** Get exact current coordinates with Promise */
  async getCurrentPosition() {
    if (this.currentPos && (Date.now() - (this.currentPos.timestamp || 0) < 10000)) {
      return this.currentPos;
    }
    return await this.requestImmediateFix();
  },

  /** Sync User's live position to DB so Admin / Manager can see in real-time */
  async syncLiveLocation(pos) {
    if (!pos || typeof db === 'undefined' || !db.repLocations) return;
    if (!Auth.currentUser) return;

    try {
      const user = Auth.currentUser;
      const tenantId = (user && user.tenantId) ? user.tenantId : (getActiveTenantId() || 1);
      const userId = user.id || 1;
      const cleanUsername = String(user.username || userId).toLowerCase().replace(/[^a-z0-9]/g, '_');
      const docId = `rep_${cleanUsername}`;

      const payload = {
        id: docId,
        tenantId,
        repId: userId,
        repUsername: user.username,
        repName: user.fullName || user.username,
        role: user.role,
        lat: Number(pos.lat),
        lng: Number(pos.lng),
        accuracy: pos.accuracy || 10,
        speed: pos.speed || 0,
        heading: pos.heading || 0,
        isOnline: true,
        updatedAt: new Date().toISOString(),
        timestamp: Date.now()
      };

      await db.repLocations.put(payload);

      // Also update user's last coordinates in db.users for instant cross-device availability
      if (db.users && user.id) {
        try {
          await db.users.update(user.id, {
            lastLat: Number(pos.lat),
            lastLng: Number(pos.lng),
            lastSpeed: pos.speed || 0,
            lastGpsTime: new Date().toISOString()
          });
        } catch (uErr) {}
      }

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('mob_pos_location_channel');
          bc.postMessage({ type: 'REP_LOCATION_UPDATE', data: payload });
          bc.close();
        } catch (e) {}
      }
    } catch (err) {
      console.warn('[GPS] Error syncing live location:', err);
    }
  },

  /** Record breadcrumb path point */
  async recordBreadcrumb(pos, action = 'breadcrumb', shopId = null, shopName = '') {
    if (!pos || typeof db === 'undefined' || !db.gpsVisits) return;
    if (!Auth.currentUser) return;

    try {
      const user = Auth.currentUser;
      const tenantId = (user && user.tenantId) ? user.tenantId : (getActiveTenantId() || 1);
      const todayStr = new Date().toISOString().split('T')[0];

      await db.gpsVisits.add({
        tenantId,
        repId: user.id || 1,
        repUsername: user.username,
        repName: user.fullName || user.username,
        date: todayStr,
        lat: pos.lat,
        lng: pos.lng,
        speed: pos.speed,
        action: action,
        shopId: shopId ? Number(shopId) : null,
        shopName: shopName || '',
        timestamp: Date.now(),
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[GPS] Error recording breadcrumb:', err);
    }
  },

  /** 1-Click Shop Geo-tagging — forces fresh satellite fix */
  async captureShopLocation(shopId) {
    if (!shopId) return;

    try {
      UI.showToast('📡 GPS satellite fix ලබා ගනිමින්... (Acquiring fresh fix)', 'info');
      // Always force a fresh fix for shop tagging — never use stale cache
      const pos = await this.requestImmediateFix();
      if (!pos || !pos.lat || !pos.lng) {
        UI.showToast('⚠️ GPS signal නැත — location permission on කරන්න', 'warning');
        return;
      }

      await db.shops.update(Number(shopId), {
        lat: pos.lat,
        lng: pos.lng,
        gpsTaggedAt: new Date().toISOString(),
        gpsTaggedBy: Auth.currentUser?.fullName || Auth.currentUser?.username || 'Rep'
      });

      await this.recordBreadcrumb(pos, 'geotag', shopId);

      UI.showToast(`📍 Shop location saved! [${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}] ±${pos.accuracy}m`, 'success');
      if (typeof SoundFX !== 'undefined') SoundFX.play('shop');

      if (typeof Shops !== 'undefined' && Shops.loadShops) Shops.loadShops();
      if (typeof MapView !== 'undefined' && MapView.refreshMap) MapView.refreshMap();
    } catch (err) {
      UI.showToast('Shop GPS tag failed: ' + err.message, 'error');
    }
  },

  /** Launch Google Maps turn-by-turn navigation */
  navigateToShop(lat, lng, shopName = '') {
    if (!lat || !lng) {
      UI.showToast(`Shop "${shopName}" has no GPS coordinates yet.`, 'warning');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  },

  /** Open in-app shop picker modal */
  openMapPicker(shopId) {
    if (typeof MapView !== 'undefined' && MapView.openLocationPicker) {
      MapView.openLocationPicker(shopId);
    }
  }
};

window.GPS = GPS;
