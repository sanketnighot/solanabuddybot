import dotenv from "dotenv"
dotenv.config()
import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api"
import ensureUser from "./middleware/auth.middleware"
import {
  getUserSubscriptions,
  getUserPublicKey,
  getSubscriptionsWithUserStatus,
} from "./controllers/accounts.controller"
import { getBalance } from "./controllers/solana.controller"
import app from "./app"
import { onHelp, onStart } from "./actions/command.action"
import {
  clearPendingUpdates,
  handleMainMenu,
  handleTransferSol,
} from "./actions/message.action"
import { subscriptionsCallback } from "./actions/callbacks/subscriptions.action"
import { accountsCallback } from "./actions/callbacks/account.action"
import {
  cancelTransferCallback,
  confirmTransferCallback,
} from "./actions/callbacks/transfers.action"
const PORT = process.env.API_PORT || 8000

const token: string = process.env.TELEGRAM_BOT_API_SECRET || ""

// Create a bot instance
export const bot = new TelegramBot(token, { polling: true })

// Store user states
export const userStates = new Map()

try {
  // Command handler for /start
  bot.onText(/\/start/, async (msg: Message) => {
    try {
      await onStart(msg)
    } catch (error) {
      return console.log("Error Starting Bot", msg.chat.id, error)
    }
  })

  // Command handler for /help
  bot.onText(/\/help/, async (msg: Message) => {
    try {
      await onHelp(msg)
    } catch (error) {
      return console.log("Error Starting Bot", msg.chat.id, error)
    }
  })

  bot.onText(/\/test/, async (msg) => {
    const chatId = msg.chat.id
  })

  // Handle responses
  bot.on("message", async (msg: Message) => {
    await clearPendingUpdates(msg)
    await ensureUser(msg)
    const chatId = msg.chat.id
    const userState = userStates.get(chatId)
    if (userState) {
      try {
        await handleTransferSol(msg)
      } catch (error) {
        return console.log("Error Transfering SOL", chatId, error)
      }
    }

    await handleMainMenu(msg)
  })

  // Handle button clicks
  bot.on("callback_query", async (callbackQuery: CallbackQuery) => {
    const action = callbackQuery.data
    const msg = callbackQuery.message
    const chatId = msg!.chat.id

    if (action?.startsWith("subscription_")) {
      try {
        await subscriptionsCallback(callbackQuery)
      } catch (error) {
        return console.log("Error managing Subscription", chatId, error)
      }
    }

    if (action?.startsWith("account_")) {
      try {
        await accountsCallback(callbackQuery)
      } catch (error) {
        return console.log("Error managing Account", chatId, error)
      }
    }

    if (action === "confirm_transfer") {
      try {
        await confirmTransferCallback(callbackQuery)
      } catch (error) {
        return console.log("Error Confirming Transaction", chatId, error)
      }
    } else if (action === "cancel_transfer") {
      try {
        await cancelTransferCallback(callbackQuery)
      } catch (error) {
        return console.log("Error Cancelling Transaction", chatId, error)
      }
    }
  })

  // Error handling
  bot.on("polling_error", (error) => {
    console.error("Polling Error", error)
  })

  console.log("\nBot is running...")

  app.listen(PORT, () => {
    console.log(`Solana Buddy Bot Server is running on port ${PORT}`)
  })
} catch (error) {
  console.log("Error Occured: ", error)
}
