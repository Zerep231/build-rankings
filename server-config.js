// Public server presentation data. Verify IP, version and plugins before publishing them.
window.SERVER_INFO = {
  name: "EQUALSURVIVAL",
  ip: "luna.lumine.buzz",
  port: 25559,
  version: "Paper 26.2",
  status: "Chưa kiểm tra",
  description: "Máy chủ Minecraft ghi nhận công trình và đóng góp builder bằng hệ thống Build Points trên website.",
  highlights: [
    { title: "Build Points", description: "Chấm công trình theo tiêu chí và lưu lại từng lượt đánh giá." },
    { title: "Bảng xếp hạng", description: "Cộng BP theo builder và lọc theo hạng mục công trình." },
    { title: "Hạng mục xây dựng", description: "Tự Build, Litematica, phụ Build và quy hoạch." }
  ],
  plugins: [
    { name: "DirtyLeaderboards", version: "2.3.0", description: "Bảng xếp hạng hiển thị trong game. Log xác nhận plugin; website hiện lấy BP từ Supabase.", reference: "https://github.com/Zerep231/DirtyLeaderboards" },
    { name: "GriefPrevention", version: "16.18.7", description: "Tạo claim và chia quyền xây dựng trong khu vực của bạn.", reference: "https://github.com/GriefPrevention/GriefPrevention-Docs/blob/master/commands.md" },
    { name: "BetterRTP", version: "3.6.13", description: "Dịch chuyển ngẫu nhiên tới khu vực được server cho phép.", reference: "https://dev.bukkit.org/projects/betterrtp" },
    { name: "JustTPA", version: "20260625-0111", description: "Gửi và nhận yêu cầu dịch chuyển giữa người chơi.", reference: "https://github.com/JustPlayerDE/just-tpa" },
    { name: "SetHome", version: "6.3", description: "Lưu vị trí nhà và quay lại bằng lệnh home.", reference: "https://modrinth.com/plugin/sethome" },
    { name: "GSit", version: "3.5.1", description: "Tư thế ngồi và nằm cho người chơi.", reference: "https://hangar.papermc.io/Gecolay/GSit" },
    { name: "Geyser-Spigot", version: "2.12.1-SNAPSHOT", description: "Plugin kết nối người chơi Bedrock với server Java.", reference: "https://github.com/GeyserMC/Geyser" },
    { name: "floodgate", version: "2.2.5-SNAPSHOT", description: "Hỗ trợ xác thực người chơi Bedrock khi dùng Geyser.", reference: "https://github.com/GeyserMC/Floodgate" },
    { name: "LuckPerms", version: "5.5.53", description: "Quản lý nhóm và quyền lệnh trên server.", reference: "https://luckperms.net/wiki/Home" },
  ],
  commands: [
    { command: "/rtp", description: "Dịch chuyển ngẫu nhiên trong thế giới được phép.", plugin: "BetterRTP", category: "Di chuyển", note: "Cần quyền betterrtp.use; quyền theo thế giới do server đặt.", reference: "https://dev.bukkit.org/projects/betterrtp" },
    { command: "/tpa <người chơi>", description: "Gửi yêu cầu dịch chuyển tới người chơi đó.", plugin: "JustTPA", category: "Di chuyển", note: "Quyền justplayer.tpa.request có thể được chỉnh trong LuckPerms.", reference: "https://github.com/JustPlayerDE/just-tpa" },
    { command: "/tpahere <người chơi>", description: "Mời người chơi dịch chuyển tới chỗ bạn.", plugin: "JustTPA", category: "Di chuyển", note: "Quyền justplayer.tpa.here có thể được chỉnh trong LuckPerms.", reference: "https://github.com/JustPlayerDE/just-tpa" },
    { command: "/tpaccept [người chơi]", description: "Chấp nhận yêu cầu dịch chuyển đang chờ.", plugin: "JustTPA", category: "Di chuyển", note: "Quyền justplayer.tpa.accept có thể được chỉnh trong LuckPerms.", reference: "https://github.com/JustPlayerDE/just-tpa" },
    { command: "/tpadeny", description: "Từ chối yêu cầu dịch chuyển đang chờ.", plugin: "JustTPA", category: "Di chuyển", note: "Quyền justplayer.tpa.deny có thể được chỉnh trong LuckPerms.", reference: "https://github.com/JustPlayerDE/just-tpa" },
    { command: "/tpacancel", description: "Hủy yêu cầu dịch chuyển bạn đã gửi.", plugin: "JustTPA", category: "Di chuyển", note: "Quyền justplayer.tpa.cancel có thể được chỉnh trong LuckPerms.", reference: "https://github.com/JustPlayerDE/just-tpa" },
    { command: "/sethome [tên]", description: "Lưu vị trí hiện tại thành nhà.", plugin: "SetHome", category: "Nhà", note: "Quyền homeplugin.sethome có thể được chỉnh trong LuckPerms.", reference: "https://modrinth.com/plugin/sethome" },
    { command: "/home [tên]", description: "Dịch chuyển tới nhà đã lưu.", plugin: "SetHome", category: "Nhà", note: "Quyền homeplugin.home có thể được chỉnh trong LuckPerms.", reference: "https://modrinth.com/plugin/sethome" },
    { command: "/delhome [tên]", description: "Xóa một vị trí nhà đã lưu.", plugin: "SetHome", category: "Nhà", note: "Quyền homeplugin.delhome có thể được chỉnh trong LuckPerms.", reference: "https://modrinth.com/plugin/sethome" },
    { command: "/sit", description: "Ngồi tại vị trí hiện tại nếu khu vực cho phép.", plugin: "GSit", category: "Tương tác", note: "Lệnh hoặc tư thế có thể bị giới hạn theo cấu hình server.", reference: "https://hangar.papermc.io/Gecolay/GSit" },
    { command: "/lay", description: "Nằm tại vị trí hiện tại nếu khu vực cho phép.", plugin: "GSit", category: "Tương tác", note: "Lệnh hoặc tư thế có thể bị giới hạn theo cấu hình server.", reference: "https://hangar.papermc.io/Gecolay/GSit" },
    { command: "/trust <người chơi>", description: "Cho phép người chơi xây trong claim của bạn.", plugin: "GriefPrevention", category: "Bảo vệ đất", note: "Dùng trong claim của bạn; quyền claims do server đặt.", reference: "https://github.com/GriefPrevention/GriefPrevention-Docs/blob/master/commands.md" },
    { command: "/containertrust <người chơi>", description: "Cho phép dùng rương, vật nuôi và một số vật dụng trong claim.", plugin: "GriefPrevention", category: "Bảo vệ đất", note: "Dùng trong claim của bạn; quyền claims do server đặt.", reference: "https://github.com/GriefPrevention/GriefPrevention-Docs/blob/master/commands.md" },
    { command: "/claimslist", description: "Xem claim và thông tin claim block của bạn.", plugin: "GriefPrevention", category: "Bảo vệ đất", note: "Quyền claims do server đặt.", reference: "https://github.com/GriefPrevention/GriefPrevention-Docs/blob/master/commands.md" }
  ],
};
