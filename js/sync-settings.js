import { $, friendlyError } from "./lib.js";
import { SUPABASE } from "../data/config.js";

export function initSyncSettings(client, isAdmin) {
  $("syncForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    if (!client || !isAdmin() || button.disabled) return;
    button.disabled = true;
    $("syncStatus").textContent = "Đang tạo khóa…";
    $("syncConfig").value = "";
    $("syncResult").classList.add("hide");
    try {
      const token = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2,"0")).join("");
      const token_hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))]
        .map((x) => x.toString(16).padStart(2,"0")).join("");
      const { error } = await client.from("bp_sync_servers").insert({ name: $("syncName").value.trim(), token_hash });
      if (error) throw error;
      if (!isAdmin()) return;
      $("syncConfig").value = `# Thêm bên trong mục web-sync hiện có (không tạo mục trùng).\n  push:\n    enabled: true\n    endpoint: "${SUPABASE.url}/functions/v1/bp-sync"\n    token: "${token}"\n# Giữ web-sync.enabled: true và cấu hình đọc BP hiện tại.\n# Đừng chia sẻ token hoặc đưa config này lên GitHub.`;
      $("syncResult").classList.remove("hide");
      $("syncStatus").textContent = "Đã tạo. Chép cấu hình trước khi rời trang; không thể xem lại khóa này.";
    } catch (error) { $("syncStatus").textContent = friendlyError(error); }
    finally { button.disabled = false; }
  });
}
