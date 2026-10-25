/**
 * Real-Time Cloud Database Layer using Google Firebase Firestore (JS SDK v10)
 * Project ID: company-pos
 * Real-time synchronization across all devices (Laptop, Mobile, Tab)
 */

// 1. Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyB-KbonUifJ6FvHU9aZhOwZbJp-TUJ4grI",
  authDomain: "company-pos.firebaseapp.com",
  projectId: "company-pos",
  storageBucket: "company-pos.firebasestorage.app",
  messagingSenderId: "566480079850",
  appId: "1:566480079850:web:531e714ede12519eca4093"
};

// 2. Initialize Firebase App
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (initErr) {
    console.warn('Firebase init notice:', initErr);
  }
}

const firestore = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;

// Enable Firestore Multi-Tab Offline Persistence
if (firestore) {
  try {
    firestore.enablePersistence({ synchronizeTabs: true }).catch(err => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore multi-tab persistence: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not supported in this browser');
      }
    });
  } catch (pErr) {
    console.warn('Firestore persistence init warning:', pErr);
  }
}

// 3. Real-Time UI Dispatcher on remote snapshot changes
let _firestoreRefreshTimer = null;
function notifyFirestoreChange(collectionName) {
  if (_firestoreRefreshTimer) clearTimeout(_firestoreRefreshTimer);
  _firestoreRefreshTimer = setTimeout(() => {
    try {
      const activeTab = document.querySelector('.app-tab-page:not(.hidden)');
      const tabId = activeTab?.id;

      if (tabId === 'tab-dashboard' && typeof Dashboard !== 'undefined' && Dashboard.loadDashboard) {
        Dashboard.loadDashboard();
      } else if (tabId === 'tab-pos' && typeof POS !== 'undefined' && POS.loadProductsCatalog) {
        POS.loadProductsCatalog();
      } else if (tabId === 'tab-rep-bills' && typeof RepBills !== 'undefined' && RepBills.loadBills) {
        RepBills.loadBills();
      } else if (tabId === 'tab-production' && typeof Production !== 'undefined' && Production.loadMatrix) {
        Production.loadMatrix();
      } else if (tabId === 'tab-stores' && typeof Stores !== 'undefined' && Stores.loadWarehouseStock) {
        Stores.loadWarehouseStock();
      } else if (tabId === 'tab-lorry' && typeof Lorry !== 'undefined' && Lorry.loadActiveTrip) {
        Lorry.loadActiveTrip();
      } else if (tabId === 'tab-collections' && typeof Collections !== 'undefined' && Collections.loadDebtors) {
        Collections.loadDebtors();
      } else if (tabId === 'tab-best-shops' && typeof BestShops !== 'undefined' && BestShops.load) {
        BestShops.load();
      } else if (tabId === 'tab-superadmin' && typeof CompanyControl !== 'undefined' && CompanyControl.loadTenants) {
        CompanyControl.loadTenants();
      } else if (tabId === 'tab-shops' && typeof Shops !== 'undefined' && Shops.loadShops) {
        Shops.loadShops();
      } else if (tabId === 'tab-products' && typeof Products !== 'undefined' && Products.loadProducts) {
        Products.loadProducts();
      } else if (tabId === 'tab-routes' && typeof Routes !== 'undefined' && Routes.loadRoutes) {
        Routes.loadRoutes();
      } else if (tabId === 'tab-payroll') {
        if (typeof HR !== 'undefined' && HR.renderActiveModule) HR.renderActiveModule();
        if (typeof Payroll !== 'undefined' && Payroll.loadMonthlyPayroll) Payroll.loadMonthlyPayroll();
      } else if (tabId === 'tab-users' && typeof Users !== 'undefined' && Users.loadUsers) {
        Users.loadUsers();
      } else if (tabId === 'tab-settings' && typeof Settings !== 'undefined' && Settings.loadSettings) {
        Settings.loadSettings();
      } else if (tabId === 'tab-map' && typeof MapView !== 'undefined' && MapView.refreshMap) {
        MapView.refreshMap();
      }

      if (collectionName === 'repLocations' && typeof MapView !== 'undefined' && MapView.refreshMap) {
        MapView.refreshMap();
      }

      if (collectionName === 'company' && typeof UI !== 'undefined' && UI.updateCompanyBranding) {
        UI.updateCompanyBranding();
      }
    } catch (e) {
      console.warn('Real-time UI refresh notice:', e);
    }
  }, 80);
}

// 3.5 Chainable Query Builder for Firestore Collections (Full Dexie Compatibility)
class FirestoreQuery {
  constructor(collection, fieldName = null, predicate = null) {
    this.collection = collection;
    this.predicates = [];
    if (predicate) {
      this.predicates.push(predicate);
    }
    this._sortKey = null;
    this._reverse = false;
    this._limit = null;
    this._offset = null;
  }

  and(fn) {
    if (typeof fn === 'function') {
      this.predicates.push(fn);
    }
    return this;
  }

  or(fieldNameOrFn) {
    if (typeof fieldNameOrFn === 'function') {
      const prev = this.predicates.pop();
      if (prev) {
        this.predicates.push((item) => prev(item) || fieldNameOrFn(item));
      } else {
        this.predicates.push(fieldNameOrFn);
      }
      return this;
    }
    const self = this;
    const fieldName = fieldNameOrFn;
    return {
      equals(val) {
        return self.or((item) => String(item[fieldName]) === String(val));
      },
      notEqual(val) {
        return self.or((item) => String(item[fieldName]) !== String(val));
      }
    };
  }

  filter(fn) {
    return this.and(fn);
  }

  reverse() {
    this._reverse = !this._reverse;
    return this;
  }

  limit(n) {
    this._limit = Number(n);
    return this;
  }

  offset(n) {
    this._offset = Number(n);
    return this;
  }

  sortBy(key) {
    this._sortKey = key;
    return this;
  }

  async _execute() {
    let items = await this.collection.toArray();
    if (this.predicates.length > 0) {
      items = items.filter(item => {
        return this.predicates.every(p => {
          try {
            return p(item);
          } catch (e) {
            return false;
          }
        });
      });
    }

    if (this._sortKey) {
      items = items.slice().sort((a, b) => {
        const valA = a[this._sortKey];
        const valB = b[this._sortKey];
        if (valA < valB) return -1;
        if (valA > valB) return 1;
        return 0;
      });
    }

    if (this._reverse) {
      items = items.slice().reverse();
    }

    if (this._offset !== null && this._offset > 0) {
      items = items.slice(this._offset);
    }

    if (this._limit !== null && this._limit >= 0) {
      items = items.slice(0, this._limit);
    }

    return items;
  }

  async toArray() {
    return this._execute();
  }

  async first() {
    const items = await this._execute();
    return items.length > 0 ? items[0] : null;
  }

  async last() {
    const items = await this._execute();
    return items.length > 0 ? items[items.length - 1] : null;
  }

  async count() {
    const items = await this._execute();
    return items.length;
  }

  async delete() {
    const items = await this._execute();
    const ids = items.map(i => i.id).filter(id => id !== undefined && id !== null);
    await this.collection.bulkDelete(ids);
    return ids.length;
  }

  async modify(modifierFnOrChanges) {
    const items = await this._execute();
    for (const item of items) {
      if (typeof modifierFnOrChanges === 'function') {
        const clone = Object.assign({}, item);
        modifierFnOrChanges(clone);
        await this.collection.update(item.id, clone);
      } else if (typeof modifierFnOrChanges === 'object' && modifierFnOrChanges !== null) {
        await this.collection.update(item.id, modifierFnOrChanges);
      }
    }
    return items.length;
  }

  async primaryKeys() {
    const items = await this._execute();
    return items.map(i => i.id);
  }
}

// 4. Reactive Firestore Collection Store Class
class FirestoreCollection {
  constructor(name) {
    this.name = name;
    this._cache = new Map();
    this._isInitialized = false;
    this._initPromise = null;
    this._loadLocal(); // Load local storage cache immediately for zero-latency offline start
    this.initSnapshotListener();
  }

  _persistLocal() {
    try {
      const items = Array.from(this._cache.values());
      localStorage.setItem('sp_db_' + this.name, JSON.stringify(items));
    } catch (e) {
      // LocalStorage quota exceeded (usually due to Base64 photos)!
      console.warn(`[DB] LocalStorage quota reached for '${this.name}', sanitizing photos...`);
      try {
        const sanitized = Array.from(this._cache.values()).map(item => {
          const clone = Object.assign({}, item);
          if (clone.photoBase64 && clone.photoBase64.length > 300) clone.photoBase64 = '';
          if (clone.photoUrl && clone.photoUrl.length > 300) clone.photoUrl = '';
          if (clone.startMeterPhoto && clone.startMeterPhoto.length > 300) clone.startMeterPhoto = '';
          if (clone.selfiePhoto && clone.selfiePhoto.length > 300) clone.selfiePhoto = '';
          if (clone.endMeterPhoto && clone.endMeterPhoto.length > 300) clone.endMeterPhoto = '';
          if (clone.closingSelfiePhoto && clone.closingSelfiePhoto.length > 300) clone.closingSelfiePhoto = '';
          return clone;
        });
        localStorage.setItem('sp_db_' + this.name, JSON.stringify(sanitized.slice(-150)));
      } catch (err2) {
        console.warn(`[DB] Fallback storage notice for '${this.name}':`, err2);
      }
    }
  }

  _loadLocal() {
    try {
      const raw = localStorage.getItem('sp_db_' + this.name);
      if (raw) {
        const items = JSON.parse(raw);
        if (Array.isArray(items) && items.length > 0) {
          items.forEach(item => {
            if (item && item.id !== undefined) {
              this._cache.set(String(item.id), item);
            }
          });
          this._isInitialized = true;
        }
      }
    } catch (e) {}
  }

  initSnapshotListener() {
    if (!firestore) return;

    try {
      this._initPromise = new Promise((resolve) => {
        let firstLoad = true;

        // Zero-latency fallback when offline or cache exists
        const timeoutMs = (typeof navigator !== 'undefined' && !navigator.onLine) ? 80 : (this._cache.size > 0 ? 300 : 2000);
        const timeoutId = setTimeout(() => {
          if (firstLoad) {
            firstLoad = false;
            this._isInitialized = true;
            console.log(`[DB] '${this.name}' ready with cached data (${this._cache.size} items)`);
            resolve(this._cache);
          }
        }, timeoutMs);

        firestore.collection(this.name).onSnapshot(
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              const data = change.doc.data();
              const docId = data.id !== undefined ? data.id : change.doc.id;
              const normalizedItem = Object.assign({}, data, { id: docId });

              if (change.type === 'removed') {
                this._cache.delete(String(docId));
                this._cache.delete(Number(docId));
              } else {
                this._cache.set(String(docId), normalizedItem);
              }
            });

            this._persistLocal();
            this._isInitialized = true;
            if (firstLoad) {
              firstLoad = false;
              clearTimeout(timeoutId);
              resolve(this._cache);
            } else {
              notifyFirestoreChange(this.name);
            }
          },
          (err) => {
            console.warn(`Firestore onSnapshot error for '${this.name}':`, err);
            clearTimeout(timeoutId);
            this._isInitialized = true;
            resolve(this._cache);
          }
        );
      });
    } catch (err) {
      console.warn(`Error setting up listener for '${this.name}':`, err);
    }
  }

  async _ensureLoaded() {
    if (this._isInitialized) return;
    if (this._cache.size > 0) {
      this._isInitialized = true;
      return;
    }
    if (this._initPromise) {
      await this._initPromise;
      return;
    }

    if (firestore) {
      try {
        // Add timeout to avoid hanging when offline without persistence
        const fetchPromise = firestore.collection(this.name).get();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('offline timeout')), 3000)
        );
        const snap = await Promise.race([fetchPromise, timeoutPromise]);
        snap.forEach((doc) => {
          const data = doc.data();
          const docId = data.id !== undefined ? data.id : doc.id;
          this._cache.set(String(docId), Object.assign({}, data, { id: docId }));
        });
        this._persistLocal();
        this._isInitialized = true;
      } catch (err) {
        console.warn(`Fallback fetch error on '${this.name}' (possibly offline):`, err);
        this._isInitialized = true; // mark as initialized so we proceed with empty/cached data
      }
    }
  }

  async toArray() {
    await this._ensureLoaded();
    return Array.from(this._cache.values());
  }

  async get(id) {
    await this._ensureLoaded();
    if (id === undefined || id === null) return null;
    return this._cache.get(String(id)) || this._cache.get(Number(id)) || null;
  }

  async add(item) {
    if (!item) return null;

    // Normalize numeric ID if not present
    const id = item.id !== undefined ? item.id : Date.now() + Math.floor(Math.random() * 1000);
    const tenantId = item.tenantId !== undefined ? item.tenantId : (getActiveTenantId() || 1);

    const record = Object.assign({}, item, {
      id: id,
      tenantId: tenantId,
      updatedAt: item.updatedAt || new Date().toISOString()
    });

    // Update memory cache immediately for zero-latency UI
    this._cache.set(String(id), record);
    this._persistLocal();

    if (firestore) {
      try {
        await firestore.collection(this.name).doc(String(id)).set(record);
      } catch (err) {
        console.warn(`Firestore add error on '${this.name}':`, err);
      }
    }

    return id;
  }

  async put(item) {
    return this.add(item);
  }

  async update(id, changes) {
    if (id === undefined || id === null) return;
    await this._ensureLoaded();

    const existing = this._cache.get(String(id)) || this._cache.get(Number(id)) || {};
    const updated = Object.assign({}, existing, changes, {
      id: id,
      updatedAt: changes.updatedAt || new Date().toISOString()
    });

    this._cache.set(String(id), updated);
    this._persistLocal();

    if (firestore) {
      try {
        await firestore.collection(this.name).doc(String(id)).set(updated, { merge: true });
      } catch (err) {
        console.warn(`Firestore update error on '${this.name}':`, err);
      }
    }
  }

  async delete(id) {
    if (id === undefined || id === null) return;
    this._cache.delete(String(id));
    this._cache.delete(Number(id));
    this._persistLocal();

    if (firestore) {
      try {
        await firestore.collection(this.name).doc(String(id)).delete();
      } catch (err) {
        console.warn(`Firestore delete error on '${this.name}':`, err);
      }
    }
  }

  // Force fresh Firestore server fetch — bypasses stale local cache for auth and sync
  async refreshFromServer() {
    if (!firestore) return;
    try {
      const fetchPromise = firestore.collection(this.name).get({ source: 'server' });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500));
      const snap = await Promise.race([fetchPromise, timeoutPromise]);
      if (snap && snap.docs) {
        snap.forEach(doc => {
          const data = doc.data();
          const docId = data.id !== undefined ? data.id : doc.id;
          this._cache.set(String(docId), Object.assign({}, data, { id: docId }));
        });
        this._persistLocal();
        this._isInitialized = true;
      }
    } catch (e) {
      // If offline or network slow, keep current in-memory cache
      console.warn(`[DB] refreshFromServer '${this.name}' fallback:`, e.message || e);
    }
  }

  async clear() {
    const allIds = Array.from(this._cache.keys());
    this._cache.clear();
    this._persistLocal();

    if (firestore && allIds.length > 0) {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
        const chunk = allIds.slice(i, i + CHUNK_SIZE);
        try {
          const batch = firestore.batch();
          for (const id of chunk) {
            batch.delete(firestore.collection(this.name).doc(String(id)));
          }
          await batch.commit();
        } catch (err) {
          console.warn(`Firestore clear chunk error on '${this.name}':`, err);
        }
      }
    }
  }

  async count() {
    await this._ensureLoaded();
    return this._cache.size;
  }

  async bulkAdd(items) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const addedIds = [];
    const CHUNK_SIZE = 400;

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      if (firestore) {
        try {
          const batch = firestore.batch();
          for (const item of chunk) {
            const id = item.id !== undefined ? item.id : Date.now() + Math.floor(Math.random() * 100000) + addedIds.length;
            const tenantId = item.tenantId !== undefined ? item.tenantId : (getActiveTenantId() || 1);
            const record = Object.assign({}, item, { id, tenantId, updatedAt: item.updatedAt || new Date().toISOString() });

            this._cache.set(String(id), record);
            batch.set(firestore.collection(this.name).doc(String(id)), record);
            addedIds.push(id);
          }
          await batch.commit();
        } catch (err) {
          console.warn(`Firestore bulkAdd chunk error on '${this.name}':`, err);
          for (const item of chunk) {
            const id = await this.add(item);
            addedIds.push(id);
          }
        }
      } else {
        for (const item of chunk) {
          const id = await this.add(item);
          addedIds.push(id);
        }
      }
    }
    this._persistLocal();
    return addedIds;
  }

  async bulkPut(items) {
    return this.bulkAdd(items);
  }

  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const CHUNK_SIZE = 400;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      if (firestore) {
        try {
          const batch = firestore.batch();
          for (const id of chunk) {
            this._cache.delete(String(id));
            this._cache.delete(Number(id));
            batch.delete(firestore.collection(this.name).doc(String(id)));
          }
          await batch.commit();
        } catch (err) {
          console.warn(`Firestore bulkDelete chunk error on '${this.name}':`, err);
          for (const id of chunk) {
            await this.delete(id);
          }
        }
      } else {
        for (const id of chunk) {
          await this.delete(id);
        }
      }
    }
    this._persistLocal();
  }

  where(fieldName) {
    const self = this;
    return {
      equals(val) {
        return new FirestoreQuery(self, fieldName, (item) => String(item[fieldName]) === String(val));
      },
      notEqual(val) {
        return new FirestoreQuery(self, fieldName, (item) => String(item[fieldName]) !== String(val));
      },
      anyOf(values) {
        const valArr = Array.isArray(values) ? values : [values];
        const strSet = new Set(valArr.map(v => String(v)));
        const numSet = new Set(valArr.map(v => Number(v)).filter(v => !isNaN(v)));
        return new FirestoreQuery(self, fieldName, (item) => {
          const v = item[fieldName];
          return strSet.has(String(v)) || numSet.has(Number(v));
        });
      },
      anyOfIgnoreCase(values) {
        const valArr = Array.isArray(values) ? values : [values];
        const set = new Set(valArr.map(v => String(v).toLowerCase()));
        return new FirestoreQuery(self, fieldName, (item) => set.has(String(item[fieldName] || '').toLowerCase()));
      },
      equalsIgnoreCase(val) {
        const target = String(val).toLowerCase();
        return new FirestoreQuery(self, fieldName, (item) => String(item[fieldName] || '').toLowerCase() === target);
      },
      between(lower, upper, includeLower = true, includeUpper = true) {
        return new FirestoreQuery(self, fieldName, (item) => {
          const val = item[fieldName];
          const condLower = includeLower ? val >= lower : val > lower;
          const condUpper = includeUpper ? val <= upper : val < upper;
          return condLower && condUpper;
        });
      },
      above(val) {
        return new FirestoreQuery(self, fieldName, (item) => item[fieldName] > val);
      },
      aboveOrEqual(val) {
        return new FirestoreQuery(self, fieldName, (item) => item[fieldName] >= val);
      },
      below(val) {
        return new FirestoreQuery(self, fieldName, (item) => item[fieldName] < val);
      },
      belowOrEqual(val) {
        return new FirestoreQuery(self, fieldName, (item) => item[fieldName] <= val);
      },
      startsWith(prefix) {
        return new FirestoreQuery(self, fieldName, (item) => String(item[fieldName] || '').startsWith(prefix));
      },
      startsWithIgnoreCase(prefix) {
        const p = String(prefix).toLowerCase();
        return new FirestoreQuery(self, fieldName, (item) => String(item[fieldName] || '').toLowerCase().startsWith(p));
      },
      noneOf(values) {
        const valArr = Array.isArray(values) ? values : [values];
        const strSet = new Set(valArr.map(v => String(v)));
        const numSet = new Set(valArr.map(v => Number(v)).filter(v => !isNaN(v)));
        return new FirestoreQuery(self, fieldName, (item) => {
          const v = item[fieldName];
          return !strSet.has(String(v)) && !numSet.has(Number(v));
        });
      },
      inAnyRange(ranges) {
        return new FirestoreQuery(self, fieldName, (item) => {
          const val = item[fieldName];
          return ranges.some(([l, u]) => val >= l && val <= u);
        });
      }
    };
  }

  filter(filterFn) {
    return new FirestoreQuery(this, null, filterFn);
  }

  toCollection() {
    return new FirestoreQuery(this, null, null);
  }

  orderBy(fieldName) {
    const q = new FirestoreQuery(this, null, null);
    return q.sortBy(fieldName);
  }

  reverse() {
    const q = new FirestoreQuery(this, null, null);
    return q.reverse();
  }

  limit(n) {
    const q = new FirestoreQuery(this, null, null);
    return q.limit(n);
  }

  offset(n) {
    const q = new FirestoreQuery(this, null, null);
    return q.offset(n);
  }
}

// 5. Unified Database Instance (db)
const db = {
  company: new FirestoreCollection('company'),
  routes: new FirestoreCollection('routes'),
  products: new FirestoreCollection('products'),
  shops: new FirestoreCollection('shops'),
  sales: new FirestoreCollection('sales'),
  saleItems: new FirestoreCollection('saleItems'),
  salesReturns: new FirestoreCollection('salesReturns'),
  creditPayments: new FirestoreCollection('creditPayments'),
  users: new FirestoreCollection('users'),
  stockLedger: new FirestoreCollection('stockLedger'),
  lorryTrips: new FirestoreCollection('lorryTrips'),
  tenants: new FirestoreCollection('tenants'),
  repLocations: new FirestoreCollection('repLocations'),
  payroll: new FirestoreCollection('payroll'),
  payrollRules: new FirestoreCollection('payrollRules'),
  employees: new FirestoreCollection('employees'),
  attendance: new FirestoreCollection('attendance'),
  shifts: new FirestoreCollection('shifts'),
  leaves: new FirestoreCollection('leaves'),
  overtime: new FirestoreCollection('overtime'),
  departments: new FirestoreCollection('departments'),
  designations: new FirestoreCollection('designations'),
  hrRequests: new FirestoreCollection('hrRequests'),
  recruitment: new FirestoreCollection('recruitment'),
  training: new FirestoreCollection('training'),
  performance: new FirestoreCollection('performance'),
  fieldPhotos: new FirestoreCollection('fieldPhotos'),
  gpsVisits: new FirestoreCollection('gpsVisits'),
  systemSettings: new FirestoreCollection('systemSettings'),
  productTargets: new FirestoreCollection('productTargets')
};

window.db = db;

// 6. Universal Multi-Tenant Isolation Helpers
function getActiveTenantId() {
  if (typeof CompanyControl !== 'undefined' && CompanyControl.activeInspectTenantId) {
    return Number(CompanyControl.activeInspectTenantId);
  }
  if (typeof Auth !== 'undefined' && Auth.currentUser) {
    if (Auth.currentUser.tenantId) return Number(Auth.currentUser.tenantId);
    if (Auth.currentUser.role === 'superadmin') return null; // Super Admin unfiltered master
  }
  return 1; // Default primary tenant
}

function filterByTenant(records, customTenantId = null) {
  if (!Array.isArray(records)) return [];
  const activeTid = customTenantId !== null ? customTenantId : getActiveTenantId();
  if (activeTid === null) return records; // Super Admin full view when not inspecting
  return records.filter((r) => {
    if (r.tenantId === undefined || r.tenantId === null) {
      return Number(activeTid) === 1; // legacy data belongs to default tenant 1
    }
    return Number(r.tenantId) === Number(activeTid);
  });
}

window.getActiveTenantId = getActiveTenantId;
window.filterByTenant = filterByTenant;

// 7. Initialize Default Settings & Default Users if Firestore is empty

// Clean production DB defaults - no hardcoded demo coordinates injected

async function initDatabaseDefaults() {
  try {
    // Zero-latency Offline Guard: if offline, immediately skip remote network checks
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[DB] Running in 100% Offline Mode — server check skipped.');
      return;
    }

    // If connected to Firestore and online, verify with strict 1200ms timeout
    if (firestore) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('offline-timeout')), 1200));
        const checkPromise = Promise.allSettled([
          firestore.collection('users').limit(1).get(),
          firestore.collection('company').limit(1).get()
        ]);
        const results = await Promise.race([checkPromise, timeoutPromise]).catch(() => null);

        if (!results) {
          console.log('[DB] Network response slow or offline — proceeding with local database.');
          return;
        }

        const [usersSnap, companySnap] = results;
        const hasServerUsers = usersSnap && usersSnap.status === 'fulfilled' && !usersSnap.value?.empty;
        const hasServerCompany = companySnap && companySnap.status === 'fulfilled' && !companySnap.value?.empty;

        if (hasServerUsers || hasServerCompany) {
          // Cloud database already initialized! Refresh cache from server non-blockingly
          Promise.allSettled([
            db.users.refreshFromServer(),
            db.tenants.refreshFromServer(),
            db.company.refreshFromServer(),
            db.routes.refreshFromServer(),
            db.systemSettings.refreshFromServer()
          ]).catch(() => {});
          return;
        }

        // If checks errored (e.g. network pending / offline), DO NOT seed defaults to avoid wiping cloud passwords!
        if (usersSnap?.status === 'rejected' || companySnap?.status === 'rejected') {
          console.warn('Firestore initial check pending/offline - skipping default seed to protect passwords.');
          return;
        }
      } catch (checkErr) {
        console.warn('Firestore initial check notice:', checkErr);
        return; // Safe guard: never seed defaults if firestore check fails
      }
    }

    // Clean production init
    const companyCount = await db.company.count();
    if (companyCount === 0) {
      await db.company.add({
        id: 1,
        tenantId: 1,
        name: 'LANKA SPICE DISTRIBUTORS',
        tagline: 'Wholesale Card & Sachet Distribution',
        address: 'No. 45, Main Street, Anuradhapura',
        phone: '077 123 4567 / 025 222 3456',
        regNo: 'PV-102948',
        receiptFooter: 'Thank you for your business! / ස්තූතියි!',
        pin: '1234',
        printerWidth: '58mm'
      });
    }

    // Seed Default Tenant / Admin Company if empty
    if (db.tenants) {
      const tenantCount = await db.tenants.count();
      if (tenantCount === 0) {
        const now = new Date();
        const nextYear = new Date();
        nextYear.setFullYear(now.getFullYear() + 1);

        const company = await db.company.toCollection().first();
        const companyName = company?.name || 'LANKA SPICE DISTRIBUTORS';
        const ownerPin = company?.pin || '1234';

        await db.tenants.add({
          id: 1,
          tenantId: 1,
          companyName: companyName,
          ownerName: 'Master Admin (Owner)',
          adminUsername: 'admin',
          adminPin: ownerPin,
          phone: '077 123 4567',
          validFrom: now.toISOString().split('T')[0],
          validTo: '2099-12-31',
          isActive: true,
          status: 'active',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        });
      } else {
        // Ensure existing tenant validity is never expired by default
        const allT = await db.tenants.toArray();
        for (const t of allT) {
          if (!t.validTo || t.validTo < '2030-01-01') {
            await db.tenants.update(t.id, { validTo: '2099-12-31', status: 'active', isActive: true });
          }
        }
      }
    }

    // Initialize Default Route if empty
    const routesCount = await db.routes.count();
    if (routesCount === 0) {
      await db.routes.add({
        id: 1,
        tenantId: 1,
        name: 'Main Route (ප්‍රධාන මාර්ගය)',
        description: 'Main Delivery & Sales Territory',
        updatedAt: new Date().toISOString()
      });
    }

    // Initialize Default Users (7 Roles: Admin, SM, ASM, Supervisor, Rep, Delivery, Stores)
    const usersCount = await db.users.count();
    if (usersCount === 0) {
      await db.users.add({
        id: 1,
        tenantId: 1,
        username: 'admin',
        fullName: 'Business Owner (Admin)',
        role: 'admin',
        pin: '1234',
        phone: '077 123 4567',
        assignedRouteId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      });

      await db.users.add({
        id: 2,
        tenantId: 1,
        username: 'sm1',
        fullName: 'Sales Manager (SM)',
        role: 'sm',
        pin: '2222',
        phone: '077 222 3344',
        assignedRouteId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      });

      await db.users.add({
        id: 3,
        tenantId: 1,
        username: 'asm1',
        fullName: 'Area Sales Manager (ASM)',
        role: 'asm',
        pin: '3333',
        phone: '077 333 4455',
        assignedRouteId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      });

      await db.users.add({
        id: 4,
        tenantId: 1,
        username: 'sup1',
        fullName: 'Field Supervisor (සුපවයිසර්)',
        role: 'supervisor',
        pin: '4444',
        phone: '077 444 5566',
        assignedRouteId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      });

      await db.users.add({
        id: 5,
        tenantId: 1,
        username: 'rep1',
        fullName: 'Sales Rep (Order Booker)',
        role: 'rep',
        pin: '5555',
        phone: '071 987 6543',
        assignedRouteId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      });

      await db.users.add({
        id: 6,
        tenantId: 1,
        username: 'delivery1',
        fullName: 'Delivery Driver (බෙදාහැරීම්)',
        role: 'delivery',
        pin: '7777',
        phone: '078 123 9876',
        assignedRouteId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      });

      await db.users.add({
        id: 7,
        tenantId: 1,
        username: 'stores1',
        fullName: 'Production Stores Keeper (ස්ටෝර්ස්)',
        role: 'stores',
        pin: '8888',
        phone: '076 555 8899',
        assignedRouteId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      });

      await db.users.add({
        id: 8,
        tenantId: 1,
        username: 'hr1',
        fullName: 'HR & Payroll Officer (මානව සම්පත්)',
        role: 'hr',
        pin: '9999',
        phone: '077 888 9900',
        assignedRouteId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      });
    }

    // Guarantee that HR user exists even on pre-existing databases
    await ensureHrUserExists();

    // Synchronize SaaS Master Controller & Bank Details with Firestore Cloud across all devices
    if (db.systemSettings) {
      try {
        let cloudSaaS = await db.systemSettings.get('saas_config');
        const localRaw = localStorage.getItem('spice_pos_saas_settings');
        if (!cloudSaaS && localRaw) {
          // Push local settings from Super Admin device to Firestore Cloud
          const parsed = JSON.parse(localRaw);
          await db.systemSettings.put(Object.assign({ id: 'saas_config' }, parsed));
        } else if (cloudSaaS) {
          // Cloud settings exist: sync into this device's localStorage
          localStorage.setItem('spice_pos_saas_settings', JSON.stringify(cloudSaaS));
        }
      } catch (sErr) {
        console.warn('SaaS cloud settings sync warning:', sErr);
      }
    }

    // Guarantee active Product Targets exist for the current month
    if (db.productTargets) {
      try {
        const curMonth = new Date().toISOString().substring(0, 7);
        const existingTargets = await db.productTargets.toArray();
        const monthTargets = existingTargets.filter(t => t.targetMonth === curMonth);
        if (monthTargets.length === 0) {
          const prods = await db.products.toArray();
          const p1 = prods[0] || { id: 1, name: 'Chilli Powder Card - 20s (මිරිස් කුඩු කාඩ්)', unit: 'Card' };
          const p2 = prods[1] || { id: 2, name: 'Chilli Pieces Card - 20s (කෑලි මිරිස් කාඩ්)', unit: 'Card' };
          const p3 = prods[2] || { id: 3, name: 'Curry Powder Card - 20s (තුනපහ කුඩු කාඩ්)', unit: 'Card' };

          await db.productTargets.bulkAdd([
            {
              id: 'pt_' + curMonth + '_1',
              tenantId: 1,
              empNo: 'EMP-005',
              repName: 'Sales Rep (Order Booker)',
              productId: String(p1.id),
              productName: p1.name,
              targetQty: 50,
              unit: p1.unit || 'Card',
              period: 'Monthly',
              targetMonth: curMonth,
              bonus: 1500,
              notes: 'Monthly route target',
              createdAt: new Date().toISOString()
            },
            {
              id: 'pt_' + curMonth + '_2',
              tenantId: 1,
              empNo: 'EMP-005',
              repName: 'Sales Rep (Order Booker)',
              productId: String(p2.id),
              productName: p2.name,
              targetQty: 40,
              unit: p2.unit || 'Card',
              period: 'Monthly',
              targetMonth: curMonth,
              bonus: 1200,
              notes: 'Monthly route target',
              createdAt: new Date().toISOString()
            },
            {
              id: 'pt_' + curMonth + '_3',
              tenantId: 1,
              empNo: 'EMP-005',
              repName: 'Sales Rep (Order Booker)',
              productId: String(p3.id),
              productName: p3.name,
              targetQty: 30,
              unit: p3.unit || 'Card',
              period: 'Monthly',
              targetMonth: curMonth,
              bonus: 1000,
              notes: 'Monthly route target',
              createdAt: new Date().toISOString()
            }
          ]);
          console.log(`[DB] Auto-seeded 3 active product targets for month ${curMonth}`);
        }
      } catch (ptErr) {
        console.warn('Product target auto-seed notice:', ptErr);
      }
    }
  } catch (err) {
    console.error('Error init defaults:', err);
  }
}

// Auto-seed HR user if missing from existing users collection
async function ensureHrUserExists() {
  if (typeof db === 'undefined' || !db.users) return;
  try {
    if (typeof db.users._ensureLoaded === 'function') {
      await db.users._ensureLoaded();
    }
    const allUsers = await db.users.toArray();
    if (allUsers.length === 0 && firestore) {
      // Don't auto-seed if we haven't loaded records from server yet
      return;
    }
    let hrUser = allUsers.find(u => u.username === 'hr' || u.username === 'hr1' || u.role === 'hr');
    if (!hrUser) {
      const maxId = allUsers.reduce((m, u) => Math.max(m, Number(u.id) || 0), 0);
      await db.users.add({
        id: maxId + 1,
        tenantId: 1,
        username: 'hr',
        fullName: 'HR DEPARTMENT',
        role: 'hr',
        pin: '9999',
        phone: '077 888 9900',
        assignedRouteId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      });
      console.log('✅ Auto-seeded user: hr / HR DEPARTMENT (PIN: 9999)');
    } else {
      // Ensure fullName is HR DEPARTMENT and username is hr
      if (hrUser.fullName !== 'HR DEPARTMENT' || (hrUser.username !== 'hr' && hrUser.username !== 'hr1')) {
        await db.users.update(hrUser.id, {
          username: 'hr',
          fullName: 'HR DEPARTMENT',
          role: 'hr',
          isActive: true
        });
      }
    }

    // Guarantee that Stores Keeper user exists
    let storeUser = allUsers.find(u => u.username === 'store' || u.role === 'stores');
    if (!storeUser) {
      const maxId2 = allUsers.reduce((m, u) => Math.max(m, Number(u.id) || 0), 0);
      await db.users.add({
        id: maxId2 + 1,
        tenantId: 1,
        username: 'store',
        fullName: 'Stores Keeper',
        role: 'stores',
        pin: '1234',
        phone: '077 777 8899',
        assignedRouteId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      });
      console.log('✅ Auto-seeded user: store / Stores Keeper (PIN: 1234)');
    }
  } catch (e) {
    console.warn('ensureHrUserExists check error:', e);
  }
}
window.ensureHrUserExists = ensureHrUserExists;

// 8. Seed Sample Realistic Sri Lankan Spice Business Data
async function seedSampleData() {
  try {
    // Clear existing transactional and entity data to guarantee clean seed
    await clearAllDatabase();

    // 1. Routes
    const r1 = await db.routes.add({ tenantId: 1, name: 'Galnewa Route (ගල්නෑව)', description: 'Galnewa, Bulnewa, Negampaha' });
    const r2 = await db.routes.add({ tenantId: 1, name: 'Anuradhapura Town Route (අනුරාධපුර නගරය)', description: 'Town, Market, Airport Road' });
    const r3 = await db.routes.add({ tenantId: 1, name: 'Kekirawa Route (කැකිරාව)', description: 'Kekirawa, Maradankadawala' });

    // 2. Products (Hanging Display Cards & Packets with Free Issue Schemes)
    const p1 = await db.products.add({
      tenantId: 1,
      name: 'Chilli Powder Card - 20s (මිරිස් කුඩු කාඩ්)',
      unit: 'Card',
      costPrice: 380,
      sellingPrice: 500,
      category: 'Cards',
      packetsPerCard: 20,
      packetRetailPrice: 30,
      freeSchemeEnabled: true,
      freeSchemeMinQty: 12,
      freeSchemeFreeQty: 1,
      currentStock: 100,
      isActive: true,
      updatedAt: new Date().toISOString()
    });
    const p2 = await db.products.add({
      tenantId: 1,
      name: 'Chilli Pieces Card - 20s (කෑලි මිරිස් කාඩ්)',
      unit: 'Card',
      costPrice: 400,
      sellingPrice: 520,
      category: 'Cards',
      packetsPerCard: 20,
      packetRetailPrice: 32,
      freeSchemeEnabled: true,
      freeSchemeMinQty: 12,
      freeSchemeFreeQty: 1,
      currentStock: 80,
      isActive: true,
      updatedAt: new Date().toISOString()
    });
    const p3 = await db.products.add({
      tenantId: 1,
      name: 'Curry Powder Card - 20s (තුනපහ කුඩු කාඩ්)',
      unit: 'Card',
      costPrice: 360,
      sellingPrice: 480,
      category: 'Cards',
      packetsPerCard: 20,
      packetRetailPrice: 30,
      freeSchemeEnabled: false,
      freeSchemeMinQty: 0,
      freeSchemeFreeQty: 0,
      currentStock: 90,
      isActive: true,
      updatedAt: new Date().toISOString()
    });
    const p4 = await db.products.add({
      tenantId: 1,
      name: 'Roasted Meat Curry Card - 16s (මස් කුඩු කාඩ්)',
      unit: 'Card',
      costPrice: 420,
      sellingPrice: 560,
      category: 'Cards',
      packetsPerCard: 16,
      packetRetailPrice: 40,
      freeSchemeEnabled: true,
      freeSchemeMinQty: 10,
      freeSchemeFreeQty: 1,
      currentStock: 75,
      isActive: true,
      updatedAt: new Date().toISOString()
    });
    const p5 = await db.products.add({
      tenantId: 1,
      name: 'Turmeric Powder Card - 20s (කහ කුඩු කාඩ්)',
      unit: 'Card',
      costPrice: 450,
      sellingPrice: 600,
      category: 'Cards',
      packetsPerCard: 20,
      packetRetailPrice: 35,
      freeSchemeEnabled: false,
      freeSchemeMinQty: 0,
      freeSchemeFreeQty: 0,
      currentStock: 60,
      isActive: true,
      updatedAt: new Date().toISOString()
    });
    const p6 = await db.products.add({
      tenantId: 1,
      name: 'Black Pepper Card - 16s (ගම්මිරිස් කුඩු කාඩ්)',
      unit: 'Card',
      costPrice: 480,
      sellingPrice: 640,
      category: 'Cards',
      packetsPerCard: 16,
      packetRetailPrice: 45,
      freeSchemeEnabled: false,
      freeSchemeMinQty: 0,
      freeSchemeFreeQty: 0,
      currentStock: 50,
      isActive: true,
      updatedAt: new Date().toISOString()
    });
    const p7 = await db.products.add({
      tenantId: 1,
      name: 'Mustard Seeds Packet - 100g (අබ)',
      unit: 'Packet',
      costPrice: 60,
      sellingPrice: 85,
      category: 'Packets',
      packetsPerCard: 1,
      packetRetailPrice: 85,
      freeSchemeEnabled: false,
      freeSchemeMinQty: 0,
      freeSchemeFreeQty: 0,
      currentStock: 120,
      isActive: true,
      updatedAt: new Date().toISOString()
    });
    const p8 = await db.products.add({
      tenantId: 1,
      name: 'Cumin Seeds Packet - 50g (සූදුරු)',
      unit: 'Packet',
      costPrice: 75,
      sellingPrice: 110,
      category: 'Packets',
      packetsPerCard: 1,
      packetRetailPrice: 110,
      freeSchemeEnabled: false,
      freeSchemeMinQty: 0,
      freeSchemeFreeQty: 0,
      currentStock: 110,
      isActive: true,
      updatedAt: new Date().toISOString()
    });

    // 3. Shops with Precise Galnewa-Hadungama GPS Coordinates
    const s1 = await db.shops.add({
      tenantId: 1,
      routeId: r1,
      name: 'Saman Stores (සමන් ස්ටෝර්ස්)',
      ownerName: 'Saman Kumara',
      phone: '0714567890',
      address: 'Near Galnewa Junction',
      lat: 8.0886000,
      lng: 80.4578000,
      photoBase64: '',
      currentCredit: 2500
    });

    const s2 = await db.shops.add({
      tenantId: 1,
      routeId: r1,
      name: 'Nimali Grocery (නිමාලි ග්‍රොසරි)',
      ownerName: 'Nimal Wijeratne',
      phone: '0778899112',
      address: 'Bulnewa Post Office Rd',
      lat: 8.0950000,
      lng: 80.4720000,
      photoBase64: '',
      currentCredit: 0
    });

    const s3 = await db.shops.add({
      tenantId: 1,
      routeId: r1,
      name: 'Bulnewa City Mart (බුල්නෑව)',
      ownerName: 'Sunil Bulnewa',
      phone: '0771239988',
      address: 'Bulnewa Main Junction',
      lat: 8.1030000,
      lng: 80.4850000,
      photoBase64: '',
      currentCredit: 1500
    });

    const s4 = await db.shops.add({
      tenantId: 1,
      routeId: r1,
      name: 'Negampaha Stores (නෙගම්පහ)',
      ownerName: 'K. Jayalath',
      phone: '0789988776',
      address: 'Negampaha Market Road',
      lat: 8.1180000,
      lng: 80.5050000,
      photoBase64: '',
      currentCredit: 1200
    });

    const s5 = await db.shops.add({
      tenantId: 1,
      routeId: r2,
      name: 'Rajarata Super City',
      ownerName: 'Mohamed Rizvi',
      phone: '0751234567',
      address: 'Main Street, Anuradhapura',
      lat: 8.3114000,
      lng: 80.4037000,
      photoBase64: '',
      currentCredit: 5200
    });

    // 4. Sample Delivered Sale Today
    const today = new Date().toISOString();
    const todayDateStr = today.split('T')[0];
    const invoiceNo = 'INV-' + String(Math.floor(100000 + Math.random() * 900000));
    
    const saleId = await db.sales.add({
      tenantId: 1,
      invoiceNo: invoiceNo,
      date: today,
      deliveryDate: todayDateStr,
      status: 'Delivered',
      shopId: s1,
      routeId: r1,
      repId: 5,
      repName: 'Sales Rep',
      totalAmount: 3120,
      totalCost: 2360,
      profit: 760,
      paidAmount: 2000,
      creditAmount: 1120,
      paymentType: 'Partial',
      cancelReason: '',
      note: 'Delivered batch'
    });

    await db.saleItems.bulkAdd([
      {
        tenantId: 1,
        saleId: saleId,
        productId: p1,
        productName: 'Chilli Powder Card - 20s (මිරිස් කුඩු කාඩ්)',
        unit: 'Card',
        qty: 4,
        costPrice: 380,
        sellingPrice: 500,
        subtotal: 2000,
        costTotal: 1520,
        profit: 480
      },
      {
        tenantId: 1,
        saleId: saleId,
        productId: p4,
        productName: 'Roasted Meat Curry Card - 16s (මස් කුඩු කාඩ්)',
        unit: 'Card',
        qty: 2,
        costPrice: 420,
        sellingPrice: 560,
        subtotal: 1120,
        costTotal: 840,
        profit: 280
      }
    ]);

    // 5. Sample Booked Pending Order for Tomorrow's Delivery
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString();
    const tomorrowDateStr = tomorrowIso.split('T')[0];
    const pendingInvNo = 'ORD-' + String(Math.floor(100000 + Math.random() * 900000));

    const pendingSaleId = await db.sales.add({
      tenantId: 1,
      invoiceNo: pendingInvNo,
      date: today,
      deliveryDate: tomorrowDateStr,
      status: 'Pending',
      shopId: s2,
      routeId: r1,
      repId: 5,
      repName: 'Sales Rep',
      totalAmount: 2040,
      totalCost: 1560,
      profit: 480,
      paidAmount: 0,
      creditAmount: 0,
      paymentType: 'Pending',
      cancelReason: '',
      note: 'Booked for tomorrow delivery'
    });

    await db.saleItems.bulkAdd([
      {
        tenantId: 1,
        saleId: pendingSaleId,
        productId: p2,
        productName: 'Chilli Pieces Card - 20s (කෑලි මිරිස් කාඩ්)',
        unit: 'Card',
        qty: 2,
        costPrice: 400,
        sellingPrice: 520,
        subtotal: 1040,
        costTotal: 800,
        profit: 240
      },
      {
        tenantId: 1,
        saleId: pendingSaleId,
        productId: p1,
        productName: 'Chilli Powder Card - 20s (මිරිස් කුඩු කාඩ්)',
        unit: 'Card',
        qty: 2,
        costPrice: 380,
        sellingPrice: 500,
        subtotal: 1000,
        costTotal: 760,
        profit: 240
      }
    ]);

    // 6. Sample Debt Collection Today
    await db.creditPayments.add({
      tenantId: 1,
      shopId: s3,
      routeId: r2,
      repId: 5,
      repName: 'Sales Rep',
      date: today,
      amountPaid: 1500,
      previousCredit: 6700,
      newCredit: 5200,
      note: 'Collected cash at Rajarata Super'
    });

    return { success: true, message: 'Sample routes, spice products, shops, and orders loaded successfully in Firestore!' };
  } catch (err) {
    console.error('Seed error:', err);
    return { success: false, message: 'Error loading demo data: ' + err.message };
  }
}

// 9. Clear all database tables
async function clearAllDatabase(keepUsers = true) {
  await db.sales.clear();
  await db.saleItems.clear();
  if (db.salesReturns) await db.salesReturns.clear();
  await db.creditPayments.clear();
  await db.shops.clear();
  await db.products.clear();
  await db.routes.clear();
  if (db.stockLedger) await db.stockLedger.clear();
  if (db.lorryTrips) await db.lorryTrips.clear();
  if (!keepUsers) {
    await db.users.clear();
  }
  return true;
}

// 10. Full Database Export to JSON
async function exportDatabaseToJson() {
  const data = {
    version: 8,
    timestamp: new Date().toISOString(),
    company: await db.company.toArray(),
    users: await db.users.toArray(),
    routes: await db.routes.toArray(),
    products: await db.products.toArray(),
    shops: await db.shops.toArray(),
    sales: await db.sales.toArray(),
    saleItems: await db.saleItems.toArray(),
    salesReturns: db.salesReturns ? await db.salesReturns.toArray() : [],
    creditPayments: await db.creditPayments.toArray(),
    stockLedger: db.stockLedger ? await db.stockLedger.toArray() : [],
    lorryTrips: db.lorryTrips ? await db.lorryTrips.toArray() : [],
    tenants: db.tenants ? await db.tenants.toArray() : []
  };
  return JSON.stringify(data, null, 2);
}

// 11. Restore Database from JSON
async function importDatabaseFromJson(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.company || !data.routes || !data.products || !data.shops) {
      throw new Error('Invalid backup file structure: missing core collections (company, routes, products, shops).');
    }

    const targetTenantId = getActiveTenantId() || 1;

    // Helper to ensure all imported records have a valid tenantId matching current active tenant
    const normalizeWithTenant = (records) => {
      if (!Array.isArray(records)) return [];
      return records.map(r => {
        const tId = (r.tenantId !== undefined && r.tenantId !== null) ? Number(r.tenantId) : targetTenantId;
        return Object.assign({}, r, { tenantId: tId });
      });
    };

    await clearAllDatabase(false);

    if (data.company && data.company.length > 0) {
      await db.company.clear();
      await db.company.bulkAdd(normalizeWithTenant(data.company));
    }
    if (data.users && data.users.length > 0) await db.users.bulkAdd(normalizeWithTenant(data.users));
    if (data.routes && data.routes.length > 0) await db.routes.bulkAdd(normalizeWithTenant(data.routes));
    if (data.products && data.products.length > 0) await db.products.bulkAdd(normalizeWithTenant(data.products));
    if (data.shops && data.shops.length > 0) await db.shops.bulkAdd(normalizeWithTenant(data.shops));
    if (data.sales && data.sales.length > 0) await db.sales.bulkAdd(normalizeWithTenant(data.sales));
    if (data.saleItems && data.saleItems.length > 0) await db.saleItems.bulkAdd(normalizeWithTenant(data.saleItems));
    if (data.salesReturns && data.salesReturns.length > 0 && db.salesReturns) await db.salesReturns.bulkAdd(normalizeWithTenant(data.salesReturns));
    if (data.creditPayments && data.creditPayments.length > 0) await db.creditPayments.bulkAdd(normalizeWithTenant(data.creditPayments));
    if (data.stockLedger && data.stockLedger.length > 0 && db.stockLedger) await db.stockLedger.bulkAdd(normalizeWithTenant(data.stockLedger));
    if (data.lorryTrips && data.lorryTrips.length > 0 && db.lorryTrips) await db.lorryTrips.bulkAdd(normalizeWithTenant(data.lorryTrips));
    if (data.tenants && data.tenants.length > 0 && db.tenants) await db.tenants.bulkAdd(data.tenants);

    // Trigger reactive notification
    notifyFirestoreChange('sales');

    // Immediate reload of active controllers
    try {
      if (typeof Dashboard !== 'undefined' && Dashboard.loadDashboard) await Dashboard.loadDashboard();
      if (typeof Reports !== 'undefined' && Reports.loadReports) await Reports.loadReports();
      if (typeof Products !== 'undefined' && Products.loadProducts) await Products.loadProducts();
      if (typeof Shops !== 'undefined' && Shops.loadShops) await Shops.loadShops();
      if (typeof Routes !== 'undefined' && Routes.loadRoutes) await Routes.loadRoutes();
      if (typeof POS !== 'undefined' && POS.init) await POS.init();
    } catch (uiErr) {
      console.warn('UI refresh notice after restore:', uiErr);
    }

    return { 
      success: true, 
      message: `දත්ත සාර්ථකව Restore කරන ලදී! (${(data.products || []).length} Products, ${(data.sales || []).length} Sales, ${(data.shops || []).length} Shops)` 
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

