(function () {
  "use strict";

  function getCatalogueScrollState(catalogueTop, scrollY, dockTop) {
    const travel = Math.max(1, catalogueTop + scrollY - dockTop);
    const progress = Math.min(1, Math.max(0, scrollY / travel));
    return { progress };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { getCatalogueScrollState };
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
      href: "./internal-energy-particle-model/index.html",
      image: "./internal-energy-particle-model/preview.png",
      tags: ["內能", "粒子模型", "動能", "勢能", "冰", "水"]
    }
  ];

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

  const topics = ["熱與氣體", "力與運動"];
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
    return article;
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
    const visible = simulations.filter((simulation) =>
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
        section.append(heading, grid);
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

  renderLatest();
  render();
  updateCatalogueScroll();
})();
