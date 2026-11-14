import { TYPES, maxPoints } from "../data/scoring.js";
import { $, escapeHTML, formatBP, formatDate, friendlyError } from "./lib.js";
import { GAME_NAME, LOGIN_NAME, loginEmail } from "./identity.js";
import { initSyncSettings } from "./sync-settings.js";
import { getClient, fetchAllScores, supabaseConfigured } from "./supabase.js";
import { initAdminExtras } from "./admin-extra.js";

let supabase = null;
let session = null;
let isAdmin = false;
let records = [];
let loadError = "";
let editing = null;
let pendingReview = null;
let pendingAdjustment = null;
let authGeneration = 0;

function resetScoreEdit() {
  editing = null;
  pendingReview = null;
  $("scoreForm").reset();
  $("save").textContent = "Lưu lượt chấm";
  $("cancelScoreEdit").classList.add("hide");
  drawCriteria();
}
$("cancelScoreEdit").addEventListener("click", () => { if (!$("save").disabled) resetScoreEdit(); });
$("adjustCategory").innerHTML = Object.entries(TYPES).map(([k,v]) => `<option value="${k}">${escapeHTML(v.name)}</option>`).join("");
$("adjustForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("adjustForm").querySelector('button[type="submit"]');
  if (button.disabled || !isAdmin || !session) return;
  const values = { p_player_name: $("adjustPlayer").value.trim(), p_category: $("adjustCategory").value,
    p_delta: Number($("adjustAmount").value), p_reason: $("adjustReason").value.trim() };
  if (!GAME_NAME.test(values.p_player_name) || !TYPES[values.p_category] || !values.p_delta || !Number.isFinite(values.p_delta)
      || Math.abs(values.p_delta)>1000000 || !Number.isInteger(values.p_delta*2) || values.p_reason.length<3 || values.p_reason.length>500) {
    $("adjustStatus").textContent = "Kiểm tra tên nhân vật, BP theo bước 0.5 và lý do từ 3 đến 500 ký tự."; return;
  }
  const fingerprint = JSON.stringify([session.user.id,values]);
  if (pendingAdjustment?.fingerprint !== fingerprint) pendingAdjustment = { fingerprint, id: crypto.randomUUID() };
  button.disabled = true;
  $("adjustStatus").textContent = "Đang lưu…";
  try {
    const { error } = await supabase.rpc("adjust_bp", { ...values, p_operation_id: pendingAdjustment.id });
    if (error) throw error;
    pendingAdjustment = null;
    $("adjustForm").reset();
    $("adjustStatus").textContent = "Đã lưu BP. Plugin nhận ở lần đồng bộ kế tiếp.";
    await refresh();
  } catch (error) { $("adjustStatus").textContent = friendlyError(error); }
  finally { button.disabled = false; }
});

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
  if ($("save").disabled) return;
  const player = $("player");
  const project = $("project");
  const button = $("save");
  const fail = (message, field) => {
    $("saveStatus").textContent = message;
    if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); }
  };
  if (!session || !isAdmin) return fail("Tài khoản hiện tại chưa có quyền chấm điểm.");
  if (!GAME_NAME.test(player.value.trim())) return fail("Nhập đúng tên nhân vật trong game, gồm chữ, số, gạch dưới và có thể có dấu chấm đầu tên.", player);
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
  };
  const editTarget = editing;
  const fingerprint = JSON.stringify([session.user.id, editTarget?.id, payload]);
  if (pendingReview?.fingerprint !== fingerprint) pendingReview = { fingerprint, id: crypto.randomUUID() };
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  $("saveStatus").textContent = "Đang lưu…";
  try {
    let result;
    if (editTarget) {
      result = await supabase.from("build_scores").update(payload).eq("id", editTarget.id)
        .eq("revision", editTarget.revision).select("id").maybeSingle();
    } else {
      result = await supabase.from("build_scores").insert({ ...payload, created_by: session.user.id, operation_id: pendingReview.id }).select("id").maybeSingle();
      if (result.error?.code === "23505") {
        const existing = await supabase.from("build_scores").select("*").eq("operation_id", pendingReview.id).maybeSingle();
        if (existing.data && Object.entries(payload).every(([key,value]) => JSON.stringify(existing.data[key]) === JSON.stringify(value))) result = existing;
      }
    }
    if (result.error) return fail(`Chưa lưu được: ${friendlyError(result.error)}`);
    if (!result.data) { await refresh(); return fail("Lượt chấm đã thay đổi hoặc bị xóa. Bấm Sửa để tải lại trước khi lưu."); }
    resetScoreEdit();
    $("saveStatus").textContent = `Đã lưu ${formatBP(points)} BP cho ${payload.player_name}.`;
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
    `<div class="manage-row"><span>${formatDate(r.created_at)} · <b>${escapeHTML(r.player_name)}</b> · ${escapeHTML(r.project_name)} · <span class="tag">${escapeHTML(TYPES[r.category]?.name || r.category)}</span> · <b>${formatBP(r.points)} BP</b></span><span class="filters"><button class="btn btn-small" type="button" data-edit-score="${escapeHTML(r.id)}">Sửa</button><button class="btn btn-small btn-danger" type="button" data-delete="${escapeHTML(r.id)}" data-revision="${r.revision || 1}">Xóa</button></span></div>`).join("")
    || `<p class="muted">${loadError ? "Không tải được dữ liệu." : "Chưa có lượt chấm nào."}</p>`;
}
$("manageSearch").addEventListener("input", renderManage);

$("manageRows").addEventListener("click", async (e) => {
  if (!session || !isAdmin || $("save").disabled) return;
  const edit = e.target.closest("[data-edit-score]");
  if (edit) {
    const row = records.find((x) => String(x.id) === edit.dataset.editScore);
    if (!row) return;
    editing = { id: row.id, revision: row.revision || 1 };
    $("player").value = row.player_name;
    $("project").value = row.project_name;
    $("category").value = row.category;
    $("note").value = row.note || "";
    drawCriteria();
    row.criteria_scores.forEach((value,i) => { $(`crit${i}`).value = value; });
    updateScore();
    $("save").textContent = "Lưu thay đổi";
    $("cancelScoreEdit").classList.remove("hide");
    $("saveStatus").textContent = "Đang sửa lượt chấm đã chọn.";
    $("player").focus();
    return;
  }
  const button = e.target.closest("[data-delete]");
  if (!button || !session || !isAdmin) return;
  const r = records.find((x) => String(x.id) === button.dataset.delete);
  if (!confirm(`Xóa lượt chấm "${r?.project_name ?? ""}" của ${r?.player_name ?? ""}? Không thể hoàn tác.`)) return;
  try {
    button.disabled = true;
    const { data, error } = await supabase.from("build_scores").delete().eq("id", button.dataset.delete).eq("revision", Number(button.dataset.revision)).select("id").maybeSingle();
    if (error) { $("saveStatus").textContent = `Chưa xóa được: ${error.message}`; return; }
    if (!data) $("saveStatus").textContent = "Lượt chấm đã thay đổi hoặc đã bị xóa. Kiểm tra lại nhé.";
    if (editing?.id === button.dataset.delete) resetScoreEdit();
    await refresh();
  } catch {
    $("saveStatus").textContent = "Không kết nối được cơ sở dữ liệu. Thử lại nhé.";
  } finally { button.disabled = false; }
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
    records = await fetchAllScores(supabase, "build_scores");
    loadError = "";
  } catch (error) {
    loadError = String(error?.message || error);
  }
  renderManage();
}

function authUI() {
  $("loginArea").classList.toggle("hide", isAdmin || !supabase);
  $("adminArea").classList.toggle("hide", !isAdmin);
  if (!supabaseConfigured) status("Chưa cấu hình Supabase trong data/config.js.", "warning");
  else if (loadError) status(`Lỗi tải dữ liệu: ${loadError}`, "error");
  else if (isAdmin) status(`Đã xác minh quyền admin: ${session.user.user_metadata?.username || session.user.email?.split("@")[0] || "admin"}`, "success");
  else if (session) status("Tài khoản đã đăng nhập nhưng chưa được cấp quyền admin.", "warning");
  else status("Đăng nhập để chấm điểm.");
}

async function checkAdmin() {
  const generation = ++authGeneration;
  isAdmin = false;
  if (supabase && session) {
    const { data, error } = await supabase.from("build_admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
    if (generation !== authGeneration) return;
    isAdmin = !error && Boolean(data);
  }
  if (!isAdmin) { resetScoreEdit(); records = []; pendingAdjustment = null; $("syncConfig").value = ""; $("syncResult").classList.add("hide"); }
  initAdminExtras(supabase, isAdmin ? session.user : null);
  if (isAdmin) await refresh();
  authUI();
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  const email = $("email");
  const password = $("password");
  if (!email.value.trim() || !password.value) {
    status("Nhập tên và mật khẩu để đăng nhập.", "warning");
    (!email.value.trim() ? email : password).focus();
    return;
  }
  if (!email.value.includes("@") && !LOGIN_NAME.test(email.value.trim())) { status("Tên đăng nhập cần 3 đến 16 ký tự: chữ, số hoặc gạch dưới.", "warning"); return; }
  $("login").disabled = true;
  status("Đang đăng nhập…");
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: email.value.includes("@") ? email.value.trim() : loginEmail(email.value), password: password.value });
    if (error) { status(friendlyError(error), "error"); password.focus(); } else password.value = "";
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
    initSyncSettings(supabase, () => isAdmin);
    if (!supabase) { authUI(); return; }
    session = (await supabase.auth.getSession()).data.session;
    // Defer: calling Supabase inside this callback can deadlock the auth client.
    supabase.auth.onAuthStateChange((_event, next) => { session = next; setTimeout(checkAdmin, 0); });
    await checkAdmin();
  } catch (error) {
    status(`Lỗi kết nối: ${error?.message || error}`, "error");
  }
})();
