import { Message } from "node-telegram-bot-api"
import { bot, userStates } from "../index"
import {
  getSubscriptionsWithUserStatus,
  getUserPublicKey,
  getUserSubscriptions,
} from "../controllers/accounts.controller"
import { getBalance } from "../controllers/solana.controller"

const cancelKeyboard = {
  inline_keyboard: [
    [{ text: "❌ Cancel Transaction", callback_data: "cancel_transfer" }],
  ],
}

export async function clearPendingUpdates(msg: Message) {
  try {
    // Get the current update_id
    const updates = await bot.getUpdates()
    const lastUpdateId =
      updates.length > 0 ? updates[updates.length - 1].update_id : 0

    // Clear all pending updates
    await bot.getUpdates({ offset: lastUpdateId + 1 })
  } catch (error) {
    console.log("clearPendingUpdatesError", error)
    bot.sendMessage(msg.chat.id, "Something went wrong")
  }
}

export async function handleTransferSol(msg: Message) {
  try {
    const chatId = msg.chat.id
    const userState = userStates.get(chatId)

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
    return
  } catch (error) {
    console.log("handleTransferSolError", error)
    bot.sendMessage(msg.chat.id, "Something went wrong")
    return
  }
}

export async function handleMainMenu(msg: Message) {
  try {
    const chatId = msg.chat.id
    const userState = userStates.get(chatId)
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
  } catch (error) {
    console.log("handleTransferSolError", error)
    bot.sendMessage(msg.chat.id, "Something went wrong")
    return
  }
}
