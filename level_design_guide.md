# 🎯 Level Design Template - Game Room Sticker

> Tài liệu này là **template hoàn chỉnh** để tạo 1 level mới cho game Room Sticker.
> Đã được kiểm nghiệm thực tế qua quá trình tạo Level Café và khắc phục các vấn đề phát sinh.

---

## 📋 Mục Lục

1. [Tổng Quan Workflow](#-tổng-quan-workflow)
2. [Bước 1: Tạo Room Full (Master Reference)](#-bước-1-tạo-room-full-master-reference)
3. [Bước 2: Tạo Room Bare (Game Background)](#-bước-2-tạo-room-bare-game-background)
4. [Bước 3: Kiểm Kê Sticker (Inventory Checklist)](#-bước-3-kiểm-kê-sticker-inventory-checklist)
5. [Bước 4: Quyết Định Granularity](#-bước-4-quyết-định-granularity)
6. [Bước 5: Generate Sticker](#-bước-5-generate-sticker---quy-tắc-vàng)
7. [Bước 6: Cấu Hình LEVEL_DATA](#-bước-6-cấu-hình-level_data)
8. [Bước 7: Kiểm Tra & Polish](#-bước-7-kiểm-tra--polish)
9. [Template Prompt](#-template-prompt)
10. [Checklist Hoàn Thành Level](#-checklist-hoàn-thành-level)
11. [Bài Học Kinh Nghiệm](#-bài-học-kinh-nghiệm-từ-level-café)

---

## 🔄 Tổng Quan Workflow

```
Bước 1: Tạo ảnh ROOM FULL (phòng hoàn chỉnh - master reference)
   ↓
Bước 2: Tạo ảnh ROOM BARE (phòng trống - game background)  
   ↓
Bước 3: SO SÁNH room_full vs room_bare → liệt kê MỌI vật thể cần làm sticker
   ↓
Bước 4: QUYẾT ĐỊNH granularity (gộp hay tách từng sticker)
   ↓
Bước 5: GENERATE từng sticker ★ LUÔN truyền room_full.png làm reference ★
   ↓
Bước 6: CẤU HÌNH LEVEL_DATA trong game.js (vị trí, kích thước, thứ tự)
   ↓
Bước 7: TEST trong game → điều chỉnh → hoàn thiện
```

> [!IMPORTANT]
> **Nguyên tắc cốt lõi:** Mọi asset đều phải **derive từ room_full.png**. Đây là source of truth duy nhất. Room bare và tất cả sticker đều phải nhất quán với ảnh này.

---

## 🖼️ Bước 1: Tạo Room Full (Master Reference)

Đây là bước **quan trọng nhất** - ảnh room full quyết định toàn bộ style, bảng màu, và nội dung của level.

### Yêu cầu kỹ thuật:
| Thuộc tính | Giá trị |
|-----------|---------|
| **Kích thước** | 1024×1024 hoặc 1080×1080 (vuông) |
| **Góc nhìn** | Isometric 2.5D (~30°) |
| **Phong cách** | Kawaii, thick black outlines, flat pastel colors |
| **Bố cục** | Hình hộp mở 2 mặt, thấy 2 tường + sàn |
| **Nền ngoài** | Trắng (clean white background) |

### Template prompt Room Full:
```
Isometric 2.5D miniature [THEME] interior, cute kawaii dollhouse style, 
thick black outlines, flat pastel colors. [MÔ TẢ TƯỜNG]. [MÔ TẢ SÀN].

The room contains ALL of these items fully rendered in color:
- [DANH SÁCH ĐẦY ĐỦ MỌI VẬT THỂ - càng chi tiết càng tốt]
- [Bao gồm cả chi tiết nhỏ: đèn, chậu cây, ly cốc, sách...]
- [Nhân vật mèo: mô tả pose, trang phục, vị trí cụ thể]

Clean white background outside the room boundary.
No text overlays. High detail miniature style.
Mobile game art, similar to "Cats & Soup" or "Neko Atsume" aesthetic.
```

> [!TIP]
> **Liệt kê thật chi tiết** tất cả vật thể trong prompt room full. Nếu bạn muốn có chậu cây, đèn treo, chồng đĩa... thì phải ghi ra hết. Vật gì không ghi thì AI sẽ không vẽ, và sau này sẽ không có sticker cho nó.

### Sau khi generate:
- [ ] Xác nhận style/bảng màu ưng ý
- [ ] Kiểm tra tất cả vật thể đã xuất hiện đầy đủ chưa
- [ ] Lưu thành `assets/room_full.png`
- [ ] **Nếu chưa đủ vật thể → generate lại, KHÔNG tiếp tục bước sau**

---

## 🏗️ Bước 2: Tạo Room Bare (Game Background)

Room bare = room full **TRỪ ĐI** tất cả vật thể sẽ thành sticker. Chỉ giữ lại cấu trúc cố định.

### Thông thường room bare CHỈ giữ lại:
- Tường (walls) - cấu trúc, gạch, sơn
- Sàn (floor) 
- Cửa sổ **khung** (không có rèm)
- Cửa ra vào (nếu có)
- Các cấu trúc kiến trúc cố định

### Template prompt Room Bare:
```
Isometric 2.5D miniature [THEME] interior, cute kawaii dollhouse style,
thick black outlines, flat pastel colors. [MÔ TẢ TƯỜNG GIỐNG ROOM FULL].
[MÔ TẢ SÀN GIỐNG ROOM FULL].

The room is COMPLETELY EMPTY and BARE. It contains ONLY:
- [CẤU TRÚC CỐ ĐỊNH 1 - ví dụ: bare brick walls]
- [CẤU TRÚC CỐ ĐỊNH 2 - ví dụ: wooden plank floor]  
- [CẤU TRÚC CỐ ĐỊNH 3 - ví dụ: window frame (no curtains)]

NO furniture, NO decorations, NO characters, NO plants, NO items on walls.
The room looks INCOMPLETE - clearly waiting to be filled.

Clean white background outside the room boundary.
Same room shape and perspective as reference.
Mobile game art style.
```

> [!IMPORTANT]
> **Nên truyền room_full.png làm reference** khi generate room bare, để đảm bảo cùng hình dáng phòng, góc nhìn, và bảng màu tường/sàn.

### Sau khi generate:
- [ ] Xác nhận cùng hình dáng phòng với room_full
- [ ] Xác nhận tường/sàn khớp màu
- [ ] Xác nhận KHÔNG có vật thể nào thừa
- [ ] Lưu thành `assets/room_bare.png`

---

## 📝 Bước 3: Kiểm Kê Sticker (Inventory Checklist)

> [!CAUTION]
> **Đây là bước hay bị bỏ sót.** Phải so sánh room_full vs room_bare **cực kỳ chi tiết**, liệt kê TẤT CẢ vật thể có trong full nhưng KHÔNG có trong bare. Kể cả chi tiết nhỏ nhất.

### Cách thực hiện:

1. **Mở room_full.png** và chia phòng thành các vùng:
   - Tường trái (từ trên xuống dưới)
   - Tường phải (từ trên xuống dưới)  
   - Trần nhà
   - Khu vực sàn phía sau
   - Khu vực sàn phía trước
   - Góc trái
   - Góc phải

2. **Quét từng vùng**, ghi lại MỌI vật thể:

### Template bảng kiểm kê:

```markdown
| # | Vùng | Vật thể | Kích cỡ | Mô tả chi tiết (màu, hình, vị trí) |
|---|------|---------|---------|-------------------------------------|
| 1 | Trần | Đèn treo #1 | Nhỏ | Bóng đèn vàng, treo dây đen, dome shade |
| 2 | Trần | Đèn treo #2 | Nhỏ | Tương tự #1, vị trí khác |
| 3 | Tường trái | Bảng menu | Vừa | Bảng phấn khung gỗ, chữ MENU trắng |
| ... | ... | ... | ... | ... |
```

### Checklist không được bỏ sót:

- [ ] **Trần nhà:** đèn, quạt, dây trang trí, mạng nhện...
- [ ] **Tường trái:** kệ, tranh, bảng, đồng hồ, cây treo...
- [ ] **Tường phải:** cửa sổ (rèm!), kệ, poster, đèn tường...
- [ ] **Góc tường:** kệ góc, cây lớn, loa...
- [ ] **Sàn phía sau:** quầy, tủ, kệ sách lớn...
- [ ] **Sàn phía trước:** bàn, ghế (ĐẾM TỪNG CÁI), thảm...
- [ ] **Trên mặt đồ:** đĩa trên kệ, cốc trên bàn, sách trên tủ...
- [ ] **Nhân vật:** mèo (đếm từng con, ghi pose cụ thể)
- [ ] **Chi tiết nhỏ:** chậu cây mini, chai lọ, nến, khung ảnh...

> [!WARNING]
> **Sai lầm thường gặp:** Bỏ sót các chi tiết nhỏ như chậu cây trên kệ, chồng đĩa, rèm cửa, đèn treo. Những thứ này tuy nhỏ nhưng khi thiếu sẽ khiến room ghép xong không giống room_full.

---

## 🔀 Bước 4: Quyết Định Granularity

Với mỗi vật thể trong danh sách kiểm kê, cần quyết định: **gộp hay tách thành sticker riêng?**

### Bảng quyết định:

| Tình huống | Quyết định | Lý do |
|-----------|-----------|-------|
| Bàn + ghế cùng bộ | **Tách riêng** mỗi cái 1 sticker | Linh hoạt hơn, user kéo từng cái |
| Mèo ngồi trên ghế | **Tách riêng** mèo và ghế | User đặt ghế trước rồi đặt mèo lên |
| 2 chậu cây giống hệt | **1 sticker, dùng 2 lần** | Tiết kiệm, nhưng cần code hỗ trợ |
| 2 chậu cây khác nhau | **2 sticker riêng** | Khác nhau thì phải riêng |
| Quầy bar lớn | **1 sticker** (gộp cả quầy) | Là 1 khối liền, không tách được |
| Đèn treo 2 cái giống | **1 sticker, dùng 2 lần** HOẶC **2 sticker** | Tùy game design |
| Nhân vật + đồ cầm tay | **Gộp** (mèo + cốc = 1 sticker) | Đồ cầm tay là phần của nhân vật |

### Template bảng quyết định:

```markdown
| # | Vật thể | Quyết định | Tên file sticker | Ghi chú |
|---|---------|-----------|-----------------|---------|
| 1 | Quầy bar | 1 sticker riêng | sticker_counter.png | Nội thất lớn |
| 2 | Bàn tròn (×2) | 1 sticker, dùng 2 lần | sticker_round_table.png | Giống nhau |
| 3 | Ghế xanh | 1 sticker riêng | sticker_chair_green.png | Màu khác |
| 4 | Ghế tím | 1 sticker riêng | sticker_chair_purple.png | Màu khác |
| 5 | Ghế hồng (×2) | 1 sticker, dùng 2 lần | sticker_chair_pink.png | Giống nhau |
| 6 | Mèo barista | 1 sticker riêng | sticker_barista.png | Không kèm quầy |
| 7 | Mèo đọc sách | 1 sticker riêng | sticker_cat_reading.png | Không kèm ghế |
| ... | ... | ... | ... | ... |
```

### Kết quả cuối bước này:
- **Danh sách file sticker** cần generate (có tên file cụ thể)
- **Tổng số sticker** (kể cả các sticker dùng lại nhiều lần)
- **Tổng số vị trí đặt** trên room

---

## ⭐ Bước 5: Generate Sprite Sheet - QUY TẮC VÀNG

> [!CAUTION]
> ### 🚨 LƯU Ý QUAN TRỌNG VỀ AI IMAGE GENERATION
> 
> Thay vì generate từng sticker rời rạc (rất tốn thời gian và dễ lệch style), chúng ta sẽ generate một **SPRITE SHEET** duy nhất (hoặc 2-3 tấm nếu quá nhiều đồ) chứa tất cả các vật phẩm.
> 
> **2 Lỗi Thường Gặp Cần Tránh Tuyệt Đối:**
> 1. **Bỏ sót chi tiết (Scan thiếu):** Đừng chỉ dựa vào prompt ban đầu, AI thường tự vẽ thêm các chi tiết nhỏ (tranh ảnh, đồng hồ, chậu cây mini, gối, mèo thứ 2...). **BẮT BUỘC phải mở ảnh Room Full lên và soi thật kỹ từng ngóc ngách** trước khi viết prompt tạo Sprite Sheet.
> 2. **Vật thể dính vào nhau:** Tránh việc AI vẽ "Mèo nằm trên thảm" hay "Sách để trên kệ" trong Sprite Sheet. Các vật phẩm phải hoàn toàn TÁCH RỜI nhau trên nền trắng.

### Prompt pattern tạo Sprite Sheet (FINAL - v5):

> [!IMPORTANT]
> **LUÔN truyền `room_full.png` làm reference** — dùng câu mở đầu đặc biệt
> để AI vẽ vật thể mới với style khớp, KHÔNG reproduce cả scene.

#### Template prompt:
```text
[Kèm room_full.png làm ImagePaths — BẮT BUỘC]

I am showing you a room image for STYLE REFERENCE ONLY. 
I need a brand new standalone drawing: A SPRITE SHEET of furniture and items.

Draw a clean, organized 2D sprite sheet grid containing these individual items spaced out evenly on a PURE WHITE background:
- [Item 1: ví dụ - A large comfy bed...]
- [Item 2: ví dụ - A wooden wardrobe...]
- [Item 3: ví dụ - A white cat sleeping (MUST BE SEPARATE, NOT ON BED)]
- [Item 4: ví dụ - A fluffy white rug (MUST BE EMPTY)]

ABSOLUTELY CRITICAL - READ CAREFULLY:
1. The items MUST NOT overlap or touch each other. 
2. DO NOT combine items. The cat must not be on the rug. The books must not be on the shelf. Everything must be separated by white space.
3. Pure white empty background ONLY - no floor, no walls, no room.
4. Draw ONLY the requested items in a neat grid layout.

Style: same as reference - kawaii, thick black outlines, flat muted colors, isometric 2.5D view.
```

### Các prompt đã test và kết quả (Level 2 Alchemy Lab):

| # | Cách tiếp cận | Kết quả | Vấn đề |
|---|--------------|---------|--------|
| 1 | `Extract and recreate ONLY [item] from this reference` | ❌ AI vẽ cả room | "Extract from reference" = giữ reference |
| 2 | `Using reference ONLY for style matching` + `DO NOT draw room` | ⚠️ Đồ nhỏ OK, đồ lớn vẫn kèm room | Đồ lớn quá dominant trong reference |
| 3 | Không reference + mô tả style bằng text | ❌ Isolated tốt nhưng style lệch | Thiếu reference → khác tone, góc, chi tiết |
| 4 | `ONLY that bookshelf` + `CRITICAL RULES` | ❌ Bỏ tường nhưng giữ mọi đồ khác | AI bỏ tường nhưng giữ nội thất |
| **5** | **`STYLE REFERENCE ONLY` + `brand new standalone drawing`** | **✅ Isolated + style gần giống** | **Tốt nhất hiện tại** |
| 6 | `Isolate and reproduce EXACTLY` | ❌ AI reproduce cả room | "Reproduce from image" = copy toàn bộ |
| 7 | `Edit: REMOVE everything EXCEPT X` (inpainting) | ⚠️ Bỏ tường/sàn, giữ nội thất | AI edit không triệt để |
| 8 | `Edit: keep ONLY X` + liệt kê chi tiết cần xóa | ❌ Vẫn giữ gần hết | AI không thể xóa selective |

### Ví dụ prompt:

✅ **ĐÚNG** (prompt tốt nhất tìm được):
```
[Kèm room_full.png làm reference image]

I am showing you a room image for STYLE REFERENCE ONLY. 
I need a brand new standalone drawing.

Draw a single piece of furniture: a tall wooden bookshelf, matching 
the one visible in the center-back of the reference. It has:
- Dark brown wood, simple construction
- 4 shelf tiers with a rounded arch at the top
- Contents: green/blue books, potion jars, scrolls, a golden balance 
  scale on top shelf
- Small green door/panel at the bottom

ABSOLUTELY CRITICAL - READ CAREFULLY:
1. Draw ONLY this ONE bookshelf. Nothing else in the entire image.
2. White empty background - no floor, no walls, no room.
3. No other furniture, no characters, no potions outside the shelf.
4. The bookshelf should be centered in the image, floating on white.

Style: same as reference - kawaii, thick black outlines, flat muted 
colors, isometric 2.5D view.
```

> [!TIP]
> **Mẹo viết prompt tốt:**
> - Mô tả vật thể **càng chi tiết càng tốt** (màu chính xác, số tầng, nội dung bên trong)
> - Ghi rõ **vị trí trong room** để AI biết nhìn vào đâu
> - Dùng **"ABSOLUTELY CRITICAL"** block với 4 rules rõ ràng
> - **Liệt kê cụ thể** những gì KHÔNG được vẽ (no other furniture, no characters...)

### Quy trình generate:

```
Với MỖI sticker trong danh sách:
  1. Quan sát vật thể trong room_full.png → ghi chú CHI TIẾT:
     - Màu sắc chính xác (nâu tối, xanh ngọc, tím...)
     - Hình dáng, kích thước, chi tiết đặc trưng
     - Vị trí trong room (center-back, left wall, floor-right...)
  2. Viết prompt theo template ở trên
  3. Gọi generate_image với:
     - ImagePaths: ["assets/room_full.png"]  ← LUÔN LUÔN
     - Prompt: prompt đã viết ở bước 2
  4. ⚠️ REVIEW KẾT QUẢ TRƯỚC KHI DÙNG:
     - Sticker có bị vẽ cả room không? → re-generate
     - Sticker có isolated trên nền trắng không?
     - Sticker có giống vật thể trong room_full không? (cho phép ~85-90% khớp)
  5. Nếu không đạt → re-generate với mô tả chi tiết hơn
  6. Copy file vào assets/ với tên đã định
```

### Thứ tự generate đề xuất:

1. **Nội thất lớn trước** (counter, tủ, kệ) → dễ kiểm tra tỉ lệ
2. **Đồ trung bình** (bàn, ghế, đèn) 
3. **Nhân vật** (mèo các pose)
4. **Chi tiết nhỏ** (chậu cây, chai lọ, đĩa)

> [!TIP]
> Nếu bị giới hạn quota generate image, hãy ưu tiên generate nội thất lớn trước vì chúng dễ thấy lỗi nhất quán nhất. Chi tiết nhỏ có thể chấp nhận sai lệch nhẹ.

---

## ⚙️ Bước 6: Cấu Hình LEVEL_DATA

Sau khi có đủ sticker, cần cấu hình vị trí đặt trong game.

### Cấu trúc LEVEL_DATA:

```javascript
const LEVEL_DATA = {
    name: '[Tên Level]',
    roomEmpty: 'assets/room_bare.png',
    roomFull: 'assets/room_full.png',
    stickers: [
        // Sắp xếp theo LAYER (từ sau ra trước, từ dưới lên trên)
        
        // Layer 1: Tường (items gắn tường - render trước)
        {
            id: 'menu',              // ID duy nhất
            name: 'Menu Board',       // Tên hiển thị
            src: 'assets/sticker_menu.png',  // Đường dẫn file
            target: { x: 16, y: 10, w: 15, h: 18 }, // Vị trí % trên room
            trayOrder: 0,             // Thứ tự trong tray (0 = đầu tiên)
        },
        
        // Layer 2: Nội thất lớn (sàn phía sau)
        {
            id: 'counter',
            name: 'Coffee Counter',
            src: 'assets/sticker_counter.png',
            target: { x: 36, y: 25, w: 38, h: 22 },
            trayOrder: 1,
        },
        
        // Layer 3: Đồ trên nội thất (espresso trên counter)
        // ...
        
        // Layer 4: Nội thất sàn phía trước (bàn, ghế)
        // ...
        
        // Layer 5: Nhân vật (render cuối cùng, trên hết)
        // ...
    ],
};
```

### Cách xác định tọa độ `target`:

1. **Chạy game** với debug mode (đã có sẵn - double-click trên room)
2. **Double-click** vào vị trí muốn đặt sticker → console log ra `{ x, y }` (%)
3. **Điều chỉnh** `w` và `h` sao cho drop zone vừa bao sticker
4. **Test kéo thả** → fine-tune vị trí

### Quy tắc sắp xếp layer:

```
Render trước (phía sau)          Render sau (phía trước)
─────────────────────────────────────────────────────────►

Tường/trần → Nội thất sau → Đồ trên NT → Nội thất trước → Nhân vật
(menu,       (counter,      (espresso,    (bàn, ghế)       (mèo
 đèn treo,    kệ sách,       pastry,                        các pose)
 rèm cửa)     ghế bành)      chồng đĩa)
```

> [!WARNING]
> **Layer order rất quan trọng!** Sticker render trước sẽ bị sticker render sau che phủ. Ví dụ: counter phải render trước barista (vì barista đứng trước counter).

---

## ✅ Bước 7: Kiểm Tra & Polish

### Checklist kiểm tra:

#### Về hình ảnh:
- [ ] Mỗi sticker có style khớp với room_full (góc, outline, màu)
- [ ] Tỉ lệ kích thước hợp lý khi đặt vào room
- [ ] Background sticker đã transparent (hoặc game tự xóa trắng)
- [ ] Room bare + tất cả sticker = gần giống room full

#### Về gameplay:
- [ ] Drop zone đúng vị trí cho mỗi sticker
- [ ] Snap distance đủ rộng (user không cần đặt pixel-perfect)
- [ ] Layer order đúng (không bị che sai)
- [ ] Tray hiển thị đủ sticker, scroll được
- [ ] Counter X/Y đúng số

#### Về completion:
- [ ] Khi đặt hết sticker → hiện room_full crossfade
- [ ] Confetti + completion overlay hoạt động
- [ ] Nút replay reset game đúng

---

## 📝 Template Prompt

### A. Prompt tạo Room Full (thay `[...]`):

```
Isometric 2.5D miniature cozy [THEME] interior, cute kawaii dollhouse 
style, thick black outlines, flat pastel colors. [WALL_DESCRIPTION], 
[FLOOR_DESCRIPTION]. 

The room contains ALL of these items fully rendered in color:
[ITEM_LIST - liệt kê từng dòng, càng chi tiết càng tốt]

[CAT_CHARACTERS - mô tả số lượng, pose, trang phục]

Clean white background outside the room boundary. 
No text overlays. High detail miniature style. 
Mobile game art, similar to "Cats & Soup" or "Neko Atsume" aesthetic.
```

### B. Prompt tạo Room Bare (kèm room_full.png reference):

```
[Reference: room_full.png]

Recreate this SAME room but COMPLETELY EMPTY. Keep the EXACT same:
- Room shape and isometric angle
- Wall material, color, and texture  
- Floor material, color, and pattern
- Window frame position (but NO curtains)

Remove ALL: furniture, decorations, characters, plants, items.
The room should look bare and waiting to be filled.

Clean white background outside the room boundary.
Mobile game art style.
```

### C. Prompt tạo Sticker (kèm room_full.png reference):

```
[Reference: room_full.png]

Extract and recreate ONLY the [ITEM_NAME] from this reference room 
image as a standalone sticker.

In the reference, [EXACT_DESCRIPTION: vị trí, màu sắc, hình dáng, 
chi tiết cụ thể của vật thể trong ảnh].

Match the EXACT same isometric 2.5D angle, thick black outline style, 
flat pastel color palette, and proportions as the reference.

Clean white/transparent background. 
Just the [ITEM_NAME] alone, no other items, no other characters.
Mobile game sticker asset.
```

---

## 📋 Checklist Hoàn Thành Level

```markdown
### Level: [TÊN LEVEL]

#### Phase 1: Asset Generation
- [ ] Room Full generated và approved
- [ ] Room Bare generated (reference room_full) và approved
- [ ] Inventory checklist hoàn thành (mọi vật thể được liệt kê)
- [ ] Granularity decisions hoàn thành
- [ ] Tất cả sticker generated (reference room_full) và approved

#### Phase 2: Game Integration  
- [ ] Tất cả file sticker đã copy vào assets/
- [ ] LEVEL_DATA đã cấu hình trong game.js
- [ ] Tọa độ target đã calibrate (debug mode)
- [ ] Layer order đúng

#### Phase 3: Testing
- [ ] Mỗi sticker kéo thả thành công vào đúng vị trí
- [ ] Completion crossfade hiển thị đúng
- [ ] Reset game hoạt động
- [ ] Hint mode hiển thị silhouette đúng vị trí
- [ ] Mobile touch test (nếu có)

#### Asset Files:
- [ ] assets/room_full.png
- [ ] assets/room_bare.png  
- [ ] assets/sticker_[name1].png
- [ ] assets/sticker_[name2].png
- [ ] ...
```

---

## 📚 Bài Học Kinh Nghiệm (Từ Level Café)

Các vấn đề đã gặp và cách khắc phục:

### 1. ❌ Sticker không khớp style với room

**Vấn đề:** Generate sticker riêng lẻ mà không cung cấp room_full.png làm reference → sticker có góc nhìn, bảng màu, line weight khác biệt so với room.

**Giải pháp:** 
> **LUÔN truyền `room_full.png` làm reference image** khi generate BẤT KỲ sticker nào. Dùng prompt "Extract and recreate ONLY [item] from this reference room image" thay vì mô tả từ đầu.

---

### 2. ❌ Bỏ sót vật thể nhỏ

**Vấn đề:** Lần đầu liệt kê sticker chỉ có 7-8 items lớn, bỏ sót nhiều chi tiết nhỏ (chậu cây, đèn treo, rèm cửa, chồng đĩa, kệ tường).

**Giải pháp:**
> Sử dụng **phương pháp quét vùng** - chia room thành 7+ vùng và quét từng vùng chi tiết. Dùng checklist ở Bước 3 để không bỏ sót.

---

### 3. ❌ Không rõ gộp hay tách sticker

**Vấn đề:** Bàn + ghế nên gộp hay tách? Mèo ngồi trên ghế nên gộp hay tách? Phải hỏi lại user nhiều lần.

**Giải pháp:**
> Tạo **bảng quyết định granularity** (Bước 4) TRƯỚC khi generate. Hỏi user MỘT LẦN cho tất cả vật thể.

---

### 4. ❌ Hết quota giữa chừng

**Vấn đề:** Generate quá nhiều ảnh trong 1 session → hết quota, phải chờ reset.

**Giải pháp:**
> - Ưu tiên generate **nội thất lớn trước** (dễ thấy lỗi)
> - **Batch generate** 3-4 cái cùng lúc (parallel calls)
> - Nếu biết sẽ generate nhiều, **lên danh sách đầy đủ trước** và generate theo thứ tự ưu tiên

---

### 5. ❌ Room bare không khớp room full

**Vấn đề:** Generate room bare riêng biệt → hình dáng phòng, màu tường, góc nhìn hơi khác room full.

**Giải pháp:**
> Khi generate room bare, **truyền room_full.png làm reference** và dùng prompt "Recreate this SAME room but COMPLETELY EMPTY".

---

### 6. ❌ AI vẽ cả room thay vì sticker riêng lẻ

**Vấn đề:** Khi truyền `room_full.png` làm reference image và dùng prompt "Extract and recreate ONLY [item] from this reference", AI thường **vẽ lại toàn bộ phòng** thay vì tách riêng vật thể. Hoặc AI **phóng to vật thể chồng lên room** (như pha lê chiếm hết ảnh với room mờ phía sau). Đặc biệt xảy ra với vật thể lớn/nổi bật.

**Thử nghiệm thất bại:** Bỏ reference image để tránh AI vẽ cả room → sticker isolated tốt nhưng **style lệch** so với room_full (khác tone màu, khác mức chi tiết, khác góc).

**Giải pháp đúng:**
> **LUÔN truyền reference** nhưng dùng **câu mở đầu đặc biệt:**
> `"I am showing you a room image for STYLE REFERENCE ONLY. I need a brand new standalone drawing."`
>
> Kết hợp với:
> - Mô tả CHI TIẾT vật thể (ghi rõ vị trí trong room để AI biết nhìn đâu)
> - Block "ABSOLUTELY CRITICAL": chỉ vẽ 1 vật, nền trắng, không room
> - "Style: same as reference"
>
> **Từ khóa TRÁNH dùng:** "Extract from this reference" → AI hiểu là giữ reference + highlight
> **Từ khóa NÊN dùng:** "STYLE REFERENCE ONLY", "brand new standalone drawing", "ABSOLUTELY CRITICAL", "floating on white"

---

### Tổng kết: 4 quy tắc vàng

| # | Quy tắc | Lý do |
|---|---------|-------|
| 1 | **Luôn reference room_full.png** | Đảm bảo nhất quán style/góc/màu |
| 2 | **Dùng câu mở đầu "STYLE REFERENCE ONLY"** | Tránh AI vẽ cả room thay vì isolate sticker |
| 3 | **Kiểm kê chi tiết trước khi generate** | Không bỏ sót sticker nào |
| 4 | **Quyết định granularity sớm** | Tránh phải hỏi lại / generate lại |
