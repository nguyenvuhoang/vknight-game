import type { AdventureStageConfig, Effect } from "./types";

// Ải 1 — Bước Ra Khỏi Nhà. The backdrop is the village corner of the Chapter 1
// map (cropped above the Stage 1 marker); the painted gate is the exit.
// Hotspot boxes are % of that crop.

const handOverSandals: Effect[] = [
  { take: "dep_trai" },
  { take: "dep_phai" },
  {
    say: [
      { who: "ba_tam", text: "Ồ, đủ đôi rồi đây! Chiếc phải hơi… ướt. Con Vàng nó quý cháu đấy." },
      { who: "ba_tam", text: "Mà khoan. Câu hỏi cuối: ra khỏi làng rồi cháu định làm gì đầu tiên?" },
    ],
  },
  {
    choice: {
      options: [
        {
          label: "Cứu công chúa ạ!",
          effects: [
            { say: [{ who: "ba_tam", text: "Giỏi! Nhớ về trước giờ cơm. Đây, giấy thông hành của cháu." }] },
            { give: "giay" },
            { set: "got_pass" },
          ],
        },
        {
          label: "Đi mua nước mắm cho mẹ…",
          effects: [
            {
              say: [
                { who: "ba_tam", text: "Thật thà ghê! Thôi, tiện đường cứu luôn công chúa nhé. Giấy đây." },
              ],
            },
            { give: "giay" },
            { set: "got_pass" },
          ],
        },
        {
          label: "Ăn sáng ạ.",
          effects: [
            {
              say: [
                { who: "ba_tam", text: "Biết ngay mà! Cầm giấy mà đi, đói thì ghé quán đầu làng." },
              ],
            },
            { give: "giay" },
            { set: "got_pass" },
          ],
        },
      ],
    },
  },
];

const feedDog: Effect[] = [
  { take: "xuong" },
  { give: "dep_phai" },
  { set: "dog_fed" },
  {
    say: [
      { who: "narrator", text: "Con Vàng bật dậy như lò xo, ngoạm lấy khúc xương…" },
      { who: "vang", text: "Gâu! (Dịch: Giao dịch thành công. Dép trả lại.)" },
      { who: "hero", text: "Ướt nhẹp… nhưng vẫn là dép của tôi!" },
    ],
  },
];

export const STAGE1: AdventureStageConfig = {
  level: 1,
  scene: {
    src: "/chapters/map-chapter1.png",
    width: 1222,
    height: 1287,
    crop: { x: 0, y: 740, w: 614, h: 345 },
  },
  spawn: { x: 22, y: 70 },
  // Ground traced from the painting (tan dirt): the north road, the plaza round
  // the campfire (not the fire itself), the yard below the house, and the grass
  // strip by the scarecrow. Feet are placed on these, never on roofs or fences.
  walk: [
    { x0: 31, x1: 50, y0: 14, y1: 47 },
    { x0: 19, x1: 47, y0: 46, y1: 54 },
    { x0: 15, x1: 28, y0: 54, y1: 76 },
    { x0: 37, x1: 47, y0: 54, y1: 66 },
    { x0: 86, x1: 97, y0: 68, y1: 78 },
  ],
  intro: [
    { who: "narrator", text: "Mẹ bảo đi mua nước mắm, nhưng bạn lại đi cứu công chúa." },
    { who: "narrator", text: "Muốn ra khỏi làng, bạn phải giúp Bà Tám giải quyết rắc rối trước." },
  ],
  items: {
    dep_trai: { name: "Dép trái", icon: "🩴", description: "Chiếc dép trái, vừa được bù nhìn đi thử." },
    dep_phai: { name: "Dép phải", icon: "🩴", description: "Chiếc dép phải. Hơi ướt. Rất thơm mùi chó." },
    xuong: { name: "Khúc xương", icon: "🦴", description: "Lấy ở quán nước. Đã hứa sẽ trả tiền sau." },
    giay: { name: "Giấy thông hành", icon: "📜", description: "Chữ ký của Bà Tám. Mở được cổng làng." },
  },
  hotspots: [
    {
      id: "ba_tam",
      name: "Bà Tám",
      kind: "npc",
      box: { x: 38, y: 19, w: 8, h: 22 },
      stand: { x: 36, y: 44 },
      sprite: { kind: "granny", feet: { x: 42, y: 41 }, height: 26 },
    },
    {
      id: "vang",
      name: "Con Vàng",
      kind: "npc",
      box: { x: 15.5, y: 64, w: 9, h: 9.5 },
      stand: { x: 26, y: 72 },
      sprite: { kind: "dog", feet: { x: 20, y: 73 }, height: 9 },
    },
    {
      id: "bu_nhin",
      name: "Bù nhìn",
      kind: "object",
      box: { x: 88.5, y: 72, w: 10, h: 24 },
      stand: { x: 89, y: 76 },
    },
    {
      id: "quan",
      name: "Quán nước mái đỏ",
      kind: "object",
      box: { x: 39, y: 39, w: 10.5, h: 20 },
      stand: { x: 43, y: 60 },
    },
    {
      id: "lua",
      name: "Đống lửa",
      kind: "object",
      box: { x: 27, y: 54, w: 10.5, h: 15 },
      stand: { x: 25, y: 61 },
    },
    {
      id: "nha",
      name: "Nhà của bạn",
      kind: "object",
      box: { x: 0, y: 34, w: 22, h: 33 },
      stand: { x: 18, y: 63 },
    },
    {
      id: "vuon",
      name: "Vườn rau",
      kind: "object",
      box: { x: 62, y: 67, w: 24, h: 20 },
      stand: { x: 87, y: 70 },
    },
    {
      id: "cong",
      name: "Cổng làng",
      kind: "exit",
      box: { x: 24.5, y: 68, w: 29, h: 32 },
      stand: { x: 42, y: 65 },
    },
  ],
  rules: [
    // --- Bà Tám ---
    {
      on: "ba_tam",
      verb: "talk",
      when: { notFlags: ["quest"] },
      effects: [
        {
          say: [
            { who: "hero", text: "{heroLine}" },
            { who: "ba_tam", text: "Ăn với chả uống! Cháu định ra khỏi làng mà đi chân đất à?" },
            { who: "ba_tam", text: "Con Vàng nhà bà tha mất đôi dép của cháu từ sáng rồi. Một chiếc thấy bay ra phía ruộng." },
            { who: "ba_tam", text: "Tìm đủ hai chiếc dép về đây, bà ký giấy thông hành. Không có giấy, cổng làng không mở đâu!" },
          ],
        },
        { set: "quest" },
      ],
    },
    { on: "ba_tam", verb: "talk", when: { has: ["dep_trai", "dep_phai"] }, effects: handOverSandals },
    { on: "ba_tam", verb: "use", item: "dep_trai", when: { has: ["dep_phai"] }, effects: handOverSandals },
    { on: "ba_tam", verb: "use", item: "dep_phai", when: { has: ["dep_trai"] }, effects: handOverSandals },
    {
      on: "ba_tam",
      verb: "use",
      item: "dep_trai",
      effects: [{ say: [{ who: "ba_tam", text: "Một chiếc thì đi kiểu gì? Nhảy lò cò ra khỏi làng à?" }] }],
    },
    {
      on: "ba_tam",
      verb: "use",
      item: "dep_phai",
      effects: [{ say: [{ who: "ba_tam", text: "Một chiếc thì đi kiểu gì? Nhảy lò cò ra khỏi làng à?" }] }],
    },
    {
      on: "ba_tam",
      verb: "use",
      item: "xuong",
      effects: [{ say: [{ who: "ba_tam", text: "Bà không gặm xương, cháu ạ. Con Vàng thì có." }] }],
    },
    {
      on: "ba_tam",
      verb: "talk",
      when: { flags: ["got_pass"] },
      effects: [{ say: [{ who: "ba_tam", text: "Còn đứng đây làm gì? Cổng làng ở ngay kia kìa!" }] }],
    },
    {
      on: "ba_tam",
      verb: "talk",
      when: { flags: ["quest"] },
      effects: [{ say: [{ who: "ba_tam", text: "Dép đâu? Bà chưa thấy đủ hai chiếc. Con Vàng hay nằm khoèo trước sân nhà cháu lắm." }] }],
    },
    // --- Con Vàng ---
    { on: "vang", verb: "use", item: "xuong", effects: feedDog },
    {
      on: "vang",
      verb: "talk",
      when: { notFlags: ["dog_fed"] },
      effects: [
        { say: [{ who: "vang", text: "Gừ… (Dịch: Muốn lấy dép thì đưa đồ ăn đây.)" }] },
        { set: "saw_dog" },
      ],
    },
    {
      on: "vang",
      verb: "inspect",
      when: { notFlags: ["dog_fed"] },
      effects: [
        {
          say: [
            { who: "narrator", text: "Con Vàng ngủ say, gối đầu lên… chiếc dép phải của bạn." },
            { who: "narrator", text: "Bạn vừa thò tay ra, nó gầm gừ ngay. Chắc phải có gì đó để đổi." },
          ],
        },
        { set: "saw_dog" },
      ],
    },
    {
      on: "vang",
      verb: "skill",
      when: { notFlags: ["dog_fed"] },
      effects: [
        { say: [{ who: "vang", text: "Gâu… (Con Vàng mở một mắt, rồi ngủ tiếp. Nó chỉ mê đồ ăn thôi.)" }] },
        { set: "saw_dog" },
      ],
    },
    {
      on: "vang",
      verb: "talk",
      effects: [{ say: [{ who: "vang", text: "Gâu gâu! (Dịch: Xương ngon. Cảm ơn. Đừng làm phiền.)" }] }],
    },
    // --- Objects ---
    {
      on: "bu_nhin",
      verb: "inspect",
      when: { notFlags: ["got_left"] },
      effects: [
        { say: [{ who: "narrator", text: "Bù nhìn đang đi… một chiếc dép trái?! Thời trang thật." }] },
        { give: "dep_trai" },
        { set: "got_left" },
      ],
    },
    {
      on: "bu_nhin",
      verb: "inspect",
      effects: [{ say: [{ who: "narrator", text: "Bù nhìn nhìn bạn với ánh mắt của kẻ vừa mất dép." }] }],
    },
    {
      on: "quan",
      verb: "inspect",
      when: { lacks: ["xuong"], notFlags: ["dog_fed"] },
      effects: [
        {
          say: [
            { who: "narrator", text: "Quán nước vắng chủ. Trên thớt có một khúc xương to tướng." },
            { who: "hero", text: "Tôi lấy tạm, sẽ trả tiền sau! (Viết giấy nợ, dán lên cột.)" },
          ],
        },
        { give: "xuong" },
      ],
    },
    {
      on: "quan",
      verb: "inspect",
      effects: [{ say: [{ who: "narrator", text: "Quán vẫn vắng chủ. Tờ giấy nợ của bạn bay phấp phới trên cột." }] }],
    },
    {
      on: "lua",
      verb: "inspect",
      effects: [{ say: [{ who: "narrator", text: "Đống lửa ấm áp. Chẳng thấy con Vàng đâu — chắc nó đang nằm trước sân nhà bạn." }] }, { set: "saw_dog" }],
    },
    {
      on: "nha",
      verb: "inspect",
      effects: [{ say: [{ who: "hero", text: "Nhà mình. Mẹ dặn mua nước mắm rồi về… Công chúa thì chắc không đợi được." }] }],
    },
    {
      on: "vuon",
      verb: "inspect",
      effects: [{ say: [{ who: "narrator", text: "Vườn rau nhà ai đó. Một củ cà rốt nhìn bạn đầy nghi ngờ." }] }],
    },
    // --- Exit ---
    {
      on: "cong",
      verb: "inspect",
      when: { has: ["giay"] },
      effects: [
        { say: [{ who: "narrator", text: "Bạn giơ giấy thông hành. Then cổng kêu \"cạch\" một tiếng rồi mở toang!" }] },
        { take: "giay" },
        { set: "cleared" },
        { win: "Qua ải! Bạn đã bước ra khỏi nhà — và chính thức đi lạc khỏi việc mua nước mắm." },
      ],
    },
    {
      on: "cong",
      verb: "use",
      item: "giay",
      effects: [
        { say: [{ who: "narrator", text: "Bạn giơ giấy thông hành. Then cổng kêu \"cạch\" một tiếng rồi mở toang!" }] },
        { take: "giay" },
        { set: "cleared" },
        { win: "Qua ải! Bạn đã bước ra khỏi nhà — và chính thức đi lạc khỏi việc mua nước mắm." },
      ],
    },
    {
      on: "cong",
      verb: "inspect",
      effects: [{ say: [{ who: "narrator", text: "Cổng làng cài then chặt. Tấm biển ghi: \"Ra ngoài phải có giấy của Bà Tám\"." }] }],
    },
  ],
  objectives: [
    { when: { flags: ["cleared"] }, text: "Đã qua ải!" },
    { when: { has: ["giay"] }, text: "Mang giấy thông hành ra cổng làng." },
    { when: { has: ["dep_trai", "dep_phai"] }, text: "Mang đủ đôi dép về cho Bà Tám." },
    { when: { flags: ["quest"] }, text: "Tìm đôi dép bị con Vàng tha đi", count: { flags: ["got_left", "dog_fed"] } },
    { text: "Muốn ra khỏi làng, bạn phải giúp Bà Tám giải quyết rắc rối trước." },
  ],
  hints: [
    { when: { flags: ["cleared"] }, hints: ["Bạn đã qua ải. Tiếp tục hành trình thôi!"] },
    { when: { has: ["giay"] }, hints: ["Đi tới cổng làng \"Làng Ngáo\" và mở cổng."] },
    { when: { has: ["dep_trai", "dep_phai"] }, hints: ["Quay lại nói chuyện với Bà Tám."] },
    { when: { notFlags: ["quest"] }, hints: ["Bà Tám đứng trên con đường đất phía trên quảng trường. Bấm vào bà để nói chuyện."] },
    {
      when: { notFlags: ["got_left"], has: [] },
      hints: ["Có ai trong làng đang diện… dép không phải của mình?", "Quan sát con bù nhìn ngoài ruộng."],
    },
    { when: { has: ["xuong"] }, hints: ["Chọn Khúc xương trong túi đồ, rồi dùng lên con Vàng."] },
    {
      when: { flags: ["saw_dog"] },
      hints: ["Chó nào cũng mê xương. Quán trong làng có thể có.", "Quan sát quán nước mái đỏ cạnh đống lửa."],
    },
    { hints: ["Con Vàng thường nằm khoèo trước sân nhà bạn.", "Quan sát con chó vàng nằm trước sân nhà."] },
  ],
  notes: [
    { label: "Nói chuyện với Bà Tám", done: { flags: ["quest"] } },
    { label: "Tìm dép trái", done: { flags: ["got_left"] } },
    { label: "Lấy lại dép phải từ con Vàng", done: { flags: ["dog_fed"] } },
    { label: "Xin giấy thông hành", done: { flags: ["got_pass"] } },
    { label: "Ra khỏi cổng làng", done: { flags: ["cleared"] } },
  ],
  skill: {
    sword: "Bạn vung kiếm chém gió trước {target}. Gió không hề hấn gì.",
    professor: "Phân tích {target}: kết luận sơ bộ — nó có thật.",
    chairman: "Bạn đề nghị {target} hợp tác chiến lược. Không ai đáp lại.",
    angry: "Bạn đấm không khí cạnh {target}. Không khí sợ hãi.",
    comedian: "Bạn kể chuyện cười cho {target}. Chỉ mình bạn cười.",
  },
};
