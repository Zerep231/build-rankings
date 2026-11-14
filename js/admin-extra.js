import { GALLERY_BUCKET } from "../data/config.js";
import { $, escapeHTML, formatDateTime, relativeTime, friendlyError, isMissingTable } from "./lib.js";
import { namesFor } from "./profiles.js";

const STATUS = { new: "Mới", in_progress: "Đang xử lý", done: "Đã xong", rejected: "Không thực hiện" };
let client = null;
let started = false;
const setupHint = '<p class="notice warning">Chưa chạy <code>supabase-v2.sql</code> trên Supabase, nên mục này chưa dùng được.</p>';

/* ---------------- Tabs ---------------- */
function showTab(name) {
  document.querySelectorAll("#adminTabs [data-tab]").forEach((t) => {
    const on = t.dataset.tab === name;
    t.setAttribute("aria-selected", String(on));
    t.setAttribute("aria-pressed", String(on));
  });
  document.querySelectorAll("[data-panel]").forEach((p) => p.classList.toggle("hide", p.dataset.panel !== name));
  ({ news: loadNews, photos: loadPhotos, tickets: loadTickets, players: loadPlayers })[name]?.();
}

/* ---------------- Announcements ---------------- */
let news = [];
// <input type="datetime-local"> works in local time; convert to/from ISO (UTC) for the database.
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

function resetNewsForm() {
  $("annForm").reset();
  $("annId").value = "";
  $("annSave").textContent = "Đăng";
  $("annCancel").classList.add("hide");
  $("annEventTimes").classList.add("hide");
}

async function loadNews() {
  const { data, error } = await client.from("announcements")
    .select("id,kind,title,body,cover_url,starts_at,ends_at,pinned,created_at").order("created_at", { ascending: false });
  if (error) { $("annRows").innerHTML = isMissingTable(error) ? setupHint : `<p>${escapeHTML(friendlyError(error))}</p>`; return; }
  news = data || [];
  $("annRows").innerHTML = news.map((a) => `<div class="manage-row">
      <span>${a.pinned ? '<span class="label label-new">Ghim</span> ' : ""}<span class="label ${a.kind === "event" ? "label-event" : "label-new"}">${a.kind === "event" ? "Event" : "Thông báo"}</span>
      <b>${escapeHTML(a.title)}</b> · ${a.starts_at ? escapeHTML(formatDateTime(a.starts_at)) : escapeHTML(relativeTime(a.created_at))}</span>
      <span><button class="btn btn-small" type="button" data-edit-ann="${a.id}">Sửa</button><button class="btn btn-small btn-danger" type="button" data-del-ann="${a.id}">Xóa</button></span>
    </div>`).join("") || '<p class="muted">Chưa có thông báo nào.</p>';
}

function bindNews() {
  $("annKind").addEventListener("change", () => $("annEventTimes").classList.toggle("hide", $("annKind").value !== "event"));
  $("annCancel").addEventListener("click", resetNewsForm);
  $("annForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = (t) => { $("annStatus").textContent = t; };
    const kind = $("annKind").value;
    const title = $("annTitleInput").value.trim();
    const cover = $("annCover").value.trim();
    const starts = kind === "event" ? fromLocalInput($("annStart").value) : null;
    const ends = kind === "event" ? fromLocalInput($("annEnd").value) : null;
    if (!title) { $("annTitleInput").focus(); return status("Nhập tiêu đề."); }
    if (cover && !/^https:\/\//.test(cover)) { $("annCover").focus(); return status("Link ảnh bìa phải bắt đầu bằng https://"); }
    if (kind === "event" && !starts) { $("annStart").focus(); return status("Event cần thời gian bắt đầu."); }
    if (starts && ends && ends < starts) { $("annEnd").focus(); return status("Thời gian kết thúc phải sau khi bắt đầu."); }
    const row = { kind, title, body: $("annBody").value.trim(), cover_url: cover || null, starts_at: starts, ends_at: ends, pinned: $("annPinned").checked };
    const id = $("annId").value;
    $("annSave").disabled = true;
    const { error } = id ? await client.from("announcements").update(row).eq("id", id) : await client.from("announcements").insert(row);
    $("annSave").disabled = false;
    if (error) return status(friendlyError(error));
    status(id ? "Đã lưu thay đổi." : "Đã đăng.");
    resetNewsForm();
    loadNews();
  });
  $("annRows").addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit-ann]");
    if (edit) {
      const a = news.find((x) => x.id === edit.dataset.editAnn);
      if (!a) return;
      $("annId").value = a.id;
      $("annKind").value = a.kind;
      $("annTitleInput").value = a.title;
      $("annBody").value = a.body;
      $("annCover").value = a.cover_url || "";
      $("annStart").value = toLocalInput(a.starts_at);
      $("annEnd").value = toLocalInput(a.ends_at);
      $("annPinned").checked = a.pinned;
      $("annEventTimes").classList.toggle("hide", a.kind !== "event");
      $("annSave").textContent = "Lưu thay đổi";
      $("annCancel").classList.remove("hide");
      $("annTitleInput").focus();
      return;
    }
    const del = e.target.closest("[data-del-ann]");
    if (del && confirm("Xóa thông báo này? Không thể hoàn tác.")) {
      const { error } = await client.from("announcements").delete().eq("id", del.dataset.delAnn);
      if (error) alert(friendlyError(error));
      loadNews();
    }
  });
}

/* ---------------- Photo moderation ---------------- */
let photos = [];
async function loadPhotos() {
  let q = client.from("gallery_posts").select("id,user_id,title,caption,image_path,hidden,report_count,created_at")
    .order("created_at", { ascending: false }).limit(200);
  if ($("photoOnlyFlagged").checked) q = q.or("hidden.eq.true,report_count.gt.0");
  const { data, error } = await q;
  if (error) { $("photoRows").innerHTML = isMissingTable(error) ? setupHint : `<p>${escapeHTML(friendlyError(error))}</p>`; return; }
  photos = data || [];
  const nameOf = await namesFor(client, photos.map((p) => p.user_id));
  const url = (p) => client.storage.from(GALLERY_BUCKET).getPublicUrl(p).data.publicUrl;
  $("photoRows").innerHTML = photos.map((p) => `<article class="panel panel-tight photo-card">
      <img src="${escapeHTML(url(p.image_path))}" alt="${escapeHTML(p.title)}" loading="lazy" />
      <h3>${escapeHTML(p.title)}</h3>
      <p class="photo-meta">${escapeHTML(nameOf(p.user_id))} · ${escapeHTML(relativeTime(p.created_at))} · ${p.report_count} báo cáo ${p.hidden ? '<span class="label label-private">Đang ẩn</span>' : ""}</p>
      <span><button class="btn btn-small" type="button" data-toggle-photo="${p.id}">${p.hidden ? "Hiện lại" : "Ẩn"}</button><button class="btn btn-small btn-danger" type="button" data-del-photo="${p.id}">Xóa</button></span>
    </article>`).join("") || '<p class="muted">Không có ảnh nào cần xem.</p>';
}

function bindPhotos() {
  $("photoOnlyFlagged").addEventListener("change", loadPhotos);
  $("photoRows").addEventListener("click", async (e) => {
    const toggle = e.target.closest("[data-toggle-photo]");
    if (toggle) {
      const p = photos.find((x) => x.id === toggle.dataset.togglePhoto);
      // Showing a post again also clears its reports counter.
      const { error } = await client.from("gallery_posts").update(p.hidden ? { hidden: false, report_count: 0 } : { hidden: true }).eq("id", p.id);
      if (error) alert(friendlyError(error));
      loadPhotos();
      return;
    }
    const del = e.target.closest("[data-del-photo]");
    if (del) {
      const p = photos.find((x) => x.id === del.dataset.delPhoto);
      if (!p || !confirm(`Xóa hẳn ảnh "${p.title}"? Không thể hoàn tác.`)) return;
      const { error } = await client.from("gallery_posts").delete().eq("id", p.id);
      if (error) { alert(friendlyError(error)); return; }
      await client.storage.from(GALLERY_BUCKET).remove([p.image_path]);
      loadPhotos();
    }
  });
}

/* ---------------- Tickets ---------------- */
let tickets = [];
async function loadTickets() {
  let q = client.from("tickets").select("id,user_id,kind,title,body,is_private,status,admin_reply,vote_count,created_at")
    .order("created_at", { ascending: false }).limit(300);
  const f = $("tkFilter").value;
  if (f === "open") q = q.in("status", ["new", "in_progress"]);
  else if (f !== "all") q = q.eq("status", f);
  const { data, error } = await q;
  if (error) { $("tkRows").innerHTML = isMissingTable(error) ? setupHint : `<p>${escapeHTML(friendlyError(error))}</p>`; return; }
  tickets = data || [];
  const nameOf = await namesFor(client, tickets.map((t) => t.user_id));
  $("tkRows").innerHTML = tickets.map((t) => `<article class="panel panel-tight">
      <div class="news-meta"><span class="label label-${t.kind}">${t.kind === "bug" ? "Báo lỗi" : "Đề xuất"}</span>
        ${t.is_private ? '<span class="label label-private">Chỉ admin xem</span>' : ""}
        <span>${escapeHTML(nameOf(t.user_id))} · ${escapeHTML(relativeTime(t.created_at))} · ${t.vote_count} ủng hộ</span></div>
      <h3>${escapeHTML(t.title)}</h3>
      <p class="ticket-body">${escapeHTML(t.body)}</p>
      <form class="grid-2" data-ticket="${t.id}" style="gap: var(--space-3)">
        <div class="field" style="margin:0"><label for="st-${t.id}">Trạng thái</label>
          <select id="st-${t.id}" name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === t.status ? " selected" : ""}>${v}</option>`).join("")}</select></div>
        <label class="check-row" style="align-self:end"><input type="checkbox" name="is_private"${t.is_private ? " checked" : ""} /> Chỉ admin xem</label>
        <div class="field" style="margin:0; grid-column: 1 / -1"><label for="rp-${t.id}">Trả lời công khai</label>
          <textarea id="rp-${t.id}" name="admin_reply" rows="2" maxlength="2000">${escapeHTML(t.admin_reply || "")}</textarea></div>
        <span><button class="btn btn-small btn-primary" type="submit">Lưu</button><button class="btn btn-small btn-danger" type="button" data-del-ticket="${t.id}">Xóa</button></span>
      </form>
    </article>`).join("") || '<p class="muted">Không có góp ý nào.</p>';
}

function bindTickets() {
  $("tkFilter").addEventListener("change", loadTickets);
  $("tkRows").addEventListener("submit", async (e) => {
    const form = e.target.closest("[data-ticket]");
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form);
    const { error } = await client.from("tickets").update({
      status: fd.get("status"),
      is_private: fd.get("is_private") === "on",
      admin_reply: String(fd.get("admin_reply") || "").trim() || null,
    }).eq("id", form.dataset.ticket);
    if (error) alert(friendlyError(error));
    loadTickets();
  });
  $("tkRows").addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del-ticket]");
    if (del && confirm("Xóa góp ý này? Không thể hoàn tác.")) {
      const { error } = await client.from("tickets").delete().eq("id", del.dataset.delTicket);
      if (error) alert(friendlyError(error));
      loadTickets();
    }
  });
}

/* ---------------- Players ---------------- */
let players = [];
async function loadPlayers() {
  const { data, error } = await client.from("profiles").select("id,username,is_banned,created_at").order("created_at", { ascending: false }).limit(1000);
  if (error) { $("plRows").innerHTML = isMissingTable(error) ? setupHint : `<p>${escapeHTML(friendlyError(error))}</p>`; return; }
  players = data || [];
  renderPlayers();
}
function renderPlayers() {
  const q = $("plSearch").value.trim().toLowerCase();
  $("plRows").innerHTML = players.filter((p) => !q || p.username.toLowerCase().includes(q)).map((p) => `<div class="manage-row">
      <span><b>${escapeHTML(p.username)}</b> · tham gia ${escapeHTML(relativeTime(p.created_at))} ${p.is_banned ? '<span class="label label-private">Đã khóa</span>' : ""}</span>
      <span><button class="btn btn-small" type="button" data-rename="${p.id}">Đổi tên</button><button class="btn btn-small ${p.is_banned ? "" : "btn-danger"}" type="button" data-ban="${p.id}">${p.is_banned ? "Mở khóa" : "Khóa"}</button></span>
    </div>`).join("") || '<p class="muted">Chưa có người chơi nào.</p>';
}
function bindPlayers() {
  $("plSearch").addEventListener("input", renderPlayers);
  $("plRows").addEventListener("click", async (e) => {
    const ban = e.target.closest("[data-ban]");
    const rename = e.target.closest("[data-rename]");
    const p = players.find((x) => x.id === (ban || rename)?.dataset[ban ? "ban" : "rename"]);
    if (!p) return;
    let change = null;
    if (ban) {
      if (!confirm(p.is_banned ? `Mở khóa ${p.username}?` : `Khóa ${p.username}? Người này sẽ không đăng ảnh, góp ý hay ủng hộ được.`)) return;
      change = { is_banned: !p.is_banned };
    } else {
      const next = prompt(`Tên Minecraft mới cho ${p.username}:`, p.username);
      if (next === null || next.trim() === p.username) return;
      if (!/^[A-Za-z0-9_]{3,16}$/.test(next.trim())) { alert("Tên cần 3 đến 16 ký tự: chữ, số hoặc dấu gạch dưới."); return; }
      change = { username: next.trim() };
      alert("Lưu ý: người này vẫn đăng nhập bằng TÊN CŨ (tên đăng nhập gắn với tài khoản). Tên mới chỉ đổi phần hiển thị.");
    }
    const { error } = await client.from("profiles").update(change).eq("id", p.id);
    if (error) alert(/duplicate key/i.test(error.message) ? "Tên này đã có người dùng." : friendlyError(error));
    loadPlayers();
  });
}

/* ---------------- Badges: things waiting for the admin ---------------- */
async function loadBadges() {
  const [photosRes, ticketsRes] = await Promise.all([
    client.from("gallery_posts").select("id", { count: "exact", head: true }).or("hidden.eq.true,report_count.gt.0"),
    client.from("tickets").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  $("photoBadge").textContent = photosRes.count ? `(${photosRes.count})` : "";
  $("ticketBadge").textContent = ticketsRes.count ? `(${ticketsRes.count})` : "";
}

export function initAdminExtras(supabase) {
  client = supabase;
  if (started) { loadBadges(); return; }
  started = true;
  $("adminTabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) showTab(tab.dataset.tab);
  });
  bindNews();
  bindPhotos();
  bindTickets();
  bindPlayers();
  loadBadges();
}
