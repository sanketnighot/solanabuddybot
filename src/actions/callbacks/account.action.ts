import { CallbackQuery } from "node-telegram-bot-api"
import {
  bot,
  userStates,
  tokenCreationStates,
  tokenTransferStates,
} from "../../index"
import {
  createToken,
  getTokenBalance,
} from "../../controllers/solana.controller"
import {
  getAirDrop,
  getUserPublicKey,
} from "../../controllers/accounts.controller"

export async function accountsCallback(callbackQuery: CallbackQuery) {
  try {
    const action = callbackQuery.data
    const msg = callbackQuery.message
    const chatId = msg!.chat.id
    let userState = userStates.get(chatId)

    const [, reqType, operation] = action!.split("_")
    const userPublickey = await getUserPublicKey(chatId)
    if (!userPublickey || userPublickey === null) {
      bot.answerCallbackQuery(callbackQuery.id, {
        text: "User not found. Please use /start to set up your account.",
      })
      return null
    }

    if (reqType === "send") {
      if (operation === "sol") {
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
        userState!.confirmationMessageId = msgRes.message_id
      } else if (operation === "token") {
        const cancelKeyboard = {
          inline_keyboard: [
            [
              {
                text: "❌ Cancel Transaction",
                callback_data: "cancel_transfer_token",
              },
            ],
          ],
        }
        tokenTransferStates.set(chatId, { stage: "mint" })
        bot.answerCallbackQuery(callbackQuery.id)
        bot.sendMessage(
          chatId,
          "Let's transfer your token! First, please enter the mint address of the token you want to transfer:",
          { reply_markup: cancelKeyboard }
        )
      }
    }

    if (reqType === "get") {
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
    }

    if (reqType === "create") {
      if (operation === "token") {
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
    }

    if (reqType === "play") {
      if (operation === "miniGames") {
        bot.sendMessage(chatId, "Play Minigames")
      }
    }

    return
  } catch (error) {
    console.log("subscriptionsCallbackError", error)
    bot.sendMessage(callbackQuery.message!.chat.id, "Something went wrong")
  }
}
