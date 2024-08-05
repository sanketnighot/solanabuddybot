import dotenv from "dotenv"
dotenv.config()
import TelegramBot from "node-telegram-bot-api"
import ensureUser from "./middleware/auth.middleware"

// replace 'YOUR_BOT_TOKEN' with the token you received from BotFather
const token: string = process.env.TELEGRAM_BOT_API_SECRET || ""

// Create a bot instance
const bot = new TelegramBot(token, { polling: true })

// Handle responses
bot.on("message", async (msg) => {
  await ensureUser(msg)
  const chatId = msg.chat.id

  switch (msg.text) {
    case "Option 1":
      bot.sendMessage(chatId, "You selected Option 1")
      break
    case "Option 2":
      bot.sendMessage(chatId, "You selected Option 2")
      break
    case "Option 3":
      bot.sendMessage(chatId, "You selected Option 3")
      break
    case "Option 4":
      bot.sendMessage(chatId, "You selected Option 4")
      break
    case "Back to Main Menu":
      bot.sendMessage(chatId, "Returning to main menu...")
      // Here you could call the function to show the main menu again
      break
  }
})

// Command handler for /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id
  bot.sendMessage(
    chatId,
    "Welcome! I'm your Solana Buddy Telegram bot. How can I help you?"
  )
})

// Command handler for /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id
  bot.sendMessage(
    chatId,
    "Here are the available commands:\n/start - Start the bot\n/menu - To get avaliable options\n/help - Show this help message"
  )
})

bot.onText(/\/menu/, async (msg) => {
  const chatId = msg.chat.id

  const keyboard = {
    keyboard: [
      ["Option 1", "Option 2"],
      ["Option 3", "Option 4"],
      ["Back to Main Menu"],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  }

  bot.sendMessage(chatId, "Please choose an option:", {
    // @ts-ignore
    reply_markup: keyboard,
  })
})

// Error handling
bot.on("polling_error", (error) => {
  console.error(error)
})

console.log("Bot is running...")
