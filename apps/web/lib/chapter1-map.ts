// Hotspots for /chapters/map-chapter1.png. Boxes are in source-image pixels
// (each covers the painted stars, numbered medallion and name plate) and are
// rendered as percentages so they stay aligned at any zoom level.
export const MAP_SRC = "/chapters/map-chapter1.png";
export const MAP_W = 1222;
export const MAP_H = 1287;

export type MapSpot = {
  number: number;
  name: string;
  box: [x0: number, y0: number, x1: number, y1: number];
};

export const CHAPTER1_SPOTS: MapSpot[] = [
  { number: 1, name: "Bước Ra Khỏi Nhà", box: [195, 1090, 325, 1222] },
  { number: 2, name: "Gặp Dân Làng", box: [675, 990, 805, 1098] },
  { number: 3, name: "Ruộng Lúa Bất Ổn", box: [1005, 920, 1132, 1045] },
  { number: 4, name: "Cây Cầu Lung Lay", box: [952, 690, 1082, 820] },
  { number: 5, name: "Rừng Ngáo", box: [357, 565, 485, 680] },
  { number: 6, name: "Hang Bí Ẩn", box: [140, 370, 268, 485] },
  { number: 7, name: "Đồi Gió Lộng", box: [362, 255, 495, 362] },
  { number: 8, name: "Thung Lũng Ngáo Ngơ", box: [608, 362, 738, 480] },
  { number: 9, name: "Đỉnh Đá Thử Thách", box: [1008, 365, 1142, 490] },
  { number: 10, name: "Đối Đầu Trùm Làng Ngáo", box: [1036, 118, 1165, 242] },
];

export type StageStatus = "done" | "open" | "locked";

// Same unlock rule as the homepage stage buttons: a stage is playable once the
// previous one is completed; completed stages stay replayable.
export function stageStatus(n: number, completedCount: number): StageStatus {
  if (n <= completedCount) return "done";
  return n === completedCount + 1 ? "open" : "locked";
}

// Deep link into the existing gameplay screen on the homepage.
export const playHref = (hero: string, stage: number) =>
  `/?hero=${hero}&stage=${stage}&play=1`;
