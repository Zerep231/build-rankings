import { GALLERY_BUCKET } from "../data/config.js";
import { $, escapeHTML, avatar, relativeTime, openDialog, closeDialog, compressImage, friendlyError, isMissingTable, emptyText } from "./lib.js";
import { account } from "./account.js";
import { namesFor } from "./profiles.js";

const PAGE = 24;
let client = null;
let posts = [];
let offset = 0;
let done = false;
let nameOf = () => "Người chơi";
let loadError = "";

const imageUrl = (path) => client.storage.from(GALLERY_BUCKET).getPublicUrl(path).data.publicUrl;

function render() {
  const me = account.user?.id;
  $("galleryGrid").innerHTML = posts.length
    ? posts.map((p) => {
      const name = nameOf(p.user_id);
      const mine = p.user_id === me;
      return `<article class="panel panel-tight photo-card">
        <button class="photo" type="button" data-photo="${escapeHTML(p.id)}" aria-label="Xem lớn ảnh ${escapeHTML(p.title)}"><img src="${escapeHTML(imageUrl(p.image_path))}" alt="${escapeHTML(p.title)}" loading="lazy" /></button>
        <h3>${escapeHTML(p.title)}</h3>
        ${p.hidden ? '<span class="label label-private">Đang ẩn chờ admin xem</span>' : ""}
        <div class="photo-meta"><span style="display:inline-flex;align-items:center;gap:.4rem">${avatar(name, 20)}${escapeHTML(name)} · ${escapeHTML(relativeTime(p.created_at))}</span>
          ${mine ? `<button class="text-link" type="button" data-delete-photo="${escapeHTML(p.id)}">Xóa</button>`
                 : `<button class="text-link" type="button" data-report="${escapeHTML(p.id)}">Báo cáo</button>`}
        </div>
      </article>`;
    }).join("")
    : `<p class="panel table-message">${emptyText(loadError, "Chưa có ảnh nào. Hãy là người đầu tiên chia sẻ!")}</p>`;
  $("galleryMore").classList.toggle("hide", done || !posts.length);
}

async function loadMore(reset = false) {
  if (!client) { loadError = "no client"; render(); return; }
  if (reset) { posts = []; offset = 0; done = false; }
  const { data, error } = await client.from("gallery_posts")
    .select("id,user_id,title,caption,image_path,hidden,created_at")
    .order("created_at", { ascending: false }).range(offset, offset + PAGE - 1);
  if (error) { loadError = isMissingTable(error) ? "setup" : error.message; render(); return; }
  loadError = "";
  posts.push(...(data || []));
  offset += data?.length || 0;
  done = !data || data.length < PAGE;
  nameOf = await namesFor(client, posts.map((p) => p.user_id));
  render();
}

function openLightbox(post) {
  const name = nameOf(post.user_id);
  $("detailBody").innerHTML = `<h2 id="detailTitle">${escapeHTML(post.title)}</h2>
    <img class="lightbox-img" src="${escapeHTML(imageUrl(post.image_path))}" alt="${escapeHTML(post.title)}" />
    <p class="muted" style="margin-top:var(--space-3)">${escapeHTML(name)} · ${escapeHTML(relativeTime(post.created_at))}</p>
    ${post.caption ? `<p class="news-body">${escapeHTML(post.caption)}</p>` : ""}`;
  window.dispatchEvent(new CustomEvent("open-detail"));
}

export function initGallery(supabase) {
  client = supabase;

  $("openUpload").addEventListener("click", () => {
    if (!account.require("Đăng nhập để đăng ảnh nhé.")) return;
    $("uploadForm").reset();
    $("upPreview").classList.add("hide");
    $("upStatus").textContent = "";
    openDialog("uploadDialog");
  });

  $("upFile").addEventListener("change", () => {
    const file = $("upFile").files[0];
    if (!file) return;
    $("upPreview").src = URL.createObjectURL(file);
    $("upPreview").classList.remove("hide");
    if (!$("upTitle").value) $("upTitle").value = file.name.replace(/\.[^.]+$/, "").slice(0, 80);
  });

  $("uploadForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = (t) => { $("upStatus").textContent = t; };
    const file = $("upFile").files[0];
    const title = $("upTitle").value.trim();
    if (!account.require()) return;
    if (!file) return status("Chọn một ảnh trước nhé.");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return status("Chỉ nhận ảnh PNG, JPG hoặc WebP.");
    if (file.size > 15 * 1024 * 1024) return status("Ảnh quá lớn (tối đa 15 MB trước khi nén).");
    if (!title) { $("upTitle").focus(); return status("Đặt tiêu đề cho ảnh nhé."); }

    $("upSubmit").disabled = true;
    try {
      status("Đang nén ảnh…");
      const blob = await compressImage(file);
      if (blob.size > 2 * 1024 * 1024) return status("Ảnh sau khi nén vẫn trên 2 MB, thử ảnh nhỏ hơn nhé.");
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const path = `${account.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      status("Đang tải lên…");
      const up = await client.storage.from(GALLERY_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
      if (up.error) return status(friendlyError(up.error));
      const { error } = await client.from("gallery_posts").insert({ title, caption: $("upCaption").value.trim(), image_path: path });
      if (error) {
        await client.storage.from(GALLERY_BUCKET).remove([path]); // don't leave an orphan file
        return status(friendlyError(error));
      }
      closeDialog("uploadDialog");
      await loadMore(true);
    } catch (error) {
      status(friendlyError(error));
    } finally {
      $("upSubmit").disabled = false;
    }
  });

  $("galleryMore").addEventListener("click", () => loadMore());

  $("galleryGrid").addEventListener("click", async (e) => {
    const photo = e.target.closest("[data-photo]");
    if (photo) { const p = posts.find((x) => x.id === photo.dataset.photo); if (p) openLightbox(p); return; }

    const del = e.target.closest("[data-delete-photo]");
    if (del) {
      const p = posts.find((x) => x.id === del.dataset.deletePhoto);
      if (!p || !confirm(`Xóa ảnh "${p.title}"? Không thể hoàn tác.`)) return;
      const { error } = await client.from("gallery_posts").delete().eq("id", p.id);
      if (error) { alert(friendlyError(error)); return; }
      await client.storage.from(GALLERY_BUCKET).remove([p.image_path]);
      posts = posts.filter((x) => x.id !== p.id);
      render();
      return;
    }

    const rep = e.target.closest("[data-report]");
    if (rep) {
      if (!account.require("Đăng nhập để báo cáo ảnh.")) return;
      const reason = prompt("Vì sao ảnh này không phù hợp? (không bắt buộc)", "");
      if (reason === null) return;
      const { error } = await client.from("gallery_reports").insert({ post_id: rep.dataset.report, reason: reason.slice(0, 200) });
      if (error && /duplicate key/i.test(error.message)) alert("Bạn đã báo cáo ảnh này rồi.");
      else if (error) alert(friendlyError(error));
      else { rep.textContent = "Đã báo cáo"; rep.disabled = true; }
    }
  });

  account.onChange(() => render());
  loadMore(true);
}
