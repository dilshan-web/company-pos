/**
 * Thermal Invoice Printing (Epson TM-T82 80mm & 58mm Bluetooth/USB Printers) & Document Print Module
 */

const Print = {
  _currentPreviewSaleId: null,

  // Robust multi-tenant Company Profile & Logo resolver
  async getCompanyProfile(saleTenantId = null) {
    let localOverride = null;
    try {
      const stored = localStorage.getItem('pos_company_profile');
      if (stored) localOverride = JSON.parse(stored);
    } catch (e) {}

    try {
      const activeTid = saleTenantId || (typeof Auth !== 'undefined' && Auth.currentUser?.tenantId) || (typeof getActiveTenantId === 'function' ? getActiveTenantId() : 1) || 1;
      
      // 1. Try tenant-isolated retrieval
      if (typeof filterByTenant === 'function') {
        const comps = filterByTenant(await db.company.toArray(), activeTid);
        if (comps && comps.length > 0) {
          const comp = comps[0];
          return {
            ...comp,
            name: comp.name || localOverride?.name || 'WHOLESALE DISTRIBUTORS',
            logoBase64: comp.logoBase64 || localOverride?.logoBase64 || ''
          };
        }
      }

      // 2. Direct array lookup
      const allComps = await db.company.toArray();
      if (allComps && allComps.length > 0) {
        const match = allComps.find(c => Number(c.tenantId) === Number(activeTid)) || allComps[0];
        if (match) {
          return {
            ...match,
            name: match.name || localOverride?.name || 'WHOLESALE DISTRIBUTORS',
            logoBase64: match.logoBase64 || localOverride?.logoBase64 || ''
          };
        }
      }

      if (localOverride && localOverride.name) {
        return localOverride;
      }
    } catch (err) {
      console.warn('Print.getCompanyProfile notice:', err);
    }

    return {
      name: localOverride?.name || 'WHOLESALE DISTRIBUTORS',
      tagline: localOverride?.tagline || 'Wholesale Distribution',
      address: localOverride?.address || '',
      phone: localOverride?.phone || '',
      regNo: localOverride?.regNo || '',
      receiptFooter: localOverride?.receiptFooter || 'Thank you for your business! / ස්තූතියි!',
      printerWidth: localOverride?.printerWidth || '80mm',
      logoBase64: localOverride?.logoBase64 || ''
    };
  },

  /**
   * Pure JavaScript Code 128 (Subset B) Vector SVG Barcode Generator
   * Generates razor-sharp, scanner-readable vector barcodes for Epson TM-T82 & thermal receipt printers
   */
  generateBarcodeSVG(text, options = {}) {
    if (!text) return '';
    const str = String(text).trim();
    if (!str) return '';

    const barHeight = options.height || 38;
    const moduleWidth = options.moduleWidth || 1.35;
    const quietZone = options.quietZone !== undefined ? options.quietZone : 8;

    // Code 128 Patterns for ASCII characters 32 to 126
    const patterns = [
      "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
      "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
      "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
      "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
      "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
      "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
      "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
      "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
      "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
      "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
      "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 = STOP)
    ];

    const START_B = 104;
    const STOP = 106;

    const codes = [START_B];
    let checksum = START_B;

    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      const code = (charCode >= 32 && charCode <= 126) ? charCode - 32 : 0;
      codes.push(code);
      checksum += code * (i + 1);
    }

    codes.push(checksum % 103);
    codes.push(STOP);

    let patternStr = "";
    for (const c of codes) {
      patternStr += (patterns[c] || "212222");
    }

    let totalModules = quietZone * 2;
    for (let j = 0; j < patternStr.length; j++) {
      totalModules += parseInt(patternStr[j], 10);
    }

    const svgWidth = totalModules * moduleWidth;
    let currentX = quietZone * moduleWidth;
    let rects = "";

    let isBar = true;
    for (let k = 0; k < patternStr.length; k++) {
      const width = parseInt(patternStr[k], 10) * moduleWidth;
      if (isBar) {
        rects += `<rect x="${currentX.toFixed(2)}" y="0" width="${width.toFixed(2)}" height="${barHeight}" fill="#000000" />`;
      }
      currentX += width;
      isBar = !isBar;
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth.toFixed(2)} ${barHeight}" width="${svgWidth.toFixed(0)}px" height="${barHeight}px" style="display:block; margin:0 auto; max-width:100%; height:auto;">
        <rect width="100%" height="100%" fill="#ffffff" />
        ${rects}
      </svg>
    `;
  },

  async generateReceiptHTML(saleId, options = {}) {
    const sale = await db.sales.get(saleId);
    if (!sale) return '';

    const shop = sale.shopId ? await db.shops.get(sale.shopId) : null;
    const route = sale.routeId ? await db.routes.get(sale.routeId) : null;
    const items = await db.saleItems.where('saleId').equals(saleId).toArray();
    const company = await this.getCompanyProfile(sale.tenantId);

    const printerWidth = company?.printerWidth || '80mm';
    const is80mm = printerWidth === '80mm' || printerWidth !== '58mm';

    // Clean Sales Rep Name (Remove company names, LTD, PVT, brackets, dashes)
    let cleanRepName = (sale.repName || 'Sales Rep').trim();
    // 1. Remove anything in parentheses (e.g. "(RUBIK MARKETING (PVT)LTD)")
    cleanRepName = cleanRepName.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    // 2. Remove company suffix terms like "(PVT) LTD", "PVT LTD", "PVT. LTD.", "LIMITED", "LTD", "MARKETING", "DISTRIBUTORS" etc.
    cleanRepName = cleanRepName.replace(/\b(pvt|pvt\.|ltd|ltd\.|limited|marketing|markerting|distributors|distribution|mills|traders|enterprise|co|company)\b/gi, ' ').trim();
    // 3. Remove dashes, slashes or colons followed by anything
    cleanRepName = cleanRepName.split(/[-–—/|:]/)[0].trim();
    // 4. Remove extra spaces
    cleanRepName = cleanRepName.replace(/\s+/g, ' ').trim();
    if (!cleanRepName) cleanRepName = 'Sales Rep';

    // 0. Detect Original vs Duplicate / Copy Status
    const printCount = Number(sale.printCount) || 0;
    const isDuplicate = options.isDuplicate !== undefined ? Boolean(options.isDuplicate) : (printCount > 0);
    const copyNumber = isDuplicate ? Math.max(2, printCount + 1) : 1;

    // 1. Build Item Rows (Crisp 2-line layout for high clarity)
    let itemsRows = '';
    let itemsGrossSubtotal = 0;
    let totalItemsCount = 0;
    let totalCardsCount = 0;
    let totalPacketsCount = 0;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const freeQty = Number(item.freeQty) || 0;
      const qty = Number(item.qty) || 0;
      const rate = Number(item.sellingPrice) || 0;
      const lineSubtotal = Number(item.subtotal) || (qty * rate);
      itemsGrossSubtotal += lineSubtotal;
      totalItemsCount += (qty + freeQty);

      if (item.unit === 'Card') {
        totalCardsCount += (qty + freeQty);
      } else {
        totalPacketsCount += (qty + freeQty);
      }

      itemsRows += `
        <tr class="item-row">
          <td colspan="2" style="padding-top: 2px; padding-bottom: 1px;">
            <div style="font-weight: 900; font-size: ${is80mm ? '12.5px' : '11px'}; color: #000; line-height: 1.25;">
              ${idx + 1}. ${item.productName}
              ${freeQty > 0 ? `<span style="display:inline-block; font-size: 9px; font-weight: 900; background: #000; color: #fff; padding: 0.5px 3.5px; border-radius: 2px; margin-left: 3px;">+${freeQty} FREE</span>` : ''}
              ${item.standardPrice && item.standardPrice > item.sellingPrice ? `<span style="display:inline-block; font-size: 8px; font-weight: 800; border: 1px dashed #000; padding: 0.5px 3px; border-radius: 2px; margin-left: 3px;">NET RATE (Std: Rs. ${Number(item.standardPrice).toFixed(0)})</span>` : ''}
            </div>
          </td>
        </tr>
        <tr style="border-bottom: 1px dotted #888;">
          <td style="padding-left: 6px; padding-bottom: 2px; font-size: ${is80mm ? '11.5px' : '10px'}; color: #000; text-align: left;">
            ${qty} ${item.unit || 'Card'} ${freeQty > 0 ? `(+${freeQty} Free)` : ''} &times; Rs. ${rate.toFixed(2)}
            ${item.standardPrice && item.standardPrice > item.sellingPrice ? `<span style="font-size: 8.5px; color: #333;"> (-Rs. ${(item.standardPrice - item.sellingPrice).toFixed(0)}/u)</span>` : ''}
          </td>
          <td style="padding-bottom: 2px; font-weight: 900; font-size: ${is80mm ? '12px' : '10.5px'}; color: #000; text-align: right; white-space: nowrap;">
            ${lineSubtotal.toFixed(2)}
          </td>
        </tr>
      `;
    }

    // 2. Fetch Sales Returns / Replacements for this sale
    let returnRows = '';
    let totalReturnDeduction = 0;
    if (db.salesReturns) {
      const returns = await db.salesReturns.where('saleId').equals(saleId).toArray();
      for (const ret of returns) {
        const isDeduct = ret.action === 'deduct';
        const refundAmt = Number(ret.refundAmount) || 0;
        if (isDeduct) totalReturnDeduction += refundAmt;

        returnRows += `
          <tr>
            <td colspan="2" style="padding-top: 1.5px; font-weight: bold; font-size: ${is80mm ? '11px' : '9.5px'}; color: #000;">
              ${isDeduct ? '🔄 [RETURN]' : '🔁 [EXCHANGE]'} ${ret.productName} (${ret.qty} ${ret.returnType === 'Unit' ? 'Loose Pkts' : 'Cards'})
            </td>
          </tr>
          <tr style="border-bottom: 1px dotted #ccc;">
            <td style="padding-left: 6px; padding-bottom: 1.5px; font-size: 9px; color: #222;">
              ${ret.reason || 'Sales Return'} • ${isDeduct ? 'Deducted from bill' : '1-to-1 Item Replaced'}
            </td>
            <td style="text-align: right; font-weight: bold; font-size: ${is80mm ? '11px' : '9.5px'}; color: #000; padding-bottom: 1.5px;">
              ${isDeduct ? '-Rs. ' + refundAmt.toFixed(2) : '✓ Replaced'}
            </td>
          </tr>
        `;
      }
    }

    // 3. Customer Current Balance
    const currentShopCredit = shop ? (Number(shop.currentCredit) || 0) : 0;
    const invCreditAmount = Number(sale.creditAmount) || 0;
    const invPaidAmount = Number(sale.paidAmount) || 0;
    const netBillTotal = Number(sale.totalAmount) || 0;

    // 4. Barcode Generation
    const barcodeSVG = this.generateBarcodeSVG(sale.invoiceNo, {
      height: is80mm ? 26 : 22,
      moduleWidth: is80mm ? 1.25 : 1.05
    });

    // 5. Build Logo HTML
    let logoHtml = '';
    if (company?.logoBase64 && company.logoBase64.trim()) {
      logoHtml = `
        <div style="text-align: center; margin: 0 auto 2px auto;">
          <img src="${company.logoBase64}" class="receipt-logo" alt="Logo" style="max-height: ${is80mm ? '42px' : '34px'}; max-width: ${is80mm ? '155px' : '110px'}; margin: 0 auto; display: block; object-fit: contain; filter: grayscale(100%) contrast(160%);" />
        </div>
      `;
    }

    // 6. Duplicate / Original Banner Style
    let copyBannerHtml = '';
    if (isDuplicate) {
      copyBannerHtml = `
        <div style="text-align: center; margin: 1.5px 0;">
          <div style="display: inline-block; border: 1.5px solid #000; padding: 1px 6px; font-size: ${is80mm ? '11px' : '9.5px'}; font-weight: 900; letter-spacing: 0.3px; text-transform: uppercase; background: #fff;">
            ⚠️ DUPLICATE COPY / දෙවන පිටපත (Copy #${copyNumber})
          </div>
        </div>
      `;
    } else {
      copyBannerHtml = `
        <div style="text-align: center; margin: 1.5px 0;">
          <div style="display: inline-block; border: 1px solid #000; padding: 1px 5px; font-size: ${is80mm ? '10.5px' : '9px'}; font-weight: 800; letter-spacing: 0.3px; background: #fff;">
            [ ORIGINAL INVOICE / මුල් පිටපත ]
          </div>
        </div>
      `;
    }

    return `
      <div class="thermal-receipt ${is80mm ? 'width-80mm' : 'width-58mm'}">
        
        <!-- HEADER / LOGO SECTION -->
        ${logoHtml}
        <div class="receipt-header-title" style="font-size: ${is80mm ? '15px' : '13px'}; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.15;">
          ${company?.name || 'SPICE WHOLESALE DISTRIBUTORS'}
        </div>
        ${company?.tagline ? `<div class="receipt-header-sub" style="text-align: center; font-size: ${is80mm ? '9.5px' : '8px'}; font-weight: bold; margin-top: 1px;">${company.tagline}</div>` : ''}
        ${company?.address ? `<div class="receipt-header-sub" style="text-align: center; font-size: ${is80mm ? '9.5px' : '8px'};">${company.address}</div>` : ''}
        ${company?.phone ? `<div class="receipt-header-sub" style="text-align: center; font-size: ${is80mm ? '9.5px' : '8px'}; font-weight: bold;">📞 Tel: ${company.phone}</div>` : ''}
        ${company?.regNo ? `<div class="receipt-header-sub" style="text-align: center; font-size: 8.5px;">Business Reg: ${company.regNo}</div>` : ''}
        
        <!-- DIVIDER -->
        <div class="receipt-divider-double"></div>
        
        <!-- INVOICE BADGE -->
        <div style="text-align: center; margin: 1.5px 0;">
          <span class="receipt-badge" style="display: inline-block; font-size: ${is80mm ? '11px' : '9.5px'}; font-weight: 900; letter-spacing: 0.4px; padding: 1px 6px; border: 1.5px solid #000; border-radius: 3px;">
            ${sale.status === 'Pending' ? 'ORDER NOTE / ඇණවුම' : 'TAX INVOICE / බිල්පත'}
          </span>
        </div>

        <!-- ORIGINAL VS DUPLICATE COPY BANNER -->
        ${copyBannerHtml}

        <!-- META INFORMATION TABLE (FULL-WIDTH 70mm FIT) -->
        <table style="width: 100%; border-collapse: collapse; font-size: ${is80mm ? '11.5px' : '10px'}; line-height: 1.3; margin: 1.5px 0;">
          <tr>
            <td style="color: #000; font-weight: 900; width: 26%; white-space: nowrap;">Inv No:</td>
            <td style="text-align: right; font-weight: 900; font-size: ${is80mm ? '12.5px' : '11px'};"><b>${sale.invoiceNo}</b></td>
          </tr>
          <tr>
            <td style="color: #000; font-weight: 900; white-space: nowrap;">Date:</td>
            <td style="text-align: right; font-weight: bold;">${UI.formatDateTime(sale.date)}</td>
          </tr>
          <tr>
            <td style="color: #000; font-weight: 900; white-space: nowrap;">Doc Copy:</td>
            <td style="text-align: right; font-weight: 900; color: ${isDuplicate ? '#000' : '#047857'};">
              ${isDuplicate ? `DUPLICATE (Reprint #${copyNumber})` : 'ORIGINAL (First Print)'}
            </td>
          </tr>
          <tr>
            <td style="color: #000; font-weight: 900; white-space: nowrap;">Route:</td>
            <td style="text-align: right; font-weight: bold;">${route ? route.name : 'Direct Distribution'}</td>
          </tr>
          <tr>
            <td style="color: #000; font-weight: 900; white-space: nowrap;">Shop:</td>
            <td style="text-align: right; font-weight: 900; font-size: ${is80mm ? '12px' : '10.5px'};">${shop ? shop.name : 'Walk-in Customer'}</td>
          </tr>
          ${shop?.ownerName || shop?.phone ? `
            <tr>
              <td style="color: #000; font-weight: 900; white-space: nowrap;">Contact:</td>
              <td style="text-align: right; font-weight: bold;">${shop?.ownerName ? shop.ownerName : ''} ${shop?.phone ? `(${shop.phone})` : ''}</td>
            </tr>
          ` : ''}
          <tr>
            <td style="color: #000; font-weight: 900; white-space: nowrap;">Billed By:</td>
            <td style="text-align: right; font-weight: 900;">${cleanRepName}</td>
          </tr>
        </table>
        
        <!-- DIVIDER -->
        <div class="receipt-divider"></div>

        <!-- LINE ITEMS TABLE -->
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1.5px solid #000;">
              <th style="text-align: left; font-size: ${is80mm ? '10.5px' : '9px'}; padding: 1.5px 0; font-weight: 900;">ITEM / DESCRIPTION</th>
              <th style="text-align: right; font-size: ${is80mm ? '10.5px' : '9px'}; padding: 1.5px 0; font-weight: 900;">AMOUNT (LKR)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- SUMMARY COUNT -->
        <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #000; font-weight: bold; padding: 1.5px 0 2.5px 0; border-bottom: 1px dotted #888;">
          <span>Items: <b>${items.length} lines</b> (${totalItemsCount} units total)</span>
          <span>${totalCardsCount > 0 ? `${totalCardsCount} Cards` : ''} ${totalPacketsCount > 0 ? `${totalPacketsCount} Pkts` : ''}</span>
        </div>

        <!-- SALES RETURNS & EXCHANGES (IF ANY) -->
        ${returnRows ? `
          <div style="margin-top: 2px; padding-top: 1px;">
            <div style="text-align: center; font-weight: bold; font-size: 9.5px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 1px 0; margin: 2px 0;">
              🔄 RETURNS &amp; EXCHANGES
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                ${returnRows}
              </tbody>
            </table>
          </div>
        ` : ''}

        <!-- DIVIDER -->
        <div class="receipt-divider-double"></div>

        <!-- FINANCIAL TOTALS BREAKDOWN -->
        <table style="width: 100%; font-size: ${is80mm ? '12px' : '10.5px'}; line-height: 1.3;">
          ${totalReturnDeduction > 0 ? `
            <tr>
              <td style="text-align: left; color: #000; font-weight: bold;">Gross Subtotal:</td>
              <td style="text-align: right; font-weight: bold;">Rs. ${itemsGrossSubtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="text-align: left; color: #000; font-weight: bold;">Returns Deducted:</td>
              <td style="text-align: right; font-weight: bold;">-Rs. ${totalReturnDeduction.toFixed(2)}</td>
            </tr>
          ` : ''}
          ${(Number(sale.specialPriceDiscount) > 0 || Number(sale.totalSubsidy) > 0) ? `
            <tr>
              <td style="text-align: left; color: #000; font-weight: bold; font-size: 9.5px;">🎁 Total Promo Savings Given:</td>
              <td style="text-align: right; font-weight: 900; font-size: 10px;">Rs. ${(Number(sale.specialPriceDiscount || 0) + Number(sale.totalFreeCost || 0)).toFixed(2)}</td>
            </tr>
          ` : ''}
          <tr style="border-top: 1.5px solid #000; border-bottom: 1.5px solid #000;">
            <td style="text-align: left; font-weight: 900; font-size: ${is80mm ? '13.5px' : '12px'}; padding: 2.5px 0; white-space: nowrap;">NET TOTAL BILL:</td>
            <td style="text-align: right; font-weight: 900; font-size: ${is80mm ? '14.5px' : '12.5px'}; padding: 2.5px 0;">Rs. ${netBillTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="text-align: left; padding-top: 2px; font-weight: 900; white-space: nowrap;">Payment Mode:</td>
            <td style="text-align: right; font-weight: 900; padding-top: 2px;">[ ${sale.paymentType || 'Cash'} ]</td>
          </tr>
          <tr>
            <td style="text-align: left; font-weight: 900; white-space: nowrap;">Cash Paid Now:</td>
            <td style="text-align: right; font-weight: 900;">Rs. ${invPaidAmount.toFixed(2)}</td>
          </tr>
          ${invCreditAmount > 0 ? `
            <tr>
              <td style="text-align: left; font-weight: 900; white-space: nowrap;">Credit Added:</td>
              <td style="text-align: right; font-weight: 900;">Rs. ${invCreditAmount.toFixed(2)}</td>
            </tr>
          ` : ''}
        </table>

        <!-- SHOP OUTSTANDING LEDGER BOX -->
        <div class="credit-box" style="border: 1.5px solid #000; border-radius: 3px; padding: 2px 4px; margin: 2.5px 0; background: #fff;">
          <table style="width: 100%; font-size: ${is80mm ? '11px' : '9.5px'};">
            <tr>
              <td style="text-align: left; font-weight: 900; text-transform: uppercase;">Total Outstanding Shop Credit:</td>
              <td style="text-align: right; font-weight: 900; font-size: ${is80mm ? '12px' : '10.5px'};">Rs. ${currentShopCredit.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- DUAL SIGNATURE SECTION (SALES REP & CUSTOMER / SHOP OWNER) -->
        <div style="margin-top: 5px; margin-bottom: 2px; padding-top: 2px; border-top: 1px dashed #000;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <!-- LEFT: Sales Rep Signature -->
              <td style="width: 50%; text-align: center; vertical-align: top; padding-right: 2.5px; border-right: 1px solid #888;">
                <div style="height: 10px;"></div>
                <div style="border-top: 1.5px solid #000; margin: 0 3px;"></div>
                <div style="font-weight: 900; font-size: ${is80mm ? '10.5px' : '9px'}; text-transform: uppercase; margin-top: 1.5px;">SALES REP SIG.</div>
                <div style="font-size: 8.5px; color: #222;">(නියෝජිත අත්සන)</div>
                <div style="font-size: 9.5px; font-weight: bold; color: #000;">${cleanRepName}</div>
              </td>
              <!-- RIGHT: Customer Signature -->
              <td style="width: 50%; text-align: center; vertical-align: top; padding-left: 2.5px;">
                <div style="height: 10px;"></div>
                <div style="border-top: 1.5px solid #000; margin: 0 3px;"></div>
                <div style="font-weight: 900; font-size: ${is80mm ? '10.5px' : '9px'}; text-transform: uppercase; margin-top: 1.5px;">CUSTOMER SIG.</div>
                <div style="font-size: 8.5px; color: #222;">(කඩහිමි / Customer)</div>
                <div style="font-size: 8.5px; color: #000;">Goods Received ✓</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- BARCODE SECTION -->
        <div class="barcode-container" style="text-align: center; margin: 3px auto 1px auto; padding-top: 1px;">
          ${barcodeSVG}
          <div class="barcode-text" style="font-size: 9.5px; font-weight: 800; letter-spacing: 1.5px; margin-top: 1px; font-family: monospace;">
            * ${sale.invoiceNo} *
          </div>
        </div>

        <!-- DIVIDER -->
        <div class="receipt-divider"></div>

        <!-- FOOTER MESSAGE -->
        <div class="receipt-footer" style="text-align: center; font-size: 9px; margin-top: 1.5px; line-height: 1.25;">
          <div style="font-weight: bold;">${company?.receiptFooter || 'Thank you for your business! / ස්තූතියි!'}</div>
          <div style="font-size: 7.5px; color: #444; margin-top: 1px;">
            MOB POS Enterprise • System Powered
          </div>
        </div>

        <!-- TEAR-OFF BOTTOM SPACING FOR THERMAL PRINTERS -->
        <div class="receipt-tear-space" style="height: 3mm;"></div>
      </div>
    `;
  },

  /**
   * Test receipt generation for Epson TM-T82 hardware test
   */
  async generateTestReceiptHTML() {
    const company = await this.getCompanyProfile();
    const printerWidth = company?.printerWidth || '80mm';
    const is80mm = printerWidth === '80mm' || printerWidth !== '58mm';
    const demoInv = 'INV-TEST-' + String(Date.now()).slice(-4);
    const barcodeSVG = this.generateBarcodeSVG(demoInv, {
      height: is80mm ? 26 : 22,
      moduleWidth: is80mm ? 1.25 : 1.05
    });

    let logoHtml = '';
    if (company?.logoBase64 && company.logoBase64.trim()) {
      logoHtml = `
        <div style="text-align: center; margin: 0 auto 2px auto;">
          <img src="${company.logoBase64}" class="receipt-logo" alt="Logo" style="max-height: ${is80mm ? '42px' : '34px'}; max-width: ${is80mm ? '155px' : '110px'}; margin: 0 auto; display: block; object-fit: contain; filter: grayscale(100%) contrast(160%);" />
        </div>
      `;
    }

    return `
      <div class="thermal-receipt ${is80mm ? 'width-80mm' : 'width-58mm'}">
        ${logoHtml}
        <div class="receipt-header-title" style="font-size: ${is80mm ? '15px' : '13px'}; font-weight: 900; text-align: center; text-transform: uppercase;">
          ${company?.name || 'SPICE WHOLESALE DISTRIBUTORS'}
        </div>
        ${company?.tagline ? `<div class="receipt-header-sub" style="text-align: center; font-size: ${is80mm ? '9.5px' : '8px'}; font-weight: bold;">${company.tagline}</div>` : ''}
        ${company?.address ? `<div class="receipt-header-sub" style="text-align: center; font-size: ${is80mm ? '9.5px' : '8px'};">${company.address}</div>` : ''}
        ${company?.phone ? `<div class="receipt-header-sub" style="text-align: center; font-size: ${is80mm ? '9.5px' : '8px'}; font-weight: bold;">📞 Tel: ${company.phone}</div>` : ''}
        
        <div class="receipt-divider-double"></div>
        
        <div style="text-align: center; margin: 1.5px 0;">
          <span class="receipt-badge" style="display: inline-block; font-size: ${is80mm ? '11px' : '9.5px'}; font-weight: 900; padding: 1px 6px; border: 1.5px solid #000; border-radius: 3px;">
            🖨️ PRINTER TEST RECEIPT (ටෙස්ට් බිල)
          </span>
        </div>

        <table style="width: 100%; font-size: ${is80mm ? '11px' : '9.5px'}; line-height: 1.3; margin: 1.5px 0;">
          <tr>
            <td style="width: 30%; font-weight: 900;">Printer Model:</td>
            <td style="text-align: right; font-weight: bold;">Epson TM-T82 (80mm USB)</td>
          </tr>
          <tr>
            <td style="font-weight: 900;">Test Inv No:</td>
            <td style="text-align: right; font-weight: 900;">${demoInv}</td>
          </tr>
          <tr>
            <td style="font-weight: 900;">Copy Mode:</td>
            <td style="text-align: right; font-weight: bold; color: #047857;">ORIGINAL &amp; DUPLICATE READY</td>
          </tr>
          <tr>
            <td style="font-weight: 900;">Date &amp; Time:</td>
            <td style="text-align: right; font-weight: bold;">${new Date().toLocaleString()}</td>
          </tr>
        </table>

        <div class="receipt-divider"></div>

        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1.5px solid #000;">
              <th style="text-align: left; font-size: ${is80mm ? '10.5px' : '9px'}; padding: 1.5px 0;">SAMPLE ITEM</th>
              <th style="text-align: right; font-size: ${is80mm ? '10.5px' : '9px'}; padding: 1.5px 0;">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            <tr class="item-row">
              <td colspan="2" style="padding-top: 1.5px;">
                <div style="font-weight: 900; font-size: ${is80mm ? '12.5px' : '11px'};">1. Chilli Powder Card - 20s <span style="font-size: 9px; background: #000; color: #fff; padding: 0.5px 3px; border-radius: 2px;">+1 FREE</span></div>
              </td>
            </tr>
            <tr style="border-bottom: 1px dotted #888;">
              <td style="padding-left: 6px; font-size: ${is80mm ? '11.5px' : '10px'};">12 Cards (+1 Free) &times; Rs. 500.00</td>
              <td style="text-align: right; font-weight: 900; font-size: ${is80mm ? '12px' : '10.5px'};">6,000.00</td>
            </tr>
          </tbody>
        </table>

        <div class="receipt-divider-double"></div>

        <table style="width: 100%; font-size: ${is80mm ? '12px' : '10.5px'};">
          <tr style="border-top: 1.5px solid #000; border-bottom: 1.5px solid #000;">
            <td style="font-weight: 900; font-size: ${is80mm ? '13.5px' : '12px'}; padding: 2.5px 0;">NET TOTAL BILL:</td>
            <td style="text-align: right; font-weight: 900; font-size: ${is80mm ? '14.5px' : '12.5px'}; padding: 2.5px 0;">Rs. 6,000.00</td>
          </tr>
        </table>

        <div style="margin-top: 5px; margin-bottom: 2px; padding-top: 2px; border-top: 1px dashed #000;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; text-align: center; vertical-align: top; padding-right: 2.5px; border-right: 1px solid #888;">
                <div style="height: 10px;"></div>
                <div style="border-top: 1.5px solid #000; margin: 0 3px;"></div>
                <div style="font-weight: 900; font-size: ${is80mm ? '10.5px' : '9px'}; text-transform: uppercase; margin-top: 1.5px;">SALES REP SIG.</div>
                <div style="font-size: 8.5px; color: #222;">(නියෝජිත අත්සන)</div>
              </td>
              <td style="width: 50%; text-align: center; vertical-align: top; padding-left: 2.5px;">
                <div style="height: 10px;"></div>
                <div style="border-top: 1.5px solid #000; margin: 0 3px;"></div>
                <div style="font-weight: 900; font-size: ${is80mm ? '10.5px' : '9px'}; text-transform: uppercase; margin-top: 1.5px;">CUSTOMER SIG.</div>
                <div style="font-size: 8.5px; color: #222;">(කඩහිමි අත්සන)</div>
              </td>
            </tr>
          </table>
        </div>

        <div class="barcode-container" style="text-align: center; margin: 3px auto 1px auto;">
          ${barcodeSVG}
          <div class="barcode-text" style="font-size: 9.5px; font-weight: 800; letter-spacing: 1.5px; margin-top: 1px; font-family: monospace;">
            * ${demoInv} *
          </div>
        </div>

        <div class="receipt-divider"></div>

        <div class="receipt-footer" style="text-align: center; font-size: 9px; margin-top: 1.5px;">
          <div style="font-weight: bold;">Epson TM-T82 80mm Alignment OK ✓</div>
        </div>

        <div class="receipt-tear-space" style="height: 3mm;"></div>
      </div>
    `;
  },

  async printInvoice(saleId, options = {}) {
    const sale = await db.sales.get(saleId);
    if (!sale) return;

    const currentPrintCount = Number(sale.printCount) || 0;
    const isDuplicate = options.isDuplicate !== undefined ? Boolean(options.isDuplicate) : (currentPrintCount > 0);

    const html = await this.generateReceiptHTML(saleId, { isDuplicate });
    if (!html) return;

    let receiptContainer = document.getElementById('thermal-receipt-container');
    if (!receiptContainer) {
      receiptContainer = document.createElement('div');
      receiptContainer.id = 'thermal-receipt-container';
      document.body.appendChild(receiptContainer);
    }

    receiptContainer.innerHTML = html;

    // Update print count in database
    try {
      await db.sales.update(saleId, {
        printCount: currentPrintCount + 1,
        lastPrintedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Could not update printCount:', e);
    }

    setTimeout(() => {
      if (typeof SoundFX !== 'undefined') SoundFX.play('print');
      window.print();
    }, 150);
  },

  async printExistingInvoice(saleId) {
    // When re-printing an existing invoice, it automatically prints as DUPLICATE if already printed once
    await this.printInvoice(saleId);
  },

  async previewInvoice(saleId) {
    this._currentPreviewSaleId = saleId;
    const sale = await db.sales.get(saleId);
    const isDuplicate = sale ? (Number(sale.printCount) > 0) : false;
    const html = await this.generateReceiptHTML(saleId, { isDuplicate });
    const previewContainer = document.getElementById('preview-receipt-content');
    if (previewContainer) {
      previewContainer.innerHTML = html;
      UI.openModal('modal-preview-receipt');
    }
  },

  async printCurrentPreview() {
    if (this._currentPreviewSaleId) {
      UI.closeModal('modal-preview-receipt');
      await this.printInvoice(this._currentPreviewSaleId);
    }
  },


  /**
   * Debt Collection & Recovery Payment Receipt (ණය ගෙවීම් රිසිට්පත)
   */
  async generateCollectionReceiptHTML(paymentId) {
    const payment = await db.creditPayments.get(paymentId);
    if (!payment) return '';

    const shop = payment.shopId ? await db.shops.get(payment.shopId) : null;
    const route = payment.routeId ? await db.routes.get(payment.routeId) : null;
    const company = await this.getCompanyProfile(payment.tenantId);

    const printerWidth = company?.printerWidth || '80mm';
    const is80mm = printerWidth === '80mm' || printerWidth !== '58mm';

    let cleanRepName = (payment.collectedBy || (Auth.currentUser && (Auth.currentUser.fullName || Auth.currentUser.username)) || 'Sales Rep').trim();
    cleanRepName = cleanRepName.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    cleanRepName = cleanRepName.replace(/\b(pvt|pvt\.|ltd|ltd\.|limited|marketing|markerting|distributors|distribution|mills|traders|enterprise|co|company)\b/gi, ' ').trim();
    cleanRepName = cleanRepName.split(/[-–—/|:]/)[0].trim();
    cleanRepName = cleanRepName.replace(/\s+/g, ' ').trim();
    if (!cleanRepName) cleanRepName = 'Sales Rep';

    const receiptNo = payment.receiptNo || `REC-COL-${String(payment.id).padStart(5, '0')}`;
    const barcodeSVG = this.generateBarcodeSVG(receiptNo, {
      height: is80mm ? 26 : 22,
      moduleWidth: is80mm ? 1.25 : 1.05
    });

    let logoHtml = '';
    if (company?.logoBase64 && company.logoBase64.trim()) {
      logoHtml = `
        <div style="text-align: center; margin: 0 auto 2px auto;">
          <img src="${company.logoBase64}" class="receipt-logo" alt="Logo" style="max-height: ${is80mm ? '42px' : '34px'}; max-width: ${is80mm ? '155px' : '110px'}; margin: 0 auto; display: block; object-fit: contain; filter: grayscale(100%) contrast(160%);" />
        </div>
      `;
    }

    return `
      <div class="thermal-receipt ${is80mm ? 'width-80mm' : 'width-58mm'}">
        <!-- HEADER / LOGO SECTION -->
        ${logoHtml}
        <div class="receipt-header-title" style="font-size: ${is80mm ? '15px' : '13px'}; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.15;">
          ${company?.name || 'SPICE WHOLESALE DISTRIBUTORS'}
        </div>
        ${company?.tagline ? `<div class="receipt-header-sub" style="text-align: center; font-size: ${is80mm ? '9.5px' : '8px'}; font-weight: bold; margin-top: 1px;">${company.tagline}</div>` : ''}
        ${company?.address ? `<div class="receipt-header-sub" style="text-align: center; font-size: ${is80mm ? '9.5px' : '8px'};">${company.address}</div>` : ''}
        ${company?.phone ? `<div class="receipt-header-sub" style="text-align: center; font-size: ${is80mm ? '9.5px' : '8px'}; font-weight: bold;">📞 Tel: ${company.phone}</div>` : ''}
        ${company?.regNo ? `<div class="receipt-header-sub" style="text-align: center; font-size: 8.5px;">Business Reg: ${company.regNo}</div>` : ''}
        
        <!-- DIVIDER -->
        <div class="receipt-divider-double"></div>
        
        <!-- PAYMENT RECEIPT BADGE -->
        <div style="text-align: center; margin: 1.5px 0;">
          <span class="receipt-badge" style="display: inline-block; font-size: ${is80mm ? '11px' : '9.5px'}; font-weight: 900; letter-spacing: 0.4px; padding: 1px 6px; border: 1.5px solid #000; border-radius: 3px;">
            💳 PAYMENT RECEIPT / ණය ගෙවීම් රිසිට්පත
          </span>
        </div>

        <!-- META INFORMATION TABLE -->
        <table style="width: 100%; border-collapse: collapse; font-size: ${is80mm ? '11.5px' : '10px'}; line-height: 1.3; margin: 1.5px 0;">
          <tr>
            <td style="color: #000; font-weight: 900; width: 28%; white-space: nowrap;">Receipt No:</td>
            <td style="text-align: right; font-weight: 900; font-size: ${is80mm ? '12.5px' : '11px'};"><b>${receiptNo}</b></td>
          </tr>
          <tr>
            <td style="color: #000; font-weight: 900; white-space: nowrap;">Date &amp; Time:</td>
            <td style="text-align: right; font-weight: bold;">${UI.formatDateTime(payment.date)}</td>
          </tr>
          <tr>
            <td style="color: #000; font-weight: 900; white-space: nowrap;">Route:</td>
            <td style="text-align: right; font-weight: bold;">${route ? route.name : 'Field Collection'}</td>
          </tr>
          <tr>
            <td style="color: #000; font-weight: 900; white-space: nowrap;">Shop / Customer:</td>
            <td style="text-align: right; font-weight: 900; font-size: ${is80mm ? '12px' : '10.5px'};">${shop ? shop.name : 'Unknown Shop'}</td>
          </tr>
          ${shop?.ownerName || shop?.phone ? `
            <tr>
              <td style="color: #000; font-weight: 900; white-space: nowrap;">Contact:</td>
              <td style="text-align: right; font-weight: bold;">${shop?.ownerName ? shop.ownerName : ''} ${shop?.phone ? `(${shop.phone})` : ''}</td>
            </tr>
          ` : ''}
          <tr>
            <td style="color: #000; font-weight: 900; white-space: nowrap;">Collected By:</td>
            <td style="text-align: right; font-weight: 900;">${cleanRepName}</td>
          </tr>
          ${payment.note ? `
            <tr>
              <td style="color: #000; font-weight: 900; white-space: nowrap;">Note / Ref:</td>
              <td style="text-align: right; font-weight: bold;">${payment.note}</td>
            </tr>
          ` : ''}
        </table>

        <!-- DIVIDER -->
        <div class="receipt-divider"></div>

        <!-- PAYMENT DETAILS SUMMARY -->
        <table style="width: 100%; font-size: ${is80mm ? '12px' : '10.5px'}; line-height: 1.35; margin: 2px 0;">
          <tr>
            <td style="text-align: left; color: #000; font-weight: bold;">Previous Balance:</td>
            <td style="text-align: right; font-weight: bold;">Rs. ${(Number(payment.previousCredit) || 0).toFixed(2)}</td>
          </tr>
          <tr style="border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; background: #fafafa;">
            <td style="text-align: left; font-weight: 900; font-size: ${is80mm ? '13.5px' : '12px'}; padding: 3px 0; white-space: nowrap;">COLLECTED (PAID):</td>
            <td style="text-align: right; font-weight: 900; font-size: ${is80mm ? '14.5px' : '12.5px'}; padding: 3px 0; color: #000;">Rs. ${(Number(payment.amountPaid) || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="text-align: left; padding-top: 2px; font-weight: 900; white-space: nowrap;">Payment Mode:</td>
            <td style="text-align: right; font-weight: 900; padding-top: 2px;">[ Cash ]</td>
          </tr>
        </table>

        <!-- REMAINING BALANCE BOX -->
        <div class="credit-box" style="border: 1.5px solid #000; border-radius: 3px; padding: 3px 4px; margin: 3px 0; background: #fff;">
          <table style="width: 100%; font-size: ${is80mm ? '11.5px' : '10px'};">
            <tr>
              <td style="text-align: left; font-weight: 900; text-transform: uppercase;">Remaining Shop Credit:</td>
              <td style="text-align: right; font-weight: 900; font-size: ${is80mm ? '13px' : '11px'};">Rs. ${(Number(payment.newCredit) || 0).toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- DUAL SIGNATURE SECTION -->
        <div style="margin-top: 5px; margin-bottom: 2px; padding-top: 2px; border-top: 1px dashed #000;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <!-- LEFT: Collected By -->
              <td style="width: 50%; text-align: center; vertical-align: top; padding-right: 2.5px; border-right: 1px solid #888;">
                <div style="height: 10px;"></div>
                <div style="border-top: 1.5px solid #000; margin: 0 3px;"></div>
                <div style="font-weight: 900; font-size: ${is80mm ? '10.5px' : '9px'}; text-transform: uppercase; margin-top: 1.5px;">COLLECTED BY</div>
                <div style="font-size: 8.5px; color: #222;">(මුදල් එකතුකරු)</div>
                <div style="font-size: 9.5px; font-weight: bold; color: #000;">${cleanRepName}</div>
              </td>
              <!-- RIGHT: Customer / Shop Owner -->
              <td style="width: 50%; text-align: center; vertical-align: top; padding-left: 2.5px;">
                <div style="height: 10px;"></div>
                <div style="border-top: 1.5px solid #000; margin: 0 3px;"></div>
                <div style="font-weight: 900; font-size: ${is80mm ? '10.5px' : '9px'}; text-transform: uppercase; margin-top: 1.5px;">PAID BY (CUSTOMER)</div>
                <div style="font-size: 8.5px; color: #222;">(කඩහිමි අත්සන)</div>
                <div style="font-size: 8.5px; color: #000;">Payment Confirmed ✓</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- BARCODE SECTION -->
        <div class="barcode-container" style="text-align: center; margin: 3px auto 1px auto; padding-top: 1px;">
          ${barcodeSVG}
          <div class="barcode-text" style="font-size: 9.5px; font-weight: 800; letter-spacing: 1.5px; margin-top: 1px; font-family: monospace;">
            * ${receiptNo} *
          </div>
        </div>

        <!-- DIVIDER -->
        <div class="receipt-divider"></div>

        <!-- FOOTER MESSAGE -->
        <div class="receipt-footer" style="text-align: center; font-size: 9px; margin-top: 1.5px; line-height: 1.25;">
          <div style="font-weight: bold;">Thank you for your payment! / ස්තූතියි!</div>
          <div style="font-size: 7.5px; color: #444; margin-top: 1px;">
            MOB POS Enterprise • Official Debt Recovery Receipt
          </div>
        </div>

        <!-- TEAR-OFF BOTTOM SPACING -->
        <div class="receipt-tear-space" style="height: 3mm;"></div>
      </div>
    `;
  },

  async printCollectionReceipt(paymentId) {
    const html = await this.generateCollectionReceiptHTML(paymentId);
    if (!html) return;

    let receiptContainer = document.getElementById('thermal-receipt-container');
    if (!receiptContainer) {
      receiptContainer = document.createElement('div');
      receiptContainer.id = 'thermal-receipt-container';
      document.body.appendChild(receiptContainer);
    }
    receiptContainer.innerHTML = html;

    setTimeout(() => {
      if (typeof SoundFX !== 'undefined') SoundFX.play('print');
      window.print();
    }, 150);
  },

  async printTestReceipt() {
    const html = await this.generateTestReceiptHTML();
    let receiptContainer = document.getElementById('thermal-receipt-container');
    if (!receiptContainer) {
      receiptContainer = document.createElement('div');
      receiptContainer.id = 'thermal-receipt-container';
      document.body.appendChild(receiptContainer);
    }
    receiptContainer.innerHTML = html;
    setTimeout(() => {
      if (typeof SoundFX !== 'undefined') SoundFX.play('print');
      window.print();
    }, 150);
  },

  // Print Van Packing Manifest / Sheet
  async printPackingManifest(targetDate, routeName, matrixItems, ordersList) {
    const company = await this.getCompanyProfile();
    let itemsRows = '';
    let totalCards = 0;
    let totalPackets = 0;

    for (const item of matrixItems) {
      const isCard = item.unit === 'Card';
      if (isCard) totalCards += item.totalQty;
      else totalPackets += item.totalQty;

      itemsRows += `
        <tr>
          <td style="font-weight:bold;">${item.productName}</td>
          <td><span style="display:inline-block; padding:2px 6px; background:#e2e8f0; border-radius:4px; font-size:10px; font-weight:bold;">${item.unit}</span></td>
          <td style="font-size:14px; font-weight:bold; text-align:right;">${item.totalQty}</td>
        </tr>
      `;
    }

    let shopsRows = '';
    for (let idx = 0; idx < ordersList.length; idx++) {
      const ord = ordersList[idx];
      const shop = await db.shops.get(ord.shopId);
      const items = await db.saleItems.where('saleId').equals(ord.id).toArray();
      const itemsStr = items.map(i => `${i.qty}${i.freeQty > 0 ? `(+${i.freeQty})` : ''} ${i.unit} ${i.productName}`).join(', ');

      shopsRows += `
        <tr>
          <td style="width:24px; text-align:center; font-weight:bold;">${idx + 1}</td>
          <td>
            <b>${shop ? shop.name : 'Shop'}</b>
            <div style="font-size:10px; color:#555;">${shop?.ownerName || ''} • 📞 ${shop?.phone || ''}</div>
          </td>
          <td><div style="font-size:11px;">${itemsStr}</div></td>
          <td style="text-align:right; font-weight:bold;">${UI.formatCurrency(ord.totalAmount)}</td>
          <td style="width:50px; text-align:center;">[ &nbsp; ]</td>
        </tr>
      `;
    }

    const html = `
      <div class="a4-document-print">
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
          <h1 style="font-size:18px; margin:0; font-weight:black;">${company?.name || 'SPICE WHOLESALE DISTRIBUTORS'}</h1>
          <h2 style="font-size:14px; margin:4px 0 0 0; color:#15803d; font-weight:bold;">📦 VAN LOAD PACKING MANIFEST (පැකින් ලැයිස්තුව)</h2>
          <div style="font-size:11px; margin-top:4px; color:#444;">
            Target Date: <b>${UI.formatDate(targetDate)}</b> | Route: <b>${routeName}</b> | Generated: ${new Date().toLocaleTimeString()}
          </div>
        </div>

        <h3 style="font-size:12px; margin:10px 0 4px 0; text-transform:uppercase; font-weight:bold;">1. Total Inventory to Pack into Van (පැටවිය යුතු මුළු ප්‍රමාණය)</h3>
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th style="width:80px;">Unit</th>
              <th style="width:90px; text-align:right;">Total To Pack</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows || '<tr><td colspan="3" style="text-align:center;">No pending items</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background:#f8fafc; font-weight:bold;">
              <td colspan="2">TOTAL QUANTITIES:</td>
              <td style="text-align:right; font-size:13px;">${totalCards} Cards | ${totalPackets} Packets</td>
            </tr>
          </tfoot>
        </table>

        <h3 style="font-size:12px; margin:16px 0 4px 0; text-transform:uppercase; font-weight:bold;">2. Delivery Drops & Route Checklist (${ordersList.length} Shops)</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Shop Details</th>
              <th>Ordered Items</th>
              <th style="text-align:right;">Amount</th>
              <th>Done</th>
            </tr>
          </thead>
          <tbody>
            ${shopsRows || '<tr><td colspan="5" style="text-align:center;">No delivery shops scheduled</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top:25px; display:flex; justify-content:space-between; font-size:11px; padding-top:15px; border-top:1px dashed #999;">
          <div>Driver Signature: ______________________</div>
          <div>Sales Rep Signature: ______________________</div>
          <div>Manager Approval: ______________________</div>
        </div>
      </div>
    `;

    let receiptContainer = document.getElementById('thermal-receipt-container');
    if (!receiptContainer) {
      receiptContainer = document.createElement('div');
      receiptContainer.id = 'thermal-receipt-container';
      document.body.appendChild(receiptContainer);
    }

    receiptContainer.innerHTML = html;
    setTimeout(() => {
      if (typeof SoundFX !== 'undefined') SoundFX.play('print');
      window.print();
    }, 150);
  }
};
