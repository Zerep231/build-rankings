# CODEX.md: giải thích dự án EQUAL SURVIVAL và các bước tiếp theo cho Codex

> **Đọc file này trước, sau đó đọc `AGENTS.md`** (quy tắc code, bảo mật, thiết kế).
> Người dùng là chủ server Minecraft, nói tiếng Việt, không phải lập trình viên. Hãy trả lời bằng tiếng Việt dễ hiểu và **hỏi trước khi làm việc lớn**. Khi người dùng chỉ hỏi thì chỉ trả lời, không tự sửa file.

---

## 1. Tổng quan: dự án gồm 2 phần

| Phần | Thư mục trên máy | GitHub | Công nghệ |
|---|---|---|---|
| **Website** cộng đồng | `D:\webmc` | `Zerep231/build-rankings` | HTML/CSS/JS thuần (ES modules) + Supabase |
| **Plugin** bảng xếp hạng trong game | `D:\plugins mc\DirtyLeaderboards-26` | `Zerep231/DirtyLeaderboards` | Java 25, Paper 26.1+, Gradle (Kotlin DSL) |

Server: **EQUAL SURVIVAL**, Minecraft sinh tồn **chill, thư giãn**, Paper 26.2, Java `luna.lumine.buzz:25559`, Bedrock cổng `19101` (Geyser + Floodgate).

Hai phần **không gọi nhau trực tiếp**, chúng gặp nhau ở **Supabase**:

```
Admin chấm Build Points (BP) trên web ──► Supabase: build_scores
                                               │ view build_leaderboard (tổng BP theo tên + hạng mục)
                                               ▼
              Plugin DirtyLeaderboards 2.4.0 (web-sync) đọc ~60 giây/lần ──► bảng custom trong game
```

- Web đọc và ghi Supabase bằng **khóa publishable (công khai)**. Quyền được chặn bằng **RLS** trong cơ sở dữ liệu.
- Plugin **chỉ đọc** view `build_leaderboard` bằng khóa publishable. Server Minecraft không mở cổng nào.

---

## 2. Website (`D:\webmc`)

### Chức năng hiện có

- **Member:** trang chủ (logo, IP + nút sao chép, trạng thái online qua api.mcsrvstat.us, tin ghim/event, top 5 builder), Tin tức & Event, Tham gia (Java/Bedrock), Lệnh (tìm kiếm, lọc nhóm, hướng dẫn claim), Xếp hạng BP (bục top 3, bảng, chi tiết), Lịch sử chấm, Ảnh, Góp ý, Nội quy.
- **Player có tài khoản** (tên Minecraft + mật khẩu): đăng ảnh (nén WebP, 5 ảnh/24h), báo cáo ảnh (3 báo cáo thì tự ẩn), gửi báo lỗi/đề xuất (10 lần/24h; có tùy chọn "lỗi khai thác: chỉ admin xem"), ủng hộ đề xuất.
- **Admin** (`admin.html`, đăng nhập bằng email thật), 5 tab:
  - **Chấm BP:** theo tiêu chí, lưu, xóa, xuất CSV.
  - **Thông báo & Event:** đăng, sửa, xóa, ghim, đặt giờ.
  - **Duyệt ảnh:** ẩn, hiện lại, xóa.
  - **Góp ý:** đổi trạng thái, trả lời, chuyển chế độ riêng tư.
  - **Người chơi:** đổi tên hiển thị, khóa tài khoản.

### Cấu trúc file

Xem bảng chi tiết trong `AGENTS.md` mục 3. Tóm tắt:

- `index.html`, `admin.html`: hai trang.
- `css/tokens.css`: mọi màu, font, khoảng cách. Đổi giao diện thì sửa ở đây.
- `data/*.js`: nội dung sửa không cần code (server, lệnh, tiêu chí BP, cấu hình Supabase).
- `js/*.js`: logic, mỗi trang một module.
- `supabase.sql`, `supabase-v2.sql`: lược đồ cơ sở dữ liệu và RLS. **Đã chạy trên Supabase thật.**
- `_test/`: **bộ test giao diện với Supabase giả** (xem mục 4). Không deploy.

### Đăng nhập player: điều dễ nhầm nhất

Supabase Auth bắt buộc có email, nên tên Minecraft được đổi thành `ten@players.equalsurvival.invalid` (`data/config.js` → `PLAYER_EMAIL_DOMAIN`).

- Mục **"Confirm email" phải TẮT** trong Supabase (Authentication → Sign In / Providers → Email). Nếu bật, Supabase cố gửi thư và từ chối tên miền `.invalid`, gây lỗi *"Email address … is invalid"*. Web đã đổi lỗi này thành câu hướng dẫn tiếng Việt (`friendlyError` trong `js/lib.js`).
- Kiểm tra nhanh (chỉ đọc): `GET https://rytcmsndgwyeoqikesgz.supabase.co/auth/v1/settings` với header `apikey`. `"mailer_autoconfirm": true` nghĩa là đã tắt xác nhận email, đúng như cần.
- Không có quên mật khẩu tự động; admin đặt lại trên dashboard.
- Admin đổi tên hiển thị **không** đổi tên đăng nhập, vì tên đăng nhập gắn với email giả tạo lúc đăng ký.

---

## 3. Plugin (`D:\plugins mc\DirtyLeaderboards-26`)

- Paper plugin hiển thị bảng xếp hạng bằng Text/Block Display. Nguồn dữ liệu: `statistic`, `placeholder`, `custom` (điểm do lệnh, API, Skript hoặc web-sync ghi).
- Bản hiện tại: **2.4.0** (`gradle.properties`). **Quy tắc của người dùng: mỗi lần sửa plugin phải tăng version** (sửa lỗi +0.0.1, tính năng mới +0.1.0) rồi build lại.
- Gói chính:
  - `storage/`: lưu điểm YAML/SQLite.
  - `leaderboard/`: `ScoreStore`, `TopService`.
  - `display/`: hiển thị, bố cục dòng "justified" không phụ thuộc font.
  - `websync/`: đồng bộ từ Supabase.
  - `command/`: lệnh `/dlb`.
  - `api/`: `LeaderboardService`.
- Build và test (máy người dùng có JDK 25, **không có Node/Python**):
  ```bash
  cd "D:\plugins mc\DirtyLeaderboards-26"
  ./gradlew build
  ```
  Kết quả: `build/libs/DirtyLeaderboards-<version>.jar`, bản **không** có hậu tố `-plain`. Hiện có 70 test (JUnit 6 + MockBukkit 26.1.2). Test web-sync dùng `com.sun.net.httpserver` làm Supabase giả.
- Cấu hình web-sync mẫu: README của plugin, mục "Đồng bộ với website".

---

## 4. Cách chạy và kiểm tra web

```bash
jwebserver -p 5173 -b 127.0.0.1 -d D:\webmc
```

- `http://localhost:5173`: web thật, nối **Supabase thật**. Đừng tạo hay xóa dữ liệu thật khi chưa hỏi người dùng.
- `http://localhost:5173/_test/index.html` và `/_test/admin.html`: cùng mã nguồn nhưng dùng **Supabase giả trong trình duyệt** (`_test/fake-supabase.js`, nạp qua importmap). Dữ liệu lưu trong `localStorage` của trình duyệt.
  - Admin giả: `admin@test.local` / `adminpass`.
  - Xóa dữ liệu giả: chạy `localStorage.removeItem('fakeDB'); localStorage.removeItem('fakeSession')` trong console.
  - Khi thêm tính năng gọi bảng hoặc phương thức Supabase mới, **cập nhật `fake-supabase.js`** (bảng, luật quyền, trigger giả) để test được.
  - Bộ giả chỉ kiểm tra giao diện và logic JS. **Quyền thật (RLS) phải thử trên Supabase thật** bằng tài khoản thật của người dùng.
- `_test/index.html` và `_test/admin.html` được sinh từ `index.html`/`admin.html` bằng cách chèn importmap và `<base href="/">` ngay sau `<head>`. Sửa `index.html` hoặc `admin.html` xong thì **tạo lại 2 file này**.
- Luôn kiểm tra ở khổ máy tính và điện thoại (375px): không cuộn ngang, console không lỗi.

---

## 5. Việc tiếp theo cho Codex (làm theo thứ tự, hỏi người dùng trước mỗi việc)

### Việc 1: Nút "Sửa" lượt chấm BP trên admin *(nhỏ, nên làm trước)*

Hiện admin chấm nhầm phải xóa rồi chấm lại.

1. Tạo `supabase-v3.sql` (chạy lại được nhiều lần): thêm policy `for update to authenticated using (public.is_admin()) with check (public.is_admin())` cho `build_scores`. Ràng buộc `valid_criteria` sẵn có vẫn kiểm tra điểm.
2. `admin.html` / `js/admin.js`: thêm nút **Sửa** trong "Kết quả đã lưu". Bấm vào thì nạp lượt chấm lên form (tên, công trình, hạng mục, từng tiêu chí, ghi chú), nút Lưu đổi thành "Lưu thay đổi", có nút "Hủy sửa". Lưu bằng `.update(...).eq("id", id)`.
3. Cập nhật `_test/fake-supabase.js` (`canUpdate` cho `build_scores`).
4. **Xong khi:** sửa được một lượt chấm ở `_test/admin.html`; tổng BP ở trang Xếp hạng đổi theo; nhắc người dùng chạy `supabase-v3.sql`.

### Việc 2: Mô tả chính xác 4 lệnh server *(cần người dùng cung cấp)*

`data/commands.js` có dòng `TODO(admin)` cho `/eqmenu`, `/warp`, `/ce`, `/claimhelp`. **Hỏi người dùng**: `/ce` tốn gì và ra gì? `/warp` có những khu vực nào? Trong `/eqmenu` có gì? Chỉ ghi những gì người dùng xác nhận, không bịa. Nếu `/warp` có nhiều khu, có thể thêm danh sách khu vào trang Lệnh.

### Việc 3: Hỗ trợ tên Bedrock *(hỏi người dùng có muốn không)*

Floodgate thêm dấu `.` vào đầu tên Bedrock (ví dụ `.Steve`). Hiện tên phải khớp `^[A-Za-z0-9_]{3,16}$` ở JS **và** SQL (`profiles`, form chấm BP). Muốn hỗ trợ thì phải sửa cả hai nơi trong `supabase-v3.sql` và JS, và nhắc người dùng rằng plugin mặc định ẩn tên bắt đầu bằng `.` (`settings.excluded-name-prefixes` trong config plugin).

### Việc 4: Plugin 2.5.0, tích hợp chung cho nhiều web và dev *(lớn, hỏi kỹ trước)*

Người dùng đã đồng ý hướng đi: Supabase chỉ là một cấu hình mẫu. Các phần, làm lần lượt:

1. **Nguồn dữ liệu HTTP chung** (`source: http-json` hoặc tổng quát hóa `websync`): đọc **bất kỳ URL** trả JSON, cấu hình tên trường (`player`, `score`, `category`).
2. **Webhook đẩy ra:** khi điểm đổi, bảng đổi hoặc reset mùa, POST JSON tới các URL cấu hình, có **chữ ký HMAC-SHA256**, tự thử lại; có mẫu Discord webhook.
3. **(2.6.0) REST API trong plugin:** `GET` top/người chơi công khai; `POST` ghi điểm cần **API key riêng cho từng dev** (lưu dạng hash, có phạm vi quyền, giới hạn tần suất, log). **Mặc định tắt**, chỉ nghe `127.0.0.1`.

Quy tắc: mọi việc mạng chạy async (không chặn main thread), lỗi thì giữ dữ liệu cũ và chỉ log một lần, test bằng `HttpServer` giả, tăng version, cập nhật README plugin.

### Việc 5 (tùy chọn): Đẩy bảng trong game lên web

Plugin ghi top 10 các bảng (giờ chơi, kills…) vào bảng Supabase mới `game_leaderboards`, cần khóa `service_role` **chỉ trong config plugin trên server**, tuyệt đối không đưa lên web. Web thêm trang hiển thị và chỉ đọc. Có RLS: ai cũng đọc được, không ai ghi được qua khóa công khai.

### Việc 6 (tùy chọn): Tab "Điểm trong game" trên admin

Cho admin cộng/trừ điểm các bảng custom khác (ví dụ bảng event) từ web; plugin đồng bộ về giống web-sync. Cần thêm bảng Supabase + view và mở rộng cấu hình `web-sync.boards` của plugin.

---

## 6. Những điều KHÔNG được làm

- Không đưa khóa `service_role` hay secret vào bất kỳ file nào của web.
- Không đổi tên hay cột của view `build_leaderboard` (`player_name`, `category`, `total_points`), vì plugin 2.4.0 đọc đúng các cột này.
- Không chuyển web sang framework hoặc bước build (React, Tailwind, npm…) khi người dùng chưa yêu cầu.
- Không sửa dữ liệu thật trên Supabase, không xóa file người dùng tạo, không commit hay push khi chưa được yêu cầu.
- Không bịa thông tin server (IP, lệnh, tính năng plugin khác). Không biết thì hỏi.

## 7. Lưu ý về git

`.gitignore` của web đang loại `AGENTS.md`, `HUONG-DAN.md`, `README.md`, `supabase*.sql`, `_test/` khỏi repo. Nếu Codex làm việc **trên GitHub** (không phải trên máy người dùng), các file đó sẽ không có. Hãy nhắc người dùng dán nội dung `CODEX.md` và `AGENTS.md` vào yêu cầu, hoặc bỏ các dòng tương ứng trong `.gitignore`.
