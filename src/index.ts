import dotenv from "dotenv"
dotenv.config()
import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api"
import ensureUser from "./middleware/auth.middleware"
import app from "./app"
import { onHelp, onStart } from "./actions/command.action"
import {
  clearPendingUpdates,
  handleMainMenu,
  handleTransferSol,
  handleCreateToken,
} from "./actions/message.action"
import { subscriptionsCallback } from "./actions/callbacks/subscriptions.action"
import { accountsCallback } from "./actions/callbacks/account.action"
import {
  cancelTransferCallback,
  confirmTransferCallback,
} from "./actions/callbacks/transferSol.action"
import { createToken } from "./controllers/solana.controller"
import {
  cancelCreateTokenCallback,
  confirmCreateTokenCallback,
} from "./actions/callbacks/createToken.action"
const PORT = process.env.API_PORT || 8000

// Create a bot instance
const token: string = process.env.TELEGRAM_BOT_API_SECRET || ""
export const bot = new TelegramBot(token, { polling: true })

// Store states
interface UserState {
  state: string
  recipientAddress?: string
  amount?: number
  confirmationMessageId?: number
}
export interface TokenCreationState {
  stage: "name" | "symbol" | "decimals" | "supply" | "confirm"
  name?: string
  symbol?: string
  decimals?: number
  supply?: number
  confirmationMessageId?: number
}
export const userStates = new Map<number, UserState>()
export const tokenCreationStates = new Map<number, TokenCreationState>()

try {
  // Handle responses
  bot.on("message", async (msg: Message) => {
    await clearPendingUpdates(msg)
    await ensureUser(msg)
    const chatId = msg.chat.id
    const userState = userStates.get(chatId)
    const tokenCreationState = tokenCreationStates.get(chatId)

    bot.sendChatAction(chatId, "typing")
    if (userState) {
      try {
        await handleTransferSol(msg)
      } catch (error) {
        return console.log("Error Transfering SOL", chatId, error)
      }
    }

    if (tokenCreationState) {
      try {
        await handleCreateToken(msg)
      } catch (error) {
        return console.log("Error Creating Token", chatId, error)
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

    if (action === "confirm_create_token") {
      try {
        const tokenInfo = tokenCreationStates.get(chatId)
        if (tokenInfo) {
          await confirmCreateTokenCallback(callbackQuery)
        } else {
          bot.sendMessage(chatId, "No Token Info found")
        }
      } catch (error) {
        console.log("Error Creating Token", chatId, error)
      }
    } else if (action === "cancel_create_token") {
      try {
        await cancelCreateTokenCallback(callbackQuery)
      } catch (error) {
        return console.log("Error Cancelling Create Token", chatId, error)
      }
    }
    if (action === "account_create_token") {
      const cancelKeyboard = {
        inline_keyboard: [
          [
            {
              text: "❌ Cancel Transaction",
              callback_data: "cancel_create_token",
            },
          ],
        ],
      }
      tokenCreationStates.set(chatId, { stage: "name" })
      bot.answerCallbackQuery(callbackQuery.id)
      bot.sendMessage(
        chatId,
        "Let's create your token! First, what would you like to name your token?",
        { reply_markup: cancelKeyboard }
      )
    }
  })

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
    // const dice = await bot.sendDice(chatId)
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
