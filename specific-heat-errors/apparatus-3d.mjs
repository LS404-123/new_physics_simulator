import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createApparatus } from './apparatus-model.mjs';
import { DIGITS, liquidColumnPose, heatArrowPose } from './apparatus-display.mjs';

export function apparatusOptions(config) {
  return {
    sample: config.material,
    cupType: config.material === 'water' && config.error === 'apparatus' && !config.corrected ? 'glass' : 'polystyrene',
    depth: 'full',
    lid: config.error !== 'loss' || config.corrected,
  };
}

export function apparatusLabels(config) {
  const { sample, cupType, lid } = apparatusOptions(config);
  if (sample === 'water') return [
    { text: lid ? '有杯蓋' : '無杯蓋', anchor: [1.65, lid ? 1.99 : 1.9, 0.3], offset: [65, -58] },
    { text: cupType === 'glass' ? '玻璃杯' : '聚苯乙烯杯', anchor: [1.86, 0.95, 0.25], offset: [85, 14] },
    ...(config.error === 'uneven' ? [{ text: config.corrected ? '攪拌棒・關掣後攪拌' : '攪拌棒・不攪拌', anchor: [1.165, 2.62, 0.045], offset: [-178, -55] }] : []),
  ];
  return [
    { text: lid ? '棉絮包裹' : '未包棉絮', anchor: [1.92, 1.08, 0.3], offset: [80, -30] },
    { text: lid ? '聚苯乙烯墊' : '無隔熱墊', anchor: [1.97, 0.04, 0.4], offset: [75, 34] },
    ...(config.error === 'apparatus' ? [{ text: '電熱器也吸熱', anchor: [1.48, 2.22, -0.055], offset: [-160, -55] }] : []),
    ...(config.error === 'uneven' ? [{ text: '遠端溫度計', anchor: [1.805, 2.75, 0.03], offset: [60, -42] }] : []),
  ];
}

export function makeApparatus(config) {
  const options = apparatusOptions(config);
  const model = createApparatus(options.cupType, options.depth, true, options.sample);
  for (const name of options.sample === 'metal' ? ['金屬塊後半', '金屬塊前半剖視', '金屬塊頂面', '金屬塊底面', '金屬塊實心剖面'] : ['杯中液體']) {
    const part = model.getObjectByName(name);
    part.material.color.setHex(0xffffff);
    part.material.vertexColors = true;
    part.geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(part.geometry.attributes.position.count * 3), 3));
  }
  const apparatusFlow = new T.Group();
  apparatusFlow.name = '器材吸熱箭嘴';
  for (const angle of [0, Math.PI * 1.15]) {
    const arrow = new T.ArrowHelper(new T.Vector3(0, 1, 0), new T.Vector3(), 0.17, 0xb88627, 0.06, 0.04);
    arrow.userData = {
      from: options.sample === 'metal' ? [1.21, 1.35, 0.13] : [1.48 + 0.18 * Math.cos(angle), 1.1, 0.18 * Math.sin(angle)],
      to: options.sample === 'metal' ? [1.48, 1.35, -0.055] : [1.48 + 0.43 * Math.cos(angle), 1.1, 0.43 * Math.sin(angle)],
      offset: angle / (2 * Math.PI), flow: 'apparatusPower',
    };
    for (const part of arrow.children) {
      part.renderOrder = 4;
      part.material.transparent = true;
      part.material.depthWrite = false;
      part.material.toneMapped = false;
    }
    apparatusFlow.add(arrow);
  }
  model.add(apparatusFlow);
  return model;
}

// 只將原模擬狀態映射到造型；沒有另開計時器或熱學模型。
export function syncApparatus(model, state, reading, { power, room, stirring, reducedMotion }) {
  const config = state.config;
  const options = apparatusOptions(config);
  if (options.sample === 'metal') model.getObjectByName('金屬塊隔熱材料').visible = options.lid;
  else for (const name of ['杯蓋', '杯蓋前半剖視', '電熱器絕緣底座', '攪拌棒孔環', '溫度計孔環']) model.getObjectByName(name).visible = options.lid;
  const digits = String(Math.round(state.input)).padStart(5, '0');
  for (let digit = 0; digit < 5; digit++) for (let segment = 0; segment < 7; segment++) {
    model.getObjectByName(`計數器_${digit}_${segment}`).scale.setScalar(Number(DIGITS[Number(digits[digit])][segment]));
  }
  model.getObjectByName('焦耳計水平圓盤').rotation.y = reducedMotion ? 0 : state.input / 1000 * Math.PI * 2;
  const column = model.getObjectByName('紅色液柱');
  const pose = liquidColumnPose(reading.temperature);
  column.scale.y = pose.height;
  column.position.y = pose.y;
  const stirrer = model.getObjectByName('攪拌棒活動部分');
  if (stirrer) stirrer.position.y = stirring && !reducedMotion ? 0.08 * (1 - Math.cos(state.time * 0.35)) : 0;

  const colorAt = temperature => {
    const amount = T.MathUtils.clamp((temperature - room) / 16, 0, 1);
    if (options.sample === 'metal') return new T.Color().setRGB((184 + 56 * amount) / 255, (193 - 62 * amount) / 255, (195 - 110 * amount) / 255, T.SRGBColorSpace);
    return new T.Color().setRGB((152 + 98 * amount) / 255, (213 - 88 * amount) / 255, (231 - 141 * amount) / 255, T.SRGBColorSpace);
  };
  const near = colorAt(state.mean + state.spread), far = colorAt(state.mean - state.spread);
  const color = new T.Color();
  for (const name of options.sample === 'metal' ? ['金屬塊後半', '金屬塊前半剖視', '金屬塊頂面', '金屬塊底面', '金屬塊實心剖面'] : ['杯中液體']) {
    const sample = model.getObjectByName(name);
    const positions = sample.geometry.attributes.position, colors = sample.geometry.attributes.color;
    for (let i = 0; i < positions.count; i++) {
      color.copy(near).lerp(far, T.MathUtils.clamp((positions.getX(i) + 0.15) / 0.48, 0, 1));
      colors.setXYZ(i, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
  }
  const inputPower = state.time > 0 && reading.heating ? power : 0;
  const lossPower = config.conductance * (state.mean - room);
  const delivered = inputPower * config.efficiency;
  const apparatusPower = config.apparatusC / (config.mass * config.c + config.apparatusC) * (delivered - lossPower);
  const flowState = {
    time: reducedMotion ? 0.7 : state.time / 10,
    heaterPower: delivered - apparatusPower,
    lossPower, exposedLossPower: inputPower - delivered, apparatusPower,
  };
  for (const group of ['熱流箭嘴', '器材吸熱箭嘴']) for (const arrow of model.getObjectByName(group).children) {
    const next = heatArrowPose(flowState, arrow.userData);
    arrow.position.fromArray(next.position);
    arrow.scale.setScalar(next.scale);
    arrow.quaternion.fromArray(next.rotation);
  }
}

function mount(host) {
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xf5f9f9);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '比熱容量三維裝置；單指旋轉、雙指平移及捏合縮放，雙擊或 Home 重設視角。');
  host.append(canvas);
  const labelLayer = document.createElement('div');
  labelLayer.className = 'apparatus-labels';
  labelLayer.setAttribute('role', 'list');
  labelLayer.setAttribute('aria-label', '器材狀態標籤');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  labelLayer.append(svg);
  host.append(labelLayer);
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.8;
  room.dispose(); pmrem.dispose();
  scene.add(new T.HemisphereLight(0xeaf6ff, 0x777569, 0.8));
  const key = new T.DirectionalLight(0xfff5e8, 2.4);
  key.position.set(-0.4, 0.8, 0.55);
  scene.add(key);
  const rim = new T.DirectionalLight(0xe8f4ff, 1.4);
  rim.position.set(0.5, 0.5, -0.4);
  scene.add(rim);
  const camera = new T.PerspectiveCamera(34, 1, 0.01, 20);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = true;
  controls.touches.ONE = T.TOUCH.ROTATE;
  controls.touches.TWO = T.TOUCH.DOLLY_PAN;
  controls.minDistance = 0.3;
  controls.maxDistance = 2.6;
  controls.maxPolarAngle = Math.PI * 0.51;
  controls.minPolarAngle = 0.06;
  controls.rotateSpeed = 0.7;
  let model, modelKey = '', width = 0, height = 0;
  let labels = [], labelKey = '';
  function updateLabels(config) {
    const definitions = apparatusLabels(config);
    const key = JSON.stringify(definitions);
    if (key === labelKey) return;
    for (const label of labels) label.element.remove();
    svg.replaceChildren();
    labels = definitions.map(definition => {
      const element = document.createElement('div');
      element.className = 'apparatus-label';
      element.setAttribute('role', 'listitem');
      element.textContent = definition.text;
      labelLayer.append(element);
      const line = document.createElementNS(svg.namespaceURI, 'polyline');
      const dot = document.createElementNS(svg.namespaceURI, 'circle');
      dot.setAttribute('r', '2.5');
      svg.append(line, dot);
      return { ...definition, anchor: new T.Vector3(...definition.anchor), element, line, dot };
    });
    labelKey = key;
  }
  const projected = new T.Vector3();
  const render = () => {
    renderer.render(scene, camera);
    if (!model || !width || !height) return;
    for (const label of labels) {
      projected.copy(label.anchor).applyMatrix4(model.matrixWorld).project(camera);
      const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
      const hidden = projected.z < -1 || projected.z > 1 || x < 0 || x > width || y < 0 || y > height;
      label.element.hidden = hidden;
      label.line.style.display = label.dot.style.display = hidden ? 'none' : '';
      if (hidden) continue;
      const w = label.element.offsetWidth, h = label.element.offsetHeight;
      const left = T.MathUtils.clamp(x + label.offset[0], 8, width - w - 8);
      const top = T.MathUtils.clamp(y + label.offset[1], 8, height - h - 8);
      label.element.style.transform = `translate(${left}px,${top}px)`;
      const endX = x < left ? left : left + w, endY = top + h / 2;
      label.line.setAttribute('points', `${x},${y} ${endX + (x < left ? -10 : 10)},${endY} ${endX},${endY}`);
      label.dot.setAttribute('cx', x);
      label.dot.setAttribute('cy', y);
    }
  };
  function resetView() {
    const scale = 0.88 * Math.max(1, 1.4 / camera.aspect);
    controls.target.set(-0.07, 0.16, 0);
    camera.position.set(-0.07 - 0.46 * scale, 0.16 + 0.28 * scale, 0.81 * scale);
    controls.update();
    render();
  }
  function resize() {
    const nextWidth = host.clientWidth, nextHeight = host.clientHeight;
    if (!nextWidth || !nextHeight || (width === nextWidth && height === nextHeight)) return;
    width = nextWidth; height = nextHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    resetView();
  }
  controls.addEventListener('change', render);
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
    event.preventDefault();
    spherical.phi = T.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    spherical.radius = T.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(spherical));
    controls.update();
  });
  new ResizeObserver(resize).observe(host);
  resize();
  return {
    resetView,
    update(state, reading, options) {
      const selected = apparatusOptions(state.config);
      const nextKey = `${selected.sample}/${selected.cupType}/${selected.depth}`;
      if (nextKey !== modelKey) {
        if (model) {
          scene.remove(model);
          model.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
        }
        model = makeApparatus(state.config);
        scene.add(model);
        modelKey = nextKey;
      }
      syncApparatus(model, state, reading, options);
      updateLabels(state.config);
      canvas.setAttribute('aria-label', `${selected.sample === 'metal' ? '金屬塊' : '液體'}比熱容量三維裝置。焦耳計 ${Math.round(state.input)} J，溫度計 ${reading.temperature.toFixed(1)} °C。單指旋轉、雙指平移及捏合縮放，雙擊或 Home 重設視角。`);
      resize(); render();
    },
  };
}

globalThis.SpecificHeat3D = { mount };
