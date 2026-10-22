import type { HeroId } from "./types";

export type CharacterStatKey =
  | "strength"
  | "intelligence"
  | "speed"
  | "luck"
  | "humor";

export interface CharacterProfile {
  heroId: HeroId;
  name: string;
  nickname: string;
  /** Class name shown on the badge (Vietnamese). */
  title: string;
  personality: string;
  backstory: string;
  specialAbility: {
    name: string;
    description: string;
  };
  strengths: string[];
  weaknesses: string[];
  funnyQuote: string;
  /** Each stat is 0–100. */
  stats: Record<CharacterStatKey, number>;
}

/** Display order + Vietnamese labels for the stat bars. */
export const STAT_LABELS: { key: CharacterStatKey; label: string }[] = [
  { key: "strength", label: "Sức mạnh" },
  { key: "intelligence", label: "Trí thông minh" },
  { key: "speed", label: "Tốc độ" },
  { key: "luck", label: "May mắn" },
  { key: "humor", label: "Độ tấu hài" },
];

export const CHARACTER_PROFILES: Record<HeroId, CharacterProfile> = {
  sword: {
    heroId: "sword",
    name: "Kiếm Sĩ Mặt Lạnh",
    nickname: "Anh Kiếm",
    title: "Kiếm Sĩ",
    personality:
      "Ít nói, lạnh lùng, thích dùng kiếm giải quyết mọi vấn đề.",
    backstory:
      "Một kiếm sĩ tự nhận mình là cao thủ giang hồ. Chưa từng thua trận nào, vì mỗi lần sắp thua đều tìm cách bỏ chạy.",
    specialAbility: {
      name: "SLASH — Chém Trước Hỏi Sau",
      description:
        "Vung kiếm chém bay vật cản trước mặt. Câu hỏi để dành cho sau, nếu còn ai để hỏi.",
    },
    strengths: ["Chiến đấu", "Phá vật cản"],
    weaknesses: ["Giải đố", "Giao tiếp"],
    funnyQuote: "Không giải quyết được bằng kiếm thì dùng hai thanh kiếm.",
    stats: { strength: 90, intelligence: 35, speed: 70, luck: 40, humor: 65 },
  },
  professor: {
    heroId: "professor",
    name: "Giáo Sư Bốn Mắt",
    nickname: "Giáo Sư",
    title: "Học Giả",
    personality: "Thông minh, thích phân tích, luôn nghĩ mình đúng.",
    backstory:
      "Tốt nghiệp 12 khóa học online và sở hữu 38 chứng chỉ chưa ai kiểm chứng. Có thể giải phương trình phức tạp nhưng thường quên mang dép.",
    specialAbility: {
      name: "ANALYZE — Phân Tích Quá Mức",
      description:
        "Soi kỹ mọi thứ xung quanh để tìm manh mối. Đôi khi phân tích lâu đến mức quái vật ngủ quên.",
    },
    strengths: ["Giải đố", "Tìm manh mối"],
    weaknesses: ["Chiến đấu", "Phản xạ"],
    funnyQuote:
      "Theo tính toán của tôi, khả năng chúng ta sống sót là... khoan đã!",
    stats: { strength: 20, intelligence: 95, speed: 40, luck: 55, humor: 80 },
  },
  chairman: {
    heroId: "chairman",
    name: "Chủ Tịch Mõm",
    nickname: "Chủ Tịch",
    title: "Nhà Đàm Phán",
    personality: "Tự tin, thích kinh doanh, chuyên nói chuyện tỷ đô.",
    backstory:
      "Tự phong chủ tịch của một tập đoàn chưa đăng ký kinh doanh. Đi đâu cũng mang theo danh thiếp, nhưng chưa bao giờ có tiền mặt.",
    specialAbility: {
      name: "NEGOTIATE — Để Anh Lo",
      description:
        "Dùng miệng lưỡi tỷ đô thuyết phục NPC mở đường. Hợp đồng ký bằng niềm tin, thanh toán bằng lời hứa.",
    },
    strengths: ["Thương lượng", "Thuyết phục NPC"],
    weaknesses: ["Chiến đấu", "Quản lý tài chính"],
    funnyQuote: "Cái này để anh gọi người quen!",
    stats: { strength: 35, intelligence: 75, speed: 45, luck: 85, humor: 90 },
  },
  angry: {
    heroId: "angry",
    name: "Đại Ca Cáu Bẳn",
    nickname: "Đại Ca",
    title: "Cuồng Chiến Binh",
    personality: "Nóng tính, cộc cằn, không thích chờ đợi.",
    backstory:
      "Từng gây chiến với máy bán nước vì máy không trả tiền thừa. Là người duy nhất trong làng từng đánh nhau với cái bóng của mình.",
    specialAbility: {
      name: "SMASH — Đấm Cả Thế Giới",
      description:
        "Một cú đấm dồn hết cơn giận buổi sáng, phá tan mọi thứ chắn đường — kể cả thứ không chắn đường.",
    },
    strengths: ["Sức mạnh", "Phá vật cản"],
    weaknesses: ["Kiên nhẫn", "Trí thông minh"],
    funnyQuote: "Mày nhìn cái gì?",
    stats: { strength: 100, intelligence: 15, speed: 65, luck: 30, humor: 85 },
  },
  comedian: {
    heroId: "comedian",
    name: "Thánh Tấu Hài",
    nickname: "Thánh Hề",
    title: "Kẻ Bịp Bợm",
    personality:
      "Khó đoán, thích bày trò, có khả năng biến mọi tình huống thành trò đùa.",
    backstory:
      "Không ai biết xuất thân thật sự. Có tin đồn nhân vật này từng lừa được cả thần chết bằng một câu chuyện cười.",
    specialAbility: {
      name: "TRICK — Không Ai Đoán Được",
      description:
        "Tung ra một trò đùa khiến kẻ địch ngơ ngác. Chính người dùng cũng không biết chuyện gì sẽ xảy ra.",
    },
    strengths: ["Đánh lạc hướng", "Giải đố phi logic"],
    weaknesses: ["Chiến đấu trực diện", "Sự nghiêm túc"],
    funnyQuote: "Tôi không biết mình đang làm gì, nhưng có vẻ hiệu quả!",
    stats: { strength: 30, intelligence: 65, speed: 80, luck: 100, humor: 100 },
  },
};

export function getCharacterProfile(
  heroId: string | null | undefined,
): CharacterProfile | null {
  if (!heroId) return null;
  return CHARACTER_PROFILES[heroId as HeroId] ?? null;
}
