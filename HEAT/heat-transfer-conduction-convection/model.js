(function (root, factory) {
  const model = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  else root.HeatTransferModel = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ROOM_TEMPERATURE = 20;
  const REFERENCE_DENSITY = 1000;
  const EXPANSION_COEFFICIENT = 0.00021;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function densityAt(temperature) {
    return REFERENCE_DENSITY * (1 - EXPANSION_COEFFICIENT * (temperature - ROOM_TEMPERATURE));
  }

  function waterDensityAt(temperature) {
    const value = clamp(temperature, 0, 100);
    return 1000 * (1 - (value + 288.9414) / (508929.2 * (value + 68.12963)) * (value - 3.9863) ** 2);
  }

  // 建立 36 x 24 歐拉連續流體熱場網格
  function createFluidGrid(nx = 36, ny = 24) {
    return {
      nx,
      ny,
      u: new Float32Array((nx + 1) * ny), // 水平流速 (垂直面)
      v: new Float32Array(nx * (ny + 1)), // 垂直流速 (水平面)
      temp: new Float32Array(nx * ny).fill(ROOM_TEMPERATURE), // 晶格溫度
      tempNew: new Float32Array(nx * ny).fill(ROOM_TEMPERATURE)
    };
  }

  // 建立流體示蹤粒子群（預設 200 顆）
  function createFluidParticles(count = 200) {
    const particles = [];
    for (let i = 0; i < count; i += 1) {
      const maxLife = 3.5 + Math.random() * 2.5;
      const life = Math.random() * maxLife;
      particles.push({
        id: i,
        x: 0.06 + Math.random() * 0.88,
        y: 0.07 + Math.random() * 0.86,
        life,
        maxLife,
        alpha: 1.0,
        temperature: ROOM_TEMPERATURE,
        velocity: { x: 0, y: 0 }
      });
    }
    return particles;
  }

  function thermalMotionAmplitude(temperature) {
    return 0.35 + 1.25 * clamp((temperature - ROOM_TEMPERATURE) / 40, 0, 1);
  }

  // 固體微觀晶格熱傳導模型
  function stepConduction(lattice, heaterPower, dt, time) {
    const { columns, rows } = lattice;
    const displacements = lattice.displacements.slice();
    const velocities = lattice.velocities.slice();
    const temperatures = lattice.temperatures.slice();
    const nextTemperatures = temperatures.slice();
    const interactions = [];

    for (let row = 0; row < rows; row += 1) {
      const first = row * columns;
      nextTemperatures[first] += clamp(heaterPower, 0, 1) * 22 * dt;
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        const thermalLevel = clamp((nextTemperatures[index] - ROOM_TEMPERATURE) / 80, 0, 1);
        if (column === 0) {
          const phase = time * 4.2 + row * 0.18;
          const amplitude = thermalLevel * 7.8;
          displacements[index] = amplitude * Math.sin(phase);
          velocities[index] = amplitude * 4.2 * Math.cos(phase);
        } else {
          const acceleration = -6 * displacements[index] - 0.9 * displacements[index] ** 3 - 0.15 * velocities[index];
          velocities[index] += acceleration * dt;
          displacements[index] += velocities[index] * dt;
        }
      }
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns - 1; column += 1) {
        const left = row * columns + column;
        const right = left + 1;
        const approach = displacements[left] - displacements[right];
        if (approach >= 0.2) {
          const energy = (temperatures[left] - temperatures[right]) * 3.6 * dt;
          nextTemperatures[left] -= energy;
          nextTemperatures[right] += energy;
        }
        if (approach >= 1.8 && velocities[left] > velocities[right]) {
          const impulse = velocities[left] - velocities[right];
          velocities[left] -= impulse;
          velocities[right] += impulse;
          interactions.push({ row, column });
        }
      }
    }

    return {
      displacements,
      velocities,
      temperatures: nextTemperatures.map((t) => clamp(t, ROOM_TEMPERATURE, 100)),
      interactions
    };
  }

  // 雙線性溫度插值採樣
  function sampleGridTemp(temp, nx, ny, gx, gy) {
    const cx = clamp(gx, 0, nx - 1);
    const cy = clamp(gy, 0, ny - 1);
    const x0 = Math.floor(cx), y0 = Math.floor(cy);
    const x1 = Math.min(x0 + 1, nx - 1), y1 = Math.min(y0 + 1, ny - 1);
    const fx = cx - x0, fy = cy - y0;
    const t00 = temp[y0 * nx + x0];
    const t10 = temp[y0 * nx + x1];
    const t01 = temp[y1 * nx + x0];
    const t11 = temp[y1 * nx + x1];
    return (1 - fy) * ((1 - fx) * t00 + fx * t10) + fy * ((1 - fx) * t01 + fx * t11);
  }

  // 雙線性速度插值採樣 (修正變數名 cy -> gy)
  function sampleGridVelocity(grid, x, y) {
    const { nx, ny, u, v } = grid;
    const gx = clamp(x * nx - 0.5, 0, nx - 1);
    const gy = clamp(y * ny - 0.5, 0, ny - 1);
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, nx - 1), y1 = Math.min(y0 + 1, ny - 1);
    const fx = gx - x0, fy = gy - y0;

    const u00 = u[y0 * (nx + 1) + x0], u10 = u[y0 * (nx + 1) + (x0 + 1)];
    const u01 = u[y1 * (nx + 1) + x0], u11 = u[y1 * (nx + 1) + (x0 + 1)];
    const vx = (1 - fy) * ((1 - fx) * u00 + fx * u10) + fy * ((1 - fx) * u01 + fx * u11);

    const v00 = v[y0 * nx + x0], v10 = v[y0 * nx + x1];
    const v01 = v[(y0 + 1) * nx + x0], v11 = v[(y0 + 1) * nx + x1];
    const vy = (1 - fy) * ((1 - fx) * v00 + fx * v10) + fy * ((1 - fx) * v01 + fx * v11);

    return { vx, vy };
  }

  // 第一性原理流體求解 + RK4 示蹤粒子雙向耦合
  function stepContinuousFluid(grid, particles, heaterPower, dt) {
    if (!grid) grid = createFluidGrid(36, 24);
    if (!particles || !particles.length) particles = createFluidParticles(200);

    const { nx, ny, u, v, temp, tempNew } = grid;
    const timeStep = clamp(dt, 0, 0.04);
    const subSteps = 2;
    const sdt = timeStep / subSteps;

    for (let step = 0; step < subSteps; step += 1) {
      // 1. 全場平均水溫
      let sumTemp = 0;
      for (let i = 0; i < nx * ny; i += 1) sumTemp += temp[i];
      const avgTemp = sumTemp / (nx * ny);

      // 2. 底部熱源注入與頂部自然散熱
      const heaterMinX = Math.floor(nx * 0.35);
      const heaterMaxX = Math.ceil(nx * 0.65);
      const heaterMinY = Math.floor(ny * 0.80);

      for (let y = 0; y < ny; y += 1) {
        for (let x = 0; x < nx; x += 1) {
          const idx = y * nx + x;
          let t = temp[idx];

          if (y >= heaterMinY && x >= heaterMinX && x <= heaterMaxX) {
            const distFromCenter = Math.abs(x - (nx - 1) / 2) / ((heaterMaxX - heaterMinX) / 2);
            const prox = (1 - distFromCenter) * ((y - heaterMinY) / (ny - 1 - heaterMinY));
            t += (38 * clamp(heaterPower, 0, 1) + 2) * prox * sdt;
          }

          if (y === 0) {
            t -= 0.05 * (t - ROOM_TEMPERATURE) * sdt;
          }
          temp[idx] = clamp(t, ROOM_TEMPERATURE, 95);
        }
      }

      // 3. 熱平流 (Semi-Lagrangian Advection)
      for (let y = 0; y < ny; y += 1) {
        for (let x = 0; x < nx; x += 1) {
          const idx = y * nx + x;
          const uc = 0.5 * (u[y * (nx + 1) + x] + u[y * (nx + 1) + (x + 1)]) * nx;
          const vc = 0.5 * (v[y * nx + x] + v[(y + 1) * nx + x]) * ny;

          const srcX = x - uc * sdt;
          const srcY = y - vc * sdt;

          tempNew[idx] = sampleGridTemp(temp, nx, ny, srcX, srcY);
        }
      }

      // 4. 熱擴散 (Thermal Diffusion)
      const diffRate = 0.18;
      for (let y = 0; y < ny; y += 1) {
        for (let x = 0; x < nx; x += 1) {
          const idx = y * nx + x;
          const left = x > 0 ? tempNew[idx - 1] : tempNew[idx];
          const right = x < nx - 1 ? tempNew[idx + 1] : tempNew[idx];
          const up = y > 0 ? tempNew[idx - nx] : tempNew[idx];
          const down = y < ny - 1 ? tempNew[idx + nx] : tempNew[idx];
          const laplacian = left + right + up + down - 4 * tempNew[idx];
          temp[idx] = clamp(tempNew[idx] + diffRate * laplacian * sdt, ROOM_TEMPERATURE, 95);
        }
      }

      // 5. 浮力加速度 (Boussinesq Buoyancy: dv/dt = - beta * (T - T_avg) * g)
      const buoyancyConst = 0.55;
      for (let y = 1; y < ny; y += 1) {
        for (let x = 0; x < nx; x += 1) {
          const vIdx = y * nx + x;
          const tFace = 0.5 * (temp[(y - 1) * nx + x] + temp[y * nx + x]);
          const aY = -buoyancyConst * ((tFace - avgTemp) / 12);
          v[vIdx] += aY * sdt;
          v[vIdx] *= (1 - 0.35 * sdt);
        }
      }

      for (let y = 0; y < ny; y += 1) {
        for (let x = 1; x < nx; x += 1) {
          const uIdx = y * (nx + 1) + x;
          u[uIdx] *= (1 - 0.35 * sdt);
        }
      }

      // 邊界條件：四壁不可穿透
      for (let y = 0; y < ny; y += 1) {
        u[y * (nx + 1) + 0] = 0;
        u[y * (nx + 1) + nx] = 0;
      }
      for (let x = 0; x < nx; x += 1) {
        v[0 * nx + x] = 0;
        v[ny * nx + x] = 0;
      }

      // 6. 壓力泊松投影（Gauss-Seidel 壓力求解消除散度，div(u)=0）
      const iterations = 22;
      for (let iter = 0; iter < iterations; iter += 1) {
        for (let y = 0; y < ny; y += 1) {
          for (let x = 0; x < nx; x += 1) {
            const uL = u[y * (nx + 1) + x];
            const uR = u[y * (nx + 1) + (x + 1)];
            const vT = v[y * nx + x];
            const vB = v[(y + 1) * nx + x];

            const div = (uR - uL) + (vB - vT);

            let openNeighbors = 4;
            if (x === 0) openNeighbors -= 1;
            if (x === nx - 1) openNeighbors -= 1;
            if (y === 0) openNeighbors -= 1;
            if (y === ny - 1) openNeighbors -= 1;

            if (openNeighbors > 0) {
              const delta = div / openNeighbors;
              if (x > 0) u[y * (nx + 1) + x] += delta;
              if (x < nx - 1) u[y * (nx + 1) + (x + 1)] -= delta;
              if (y > 0) v[y * nx + x] += delta;
              if (y < ny - 1) v[(y + 1) * nx + x] -= delta;
            }
          }
        }
      }
    }

    // 7. RK4 高階示蹤粒子位移、溫度採樣與平滑淡入淡出 (Fade-in/Fade-out)
    const updatedParticles = particles.map((p) => {
      // 4階 Runge-Kutta 速度場採樣
      const k1 = sampleGridVelocity(grid, p.x, p.y);
      const k2 = sampleGridVelocity(grid, p.x + 0.5 * timeStep * k1.vx, p.y + 0.5 * timeStep * k1.vy);
      const k3 = sampleGridVelocity(grid, p.x + 0.5 * timeStep * k2.vx, p.y + 0.5 * timeStep * k2.vy);
      const k4 = sampleGridVelocity(grid, p.x + timeStep * k3.vx, p.y + timeStep * k3.vy);

      const vx = (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx) / 6;
      const vy = (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy) / 6;

      let nxPos = p.x + vx * timeStep;
      let nyPos = p.y + vy * timeStep;
      let life = p.life + timeStep;
      let maxLife = p.maxLife || 4.5;

      // 壽命到期或超出邊界時，平滑重新播種
      if (life >= maxLife || nxPos < 0.05 || nxPos > 0.95 || nyPos < 0.06 || nyPos > 0.94) {
        nxPos = 0.06 + Math.random() * 0.88;
        nyPos = 0.07 + Math.random() * 0.86;
        life = 0;
        maxLife = 3.5 + Math.random() * 2.5;
      }

      // 計算平滑淡入淡出透明度 (Fade-in 在前 20%，Fade-out 在後 20%)
      const ratio = life / maxLife;
      let alpha = 1.0;
      if (ratio < 0.20) {
        alpha = ratio / 0.20;
      } else if (ratio > 0.80) {
        alpha = (1.0 - ratio) / 0.20;
      }
      alpha = clamp(alpha, 0, 1);

      // 精確採樣當地流體真實溫度
      const gx = nxPos * nx - 0.5;
      const gy = nyPos * ny - 0.5;
      const localTemp = sampleGridTemp(temp, nx, ny, gx, gy);

      return {
        ...p,
        x: nxPos,
        y: nyPos,
        life,
        maxLife,
        alpha,
        temperature: localTemp,
        velocity: { x: vx, y: vy }
      };
    });

    return { grid, particles: updatedParticles };
  }

  return {
    ROOM_TEMPERATURE,
    REFERENCE_DENSITY,
    EXPANSION_COEFFICIENT,
    clamp,
    densityAt,
    waterDensityAt,
    createFluidGrid,
    createFluidParticles,
    sampleGridTemp,
    sampleGridVelocity,
    thermalMotionAmplitude,
    stepConduction,
    stepContinuousFluid
  };
});
