/* Dojo Zero shared economy rules. Loaded by the game (window.DZ_ECON) and by server.js (require).
   To make every fighter the same price again, set FLAT to a number (e.g. 500). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DZ_ECON = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var FLAT = 0;
  /* fighter index -> price. Kaito (0) is free; newer fighters cost more. */
  var TIERS = [
    { name: 'Classic', price: 300,  ids: [1, 2, 3, 4, 5, 6, 7, 8] },
    { name: 'Rising',  price: 500,  ids: [9, 10, 11, 12, 13] },
    { name: 'Elite',   price: 750,  ids: [14, 15, 16, 17, 18] },
    { name: 'Legend',  price: 1000, ids: [30, 31, 32, 33, 34] }
  ];
  var PRICE = {};
  TIERS.forEach(function (t) { t.ids.forEach(function (i) { PRICE[i] = t.price; }); });
  function sellable(i) { return PRICE[i] !== undefined; }
  function priceOf(i) { return sellable(i) ? (FLAT || PRICE[i]) : 0; }
  function isAdminId(i) { return i >= 19 && i < 30; }
  function spent(owned) { var s = 0; (owned || []).forEach(function (i) { s += priceOf(i); }); return s; }
  return {
    TIERS: TIERS, sellable: sellable, priceOf: priceOf, isAdminId: isAdminId, spent: spent,
    MAX_COINS: 1000000,          /* hard cap for normal players */
    EARN_PER_SEC: 600 / 3600,    /* max believable mission income (coins per second) */
    BURST: 1000,                 /* allowance on top of the rate */
    FIRST_SYNC_CAP: 50000        /* lifetime coins accepted the first time an account syncs */
  };
});
