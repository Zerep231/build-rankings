import { TYPES, maxPoints } from "../data/scoring.js";
import { $, escapeHTML, formatBP, formatDate } from "./lib.js";
import { getClient, fetchAllScores, supabaseConfigured } from "./supabase.js";
import { initAdminExtras } from "./admin-extra.js";

let supabase = null;
let session = null;
let isAdmin = false;
let records = [];
let loadError = "";

const status = (text, kind = "") => {
  $("authStatus").className = `notice ${kind}`;
  $("authStatus").textContent = text;
};

/* ---------------- Scoring form ---------------- */
$("category").innerHTML = Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${escapeHTML(v.name)}</option>`).join("");

const currentType = () => TYPES[$("category").value];

function drawCriteria() {
  const t = currentType();
  $("criteriaForm").innerHTML = t.criteria.map(([label, max], i) =>
    `<div class="field" style="margin:0"><label for="crit${i}">${escapeHTML(label)} <span class="muted">(tối đa ${max})</span></label><input id="crit${i}" type="number" inputmode="decimal" min="0" max="${max}" step="0.5" value="0" /></div>`).join("");
  $("maxScore").textContent = maxPoints(t);
  $("criteriaForm").querySelectorAll("input").forEach((input) => input.addEventListener("input", updateScore));
  updateScore();
}

function getScores() {
  return currentType().criteria.map((_, i) => {
    const raw = $(`crit${i}`).value.trim();
    return raw === "" ? NaN : Number(raw);
  });
}

// Same rule as valid_build_score() in supabase.sql: 0..cap, in steps of 0.5.
const validScores = () => getScores().every((v, i) =>
  Number.isFinite(v) && v >= 0 && v <= currentType().criteria[i][1] && v * 2 === Math.round(v * 2));

function updateScore() {
  const t = currentType();
  const good = validScores();
  const vals = getScores();
  const sum = good ? vals.reduce((a, b) => a + b, 0) : 0;
  $("score").textContent = good ? formatBP(sum) : "Không hợp lệ";
  $("scorePreview").innerHTML = t.criteria.map(([name, cap], i) =>
    `<div class="rubric-row"><div class="row"><span>${escapeHTML(name)}</span><b>${good ? vals[i] : "?"} / ${cap}</b></div><div class="meter"><i style="width:${good ? (100 * vals[i]) / cap : 0}%"></i></div></div>`).join("");
}

$("category").addEventListener("change", drawCriteria);
drawCriteria();

for (const id of ["player", "project"]) {
  $(id).addEventListener("input", () => { $(id).removeAttribute("aria-invalid"); $("saveStatus").textContent = ""; });
}

$("scoreForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const player = $("player");
  const project = $("project");
  const button = $("save");
  const fail = (message, field) => {
    $("saveStatus").textContent = message;
    if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); }
  };
  if (!session || !isAdmin) return fail("Tài khoản hiện tại chưa có quyền chấm điểm.");
  if (!/^[A-Za-z0-9_]{3,16}$/.test(player.value.trim())) return fail("Tên Java cần dài 3 đến 16 ký tự, gồm chữ, số hoặc dấu gạch dưới.", player);
  if (!project.value.trim()) return fail("Nhập tên công trình trước khi lưu.", project);
  if (!validScores()) return fail("Kiểm tra lại điểm từng tiêu chí: từ 0 tới mức tối đa, bước 0.5.");
  const points = getScores().reduce((s, v) => s + v, 0);
  if (points <= 0) return fail("Tổng điểm phải lớn hơn 0.");

  const payload = {
    player_name: player.value.trim(),
    project_name: project.value.trim(),
    category: $("category").value,
    criteria_scores: getScores(),
    points,
    note: $("note").value.trim(),
    created_by: session.user.id,
  };
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  $("saveStatus").textContent = "Đang lưu…";
  try {
    const { error } = await supabase.from("build_scores").insert(payload);
    if (error) return fail(`Chưa lưu được: ${error.message}`);
    $("saveStatus").textContent = `Đã lưu ${formatBP(points)} BP cho ${payload.player_name}.`;
    project.value = "";
    $("note").value = "";
    drawCriteria();
    await refresh();
  } catch {
    fail("Không kết nối được cơ sở dữ liệu. Thử lưu lại nhé.");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
});

/* ---------------- Saved results ---------------- */
function renderManage() {
  const q = $("manageSearch").value.trim().toLocaleLowerCase("vi");
  const list = records.filter((r) => !q || `${r.player_name} ${r.project_name}`.toLocaleLowerCase("vi").includes(q));
  $("manageRows").innerHTML = list.map((r) =>
    `<div class="manage-row"><span>${formatDate(r.created_at)} · <b>${escapeHTML(r.player_name)}</b> · ${escapeHTML(r.project_name)} · <span class="tag">${escapeHTML(TYPES[r.category]?.name || r.category)}</span> · <b>${formatBP(r.points)} BP</b></span><button class="btn btn-small btn-danger" type="button" data-delete="${escapeHTML(r.id)}">Xóa</button></div>`).join("")
    || `<p class="muted">${loadError ? "Không tải được dữ liệu." : "Chưa có lượt chấm nào."}</p>`;
}
$("manageSearch").addEventListener("input", renderManage);

$("manageRows").addEventListener("click", async (e) => {
  const button = e.target.closest("[data-delete]");
  if (!button || !session || !isAdmin) return;
  const r = records.find((x) => String(x.id) === button.dataset.delete);
  if (!confirm(`Xóa lượt chấm "${r?.project_name ?? ""}" của ${r?.player_name ?? ""}? Không thể hoàn tác.`)) return;
  try {
    const { error } = await supabase.from("build_scores").delete().eq("id", button.dataset.delete);
    if (error) { $("saveStatus").textContent = `Chưa xóa được: ${error.message}`; return; }
    await refresh();
  } catch {
    $("saveStatus").textContent = "Không kết nối được cơ sở dữ liệu. Thử lại nhé.";
  }
});

$("exportCSV").addEventListener("click", () => {
  if (!isAdmin) return;
  const head = ["Ngay", "Nguoi choi", "Cong trinh", "Hang muc", "Diem", "Tieu chi", "Ghi chu"];
  const rows = records.map((r) => [new Date(r.created_at).toISOString(), r.player_name, r.project_name,
    TYPES[r.category]?.name || r.category, r.points, JSON.stringify(r.criteria_scores), r.note || ""]);
  // Prefix formula-like cells so spreadsheet apps do not execute them.
  const cell = (x) => { let s = String(x ?? ""); if (/^[=+\-@]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  const csv = [head, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "build-points-history.csv";
  a.click();
  URL.revokeObjectURL(url);
});

/* ---------------- Auth ---------------- */
async function refresh() {
  try {
    records = await fetchAllScores(supabase);
    loadError = "";
  } catch (error) {
    loadError = String(error?.message || error);
  }
  renderManage();
}

function authUI() {
  $("loginArea").classList.toggle("hide", Boolean(session) || !supabase);
  $("adminArea").classList.toggle("hide", !isAdmin);
  if (!supabaseConfigured) status("Chưa cấu hình Supabase trong data/config.js.", "warning");
  else if (loadError) status(`Lỗi tải dữ liệu: ${loadError}`, "error");
  else if (isAdmin) status(`Đã xác minh quyền admin: ${session.user.email || ""}`, "success");
  else if (session) status("Tài khoản đã đăng nhập nhưng chưa được cấp quyền admin.", "warning");
  else status("Đăng nhập để chấm điểm.");
}

async function checkAdmin() {
  isAdmin = false;
  if (supabase && session) {
    const { data, error } = await supabase.from("build_admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
    isAdmin = !error && Boolean(data);
  }
  if (isAdmin) { await refresh(); initAdminExtras(supabase); }
  authUI();
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  const email = $("email");
  const password = $("password");
  if (!email.value.trim() || !password.value) {
    status("Nhập email và mật khẩu để đăng nhập.", "warning");
    (!email.value.trim() ? email : password).focus();
    return;
  }
  $("login").disabled = true;
  status("Đang đăng nhập…");
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
    if (error) { status(`Đăng nhập chưa thành công: ${error.message}`, "error"); password.focus(); }
  } catch {
    status("Không kết nối được dịch vụ đăng nhập. Thử lại nhé.", "error");
  } finally {
    $("login").disabled = false;
  }
});

$("logout").addEventListener("click", () => supabase?.auth.signOut());

(async () => {
  try {
    supabase = await getClient();
    if (!supabase) { authUI(); return; }
    session = (await supabase.auth.getSession()).data.session;
    // Defer: calling Supabase inside this callback can deadlock the auth client.
    supabase.auth.onAuthStateChange((_event, next) => { session = next; setTimeout(checkAdmin, 0); });
    await checkAdmin();
  } catch (error) {
    status(`Lỗi kết nối: ${error?.message || error}`, "error");
  }
})();
