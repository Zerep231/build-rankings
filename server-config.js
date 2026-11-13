// Public server presentation data. Verify IP, version and plugins before publishing them.
window.SERVER_INFO = {
  name: "Minecraft Community",
  ip: "",
  port: 25565,
  version: "",
  status: "Chưa kiểm tra",
  description: "Máy chủ Minecraft dành cho cộng đồng xây dựng, khám phá và phát triển công trình. Thành tích Build Points được ghi nhận công khai trên website.",
  highlights: [
    { title: "🏗️ Build Points", description: "Chấm điểm công trình theo từng tiêu chí và lưu lịch sử công khai." },
    { title: "🏆 Builder Rankings", description: "Xếp hạng Builder theo BP tích lũy và theo từng hạng mục." },
    { title: "🧭 Cộng đồng xây dựng", description: "Tự Build, Litematica, phụ Build và quy hoạch." }
  ],
  plugins: [
    { name: "DirtyLeaderboards", description: "Dự án plugin bảng xếp hạng của cộng đồng; chưa xác minh có đang chạy trên server.", verified: false }
  ]
};
