import { createToken } from "../../controllers/solana.controller"
import { bot, tokenCreationStates } from "../../index"
import { CallbackQuery } from "node-telegram-bot-api"

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

export async function confirmCreateTokenCallback(callbackQuery: CallbackQuery) {
  try {
    const msg = callbackQuery.message
    const chatId = msg!.chat.id
    let tokenCreationState = tokenCreationStates.get(chatId)
    if (!tokenCreationState) {
      bot.sendMessage(chatId, "Something went wrong. Please try again later")
      return
    }
    bot.answerCallbackQuery(callbackQuery.id)
    await deleteConfirmationMessage(chatId, msg?.message_id!)
    const loadingMsg = await bot.sendMessage(
      chatId,
      "Transaction Processing..."
    )
    const response = await createToken(chatId, tokenCreationState)
    if (response !== null) {
      if (response.success) {
        bot.sendMessage(
          chatId,
          `Congratulations! Your token has been created successfully: \n\n<b>Name</b>: ${response.name}\n<b>Symbol</b>: ${response.symbol}\n<b>Decimals</b>: ${response.decimals}\n<b>Total Supply</b>: ${response.supply}\n<b>Mint Address</b>: <code>${response.mintAddress}</code>\n<b>Token Account</b>: <code>${response.tokenAccount}</code>
        `,
          { parse_mode: "HTML" }
        )
      } else {
        bot.sendMessage(
          chatId,
          `<b><u>❌ Transaction Failed</u></b> \n\n<b>Transaction Type</b>: Create Token`,
          { parse_mode: "HTML" }
        )
      }
    } else {
      bot.sendMessage(
        chatId,
        `<b><u>❌ Transaction Failed</u></b> \n\n<b>Transaction Type</b>: Create Token`,
        { parse_mode: "HTML" }
      )
    }
    setTimeout(() => {
      tokenCreationStates.delete(chatId)
      bot.deleteMessage(chatId, loadingMsg.message_id)
    }, 5000)
    return
  } catch (error) {
    console.log("confirmCreateTokenCallbackError", error)
    bot.sendMessage(callbackQuery.message!.chat.id, "Something went wrong")
  }
}

export async function cancelCreateTokenCallback(callbackQuery: CallbackQuery) {
  try {
    const msg = callbackQuery.message
    const chatId = msg!.chat.id
    const tokenCreationState = tokenCreationStates.get(chatId)
    if (!tokenCreationState) return
    bot.answerCallbackQuery(callbackQuery.id)
    bot.sendMessage(
      chatId,
      `<b><u>❌ Transfer Cancelled</u></b> \n\n<b>Transaction Type</b>: Send SOL`,
      { parse_mode: "HTML" }
    )
    if (tokenCreationState.confirmationMessageId) {
      await deleteConfirmationMessage(
        chatId,
        tokenCreationState.confirmationMessageId
      )
    }
    tokenCreationStates.delete(chatId)
  } catch (error) {
    console.log("cancelCreateTokenCallbackError", error)
    bot.sendMessage(callbackQuery.message!.chat.id, "Something went wrong")
  }
}
