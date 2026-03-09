import "dotenv/config";
import cron from "node-cron";
import { scrapeOngoingEvents } from "./scraper";
import { sendEventNotification } from "./notifier";
import { loadState, saveState, isKnown, isJoined, markKnown } from "./state";
import { startBot, setLastScanInfo } from "./bot";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const INTERVAL = parseInt(process.env.SCAN_INTERVAL_MINUTES || "60", 10);

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env");
  process.exit(1);
}

let isScanning = false;
let lastScanEventCount = 0;
const startTime = new Date();

// Start Telegram bot for commands
const bot = startBot(BOT_TOKEN);

async function scan(): Promise<void> {
  if (isScanning) {
    console.log("[Scan] Already running, skipping...");
    return;
  }

  isScanning = true;
  console.log(`[Scan] Starting at ${new Date().toISOString()}`);

  try {
    const events = await scrapeOngoingEvents();
    const state = loadState();

    lastScanEventCount = events.length;
    setLastScanInfo(new Date(), events.length);
    console.log(`[Scan] Found ${events.length} ongoing events`);

    let newCount = 0;

    for (const event of events) {
      const key = `${event.name.toUpperCase()}|${event.poolType}`;

      if (isJoined(state, event.name.toUpperCase())) {
        console.log(`[Scan] Skipping ${key} (already joined)`);
        continue;
      }

      if (isKnown(state, key)) {
        console.log(`[Scan] Skipping ${key} (already notified)`);
        continue;
      }

      const sent = await sendEventNotification(bot, CHAT_ID, event, key);

      if (sent) {
        markKnown(state, key);
        newCount++;
        console.log(`[Scan] Notified: ${key}`);
      } else {
        console.error(`[Scan] Failed to notify: ${key}`);
      }
    }

    saveState(state);
    console.log(
      `[Scan] Done. ${newCount} new events notified, ${events.length} total ongoing.`
    );
  } catch (error) {
    console.error("[Scan] Error:", error);
  } finally {
    isScanning = false;
  }
}

// /scan command
bot.onText(/\/scan/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "🔍 Đang scan PoolX...");
  await scan();
  await bot.sendMessage(chatId, "✅ Scan hoàn tất.");
});

// Schedule periodic scan
cron.schedule(`*/${INTERVAL} * * * *`, () => {
  console.log(`[Cron] Triggered scan (every ${INTERVAL} minutes)`);
  scan();
});

// Healthcheck every 60 minutes
cron.schedule("0 * * * *", async () => {
  const now = new Date();
  const uptimeMs = now.getTime() - startTime.getTime();
  const uptimeH = Math.floor(uptimeMs / 3600000);
  const uptimeM = Math.floor((uptimeMs % 3600000) / 60000);

  const state = loadState();
  const knownCount = Object.keys(state.known_events).length;
  const joinedCount = Object.keys(state.joined_events).length;

  const lines = [
    `💚 <b>Healthcheck OK</b>`,
    ``,
    `🕐 ${now.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`,
    `⏱️ Uptime: ${uptimeH}h ${uptimeM}m`,
    `📡 Event ongoing: ${lastScanEventCount}`,
    `📝 Đã thông báo: ${knownCount}`,
    `✅ Đã tham gia: ${joinedCount}`,
  ];

  try {
    await bot.sendMessage(CHAT_ID, lines.join("\n"), { parse_mode: "HTML" });
    console.log("[Healthcheck] Sent OK");
  } catch (error) {
    console.error("[Healthcheck] Failed:", error);
  }
});

console.log(`[App] Bot started. Scanning every ${INTERVAL} minutes.`);
console.log("[App] Running initial scan...");
scan();
