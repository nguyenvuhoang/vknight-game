// Chapter 1 "Làng Ngáo": per-level map artwork, guide text and level status.
// Single source for map image paths - do not build these URLs elsewhere.

export const CHAPTER1_TITLE = "Chapter 1: Làng Ngáo";

export const CHAPTER1_STORY = [
  "Vua Vịt tuyên bố công chúa đã mất tích bí ẩn. Năm thằng ngáo chưa kịp ăn sáng đã nhận nhiệm vụ giải cứu.",
  "Từ cổng làng, những con đường kỳ quặc dẫn họ qua rừng sâu, cầu gãy, đèo núi và vô số tình huống khó đỡ.",
  "Liệu đây là hành trình giải cứu công chúa, hay chỉ là một trò đùa cực lớn?",
];

export type Chapter1Level = {
  level: number;
  title: string;
  description: string;
  image: string;
};

const GUIDE: [title: string, description: string][] = [
  ["Bước Ra Khỏi Nhà", "Tìm đôi dép bị chó tha và bắt đầu hành trình"],
  ["Gặp Dân Làng", "Thu thập thông tin từ những người dân kỳ quặc"],
  ["Ruộng Lúa Bất Ổn", "Vượt qua cánh đồng chứa những cái bẫy khó đỡ"],
  ["Cây Cầu Lung Lay", "Tìm cách qua cầu mà không rơi xuống sông"],
  ["Rừng Ngáo", "Khám phá rừng sâu và đối đầu những sinh vật kỳ lạ"],
  ["Hang Bí Ẩn", "Giải câu đố và tìm đường thoát khỏi hang tối"],
  ["Đồi Gió Lộng", "Vượt chướng ngại vật giữa những cơn gió mạnh"],
  ["Thung Lũng Ngáo Ngơ", "Khám phá thung lũng và tìm manh mối về công chúa"],
  ["Đỉnh Đá Thử Thách", "Vượt qua thử thách cuối cùng trước lâu đài"],
  ["Đối Đầu Trùm Làng Ngáo", "Đánh bại boss và khám phá bí mật công chúa mất tích"],
];

export const chapter1MapImage = (level: number) =>
  `/chapters/chap01/chap01-map${String(level).padStart(2, "0")}.jpg`;

export const CHAPTER1_LEVELS: Chapter1Level[] = GUIDE.map(
  ([title, description], i) => ({
    level: i + 1,
    title,
    description,
    image: chapter1MapImage(i + 1),
  }),
);

export type LevelStatus = "LOCKED" | "AVAILABLE" | "COMPLETED";

// Same unlock rule as the homepage stage buttons: a level is playable once the
// previous one is completed; completed levels stay replayable.
export function levelStatus(level: number, completedCount: number): LevelStatus {
  if (level <= completedCount) return "COMPLETED";
  return level === completedCount + 1 ? "AVAILABLE" : "LOCKED";
}

export const STATUS_TEXT: Record<LevelStatus, string> = {
  COMPLETED: "Đã hoàn thành",
  AVAILABLE: "Đang mở",
  LOCKED: "Chưa mở khóa",
};

export const STATUS_ICON: Record<LevelStatus, string> = {
  COMPLETED: "✔",
  AVAILABLE: "⚔",
  LOCKED: "🔒",
};

// Dedicated full-screen stage route.
export const playHref = (hero: string, level: number) =>
  `/chapter/1/stage/${level}?hero=${hero}`;

export const mapHref = (hero: string, level?: number) =>
  `/chapter/1/map?hero=${hero}${level ? `&level=${level}` : ""}`;
