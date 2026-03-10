import TelegramBot from "node-telegram-bot-api";
import { PoolXEvent } from "./types";

export function formatEventMessage(event: PoolXEvent): string {
  const lines = [
    `🔔 <b>PoolX Mới: ${event.name}</b>`,
    ``,
    `📌 Pool: ${event.poolType}`,
    `💰 Reward: ${event.totalReward}`,
    `⏰ Thời gian: ${event.startTime} → ${event.endTime}`,
    `🔗 <a href="${event.url}">Xem chi tiết</a>`,
  ];
  return lines.join("\n");
}

export async function sendEventNotification(
  bot: TelegramBot,
  chatId: string,
  event: PoolXEvent,
  eventKey: string
): Promise<boolean> {
  try {
    await bot.sendMessage(chatId, formatEventMessage(event), {
      parse_mode: "HTML",
      disable_web_page_preview: true,
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
    return true;
  } catch (error) {
    console.error("[Telegram] Send failed:", error);
    return false;
  }
}

export async function sendEventCard(
  bot: TelegramBot,
  chatId: string | number,
  event: PoolXEvent,
  eventKey: string,
  joined: boolean
): Promise<void> {
  const button = joined
    ? { text: "↩️ Hoàn tác", callback_data: `undo:${eventKey}` }
    : { text: "✅ Đã tham gia", callback_data: `joined:${eventKey}` };

  await bot.sendMessage(chatId, formatEventMessage(event), {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[button]],
    },
  });
}
