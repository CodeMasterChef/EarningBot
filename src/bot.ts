import TelegramBot from "node-telegram-bot-api";
import {
  loadState,
  saveState,
  markJoined,
  removeJoined,
  getJoinedList,
} from "./state";

let lastScanTime: Date | null = null;
let lastScanEventCount = 0;

export function setLastScanInfo(time: Date, count: number): void {
  lastScanTime = time;
  lastScanEventCount = count;
}

export function startBot(botToken: string): TelegramBot {
  const bot = new TelegramBot(botToken, { polling: true });

  bot.onText(/\/joined\s+(.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const name = match?.[1]?.trim().toUpperCase();

    if (!name) {
      bot.sendMessage(chatId, "⚠️ Vui lòng nhập tên dự án. VD: /joined TOKEN_ABC");
      return;
    }

    const state = loadState();
    markJoined(state, name);
    saveState(state);

    bot.sendMessage(chatId, `✅ Đã đánh dấu <b>${name}</b> là đã tham gia.`, {
      parse_mode: "HTML",
    });
  });

  bot.onText(/\/unjoin\s+(.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const name = match?.[1]?.trim().toUpperCase();

    if (!name) {
      bot.sendMessage(chatId, "⚠️ Vui lòng nhập tên dự án. VD: /unjoin TOKEN_ABC");
      return;
    }

    const state = loadState();
    const removed = removeJoined(state, name);
    saveState(state);

    if (removed) {
      bot.sendMessage(chatId, `🗑️ Đã xoá <b>${name}</b> khỏi danh sách đã tham gia.`, {
        parse_mode: "HTML",
      });
    } else {
      bot.sendMessage(chatId, `⚠️ <b>${name}</b> không có trong danh sách.`, {
        parse_mode: "HTML",
      });
    }
  });

  bot.onText(/\/list/, (msg) => {
    const chatId = msg.chat.id;
    const state = loadState();
    const joined = getJoinedList(state);

    if (joined.length === 0) {
      bot.sendMessage(chatId, "📋 Chưa có dự án nào được đánh dấu đã tham gia.");
      return;
    }

    const list = joined.map((name, i) => `${i + 1}. ${name}`).join("\n");
    bot.sendMessage(chatId, `📋 <b>Đã tham gia:</b>\n${list}`, {
      parse_mode: "HTML",
    });
  });

  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const state = loadState();
    const knownCount = Object.keys(state.known_events).length;
    const joinedCount = Object.keys(state.joined_events).length;

    const lastScan = lastScanTime
      ? lastScanTime.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      : "Chưa scan";

    const lines = [
      `📊 <b>Bot Status</b>`,
      ``,
      `🕐 Scan cuối: ${lastScan}`,
      `📡 Event ongoing (lần scan cuối): ${lastScanEventCount}`,
      `📝 Event đã thông báo: ${knownCount}`,
      `✅ Đã tham gia: ${joinedCount}`,
    ];

    bot.sendMessage(chatId, lines.join("\n"), { parse_mode: "HTML" });
  });

  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const lines = [
      `📖 <b>Hướng dẫn sử dụng</b>`,
      ``,
      `/joined &lt;tên&gt; — Đánh dấu đã tham gia dự án`,
      `/unjoin &lt;tên&gt; — Xoá khỏi danh sách đã tham gia`,
      `/list — Xem danh sách đã tham gia`,
      `/status — Xem trạng thái bot`,
      `/scan — Scan ngay lập tức`,
      `/help — Hiện hướng dẫn này`,
    ];
    bot.sendMessage(chatId, lines.join("\n"), { parse_mode: "HTML" });
  });

  // Handle inline button callbacks
  bot.on("callback_query", async (query) => {
    try {
      const data = query.data || "";

      if (data.startsWith("joined:")) {
        const eventKey = data.replace("joined:", "");
        const tokenName = eventKey.split("|")[0];

        const state = loadState();
        markJoined(state, tokenName);
        saveState(state);

        // Update message: show undo button
        if (query.message) {
          const originalText = query.message.text || "";
          await bot.editMessageText(
            `${originalText}\n\n✅ Đã đánh dấu tham gia ${tokenName}`,
            {
              chat_id: query.message.chat.id,
              message_id: query.message.message_id,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "↩️ Hoàn tác",
                      callback_data: `undo:${eventKey}`,
                    },
                  ],
                ],
              },
            }
          );
        }

        await bot.answerCallbackQuery(query.id, {
          text: `Đã đánh dấu ${tokenName} là đã tham gia!`,
        });
      } else if (data.startsWith("undo:")) {
        const eventKey = data.replace("undo:", "");
        const tokenName = eventKey.split("|")[0];

        const state = loadState();
        removeJoined(state, tokenName);
        saveState(state);

        // Restore original message with Joined button
        if (query.message) {
          // Remove the "✅ Đã đánh dấu..." line
          const text = query.message.text || "";
          const originalText = text.replace(/\n\n✅ Đã đánh dấu tham gia .+$/, "");
          await bot.editMessageText(originalText, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Đã tham gia",
                    callback_data: `joined:${eventKey}`,
                  },
                ],
              ],
            },
          });
        }

        await bot.answerCallbackQuery(query.id, {
          text: `Đã hoàn tác — ${tokenName} chưa tham gia.`,
        });
      }
    } catch (error) {
      console.error("[Bot] Callback query error:", error);
      try {
        await bot.answerCallbackQuery(query.id);
      } catch {
        // Query expired, ignore
      }
    }
  });

  console.log("[Bot] Telegram bot started, listening for commands...");
  return bot;
}
