const API_BASE = "https://cstool.ck1info.com/api/price/";
const OPTIONS_URL = `${API_BASE}/api/promo/options`;
const QUERY_URL = `${API_BASE}/api/query/run`;
const PRICING_API_BASE = "http://127.0.0.1:18000/api/v1/pricing";
const COUNTRIES_URL = `${PRICING_API_BASE}/countries`;
const COUNTRY_IMAGES_URL = `${PRICING_API_BASE}/images`;

const state = {
  allCodes: [],
  filteredCodes: [],
  selectedCode: "",
  countryRequestId: 0,
  countryImageRequestId: 0,
};

const refs = {
  form: document.getElementById("query-form"),
  trigger: document.getElementById("combo-trigger"),
  panel: document.getElementById("combo-panel"),
  search: document.getElementById("code-search"),
  list: document.getElementById("code-list"),
  hiddenCode: document.getElementById("selected-code"),
  grade: document.getElementById("grade"),
  country: document.getElementById("country"),
  countryLoading: document.getElementById("country-loading"),
  submitBtn: document.getElementById("submit-btn"),
  loadingText: document.getElementById("loading-text"),
  error: document.getElementById("form-error"),
  stdoutBox: document.getElementById("stdout-box"),
  stderrBox: document.getElementById("stderr-box"),
  imageGroups: document.getElementById("image-groups"),
  countryImageSlot: document.getElementById("country-image-slot"),
  previewModal: document.getElementById("image-preview-modal"),
  previewImage: document.getElementById("preview-image"),
  previewCloseBtn: document.getElementById("preview-close-btn"),
  previewPrevBtn: document.getElementById("preview-prev-btn"),
  previewNextBtn: document.getElementById("preview-next-btn"),
  previewCounter: document.getElementById("preview-counter"),
  previewTitle: document.getElementById("preview-title"),
  previewStage: document.getElementById("preview-stage"),
};

const previewGesture = {
  startX: 0,
  startY: 0,
};

const previewState = {
  items: [],
  index: -1,
};

function setLoadingText(message) {
  refs.loadingText.textContent = message || "";
}

function setCountryLoadingText(message, isError = false) {
  refs.countryLoading.textContent = message || "";
  refs.countryLoading.classList.toggle("is-error", isError);
}

function resetCountryOptions(disabled = true, placeholder = "不选择国家（可选）") {
  refs.country.innerHTML = "";

  const option = document.createElement("option");
  option.value = "";
  option.textContent = placeholder;
  refs.country.appendChild(option);
  refs.country.value = "";
  refs.country.disabled = disabled;
}

function renderCountryImageIdle(message = "未选择国家，暂无筛选图") {
  refs.countryImageSlot.classList.remove("loading-state");
  refs.countryImageSlot.innerHTML = `<p class=\"empty-tip\">${message}</p>`;
}

function renderCountryImageLoading() {
  refs.countryImageSlot.classList.add("loading-state");
  refs.countryImageSlot.innerHTML = '<p class="loading-indicator">筛选图加载中...</p>';
}

function renderCountryImageError(message) {
  refs.countryImageSlot.classList.remove("loading-state");
  refs.countryImageSlot.innerHTML = `<p class=\"error-text\">${message || "筛选图加载失败"}</p>`;
}

function renderCountryImage(url, code, grade, country) {
  refs.countryImageSlot.classList.remove("loading-state");
  refs.countryImageSlot.innerHTML = "";

  const wrap = document.createElement("section");
  wrap.className = "country-image-card";

  const title = document.createElement("h4");
  title.textContent = `${code}-${grade}-${country}`;

  const img = document.createElement("img");
  img.src = url;
  img.alt = `${code}-${grade}-${country}筛选图`;
  img.loading = "lazy";
  img.classList.add("can-preview");
  img.dataset.previewUrl = url;
  img.setAttribute("role", "button");
  img.setAttribute("tabindex", "0");

  const link = document.createElement("a");
  link.className = "image-link";
  link.href = "#";
  link.dataset.previewUrl = url;
  link.textContent = "查看原图";

  const download = document.createElement("a");
  download.className = "image-download-btn";
  download.href = url;
  download.download = "";
  download.textContent = "下载图片";

  wrap.appendChild(title);
  wrap.appendChild(img);
  wrap.appendChild(link);
  wrap.appendChild(download);
  refs.countryImageSlot.appendChild(wrap);
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
      renderCountryImageIdle("已选择产品代码，可按需选择国家后提交");
      closePanel();
      renderCodeList();
      loadCountriesForCode(code);
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

async function loadCountriesForCode(code) {
  const normalizedCode = (code || "").trim().toUpperCase();
  state.countryImageRequestId += 1;

  if (!normalizedCode) {
    resetCountryOptions(true);
    setCountryLoadingText("");
    return;
  }

  state.countryRequestId += 1;
  const currentRequestId = state.countryRequestId;

  resetCountryOptions(true, "国家加载中...");
  setCountryLoadingText("加载中...");

  try {
    const response = await fetch(`${COUNTRIES_URL}?code=${encodeURIComponent(normalizedCode)}`, {
      headers: {
        Accept: "application/json",
      },
    });

    const payload = await response.json();

    if (currentRequestId !== state.countryRequestId) {
      return;
    }

    if (!response.ok || Number(payload?.code) !== 0) {
      throw new Error(payload?.message || `国家列表请求失败，状态码：${response.status}`);
    }

    const countries = Array.isArray(payload?.data?.countries)
      ? payload.data.countries.filter((item) => typeof item === "string" && item.trim())
      : [];

    resetCountryOptions(false, "不选择国家（可选）");
    countries.forEach((country) => {
      const option = document.createElement("option");
      option.value = country;
      option.textContent = country;
      refs.country.appendChild(option);
    });

    setCountryLoadingText("");
  } catch (_error) {
    if (currentRequestId !== state.countryRequestId) {
      return;
    }

    resetCountryOptions(true, "国家加载失败");
    setCountryLoadingText("加载失败", true);
  }
}

async function loadCountryFilterImage(code, grade, country) {
  const normalizedCode = (code || "").trim().toUpperCase();
  const normalizedGrade = (grade || "").trim().toUpperCase();
  const normalizedCountry = (country || "").trim();

  if (!normalizedCode || !normalizedGrade || !normalizedCountry) {
    renderCountryImageIdle();
    return;
  }

  state.countryImageRequestId += 1;
  const currentRequestId = state.countryImageRequestId;

  renderCountryImageLoading();

  try {
    const query = new URLSearchParams({
      code: normalizedCode,
      grade: normalizedGrade,
      country: normalizedCountry,
    });

    const response = await fetch(`${COUNTRY_IMAGES_URL}?${query.toString()}`, {
      headers: {
        Accept: "application/json",
      },
    });

    const payload = await response.json();

    if (currentRequestId !== state.countryImageRequestId) {
      return;
    }

    if (!response.ok || Number(payload?.code) !== 0) {
      throw new Error(payload?.message || `筛选图请求失败，状态码：${response.status}`);
    }

    const images = Array.isArray(payload?.data?.images) ? payload.data.images : [];
    const picked = images.find((item) => {
      const sheet = typeof item?.sheet === "string" ? item.sheet : "";
      return sheet.includes("筛选结果") && typeof item?.url === "string" && item.url.trim();
    });

    if (!picked || !picked.url) {
      throw new Error("未找到筛选结果图片");
    }

    renderCountryImage(picked.url, normalizedCode, normalizedGrade, normalizedCountry);
  } catch (_error) {
    if (currentRequestId !== state.countryImageRequestId) {
      return;
    }

    renderCountryImageError("筛选图加载失败");
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
    img.dataset.previewUrl = url;
    img.classList.add("can-preview");
    img.setAttribute("role", "button");
    img.setAttribute("tabindex", "0");

    const link = document.createElement("a");
    link.className = "image-link";
    link.href = "#";
    link.dataset.previewUrl = url;
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

function collectPreviewItems() {
  const images = document.querySelectorAll("#image-groups img[data-preview-url], #country-image-slot img[data-preview-url]");

  previewState.items = Array.from(images)
    .map((img) => {
      const url = img.dataset.previewUrl || "";
      const groupTitle = img.closest(".image-group")?.querySelector("h4")?.textContent?.trim() || "未分类图片";

      return {
        url,
        title: groupTitle,
        alt: img.alt || "预览图",
      };
    })
    .filter((item) => Boolean(item.url));
}

function updatePreviewMeta() {
  const total = previewState.items.length;
  const current = previewState.index + 1;

  if (refs.previewCounter) {
    refs.previewCounter.textContent = total > 0 ? `${current} / ${total}` : "0 / 0";
  }

  if (refs.previewPrevBtn) {
    refs.previewPrevBtn.disabled = previewState.index <= 0;
  }

  if (refs.previewNextBtn) {
    refs.previewNextBtn.disabled = previewState.index >= total - 1;
  }

  if (refs.previewTitle) {
    refs.previewTitle.textContent =
      previewState.index >= 0 && previewState.items[previewState.index]
        ? previewState.items[previewState.index].title
        : "-";
  }
}

function showPreviewAt(index, altText) {
  const total = previewState.items.length;

  if (!total || index < 0 || index >= total || !refs.previewImage) {
    return;
  }

  previewState.index = index;
  refs.previewImage.src = previewState.items[index].url;
  refs.previewImage.alt = altText || previewState.items[index].alt || `预览图 ${index + 1}`;
  updatePreviewMeta();
}

function showPrevPreview() {
  if (previewState.index <= 0) {
    return;
  }

  showPreviewAt(previewState.index - 1);
}

function showNextPreview() {
  if (previewState.index >= previewState.items.length - 1) {
    return;
  }

  showPreviewAt(previewState.index + 1);
}

function openPreview(url, altText) {
  if (!refs.previewModal || !refs.previewImage) {
    return;
  }

  collectPreviewItems();
  const matchedIndex = previewState.items.findIndex((item) => item.url === url);
  const startIndex = Math.max(0, matchedIndex);

  showPreviewAt(startIndex, altText || "预览图");
  refs.previewModal.hidden = false;
  refs.previewModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  refs.previewCloseBtn?.focus();
}

function closePreview() {
  if (!refs.previewModal || !refs.previewImage) {
    return;
  }

  refs.previewModal.hidden = true;
  refs.previewModal.setAttribute("aria-hidden", "true");
  refs.previewImage.src = "";
  previewState.items = [];
  previewState.index = -1;
  updatePreviewMeta();
  document.body.classList.remove("modal-open");
}

function bindPreviewEvents() {
  if (!refs.previewModal || !refs.previewImage) {
    return;
  }

  const bindPreviewTrigger = (container) => {
    if (!container) {
      return;
    }

    container.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-preview-url]");

      if (!trigger) {
        return;
      }

      event.preventDefault();
      openPreview(trigger.dataset.previewUrl, "预览图");
    });

    container.addEventListener("keydown", (event) => {
      const trigger = event.target.closest("[data-preview-url]");

      if (!trigger) {
        return;
      }

      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openPreview(trigger.dataset.previewUrl, "预览图");
    });
  };

  bindPreviewTrigger(refs.imageGroups);
  bindPreviewTrigger(refs.countryImageSlot);

  refs.previewCloseBtn?.addEventListener("click", closePreview);
  refs.previewPrevBtn?.addEventListener("click", showPrevPreview);
  refs.previewNextBtn?.addEventListener("click", showNextPreview);

  refs.previewModal.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("[data-close-preview='true']")) {
      closePreview();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!refs.previewModal || refs.previewModal.hidden) {
      return;
    }

    if (event.key === "Escape") {
      closePreview();
      return;
    }

    if (event.key === "ArrowLeft") {
      showPrevPreview();
      return;
    }

    if (event.key === "ArrowRight") {
      showNextPreview();
    }
  });

  refs.previewStage?.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.touches[0];
      previewGesture.startX = touch.clientX;
      previewGesture.startY = touch.clientY;
    },
    { passive: true },
  );

  refs.previewStage?.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - previewGesture.startX;
      const deltaY = touch.clientY - previewGesture.startY;

      if (deltaY > 80 && Math.abs(deltaX) < 60) {
        closePreview();
        return;
      }

      if (Math.abs(deltaX) > 90 && Math.abs(deltaY) < 70) {
        if (deltaX > 0) {
          if (previewState.index === 0) {
            closePreview();
            return;
          }

          showPrevPreview();
          return;
        }

        showNextPreview();
      }
    },
    { passive: true },
  );
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
  const country = refs.country.value.trim();

  if (!code || !grade) {
    setError("产品代码和报价等级都是必选项");
    return;
  }

  refs.submitBtn.disabled = true;
  refs.submitBtn.classList.add("is-loading");
  refs.submitBtn.textContent = "获取中...";
  setLoadingText("正在请求接口并生成结果，请稍候...");
  resetResult();

  if (country) {
    loadCountryFilterImage(code, grade, country);
  } else {
    state.countryImageRequestId += 1;
    renderCountryImageIdle("未选择国家，暂无筛选图");
  }

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

  refs.country.addEventListener("change", () => {
    if (refs.country.value.trim()) {
      renderCountryImageIdle("国家已选择，点击确定后加载筛选图");
      return;
    }

    renderCountryImageIdle("未选择国家，暂无筛选图");
  });

  document.addEventListener("click", (event) => {
    if (!refs.panel.hidden && !refs.panel.contains(event.target) && !refs.trigger.contains(event.target)) {
      closePanel();
    }
  });

  refs.form.addEventListener("submit", submitQuery);
  bindPreviewEvents();
}

function init() {
  resetCountryOptions(true);
  setCountryLoadingText("");
  renderCountryImageIdle();
  bindEvents();
  loadOptions();
}

init();
