/**
 * Global Reactive Application State
 */

const State = {
  activeTab: 'dashboard',
  selectedRouteId: null,
  selectedShopId: null,
  cart: [],
  returns: [], // [{ productId, productName, returnType: 'Card'|'Unit', qty, refundAmount, action: 'deduct'|'replace', reason }]
  discount: 0,
  paymentMode: 'Cash', // Cash | Credit | Partial
  paidAmount: 0,
  debtPaymentAmount: 0, // Previous credit collected during sale
  
  // Helpers
  clearCart() {
    this.cart = [];
    this.returns = [];
    this.discount = 0;
    this.paymentMode = 'Cash';
    this.paidAmount = 0;
    this.debtPaymentAmount = 0;
  },

  getCartSubtotal() {
    return this.cart.reduce((sum, item) => sum + ((Number(item.sellingPrice) || 0) * (Number(item.qty) || 0)), 0);
  },

  // Total COGS: includes both billed units AND free issue packets physically dispensed
  getCartTotalCost() {
    return this.cart.reduce((sum, item) => {
      const totalUnits = (Number(item.qty) || 0) + (Number(item.freeQty) || 0);
      return sum + (totalUnits * (Number(item.costPrice) || 0));
    }, 0);
  },

  // Standard catalogue subtotal before any promotional price reduction
  getCartStandardSubtotal() {
    return this.cart.reduce((sum, item) => {
      const stdPrice = Number(item.standardPrice || item.sellingPrice) || 0;
      return sum + (stdPrice * (Number(item.qty) || 0));
    }, 0);
  },

  // Total revenue markdown given (e.g. billed at Rs. 35 instead of standard Rs. 60)
  getCartPriceDiscountTotal() {
    return this.cart.reduce((sum, item) => {
      const stdPrice = Number(item.standardPrice || item.sellingPrice) || 0;
      const actualPrice = Number(item.sellingPrice) || 0;
      const markdown = Math.max(0, stdPrice - actualPrice);
      return sum + (markdown * (Number(item.qty) || 0));
    }, 0);
  },

  // Direct COGS value of all free promotional goods given
  getCartFreeCostTotal() {
    return this.cart.reduce((sum, item) => {
      const fQty = Number(item.freeQty) || 0;
      const cost = Number(item.costPrice) || 0;
      return sum + (fQty * cost);
    }, 0);
  },

  // Total trade promotion subsidy = price markdown + free goods COGS
  getCartTotalSubsidy() {
    return this.getCartPriceDiscountTotal() + this.getCartFreeCostTotal();
  },

  getReturnDeductionTotal() {
    return this.returns
      .filter(r => r.action === 'deduct')
      .reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);
  },

  getCartNetTotal() {
    const subtotal = this.getCartSubtotal();
    const returnDeduction = this.getReturnDeductionTotal();
    const discount = Number(this.discount) || 0;
    return Math.max(0, subtotal - discount - returnDeduction);
  },

  // True company profit: Net revenue collected minus total COGS (both billed & free goods)
  getCartTotalProfit() {
    const netTotal = this.getCartNetTotal();
    const totalCost = this.getCartTotalCost();
    return netTotal - totalCost;
  }
};
