import { escapeHTML, friendlyError, formatDateTime } from "./lib.js";
import { namesFor } from "./profiles.js";

export const threadHTML = (ticketId) => `<details class="ticket-thread" data-thread="${escapeHTML(ticketId)}"><summary class="btn btn-small">Xem trao đổi</summary><div data-thread-body role="status" aria-live="polite"></div></details>`;

export function initTicketThreads(root, client, currentUser, isAdmin = () => false) {
  async function load(details) {
    const target = details.querySelector("[data-thread-body]");
    const ticketId = details.dataset.thread;
    target.textContent = "Đang tải trao đổi…";
    try {
      if (!client) throw new Error("Chưa kết nối được máy chủ dữ liệu.");
      const ticket = await client.from("tickets").select("user_id").eq("id", ticketId).maybeSingle();
      if (ticket.error) throw ticket.error;
      if (!ticket.data) throw new Error("Bài viết không còn tồn tại hoặc bạn chưa có quyền xem.");
      const replies = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from("ticket_replies").select("*").eq("ticket_id",ticketId)
          .order("created_at",{ascending:true}).order("id",{ascending:true}).range(from,from+999);
        if (error) throw error;
        replies.push(...data);
        if (data.length<1000) break;
      }
      const nameOf = await namesFor(client,replies.map((r) => r.user_id).filter(Boolean));
      if (!details.isConnected) return;
      details.closest("article")?.querySelector("[data-legacy-reply]")?.classList.toggle("hide",replies.some((r) => r.legacy));
      target.innerHTML = replies.map((r) => `<div class="reply"><b>${r.is_admin ? "Admin" : escapeHTML(nameOf(r.user_id))}</b> · ${escapeHTML(formatDateTime(r.created_at))}<p class="ticket-body">${escapeHTML(r.body)}</p></div>`).join("") || '<p class="muted">Chưa có phản hồi.</p>';
      const me = currentUser();
      if (me && (isAdmin() || me.id === ticket.data.user_id)) target.insertAdjacentHTML("beforeend",
        `<form data-thread-reply><div class="field"><label for="reply-${escapeHTML(ticketId)}">Viết phản hồi</label><textarea id="reply-${escapeHTML(ticketId)}" name="body" maxlength="2000" required rows="3"></textarea></div><button class="btn btn-primary btn-small" type="submit">Gửi phản hồi</button><p role="status" aria-live="polite"></p></form>`);
    } catch (error) { target.textContent = friendlyError(error); }
  }
  root.addEventListener("toggle", (event) => {
    const details = event.target;
    if (details.matches?.("[data-thread]") && details.open) load(details);
  }, true);
  root.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-thread-reply]");
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();
    const button = form.querySelector("button");
    if (button.disabled) return;
    const status = form.querySelector('p[role="status"]');
    const body = form.elements.body.value.trim();
    if (!body || body.length>2000) { status.textContent = "Phản hồi cần từ 1 đến 2000 ký tự."; return; }
    button.disabled = true;
    status.textContent = "Đang gửi…";
    try {
      const { error } = await client.from("ticket_replies").insert({ ticket_id: form.closest("[data-thread]").dataset.thread, body });
      if (error) throw error;
      await load(form.closest("[data-thread]"));
    } catch (error) { status.textContent = friendlyError(error); }
    finally { button.disabled = false; }
  });
}
