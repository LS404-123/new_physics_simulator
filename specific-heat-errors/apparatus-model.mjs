import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import fontData from './helvetiker_regular.typeface.json' with { type: 'json' };
import { DIGITS, liquidColumnPose } from './apparatus-display.mjs';

const WATER_LEVEL = 1.78;

// 造型尺寸以 10 cm 為一單位；根節點換算至 glTF 的公尺。
export function createApparatus(cupType = 'polystyrene', depth = 'full', stirAfter = true, sample = 'water') {
  if (!['polystyrene', 'glass'].includes(cupType)) throw new TypeError('未知杯材質');
  if (!['full', 'half'].includes(depth)) throw new TypeError('未知浸沒深度');
  if (!['water', 'metal'].includes(sample)) throw new TypeError('未知樣品');
  const isMetal = sample === 'metal';
  const model = new T.Group();
  model.name = '量熱實驗器材';
  model.scale.setScalar(0.1);
  model.userData.note = '以使用者最終參考圖的上方液體裝置為準；聚苯乙烯杯前半採剖視，杯蓋依原圖。棉絮與底墊屬下方金屬塊裝置。';
  model.userData.cupType = cupType;
  model.userData.depth = depth;
  model.userData.stirAfter = stirAfter;
  model.userData.sample = sample;
  const material = (name, color, metalness, roughness, extra = {}) => {
    const m = new T.MeshPhysicalMaterial({ color, metalness, roughness, ...extra });
    m.name = name;
    return m;
  };
  const metal = material('緞面鋁', 0xa5aaa9, 0.78, 0.3);
  const chrome = material('拋光不鏽鋼', 0xc9cfce, 0.9, 0.19);
  const dark = material('石墨灰塑膠', 0x313a3d, 0.18, 0.34);
  const rubber = material('黑色絕緣橡膠', 0x171c1d, 0, 0.52);
  const red = material('紅色接線柱', 0x942c25, 0.08, 0.4);
  const ivory = material('儀表面板', 0xe4e5dc, 0.12, 0.46);
  const ink = material('儀表刻度', 0x20282a, 0, 0.6);
  const font = new FontLoader().parse(fontData);
  const liquid = material('淺藍色水', 0x7bc9ed, 0, 0.35, {
    transparent: true, opacity: 0.36, depthWrite: false, side: T.DoubleSide,
  });
  const cup = material('白色聚苯乙烯泡膠', 0xf5f3ea, 0, 0.98, { side: T.DoubleSide });
  if (cupType === 'glass') {
    cup.name = '透明玻璃杯';
    cup.color.setHex(0xb3d5df);
    cup.roughness = 0.12;
    cup.transparent = true;
    cup.opacity = 0.18;
    cup.depthWrite = false;
  }
  const glass = material('溫度計玻璃', 0x92b0b8, 0.1, 0.14, {
    transparent: true, opacity: 0.42, depthWrite: false,
  });

  function group(name, parent = model) {
    const g = new T.Group();
    g.name = name;
    parent.add(g);
    return g;
  }
  function mesh(name, geometry, mat, position, parent) {
    const m = new T.Mesh(geometry, mat);
    m.name = name;
    m.position.set(...position);
    m.castShadow = !mat.transparent;
    m.receiveShadow = !mat.transparent;
    parent.add(m);
    return m;
  }
  function box(name, size, pos, mat, parent, radius = 0.025) {
    const geo = radius ? new RoundedBoxGeometry(...size, 3, radius) : new T.BoxGeometry(...size);
    return mesh(name, geo, mat, pos, parent);
  }
  function cylinder(name, rt, rb, height, pos, mat, parent) {
    return mesh(name, new T.CylinderGeometry(rt, rb, height, 48), mat, pos, parent);
  }
  function tube(name, points, radius, mat, parent, closed = false) {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)), closed);
    return mesh(name, new T.TubeGeometry(curve, Math.max(64, points.length * 10), radius, 12, closed), mat, [0, 0, 0], parent);
  }
  function ring(name, radius, thickness, pos, mat, parent) {
    const r = mesh(name, new T.TorusGeometry(radius, thickness, 10, 64), mat, pos, parent);
    r.rotation.x = Math.PI / 2;
    return r;
  }
  function screw(x, y, z, parent) {
    const s = cylinder('螺絲頭', 0.032, 0.032, 0.016, [x, y, z], chrome, parent);
    s.rotation.x = Math.PI / 2;
    const slot = box('螺絲槽', [0.038, 0.006, 0.003], [x, y, z + 0.009], ink, parent, 0);
    slot.rotation.z = -0.55;
  }
  function roundedRectangle(width, height, radius, cy = 0) {
    const x = -width / 2, y = cy - height / 2;
    const shape = new T.Shape();
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
    return shape;
  }
  function meterFrame(name, width, height, radius, depth, z, mat, hole) {
    const shape = roundedRectangle(width, height, radius);
    shape.holes.push(hole);
    return mesh(name, new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 }), mat, [-1.4, 1.97, z], meter);
  }

  const meter = group('焦耳計');
  box('金屬底座', [1.85, 0.16, 1.36], [-1.4, 0.18, 0.04], metal, meter, 0.035);
  for (const x of [-2.12, -0.68]) {
    for (const z of [-0.43, 0.55]) cylinder('防滑腳', 0.085, 0.075, 0.1, [x, 0.06, z], rubber, meter);
  }
  box('直立背板', [1.55, 2.8, 0.16], [-1.4, 1.65, -0.45], metal, meter, 0.018);
  box('安裝面板', [1.34, 2.2, 0.075], [-1.4, 1.77, -0.328], dark, meter, 0.08);
  box('安裝面板邊框', [1.3, 2.16, 0.052], [-1.4, 1.77, -0.28], metal, meter, 0.08);
  meterFrame('中空焦耳計外殼', 1.23, 1.59, 0.1, 0.68, -0.305, metal, roundedRectangle(1.08, 1.44, 0.055));
  box('儀表內部背壁', [1.06, 1.42, 0.012], [-1.4, 1.97, -0.25], rubber, meter, 0.03);
  // 每層均留實際開口，避免圓盤被原來的實心外殼或面板遮住。
  meterFrame('面板密封圈', 1.17, 1.48, 0.075, 0.07, 0.341, rubber, roundedRectangle(0.90, 0.17, 0.04, -0.035));
  meterFrame('面板金屬框', 1.135, 1.445, 0.065, 0.055, 0.3885, chrome, roundedRectangle(0.90, 0.17, 0.04, -0.035));
  meterFrame('焦耳計正面', 1.04, 1.33, 0.05, 0.025, 0.4385, ivory, roundedRectangle(0.90, 0.17, 0.04, -0.035));
  for (const x of [-1.98, -0.82]) for (const y of [0.79, 2.75]) screw(x, y, -0.247, meter);
  box('數字窗', [0.55, 0.175, 0.012], [-1.23, 2.36, 0.47], ink, meter, 0.012);
  for (let i = 0; i < 5; i++) {
    const x = -1.435 + i * 0.103;
    const segments = [[0, 0.054, true], [0.024, 0.027, false], [0.024, -0.027, false], [0, -0.054, true], [-0.024, -0.027, false], [-0.024, 0.027, false], [0, 0, true]];
    segments.forEach(([dx, dy, horizontal], j) => {
      const segment = box(`計數器_${i}_${j}`, horizontal ? [0.04, 0.009, 0.004] : [0.009, 0.042, 0.004], [x + dx, 2.36 + dy, 0.479], ivory, meter, 0);
      segment.scale.setScalar(Number(DIGITS[0][j]));
    });
  }
  mesh('焦耳單位', new T.ShapeGeometry(font.generateShapes('J', 0.055)), ink, [-0.96, 2.23, 0.47], meter);
  for (let i = 0; i < 6; i++) box('散熱孔', [0.019, 0.11, 0.005], [-1.825 + i * 0.041, 2.36, 0.47], ink, meter, 0.005);
  const wheel = group('焦耳計水平圓盤', meter);
  cylinder('圓盤轉軸', 0.019, 0.019, 0.35, [-1.4, 1.96, 0.11], chrome, wheel);
  cylinder('鋁製轉盤', 0.35, 0.35, 0.027, [-1.4, 1.93, 0.11], metal, wheel);
  ring('圓盤輪緣', 0.347, 0.006, [-1.4, 1.927, 0.11], ink, wheel);
  cylinder('轉盤軸心', 0.054, 0.054, 0.035, [-1.4, 1.957, 0.11], chrome, wheel);
  box('轉盤表面標記', [0.03, 0.002, 0.13], [-1.4, 1.945, 0.384], ink, wheel, 0);
  box('轉盤輪緣標記', [0.03, 0.025, 0.003], [-1.4, 1.93, 0.46], ink, wheel, 0);
  for (let i = 1; i < 36; i++) {
    const angle = i * Math.PI / 18;
    const major = i % 6 === 0;
    const tick = box(`圓盤細刻線_${i}`, [major ? 0.009 : 0.005, 0.002, major ? 0.05 : 0.028], [-1.4 + 0.321 * Math.sin(angle), 1.945, 0.11 + 0.321 * Math.cos(angle)], ink, wheel, 0);
    tick.rotation.y = angle;
    const edgeTick = box(`輪緣細刻線_${i}`, [major ? 0.009 : 0.005, 0.022, 0.002], [-1.4 + 0.35 * Math.sin(angle), 1.93, 0.11 + 0.35 * Math.cos(angle)], ink, wheel, 0);
    edgeTick.rotation.y = angle;
  }
  wheel.position.set(-1.4, 1.93, 0.11);
  for (const part of wheel.children) part.position.sub(wheel.position);
  box('下方面板凹槽', [0.73, 0.025, 0.007], [-1.4, 1.55, 0.468], metal, meter, 0.008);

  const terminals = group('四個接線柱', meter);
  const terminalX = [-2.0, -1.6, -1.2, -0.8];
  terminalX.forEach((x, i) => {
    const terminal = group(`接線柱 ${i + 1}`, terminals);
    cylinder('金屬座', 0.09, 0.09, 0.055, [x, 0.287, 0.45], chrome, terminal);
    cylinder('絕緣接頭', 0.071, 0.077, 0.2, [x, 0.408, 0.45], i === 1 || i === 2 ? red : rubber, terminal);
    cylinder('插頭', 0.042, 0.052, 0.12, [x, 0.557, 0.45], rubber, terminal);
    for (let j = 0; j < 16; j++) {
      const a = j * Math.PI / 8;
      cylinder('接頭防滑紋', 0.004, 0.004, 0.15, [x + 0.074 * Math.sin(a), 0.408, 0.45 + 0.074 * Math.cos(a)], i === 1 || i === 2 ? red : rubber, terminal);
    }
  });

  const vessel = group(isMetal ? '金屬塊裝置' : '量熱杯');
  const cx = 1.48;
  if (isMetal) {
    model.userData.note = '以使用者參考圖的金屬裝置為準：直棒電熱器、雙孔金屬塊、棉絮與聚苯乙烯墊；前半剖視以看見插入深度。';
    const blockMaterial = material('鋁塊表面', 0xb8c1c3, 0.65, 0.4, { side: T.DoubleSide });
    mesh('金屬塊後半', new T.CylinderGeometry(0.53, 0.53, 1.88, 64, 1, true, Math.PI / 3, Math.PI), blockMaterial, [cx, 0.99, 0], vessel);
    const blockCutaway = blockMaterial.clone();
    blockCutaway.transparent = true;
    blockCutaway.opacity = 0.13;
    blockCutaway.depthWrite = false;
    mesh('金屬塊前半剖視', new T.CylinderGeometry(0.53, 0.53, 1.88, 64, 1, true, Math.PI * 4 / 3, Math.PI), blockCutaway, [cx, 0.99, 0], vessel).renderOrder = 3;
    // 剖面保留實心金屬，只在兩個探針孔留視窗，避免看起來像空心杯。
    const section = new T.Shape();
    section.moveTo(-0.53, -0.94); section.lineTo(0.53, -0.94);
    section.lineTo(0.53, 0.94); section.lineTo(-0.53, 0.94); section.closePath();
    for (const [x, halfWidth, bottom] of [[-0.0275, 0.12, -0.76], [0.2965, 0.08, -0.60]]) {
      const slot = new T.Path();
      slot.moveTo(x - halfWidth, bottom); slot.lineTo(x - halfWidth, 0.935);
      slot.lineTo(x + halfWidth, 0.935); slot.lineTo(x + halfWidth, bottom); slot.closePath();
      section.holes.push(slot);
    }
    mesh('金屬塊實心剖面', new T.ShapeGeometry(section), blockMaterial, [cx, 0.99, 0], vessel).rotation.y = -Math.PI / 6;
    const top = new T.Shape();
    top.absarc(0, 0, 0.53, 0, Math.PI * 2, false);
    for (const [x, z, radius] of [[0, -0.055, 0.112], [0.325, 0.03, 0.07]]) {
      const hole = new T.Path();
      hole.absarc(x, z, radius, 0, Math.PI * 2, true);
      top.holes.push(hole);
      mesh('金屬塊孔壁', new T.CylinderGeometry(radius, radius, 0.08, 32, 1, true), blockMaterial, [cx + x, 1.89, z], vessel);
    }
    mesh('金屬塊頂面', new T.ShapeGeometry(top, 64), blockMaterial, [cx, 1.93, 0], vessel).rotation.x = Math.PI / 2;
    cylinder('金屬塊底面', 0.53, 0.53, 0.015, [cx, 0.05, 0], blockMaterial, vessel);
    const insulation = group('金屬塊隔熱材料', vessel);
    box('聚苯乙烯墊', [1.65, 0.18, 1.45], [cx, -0.0475, 0], cup, insulation, 0.025);
    const cotton = material('白色棉絮', 0xf8f5ec, 0, 1, { side: T.DoubleSide });
    const cottonProfile = [[0.55, 0.07], [0.67, 0.09], [0.70, 0.32], [0.68, 0.66], [0.70, 1.05], [0.67, 1.48], [0.65, 1.83], [0.55, 1.88], [0.55, 0.07]].map(p => new T.Vector2(...p));
    for (const front of [false, true]) {
      const geometry = new T.LatheGeometry(cottonProfile, 64, front ? Math.PI * 4 / 3 : Math.PI / 3, Math.PI);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        const ripple = 1 + 0.025 * Math.sin(Math.atan2(x, z) * 17 + y * 23) * Math.sin(y * 13);
        positions.setXYZ(i, x * ripple, y, z * ripple);
      }
      geometry.computeVertexNormals();
      const mat = cotton.clone();
      if (front) { mat.transparent = true; mat.opacity = 0.12; mat.depthWrite = false; }
      mesh(front ? '棉絮前半剖視' : '棉絮包層', geometry, mat, [cx, 0, 0], insulation).renderOrder = front ? 3 : 0;
    }
  } else {
    const profile = [[0, 0.045], [0.37, 0.045], [0.427, 0.07], [0.438, 0.15], [0.535, 1.85], [0.55, 1.9], [0.55, 1.925], [0.513, 1.925], [0.405, 0.16], [0.37, 0.125], [0, 0.125]];
    const cupProfile = profile.map(p => new T.Vector2(...p));
    mesh('杯後半', new T.LatheGeometry(cupProfile, 64, Math.PI / 3, Math.PI), cup, [cx, 0, 0], vessel);
    const cutaway = cup.clone();
    cutaway.name = '杯前半剖視示意';
    cutaway.transparent = true;
    cutaway.opacity = cupType === 'glass' ? 0.18 : 0.06;
    cutaway.depthWrite = false;
    const wall = mesh('杯前半剖視', new T.LatheGeometry(cupProfile, 64, Math.PI * 4 / 3, Math.PI), cutaway, [cx, 0, 0], vessel);
    wall.renderOrder = 3;
    for (const angle of [Math.PI / 3, Math.PI * 4 / 3]) {
      const edge = mesh('杯壁截面', new T.ShapeGeometry(new T.Shape(cupProfile)), cup, [cx, 0, 0], vessel);
      edge.rotation.y = angle - Math.PI / 2;
    }
    ring('杯底邊緣', 0.413, 0.018, [cx, 0.085, 0], cup, vessel);
    ring('杯口邊緣', 0.536, 0.024, [cx, 1.887, 0], cup, vessel);
    const water = cylinder('杯中液體', 0.503, 0.399, WATER_LEVEL - 0.145, [cx, (WATER_LEVEL + 0.145) / 2, 0], liquid, vessel);
    water.renderOrder = 2;
    const waterline = new T.MeshBasicMaterial({ color: 0x57afd8, transparent: true, opacity: 0.7, depthWrite: false });
    ring('液面邊緣', 0.503, 0.009, [cx, WATER_LEVEL, 0], waterline, vessel).renderOrder = 3;
    mesh('杯蓋', new T.CylinderGeometry(0.592, 0.581, 0.105, 48, 1, false, Math.PI / 3, Math.PI), dark, [cx, 1.975, 0], vessel);
    const lidCutaway = dark.clone();
    lidCutaway.transparent = true;
    lidCutaway.opacity = 0.12;
    lidCutaway.depthWrite = false;
    mesh('杯蓋前半剖視', new T.CylinderGeometry(0.592, 0.581, 0.105, 48, 1, false, Math.PI * 4 / 3, Math.PI), lidCutaway, [cx, 1.975, 0], vessel).renderOrder = 3;
  }

  const heater = group(isMetal ? '直棒式電熱器' : '浸沒式電熱器');
  // 發熱部分包括金屬芯及底部線圈；半浸沒以整段高度計算。
  const activeBottom = isMetal ? 0.3 : 0.203, activeTop = 1.73;
  const surface = isMetal ? 1.93 : WATER_LEVEL;
  const heaterLift = depth === 'half' ? surface - (activeBottom + activeTop) / 2 : 0;
  heater.position.y = heaterLift;
  if (!isMetal) cylinder('電熱器絕緣底座', 0.144, 0.154, 0.055, [cx, 2.055, -0.055], rubber, heater);
  cylinder('電熱器接線筒', 0.125, 0.125, 0.32, [cx, 2.235, -0.055], metal, heater);
  cylinder('接線筒頂蓋', 0.127, 0.127, 0.035, [cx, 2.41, -0.055], dark, heater);
  const contacts = [[cx - 0.057, 2.465, -0.055], [cx + 0.057, 2.465, -0.055]];
  contacts.forEach(p => cylinder('電線護套', 0.033, 0.033, 0.11, p, rubber, heater));
  const activeHeater = group('電熱器發熱部分', heater);
  const rodBottom = isMetal ? activeBottom : 0.42;
  cylinder(isMetal ? '直棒電熱器芯' : '浸沒式電熱器芯', 0.1, 0.1, activeTop - rodBottom, [cx, (activeTop + rodBottom) / 2, -0.055], chrome, activeHeater);
  const neckTop = 2.09;
  cylinder('電熱器上段接桿', 0.1, 0.1, neckTop - activeTop, [cx, (neckTop + activeTop) / 2, -0.055], chrome, heater);
  ring('發熱部分上緣', 0.102, 0.003, [cx, activeTop, -0.055], ink, heater);
  if (!isMetal) {
    const coil = Array.from({ length: 121 }, (_, i) => {
      const a = i / 120 * Math.PI * 4.5;
      return [cx + 0.245 * Math.cos(a), 0.23 + i / 120 * 0.155, -0.055 + 0.245 * Math.sin(a)];
    });
    tube('電熱器線圈', coil, 0.027, chrome, activeHeater);
    tube('線圈支腳', [[cx, 0.49, -0.055], [cx + 0.21, 0.43, -0.055], coil[0]], 0.027, chrome, activeHeater);
    tube('線圈回接', [coil.at(-1), [cx - 0.045, 0.44, -0.08], [cx - 0.045, 0.54, -0.08]], 0.027, chrome, activeHeater);

    const stirrer = group('攪拌棒');
    cylinder('攪拌棒孔環', 0.067, 0.067, 0.026, [cx - 0.315, 2.039, 0.045], rubber, stirrer);
    const movingStirrer = group('攪拌棒活動部分', stirrer);
    tube('攪拌棒金屬桿', [[cx - 0.315, 0.26, 0.045], [cx - 0.315, 1.95, 0.045], [cx - 0.315, 3.18, 0.045], [cx - 0.365, 3.32, 0.045], [cx - 0.525, 3.39, 0.045]], 0.021, chrome, movingStirrer);
    box('攪拌棒末端', [0.11, 0.15, 0.024], [cx - 0.315, 0.25, 0.045], chrome, movingStirrer, 0.012);
  }

  const thermometer = group('溫度計');
  const tx = cx + 0.325;
  const thermometerGlass = glass.clone();
  thermometerGlass.name = '溫度計高透玻璃';
  thermometerGlass.opacity = 0.14;
  if (!isMetal) cylinder('溫度計孔環', 0.084, 0.084, 0.032, [tx, 2.039, 0.03], rubber, thermometer);
  mesh('玻璃外管', new T.CapsuleGeometry(0.061, 2.99, 8, 32), thermometerGlass, [tx, 1.93, 0.03], thermometer);
  box('溫度計刻度襯底', [0.092, 2.86, 0.012], [tx, 1.97, 0.035], ivory, thermometer, 0.012);
  cylinder('毛細管', 0.011, 0.011, 2.86, [tx - 0.031, 1.94, 0.056], glass, thermometer);
  const initialColumn = liquidColumnPose(20);
  const column = cylinder('紅色液柱', 0.0075, 0.0075, 1, [tx - 0.031, initialColumn.y, 0.057], red, thermometer);
  column.scale.y = initialColumn.height;
  mesh('液柱感溫泡', new T.SphereGeometry(0.025, 24, 16), red, [tx - 0.031, 0.469, 0.047], thermometer).scale.y = 1.9;
  const scale = group('溫度計刻度', thermometer);
  for (let i = 0; i <= 100; i++) {
    const y = 0.64 + i * 0.026;
    box('溫度計刻線', [i % 10 === 0 ? 0.025 : i % 5 === 0 ? 0.019 : 0.012, i % 10 === 0 ? 0.004 : 0.002, 0.002], [tx - 0.009, y, 0.057], ink, scale, 0);
    if (i % 10 === 0) mesh(`溫度刻度 ${i}`, new T.ShapeGeometry(font.generateShapes(String(i), 0.023)), ink, [tx + 0.007, y - 0.008, 0.057], scale);
  }
  mesh('攝氏單位', new T.ShapeGeometry(font.generateShapes('°C', 0.034)), ink, [tx - 0.028, 3.32, 0.057], scale);

  const cables = group('導線');
  for (let i = 0; i < 2; i++) {
    const x = terminalX[i];
    const end = [-3.5, 0.062, 0.63 + i * 0.16];
    const lead = tube(`電源線 ${i + 1}`, [[x, 0.61, 0.45], [x - 0.05, 0.82, 0.32], [x - 0.43, 0.85, 0.34], [x - 0.79, 0.39, 0.73], [-2.85, 0.069, 0.95 + i * 0.1], end], 0.025, rubber, cables);
    lead.userData.connection = ['焦耳計輸入', '圖外電源'];
    const target = contacts[i].map((value, j) => value + (j === 1 ? heaterLift : 0));
    const start = [terminalX[i + 2], 0.61, 0.45];
    const wire = tube(`電熱器導線 ${i + 1}`, [start, [start[0] + 0.06, 0.83, 0.38], [start[0] + 0.25, 0.9, 0.18], [0.01 + i * 0.12, 0.73 + i * 0.07, -0.14], [0.40 + i * 0.07, 1.02, -0.2], [0.72 + i * 0.07, 2.51 + heaterLift, -0.21], [1.02 + i * 0.07, 2.77 + heaterLift, -0.15], [target[0] - 0.035, 2.74 + heaterLift, -0.075], [target[0], target[1] + 0.055, target[2]]], 0.028, rubber, cables);
    wire.userData.connection = ['焦耳計輸出', '浸沒式電熱器'];
  }
  const heatFlow = group('熱流箭嘴');
  const heaterFlowMaterial = new T.MeshBasicMaterial({ color: 0xe3303b, toneMapped: false, transparent: true, depthWrite: false });
  heaterFlowMaterial.name = '紅色電熱器向樣品傳熱';
  const lossFlowMaterial = new T.MeshBasicMaterial({ color: 0xf18b16, toneMapped: false, transparent: true, depthWrite: false });
  lossFlowMaterial.name = '橙色樣品向周圍散熱';
  const paths = [
    ...Array.from({ length: 6 }, (_, i) => {
      const angle = i * Math.PI / 3;
      const y = depth === 'half' ? surface - 0.12 : isMetal ? 0.7 + (i % 2) * 0.35 : i % 2 ? 0.53 : 0.30;
      return { flow: 'heaterPower', from: [cx + 0.12 * Math.cos(angle), y, -0.055 + 0.12 * Math.sin(angle)], to: [cx + 0.25 * Math.cos(angle), y, -0.055 + 0.25 * Math.sin(angle)] };
    }),
    { flow: 'lossPower', from: [cx - 0.44, 0.88, 0.15], to: [cx - 1.32, 1.17, -0.08] },
    { flow: 'lossPower', from: [cx + 0.44, 0.88, 0.15], to: [cx + 1.32, 1.25, 0.30] },
    { flow: 'lossPower', from: [cx, 1.30, 0.38], to: [cx, 2.54, 0.86] },
    ...(depth === 'half' ? [
      { flow: 'exposedLossPower', from: [cx - 0.12, (surface + activeTop + heaterLift) / 2, -0.055], to: [cx - 1.08, surface + 0.7, -0.055] },
      { flow: 'exposedLossPower', from: [cx + 0.12, (surface + activeTop + heaterLift) / 2, -0.055], to: [cx + 1.08, surface + 0.7, -0.055] },
    ] : []),
  ];
  paths.forEach((path, i) => {
    const arrow = group(`熱流箭嘴_${i}`, heatFlow);
    arrow.userData = { ...path, offset: (i % 3) / 3 };
    arrow.position.set(...path.from);
    arrow.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...path.to).sub(new T.Vector3(...path.from)).normalize());
    const mat = path.flow === 'heaterPower' ? heaterFlowMaterial : lossFlowMaterial;
    const inward = path.flow === 'heaterPower';
    const shaft = cylinder('熱流箭桿', inward ? 0.014 : 0.018, inward ? 0.014 : 0.018, inward ? 0.12 : 0.24, [0, 0, 0], mat, arrow);
    const head = mesh('熱流箭頭', new T.ConeGeometry(inward ? 0.05 : 0.067, inward ? 0.09 : 0.15, 16), mat, [0, inward ? 0.105 : 0.195, 0], arrow);
    shaft.castShadow = head.castShadow = false;
    shaft.renderOrder = head.renderOrder = 4;
    arrow.scale.setScalar(0);
  });
  model.updateMatrixWorld(true);
  return model;
}
