(function (root) {
  'use strict';
  const AVOGADRO = 602214076000000000000000n;
  const DOTS_PER_MOLE = 100;

  function snapshot(step, atoms, dozens, moles) {
    if (!Number.isInteger(step) || step < 0 || step > 3 ||
        !Number.isInteger(atoms) || atoms < 1 || atoms > 24 ||
        !Number.isInteger(dozens) || dozens < 1 || dozens > 2 ||
        !Number.isInteger(moles) || moles < 1 || moles > 5) {
      throw new RangeError('計數設定超出範圍');
    }
    const schematic = step >= 2;
    const n = step === 2 ? 1 : moles;
    const count = schematic ? AVOGADRO * BigInt(n)
      : BigInt(step === 0 ? atoms : dozens * 12);
    return {
      step, schematic, count,
      moles: schematic ? n : Number(count) / Number(AVOGADRO),
      dots: schematic ? n * DOTS_PER_MOLE : Number(count),
      groups: step === 0 ? 0 : schematic ? n : dozens,
      dotsPerGroup: schematic ? DOTS_PER_MOLE : 12,
      atomsPerDot: schematic ? AVOGADRO / BigInt(DOTS_PER_MOLE) : 1n
    };
  }

  function scientific(count) {
    const digits = count.toString();
    if (digits.length < 4) return digits;
    const tail = digits.slice(1).replace(/0+$/, '');
    return `${digits[0]}${tail ? '.' + tail : ''}\\times 10^{${digits.length - 1}}`;
  }

  // 計數用理想氣體示意；位置、速率及時間均無實際比例。
  function advance(particles, dt) {
    for (const p of particles) {
      for (const axis of ['x', 'y']) {
        const velocity = axis === 'x' ? 'vx' : 'vy';
        p[axis] += p[velocity] * dt;
        while (p[axis] < 0 || p[axis] > 1) {
          if (p[axis] < 0) { p[axis] = -p[axis]; p[velocity] = Math.abs(p[velocity]); }
          if (p[axis] > 1) { p[axis] = 2 - p[axis]; p[velocity] = -Math.abs(p[velocity]); }
        }
      }
    }
  }

  const model = { AVOGADRO, DOTS_PER_MOLE, snapshot, scientific, advance };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  else root.MoleModel = model;
})(typeof window === 'undefined' ? globalThis : window);
