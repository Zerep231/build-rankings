// Server facts shown to members. Edit here; pages read from this file.
export const SERVER = {
  name: "EQUAL SURVIVAL",
  tagline: "Sinh tồn thư thả: xây nhà, trồng trọt, cùng bạn bè chill mỗi ngày.",
  javaHost: "luna.lumine.buzz",
  javaPort: 25559,
  bedrockHost: "luna.lumine.buzz",
  bedrockPort: 19101,
  version: "Paper 26.2",
  clientVersion: "26.2",
  highlights: [
    {
      icon: "grass",
      title: "Chill, không vội vàng",
      text: "Không đua top PvP, không áp lực. Cứ chơi theo nhịp của bạn, xây thứ bạn thích.",
    },
    {
      icon: "pickaxe",
      title: "Build Points",
      text: "Công trình đẹp được admin chấm theo tiêu chí rõ ràng và cộng vào bảng xếp hạng.",
    },
    {
      icon: "heart",
      title: "Cộng đồng thân thiện",
      text: "Giúp nhau xây, chia sẻ tài nguyên, tôn trọng đất và công trình của người khác.",
    },
  ],
};

export const joinAddress = (host, port, defaultPort) =>
  host ? (port && port !== defaultPort ? `${host}:${port}` : host) : "";
