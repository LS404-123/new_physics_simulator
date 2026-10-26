(function (root) {
  'use strict';
  const ATMOSPHERE = 100, BALL_VOLUME = 6000, STROKE_VOLUME = 120, TARGET = 156;
  const MAX_STROKES = 40;
  const pressureRise = ATMOSPHERE * STROKE_VOLUME / BALL_VOLUME;

  function solve(strokes, cycle = 0) {
    if (!Number.isInteger(strokes) || strokes < 0 || strokes > MAX_STROKES ||
        !Number.isFinite(cycle) || cycle < 0 || cycle > 1 || (strokes === MAX_STROKES && cycle !== 0)) {
      throw new RangeError('打氣次數或活塞位置超出範圍');
    }
    const pushing = cycle < 0.7;
    const displacement = Math.max(0, Math.min(1, pushing ? cycle / 0.7 : (1 - cycle) / 0.3));
    const pumpVolume = STROKE_VOLUME * (1 - displacement);
    const initialPressure = ATMOSPHERE + strokes * pressureRise;
    // 止回閥開啟後，籃球與氣筒共用壓強；整個推進過程守恆的是兩者的總氣體量。
    const openVolume = ATMOSPHERE * STROKE_VOLUME / initialPressure;
    const valveOpen = pushing && pumpVolume < openVolume;
    const pressure = !pushing ? initialPressure + pressureRise : valveOpen
      ? ATMOSPHERE * (BALL_VOLUME + (strokes + 1) * STROKE_VOLUME) / (BALL_VOLUME + pumpVolume)
      : initialPressure;
    const addedVolume = BALL_VOLUME * (pressure / ATMOSPHERE - 1);
    const pumpPressure = pushing
      ? valveOpen ? pressure : ATMOSPHERE * STROKE_VOLUME / pumpVolume
      : ATMOSPHERE;
    return { strokes, cycle, displacement, pumpVolume, pumpPressure, pressure,
      addedVolume, equivalentVolume: BALL_VOLUME + addedVolume,
      gasRatio: pressure / ATMOSPHERE, valveOpen,
      completed: strokes + (cycle >= 0.7 ? 1 : 0),
      reached: pressure >= TARGET - 1e-9 };
  }

  const model = { ATMOSPHERE, BALL_VOLUME, STROKE_VOLUME, TARGET, MAX_STROKES, pressureRise, solve };
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.BasketballPressure = model;
})(globalThis);
