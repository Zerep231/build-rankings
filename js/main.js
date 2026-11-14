import { SERVER, joinAddress } from "../data/server.js";
import { COMMANDS, COMMAND_GROUPS } from "../data/commands.js";
import { TYPES, maxPoints, PLAN_SCALE } from "../data/scoring.js";
import { STATUS_API } from "../data/config.js";
import { $, escapeHTML, formatBP, formatDate, avatar, bindCopy, rankPlayers } from "./lib.js";
import { getClient, fetchAllScores, supabaseConfigured } from "./supabase.js";
import { initAccount } from "./account.js";
import { initNews } from "./news.js";
import { initGallery } from "./gallery.js";
import { initFeedback } from "./feedback.js";

const PAGES = ["home", "news", "join", "commands", "rank", "history", "gallery", "feedback", "rules"];
const params = new URLSearchParams(location.search);
let records = [];
let loadError = "";

/* ---------------- Routing (hash based, deep-linkable) ---------------- */
function showPage(id, focus) {
  const page = PAGES.includes(id) ? id : "home";
  for (const p of PAGES) $(p).classList.toggle("hide", p !== page);
  document.querySelectorAll(".primary-nav a").forEach((a) => {
    if (a.getAttribute("href") === `#${page}`) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("primaryNav").classList.remove("open");
  $("navToggle").setAttribute("aria-expanded", "false");
  if (focus) {
    window.scrollTo({ top: 0 });
    $("main").focus({ preventScroll: true });
  }
}
window.addEventListener("hashchange", () => showPage(location.hash.slice(1), true));
showPage(location.hash.slice(1), false);

$("navToggle").addEventListener("click", () => {
  const open = $("primaryNav").classList.toggle("open");
  $("navToggle").setAttribute("aria-expanded", String(open));
});

/* ---------------- Server info ---------------- */
const javaAddr = joinAddress(SERVER.javaHost, SERVER.javaPort, 25565);
const bedrockAddr = SERVER.bedrockHost ? `${SERVER.bedrockHost}:${SERVER.bedrockPort}` : "";
$("tagline").textContent = SERVER.tagline;
$("javaAddress").textContent = javaAddr || "Chưa cập nhật";
$("bedrockAddress").textContent = bedrockAddr || "Chưa cập nhật";
$("statusVersion").textContent = SERVER.version;
$("joinJava").textContent = javaAddr || "Chưa cập nhật";
$("joinBedrockHost").textContent = SERVER.bedrockHost || "Chưa cập nhật";
$("joinBedrockPort").textContent = SERVER.bedrockPort || "-";
$("joinClientVersion").textContent = SERVER.clientVersion || "mới nhất";
for (const id of ["heroCopyJava", "copyJava", "joinCopyJava"]) bindCopy($(id), () => javaAddr);
for (const id of ["copyBedrock", "joinCopyBedrock"]) bindCopy($(id), () => bedrockAddr);

const ICONS = {
  grass: '<svg class="feature-icon" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><rect width="8" height="3" fill="#6fbf45"/><rect y="3" width="8" height="5" fill="#8a5a33"/><rect x="1" y="3" width="1" height="1" fill="#6fbf45"/><rect x="5" y="3" width="1" height="2" fill="#6fbf45"/><rect x="3" y="5" width="1" height="1" fill="#6a4223"/><rect x="6" y="6" width="1" height="1" fill="#6a4223"/></svg>',
  pickaxe: '<svg class="feature-icon" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><path fill="#9aa3b5" d="M1 0h5v1H1zM6 1h1v1H6zM7 2h1v3H7zM0 1h1v1H0z"/><path fill="#8a5a33" d="M5 2h1v1H5zM4 3h1v1H4zM3 4h1v1H3zM2 5h1v1H2zM1 6h1v1H1zM0 7h1v1H0z"/></svg>',
  heart: '<svg class="feature-icon" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><path fill="#d8433b" d="M1 1h2v1H1zM5 1h2v1H5zM0 2h8v2H0zM1 4h6v1H1zM2 5h4v1H2zM3 6h2v1H3z"/><path fill="#ff8a80" d="M1 2h1v1H1z"/></svg>',
};
$("highlights").innerHTML = SERVER.highlights.map((h) =>
  `<article class="panel feature"><h3>${ICONS[h.icon] || ""}${escapeHTML(h.title)}</h3><p class="muted">${escapeHTML(h.text)}</p></article>`).join("");

/* ---------------- Live status (api.mcsrvstat.us) ---------------- */
async function refreshStatus() {
  const pill = $("statusPill");
  try {
    const res = await fetch(STATUS_API + encodeURIComponent(javaAddr), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const s = await res.json();
    if (s.online) {
      pill.dataset.state = "online";
      $("statusText").textContent = "Đang mở cửa";
      $("statusPlayers").textContent = s.players ? `${s.players.online} / ${s.players.max}` : "-";
      $("statusNote").textContent = "Cập nhật tự động mỗi phút.";
    } else {
      pill.dataset.state = "offline";
      $("statusText").textContent = "Đang tạm nghỉ";
      $("statusPlayers").textContent = "0";
      $("statusNote").textContent = "Server đang tắt hoặc bảo trì. Quay lại sau nhé!";
    }
  } catch {
    // Unknown is not the same as offline: never claim the server is down when we could not check.
    pill.dataset.state = "unknown";
    $("statusText").textContent = "Chưa kiểm tra được";
    $("statusNote").textContent = "Không lấy được trạng thái lúc này. Bạn vẫn có thể thử vào server.";
  }
}
if (javaAddr) {
  refreshStatus();
  setInterval(() => { if (!document.hidden) refreshStatus(); }, 60_000);
}

/* ---------------- Commands ---------------- */
let commandGroup = COMMAND_GROUPS.includes(params.get("group")) ? params.get("group") : "all";
$("commandSearch").value = params.get("cmd") || "";
$("commandChips").innerHTML = [["all", "Tất cả"], ...COMMAND_GROUPS.map((g) => [g, g])]
  .map(([value, label]) => `<button class="chip" type="button" data-group="${escapeHTML(value)}" aria-pressed="${value === commandGroup}">${escapeHTML(label)}</button>`).join("");

function saveParam(key, value, fallback) {
  const url = new URL(location.href);
  if (value && value !== fallback) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  history.replaceState(null, "", url);
}

function renderCommands() {
  const q = $("commandSearch").value.trim().toLocaleLowerCase("vi");
  const groups = COMMAND_GROUPS.filter((g) => commandGroup === "all" || g === commandGroup);
  const html = groups.map((g) => {
    const items = COMMANDS.filter((c) => c.group === g && (!q || `${c.command} ${c.description}`.toLocaleLowerCase("vi").includes(q)));
    if (!items.length) return "";
    return `<section class="command-group"><h2>${escapeHTML(g)}</h2><div class="command-grid">${items.map((c) =>
      `<article class="panel panel-tight command-card${c.featured ? " featured" : ""}"><code>${escapeHTML(c.command)}</code><p>${escapeHTML(c.description)}</p><button class="btn btn-small" type="button" data-copy="${escapeHTML(c.command)}">Sao chép</button></article>`).join("")}</div></section>`;
  }).join("");
  $("commandList").innerHTML = html || '<p class="table-message">Không tìm thấy lệnh phù hợp. Thử từ khóa khác nhé.</p>';
  $("commandList").querySelectorAll("[data-copy]").forEach((b) => bindCopy(b, () => b.dataset.copy));
}
$("commandSearch").addEventListener("input", () => { saveParam("cmd", $("commandSearch").value.trim(), ""); renderCommands(); });
$("commandChips").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-group]");
  if (!chip) return;
  commandGroup = chip.dataset.group;
  $("commandChips").querySelectorAll("[data-group]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
  saveParam("group", commandGroup, "all");
  renderCommands();
});
renderCommands();

/* ---------------- Rules: BP rubric ---------------- */
$("rubric").innerHTML = Object.values(TYPES).map((t) =>
  `<section class="panel"><h3>${escapeHTML(t.name)}: tối đa ${maxPoints(t)} BP</h3><table>${t.criteria.map(([label, cap]) => `<tr><td>${escapeHTML(label)}</td><td>${cap} BP</td></tr>`).join("")}</table></section>`).join("")
  + `<section class="panel"><h3>Quy mô quy hoạch</h3><table>${PLAN_SCALE.map(([a, b]) => `<tr><td>${escapeHTML(a)}</td><td>${escapeHTML(b)}</td></tr>`).join("")}</table><p class="muted" style="margin-top: var(--space-3)">Quy mô tham khảo lần lượt là 3 đến 5, 6 đến 12, 13 đến 25, 26 đến 50 và trên 50 công trình. Chất lượng tổng thể vẫn quyết định điểm.</p></section>`;

/* ---------------- Scores: ranking, top 5, history ---------------- */
const categoryOptions = `<option value="all">Tất cả hạng mục</option>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${escapeHTML(v.name)}</option>`).join("")}`;
const validCategory = (v) => (v && (v === "all" || TYPES[v]) ? v : "all");
$("rankCategory").innerHTML = categoryOptions;
$("historyCategory").innerHTML = categoryOptions;
$("rankCategory").value = validCategory(params.get("rankGroup"));
$("historyCategory").value = validCategory(params.get("historyGroup"));
$("rankSearch").value = params.get("rank") || "";
$("historySearch").value = params.get("history") || "";

const emptyRow = (cols, text) => `<tr><td colspan="${cols}" class="table-message">${escapeHTML(text)}</td></tr>`;
const playerCell = (name) => `<button class="player-button" type="button" data-player="${escapeHTML(name)}">${avatar(name)}<span>${escapeHTML(name)}</span></button>`;

function renderScores() {
  const failText = loadError ? "Không tải được bảng điểm. Thử tải lại trang nhé." : null;

  const top = rankPlayers(records).slice(0, 5);
  $("topFive").innerHTML = top.length
    ? top.map((p, i) => `<tr><td><span class="rank-badge" data-rank="${i + 1}">${i + 1}</span></td><td>${playerCell(p.name)}</td><td class="num"><b>${formatBP(p.total)}</b></td><td class="num">${p.count}</td></tr>`).join("")
    : emptyRow(4, failText || "Chưa có công trình nào được chấm.");

  const cat = $("rankCategory").value;
  const inCat = records.filter((r) => cat === "all" || r.category === cat);
  const players = rankPlayers(inCat);
  $("playersCount").textContent = players.length;
  $("reviewsCount").textContent = inCat.length;
  $("totalBP").textContent = formatBP(inCat.reduce((s, r) => s + (Number(r.points) || 0), 0));

  const q = $("rankSearch").value.trim().toLocaleLowerCase("vi");
  const order = [2, 1, 3]; // silver, gold, bronze
  $("podium").innerHTML = q ? "" : order.map((rank) => players[rank - 1]).map((p, i) => p
    ? `<button class="panel podium-step" type="button" data-rank="${order[i]}" data-player="${escapeHTML(p.name)}"><span class="rank-badge" data-rank="${order[i]}">${order[i]}</span>${avatar(p.name, 56)}<strong>${escapeHTML(p.name)}</strong><span class="points">${formatBP(p.total)} BP</span></button>`
    : "<span></span>").join("");

  const ranked = players.map((p, i) => ({ ...p, rank: i + 1 })).filter((p) => p.name.toLocaleLowerCase("vi").includes(q));
  $("leaderboard").innerHTML = ranked.length
    ? ranked.map((p) => `<tr><td><span class="rank-badge" data-rank="${p.rank}">${p.rank}</span></td><td>${playerCell(p.name)}</td><td class="num"><b>${formatBP(p.total)}</b></td><td class="num">${p.count}</td></tr>`).join("")
    : emptyRow(4, failText || "Chưa có builder phù hợp với bộ lọc.");

  const hq = $("historySearch").value.trim().toLocaleLowerCase("vi");
  const hc = $("historyCategory").value;
  const hist = records.filter((r) => (hc === "all" || r.category === hc)
    && (!hq || `${r.player_name} ${r.project_name}`.toLocaleLowerCase("vi").includes(hq)));
  $("historyRows").innerHTML = hist.length
    ? hist.map((r) => `<tr><td>${formatDate(r.created_at)}</td><td>${playerCell(r.player_name)}</td><td>${escapeHTML(r.project_name)}</td><td><span class="tag">${escapeHTML(TYPES[r.category]?.name || r.category)}</span></td><td class="num"><b>${formatBP(r.points)}</b></td><td><button class="btn btn-small" type="button" data-detail="${escapeHTML(r.id)}">Xem</button></td></tr>`).join("")
    : emptyRow(6, failText || "Chưa có lượt chấm phù hợp với bộ lọc.");
}

for (const [input, key, fallback] of [["rankSearch", "rank", ""], ["historySearch", "history", ""]]) {
  $(input).addEventListener("input", () => { saveParam(key, $(input).value.trim(), fallback); renderScores(); });
}
for (const [select, key] of [["rankCategory", "rankGroup"], ["historyCategory", "historyGroup"]]) {
  $(select).addEventListener("change", () => { saveParam(key, $(select).value, "all"); renderScores(); });
}

/* ---------------- Detail modal ---------------- */
function breakdown(r) {
  const t = TYPES[r.category];
  if (!t) return "";
  const v = Array.isArray(r.criteria_scores) ? r.criteria_scores : [];
  return `<h3>${escapeHTML(r.project_name)}</h3><p class="muted">${formatDate(r.created_at)} · <span class="tag">${escapeHTML(t.name)}</span> · <b>${formatBP(r.points)} / ${maxPoints(t)} BP</b></p>`
    + t.criteria.map(([label, cap], i) => {
      const n = Number(v[i] || 0);
      return `<div class="rubric-row"><div class="row"><span>${escapeHTML(label)}</span><b>${n} / ${cap}</b></div><div class="meter"><i style="width:${Math.max(0, Math.min(100, (n / cap) * 100))}%"></i></div></div>`;
    }).join("")
    + `<p><b>Nhận xét:</b> ${escapeHTML(r.note || "Chưa có nhận xét")}</p>`;
}

let lastFocus = null;
function openModal(html) {
  lastFocus = document.activeElement;
  if (html !== null) $("detailBody").innerHTML = html;
  $("detailModal").classList.remove("hide");
  document.querySelector(".site-header").inert = true;
  $("main").inert = true;
  $("closeDetail").focus();
}
function closeModal() {
  $("detailModal").classList.add("hide");
  document.querySelector(".site-header").inert = false;
  $("main").inert = false;
  lastFocus?.focus();
}
$("closeDetail").addEventListener("click", closeModal);
$("detailModal").addEventListener("click", (e) => { if (e.target === $("detailModal")) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("detailModal").classList.contains("hide")) closeModal(); });

document.addEventListener("click", (e) => {
  const player = e.target.closest("[data-player]");
  if (player) {
    const name = player.dataset.player;
    const list = records.filter((r) => String(r.player_name).toLowerCase() === name.toLowerCase());
    const total = list.reduce((s, r) => s + (Number(r.points) || 0), 0);
    openModal(`<h2 id="detailTitle" style="display:flex;align-items:center;gap:.75rem">${avatar(name, 40)}${escapeHTML(name)}</h2><p><b>${formatBP(total)} BP</b> từ ${list.length} công trình</p>${list.map(breakdown).join("<hr>")}`);
    return;
  }
  const detail = e.target.closest("[data-detail]");
  if (detail) {
    const r = records.find((x) => String(x.id) === detail.dataset.detail);
    if (r) openModal(`<h2 id="detailTitle">${escapeHTML(r.player_name)}</h2>${breakdown(r)}`);
  }
});

/* ---------------- Load ---------------- */
async function loadScores() {
  if (!supabaseConfigured) {
    loadError = "Chưa cấu hình Supabase";
    renderScores();
    return;
  }
  try {
    const client = await getClient();
    records = await fetchAllScores(client);
    loadError = "";
  } catch (error) {
    console.error("Could not load scores", error);
    loadError = String(error?.message || error);
  }
  renderScores();
}
window.addEventListener("open-detail", () => openModal(null)); // gallery lightbox

renderScores();
loadScores();

// Accounts, news, gallery and feedback share one Supabase client.
getClient().then((client) => {
  initAccount(client);
  initNews(client);
  initGallery(client);
  initFeedback(client);
}).catch((error) => {
  console.error("Could not start Supabase", error);
  initAccount(null);
  initNews(null);
  initGallery(null);
  initFeedback(null);
});
