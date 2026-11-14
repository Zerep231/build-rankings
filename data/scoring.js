// Build Points rubric. Must stay in sync with valid_build_score() in supabase.sql.
export const TYPES = {
  self: {
    name: "Tự Build",
    criteria: [["Ý tưởng và sáng tạo", 2], ["Kiến trúc và thẩm mỹ", 2.5], ["Quy mô và độ phức tạp", 2], ["Decor nội/ngoại thất", 2], ["Mức độ hoàn thiện", 1.5]],
  },
  litematica: {
    name: "Litematica",
    criteria: [["Quy mô công trình", 3], ["Độ phức tạp thi công", 3], ["Công sức và mức độ đầu tư", 2], ["Hoàn thiện và bổ sung", 2]],
  },
  assist: {
    name: "Phụ Build",
    criteria: [["Khối lượng hỗ trợ", 2], ["Độ khó công việc", 1.5], ["Decor và độ chi tiết", 1.5], ["Chủ động và chất lượng", 1]],
  },
  plan: {
    name: "Quy hoạch",
    criteria: [["Quy mô và số lượng công trình", 20], ["Bố cục và phân khu", 20], ["Giao thông và kết nối", 15], ["Kiến trúc đồng bộ", 15], ["Cảnh quan và môi trường", 15], ["Tiện ích công cộng", 10], ["Mức độ hoàn thiện", 5]],
  },
};

export const maxPoints = (type) => type.criteria.reduce((sum, [, cap]) => sum + cap, 0);

export const PLAN_SCALE = [
  ["Cụm dân cư", "1 đến 15 BP"],
  ["Khu dân cư", "16 đến 35 BP"],
  ["Thị trấn", "36 đến 60 BP"],
  ["Thành phố", "61 đến 85 BP"],
  ["Đại đô thị hoặc Vương quốc", "86 đến 100 BP"],
];
