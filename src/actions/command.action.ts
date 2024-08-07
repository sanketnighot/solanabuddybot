import { ReplyKeyboardMarkup, Message } from "node-telegram-bot-api"
import { bot } from "../index"
import ensureUser from "../middleware/auth.middleware"

export async function onStart(msg: Message) {
  try {
    await ensureUser(msg)
    const chatId = msg.chat.id
    const keyboard: ReplyKeyboardMarkup = {
      keyboard: [
        [{ text: "🏦 My Account" }, { text: "💳 View Subscriptions" }],
        [{ text: "⚙️ Manage Subscriptions" }, { text: "ℹ️ Help" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    }
    bot.sendMessage(
      chatId,
      "Welcome! I'm your Solana Buddy Telegram bot. How can I help you?",
      {
        reply_markup: keyboard,
      }
    )
  } catch (error) {
    console.log("onStartError: ", error)
    bot.sendMessage(msg.chat.id, "Something went wrong")
  }
}

export async function onHelp(msg: Message) {
  try {
    const chatId = msg.chat.id
    bot.sendMessage(
      chatId,
      "Here are the available commands:\n/start - Create/Connect to Solana Buddy Bot Account.\n/help - See available commands."
    )
  } catch (error) {
    console.log("onHelpError: ", error)
    bot.sendMessage(msg.chat.id, "Something went wrong")
  }
}
