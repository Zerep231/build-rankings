import { $, escapeHTML, avatar, relativeTime, openDialog, closeDialog, friendlyError, isMissingTable, emptyText } from "./lib.js";
import { account } from "./account.js";
import { namesFor } from "./profiles.js";

const STATUS = { new: "Mới", in_progress: "Đang xử lý", done: "Đã xong", rejected: "Không thực hiện" };
const KIND = { bug: "Báo lỗi", suggestion: "Đề xuất" };

let client = null;
let tickets = [];
let myVotes = new Set();
let kind = "all";
let nameOf = () => "Người chơi";
let loadError = "";

function sorted() {
  const list = tickets.filter((t) => kind === "all" || t.kind === kind);
  const by = $("ticketSort").value;
  const openRank = (t) => (t.status === "new" ? 0 : t.status === "in_progress" ? 1 : 2);
  return list.sort((a, b) =>
    (by === "votes" ? b.vote_count - a.vote_count : 0)
    || (by === "open" ? openRank(a) - openRank(b) : 0)
    || new Date(b.created_at) - new Date(a.created_at));
}

function render() {
  const me = account.user?.id;
  const list = sorted();
  $("ticketList").innerHTML = list.length
    ? list.map((t) => {
      const name = nameOf(t.user_id);
      const voted = myVotes.has(t.id);
      const canVote = t.kind === "suggestion";
      return `<article class="panel ticket">
        <button class="vote" type="button" data-vote="${escapeHTML(t.id)}" aria-pressed="${voted}" ${canVote ? "" : "disabled"}
          aria-label="${canVote ? (voted ? "Bỏ ủng hộ" : "Ủng hộ") + ` đề xuất ${escapeHTML(t.title)}` : "Báo lỗi không cần ủng hộ"}">
          <span aria-hidden="true">▲</span><span>${t.vote_count}</span></button>
        <div>
          <div class="news-meta">
            <span class="label label-${t.kind}">${KIND[t.kind]}</span>
            <span class="label label-${t.status}">${STATUS[t.status]}</span>
            ${t.is_private ? '<span class="label label-private">Chỉ admin xem</span>' : ""}
            <span style="display:inline-flex;align-items:center;gap:.4rem">${avatar(name, 20)}${escapeHTML(name)}</span>
            <span>${escapeHTML(relativeTime(t.created_at))}</span>
          </div>
          <h3>${escapeHTML(t.title)}</h3>
          <p class="ticket-body">${escapeHTML(t.body)}</p>
          ${t.admin_reply ? `<div class="reply"><b>Admin trả lời:</b><p class="ticket-body" style="margin:0">${escapeHTML(t.admin_reply)}</p></div>` : ""}
          ${t.user_id === me ? `<button class="text-link" type="button" data-delete-ticket="${escapeHTML(t.id)}">Xóa góp ý của tôi</button>` : ""}
        </div>
      </article>`;
    }).join("")
    : `<p class="panel table-message">${emptyText(loadError, "Chưa có góp ý nào. Gửi góp ý đầu tiên nhé!")}</p>`;
}

async function load() {
  if (!client) { loadError = "no client"; render(); return; }
  const { data, error } = await client.from("tickets")
    .select("id,user_id,kind,title,body,is_private,status,admin_reply,vote_count,created_at")
    .order("created_at", { ascending: false }).limit(300);
  loadError = error ? (isMissingTable(error) ? "setup" : error.message) : "";
  tickets = data || [];
  myVotes = new Set();
  if (account.user) {
    const { data: votes } = await client.from("ticket_votes").select("ticket_id").eq("user_id", account.user.id);
    myVotes = new Set((votes || []).map((v) => v.ticket_id));
  }
  nameOf = await namesFor(client, tickets.map((t) => t.user_id));
  render();
}

function syncPrivateOption() {
  const isBug = document.querySelector('input[name="tkKind"]:checked')?.value === "bug";
  $("tkPrivateRow").classList.toggle("hide", !isBug);
  if (!isBug) $("tkPrivate").checked = false;
  $("tkBodyHint").textContent = isBug
    ? "Báo lỗi: ghi rõ chuyện gì xảy ra, ở đâu (tọa độ), lúc nào."
    : "Đề xuất: ý tưởng là gì, vì sao nó làm server vui hơn.";
}

export function initFeedback(supabase) {
  client = supabase;

  $("ticketKindChips").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-kind]");
    if (!chip) return;
    kind = chip.dataset.kind;
    $("ticketKindChips").querySelectorAll("[data-kind]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    render();
  });
  $("ticketSort").addEventListener("change", render);

  $("openTicket").addEventListener("click", () => {
    if (!account.require("Đăng nhập để gửi góp ý nhé.")) return;
    $("ticketForm").reset();
    $("tkStatus").textContent = "";
    syncPrivateOption();
    openDialog("ticketDialog");
  });
  document.querySelectorAll('input[name="tkKind"]').forEach((r) => r.addEventListener("change", syncPrivateOption));

  $("ticketForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = (t) => { $("tkStatus").textContent = t; };
    if (!account.require()) return;
    const title = $("tkTitle").value.trim();
    const body = $("tkBody").value.trim();
    if (title.length < 3) { $("tkTitle").focus(); return status("Tiêu đề cần ít nhất 3 ký tự."); }
    if (body.length < 5) { $("tkBody").focus(); return status("Viết rõ hơn một chút nhé."); }
    $("tkSubmit").disabled = true;
    try {
      const { error } = await client.from("tickets").insert({
        kind: document.querySelector('input[name="tkKind"]:checked').value,
        title, body, is_private: $("tkPrivate").checked,
      });
      if (error) return status(friendlyError(error));
      closeDialog("ticketDialog");
      await load();
    } catch (error) {
      status(friendlyError(error));
    } finally {
      $("tkSubmit").disabled = false;
    }
  });

  $("ticketList").addEventListener("click", async (e) => {
    const vote = e.target.closest("[data-vote]");
    if (vote && !vote.disabled) {
      if (!account.require("Đăng nhập để ủng hộ đề xuất.")) return;
      const id = vote.dataset.vote;
      vote.disabled = true;
      const { error } = myVotes.has(id)
        ? await client.from("ticket_votes").delete().eq("ticket_id", id).eq("user_id", account.user.id)
        : await client.from("ticket_votes").insert({ ticket_id: id });
      if (error) alert(friendlyError(error));
      await load();
      return;
    }
    const del = e.target.closest("[data-delete-ticket]");
    if (del && confirm("Xóa góp ý này? Không thể hoàn tác.")) {
      const { error } = await client.from("tickets").delete().eq("id", del.dataset.deleteTicket);
      if (error) alert(friendlyError(error));
      await load();
    }
  });

  account.onChange(() => load());
  load();
}
