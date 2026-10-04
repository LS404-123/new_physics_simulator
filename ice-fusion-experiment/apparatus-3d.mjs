import * as T from '../specific-heat-errors/node_modules/three/build/three.module.js';
import { OrbitControls } from '../specific-heat-errors/node_modules/three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from '../specific-heat-errors/node_modules/three/examples/jsm/environments/RoomEnvironment.js';
import { createApparatus } from '../specific-heat-errors/apparatus-model.mjs';
import { DIGITS } from '../specific-heat-errors/apparatus-display.mjs';

function mount(host) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xf4f8f8, 1);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  host.append(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0; canvas.setAttribute('role', 'img');
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(34, 1, 0.1, 100);
  const pmrem = new T.PMREMGenerator(renderer), environment = new RoomEnvironment();
  scene.environment = pmrem.fromScene(environment, 0.04).texture;
  environment.dispose(); pmrem.dispose();
  scene.add(new T.HemisphereLight(0xeaf6ff, 0x777569, 1.2));
  const light = new T.DirectionalLight(0xfff5e8, 3); light.position.set(-3, 8, 6); scene.add(light);
  const rim = new T.DirectionalLight(0xe8f4ff, 1.5); rim.position.set(4, 4, -4); scene.add(rim);
  const metal = new T.MeshStandardMaterial({ color: 0xa7b6b8, metalness: 0.75, roughness: 0.28 });
  const dark = new T.MeshStandardMaterial({ color: 0x344b54, roughness: 0.5 });
  const glass = new T.MeshPhysicalMaterial({ color: 0x87b6c6, roughness: 0.16, transparent: true, opacity: 0.35, depthWrite: false, side: T.DoubleSide });
  const water = new T.MeshStandardMaterial({ color: 0x69c3df, transparent: true, opacity: 0.65, depthWrite: false });
  const dropBlue = new T.MeshBasicMaterial({ color: 0x1565c0 });
  const ice = new T.MeshPhysicalMaterial({ color: 0xd5eff5, roughness: 0.24, metalness: 0.08 });
  function mesh(geometry, material, position, parent = scene) {
    const object = new T.Mesh(geometry, material); object.position.set(...position); parent.add(object); return object;
  }
  function cylinder(rt, rb, h, position, material, parent = scene, open = false) { return mesh(new T.CylinderGeometry(rt, rb, h, 40, 1, open), material, position, parent); }
  function box(size, position, material, parent = scene) { return mesh(new T.BoxGeometry(...size), material, position, parent); }
  function tube(points, radius, material, parent = scene) { return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 64, radius, 10), material, [0, 0, 0], parent); }
  // 重用舊版的焦耳計造型、字型與七段讀數；不修改舊實驗。
  const donor = createApparatus();
  const meter = donor.getObjectByName('焦耳計'); donor.remove(meter); meter.position.set(3.75, 0, 0.12); scene.add(meter);
  donor.traverse(object => { object.geometry?.dispose(); });
  box([1, 0.1, 1], [-0.85, 0.08, -0.3], metal);
  cylinder(0.045, 0.045, 3.25, [-0.85, 1.74, -0.3], metal);
  const assemblies = [];
  for (let index = 0; index < 2; index++) {
    const x = index === 0 ? -2.1 : 0.05, group = new T.Group(); scene.add(group); group.position.x = x;
    cylinder(0.62, 0.13, 0.65, [0, 2.77, 0], glass, group, true);
    const rim = mesh(new T.TorusGeometry(0.62, 0.018, 8, 48), metal, [0, 3.095, 0], group); rim.rotation.x = Math.PI / 2;
    cylinder(0.105, 0.105, 0.34, [0, 2.3, 0], glass, group, true);
    const neckRing = mesh(new T.TorusGeometry(0.19, 0.04, 8, 40), metal, [0, 2.46, 0], group); neckRing.rotation.x = Math.PI / 2;
    tube([[0, 2.46, -0.19], [-0.85 - x, 2.46, -0.3]], 0.035, metal, group);
    box([0.14, 0.18, 0.16], [-0.85 - x, 2.46, -0.3], dark, group);
    const wireMesh = new T.Group(); group.add(wireMesh);
    for (let i = -2; i <= 2; i++) {
      const v = i * 0.045, edge = Math.sqrt(0.12 ** 2 - v ** 2);
      tube([[-edge, 2.37, v], [edge, 2.37, v]], 0.006, metal, wireMesh);
      tube([[v, 2.37, -edge], [v, 2.37, edge]], 0.006, metal, wireMesh);
    }
    const crushed = new T.Group(), chunks = new T.Group(); group.add(crushed, chunks);
    for (const [container, count, size] of [[crushed, 58, 0.085], [chunks, 13, 0.16]]) {
      for (let i = 0; i < count; i++) {
        const layer = Math.floor(i / (count === 58 ? 18 : 5)), j = i % (count === 58 ? 18 : 5);
        const angle = i * 2.39996, radius = (0.26 + layer * 0.09) * Math.sqrt((j + 0.5) / (count === 58 ? 18 : 5));
        const piece = mesh(new T.IcosahedronGeometry(size, 0), ice, [radius * Math.cos(angle), 2.67 + layer * 0.14, radius * Math.sin(angle)], container);
        piece.rotation.set(i * 0.71, i * 0.37, i * 0.13);
      }
    }
    cylinder(0.085, 0.085, 0.36, [0, 3.34, 0], dark, group);
    cylinder(0.026, 0.026, 0.62, [-0.045, 3.01, 0], metal, group);
    cylinder(0.026, 0.026, 0.62, [0.045, 3.01, 0], metal, group);
    const coil = tube([[-0.045, 2.74, 0], [-0.19, 2.75, 0], [-0.19, 2.86, 0.08], [0.19, 2.86, 0.08], [0.19, 2.74, 0], [0.045, 2.74, 0]], 0.026, metal.clone(), group);
    if (!index) {
      for (let i = -1; i <= 1; i += 2) tube([[i * 0.03, 3.5, 0], [-0.2 + i * 0.03, 3.7, 0], [-0.6, 3.6, 0], [-0.72, 2.6, 0.12]], 0.017, dark, group);
    }
    const beaker = new T.Group(); group.add(beaker);
    cylinder(0.43, 0.4, 0.77, [0, 0.71, 0], glass, beaker, true);
    cylinder(0.4, 0.4, 0.022, [0, 0.335, 0], glass, beaker);
    const lip = mesh(new T.TorusGeometry(0.43, 0.018, 8, 40), glass, [0, 1.095, 0], beaker); lip.rotation.x = Math.PI / 2;
    for (let j = 1; j <= 3; j++) tube([[-0.13, 0.43 + j * 0.17, 0.393], [0.1, 0.43 + j * 0.17, 0.414]], 0.006, metal, beaker);
    const liquid = cylinder(0.385, 0.38, 1, [0, 0.36, 0], water, beaker);
    const fallen = mesh(new T.IcosahedronGeometry(0.09), ice, [0.07, 0.41, 0], beaker);
    const balance = new T.Group(); beaker.add(balance);
    box([1.05, 0.16, 0.95], [0, 0.16, 0], dark, balance); box([0.82, 0.06, 0.7], [0, 0.27, 0], metal, balance);
    box([0.54, 0.1, 0.01], [0, 0.17, 0.481], new T.MeshStandardMaterial({ color: 0xbcd8c7 }), balance);
    const drop = mesh(new T.SphereGeometry(0.035, 12, 8), dropBlue, [0, 1.65, 0], group); drop.scale.y = 1.5;
    assemblies.push({ group, wireMesh, crushed, chunks, coil, beaker, balance, liquid, fallen, drop });
  }
  for (let i = 0; i < 2; i++) {
    tube([[2.65 + i * 0.18, 0.61, 0.57], [2.2, 1.05, 0], [1.1, 1.6, -0.35], [0.85, 3.35, -0.35], [0.35, 3.7, 0], [0.05 + i * 0.05, 3.5, 0]], 0.025, dark);
    tube([[2.11 + i * 0.18, 0.61, 0.57], [2.0, 0.6, 0.9], [2.55, 0.15, 1.3], [3.25, 0.08, 1.4]], 0.025, dark);
  }
  const labelsLayer = document.createElement('div'); labelsLayer.className = 'labels'; host.append(labelsLayer);
  const labels = [['A · 對照裝置', [-2.1, 3.1, 0], -58, -48], ['B · 實驗裝置', [0.05, 3.1, 0], -55, -48], ['焦耳計', [2.35, 2.6, 0.5], -22, -32], ['燒杯 A', [-2.1, 0.65, 0], -28, 18], ['燒杯 B', [0.05, 0.65, 0], -28, 18], ['接 12 V 電源（圖外）', [3.25, 0.08, 1.4], -105, 0]].map(([text, position, dx, dy]) => {
    const element = document.createElement('div'); element.className = 'apparatus-label'; element.textContent = text; labelsLayer.append(element);
    return { element, position: new T.Vector3(...position), dx, dy };
  });
  const controls = new OrbitControls(camera, canvas);
  controls.minDistance = 7; controls.maxDistance = 25; controls.maxPolarAngle = Math.PI * 0.53;
  controls.touches.ONE = T.TOUCH.ROTATE; controls.touches.TWO = T.TOUCH.DOLLY_PAN;
  let width = 0, height = 0;
  function render() {
    renderer.render(scene, camera);
    for (const label of labels) {
      const projected = label.position.clone().project(camera);
      label.element.style.transform = `translate(${T.MathUtils.clamp((projected.x + 1) * width / 2 + label.dx, 5, width - label.element.offsetWidth - 5)}px,${T.MathUtils.clamp((1 - projected.y) * height / 2 + label.dy, 5, height - label.element.offsetHeight - 5)}px)`;
    }
  }
  function resetView() {
    controls.target.set(0.15, 1.95, 0);
    const scale = Math.max(1, 2 / camera.aspect);
    camera.position.set(0.15 - 2 * scale, 1.95 + 2.8 * scale, 8.3 * scale); controls.update(); render();
  }
  function resize() { width = host.clientWidth; height = host.clientHeight; if (!width || !height) return; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height); resetView(); }
  new ResizeObserver(resize).observe(host); controls.addEventListener('change', render);
  canvas.addEventListener('dblclick', resetView);
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Home') { event.preventDefault(); resetView(); return; }
    const spherical = new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (event.key === 'ArrowLeft') spherical.theta -= 0.1;
    else if (event.key === 'ArrowRight') spherical.theta += 0.1;
    else if (event.key === 'ArrowUp') spherical.phi -= 0.1;
    else if (event.key === 'ArrowDown') spherical.phi += 0.1;
    else if (event.key === '+' || event.key === '=') spherical.radius *= 0.9;
    else if (event.key === '-') spherical.radius *= 1.1;
    else return;
    event.preventDefault(); spherical.phi = T.MathUtils.clamp(spherical.phi, 0.08, controls.maxPolarAngle); spherical.radius = T.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(spherical)); controls.update();
  });
  resize();
  return { resetView, update(state, reading, { running, reducedMotion }) {
    const digits = String(reading.input).padStart(5, '0');
    for (let digit = 0; digit < 5; digit++) for (let segment = 0; segment < 7; segment++) meter.getObjectByName(`計數器_${digit}_${segment}`).visible = Boolean(Number(DIGITS[Number(digits[digit])][segment]));
    meter.getObjectByName('焦耳計水平圓盤').rotation.y = reducedMotion ? 0 : state.input / 1000 * Math.PI * 2;
    assemblies.forEach((assembly, index) => {
      const funnel = index ? state.b : state.a;
      assembly.group.visible = index === 1 || state.config.control;
      assembly.wireMesh.visible = state.config.mesh;
      assembly.crushed.visible = state.config.crushed; assembly.chunks.visible = !state.config.crushed;
      const remaining = Math.max(0, 1 - (funnel.melted + funnel.solid) / 0.2);
      assembly.crushed.scale.setScalar(Math.cbrt(remaining)); assembly.chunks.scale.setScalar(Math.cbrt(remaining));
      assembly.crushed.position.y = assembly.chunks.position.y = 2.7 * (1 - Math.cbrt(remaining));
      const h = Math.max(0.001, funnel.collected / 0.06 * 0.6);
      assembly.liquid.scale.y = h; assembly.liquid.position.y = 0.35 + h / 2;
      assembly.fallen.visible = funnel.solid > 0;
      assembly.drop.visible = running && !reducedMotion && (index ? reading.rateB : reading.rateA) > 0.0000001;
      const period = 0.0004 / Math.max(0.0000001, index ? reading.rateB : reading.rateA);
      assembly.drop.position.y = 2.1 - 0.95 * ((state.time % period) / period) ** 2;
      assembly.coil.material.emissive.setHex(index && state.heater > 2 ? 0x9e3c12 : 0x000000);
      labels[index].element.hidden = index === 0 && !state.config.control;
      labels[index + 3].element.hidden = index === 0 && !state.config.control;
    });
    canvas.setAttribute('aria-label', `三維雙漏斗裝置。焦耳計 ${reading.input} J。${state.config.control ? 'A 為對照，' : ''}B 接電源加熱。單指旋轉、雙指縮放；方向鍵旋轉、Home 重設視角。`);
    render();
  } };
}
globalThis.IceFusion3D = { mount };
