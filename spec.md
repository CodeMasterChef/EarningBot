# Bitget PoolX Monitor Bot

## Mục tiêu

Bot tự động theo dõi các sự kiện **Ongoing** trên [Bitget PoolX](https://www.bitget.com/events/poolx) và gửi thông báo qua Telegram khi phát hiện sự kiện mới. Tránh thông báo lặp các dự án mà user đã tham gia.

---

## Luồng hoạt động chính

```
[Cron Job / Scheduler]
        │
        ▼
[Scrape Bitget PoolX - tab Ongoing]
        │
        ▼
[So sánh với danh sách đã biết]
        │
        ├── Sự kiện MỚI → Gửi Telegram + Lưu vào DB
        │
        └── Sự kiện ĐÃ BIẾT → Bỏ qua
```

---

## Chức năng

### 1. Scraper - Lấy dữ liệu PoolX

- Truy cập `https://www.bitget.com/events/poolx`
- Lấy danh sách các sự kiện trong tab **Ongoing**
- Mỗi sự kiện cần lấy:
  - `name` — Tên token / dự án
  - `pool_type` — Loại pool (Stake BGB, Stake USDT, ...)
  - `total_reward` — Tổng phần thưởng
  - `start_time` / `end_time` — Thời gian diễn ra
  - `url` — Link trực tiếp đến sự kiện (nếu có)

**Lưu ý:** Trang có thể render bằng JS (SPA), cần dùng headless browser (Puppeteer/Playwright) hoặc tìm API endpoint ẩn để lấy data.

### 2. Telegram Notifier

- Gửi tin nhắn qua Telegram Bot API khi phát hiện sự kiện Ongoing mới
- Format tin nhắn:

```
🔔 PoolX Mới: <tên dự án>

📌 Pool: <loại pool>
💰 Reward: <tổng thưởng>
⏰ Thời gian: <start> → <end>
🔗 <link>
```

- Config:
  - `TELEGRAM_BOT_TOKEN` — Token của bot
  - `TELEGRAM_CHAT_ID` — Chat ID để gửi tin

### 3. State Management - Quản lý trạng thái

- Lưu trữ bằng file JSON đơn giản (`data/state.json`)
- Cấu trúc:

```json
{
  "known_events": {
    "TOKEN_ABC": {
      "name": "TOKEN_ABC",
      "first_seen": "2026-03-09T10:00:00Z",
      "status": "notified"
    }
  },
  "joined_events": {
    "TOKEN_XYZ": {
      "name": "TOKEN_XYZ",
      "joined_at": "2026-03-08T15:00:00Z"
    }
  }
}
```

- **known_events**: Các sự kiện đã thông báo → tránh gửi lại
- **joined_events**: Các dự án user đã tham gia → tránh nhắc lại hoàn toàn

### 4. Đánh dấu "Đã tham gia"

- User gửi lệnh qua Telegram: `/joined TOKEN_XYZ`
- Bot lưu vào `joined_events` trong state
- Các lần scan sau sẽ bỏ qua sự kiện này
- Hỗ trợ thêm: `/list` — Xem danh sách đã tham gia

---

## Cấu trúc thư mục

```
EarningBot/
├── spec.md
├── .env                  # TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
├── package.json
├── src/
│   ├── index.ts          # Entry point + scheduler
│   ├── scraper.ts        # Scrape Bitget PoolX
│   ├── notifier.ts       # Gửi Telegram
│   ├── state.ts          # Đọc/ghi state.json
│   └── bot.ts            # Telegram bot commands (/joined, /list)
├── data/
│   └── state.json        # Trạng thái persistent
└── tsconfig.json
```

---

## Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Runtime | Node.js + TypeScript |
| Scraping | Playwright (headless Chromium) hoặc gọi API trực tiếp nếu tìm được |
| Telegram | `node-telegram-bot-api` |
| Scheduler | `node-cron` |
| Storage | File JSON (`data/state.json`) |

---

## Cấu hình

File `.env`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
SCAN_INTERVAL_MINUTES=60
```

---

## Logic chi tiết

```
Mỗi SCAN_INTERVAL_MINUTES phút:
  1. Scrape trang PoolX → lấy danh sách ongoing_events
  2. Với mỗi event trong ongoing_events:
     a. Nếu event.name ∈ joined_events → bỏ qua
     b. Nếu event.name ∈ known_events → bỏ qua
     c. Nếu event mới:
        - Gửi Telegram notification
        - Thêm vào known_events với status "notified"
  3. Dọn dẹp known_events: xoá các event đã hết hạn (end_time < now)
```

---

## Telegram Bot Commands

| Lệnh | Mô tả |
|---|---|
| `/joined <tên>` | Đánh dấu đã tham gia dự án, bot sẽ không nhắc lại |
| `/list` | Xem danh sách các dự án đã tham gia |
| `/status` | Xem trạng thái bot (lần scan cuối, số event đang theo dõi) |

---

## Rủi ro & Lưu ý

- **Anti-bot**: Bitget có thể block scraper → cần rotate User-Agent, thêm delay, hoặc ưu tiên tìm API endpoint
- **SPA rendering**: Nếu dùng Playwright thì tốn RAM → cân nhắc chạy trên máy có đủ tài nguyên
- **Rate limit Telegram**: Không gửi quá 30 msg/giây (thường không vấn đề với use case này)
