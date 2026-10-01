const THEME_KEY = "iphone18proTheme.v2";
const FAV_KEY = "iphone18proFavorites.v2";
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const state = { data: null, q: "", filter: "all", fav: new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")) };

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#039;" }[m]));
}

function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "gear") return { name: "gear" };
  if (parts[0] === "scene" && parts[1]) return { name: "scene", id: parts[1] };
  return { name: "home" };
}

function saveFav() {
  localStorage.setItem(FAV_KEY, JSON.stringify([...state.fav]));
}

function toggleFav(id) {
  state.fav.has(id) ? state.fav.delete(id) : state.fav.add(id);
  saveFav();
  render();
}

function setTheme(name) {
  document.documentElement.dataset.theme = name;
  localStorage.setItem(THEME_KEY, name);
  const color = { light: "#f3f1ec", dark: "#121110", outdoor: "#ffffff" }[name];
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  document.querySelectorAll("[data-theme]").forEach((b) => b.classList.toggle("active", b.dataset.theme === name));
}

function checklist(scene, data) {
  const P = data.params, L = data.limits;
  return [
    `iPhone 18 Pro · ${scene.title}`,
    scene.summary, "",
    `鏡頭：${scene.lenses.join(" / ")}`,
    `限制：${scene.limits.map((l) => L[l]).join("、")}`, "",
    "現場三步", ...scene.key.map((k) => `· ${k.label}：${k.value}`), "",
    "必須", ...scene.must.map((s) => `· ${P[s.id]}：${s.value}`), "",
    "選項", ...scene.options.map((s) => `· ${P[s.id]}：${s.value}`), "",
    "操作順序", ...scene.flow.map((s, i) => `${i + 1}. ${s}`),
    scene.recipe ? `\n風格配方：${scene.recipe}` : "",
    "", "注意", ...scene.notes.map((n) => `· ${n}`),
  ].join("\n");
}

async function copyScene(scene) {
  await navigator.clipboard.writeText(checklist(scene, state.data));
  const b = $("#copyBtn");
  if (b) { const t = b.textContent; b.textContent = "已複製"; setTimeout(() => (b.textContent = t), 1400); }
}

function hardware(data) {
  const lenses = Object.entries(data.lenses);
  return `<section class="grid-4">
    <article class="card"><h3>可變光圈 · 僅 1x</h3><p class="big">${esc(data.hardware.apertures.join("  "))}</p><p>光學光圈不是人像 Depth。人像虛化請用人像模式的景深控制。</p></article>
    <article class="card"><h3>原生 Pro 快門</h3><p class="big">${esc(data.hardware.shutterNative)}</p><p>${esc(data.hardware.shutterNote)}</p></article>
    <article class="card"><h3>光學焦段</h3>
      <div class="lenses">${lenses.map(([id, v]) => `<div class="lens"><b>${esc(id)}</b><span>${esc(v.mm)}</span><span>${esc(v.aperture)}</span></div>`).join("")}</div>
    </article>
  </section>`;
}

const WIZARD = {
  lights: [["day", "日光"], ["overcast", "陰天"], ["golden", "日出／日落"], ["night", "夜晚"]],
  subjects: [["person", "人"], ["place", "風景／建築"], ["water", "水"], ["city", "城市"], ["sky", "星月"], ["food", "食物／花"]],
  intents: [["record", "清楚記錄"], ["shallow", "淺景深"], ["freeze", "凝固動作"], ["blur", "流動模糊"]],
  map: {
    "day-person-record": ["env-portrait", "street", "portrait"],
    "day-person-shallow": ["portrait", "env-portrait"],
    "day-person-freeze": ["sports", "street"],
    "day-place-record": ["mountain", "architecture", "blue-sky"],
    "day-water-record": ["seascape", "water-splash"],
    "day-water-freeze": ["water-splash", "seascape"],
    "day-water-blur": ["silky-water", "seascape"],
    "day-city-record": ["architecture", "street"],
    "day-food-record": ["food", "macro", "japanese-fresh"],
    "overcast-person-record": ["portrait", "japanese-fresh"],
    "overcast-place-record": ["overcast", "fog", "mountain"],
    "overcast-water-blur": ["silky-water", "seascape"],
    "golden-place-record": ["sunset", "sunrise", "starburst"],
    "golden-person-record": ["portrait", "sunset"],
    "night-city-record": ["city-night", "starburst", "car-trails"],
    "night-city-blur": ["car-trails", "city-night"],
    "night-sky-record": ["milky-way", "moon"],
    "night-person-record": ["dark", "portrait", "city-night"],
  },
};
const wiz = { light: "", subject: "", intent: "" };

function wizardHtml(data) {
  const group = (label, key, options) => `<div><p class="eyebrow">${label}</p><div class="chips">${options.map(([id, t]) =>
    `<button class="chip ${wiz[key] === id ? "active" : ""}" data-wiz="${key}" data-val="${id}">${esc(t)}</button>`).join("")}</div></div>`;
  const ids = WIZARD.map[`${wiz.light}-${wiz.subject}-${wiz.intent}`] || WIZARD.map[`${wiz.light}-${wiz.subject}-record`] || [];
  const found = ids.map((id) => data.scenes.find((s) => s.id === id)).filter(Boolean);
  return `<section class="card wizard">
    <h2>十秒決定拍哪一場</h2>
    <p>光線、主體、意圖各選一個。</p>
    <div class="grid-4" style="grid-template-columns:1fr;margin-top:16px">
      ${group("光線", "light", WIZARD.lights)}
      ${group("主體", "subject", WIZARD.subjects)}
      ${group("意圖", "intent", WIZARD.intents)}
    </div>
    ${found.length ? `<div class="chips" style="margin-top:16px">${found.map((s, i) =>
      `<a class="chip ${i === 0 ? "primary" : ""}" href="#/scene/${s.id}">${i === 0 ? "首選 " : ""}${esc(s.title)}</a>`).join("")}</div>` : ""}
  </section>`;
}

function matches(s) {
  if (state.filter === "favorites" && !state.fav.has(s.id)) return false;
  if (state.filter !== "all" && state.filter !== "favorites" && s.category !== state.filter) return false;
  const q = state.q.trim().toLowerCase();
  if (!q) return true;
  const blob = [s.title, s.summary, s.id, ...s.key.map((k) => k.label + k.value), ...s.notes].join(" ").toLowerCase();
  return blob.includes(q);
}

function home(data) {
  const list = data.scenes.filter(matches);
  const cats = [{ id: "all", label: "全部" }, { id: "favorites", label: "收藏" }, ...data.categories];
  return `<section class="hero">
      <div class="eyebrow">Field guide · v2 校正版</div>
      <h1>面對場景，先調這三個參數。</h1>
      <p>針對 iPhone 18 Pro 可變光圈、原生快門上限與夜間模式長曝重寫。光學光圈與人像景深已拆開，超過 1 秒會標明系統限制。</p>
    </section>
    ${hardware(data)}
    ${wizardHtml(data)}
    <div class="search">
      <input id="q" type="search" placeholder="搜尋場景、光圈、快門、銀河…" value="${esc(state.q)}">
      <span class="muted">${list.length} 場</span>
    </div>
    <div class="filters">${cats.map((c) =>
      `<button class="chip ${state.filter === c.id ? "active" : ""}" data-filter="${c.id}">${esc(c.label)}${c.id === "favorites" ? " " + state.fav.size : ""}</button>`).join("")}</div>
    <div class="chips" style="margin:8px 0 16px">
      <button class="chip" id="exportFav">匯出收藏</button>
      <label class="chip">匯入收藏<input id="importFav" type="file" accept="application/json" hidden></label>
    </div>
    ${list.length ? `<div class="scene-grid">${list.map(sceneCard).join("")}</div>` :
      `<div class="empty">沒有符合的場景。試試「夜」「水」「人像」。</div>`}`;
}

function sceneCard(s) {
  const on = state.fav.has(s.id);
  const warn = s.limits.filter((l) => l !== "native").map((l) => state.data.limits[l]).join(" · ");
  return `<article class="card scene">
    <button class="fav ${on ? "on" : ""}" data-fav="${s.id}" aria-label="收藏">${on ? "★" : "☆"}</button>
    <a href="#/scene/${s.id}">
      <img class="shot" src="examples/${s.id}.jpg" alt="">
      <div class="scene-body">
      <div class="muted">${esc(s.lenses.join(" · "))}</div>
      <h2>${esc(s.title)}</h2>
      <p class="muted">${esc(s.summary)}</p>
      <div class="pills">${s.key.map((k) => `<span class="pill"><span class="muted">${esc(k.label)}</span> ${esc(k.value)}</span>`).join("")}</div>
      ${warn ? `<p class="warn">${esc(warn)}</p>` : `<p class="muted" style="margin-top:10px;font-size:12px">現場查看完整步驟</p>`}
      </div>
    </a>
  </article>`;
}

function settingTable(title, hint, rows, cls, params) {
  return `<section>
    <h2>${title}</h2>
    <p class="muted">${hint}</p>
    <table><thead><tr><th>參數</th><th>設定</th><th class="hide-sm">原因</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td class="${cls}">${esc(params[r.id])}</td><td><strong>${esc(r.value)}</strong></td><td class="hide-sm">${esc(r.why)}</td></tr>`).join("")}</tbody></table>
    <div class="why-mobile">${rows.map((r) => `<p><strong>${esc(params[r.id])} — </strong>${esc(r.why)}</p>`).join("")}</div>
  </section>`;
}

function scenePage(data, id) {
  const s = data.scenes.find((x) => x.id === id);
  if (!s) return `<div class="empty"><h1>找不到這個場景</h1><p>請從列表重新選擇。</p><p><a class="btn solid" href="#/">回到場景</a></p></div>`;
  const on = state.fav.has(s.id);
  return `<a class="back" href="#/">← 全部場景</a>
    <header class="detail-head">
      <div>
        <div class="muted">${esc(s.lenses.join(" · "))}</div>
        <h1>${esc(s.title)}</h1>
        <p class="muted">${esc(s.summary)}</p>
      </div>
      <div class="actions">
        <button class="btn" data-fav="${s.id}">${on ? "已收藏" : "收藏"}</button>
        <button class="btn" id="shareBtn">分享連結</button>
        <button class="btn solid" id="copyBtn">複製清單</button>
      </div>
    </header>
    <img class="shot" src="examples/${s.id}.jpg" alt="">
    <div class="pills" style="margin:16px 0">${s.limits.map((l) => `<span class="pill ${l === "native" ? "" : "warn"}">${esc(data.limits[l])}</span>`).join("")}</div>
    <section class="quick">
      <div class="eyebrow">現場三步</div>
      <div class="pills" style="margin-top:10px">${s.key.map((k) => `<span class="pill">${esc(k.label)} ${esc(k.value)}</span>`).join("")}</div>
      ${s.recipe ? `<p class="muted" style="margin-top:12px">風格配方　${esc(s.recipe)}</p>` : ""}
    </section>
    <h2>建議鏡頭</h2>
    <div class="lenses">${s.lenses.map((id) => {
      const v = data.lenses[id];
      return `<div class="card"><b>${esc(id)} · ${esc(v.mm)}</b><p>${esc(v.aperture)}</p><p>${esc(v.note)}</p></div>`;
    }).join("")}</div>
    ${settingTable("必須", "這場不調就容易拍壞。閃光燈關、4:3 已視為全域預設。", s.must, "must", data.params)}
    ${settingTable("選項", "按光線、後期與口味再打開。", s.options, "opt", data.params)}
    <h2>Camera Control 操作順序</h2>
    <div class="flow">${s.flow.map((step, i) => `<span><b>${i + 1}</b>${esc(step)}</span>`).join("")}</div>
    <h2>注意</h2>
    <ul class="notes">${s.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
}

function gearPage(data) {
  const H = data.hardware;
  return `<div class="gear">
    <div class="eyebrow">iPhone 18 Pro</div>
    <h1>硬體與系統限制</h1>
    <p class="muted">場景參數都建立在這些事實上。超過限制的建議會標成夜間模式或第三方 App。</p>
    <h2>可變光圈</h2>
    <p>主鏡（1x / 24mm）六葉光圈可選 ${esc(H.apertures.join("、"))}。超廣角 f/2.2、長焦 f/2.8 固定。這是光學進光與光學景深，不是人像模式裡那條 Depth 滑桿。</p>
    <ul>
      <li><strong>f/1.48</strong> — 弱光、夜間、光學散景。人像小心耳朵與頭髮失焦。</li>
      <li><strong>f/1.8</strong> — 日常與人像起點。</li>
      <li><strong>f/2.8</strong> — 前後都清楚，或開始出現星芒。</li>
      <li><strong>f/4.0</strong> — 風景大景深、星芒、白天 24p 減光（代替 ND）。</li>
    </ul>
    <h2>三條曝光路徑</h2>
    <article class="card"><h3>1. 原生 Pro 快門</h3><p>${esc(H.shutterNote)}</p></article>
    <article class="card"><h3>2. 夜間模式時間</h3><p>弱光自動出現。腳架上可到約 10–30 秒，這才是銀河、車軌、超長流水的通道。</p></article>
    <article class="card"><h3>3. 第三方 App</h3><p>需要穩定 2–15 秒單張時用 Halide、ProCamera 等。</p></article>
    <h2>鏡頭</h2>
    ${Object.entries(data.lenses).map(([id, v]) => `<article class="card"><b>${esc(id)} · ${esc(v.mm)}</b><p>${esc(v.aperture)}</p><p>${esc(v.note)}</p></article>`).join("")}
    <h2>風格、格式、預設</h2>
    <p>${esc(H.styles)}</p>
    <p>${esc(H.formats)}</p>
    <ul>${H.globalDefaults.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
    <h2>影片（24p）</h2>
    <p>24fps 配 1/48 或 1/50 快門。晴天收到 f/4，多數情況不必再夾 ND。運動改 4K60 + 約 1/120。</p>
  </div>`;
}

function render() {
  if (!state.data) return;
  const r = route();
  $("#navScenes")?.classList.toggle("active", r.name === "home");
  $("#navGear")?.classList.toggle("active", r.name === "gear");
  if (r.name === "gear") app.innerHTML = gearPage(state.data);
  else if (r.name === "scene") app.innerHTML = scenePage(state.data, r.id);
  else app.innerHTML = home(state.data);

  $("#q")?.addEventListener("input", (e) => { state.q = e.target.value; render(); });
  $("#copyBtn")?.addEventListener("click", () => {
    const s = state.data.scenes.find((x) => x.id === r.id);
    if (s) copyScene(s);
  });
  $("#shareBtn")?.addEventListener("click", async () => {
    const url = location.href.split("#")[0] + "#/scene/" + r.id;
    await navigator.clipboard.writeText(url);
    const b = $("#shareBtn");
    if (b) { const t = b.textContent; b.textContent = "連結已複製"; setTimeout(() => (b.textContent = t), 1400); }
  });
  $("#exportFav")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ version: 2, ids: [...state.fav] }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "iphone18pro-favorites.json";
    a.click();
  });
  $("#importFav")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const ids = data.ids || data;
      if (!Array.isArray(ids)) throw new Error("bad");
      state.fav = new Set(ids.filter((id) => typeof id === "string"));
      saveFav();
      render();
    } catch { alert("匯入失敗"); }
  });
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-filter]");
  if (t) { state.filter = t.dataset.filter; render(); return; }
  const f = e.target.closest("[data-fav]");
  if (f) { e.preventDefault(); toggleFav(f.dataset.fav); return; }
  const w = e.target.closest("[data-wiz]");
  if (w) { wiz[w.dataset.wiz] = w.dataset.val; render(); return; }
  const th = e.target.closest("[data-theme]");
  if (th && th.tagName === "BUTTON") setTheme(th.dataset.theme);
});

window.addEventListener("hashchange", render);

async function init() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) setTheme(saved);
  else setTheme("light");
  try {
    const res = await fetch("guide.json");
    if (!res.ok) throw new Error("guide.json 載入失敗");
    state.data = await res.json();
    render();
  } catch (err) {
    app.innerHTML = `<div class="error">無法載入場景資料。請確認 guide.json 與網頁在同一資料夾。<br>${esc(err.message)}</div>`;
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
init();
