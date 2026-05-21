const API_BASE = "https://cstool.ck1info.com/api/price/";
const OPTIONS_URL = `${API_BASE}/api/promo/options`;
const QUERY_URL = `${API_BASE}/api/query/run`;

const state = {
  allCodes: [],
  filteredCodes: [],
  selectedCode: "",
};

const refs = {
  form: document.getElementById("query-form"),
  trigger: document.getElementById("combo-trigger"),
  panel: document.getElementById("combo-panel"),
  search: document.getElementById("code-search"),
  list: document.getElementById("code-list"),
  hiddenCode: document.getElementById("selected-code"),
  grade: document.getElementById("grade"),
  submitBtn: document.getElementById("submit-btn"),
  loadingText: document.getElementById("loading-text"),
  error: document.getElementById("form-error"),
  stdoutBox: document.getElementById("stdout-box"),
  stderrBox: document.getElementById("stderr-box"),
  imageGroups: document.getElementById("image-groups"),
};

function setLoadingText(message) {
  refs.loadingText.textContent = message || "";
}

function setResultLoadingState(loading) {
  refs.stdoutBox.classList.toggle("is-loading", loading);
  refs.stderrBox.classList.toggle("is-loading", loading);
  refs.imageGroups.classList.toggle("loading-state", loading);

  if (loading) {
    refs.imageGroups.innerHTML = '<p class="loading-indicator">图片加载中...</p>';
  }
}

function openPanel() {
  refs.panel.hidden = false;
  refs.trigger.setAttribute("aria-expanded", "true");
  refs.search.focus();
}

function closePanel() {
  refs.panel.hidden = true;
  refs.trigger.setAttribute("aria-expanded", "false");
}

function setError(message) {
  refs.error.textContent = message || "";
}

function renderCodeList() {
  refs.list.innerHTML = "";

  if (state.filteredCodes.length === 0) {
    const li = document.createElement("li");
    li.className = "combo-item";
    li.textContent = "没有匹配的产品代码";
    li.style.cursor = "default";
    refs.list.appendChild(li);
    return;
  }

  state.filteredCodes.forEach((code) => {
    const li = document.createElement("li");
    li.className = "combo-item";
    li.textContent = code;
    li.setAttribute("role", "option");
    li.dataset.value = code;

    if (code === state.selectedCode) {
      li.classList.add("active");
    }

    li.addEventListener("click", () => {
      state.selectedCode = code;
      refs.hiddenCode.value = code;
      refs.trigger.textContent = code;
      setError("");
      closePanel();
      renderCodeList();
    });

    refs.list.appendChild(li);
  });
}

function filterCodes(keyword) {
  const value = (keyword || "").trim().toUpperCase();
  state.filteredCodes = state.allCodes.filter((code) => code.includes(value));
  renderCodeList();
}

async function loadOptions() {
  refs.trigger.textContent = "产品代码加载中...";
  refs.trigger.disabled = true;

  try {
    const response = await fetch(OPTIONS_URL);

    if (!response.ok) {
      throw new Error(`获取产品代码失败，状态码：${response.status}`);
    }

    const payload = await response.json();
    const options = Array.isArray(payload.options) ? payload.options : [];

    state.allCodes = options
      .map((item) => (item && typeof item.code === "string" ? item.code.trim().toUpperCase() : ""))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

    state.filteredCodes = [...state.allCodes];
    refs.trigger.disabled = false;
    refs.trigger.textContent = "请选择产品代码";
    renderCodeList();
  } catch (error) {
    refs.trigger.textContent = "产品代码加载失败";
    setError(error instanceof Error ? error.message : "产品代码加载失败");
  }
}

function resetResult() {
  refs.stdoutBox.textContent = "加载中...";
  refs.stderrBox.textContent = "加载中...";
  setResultLoadingState(true);
}

function normalizeOutput(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed || "(空)";
}

function buildImageGroups(urls) {
  const groups = {
    publicPrice: [],
    gradePrice: [],
    modifiedPrice: [],
    others: [],
  };

  urls.forEach((url) => {
    const lower = String(url).toLowerCase();

    if (lower.includes("promo_snapshots")) {
      groups.publicPrice.push(url);
    } else if (lower.includes("vip_snapshots")) {
      groups.gradePrice.push(url);
    } else if (lower.includes("promo_modified_snapshots")) {
      groups.modifiedPrice.push(url);
    } else {
      groups.others.push(url);
    }
  });

  return groups;
}

function createImageBlock(title, urls) {
  const block = document.createElement("section");
  block.className = "image-group";

  const h4 = document.createElement("h4");
  h4.textContent = `${title}（${urls.length}）`;

  const grid = document.createElement("div");
  grid.className = "image-grid";

  urls.forEach((url, index) => {
    const item = document.createElement("figure");
    item.className = "image-item";

    const img = document.createElement("img");
    img.src = url;
    img.alt = `${title}${index + 1}`;
    img.loading = "lazy";

    const link = document.createElement("a");
    link.className = "image-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "查看原图";

    const download = document.createElement("a");
    download.className = "image-download-btn";
    download.href = url;
    download.download = "";
    download.textContent = "下载图片";

    item.appendChild(img);
    item.appendChild(link);
    item.appendChild(download);
    grid.appendChild(item);
  });

  block.appendChild(h4);
  block.appendChild(grid);

  return block;
}

function createEmptyImageBlock(title, message) {
  const block = document.createElement("section");
  block.className = "image-group";

  const h4 = document.createElement("h4");
  h4.textContent = `${title}（0）`;

  const p = document.createElement("p");
  p.className = "empty-tip";
  p.textContent = message;

  block.appendChild(h4);
  block.appendChild(p);

  return block;
}

function renderImages(imageUrls, selectedCode, selectedGrade) {
  refs.imageGroups.classList.remove("loading-state");
  refs.imageGroups.innerHTML = "";

  const urls = Array.isArray(imageUrls) ? imageUrls.filter((u) => typeof u === "string" && u.trim()) : [];

  if (urls.length === 0) {
    refs.imageGroups.innerHTML = "<p class=\"empty-tip\">暂无图片</p>";
    return;
  }

  const grouped = buildImageGroups(urls);

if (grouped.modifiedPrice.length) {
    refs.imageGroups.appendChild(
      createImageBlock(`选择等级后的价格图（${selectedCode}-${selectedGrade}）`, grouped.modifiedPrice),
    );
  }

  if (grouped.publicPrice.length) {
    refs.imageGroups.appendChild(createImageBlock("公开价图片", grouped.publicPrice));
  }

  if (grouped.gradePrice.length) {
    refs.imageGroups.appendChild(createImageBlock("等级报价图", grouped.gradePrice));
  } else {
    refs.imageGroups.appendChild(
      createEmptyImageBlock("等级报价图", `无 ${selectedCode} 对应 ${selectedGrade} 等级的数据`),
    );
  }


  if (grouped.others.length) {
    refs.imageGroups.appendChild(createImageBlock("其他图片", grouped.others));
  }
}

async function submitQuery(event) {
  event.preventDefault();
  setError("");

  const code = refs.hiddenCode.value.trim().toUpperCase();
  const grade = refs.grade.value.trim().toUpperCase();

  if (!code || !grade) {
    setError("产品代码和报价等级都是必选项");
    return;
  }

  refs.submitBtn.disabled = true;
  refs.submitBtn.classList.add("is-loading");
  refs.submitBtn.textContent = "获取中...";
  setLoadingText("正在请求接口并生成结果，请稍候...");
  resetResult();

  try {
    const response = await fetch(QUERY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, grade }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload && payload.detail ? String(payload.detail) : `请求失败，状态码：${response.status}`);
    }

    refs.stdoutBox.textContent = normalizeOutput(payload.stdout);
    refs.stderrBox.textContent = normalizeOutput(payload.stderr);
    renderImages(payload.image_urls, code, grade);
  } catch (error) {
    refs.stdoutBox.textContent = "(空)";
    refs.stderrBox.textContent = error instanceof Error ? error.message : "请求失败";
    refs.imageGroups.innerHTML = "<p class=\"empty-tip\">暂无图片</p>";
  } finally {
    setResultLoadingState(false);
    setLoadingText("");
    refs.submitBtn.disabled = false;
    refs.submitBtn.classList.remove("is-loading");
    refs.submitBtn.textContent = "确定获取";
  }
}

function bindEvents() {
  refs.trigger.addEventListener("click", () => {
    if (refs.panel.hidden) {
      openPanel();
      return;
    }

    closePanel();
  });

  refs.search.addEventListener("input", (event) => {
    filterCodes(event.target.value);
  });

  document.addEventListener("click", (event) => {
    if (!refs.panel.hidden && !refs.panel.contains(event.target) && !refs.trigger.contains(event.target)) {
      closePanel();
    }
  });

  refs.form.addEventListener("submit", submitQuery);
}

function init() {
  bindEvents();
  loadOptions();
}

init();
