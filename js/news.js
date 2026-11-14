import { $, escapeHTML, formatDateTime, relativeTime, isMissingTable, emptyText } from "./lib.js";

let items = [];
let filter = "all";
let loadError = "";

/** "upcoming" | "live" | "ended" | null (not an event or no dates). */
export function eventPhase(a, now = Date.now()) {
  if (a.kind !== "event" || !a.starts_at) return null;
  const start = new Date(a.starts_at).getTime();
  const end = a.ends_at ? new Date(a.ends_at).getTime() : start + 2 * 3600_000;
  if (now < start) return "upcoming";
  if (now <= end) return "live";
  return "ended";
}

const PHASE_LABEL = { upcoming: "Sắp diễn ra", live: "Đang diễn ra", ended: "Đã kết thúc" };

export function newsCard(a, { compact = false } = {}) {
  const phase = eventPhase(a);
  const cover = a.cover_url && /^https:\/\//.test(a.cover_url)
    ? `<img class="news-cover" src="${escapeHTML(a.cover_url)}" alt="" loading="lazy" />` : "";
  const when = a.kind === "event" && a.starts_at
    ? `<span><b>Thời gian:</b> ${escapeHTML(formatDateTime(a.starts_at))}${a.ends_at ? ` → ${escapeHTML(formatDateTime(a.ends_at))}` : ""}</span>` : "";
  const body = compact && a.body.length > 220 ? `${a.body.slice(0, 220)}…` : a.body;
  return `<article class="panel news-card${cover ? "" : " no-cover"}">${cover}<div>
    <div class="news-meta">
      ${a.pinned ? '<span class="label label-new">Ghim</span>' : ""}
      <span class="label ${a.kind === "event" ? "label-event" : "label-new"}">${a.kind === "event" ? "Event" : "Thông báo"}</span>
      ${phase ? `<span class="label label-${phase === "live" ? "done" : phase === "upcoming" ? "in_progress" : "rejected"}">${PHASE_LABEL[phase]}</span>` : ""}
      ${when}<span>${escapeHTML(relativeTime(a.created_at))}</span>
    </div>
    <h3>${escapeHTML(a.title)}</h3>
    <p class="news-body">${escapeHTML(body)}</p>
  </div></article>`;
}

/** Pinned first, then live/upcoming events by start, then newest. */
export function sortNews(list) {
  const rank = (a) => (a.pinned ? 0 : ({ live: 1, upcoming: 2 }[eventPhase(a)] ?? 3));
  return [...list].sort((a, b) => rank(a) - rank(b)
    || (rank(a) <= 2 && a.starts_at && b.starts_at ? new Date(a.starts_at) - new Date(b.starts_at) : 0)
    || new Date(b.created_at) - new Date(a.created_at));
}

function render() {
  const list = sortNews(items).filter((a) => filter === "all" || a.kind === filter);
  $("newsList").innerHTML = list.length
    ? list.map((a) => newsCard(a)).join("")
    : `<p class="panel table-message">${emptyText(loadError, "Chưa có tin nào. Admin sẽ đăng thông báo và event ở đây.")}</p>`;

  // Home: pinned items and live/upcoming events, at most 2.
  const highlight = sortNews(items).filter((a) => a.pinned || ["live", "upcoming"].includes(eventPhase(a))).slice(0, 2);
  $("homeNewsSection").classList.toggle("hide", highlight.length === 0);
  $("homeNews").innerHTML = highlight.map((a) => newsCard(a, { compact: true })).join("");
}

export async function initNews(client) {
  $("newsChips").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-news]");
    if (!chip) return;
    filter = chip.dataset.news;
    $("newsChips").querySelectorAll("[data-news]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    render();
  });
  if (!client) { loadError = "no client"; render(); return; }
  const { data, error } = await client.from("announcements")
    .select("id,kind,title,body,cover_url,starts_at,ends_at,pinned,created_at")
    .order("created_at", { ascending: false }).limit(100);
  loadError = error ? (isMissingTable(error) ? "setup" : error.message) : "";
  items = data || [];
  render();
}
