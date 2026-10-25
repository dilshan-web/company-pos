/**
 * Route & Territory Management Module
 */

const Routes = {
  async loadRoutes() {
    try {
      let routes = await db.routes.toArray();
      routes = filterByTenant(routes);
      if (typeof Hierarchy !== 'undefined') {
        routes = await Hierarchy.filterRoutes(routes);
      }
      const container = document.getElementById('routes-list-container');
      if (!container) return;

      if (routes.length === 0) {
        container.innerHTML = `
          <div class="text-center py-10 bg-white rounded-2xl border border-gray-100 p-6">
            <div class="text-4xl mb-2">🗺️</div>
            <h3 class="font-bold text-gray-700">No Routes Created Yet</h3>
            <p class="text-xs text-gray-400 mt-1">Add sales routes (e.g. Galnewa Route, Town Route) to group your retail shops.</p>
            <button onclick="Routes.openRouteModal()" class="mt-4 px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-xl shadow hover:bg-orange-700">
              + Add First Route
            </button>
          </div>
        `;
        return;
      }

      let html = '';
      for (const route of routes) {
        let shopsInRoute = await db.shops.where('routeId').equals(route.id).toArray();
        shopsInRoute = filterByTenant(shopsInRoute);
        if (typeof Hierarchy !== 'undefined') {
          shopsInRoute = await Hierarchy.filterShops(shopsInRoute);
        }
        const totalCreditInRoute = shopsInRoute.reduce((sum, s) => sum + (s.currentCredit || 0), 0);

        html += `
          <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:border-orange-200 transition-all">
            <div class="flex items-start justify-between">
              <div>
                <span class="inline-block px-2 py-0.5 text-[10px] font-bold bg-orange-50 text-orange-700 rounded-md mb-1">ROUTE #${route.id}</span>
                <h3 class="font-bold text-gray-900 text-base">${route.name}</h3>
                <p class="text-xs text-gray-500 mt-0.5">${route.description || 'No description'}</p>
              </div>
              <div class="flex items-center gap-1">
                <button onclick="Routes.editRoute(${route.id})" class="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg">
                  ✏️
                </button>
                <button onclick="Routes.deleteRoute(${route.id})" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  🗑️
                </button>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-xs">
              <div class="flex items-center gap-1 text-gray-600 font-medium">
                <span>🏪</span> <span>${shopsInRoute.length} Shops</span>
              </div>
              <div class="font-bold ${totalCreditInRoute > 0 ? 'text-red-600' : 'text-green-600'}">
                Credit: ${UI.formatCurrency(totalCreditInRoute)}
              </div>
            </div>
          </div>
        `;
      }

      container.innerHTML = html;
    } catch (err) {
      console.error('Error loading routes:', err);
    }
  },

  openRouteModal(route = null) {
    document.getElementById('route-modal-id').value = route ? route.id : '';
    document.getElementById('route-modal-name').value = route ? route.name : '';
    document.getElementById('route-modal-desc').value = route ? (route.description || '') : '';
    document.getElementById('route-modal-title').textContent = route ? 'Edit Route' : 'Add New Route';
    UI.openModal('modal-route-form');
  },

  async editRoute(id) {
    const route = await db.routes.get(id);
    if (route) {
      this.openRouteModal(route);
    }
  },

  async saveRoute() {
    const id = document.getElementById('route-modal-id').value;
    const name = document.getElementById('route-modal-name').value.trim();
    const description = document.getElementById('route-modal-desc').value.trim();
    const activeTid = getActiveTenantId() || 1;

    if (!name) {
      UI.showToast('Please enter a Route Name', 'warning');
      return;
    }

    try {
      const currentUser = (typeof Auth !== 'undefined' && Auth.currentUser) || null;
      const repId = currentUser ? currentUser.id : null;
      const createdBy = currentUser ? currentUser.username : 'admin';

      if (id) {
        await db.routes.update(Number(id), { name, description, tenantId: activeTid, updatedAt: new Date().toISOString() });
        UI.showToast('Route updated successfully!', 'success');
        if (typeof SoundFX !== 'undefined') SoundFX.play('route');
      } else {
        await db.routes.add({
          tenantId: activeTid,
          name,
          description,
          createdByRepId: repId,
          createdBy: createdBy,
          updatedAt: new Date().toISOString()
        });
        UI.showToast('New route created successfully!', 'success');
        if (typeof SoundFX !== 'undefined') SoundFX.play('route');
      }
      UI.closeModal('modal-route-form');
      this.loadRoutes();
    } catch (err) {
      UI.showToast('Error saving route', 'error');
    }
  },

  async deleteRoute(id) {
    const shopCount = await db.shops.where('routeId').equals(id).count();
    if (shopCount > 0) {
      alert(`Cannot delete route. There are ${shopCount} shops assigned to this route. Reassign or delete the shops first.`);
      return;
    }

    if (confirm('Are you sure you want to delete this route?')) {
      await db.routes.delete(id);
      UI.showToast('Route deleted', 'info');
      this.loadRoutes();
    }
  }
};
