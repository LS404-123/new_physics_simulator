"use strict";
const M = ParticleModel;
const $ = (id) => document.getElementById(id);
let state = M.createState();
let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
let lastTime = 0, frame = 0;
const dots = state.particles.map(() => {
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("r", M.RADIUS); $("particles").append(dot); return dot;
});
function renderParticles() {
  state.particles.forEach((p, i) => {
    dots[i].setAttribute("cx", p.x); dots[i].setAttribute("cy", p.y);
  });
  $("ke").value = M.averageKinetic(state).toFixed(2);
}
function render() {
  const phase = M.PHASES[state.phase];
  $("phase-label").textContent = phase.label;
  $("phase-description").textContent = phase.description;
  $("scene").setAttribute("aria-label", `${phase.label}：${phase.description}粒子速率 ${state.speed.toFixed(2)}。`);
  $("speed").value = state.speed; $("speed-out").value = state.speed.toFixed(2);
  $("ke").value = M.averageKinetic(state).toFixed(2);
  $("ke-bar").style.width = `${M.averageKinetic(state) / 4 * 100}%`;
  $("pe").value = phase.potential; $("pe-bar").style.width = `${phase.bar}%`;
  document.querySelectorAll("[data-phase]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.phase === state.phase)));
  document.querySelectorAll("[data-order]").forEach(label => label.classList.toggle("active", label.dataset.order === state.phase));
  const matter = $("matter");
  const box = state.phase === "solid" ? [241,104.5,218,218] : [148,207,404,175];
  dots.forEach(dot => dot.setAttribute("r", state.phase === "solid" ? 13 : M.RADIUS));
  ["x","y","width","height"].forEach((key,i) => matter.setAttribute(key, box[i]));
  matter.style.display = state.phase === "gas" ? "none" : "";
  $("play").textContent = playing ? "Ⅱ 暫停" : "▶ 播放";
  $("status").textContent = !playing ? "已暫停" : state.speed === 0 ? "速率為零" : "運動中";
  renderParticles();
}
function animate(time) {
  if (!playing) return;
  M.step(state, (time - lastTime) / 1000); lastTime = time;
  renderParticles(); frame = requestAnimationFrame(animate);
}
function play(value) {
  playing = value; cancelAnimationFrame(frame);
  if (playing) { lastTime = performance.now(); frame = requestAnimationFrame(animate); }
  render();
}
$("speed").addEventListener("input", () => { M.setSpeed(state, Number($("speed").value)); render(); });
document.querySelectorAll("[data-phase]").forEach(button => button.addEventListener("click", () => {
  state = M.createState(button.dataset.phase, state.speed); render();
}));
$("play").addEventListener("click", () => play(!playing));
$("reset").addEventListener("click", () => { state = M.createState(); play(!matchMedia("(prefers-reduced-motion: reduce)").matches); });
document.addEventListener("visibilitychange", () => { if (document.hidden) play(false); });
play(playing);
