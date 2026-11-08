// Shared by the server engine (require) and the browser (window.DDRupeeSplit).
// Splits a whole-rupee total across chip counts so the parts always sum to the
// total exactly (largest-remainder rounding). One implementation, so the stakes
// the player sees before locking are the stakes the server actually buys.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DDRupeeSplit = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function splitRupees(total, chipsById, chipCount) {
    const whole = Math.round(Number(total) || 0);
    const ids = Object.keys(chipsById);
    const exact = ids.map(id => ({ id, value: whole * (Number(chipsById[id]) || 0) / chipCount }));
    const parts = Object.fromEntries(exact.map(item => [item.id, Math.floor(item.value + 1e-9)]));
    const placedChips = ids.reduce((sum, id) => sum + (Number(chipsById[id]) || 0), 0);
    const target = Math.round(whole * placedChips / chipCount);
    let leftover = target - ids.reduce((sum, id) => sum + parts[id], 0);
    const order = exact
      .filter(item => item.value > 0)
      .sort((a, b) => (b.value - Math.floor(b.value + 1e-9)) - (a.value - Math.floor(a.value + 1e-9)) || ids.indexOf(a.id) - ids.indexOf(b.id));
    for (let index = 0; leftover > 0 && order.length; index = (index + 1) % order.length, leftover -= 1) {
      parts[order[index].id] += 1;
    }
    return parts;
  }

  return { splitRupees };
}));
