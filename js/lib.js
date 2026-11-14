import { AVATAR_URL } from "../data/config.js";

export const $ = (id) => document.getElementById(id);

export const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const formatBP = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString("vi-VN");

export const formatDate = (iso) => new Date(iso).toLocaleDateString("vi-VN");

/** Minecraft-head image tag; falls back to a plain block if the service is unreachable. */
export function avatar(name, size = 28) {
  if (!AVATAR_URL || !/^[A-Za-z0-9_.]{1,32}$/.test(String(name || ""))) {
    return `<span class="avatar" style="width:${size}px;height:${size}px" aria-hidden="true"></span>`;
  }
  const src = AVATAR_URL.replace("{name}", encodeURIComponent(name));
  return `<img class="avatar" src="${escapeHTML(src)}" width="${size}" height="${size}" alt="" loading="lazy" onerror="this.removeAttribute('src')">`;
}

/** Copy text and show short feedback on the button, then restore its label. */
export function bindCopy(button, getValue) {
  if (!button) return;
  const idle = button.textContent;
  button.addEventListener("click", async () => {
    const value = getValue();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "Đã sao chép!";
    } catch {
      button.textContent = "Không sao chép được";
    }
    setTimeout(() => {
      if (button.isConnected) button.textContent = idle;
    }, 1600);
  });
}

/** Sum records per player (case-insensitive name), best first. */
export function rankPlayers(records) {
  const byPlayer = new Map();
  for (const r of records) {
    const name = String(r.player_name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const p = byPlayer.get(key) || { name, total: 0, count: 0 };
    p.total += Number(r.points) || 0;
    p.count++;
    byPlayer.set(key, p);
  }
  return [...byPlayer.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/* ---------- Dialogs (native <dialog>: Escape and focus handled by the browser) ---------- */
export function openDialog(id) {
  const d = $(id);
  if (!d.open) d.showModal();
  return d;
}

export function closeDialog(id) {
  const d = $(id);
  if (d.open) d.close();
}

// Any [data-close] inside a dialog closes it (links still navigate afterwards).
document.addEventListener("click", (e) => {
  const closer = e.target.closest("dialog [data-close]");
  if (closer) closer.closest("dialog").close();
  // Clicking the backdrop (the dialog element itself) closes it too.
  if (e.target instanceof HTMLDialogElement && e.target.open) {
    const r = e.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
  }
});

export const relativeTime = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} ngày trước`;
  return formatDate(iso);
};

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

/** Shrink an image in the browser to WebP (JPEG fallback) so uploads stay small. */
export async function compressImage(file, maxSide = 1600, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const toBlob = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg");
  if (!blob) throw new Error("Không xử lý được ảnh này.");
  return blob;
}

/** Map common Supabase errors to friendly Vietnamese text. */
export function friendlyError(error) {
  const msg = String(error?.message || error || "");
  if (/Invalid login credentials/i.test(msg)) return "Sai tên hoặc mật khẩu.";
  if (/already registered|already been registered|duplicate key.*username/i.test(msg)) return "Tên này đã có người dùng. Nếu là bạn, hãy đăng nhập.";
  if (/Database error saving new user/i.test(msg)) return "Tên này đã có người dùng hoặc không hợp lệ. Thử tên khác nhé.";
  if (/Password should be at least/i.test(msg)) return "Mật khẩu quá ngắn.";
  if (/Email not confirmed/i.test(msg)) return "Tài khoản chưa được kích hoạt. Báo admin tắt xác nhận email trong Supabase.";
  if (/rate limit|too many/i.test(msg)) return "Thao tác quá nhanh, chờ một chút rồi thử lại nhé.";
  if (/row-level security|violates row-level/i.test(msg)) return "Bạn chưa có quyền làm việc này (tài khoản có thể đang bị khóa).";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Không kết nối được máy chủ dữ liệu. Thử lại nhé.";
  return msg || "Có lỗi xảy ra, thử lại nhé.";
}

/** True when a Supabase table is missing (supabase-v2.sql not run yet). */
export const isMissingTable = (error) => error?.code === "PGRST205" || /schema cache|does not exist/i.test(String(error?.message || ""));

/** Empty-state text: setup pending, load failure, or the normal empty message. */
export const emptyText = (loadError, empty) =>
  loadError === "setup" ? "Mục này đang được chuẩn bị, quay lại sau nhé."
    : loadError ? "Không tải được dữ liệu. Thử tải lại trang nhé." : empty;
