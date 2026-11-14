# Hướng dẫn cài đặt web EQUAL SURVIVAL

Web là HTML/CSS/JS tĩnh, dữ liệu nằm trên **Supabase**. Không cần build, đưa thư mục lên GitHub Pages hoặc hosting tĩnh bất kỳ là chạy.

## 1. Chạy SQL trên Supabase (bắt buộc, làm một lần)

Supabase → **SQL Editor** → New query, dán và chạy lần lượt:

1. `supabase.sql`: bảng chấm BP và admin (đã có từ trước).
2. `supabase-v2.sql`: tài khoản player, thư viện ảnh, báo lỗi/đề xuất, thông báo/event, view cho plugin.

Cả hai file chạy lại nhiều lần không sao. Khi chưa chạy file 2, các trang Tin tức, Ảnh, Góp ý chỉ hiện "Mục này đang được chuẩn bị".

## 2. Bật đăng nhập "tên + mật khẩu" cho player

Player đăng nhập bằng **tên Minecraft + mật khẩu**. Supabase cần một email cho mỗi tài khoản, nên web tự đổi tên thành địa chỉ giả `ten@players.equalsurvival.invalid` (đuôi `.invalid` là tên miền dành riêng, không bao giờ nhận thư). Vì vậy:

- Supabase → **Authentication → Sign In / Providers → Email**: **tắt "Confirm email"**. Nếu để bật, tài khoản mới không dùng được và Supabase sẽ gửi thư vào địa chỉ không tồn tại.
- Giữ "Allow new users to sign up" **bật**.
- Nên tăng độ dài mật khẩu tối thiểu lên 8 (Authentication → Policies/Passwords) cho khớp với web.

Lưu ý:

- **Không có "quên mật khẩu" tự động** vì không có email thật. Player nhắn admin. Admin đặt lại ở Supabase → Authentication → Users → chọn người → Reset password / Update user.
- **Tên là tự khai.** Một tên chỉ đăng ký được một lần. Nếu ai khai nhầm tên người khác, admin vào `admin.html` → **Người chơi** để đổi tên hiển thị hoặc khóa tài khoản.
- Admin vẫn đăng nhập `admin.html` bằng **email thật** như trước.

## 3. Thư viện ảnh

`supabase-v2.sql` tự tạo bucket `gallery` (công khai, tối đa 2 MB/ảnh, chỉ PNG/JPG/WebP). Ảnh được nén trên trình duyệt trước khi tải lên. Mỗi người đăng tối đa 5 ảnh/24 giờ. Ảnh bị **3 người khác nhau báo cáo** sẽ tự ẩn chờ admin xem ở tab **Duyệt ảnh**.

Ảnh đang ẩn vẫn mở được nếu ai đó có sẵn đường link trực tiếp, vì bucket là công khai. Muốn gỡ hẳn thì bấm **Xóa**.

## 4. Sửa nội dung không cần code

| Muốn đổi | Sửa file |
|---|---|
| IP, cổng, phiên bản, câu giới thiệu | `data/server.js` |
| Danh sách lệnh (có dòng `TODO(admin)` cho 4 lệnh mới) | `data/commands.js` |
| Tiêu chí chấm BP (phải khớp với `supabase.sql`) | `data/scoring.js` |
| Màu sắc, font | `css/tokens.css` |

---

## 5. Kết nối web với plugin DirtyLeaderboards

Web và plugin **không nói chuyện trực tiếp**. Cả hai cùng đọc và ghi vào Supabase, nên server Minecraft không phải mở cổng nào ra ngoài.

```
 Admin chấm BP trên web ──► Supabase: build_scores
                                   │
                                   ▼  view build_leaderboard (tổng BP theo tên + hạng mục)
                                   │
        Plugin DirtyLeaderboards ◄─┘  cứ ~60 giây đọc một lần, ghi vào bảng "build" trong game
                 │
                 └─(tùy chọn)─► Supabase: bảng trong game (giờ chơi, kills…) ──► web hiển thị
```

### 5.1 Từ web vào game: BP hiện trên bảng trong game

`supabase-v2.sql` đã tạo sẵn view **`build_leaderboard`**:

| cột | ý nghĩa |
|---|---|
| `player_key` | tên viết thường, dùng để khớp |
| `player_name` | tên hiển thị |
| `category` | `self` / `litematica` / `assist` / `plan` |
| `total_points` | tổng BP của hạng mục đó |
| `reviews` | số lượt chấm |

Thử ngay bằng trình duyệt hoặc `curl` (dùng khóa **publishable** công khai, chỉ đọc được):

```bash
curl "https://rytcmsndgwyeoqikesgz.supabase.co/rest/v1/build_leaderboard?select=player_name,category,total_points" -H "apikey: sb_publishable_kyzBo9X_E-ZuSZ_2o-gIog_7KyMt2ZQ"
```

Khi bản plugin có tính năng đồng bộ (đề xuất 2.4.0), cấu hình sẽ trông như sau:

```yaml
# plugins/DirtyLeaderboards/config.yml
web-sync:
  enabled: true
  supabase-url: "https://rytcmsndgwyeoqikesgz.supabase.co"
  # Khóa công khai là đủ để đọc BP (chỉ đọc).
  api-key: "sb_publishable_..."
  interval-seconds: 60
  boards:
    build: all          # tổng mọi hạng mục -> bảng "build"
    build_self: self    # tùy chọn: mỗi hạng mục một bảng
    build_plan: plan
```

Plugin sẽ:

1. Gọi `GET /rest/v1/build_leaderboard` mỗi `interval-seconds`, **chạy ngầm** để không làm lag server.
2. Cộng `total_points` theo `player_key`, đổi tên ra UUID bằng cache người chơi của server. Người **chưa từng vào server** sẽ bị bỏ qua và ghi log.
3. Ghi điểm vào bảng custom tương ứng (`/dlb points create build TOP BUILDER` một lần), rồi đưa `build` vào `rotation` của display để hiện trong game.
4. Mất mạng hoặc Supabase lỗi: giữ điểm cũ, thử lại lần sau, chỉ log một lần.

Placeholder sẵn có sẽ dùng được ngay, ví dụ `%dirtyleaderboards_rank_build%` và `%dirtyleaderboards_top_build_1_name%`.

### 5.2 Từ game lên web (tùy chọn)

Để web hiện cả các bảng trong game (giờ chơi, kills, points…), plugin cần **ghi** lên Supabase, nên cần **khóa `service_role`**:

- Khóa này có toàn quyền. **Chỉ đặt trong `config.yml` của plugin trên server**, tuyệt đối không đưa vào web hay GitHub.
- Plugin sẽ upsert top 10 của mỗi bảng vào một bảng `game_leaderboards` (sẽ tạo khi làm tính năng này). Web đọc bảng đó để hiển thị.

### 5.3 Vì sao khớp theo tên chứ không theo UUID

Web cho người chơi **tự khai tên** (không xác minh trong game), nên plugin khớp BP theo tên Minecraft. Nếu sau này muốn chống mạo danh, có thể thêm lệnh `/eqlink <mã>`: người chơi lấy mã trên web rồi gõ trong game, plugin xác nhận và gắn tài khoản web với UUID thật.

Kiến trúc hiện tại đã chừa sẵn chỗ cho việc này, không phải làm lại.
