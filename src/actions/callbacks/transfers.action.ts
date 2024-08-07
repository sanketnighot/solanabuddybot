import { bot, userStates } from "../../index"
import { CallbackQuery } from "node-telegram-bot-api"
import {
  addSubscriptionForUser,
  getAccountInfo,
  removeSubscriptionForUser,
} from "../../controllers/accounts.controller"
import { sendSol } from "../../controllers/solana.controller"
const deleteConfirmationMessage = async (callbackQuery: CallbackQuery) => {
  const action = callbackQuery.data
  const msg = callbackQuery.message
  const chatId = msg!.chat.id
  let userState = userStates.get(chatId)
  if (userState.confirmationMessageId) {
    try {
      await bot.deleteMessage(chatId, userState.confirmationMessageId)
    } catch (error) {
      console.error("Error deleting confirmation message:", error)
    }
  }
}
export async function confirmTransferCallback(callbackQuery: CallbackQuery) {
  try {
    const action = callbackQuery.data
    const msg = callbackQuery.message
    const chatId = msg!.chat.id
    let userState = userStates.get(chatId)

    bot.answerCallbackQuery(callbackQuery.id)
    await deleteConfirmationMessage(callbackQuery)
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
    return
  } catch (error) {
    console.log("confirmTransferCallbackError", error)
    bot.sendMessage(callbackQuery.message!.chat.id, "Something went wrong")
  }
}

export async function cancelTransferCallback(callbackQuery: CallbackQuery) {
  try {
    const action = callbackQuery.data
    const msg = callbackQuery.message
    const chatId = msg!.chat.id
    let userState = userStates.get(chatId)

    bot.answerCallbackQuery(callbackQuery.id)
    bot.sendMessage(
      chatId,
      `<b><u>❌ Transfer Cancelled</u></b> \n\n<b>Transaction Type</b>: Send SOL`,
      { parse_mode: "HTML" }
    )
    await deleteConfirmationMessage(callbackQuery)
    userStates.delete(chatId)
    return
  } catch (error) {
    console.log("cancelTransferCallbackError", error)
    bot.sendMessage(callbackQuery.message!.chat.id, "Something went wrong")
  }
}
