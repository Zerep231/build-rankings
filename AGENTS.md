# AGENTS.md: hướng dẫn cho AI (ChatGPT / Codex / Claude) làm việc với web EQUAL SURVIVAL

Đọc hết file này trước khi sửa code. Người dùng là chủ server Minecraft, nói tiếng Việt, không phải lập trình viên chuyên nghiệp. Trả lời bằng tiếng Việt dễ hiểu; tên file, tên hàm, lệnh giữ nguyên tiếng Anh.

---

## 1. Dự án là gì

Website cộng đồng cho **EQUAL SURVIVAL**, server Minecraft sinh tồn theo phong cách **chill, thư giãn** (Paper 26.2, có Bedrock qua Geyser).

- Repo GitHub: `Zerep231/build-rankings`. Plugin bảng xếp hạng liên quan: `Zerep231/DirtyLeaderboards`.
- Member xem: trạng thái server, cách tham gia, lệnh, bảng xếp hạng Build Points (BP), lịch sử chấm, ảnh, góp ý, tin tức/event, nội quy.
- Player có tài khoản (tên Minecraft + mật khẩu): đăng ảnh, báo lỗi/đề xuất, ủng hộ đề xuất.
- Admin (`admin.html`): chấm BP, đăng thông báo/event, duyệt ảnh, xử lý góp ý, quản lý người chơi.

## 2. Công nghệ: giữ nguyên, đừng đổi

- **HTML + CSS + JavaScript thuần (ES modules).** Không framework, không bundler, không npm, không bước build. **Không** chuyển sang React/Vue/Tailwind/Next.js nếu người dùng không yêu cầu rõ.
- **Supabase** (Postgres + Auth + Storage), gọi thẳng từ trình duyệt bằng `supabase-js@2` (import từ CDN jsdelivr trong `js/supabase.js`).
- Máy người dùng **không có Node.js và Python**, chỉ có Java 25. Đừng đưa ra hướng dẫn cần `npm`/`npx`/`python`.
- Chạy thử trên máy: ES modules không chạy được khi mở file trực tiếp (`file://`), phải dùng web server:
  ```bash
  jwebserver -p 5173 -b 127.0.0.1 -d D:\webmc
  ```
  Sau đó mở `http://localhost:5173`. `jwebserver` đi kèm JDK.
- Deploy: thư mục tĩnh, đưa lên GitHub Pages hoặc hosting tĩnh bất kỳ.

## 3. Cấu trúc thư mục

```
index.html          Trang member: 1 file, chia trang bằng hash (#home #news #join #commands #rank #history #gallery #feedback #rules)
admin.html          Trang admin riêng (noindex, không có link từ trang member)
assets/             logo.svg (pixel, nền trong), favicon.svg (có nền navy)
css/tokens.css      TOÀN BỘ màu, font, khoảng cách, hiệu ứng → đổi giao diện ở đây trước
css/base.css        reset, chữ, focus, .hide, .visually-hidden, giảm chuyển động
css/components.css  header, menu, panel viền pixel, nút, form, bảng, dialog, nhãn, footer cỏ/đất
css/pages.css       bố cục riêng từng trang (hero, bục top 3, ảnh, góp ý, tin tức, admin)
data/server.js      IP, cổng, phiên bản, câu giới thiệu, 3 điểm nổi bật
data/commands.js    danh sách lệnh member { command, description, group, featured? }
data/scoring.js     tiêu chí chấm BP (PHẢI khớp hàm valid_build_score trong supabase.sql)
data/config.js      URL + khóa CÔNG KHAI Supabase, tên miền email giả, bucket ảnh, API trạng thái
js/lib.js           tiện ích chung: $, escapeHTML, avatar, copy, dialog, nén ảnh, thông báo lỗi tiếng Việt
js/supabase.js      tạo client, fetchAllScores (phân trang, không giới hạn 2000 dòng)
js/main.js          routing, trạng thái online, lệnh, xếp hạng, lịch sử, popup chi tiết; khởi chạy các module dưới
js/account.js       đăng nhập/đăng ký player bằng tên + mật khẩu
js/news.js          tin tức & event (trạng thái Sắp diễn ra/Đang diễn ra/Đã kết thúc)
js/gallery.js       thư viện ảnh: đăng (nén WebP), xem lớn, xóa ảnh của mình, báo cáo
js/feedback.js      báo lỗi & đề xuất: gửi, ủng hộ, lọc, sắp xếp
js/profiles.js      đổi user_id → tên Minecraft (có cache)
js/admin.js         admin: đăng nhập email, chấm BP, danh sách, xuất CSV
js/admin-extra.js   admin: tab Thông báo, Duyệt ảnh, Góp ý, Người chơi
supabase.sql        SQL gốc: build_scores, build_admins, RLS (chạy trước)
supabase-v2.sql     SQL mới: profiles, announcements, gallery_*, tickets, ticket_votes, bucket ảnh, view build_leaderboard
HUONG-DAN.md        hướng dẫn cài đặt cho người dùng + cách nối plugin
.mcp.json           cấu hình Supabase MCP cho Claude Code (không cần cho ChatGPT)
.claude/skills/     skill thiết kế ui-ux-pro-max của Claude (không cần cho ChatGPT)
```

## 4. Dữ liệu và bảo mật (quan trọng nhất)

**Mọi quyền được chặn trong cơ sở dữ liệu bằng RLS**, không dựa vào JavaScript. Khi thêm tính năng ghi dữ liệu, **luôn thêm policy RLS** trong một file SQL mới (ví dụ `supabase-v3.sql`), viết kiểu chạy lại được (`create ... if not exists`, `drop policy if exists`).

| Bảng | Ai đọc | Ai ghi |
|---|---|---|
| `build_scores` | mọi người | admin thêm/xóa |
| `build_admins` | chính admin đó | chỉ qua SQL Editor |
| `profiles` (id, username, is_banned) | mọi người | tự tạo bằng trigger khi đăng ký; admin sửa |
| `announcements` | mọi người | admin |
| `gallery_posts` | ảnh không ẩn; chủ ảnh & admin thấy cả ảnh ẩn | player chưa bị khóa đăng (5 ảnh/24h); chủ hoặc admin xóa; admin ẩn/hiện |
| `gallery_reports` | admin, người báo cáo | player; 3 báo cáo từ 3 người → ảnh tự ẩn (trigger) |
| `tickets` | góp ý công khai; góp ý `is_private` chỉ người gửi & admin | player gửi (10/24h); admin đổi trạng thái/trả lời; chủ hoặc admin xóa |
| `ticket_votes` | mọi người | player tự ủng hộ/bỏ ủng hộ; `vote_count` cập nhật bằng trigger |
| view `build_leaderboard` | mọi người | tổng BP theo tên + hạng mục, cho plugin đọc |

Hàm SQL dùng chung: `public.is_admin()`, `public.is_active_player()` (có profile và không bị khóa).

**Đăng nhập player:** Supabase Auth bắt buộc có email, nên tên Minecraft được đổi thành `ten@players.equalsurvival.invalid` (`data/config.js` → `PLAYER_EMAIL_DOMAIN`; đuôi `.invalid` không bao giờ nhận thư). Cần **tắt "Confirm email"** trong Supabase. Không có quên mật khẩu tự động: admin đặt lại trên dashboard. Tên tự khai, không xác minh trong game. Admin vẫn đăng nhập `admin.html` bằng email thật.

**Quy tắc bắt buộc:**

- **Không bao giờ** đưa khóa `service_role`/secret vào bất kỳ file nào của web. Chỉ khóa *publishable/anon* (đang có trong `data/config.js`) là được công khai.
- Dữ liệu từ người dùng đưa vào `innerHTML` **phải** qua `escapeHTML()` (xem `js/lib.js`). Link ảnh chỉ chấp nhận `https://`.
- Ràng buộc kiểm tra ở JS (độ dài, định dạng tên `^[A-Za-z0-9_]{3,16}$`, bước 0.5 BP) phải giống ràng buộc trong SQL.
- Không thay đổi hay xóa dữ liệu thật trên Supabase khi chưa hỏi người dùng.

## 5. Thiết kế: "Ban ngày Minecraft", chill

- Nền trời xanh chuyển dần, mây pixel trôi chậm, dải cỏ, footer khối cỏ + đất. Logo navy bát giác (`assets/`) là điểm nhấn.
- Màu, font, khoảng cách **chỉ lấy từ biến trong `css/tokens.css`**, không viết mã màu lẻ trong component.
- Font: `Pixelify Sans` **chỉ cho chữ in hoa không dấu** (EQUAL SURVIVAL, số hạng). Nội dung tiếng Việt dùng `Be Vietnam Pro` (đúng dấu).
- Viền "pixel" làm bằng `box-shadow` (`--pixel-border`) để góc khuyết như khối Minecraft. Dùng class `.panel`, `.btn`, `.btn-primary`, `.btn-gold`, `.btn-danger`, `.chip`, `.label`, `.tag`.
- Popup dùng thẻ `<dialog class="panel dialog">` + `openDialog()`/`closeDialog()` trong `js/lib.js` (trình duyệt tự lo phím Escape và focus).
- Không dùng emoji làm icon (dùng SVG pixel, xem `ICONS` trong `js/main.js`).
- Khả năng truy cập: tương phản ≥ 4.5:1, nút ≥ 44px, `label` cho mọi ô nhập, `aria-live` cho thông báo trạng thái, tôn trọng `prefers-reduced-motion`, điện thoại không bị cuộn ngang.
- Văn phong: thân thiện, ngắn, kiểu "chill" (ví dụ "Thử lại nhé", "Quay lại sau nhé").

## 6. Trạng thái hiện tại

**Đã xong:** giao diện mới, logo SVG, trạng thái online (api.mcsrvstat.us), 6 trang member + Tin tức/Ảnh/Góp ý, tài khoản player, admin 5 tab, view cho plugin.

**Người dùng còn phải làm** (nhắc nếu họ báo "không chạy"):

1. Chạy `supabase.sql` rồi `supabase-v2.sql` trong Supabase SQL Editor. Khi chưa chạy, các trang mới hiện "Mục này đang được chuẩn bị" (lỗi `PGRST205`).
2. Tắt "Confirm email" (Authentication → Sign In / Providers → Email).
3. Sửa mô tả 4 lệnh `/eqmenu`, `/warp`, `/ce`, `/claimhelp` trong `data/commands.js` (dòng `TODO(admin)`), nhất là danh sách khu vực `/warp`.

**Chưa làm / ý tưởng tiếp theo:**

- Đồng bộ BP vào game: thuộc plugin DirtyLeaderboards (đề xuất bản 2.4.0, mục `web-sync:` đọc view `build_leaderboard`). Chi tiết ở `HUONG-DAN.md` mục 5. Code plugin là Java, nằm ở repo khác (`D:\plugins mc\DirtyLeaderboards-26`).
- Đẩy bảng trong game (giờ chơi, kills…) lên web: cần plugin ghi bằng `service_role` **trên server**, web chỉ đọc.
- Xác minh tên bằng lệnh `/eqlink <mã>` trong game để chống mạo danh.
- Tên Bedrock (Floodgate thêm dấu `.` đầu tên) hiện chưa chấm/đăng ký được do quy tắc tên `^[A-Za-z0-9_]{3,16}$`. Muốn hỗ trợ phải sửa ở JS **và** SQL, và hỏi người dùng trước.

## 7. Cách làm việc với người dùng này

- **Hỏi và đề xuất trước khi làm** các thay đổi lớn. Khi người dùng chỉ hỏi thì chỉ trả lời, **không tự sửa file**.
- Thay đổi nhỏ, rõ ràng: làm luôn, rồi báo đã đổi file nào và cách kiểm tra.
- Sau khi sửa: mở bằng `jwebserver`, kiểm tra trên khổ máy tính và điện thoại (375px), xem console không có lỗi.
- Không xóa file người dùng tạo ra mà chưa hỏi. File cũ đã được chuyển sang `D:\webmc-backup\`.
- Mọi file SQL mới phải chạy lại được nhiều lần không lỗi, và phải nói rõ người dùng cần dán file nào vào SQL Editor.

## 8. Mẫu yêu cầu cho ChatGPT

> Đọc AGENTS.md của dự án web EQUAL SURVIVAL (HTML/CSS/JS thuần + Supabase). Tôi muốn: … Hãy đề xuất cách làm và hỏi tôi những gì còn thiếu trước khi viết code. Khi viết code, giữ nguyên công nghệ hiện có, dùng biến trong css/tokens.css, thêm RLS cho mọi bảng mới trong một file supabase-v3.sql chạy lại được, và cho tôi biết file nào thay đổi.
