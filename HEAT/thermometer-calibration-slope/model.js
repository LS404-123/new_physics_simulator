(function (root) {
  "use strict";

  function slope(h0, h100) {
    return (h100 - h0) / 100;
  }

  function heightAt(T, h0, h100) {
    return h0 + slope(h0, h100) * T;
  }

  const model = Object.freeze({ slope, heightAt });
  root.ThermometerModel = model;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = model;
  }
})(globalThis);

