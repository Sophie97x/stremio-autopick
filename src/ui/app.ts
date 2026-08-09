// @ts-nocheck
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const labels = {
    resolutionOrder: { "2160p": "2160p / 4K", "1080p": "1080p", "720p": "720p", "480p": "480p" },
    hdrOrder: { dolbyVision: "Dolby Vision", hdr10plus: "HDR10+", hdr10: "HDR10", hlg: "HLG", sdr: "SDR" },
    codecOrder: { hevc: "HEVC / H.265 / x265", h264: "AVC / H.264 / x264", av1: "AV1" },
    releaseOrder: { remux: "Remux", bluray: "BluRay", webdl: "WEB-DL", webrip: "WEBRip", hdtv: "HDTV", dvd: "DVD", unknown: "Unknown" },
    audioOrder: { atmosTruehd: "Atmos + TrueHD", truehd: "TrueHD", dtsx: "DTS:X", dtshdma: "DTS-HD MA", dtshd: "DTS-HD", eac3: "EAC3 / DD+", atmos: "Atmos", ac3: "AC3 / Dolby Digital", dts: "DTS", aac: "AAC" },
  };
  const listDefinitions = [
    ["resolution-order", "resolutionOrder", "enabledResolutions"],
    ["hdr-order", "hdrOrder", "enabledHdr"],
    ["codec-order", "codecOrder", "enabledCodecs"],
    ["release-order", "releaseOrder", null],
    ["audio-order", "audioOrder", null],
  ];

  let state;
  let defaults;
  let presets;
  let manifestUrl = "";
  let installUrl = "";
  let encodeTimer;
  let toastTimer;
  let dragged = null;

  function getPath(path) {
    return path.split(".").reduce((value, part) => value?.[part], state);
  }

  function setPath(path, value) {
    const parts = path.split(".");
    const key = parts.pop();
    const target = parts.reduce((object, part) => object[part], state);
    target[key] = value;
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 1800);
  }

  function showMode(mode) {
    state.mode = mode;
    $$(".tab").forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    $("#simple-panel").classList.toggle("hidden", mode !== "simple");
    $("#advanced-panel").classList.toggle("hidden", mode !== "advanced");
    scheduleEncode();
  }

  function renderSimple() {
    $$("[data-quality]").forEach((button) => button.classList.toggle("active", button.dataset.quality === state.preferredQuality));
    $$("[data-profile]").forEach((button) => button.classList.toggle("selected", button.dataset.profile === state.preset));
    $("#simple-fallback").checked = state.fallbackResolution;
  }

  function renderSortable(containerId, orderKey, enabledKey) {
    const container = $(`#${containerId}`);
    container.replaceChildren();
    state[orderKey].forEach((value, index) => {
      const item = document.createElement("li");
      item.className = "sortable-item";
      item.draggable = true;
      item.dataset.orderKey = orderKey;
      item.dataset.value = value;
      const toggle = enabledKey
        ? `<input class="item-toggle" type="checkbox" aria-label="Enable ${labels[orderKey][value]}" ${state[enabledKey].includes(value) ? "checked" : ""} data-enabled-key="${enabledKey}" data-value="${value}" />`
        : `<span></span>`;
      item.innerHTML = `<span class="drag-handle" title="Drag to reorder">⠿</span>${toggle}<span class="item-label">${labels[orderKey][value]}</span><span class="reorder-buttons"><button type="button" class="icon-button move-up" aria-label="Move up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" class="icon-button move-down" aria-label="Move down" ${index === state[orderKey].length - 1 ? "disabled" : ""}>↓</button></span>`;
      container.append(item);
    });
  }

  function renderBlocked() {
    const container = $("#blocked-quality");
    container.replaceChildren();
    ["cam", "ts", "telecine", "screener"].forEach((quality) => {
      const label = document.createElement("label");
      label.innerHTML = `<input type="checkbox" value="${quality}" ${state.blockedQualities.includes(quality) ? "checked" : ""} /><span>${quality.toUpperCase()}</span>`;
      container.append(label);
    });
  }

  function normaliseSourcePriorities() {
    state.sources.forEach((source, index) => { source.priority = index; });
  }

  function renderSources() {
    const container = $("#source-list");
    container.replaceChildren();
    if (state.sources.length === 0) {
      const empty = document.createElement("div");
      empty.className = "source-empty";
      empty.textContent = "No upstream addon URLs yet.";
      container.append(empty);
      return;
    }
    state.sources.forEach((source, index) => {
      const row = document.createElement("div");
      row.className = "source-row";
      row.draggable = true;
      row.dataset.sourceIndex = String(index);
      row.innerHTML = `<span class="drag-handle">⠿</span><input type="url" value="${escapeHtml(source.url)}" placeholder="https://example.com/manifest.json" aria-label="Upstream addon URL" /><input class="source-enabled" type="checkbox" ${source.enabled ? "checked" : ""} aria-label="Enable source" /><span class="source-actions"><button type="button" class="icon-button source-up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" class="icon-button source-down" ${index === state.sources.length - 1 ? "disabled" : ""}>↓</button><button type="button" class="icon-button source-remove" aria-label="Remove source">×</button></span>`;
      container.append(row);
    });
  }

  function renderFields() {
    $$('[data-path]').forEach((input) => {
      const value = getPath(input.dataset.path);
      if (input.type === "checkbox") input.checked = Boolean(value);
      else input.value = String(value);
    });
    $$('input[name="language-mode"]').forEach((input) => { input.checked = input.value === state.languageMode; });
  }

  function render() {
    renderSimple();
    listDefinitions.forEach((definition) => renderSortable(...definition));
    renderBlocked();
    renderSources();
    renderFields();
    showMode(state.mode);
  }

  async function encode() {
    const validation = $("#validation-message");
    try {
      const response = await fetch("/api/config/encode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Settings are invalid");
      manifestUrl = data.manifestUrl;
      installUrl = data.installUrl;
      $("#addon-url").textContent = manifestUrl;
      validation.textContent = "";
      const install = $("#install-button");
      install.href = installUrl;
      install.setAttribute("aria-disabled", "false");
    } catch (error) {
      manifestUrl = "";
      installUrl = "";
      $("#addon-url").textContent = "Fix settings to generate the addon URL";
      validation.textContent = error.message;
      $("#install-button").setAttribute("aria-disabled", "true");
    }
  }

  function scheduleEncode() {
    clearTimeout(encodeTimer);
    encodeTimer = setTimeout(encode, 220);
  }

  function moveItem(orderKey, value, direction) {
    const order = state[orderKey];
    const from = order.indexOf(value);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    renderSortable(listDefinitions.find((entry) => entry[1] === orderKey)[0], orderKey, listDefinitions.find((entry) => entry[1] === orderKey)[2]);
    scheduleEncode();
  }

  document.addEventListener("click", (event) => {
    const mode = event.target.closest("[data-mode]");
    if (mode) showMode(mode.dataset.mode);
    const quality = event.target.closest("[data-quality]");
    if (quality) { state.preferredQuality = quality.dataset.quality; renderSimple(); scheduleEncode(); }
    const profile = event.target.closest("[data-profile]");
    if (profile) {
      const next = clone(presets[profile.dataset.profile]);
      next.mode = state.mode;
      next.preferredQuality = state.preferredQuality;
      next.fallbackResolution = state.fallbackResolution;
      next.sources = state.sources;
      next.includeDemoSource = state.includeDemoSource;
      state = next;
      render();
    }
    const row = event.target.closest(".sortable-item");
    if (row && event.target.closest(".move-up")) moveItem(row.dataset.orderKey, row.dataset.value, -1);
    if (row && event.target.closest(".move-down")) moveItem(row.dataset.orderKey, row.dataset.value, 1);
  });

  document.addEventListener("change", (event) => {
    const input = event.target;
    if (input.id === "simple-fallback") { state.fallbackResolution = input.checked; renderFields(); scheduleEncode(); return; }
    if (input.dataset.path) {
      const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
      setPath(input.dataset.path, value);
      if (input.dataset.path === "fallbackResolution") renderSimple();
      scheduleEncode();
      return;
    }
    if (input.name === "language-mode") { state.languageMode = input.value; scheduleEncode(); return; }
    if (input.dataset.enabledKey) {
      const list = state[input.dataset.enabledKey];
      if (input.checked) list.push(input.dataset.value);
      else if (list.length === 1) { input.checked = true; toast("At least one option must stay enabled"); return; }
      else state[input.dataset.enabledKey] = list.filter((value) => value !== input.dataset.value);
      scheduleEncode();
      return;
    }
    if (input.closest("#blocked-quality")) {
      state.blockedQualities = $$("#blocked-quality input:checked").map((item) => item.value);
      scheduleEncode();
    }
  });

  document.addEventListener("dragstart", (event) => {
    const sortable = event.target.closest(".sortable-item");
    const source = event.target.closest(".source-row");
    if (sortable) { dragged = { type: "order", key: sortable.dataset.orderKey, value: sortable.dataset.value }; sortable.classList.add("dragging"); }
    if (source) { dragged = { type: "source", index: Number(source.dataset.sourceIndex) }; source.classList.add("dragging"); }
  });
  document.addEventListener("dragover", (event) => { if (event.target.closest(".sortable-item, .source-row")) event.preventDefault(); });
  document.addEventListener("drop", (event) => {
    event.preventDefault();
    const targetItem = event.target.closest(".sortable-item");
    const targetSource = event.target.closest(".source-row");
    if (dragged?.type === "order" && targetItem?.dataset.orderKey === dragged.key) {
      const order = state[dragged.key];
      const from = order.indexOf(dragged.value);
      const to = order.indexOf(targetItem.dataset.value);
      order.splice(to, 0, order.splice(from, 1)[0]);
      renderSortable(listDefinitions.find((entry) => entry[1] === dragged.key)[0], dragged.key, listDefinitions.find((entry) => entry[1] === dragged.key)[2]);
      scheduleEncode();
    }
    if (dragged?.type === "source" && targetSource) {
      const to = Number(targetSource.dataset.sourceIndex);
      state.sources.splice(to, 0, state.sources.splice(dragged.index, 1)[0]);
      normaliseSourcePriorities(); renderSources(); scheduleEncode();
    }
  });
  document.addEventListener("dragend", () => { $$(".dragging").forEach((item) => item.classList.remove("dragging")); dragged = null; });

  $("#source-list").addEventListener("input", (event) => {
    const row = event.target.closest(".source-row");
    if (!row) return;
    const source = state.sources[Number(row.dataset.sourceIndex)];
    if (event.target.type === "url") source.url = event.target.value.trim();
    if (event.target.classList.contains("source-enabled")) source.enabled = event.target.checked;
    scheduleEncode();
  });
  $("#source-list").addEventListener("click", (event) => {
    const row = event.target.closest(".source-row");
    if (!row) return;
    const index = Number(row.dataset.sourceIndex);
    if (event.target.closest(".source-remove")) state.sources.splice(index, 1);
    else if (event.target.closest(".source-up") && index > 0) [state.sources[index - 1], state.sources[index]] = [state.sources[index], state.sources[index - 1]];
    else if (event.target.closest(".source-down") && index < state.sources.length - 1) [state.sources[index + 1], state.sources[index]] = [state.sources[index], state.sources[index + 1]];
    else return;
    normaliseSourcePriorities(); renderSources(); scheduleEncode();
  });
  $("#add-source").addEventListener("click", () => {
    if (state.sources.length >= 8) { toast("Maximum 8 upstream sources"); return; }
    state.sources.push({ url: "", enabled: true, priority: state.sources.length });
    renderSources();
    $("#source-list .source-row:last-child input[type='url']")?.focus();
    scheduleEncode();
  });

  $("#copy-url").addEventListener("click", async () => {
    if (!manifestUrl) { toast("Fix settings first"); return; }
    try { await navigator.clipboard.writeText(manifestUrl); }
    catch { const input = document.createElement("textarea"); input.value = manifestUrl; document.body.append(input); input.select(); document.execCommand("copy"); input.remove(); }
    toast("Addon URL copied");
  });
  $("#install-button").addEventListener("click", (event) => { if (!installUrl) event.preventDefault(); });
  $("#export-settings").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "autopick-settings.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  });
  $("#import-settings").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      const response = await fetch("/api/config/encode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(imported) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Invalid settings file");
      state = data.config; render(); toast("Settings imported");
    } catch (error) { toast(error.message); }
    event.target.value = "";
  });
  $("#reset-settings").addEventListener("click", () => { state = clone(defaults); render(); toast("Defaults restored"); });

  async function initialise() {
    try {
      const presetResponse = await fetch("/api/presets");
      const presetData = await presetResponse.json();
      defaults = presetData.default;
      presets = presetData.presets;
      state = clone(defaults);
      const match = window.location.pathname.match(/^\/([^/]+)\/configure\/?$/);
      if (match?.[1]) {
        const response = await fetch(`/api/config/${encodeURIComponent(match[1])}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Configured URL is invalid");
        state = data.config;
      }
      render();
      await encode();
    } catch (error) {
      $("#validation-message").textContent = error.message;
      toast("Configuration could not load");
    }
  }

  void initialise();
})();
