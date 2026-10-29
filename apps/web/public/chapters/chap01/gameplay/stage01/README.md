# vKnight Stage 01 — Bước Ra Khỏi Nhà

Bộ 4 sprite PNG RGBA mới tạo dành cho Stage 01; **không phải artwork gốc được khôi phục từ Git**.

## Đặt đúng file theo backend

Chép 4 file sau vào `apps/web/public/chapters/chap01/gameplay/` (thư mục cha của `stage01/`):

- `npc-dog.png` → NPC_DOG_TEASER
- `dog-bone.png` → ITEM_DOG_BONE
- `sandal-left.png` → ITEM_LOST_SANDAL_LEFT
- `sandal-right.png` → ITEM_LOST_SANDAL_RIGHT

Chỉ như vậy mới khớp nguyên trạng các `image_url` backend đang trả. KHÔNG giải nén cả bộ vào `gameplay/stage01/` rồi cho rằng các URL cũ chạy được.

## Background (optional)

`stage01-background-optional.png` là một bản phong cảnh mới, tỷ lệ toàn cảnh và không phù hợp ngay với spawn/walk mask 500×500 hiện tại. **Đừng thay** `chap01-map01.jpg` tự động. Muốn dùng nền mới cần tinh chỉnh lại tọa độ spawn/walk và thiết kế gameplay, kiểm tra trực quan.

## Lưu ý

Sprite được tách bằng segmentation từ concept sheet, nên có thể có các vùng viền chưa hoàn hảo. Kiểm tra tương phản và render trong game trước khi đưa production.
