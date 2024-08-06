import dotenv from "dotenv"
dotenv.config()
import TelegramBot, { ReplyKeyboardMarkup } from "node-telegram-bot-api"
import ensureUser from "./middleware/auth.middleware"
import {
  getUserSubscriptions,
  getUserPublicKey,
  getSubscriptionsWithUserStatus,
  getAccountInfo,
  addSubscriptionForUser,
  removeSubscriptionForUser,
  getAirDrop,
} from "./controllers/accounts.controller"
import { userType } from "./types/types"
import { getBalance } from "./controllers/airdrop.controller"
import app from "./app"
const PORT = process.env.API_PORT || 8000

const token: string = process.env.TELEGRAM_BOT_API_SECRET || ""

// Create a bot instance
export const bot = new TelegramBot(token, { polling: true })

try {
  // Command handler for /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id
    const keyboard: ReplyKeyboardMarkup = {
      keyboard: [
        [{ text: "🏦 My Account" }, { text: "💳 View Subscriptions" }],
        [{ text: "⚙️ Manage Subscriptions" }],
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
  })

  // Command handler for /help
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(
      chatId,
      "Here are the available commands:\n/start - Create/Connect to Solana Buddy Bot Account.\n/help - See available commands."
    )
  })

  // Handle responses
  bot.on("message", async (msg) => {
    await ensureUser(msg)
    const chatId = msg.chat.id

    switch (msg.text) {
      case "🏦 My Account":
        const responseData = await getUserPublicKey(chatId)
        if (!responseData) return bot.sendMessage(chatId, "No user found")
        const balance = await getBalance(responseData)
        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "💰 Get Airdrop",
                callback_data: "account_get_airdrop",
              },
            ],
          ],
        }
        bot.sendMessage(
          chatId,
          `💳 Your Solana Account Address is \n<code>${responseData}</code> \n\n💵 Your Account Balance is \n<code>${balance} $SOL</code> \n\n\nCheck on <a href="https://solscan.io/account/${responseData}">solscan.io</a>`,
          {
            parse_mode: "HTML",
            reply_markup: keyboard,
          }
        )
        break
      case "💳 View Subscriptions":
        const userSubscriptions = await getUserSubscriptions(chatId)
        bot.sendMessage(
          chatId,
          `<b><u>List of your Subscriptions:</u></b> \n \n${userSubscriptions}`,
          {
            parse_mode: "HTML",
          }
        )
        break
      case "⚙️ Manage Subscriptions":
        const subscriptions = await getSubscriptionsWithUserStatus(msg.from!.id)
        if (subscriptions === null) {
          bot.sendMessage(chatId, "Error Fetching Subscriptions")
          return null
        }
        for (const subscription of subscriptions) {
          const keyboard = {
            inline_keyboard: [
              [
                {
                  text: subscription.isSubscribed ? "❌ Remove" : "✅ Add",
                  callback_data: `subscription_${subscription.isSubscribed ? "remove" : "add"}_${subscription.id}`,
                },
              ],
            ],
          }

          await bot.sendMessage(
            chatId,
            `Subscription: ${subscription.name
              .replace(/_/g, " ")
              .split(" ")
              .map((word: any) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(
                " "
              )}\nDescription: ${subscription.description}\nStatus: ${subscription.isSubscribed ? "Subscribed" : "Not subscribed"}`,
            { reply_markup: keyboard }
          )
        }
        break
    }
  })

  // Handle button clicks
  bot.on("callback_query", async (callbackQuery) => {
    const action = callbackQuery.data
    const msg = callbackQuery.message
    const chatId = msg!.chat.id
    if (action?.startsWith("subscription_")) {
      const [, operation, subscriptionId] = action.split("_")
      try {
        const user = await getAccountInfo(chatId)
        if (!user) {
          bot.answerCallbackQuery(callbackQuery.id, {
            text: "User not found. Please use /start to set up your account.",
          })
          return
        }
        if (operation === "add") {
          await addSubscriptionForUser(chatId, subscriptionId)
          bot.answerCallbackQuery(callbackQuery.id, {
            text: "Alert added successfully!",
          })
        } else if (operation === "remove") {
          await removeSubscriptionForUser(chatId, subscriptionId)
          bot.answerCallbackQuery(callbackQuery.id, {
            text: "Alert removed successfully!",
          })
        }
        return
      } catch (error) {
        return console.log("Error managing Subscription", chatId, error)
      }
    }
    if (action?.startsWith("account_")) {
      const [, , operation] = action.split("_")
      const userPublickey = await getUserPublicKey(chatId)
      if (!userPublickey || userPublickey === null) {
        bot.answerCallbackQuery(callbackQuery.id, {
          text: "User not found. Please use /start to set up your account.",
        })
        return null
      }
      if (operation === "airdrop") {
        const airdropResponse = await getAirDrop(chatId)
        console.log(airdropResponse)
        bot.sendMessage(chatId, airdropResponse || "Check Wallet for Airdrop")
      }
      return
    }
  })

  // Error handling
  bot.on("polling_error", (error) => {
    console.error(error)
  })

  console.log("\nBot is running...")

  app.listen(PORT, () => {
    console.log(`Solana Buddy Bot Server is running on port ${PORT}`)
  })
} catch (error) {
  console.log("Error Occured: ", error)
}
