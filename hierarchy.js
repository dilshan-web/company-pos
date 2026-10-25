/**
 * Hierarchy & Role-Based Territory & Team Isolation Module
 * 
 * Supports complete organizational hierarchy:
 * 1. SuperAdmin / Master Admin (👑 Owner) - Complete company-wide view (all routes, shops, staff, profit)
 * 2. SM (👔 Sales Manager) - Oversees all sales routes or assigned regional divisions
 * 3. ASM (💼 Area Sales Manager) - Manages assigned Supervisors and Reps (only sees their data)
 * 4. Supervisor (📋 Field Supervisor) - Manages 3 to 5 assigned Reps (only sees their shops, routes, bills, attendance)
 * 5. Rep (🚚 Sales Rep) - ONLY sees their assigned routes and shops (no other rep's territory)
 * 6. Delivery (📦 Delivery Driver) - Dispatch, Lorry, Collections & Route Map
 * 7. Stores (🏬 Stores Keeper) - Production stock, Packing, Dispatch
 * 8. HR (👥 HR & Payroll Officer) - Staff, Payroll, Attendance, Field Photos (NO routes or shops)
 */

const Hierarchy = {
  getCurrentUser() {
    return (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
  },

  /**
   * Returns array of numeric user IDs allowed for the current logged-in user.
   * Returns null if user has full master access (Admin / SuperAdmin).
   */
  async getAllowedRepIds(user = null) {
    const u = user || this.getCurrentUser();
    if (!u) return null;
    const role = u.role;

    // Master Owner and Super Admin have unrestricted view across all reps
    if (role === 'admin' || role === 'superadmin') {
      return null;
    }

    // Sales Rep only has access to their own data
    if (role === 'rep') {
      return [Number(u.id)];
    }

    // Field Supervisor only has access to their assigned Reps (e.g. 3 to 5 reps)
    if (role === 'supervisor') {
      let repIds = new Set();
      if (Array.isArray(u.assignedRepIds)) {
        u.assignedRepIds.forEach(id => repIds.add(Number(id)));
      }
      // Also check if any rep points to this supervisor via supervisorId
      try {
        if (typeof db !== 'undefined' && db.users) {
          const allUsers = filterByTenant(await db.users.toArray());
          allUsers.filter(usr => usr.role === 'rep' && Number(usr.supervisorId) === Number(u.id))
                  .forEach(usr => repIds.add(Number(usr.id)));
        }
      } catch (e) {}

      return Array.from(repIds);
    }

    // Area Sales Manager (ASM) has access to assigned Supervisors and Reps
    if (role === 'asm') {
      let repIds = new Set();
      if (Array.isArray(u.assignedRepIds)) {
        u.assignedRepIds.forEach(id => repIds.add(Number(id)));
      }
      // Fetch reps working under supervisors assigned to this ASM
      try {
        if (typeof db !== 'undefined' && db.users) {
          const allUsers = filterByTenant(await db.users.toArray());
          const supIds = Array.isArray(u.assignedSupervisorIds) ? u.assignedSupervisorIds.map(Number) : [];
          allUsers.filter(usr => usr.role === 'rep' && supIds.includes(Number(usr.supervisorId)))
                  .forEach(usr => repIds.add(Number(usr.id)));
        }
      } catch (e) {}

      return Array.from(repIds);
    }

    // Sales Manager (SM)
    if (role === 'sm') {
      if (Array.isArray(u.assignedRepIds) && u.assignedRepIds.length > 0) {
        return u.assignedRepIds.map(Number);
      }
      return null; // Full sales view if unassigned
    }

    return null;
  },

  /**
   * Returns array of numeric Route IDs allowed for the current logged-in user.
   * Returns null if unrestricted (Admin / SuperAdmin).
   */
  async getAllowedRouteIds(user = null) {
    const u = user || this.getCurrentUser();
    if (!u) return null;
    const role = u.role;

    if (role === 'admin' || role === 'superadmin') {
      return null; // All routes
    }

    if (role === 'rep') {
      const routeIds = new Set();
      if (u.assignedRouteId) routeIds.add(Number(u.assignedRouteId));
      if (Array.isArray(u.assignedRouteIds)) {
        u.assignedRouteIds.forEach(id => routeIds.add(Number(id)));
      }
      // Also include any routes created by this rep
      try {
        if (typeof db !== 'undefined' && db.routes) {
          const allRoutes = filterByTenant(await db.routes.toArray());
          allRoutes.filter(r => Number(r.createdByRepId) === Number(u.id) || (r.createdBy && r.createdBy.toLowerCase() === u.username.toLowerCase()))
                   .forEach(r => routeIds.add(Number(r.id)));
        }
      } catch (e) {}

      return Array.from(routeIds);
    }

    if (role === 'supervisor' || role === 'asm') {
      const allowedRepIds = await this.getAllowedRepIds(u);
      if (!allowedRepIds || allowedRepIds.length === 0) {
        return [];
      }
      const routeIds = new Set();
      try {
        if (typeof db !== 'undefined' && db.users) {
          const allUsers = filterByTenant(await db.users.toArray());
          const teamReps = allUsers.filter(usr => allowedRepIds.includes(Number(usr.id)));
          teamReps.forEach(rep => {
            if (rep.assignedRouteId) routeIds.add(Number(rep.assignedRouteId));
            if (Array.isArray(rep.assignedRouteIds)) {
              rep.assignedRouteIds.forEach(id => routeIds.add(Number(id)));
            }
          });
        }
        if (typeof db !== 'undefined' && db.routes) {
          const allRoutes = filterByTenant(await db.routes.toArray());
          allRoutes.filter(r => allowedRepIds.includes(Number(r.createdByRepId)))
                   .forEach(r => routeIds.add(Number(r.id)));
        }
      } catch (e) {}

      return Array.from(routeIds);
    }

    return null;
  },

  /**
   * Filter routes array based on user hierarchy
   */
  async filterRoutes(routes, user = null) {
    if (!Array.isArray(routes)) return [];
    const u = user || this.getCurrentUser();
    if (!u || u.role === 'admin' || u.role === 'superadmin') return routes;

    const allowedRouteIds = await this.getAllowedRouteIds(u);
    if (allowedRouteIds === null) return routes;

    // If rep has no routes assigned yet, allow them to see routes they created
    if (allowedRouteIds.length === 0) {
      const myCreated = routes.filter(r => Number(r.createdByRepId) === Number(u.id));
      return myCreated;
    }

    return routes.filter(r =>
      allowedRouteIds.includes(Number(r.id)) ||
      Number(r.createdByRepId) === Number(u.id)
    );
  },

  /**
   * Filter shops array based on user hierarchy
   * A rep ONLY sees shops in their assigned routes or created by them!
   * A supervisor ONLY sees shops in their 3-5 reps' routes or created by their reps!
   */
  async filterShops(shops, user = null) {
    if (!Array.isArray(shops)) return [];
    const u = user || this.getCurrentUser();
    if (!u || u.role === 'admin' || u.role === 'superadmin') return shops;
    const role = u.role;

    if (role === 'rep') {
      const allowedRouteIds = await this.getAllowedRouteIds(u);
      return shops.filter(s => {
        // Shop created by this rep
        if (s.repId && Number(s.repId) === Number(u.id)) return true;
        if (s.createdBy && String(s.createdBy).toLowerCase() === String(u.username).toLowerCase()) return true;
        // Shop in rep's assigned route
        if (allowedRouteIds && allowedRouteIds.includes(Number(s.routeId))) return true;
        return false;
      });
    }

    if (role === 'supervisor' || role === 'asm') {
      const allowedRepIds = await this.getAllowedRepIds(u);
      const allowedRouteIds = await this.getAllowedRouteIds(u);

      return shops.filter(s => {
        if (s.repId && allowedRepIds && allowedRepIds.includes(Number(s.repId))) return true;
        if (allowedRouteIds && allowedRouteIds.includes(Number(s.routeId))) return true;
        return false;
      });
    }

    return shops;
  },

  /**
   * Filter sales / bills array based on user hierarchy
   * Rep only sees their bills
   * Supervisor only sees bills of their 3-5 reps
   * ASM only sees bills of their assigned team
   */
  async filterSales(sales, user = null) {
    if (!Array.isArray(sales)) return [];
    const u = user || this.getCurrentUser();
    if (!u || u.role === 'admin' || u.role === 'superadmin') return sales;
    const role = u.role;

    if (role === 'rep') {
      const uName = (u.username || '').toLowerCase().trim();
      const fName = (u.fullName || '').toLowerCase().trim();
      return sales.filter(s => {
        if (s.repId && (Number(s.repId) === Number(u.id) || String(s.repId) === String(u.id))) return true;
        const rName = (s.repName || '').toLowerCase().trim();
        if (uName && (rName.includes(uName) || uName.includes(rName))) return true;
        if (fName && (rName.includes(fName) || fName.includes(rName))) return true;
        return false;
      });
    }

    if (role === 'supervisor' || role === 'asm') {
      const allowedRepIds = await this.getAllowedRepIds(u);
      if (!allowedRepIds || allowedRepIds.length === 0) return [];
      return sales.filter(s => {
        if (s.repId && allowedRepIds.includes(Number(s.repId))) return true;
        return false;
      });
    }

    return sales;
  },

  /**
   * Filter rep live GPS locations
   */
  async filterRepLocations(locations, user = null) {
    if (!Array.isArray(locations)) return [];
    const u = user || this.getCurrentUser();
    if (!u || u.role === 'admin' || u.role === 'superadmin' || u.role === 'hr') return locations;

    const allowedRepIds = await this.getAllowedRepIds(u);
    if (!allowedRepIds) return locations;
    return locations.filter(loc => allowedRepIds.includes(Number(loc.repId || loc.id)));
  },

  /**
   * Filter field attendance records
   */
  async filterAttendance(attendanceRecords, user = null) {
    if (!Array.isArray(attendanceRecords)) return [];
    const u = user || this.getCurrentUser();
    if (!u || u.role === 'admin' || u.role === 'superadmin' || u.role === 'hr') return attendanceRecords;

    const allowedRepIds = await this.getAllowedRepIds(u);
    if (!allowedRepIds) return attendanceRecords;

    return attendanceRecords.filter(att => {
      if (att.repId && allowedRepIds.includes(Number(att.repId))) return true;
      if (att.empNo) {
        const empNum = parseInt(att.empNo.replace(/\D/g, ''), 10);
        if (empNum && allowedRepIds.includes(empNum)) return true;
      }
      return false;
    });
  },

  /**
   * Filter field display & promotion photos
   */
  async filterFieldPhotos(photos, user = null) {
    if (!Array.isArray(photos)) return [];
    const u = user || this.getCurrentUser();
    if (!u || u.role === 'admin' || u.role === 'superadmin' || u.role === 'hr') return photos;

    const allowedRepIds = await this.getAllowedRepIds(u);
    if (!allowedRepIds) return photos;
    return photos.filter(p => allowedRepIds.includes(Number(p.repId)));
  }
};

window.Hierarchy = Hierarchy;
