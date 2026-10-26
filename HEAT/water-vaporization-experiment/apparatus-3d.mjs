import * as T from '../specific-heat-errors/node_modules/three/build/three.module.js';
import { OrbitControls } from '../specific-heat-errors/node_modules/three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from '../specific-heat-errors/node_modules/three/examples/jsm/environments/RoomEnvironment.js';
import { createApparatus } from '../specific-heat-errors/apparatus-model.mjs';

function mount(host) {
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0xf4f8f8, 1); renderer.toneMapping = T.ACESFilmicToneMapping;
  host.append(renderer.domElement);
  const canvas = renderer.domElement; canvas.tabIndex = 0; canvas.setAttribute('role', 'img');
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(34, 1, 0.1, 100);
  const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment(); scene.environment = pmrem.fromScene(room, 0.04).texture; room.dispose(); pmrem.dispose();
  scene.add(new T.HemisphereLight(0xeaf6ff, 0x777569, 1.3));
  const light = new T.DirectionalLight(0xfff5e8, 3); light.position.set(-3, 8, 6); scene.add(light);
  const metal = new T.MeshStandardMaterial({ color: 0xa7b6b8, metalness: 0.75, roughness: 0.28 });
  const dark = new T.MeshStandardMaterial({ color: 0x344b54, roughness: 0.5 });
  const foam = new T.MeshStandardMaterial({ color: 0xf5f3ea, roughness: 1 });
  const blue = new T.MeshBasicMaterial({ color: 0x1565c0 });
  function mesh(geometry, material, position, parent = scene) { const object = new T.Mesh(geometry, material); object.position.set(...position); parent.add(object); return object; }
  function box(size, position, material = metal, parent = scene) { return mesh(new T.BoxGeometry(...size), material, position, parent); }
  function cylinder(rt, rb, h, position, material = metal, parent = scene) { return mesh(new T.CylinderGeometry(rt, rb, h, 40), material, position, parent); }
  function tube(points, radius, material = dark, parent = scene) { return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 64, radius, 10), material, [0, 0, 0], parent); }
  // 只重用造型；不改動前面的比熱容量或冰熔解 simulator。
  const donor = createApparatus(), vessel = donor.getObjectByName('量熱杯'), meter = donor.getObjectByName('焦耳計');
  donor.remove(vessel, meter); vessel.position.set(0.1, 0.65, 0); meter.position.set(-0.8, 0, 0); scene.add(vessel, meter);
  donor.traverse(object => object.geometry?.dispose());
  const water = vessel.getObjectByName('杯中液體'), waterline = vessel.getObjectByName('液面邊緣');
  water.material.color.setHex(0x278ab8); water.material.opacity = 0.65;
  const originalWater = { y: water.position.y, h: water.geometry.parameters.height, bottom: 0.145, top: waterline.position.y };
  const lids = [vessel.getObjectByName('杯蓋'), vessel.getObjectByName('杯蓋前半剖視')];
  meter.traverse(object => { if (object.name.startsWith('計數器_') || object.name === '焦耳單位') object.visible = false; });
  function displayTexture(width, height) { const bitmap = document.createElement('canvas'); bitmap.width = width; bitmap.height = height; const texture = new T.CanvasTexture(bitmap); texture.colorSpace = T.SRGBColorSpace; return { bitmap, texture, context: bitmap.getContext('2d') }; }
  const meterDisplay = displayTexture(640, 140), balanceDisplay = displayTexture(640, 140);
  mesh(new T.PlaneGeometry(0.96, 0.21), new T.MeshBasicMaterial({ map: meterDisplay.texture, toneMapped: false }), [-1.35, 2.34, 0.492], meter);
  box([1.85, 0.32, 1.6], [1.58, 0.24, 0], dark); box([1.65, 0.12, 1.38], [1.58, 0.47, 0]);
  box([1.67, 0.15, 1.4], [1.58, 0.61, 0], foam);
  mesh(new T.PlaneGeometry(0.98, 0.23), new T.MeshBasicMaterial({ map: balanceDisplay.texture, toneMapped: false }), [1.48, 0.26, 0.806]);
  for (let i = 0; i < 3; i++) box([0.13, 0.06, 0.03], [2.10 + i * 0.16, 0.25, 0.79], metal);
  box([1.05, 0.14, 0.92], [-0.32, 0.09, -0.18]); cylinder(0.045, 0.045, 3.55, [-0.32, 1.91, -0.18]);
  const heater = new T.Group(); scene.add(heater);
  cylinder(0.13, 0.13, 0.3, [1.58, 2.94, 0], dark, heater);
  for (const x of [1.525, 1.635]) cylinder(0.025, 0.025, 1.7, [x, 2.07, 0], metal, heater);
  const coil = tube(Array.from({ length: 96 }, (_, i) => { const a = i / 95 * Math.PI * 8; return [1.58 + 0.23 * Math.cos(a), 1.08 + i / 95 * 0.26, 0.23 * Math.sin(a)]; }), 0.024, metal.clone(), heater);
  coil.material.color.setHex(0x59666b);
  const clamp = tube([[-0.32, 2.86, -0.18], [0.75, 2.86, -0.18], [1.43, 2.86, 0]], 0.035, metal);
  const wires = new T.Group(); scene.add(wires);
  function updateWires(lift) {
    for (const wire of [...wires.children]) { wires.remove(wire); wire.geometry.dispose(); }
    for (let i = 0; i < 2; i++) {
      tube([[-2.0 + i * 0.4, 0.61, 0.45], [-1.3, 1.25, -0.18], [-0.5, 3.18 + lift, -0.2], [1.58 + i * 0.06, 3.26 + lift, 0], [1.55 + i * 0.06, 3.09 + lift, 0]], 0.027, dark, wires);
    }
  }
  let previousLift = null;
  for (let i = 0; i < 2; i++) tube([[-2.8 + i * 0.4, 0.61, 0.45], [-3.3, 0.6, 0.9], [-3.75, 0.06, 1.1 + i * 0.18]], 0.023);
  const steamMaterial = new T.MeshBasicMaterial({ color: 0x628eaa, transparent: true, opacity: 0.36, depthWrite: false });
  const steam = Array.from({ length: 18 }, () => mesh(new T.SphereGeometry(0.07, 12, 8), steamMaterial, [1.58, 2.6, 0]));
  const drops = Array.from({ length: 3 }, () => mesh(new T.SphereGeometry(0.03, 12, 8), blue, [1.58, 2.5, 0]));
  const puddle = cylinder(0.24, 0.24, 0.009, [2.75, 0.02, 0.2], blue);
  const labelsLayer = document.createElement('div'); labelsLayer.className = 'labels'; host.append(labelsLayer);
  const labels = [['千瓦時計', [-2.2, 2.6, 0.45], -25, -40], ['浸沒式電熱器', [1.58, 2.94, 0], 18, -25], ['聚苯乙烯杯（剖視）', [1.58, 1.75, 0], 28, -12], ['聚苯乙烯板', [1.58, 0.61, 0], 25, 10], ['電子天平', [1.58, 0.24, 0.8], -35, 26], ['接電源（圖外）', [-3.75, 0.06, 1.1], -65, 0]].map(([text, position, dx, dy]) => {
    const element = document.createElement('div'); element.className = 'apparatus-label'; element.textContent = text; labelsLayer.append(element); return { element, position: new T.Vector3(...position), dx, dy };
  });
  const controls = new OrbitControls(camera, canvas); controls.minDistance = 6; controls.maxDistance = 24; controls.maxPolarAngle = Math.PI * 0.53; controls.touches.ONE = T.TOUCH.ROTATE; controls.touches.TWO = T.TOUCH.DOLLY_PAN;
  let width = 0, height = 0, lastMeter = '', lastMass = '';
  function drawDisplay(display, text, foreground, background) { const c = display.context; c.fillStyle = background; c.fillRect(0, 0, display.bitmap.width, display.bitmap.height); c.fillStyle = foreground; c.font = '64px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 320, 70); display.texture.needsUpdate = true; }
  function render() {
    renderer.render(scene, camera);
    labels[1].dx = width / height < 2 ? -110 : 18;
    for (const label of labels) { const p = label.position.clone().project(camera); label.element.style.transform = `translate(${T.MathUtils.clamp((p.x + 1) * width / 2 + label.dx, 5, width - label.element.offsetWidth - 5)}px,${T.MathUtils.clamp((1 - p.y) * height / 2 + label.dy, 5, height - label.element.offsetHeight - 5)}px)`; }
  }
  function resetView() { const lift = previousLift || 0; controls.target.set(-0.1, 1.7 + lift * 0.25, 0); const scale = Math.max(1, 2.0 / camera.aspect) * (lift ? 1.1 : 1); camera.position.set(-0.1 - 1.8 * scale, controls.target.y + 2.7 * scale, 8.7 * scale); controls.update(); render(); }
  function resize() { width = host.clientWidth; height = host.clientHeight; if (!width || !height) return; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height); resetView(); }
  new ResizeObserver(resize).observe(host); controls.addEventListener('change', render); canvas.addEventListener('dblclick', resetView);
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Home') { event.preventDefault(); resetView(); return; }
    const s = new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (event.key === 'ArrowLeft') s.theta -= 0.1; else if (event.key === 'ArrowRight') s.theta += 0.1; else if (event.key === 'ArrowUp') s.phi -= 0.1; else if (event.key === 'ArrowDown') s.phi += 0.1; else if (event.key === '+' || event.key === '=') s.radius *= 0.9; else if (event.key === '-') s.radius *= 1.1; else return;
    event.preventDefault(); s.phi = T.MathUtils.clamp(s.phi, 0.08, controls.maxPolarAngle); s.radius = T.MathUtils.clamp(s.radius, controls.minDistance, controls.maxDistance); camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(s)); controls.update();
  });
  resize();
  return { resetView, update(state, reading, { running, reducedMotion }) {
    const kwh = reading.current.kwh.toFixed(8), mass = reading.current.grams.toFixed(3);
    if (kwh !== lastMeter) { drawDisplay(meterDisplay, `${kwh} kWh`, '#eff4ed', '#20282a'); lastMeter = kwh; }
    if (mass !== lastMass) { drawDisplay(balanceDisplay, `${mass} g`, '#143a32', '#bed8c8'); lastMass = mass; }
    const ratio = state.mass / 0.2; water.scale.y = ratio; water.position.y = originalWater.bottom + originalWater.h * ratio / 2; waterline.position.y = originalWater.bottom + originalWater.h * ratio;
    lids.forEach(lid => lid.visible = !state.config.noLid);
    const geometry = globalThis.WaterVaporization.GEOMETRY;
    const lift = state.config.immersed ? 0 : geometry.partialCoilBottom - geometry.coilBottom; heater.position.y = lift; clamp.position.y = lift;
    labels[1].position.y = 2.94 + lift;
    if (lift !== previousLift) { updateWires(lift); previousLift = lift; resetView(); }
    meter.getObjectByName('焦耳計水平圓盤').rotation.y = reducedMotion ? 0 : state.input / 5000 * Math.PI * 2;
    steam.forEach((particle, i) => { const f = reducedMotion ? i / 18 : (state.time * 0.7 + i / 18) % 1; particle.visible = reading.boiling && i < Math.min(18, Math.ceil(state.evaporationRate * 140000)); particle.position.set(1.58 + Math.sin(i * 2.4) * (0.12 + f * 0.27), 2.6 + f * 0.95, Math.cos(i * 2.4) * 0.22); particle.scale.setScalar(0.5 + f); });
    drops.forEach((drop, i) => { const f = (state.time * 0.9 + i / 3) % 1; drop.visible = state.condensationRate > 1e-8; drop.position.set(1.35 + i * 0.18, reducedMotion || !running ? 2.3 : 2.57 - f * 0.35, 0.18); drop.scale.y = 1.5; });
    puddle.visible = state.spilled > 0;
    coil.material.emissive.setHex(0);
    canvas.setAttribute('aria-label', `汽化實驗裝置。水溫 ${state.temperature.toFixed(1)} °C，質量 ${mass} g，千瓦時計 ${kwh} kWh。${reading.boiling ? '水正在沸騰。' : ''}方向鍵旋轉，Home 重設。`);
    render();
  } };
}
globalThis.WaterVaporization3D = { mount };
