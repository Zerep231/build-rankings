// Member commands. One line per command: { command, description, group }.
// Groups are shown in this order.
export const COMMAND_GROUPS = ["Tiện ích server", "Di chuyển", "Nhà", "Bảo vệ đất", "Tương tác"];

export const COMMANDS = [
  // TODO(admin): kiểm tra lại mô tả 4 lệnh của server cho đúng với cấu hình thực tế.
  { command: "/eqmenu", description: "Mở menu EQUAL SURVIVAL: các lệnh cơ bản của server gom vào một chỗ, bấm là dùng.", group: "Tiện ích server", featured: true },
  { command: "/warp", description: "Mở danh sách khu vực của server và dịch chuyển tới khu bạn chọn.", group: "Tiện ích server", featured: true },
  { command: "/ce", description: "Mở gacha enchant: thử vận may để nhận enchant cho đồ của bạn.", group: "Tiện ích server", featured: true },
  { command: "/claimhelp", description: "Mở giao diện hướng dẫn claim và xem thông tin vùng đất của bạn.", group: "Bảo vệ đất", featured: true },
  { command: "/rtp", description: "Dịch chuyển ngẫu nhiên tới một vùng đất mới để khám phá.", group: "Di chuyển" },
  { command: "/tpa <người chơi>", description: "Xin dịch chuyển tới chỗ một người chơi.", group: "Di chuyển" },
  { command: "/tpahere <người chơi>", description: "Mời người chơi dịch chuyển tới chỗ bạn.", group: "Di chuyển" },
  { command: "/tpaccept [người chơi]", description: "Chấp nhận lời mời dịch chuyển đang chờ.", group: "Di chuyển" },
  { command: "/tpadeny", description: "Từ chối lời mời dịch chuyển đang chờ.", group: "Di chuyển" },
  { command: "/tpacancel", description: "Hủy lời mời dịch chuyển bạn đã gửi.", group: "Di chuyển" },
  { command: "/sethome [tên]", description: "Lưu chỗ bạn đang đứng thành nhà.", group: "Nhà" },
  { command: "/home [tên]", description: "Về nhà đã lưu.", group: "Nhà" },
  { command: "/delhome [tên]", description: "Xóa một nhà đã lưu.", group: "Nhà" },
  { command: "/trust <người chơi>", description: "Cho bạn bè cùng xây trong vùng đất của bạn.", group: "Bảo vệ đất" },
  { command: "/containertrust <người chơi>", description: "Cho bạn bè dùng rương, vật nuôi và đồ dùng trong vùng đất.", group: "Bảo vệ đất" },
  { command: "/claimslist", description: "Xem các vùng đất bạn đã claim và số block claim còn lại.", group: "Bảo vệ đất" },
  { command: "/sit", description: "Ngồi xuống nghỉ ngơi ngay tại chỗ.", group: "Tương tác" },
  { command: "/lay", description: "Nằm xuống ngắm trời.", group: "Tương tác" },
];
