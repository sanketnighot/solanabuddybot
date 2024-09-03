import { bot, tokenTransferStates } from "../../index"
import { CallbackQuery } from "node-telegram-bot-api"
import { sendToken } from "../../controllers/solana.controller"
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

export async function confirmTransferTokenCallback(
  callbackQuery: CallbackQuery
) {
  try {
    const msg = callbackQuery.message
    const chatId = msg!.chat.id
    let transferTokenState = tokenTransferStates.get(chatId)
    if (!transferTokenState) return
    bot.answerCallbackQuery(callbackQuery.id)
    await deleteConfirmationMessage(chatId, msg?.message_id!)
    const loadingMsg = await bot.sendMessage(
      chatId,
      "Transaction Processing..."
    )
    const response = await sendToken(chatId, transferTokenState)
    if (response?.success) {
      bot.sendMessage(
        chatId,
        `<b><u>✅ Transfer Successful</u></b> \n\n<u>Transaction Type</u>: <b>Send Token</b>\n<u>Token Address</u>: <code>${transferTokenState.mintAddress}</code> \n<u>Amount</u>: <b>${transferTokenState.amount}</b> \n<u>To</u>: <code>${transferTokenState.recipientAddress}</code>`,
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
        `<b><u>❌ Transfer Failed</u></b> \n\n<b>Transaction Type</b>: Send Token`,
        { parse_mode: "HTML" }
      )
    }
    tokenTransferStates.delete(chatId)
    bot.deleteMessage(chatId, loadingMsg.message_id)
    return
  } catch (error) {
    console.log("confirmTransferTokenCallbackError", error)
    bot.sendMessage(callbackQuery.message!.chat.id, "Something went wrong")
  }
}

export async function cancelTransferTokenCallback(
  callbackQuery: CallbackQuery
) {
  try {
    const msg = callbackQuery.message
    const chatId = msg!.chat.id
    const transferTokenState = tokenTransferStates.get(chatId)
    if (!transferTokenState) return
    bot.answerCallbackQuery(callbackQuery.id)
    bot.sendMessage(
      chatId,
      `<b><u>❌ Transfer Cancelled</u></b> \n\n<b>Transaction Type</b>: Send Token`,
      { parse_mode: "HTML" }
    )
    if (transferTokenState.confirmationMessageId) {
      await deleteConfirmationMessage(
        chatId,
        transferTokenState.confirmationMessageId
      )
    }
    tokenTransferStates.delete(chatId)
    return
  } catch (error) {
    console.log("cancelTransferTokenCallbackError", error)
    bot.sendMessage(callbackQuery.message!.chat.id, "Something went wrong")
  }
}
