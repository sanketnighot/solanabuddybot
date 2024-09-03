import { CallbackQuery } from "node-telegram-bot-api"
import { bot, userStates } from "../../index"
import {
  addSubscriptionForUser,
  getAccountInfo,
  removeSubscriptionForUser,
} from "../../controllers/accounts.controller"

export async function subscriptionsCallback(callbackQuery: CallbackQuery) {
  try {
    const action = callbackQuery.data
    const msg = callbackQuery.message
    const chatId = msg!.chat.id
    let userState = userStates.get(chatId)
    const [, operation, subscriptionId] = action!.split("_")
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
    console.log("subscriptionsCallbackError", error)
    bot.sendMessage(callbackQuery.message!.chat.id, "Something went wrong")
  }
}
