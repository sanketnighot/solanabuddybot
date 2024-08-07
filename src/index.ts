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
import {
  getBalance,
  getTokenBalance,
  sendSol,
} from "./controllers/solana.controller"
import app from "./app"
const PORT = process.env.API_PORT || 8000

const token: string = process.env.TELEGRAM_BOT_API_SECRET || ""

// Create a bot instance
export const bot = new TelegramBot(token, { polling: true })

// Store user states
const userStates = new Map()

try {
  // Command handler for /start
  bot.onText(/\/start/, async (msg) => {
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
  })

  // Command handler for /help
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(
      chatId,
      "Here are the available commands:\n/start - Create/Connect to Solana Buddy Bot Account.\n/help - See available commands."
    )
  })

  bot.onText(/\/test/, async (msg) => {
    const chatId = msg.chat.id
  })

  // Handle responses
  bot.on("message", async (msg) => {
    // Get the current update_id
    const updates = await bot.getUpdates()
    const lastUpdateId =
      updates.length > 0 ? updates[updates.length - 1].update_id : 0

    // Clear all pending updates
    await bot.getUpdates({ offset: lastUpdateId + 1 })

    console.log("Cleared all pending updates")
    await ensureUser(msg)
    const chatId = msg.chat.id
    const userState = userStates.get(chatId)
    const cancelKeyboard = {
      inline_keyboard: [
        [{ text: "❌ Cancel Transaction", callback_data: "cancel_transfer" }],
      ],
    }
    if (userState) {
      switch (userState.state) {
        case "AWAITING_RECIPIENT":
          userState.recipientAddress = msg.text
          userState.state = "AWAITING_AMOUNT"
          const msgRes = await bot.sendMessage(
            chatId,
            "Please enter the amount of SOL to send:",
            {
              reply_markup: cancelKeyboard,
            }
          )
          userState.confirmationMessageId = msgRes.message_id
          break

        case "AWAITING_AMOUNT":
          const amount = parseFloat(msg.text || "0")
          if (isNaN(amount) || amount <= 0) {
            const msgRes = await bot.sendMessage(
              chatId,
              "Please enter a valid positive number for the amount.",
              { reply_markup: cancelKeyboard }
            )
            userState.confirmationMessageId = msgRes.message_id
            return
          }

          userState.amount = amount
          userState.state = "CONFIRMING"

          const confirmKeyboard = {
            inline_keyboard: [
              [
                {
                  text: "✅ Confirm Transaction",
                  callback_data: "confirm_transfer",
                },
                {
                  text: "❌ Cancel Transaction",
                  callback_data: "cancel_transfer",
                },
              ],
            ],
          }

          const confirmMessage = await bot.sendMessage(
            chatId,
            `Are you sure you want to proceed with this transaction? \n <u>Transaction Type</u>: <b>Send SOL</b>\n<u>Amount</u>: <b>${amount} $SOL</b> \n<u>To</u>: <b><code>${userState.recipientAddress}</code></b>`,
            { parse_mode: "HTML", reply_markup: confirmKeyboard }
          )
          userState.confirmationMessageId = confirmMessage.message_id
          break
      }

      userStates.set(chatId, userState)
    }

    switch (msg.text) {
      case "🏦 My Account":
        const responseData = await getUserPublicKey(chatId)
        if (!responseData) return bot.sendMessage(chatId, "No user found")
        const balance = await getBalance(responseData)
        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "💸 Get Airdrop",
                callback_data: "account_get_airdrop",
              },
            ],
            [
              {
                text: "💰 Get Token Balance",
                callback_data: "account_get_tokenBalance",
              },
            ],
            [
              {
                text: "📤 Send $SOL",
                callback_data: "account_send_sol",
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
      case "ℹ️ Help":
        bot.sendMessage(
          chatId,
          "Here are the available commands:\n/start - Create/Connect to Solana Buddy Bot Account. \n/help - See available commands.",
          { parse_mode: "HTML" }
        )
    }
  })

  // Handle button clicks
  bot.on("callback_query", async (callbackQuery) => {
    const action = callbackQuery.data
    const msg = callbackQuery.message
    const chatId = msg!.chat.id
    let userState = userStates.get(chatId)
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
      const [, reqType, operation] = action.split("_")
      const userPublickey = await getUserPublicKey(chatId)
      if (!userPublickey || userPublickey === null) {
        bot.answerCallbackQuery(callbackQuery.id, {
          text: "User not found. Please use /start to set up your account.",
        })
        return null
      }
      if (reqType === "send") {
        userStates.set(chatId, { state: "AWAITING_RECIPIENT" })
        userState = userStates.get(chatId)
        bot.answerCallbackQuery(callbackQuery.id)
        const cancelKeyboard = {
          inline_keyboard: [
            [
              {
                text: "❌ Cancel Transaction",
                callback_data: "cancel_transfer",
              },
            ],
          ],
        }
        const msgRes = await bot.sendMessage(
          chatId,
          "Please enter the recipient's Solana address",
          {
            reply_markup: cancelKeyboard,
          }
        )
        userState.confirmationMessageId = msgRes.message_id
      }
      if (operation === "airdrop") {
        const airdropResponse = await getAirDrop(chatId)
        bot.sendMessage(chatId, airdropResponse || "Check Wallet for Airdrop", {
          parse_mode: "HTML",
        })
      }
      if (operation === "tokenBalance") {
        const pubKey = await getUserPublicKey(chatId)
        if (!pubKey) return bot.sendMessage(chatId, "No user found")
        const tokenBalances = await getTokenBalance(pubKey)
        if (tokenBalances == null)
          return bot.sendMessage(chatId, "Error Fetching Tokens")
        if (tokenBalances.balances.length === 0)
          return bot.sendMessage(chatId, "No Tokens Found")
        let message = "💰 Your token balances:\n\n"
        let count = 1
        for (const token of tokenBalances.balances) {
          message += `#${count}\n`
          message += `<b><u>Mint</u></b>: <code>${token.mint}</code>\n`
          message += `<b><u>Balance</u></b>: <i>${token.balance}</i>\n\n`
          count++
        }
        bot.sendMessage(chatId, message, { parse_mode: "HTML" })
        return
      }
      return
    }

    // Function to delete the confirmation message
    const deleteConfirmationMessage = async () => {
      if (userState.confirmationMessageId) {
        try {
          await bot.deleteMessage(chatId, userState.confirmationMessageId)
        } catch (error) {
          console.error("Error deleting confirmation message:", error)
        }
      }
    }

    if (action === "confirm_transfer") {
      bot.answerCallbackQuery(callbackQuery.id)
      await deleteConfirmationMessage()
      const loadingMsg = await bot.sendMessage(
        chatId,
        "Transaction Processing..."
      )
      const response = await sendSol(
        chatId,
        userState.recipientAddress,
        userState.amount
      )
      if (response?.success) {
        bot.sendMessage(
          chatId,
          `<b><u>✅ Transfer Successful</u></b> \n\n<b>Transaction Type</b>: Send SOL\n<b>Amount</b>: ${userState.amount} $SOL \n<b>To</b>: <code>${userState.recipientAddress}</code>\n\n\n<a href='https://solscan.io/tx/${response.signature}?cluster=devnet'>Check Tranasction Here</a>`,
          { parse_mode: "HTML" }
        )
      } else {
        bot.sendMessage(
          chatId,
          `<b><u>❌ Transfer Failed</u></b> \n\n<b>Transaction Type</b>: Send SOL\n<b>Amount</b>: ${userState.amount} $SOL \n<b>To</b>: <code>${userState.recipientAddress}</code>`,
          { parse_mode: "HTML" }
        )
      }
      userStates.delete(chatId)
      bot.deleteMessage(chatId, loadingMsg.message_id)
    } else if (action === "cancel_transfer") {
      bot.answerCallbackQuery(callbackQuery.id)
      bot.sendMessage(
        chatId,
        `<b><u>❌ Transfer Cancelled</u></b> \n\n<b>Transaction Type</b>: Send SOL`,
        { parse_mode: "HTML" }
      )
      await deleteConfirmationMessage()
      userStates.delete(chatId)
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
