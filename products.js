/**
 * Product Master Catalog Module
 * Supports Spice Hanging Cards, Packet Packaging, Loose Returns, and Free Issue Slabs
 */

const Products = {
  currentFreeSlabs: [],

  async loadProducts() {
    try {
      let products = await db.products.toArray();
      products = filterByTenant(products);
      const container = document.getElementById('products-list-container');
      if (!container) return;

      if (products.length === 0) {
        container.innerHTML = `
          <div class="text-center py-10 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm col-span-full">
            <div class="text-4xl mb-2">🌶️</div>
            <h3 class="font-bold text-slate-700">No Products Found</h3>
            <p class="text-xs text-slate-400 mt-1">Add spice cards, packets, or items with cost & wholesale selling prices.</p>
            <button onclick="Products.openProductModal()" class="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-2xl shadow hover:bg-emerald-700 active:scale-95">
              + Add First Product
            </button>
          </div>
        `;
        return;
      }

      let html = '';
      for (const prod of products) {
        const cost = Number(prod.costPrice) || 0;
        const sell = Number(prod.sellingPrice) || 0;
        const profit = sell - cost;
        const marginPct = sell > 0 ? ((profit / sell) * 100).toFixed(1) : 0;
        const isCard = (prod.unit || 'Card').toLowerCase() === 'card';
        const packetsPerCard = isCard ? (Number(prod.packetsPerCard) || 20) : 1;
        const packetWholesaleVal = isCard ? (sell / packetsPerCard).toFixed(2) : sell.toFixed(2);

        const isAdmin = (typeof Auth !== 'undefined' && (Auth.currentUser?.role === 'admin' || Auth.currentUser?.role === 'superadmin'));

        let slabBadge = '';
        if (prod.freeSchemeEnabled) {
          if (Array.isArray(prod.freeSlabs) && prod.freeSlabs.length > 0) {
            const slabSummary = prod.freeSlabs.map(s => `${s.minQty}/${s.freeQty}`).join(', ');
            slabBadge = `
              <span class="px-2 py-0.5 text-[10px] font-black bg-purple-100 text-purple-800 rounded-lg">
                🎁 Free: ${slabSummary}
              </span>
            `;
          } else {
            slabBadge = `
              <span class="px-2 py-0.5 text-[10px] font-black bg-purple-100 text-purple-800 rounded-lg">
                🎁 Buy ${prod.freeSchemeMinQty || 12} +${prod.freeSchemeFreeQty || 1} Free
              </span>
            `;
          }
        }

        html += `
          <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-all">
            <div>
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="px-2 py-0.5 text-[10px] font-black ${isCard ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'} rounded-lg">
                      ${prod.unit || 'Card'}
                    </span>
                    ${isCard ? `
                      <span class="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 rounded-lg">
                        📦 ${packetsPerCard} Pkts / Card
                      </span>
                    ` : ''}
                    ${prod.category ? `<span class="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-lg">${prod.category}</span>` : ''}
                    ${slabBadge}
                  </div>
                  <h3 class="font-black text-slate-900 text-sm mt-1.5">${prod.name}</h3>
                  ${isCard ? `
                    <p class="text-[11px] text-slate-500 mt-0.5">
                      1 Loose Pkt Wholesale: <span class="font-bold text-slate-700">Rs. ${packetWholesaleVal}</span>
                      ${prod.packetRetailPrice ? ` • MRP: <span class="font-bold text-slate-700">Rs. ${Number(prod.packetRetailPrice).toFixed(2)}</span>` : ''}
                    </p>
                  ` : ''}
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                  <button onclick="Products.editProduct(${prod.id})" class="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl active:scale-95" title="Edit">
                    ✏️
                  </button>
                  <button onclick="Products.deleteProduct(${prod.id})" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl active:scale-95" title="Delete">
                    🗑️
                  </button>
                </div>
              </div>

              <div class="mt-3 pt-3 border-t border-slate-100 grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-1'} gap-2 text-center text-xs">
                ${isAdmin ? `
                  <div class="bg-slate-50 p-2 rounded-2xl admin-profit-only">
                    <span class="text-[9px] text-slate-400 block font-semibold uppercase">Cost (COGS)</span>
                    <span class="font-bold text-slate-700">${UI.formatCurrency(cost)}</span>
                  </div>
                ` : ''}
                <div class="bg-emerald-50 p-2 rounded-2xl">
                  <span class="text-[9px] text-emerald-700 block font-semibold uppercase">Wholesale Price</span>
                  <span class="font-black text-emerald-800">${UI.formatCurrency(sell)}</span>
                </div>
                ${isAdmin ? `
                  <div class="bg-teal-50 p-2 rounded-2xl admin-profit-only">
                    <span class="text-[9px] text-teal-700 block font-semibold uppercase">Margin (${marginPct}%)</span>
                    <span class="font-bold text-teal-800">+${UI.formatCurrency(profit)}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }

      container.innerHTML = html;
    } catch (err) {
      console.error('Error loading products:', err);
    }
  },

  renderSlabsUI() {
    const list = document.getElementById('prod-modal-slabs-list');
    if (!list) return;
    if (!this.currentFreeSlabs || this.currentFreeSlabs.length === 0) {
      list.innerHTML = `
        <div class="text-[11px] text-purple-700 bg-purple-50/50 p-2 rounded-xl text-center border border-purple-200 font-medium">
          පඩි (Slabs) එකතු කර නැත. <b>+ Add Slab (තව එකක්)</b> ඔබන්න.
        </div>
      `;
      return;
    }

    list.innerHTML = this.currentFreeSlabs.map((slab, idx) => `
      <div class="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-purple-200 shadow-2xs">
        <span class="text-[10px] font-bold text-purple-900">ගන්නේ (Buy):</span>
        <input type="number" min="1" value="${slab.minQty}" oninput="Products.updateSlab(${idx}, 'minQty', this.value)"
          class="w-16 bg-purple-50/50 border border-purple-200 rounded-lg px-2 py-1 text-xs font-black text-purple-900 text-center focus:bg-white" />
        <span class="text-[10px] font-bold text-purple-900">නොමිලේ (Free):</span>
        <input type="number" min="0" value="${slab.freeQty}" oninput="Products.updateSlab(${idx}, 'freeQty', this.value)"
          class="w-16 bg-purple-50/50 border border-purple-200 rounded-lg px-2 py-1 text-xs font-black text-purple-900 text-center focus:bg-white" />
        <span class="text-[10px] font-bold text-purple-700 flex-1 text-right">(${slab.minQty}/${slab.freeQty})</span>
        <button type="button" onclick="Products.removeSlabRow(${idx})" class="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg active:scale-95" title="Remove Slab">
          ✕
        </button>
      </div>
    `).join('');
  },

  addSlabRow() {
    if (!Array.isArray(this.currentFreeSlabs)) this.currentFreeSlabs = [];
    const len = this.currentFreeSlabs.length;
    let nextMin = 12;
    let nextFree = 1;
    if (len > 0) {
      const prev = this.currentFreeSlabs[len - 1];
      const pMin = Number(prev.minQty) || 12;
      const pFree = Number(prev.freeQty) || 1;
      if (pMin === 12) { nextMin = 25; nextFree = 2; }
      else if (pMin === 25) { nextMin = 50; nextFree = 5; }
      else if (pMin === 50) { nextMin = 100; nextFree = 12; }
      else if (pMin === 100) { nextMin = 300; nextFree = 50; }
      else { nextMin = pMin * 2; nextFree = pFree * 2; }
    }
    this.currentFreeSlabs.push({ minQty: nextMin, freeQty: nextFree });
    this.renderSlabsUI();
  },

  removeSlabRow(idx) {
    if (this.currentFreeSlabs && this.currentFreeSlabs[idx] !== undefined) {
      this.currentFreeSlabs.splice(idx, 1);
      this.renderSlabsUI();
    }
  },

  updateSlab(idx, field, val) {
    if (this.currentFreeSlabs && this.currentFreeSlabs[idx]) {
      this.currentFreeSlabs[idx][field] = Math.max(0, parseInt(val) || 0);
    }
  },

  openProductModal(prod = null) {
    document.getElementById('prod-modal-id').value = prod ? prod.id : '';
    document.getElementById('prod-modal-name').value = prod ? prod.name : '';
    document.getElementById('prod-modal-unit').value = prod ? (prod.unit || 'Card') : 'Card';
    document.getElementById('prod-modal-cost').value = prod ? (prod.costPrice || '') : '';
    document.getElementById('prod-modal-sell').value = prod ? (prod.sellingPrice || '') : '';
    document.getElementById('prod-modal-category').value = prod ? (prod.category || 'Cards') : 'Cards';
    
    // Packaging details
    const packetsInput = document.getElementById('prod-modal-packets-per-card');
    if (packetsInput) packetsInput.value = prod ? (prod.packetsPerCard || 20) : 20;
    
    const retailInput = document.getElementById('prod-modal-packet-price');
    if (retailInput) retailInput.value = prod ? (prod.packetRetailPrice || '') : '';

    // Free scheme & Slabs
    const freeCheck = document.getElementById('prod-modal-free-enabled');
    const isFreeEnabled = prod ? Boolean(prod.freeSchemeEnabled) : true;
    if (freeCheck) {
      freeCheck.checked = isFreeEnabled;
      this.toggleFreeSchemeUI(isFreeEnabled);
    }

    if (prod && Array.isArray(prod.freeSlabs) && prod.freeSlabs.length > 0) {
      this.currentFreeSlabs = JSON.parse(JSON.stringify(prod.freeSlabs));
    } else if (prod && prod.freeSchemeMinQty) {
      this.currentFreeSlabs = [{ minQty: prod.freeSchemeMinQty, freeQty: prod.freeSchemeFreeQty || 1 }];
    } else {
      // Default common FMCG spice slabs
      this.currentFreeSlabs = [
        { minQty: 12, freeQty: 1 },
        { minQty: 25, freeQty: 2 },
        { minQty: 50, freeQty: 5 }
      ];
    }
    this.renderSlabsUI();

    document.getElementById('prod-modal-title').textContent = prod ? 'Edit Product' : 'Add New Product';
    
    this.onUnitTypeChange();
    this.calcModalMargin();
    UI.openModal('modal-product-form');
  },

  onUnitTypeChange() {
    const unit = document.getElementById('prod-modal-unit')?.value || 'Card';
    const pkgGroup = document.getElementById('prod-modal-packaging-group');
    if (pkgGroup) {
      if (unit === 'Card') {
        pkgGroup.classList.remove('hidden');
      } else {
        pkgGroup.classList.add('hidden');
      }
    }
    this.calcModalMargin();
  },

  toggleFreeSchemeUI(enabled) {
    const box = document.getElementById('prod-modal-free-inputs');
    if (box) {
      if (enabled) box.classList.remove('hidden');
      else box.classList.add('hidden');
    }
  },

  calcModalMargin() {
    const cost = Number(document.getElementById('prod-modal-cost').value) || 0;
    const sell = Number(document.getElementById('prod-modal-sell').value) || 0;
    const profit = sell - cost;
    const marginPct = sell > 0 ? ((profit / sell) * 100).toFixed(1) : 0;

    const label = document.getElementById('prod-modal-margin-preview');
    if (label) {
      label.textContent = `Unit Profit: Rs. ${profit.toFixed(2)} (${marginPct}%)`;
      label.className = `text-xs font-bold ${profit >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'} text-center py-1.5 rounded-xl`;
    }

    const packetsCount = Math.max(1, Number(document.getElementById('prod-modal-packets-per-card')?.value) || 20);
    const unitCalcInfo = document.getElementById('prod-modal-unit-calc-info');
    if (unitCalcInfo && sell > 0) {
      const packetWholesale = (sell / packetsCount).toFixed(2);
      unitCalcInfo.textContent = `1 Loose Packet Wholesale Value = Rs. ${packetWholesale} (for smart returns)`;
    }
  },

  async editProduct(id) {
    const prod = await db.products.get(id);
    if (prod) {
      this.openProductModal(prod);
    }
  },

  async saveProduct() {
    const id = document.getElementById('prod-modal-id').value;
    const name = document.getElementById('prod-modal-name').value.trim();
    const unit = document.getElementById('prod-modal-unit').value;
    const costPrice = Number(document.getElementById('prod-modal-cost').value) || 0;
    const sellingPrice = Number(document.getElementById('prod-modal-sell').value) || 0;
    const category = document.getElementById('prod-modal-category').value.trim();

    const packetsPerCard = Math.max(1, Number(document.getElementById('prod-modal-packets-per-card')?.value) || 20);
    const packetRetailPrice = Number(document.getElementById('prod-modal-packet-price')?.value) || 0;

    const freeSchemeEnabled = Boolean(document.getElementById('prod-modal-free-enabled')?.checked);

    const cleanSlabs = (this.currentFreeSlabs || [])
      .map(s => ({ minQty: Math.max(1, parseInt(s.minQty) || 1), freeQty: Math.max(0, parseInt(s.freeQty) || 0) }))
      .filter(s => s.minQty > 0)
      .sort((a, b) => a.minQty - b.minQty);

    const freeSchemeMinQty = cleanSlabs.length > 0 ? cleanSlabs[0].minQty : 12;
    const freeSchemeFreeQty = cleanSlabs.length > 0 ? cleanSlabs[0].freeQty : 1;

    if (!name) {
      UI.showToast('Please enter a Product Name', 'warning');
      return;
    }
    if (sellingPrice <= 0) {
      UI.showToast('Please enter a valid Selling Price', 'warning');
      return;
    }

    const productDoc = {
      tenantId: getActiveTenantId() || 1,
      name,
      unit,
      costPrice,
      sellingPrice,
      category,
      packetsPerCard,
      packetRetailPrice,
      freeSchemeEnabled,
      freeSchemeMinQty,
      freeSchemeFreeQty,
      freeSlabs: cleanSlabs,
      updatedAt: new Date().toISOString(),
      isSynced: false
    };

    try {
      if (id) {
        await db.products.update(Number(id), productDoc);
        UI.showToast('Product updated successfully! 🌶️', 'success');
      } else {
        await db.products.add(productDoc);
        UI.showToast('Product added successfully! 🌶️', 'success');
      }
      UI.closeModal('modal-product-form');
      this.loadProducts();
    } catch (err) {
      UI.showToast('Error saving product (Name must be unique)', 'error');
    }
  },

  async deleteProduct(id) {
    if (confirm('Are you sure you want to delete this product?')) {
      await db.products.delete(id);
      UI.showToast('Product removed', 'info');
      this.loadProducts();
    }
  }
};
