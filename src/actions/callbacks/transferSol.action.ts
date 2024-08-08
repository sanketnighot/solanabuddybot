import { bot, userStates } from "../../index"
import { CallbackQuery } from "node-telegram-bot-api"
import { sendSol } from "../../controllers/solana.controller"
const deleteConfirmationMessage = async (
  chatId: number,
  message_id: number
) => {
  try {
    await bot.deleteMessage(chatId, message_id)
  } catch (error) {
    console.error("Error deleting confirmation message:", error)
  }
}

export async function confirmTransferCallback(callbackQuery: CallbackQuery) {
  try {
    const msg = callbackQuery.message
    const chatId = msg!.chat.id
    let userState = userStates.get(chatId)

    bot.answerCallbackQuery(callbackQuery.id)
    await deleteConfirmationMessage(chatId, msg?.message_id!)
    const loadingMsg = await bot.sendMessage(
      chatId,
      "Transaction Processing..."
    )
    const response = await sendSol(
      chatId,
      userState!.recipientAddress || "",
      userState!.amount || 0
    )
    if (response?.success) {
      bot.sendMessage(
        chatId,
        `<b><u>✅ Transfer Successful</u></b> \n\n<b>Transaction Type</b>: Send SOL\n<b>Amount</b>: ${userState!.amount} $SOL \n<b>To</b>: <code>${userState!.recipientAddress}</code>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔗 Check Transaction",
                  web_app: {
                    url: `https://solscan.io/tx/${response.signature}?cluster=devnet`,
                  },
                },
              ],
            ],
          },
        }
      )
    } else {
      bot.sendMessage(
        chatId,
        `<b><u>❌ Transfer Failed</u></b> \n\n<b>Transaction Type</b>: Send SOL\n<b>Amount</b>: ${userState!.amount} $SOL \n<b>To</b>: <code>${userState!.recipientAddress}</code>`,
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
    if (action === "cancel_transfer") {
      const msg = callbackQuery.message
      const chatId = msg!.chat.id
      const userState = userStates.get(chatId)
      if (!userState) return
      bot.answerCallbackQuery(callbackQuery.id)
      bot.sendMessage(
        chatId,
        `<b><u>❌ Transfer Cancelled</u></b> \n\n<b>Transaction Type</b>: Send SOL`,
        { parse_mode: "HTML" }
      )
      if (userState.confirmationMessageId) {
        await deleteConfirmationMessage(chatId, userState.confirmationMessageId)
      }
      userStates.delete(chatId)
    }
    return
  } catch (error) {
    console.log("cancelTransferCallbackError", error)
    bot.sendMessage(callbackQuery.message!.chat.id, "Something went wrong")
  }
}
