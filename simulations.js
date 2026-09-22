(async function () {
  "use strict";

  function getCatalogueScrollState(catalogueTop, scrollY, dockTop) {
    const travel = Math.max(1, catalogueTop + scrollY - dockTop);
    const progress = Math.min(1, Math.max(0, scrollY / travel));
    return { progress };
  }

  function applyCardOrder(items, order) {
    const ranks = new Map();
    for (const href of Array.isArray(order) ? order : []) {
      if (typeof href === "string" && !ranks.has(href)) ranks.set(href, ranks.size);
    }
    return [...items].sort((a, b) =>
      (ranks.get(a.href) ?? ranks.size) - (ranks.get(b.href) ?? ranks.size));
  }

  function moveCardOrder(items, order, fromHref, toHref) {
    const ordered = applyCardOrder(items, order);
    const from = ordered.findIndex(item => item.href === fromHref);
    const to = ordered.findIndex(item => item.href === toHref);
    if (from >= 0 && to >= 0 && ordered[from].topic === ordered[to].topic) {
      ordered.splice(to, 0, ordered.splice(from, 1)[0]);
    }
    return ordered.map(item => item.href);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { getCatalogueScrollState, applyCardOrder, moveCardOrder };
    return;
  }

  // 新增模擬器：複製一筆資料至清單末尾，首頁會自動把它列為最新加入。
  const simulations = [
    {
      title: "溫度計校準與斜率",
      description: "利用兩個固定點建立液柱高度與溫度的線性關係，理解斜率是液柱高度的改變率。",
      topic: "熱與氣體",
      href: "./HEAT/thermometer-calibration-slope/index.html",
      image: "./HEAT/thermometer-calibration-slope/preview.png",
      tags: ["溫度", "溫度計", "校準", "固定點", "斜率"]
    },
    {
      title: "粒子能量實驗台",
      description: "比較質量、溫度與物態如何改變粒子的總動能、總勢能及物體內能。",
      topic: "熱與氣體",
      href: "./HEAT/internal-energy-particle-model/index.html",
      image: "./HEAT/internal-energy-particle-model/preview.png",
      tags: ["內能", "粒子模型", "動能", "勢能", "冰", "水"]
    },
    {
      title: "熱如何移動：傳導與對流",
      description: "觀察固體粒子逐粒推撞傳能，以及密度差配合重力形成的流體循環。",
      topic: "熱與氣體",
      href: "./HEAT/heat-transfer-conduction-convection/index.html",
      image: "./HEAT/heat-transfer-conduction-convection/preview.png",
      tags: ["熱傳", "傳導", "對流", "粒子推撞", "密度", "浮力"]
    },
    {
      title: "熱輻射收支：何時吸熱，何時放熱？",
      description: "比較物體放出、環境送入及淨輻射功率，判斷物體何時淨吸熱或淨放熱。",
      topic: "熱與氣體",
      href: "./HEAT/thermal-radiation-balance/index.html",
      image: "./HEAT/thermal-radiation-balance/preview.png",
      tags: ["熱輻射", "淨輻射", "吸收體", "輻射體", "Stefan-Boltzmann 定律", "熱平衡"]
    },
    {
      title: "用數據發現 Q = CΔT",
      description: "逐次量度兩個匿名樣本，以 Q 對 ΔT 圖及過原點最佳擬合線求出熱容量。",
      topic: "熱與氣體",
      href: "./HEAT/heat-capacity-data-experiment/index.html",
      image: "./HEAT/heat-capacity-data-experiment/preview.png",
      tags: ["熱容量", "電熱器", "實驗數據", "最佳擬合線", "斜率", "Q = CΔT"]
    },
    {
      title: "兩點校準：由電阻推算溫度",
      description: "只已知兩個固定點的電阻，用萬用錶量度電阻，再按校準直線推算溫度。",
      topic: "DSE問題",
      href: "./DSE/HEAT/resistance-thermometer-graph/index.html",
      image: "./DSE/HEAT/resistance-thermometer-graph/preview.png",
      tags: ["萬用錶", "校準", "推算溫度", "實際溫度", "非線性", "讀圖", "恆溫槽", "誤差"]
    },
    {
      title: "粒子動能與勢能",
      description: "用粒子速率比較平均動能，以固體、液體及氣體示意內部勢能的高低。",
      topic: "熱與氣體",
      href: "./HEAT/particle-ke-pe/index.html",
      image: "./HEAT/particle-ke-pe/preview.png",
      tags: ["粒子模型", "平均動能", "內部勢能", "速率", "物態", "固體", "液體", "氣體", "KE", "PE"]
    },
    {
      title: "比熱容量實驗：誤差看得見",
      description: "選擇水或金屬塊的實驗誤差，觀察裝置與比熱容量的偏差，再找出原因及預防措施。",
      topic: "熱與氣體",
      href: "./specific-heat-errors/index.html",
      image: "./specific-heat-errors/preview.png",
      tags: ["比熱容量", "實驗誤差", "預防措施", "焦耳計", "總供能", "溫升", "散熱", "攪拌"]
    },
    {
      title: "溫室裡的熱往哪裡去？",
      description: "跟著陽光與紅外線的路徑，觀察玻璃的吸收與再輻射，用能量收支解釋保溫為何仍會散熱。",
      topic: "熱與氣體",
      href: "./greenhouse-radiation/index.html",
      image: "./greenhouse-radiation/preview.png",
      tags: ["溫室", "玻璃", "紅外線", "吸收", "再輻射", "保溫", "散熱", "熱平衡", "greenhouse"]
    },
    {
      title: "熱容量與熱平衡",
      description: "改變鋁塊或冷茶與熱檸檬的初溫及質量，看溫度—熱量圖由兩端相遇，理解熱容量如何決定平衡溫度。",
      topic: "熱與氣體",
      href: "./thermal-equilibrium/index.html",
      image: "./thermal-equilibrium/preview.png",
      tags: ["熱平衡", "熱容量", "比熱容量", "質量", "平衡溫度", "能量守恆", "熱流", "T–Q", "溫度熱量圖"]
    },
    {
      title: "水的溫度與密度",
      description: "放大燒杯中的一小部分，調整 20–80°C 水溫，以 10 倍膨脹幅度觀察粒子向四周散開，以及固定範圍內的粒子數變化。",
      topic: "熱與氣體",
      href: "./water-density/index.html",
      image: "./water-density/preview.png",
      tags: ["密度", "水", "溫度", "熱膨脹", "粒子", "固定體積", "density"]
    }
  ];

  // 排序設定很小，每次開頁重新讀取，避免重新發布後仍沿用快取順序。
  await new Promise(resolve => {
    const script = document.createElement("script");
    script.src = "./catalogue-order.js?v=" + Date.now();
    script.onload = script.onerror = resolve;
    document.head.append(script);
  });

  const elements = {
    filters: document.querySelector("#filters"),
    groups: document.querySelector("#simulation-groups"),
    search: document.querySelector("#search"),
    status: document.querySelector("#result-status"),
    empty: document.querySelector("#empty-state"),
    clear: document.querySelector("#clear-search"),
    latest: document.querySelector("#latest-simulation"),
    header: document.querySelector(".site-header"),
    catalogue: document.querySelector("#catalogue"),
    catalogueHead: document.querySelector(".catalogue-head"),
  };

  const topics = ["熱與氣體", "力與運動", "DSE問題"];
  const editingOrder = new URLSearchParams(window.location.search).get("sort") === "1";
  let loadedOrder = Array.isArray(window.catalogueOrder) ? [...window.catalogueOrder] : [];
  let cardOrder = [...loadedOrder];
  let orderChanged = false;
  let selectedTopic = "全部";
  let scrollFrame = 0;

  function updateCatalogueScroll() {
    scrollFrame = 0;
    const catalogueRect = elements.catalogue.getBoundingClientRect();
    const dockTop = elements.header.offsetHeight;
    const state = getCatalogueScrollState(
      catalogueRect.top,
      window.scrollY,
      dockTop
    );
    document.documentElement.style.setProperty("--catalogue-dock-top", `${dockTop}px`);
    document.documentElement.style.setProperty("--catalogue-head-height", `${elements.catalogueHead.offsetHeight}px`);
    document.documentElement.style.setProperty("--stage-dim-opacity", (state.progress * 0.62).toFixed(3));
  }

  function queueCatalogueScrollUpdate() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateCatalogueScroll);
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createFilter(topic) {
    const count = topic === "全部"
      ? simulations.length
      : simulations.filter((simulation) => simulation.topic === topic).length;
    const button = createElement("button", "filter-button");
    button.type = "button";
    button.setAttribute("aria-pressed", String(topic === selectedTopic));
    button.append(
      createElement("span", "", topic === "全部" ? "全部模擬器" : topic),
      createElement("span", "topic-count", count)
    );
    button.addEventListener("click", () => {
      selectedTopic = topic;
      render();
    });
    return button;
  }

  function createCard(simulation) {
    const article = createElement("article", "simulation-card");
    const link = createElement("a");
    link.href = simulation.href;
    link.setAttribute("aria-label", `開啟「${simulation.title}」模擬器`);

    const preview = createElement("div", "preview");
    const image = document.createElement("img");
    image.src = simulation.image;
    image.alt = `${simulation.title}模擬器畫面預覽`;
    image.loading = "lazy";
    image.addEventListener("error", () => { image.hidden = true; }, { once: true });
    preview.append(image, createElement("span", "preview-fallback", simulation.topic));

    const body = createElement("div", "card-body");
    const meta = createElement("div", "card-meta");
    meta.append(createElement("span", "", simulation.topic), createElement("span", "", "互動模擬"));

    const title = createElement("h4", "", simulation.title);
    const description = createElement("p", "", simulation.description);
    const action = createElement("span", "card-action", "進入模擬器");
    body.append(meta, title, description, action);
    link.append(preview, body);
    article.append(link);
    if (editingOrder) addSortControls(article, simulation);
    return article;
  }

  function moveCard(fromHref, toHref, focusLabel) {
    cardOrder = moveCardOrder(simulations, cardOrder, fromHref, toHref);
    orderChanged = true;
    render();
    document.querySelector("#sort-status").textContent = document.querySelector("#save-order").disabled
      ? "順序已調整，尚未儲存。"
      : "順序已調整，請按「儲存排序」。";
    if (focusLabel) {
      [...document.querySelectorAll(".sort-handle")].find(button => button.getAttribute("aria-label") === focusLabel)?.focus();
    }
  }

  function addSortControls(article, simulation) {
    const controls = createElement("div", "sort-controls");
    const handle = createElement("button", "sort-handle", "⠿ 拖曳");
    const handleLabel = `拖曳「${simulation.title}」`;
    handle.type = "button";
    handle.setAttribute("aria-label", handleLabel);
    handle.title = "拖曳排序；也可使用旁邊的上下移動按鈕";
    const peers = applyCardOrder(simulations, cardOrder).filter(item => item.topic === simulation.topic);
    const position = peers.findIndex(item => item.href === simulation.href);
    controls.append(handle);
    for (const direction of [-1, 1]) {
      const button = createElement("button", "sort-move", direction < 0 ? "↑" : "↓");
      const target = peers[position + direction];
      button.type = "button";
      button.disabled = !target;
      button.setAttribute("aria-label", `${direction < 0 ? "上移" : "下移"}「${simulation.title}」`);
      button.addEventListener("click", () => moveCard(simulation.href, target.href, handleLabel));
      controls.append(button);
    }
    article.prepend(controls);
    article.dataset.sortHref = simulation.href;
    article.dataset.sortTopic = simulation.topic;
    article.querySelector("a").draggable = false;
    article.querySelector("img").draggable = false;
    let dragStart = null, dropTarget = null;
    function clearDrag() {
      dragStart = null; dropTarget = null;
      document.querySelectorAll(".is-dragging,.drop-target").forEach(card => card.classList.remove("is-dragging", "drop-target"));
    }
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0 || dragStart) return;
      dragStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", event => {
      if (!dragStart || dragStart.pointerId !== event.pointerId) return;
      const moving = Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) >= 6;
      article.classList.toggle("is-dragging", moving);
      document.querySelectorAll(".drop-target").forEach(card => card.classList.remove("drop-target"));
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-sort-href]");
      dropTarget = moving && target && target !== article && target.dataset.sortTopic === simulation.topic ? target : null;
      dropTarget?.classList.add("drop-target");
    });
    handle.addEventListener("pointerup", event => {
      if (!dragStart || dragStart.pointerId !== event.pointerId) return;
      const targetHref = dropTarget?.dataset.sortHref;
      clearDrag();
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      if (targetHref) moveCard(simulation.href, targetHref, handleLabel);
    });
    for (const eventName of ["pointercancel", "lostpointercapture"]) {
      handle.addEventListener(eventName, event => { if (dragStart?.pointerId === event.pointerId) clearDrag(); });
    }
  }

  function renderLatest() {
    const latest = simulations[simulations.length - 1];
    if (!latest) return;

    const link = createElement("a", "latest-link");
    link.href = latest.href;
    link.setAttribute("aria-label", `開啟最新加入的「${latest.title}」模擬器`);

    const preview = createElement("div", "latest-preview");
    const image = document.createElement("img");
    image.src = latest.image;
    image.alt = `${latest.title}模擬器畫面預覽`;
    image.addEventListener("error", () => { image.hidden = true; }, { once: true });
    preview.append(image, createElement("span", "preview-fallback", latest.topic));

    const info = createElement("div", "latest-info");
    const tags = createElement("div", "latest-tags");
    tags.append(...latest.tags.map((tag) => createElement("span", "", tag)));
    info.append(
      createElement("span", "latest-meta", latest.topic),
      createElement("h3", "", latest.title),
      createElement("p", "", latest.description),
      tags,
      createElement("span", "card-action", "立即試用")
    );

    link.append(preview, info);
    elements.latest.replaceChildren(link);
  }

  function matchesSearch(simulation, query) {
    if (!query) return true;
    return [simulation.title, simulation.description, simulation.topic, ...simulation.tags]
      .join(" ")
      .toLocaleLowerCase("zh-Hant")
      .includes(query);
  }

  function renderFilters() {
    elements.filters.replaceChildren(...["全部", ...topics].map(createFilter));
  }

  function render() {
    const query = elements.search.value.trim().toLocaleLowerCase("zh-Hant");
    const visible = applyCardOrder(simulations, cardOrder).filter((simulation) =>
      (selectedTopic === "全部" || simulation.topic === selectedTopic) && matchesSearch(simulation, query)
    );

    const groups = topics
      .map((topic) => [topic, visible.filter((simulation) => simulation.topic === topic)])
      .filter(([, items]) => items.length)
      .map(([topic, items]) => {
        const section = createElement("section", "topic-section");
        const heading = createElement("div", "topic-heading");
        const title = createElement("h3", "", topic);
        title.id = `topic-${topic}`;
        heading.append(title, createElement("span", "", `${items.length} 個模擬`));

        const grid = createElement("div", "simulation-grid");
        grid.append(...items.map(createCard));
        section.setAttribute("aria-labelledby", title.id);
        section.append(heading);
        if (topic === "DSE問題") {
          section.append(createElement("p", "topic-subtitle", "從試題出發，用互動模擬理解物理概念與解題思路。"));
        }
        section.append(grid);
        return section;
      });

    elements.groups.replaceChildren(...groups);
    elements.empty.hidden = visible.length !== 0;
    elements.status.textContent = `顯示 ${visible.length} 個模擬器`;
    renderFilters();
  }

  elements.search.addEventListener("input", render);
  elements.clear.addEventListener("click", () => {
    elements.search.value = "";
    selectedTopic = "全部";
    render();
    elements.search.focus();
  });

  window.addEventListener("scroll", queueCatalogueScrollUpdate, { passive: true });
  window.addEventListener("resize", queueCatalogueScrollUpdate);

  if (editingOrder) {
    document.body.classList.add("editing-order");
    document.querySelector("#catalogue-title").textContent = "排列卡片";
    document.querySelector("#sort-tools").hidden = false;
    const saveButton = document.querySelector("#save-order");
    const sortStatus = document.querySelector("#sort-status");
    fetch("./api/catalogue-order", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(result => {
        if (result.writable !== true) throw new Error();
        saveButton.disabled = false;
      })
      .catch(() => {
        document.querySelector("#save-help").hidden = false;
      });
    document.querySelector("#restore-order").addEventListener("click", () => {
      cardOrder = [...loadedOrder];
      orderChanged = false;
      render();
      sortStatus.textContent = "已還原上次儲存的順序。";
    });
    saveButton.addEventListener("click", async () => {
      const order = applyCardOrder(simulations, cardOrder).map(item => item.href);
      saveButton.disabled = true;
      sortStatus.textContent = "儲存中…";
      try {
        const response = await fetch("./api/catalogue-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order)
        });
        if (!response.ok) throw new Error();
        if ((await response.json()).saved !== true) throw new Error();
        document.querySelector("#save-help").hidden = true;
        loadedOrder = order;
        orderChanged = JSON.stringify(applyCardOrder(simulations, cardOrder).map(item => item.href)) !== JSON.stringify(order);
        sortStatus.textContent = orderChanged
          ? "先前順序已儲存；仍有新調整，請再按「儲存排序」。"
          : "已直接更新 catalogue-order.js。重新發布網站後，所有訪客便會看到新順序。";
      } catch {
        document.querySelector("#save-help").hidden = false;
        sortStatus.textContent = "儲存失敗，調整仍保留在畫面上。請確認 python serve.py 正在執行，再重試。";
      } finally {
        saveButton.disabled = false;
      }
    });
    window.addEventListener("beforeunload", event => {
      if (!orderChanged) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  renderLatest();
  render();
  updateCatalogueScroll();
})();
