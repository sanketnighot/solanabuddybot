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
  handleTransferToken,
  handlePlayDiceGame,
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
import {
  cancelTransferTokenCallback,
  confirmTransferTokenCallback,
} from "./actions/callbacks/transferToken.action"
const PORT = process.env.API_PORT || 8000

// Create a bot instance
const token: string = process.env.TELEGRAM_BOT_API_SECRET || ""
export const bot = new TelegramBot(token, { polling: true })

// Store states
export interface UserState {
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

export interface TokenTransferState {
  stage: "mint" | "recipient" | "amount" | "confirm"
  mintAddress?: string
  recipientAddress?: string
  amount?: number
  confirmationMessageId?: number
}

interface DiceGameState {
  stage: "rules" | "bet" | "guess"
  bet?: number
  guess?: number
  confirmationMessageId?: number
}

export const userStates = new Map<number, UserState>()
export const tokenCreationStates = new Map<number, TokenCreationState>()
export const tokenTransferStates = new Map<number, TokenTransferState>()
export const diceGameStates = new Map<number, DiceGameState>()

try {
  // Handle responses
  bot.on("message", async (msg: Message) => {
    await clearPendingUpdates(msg)
    await ensureUser(msg)
    const chatId = msg.chat.id
    const userState = userStates.get(chatId)
    const tokenCreationState = tokenCreationStates.get(chatId)
    const tokenTransferState = tokenTransferStates.get(chatId)
    const diceGameState = diceGameStates.get(chatId)

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
    if (tokenTransferState) {
      try {
        await handleTransferToken(msg)
      } catch (error) {
        return console.log("Error Creating Token", chatId, error)
      }
    }
    if (diceGameState) {
      try {
        await handlePlayDiceGame(msg)
      } catch (error) {
        return console.log("Error Playing Dice Game", chatId, error)
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

    if (action === "confirm_transfer_token") {
      try {
        const tokenInfo = tokenTransferStates.get(chatId)
        if (tokenInfo) {
          await confirmTransferTokenCallback(callbackQuery)
        } else {
          bot.sendMessage(chatId, "No Token Info found")
        }
      } catch (error) {
        console.log("Error Creating Token", chatId, error)
      }
    } else if (action === "cancel_transfer_token") {
      try {
        await cancelTransferTokenCallback(callbackQuery)
      } catch (error) {
        return console.log("Error Cancelling Create Token", chatId, error)
      }
    }

    if (action === "play_dice_game") {
      diceGameStates.set(chatId, { stage: "rules" })
      const rulesKeyboard = {
        inline_keyboard: [
          [
            { text: "✅ Confirm", callback_data: "dice_game_confirm" },
            { text: "❌ Cancel", callback_data: "dice_game_cancel" },
          ],
        ],
      }
      bot.answerCallbackQuery(callbackQuery.id)
      bot.sendMessage(
        chatId,
        "🎲 Dice Game Rules:\n\n" +
          "1. You'll bet an amount of SOL.\n" +
          "2. Guess a number between 1 and 6.\n" +
          "3. If you guess correctly, you win 2x your bet!\n" +
          "4. If you guess wrong, you lose your bet.\n\n" +
          "Ready to play?",
        { reply_markup: rulesKeyboard }
      )
    } else if (action === "dice_game_confirm") {
      const state = diceGameStates.get(chatId)
      if (state) {
        state.stage = "bet"
        diceGameStates.set(chatId, state)
        bot.answerCallbackQuery(callbackQuery.id)
        bot.sendMessage(chatId, "How much SOL do you want to bet?", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "❌ Cancel", callback_data: "dice_game_cancel" }],
            ],
          },
        })
      }
    } else if (action === "dice_game_cancel") {
      diceGameStates.delete(chatId)
      bot.answerCallbackQuery(callbackQuery.id)
      bot.sendMessage(chatId, "Game cancelled. Come back anytime!")
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
