import { Message } from "node-telegram-bot-api"
import {
  bot,
  userStates,
  tokenCreationStates,
  tokenTransferStates,
  diceGameStates,
} from "../index"
import {
  getSubscriptionsWithUserStatus,
  getUserPublicKey,
  getUserSubscriptions,
} from "../controllers/accounts.controller"
import { getBalance } from "../controllers/solana.controller"
import { confirmCreateTokenCallback } from "./callbacks/createToken.action"
import { PublicKey } from "@solana/web3.js"

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
  const cancelKeyboard = {
    inline_keyboard: [
      [{ text: "❌ Cancel Transaction", callback_data: "cancel_transfer" }],
    ],
  }
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
            "Please enter the amount of $SOL to send:",
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

export async function handleCreateToken(msg: Message) {
  const cancelKeyboard = {
    inline_keyboard: [
      [{ text: "❌ Cancel Transaction", callback_data: "cancel_create_token" }],
    ],
  }
  try {
    const chatId = msg.chat.id
    const tokenState = tokenCreationStates.get(chatId)
    if (!tokenState) return

    switch (tokenState.stage) {
      case "name":
        tokenState.name = msg.text
        tokenState.stage = "symbol"
        bot.sendMessage(
          chatId,
          `Great! Your token will be named "${tokenState.name}". Now, what symbol would you like to use for your token? (e.g., BTC, ETH)`,
          {
            reply_markup: cancelKeyboard,
          }
        )
        break

      case "symbol":
        tokenState.symbol = msg.text!.toUpperCase()
        tokenState.stage = "decimals"
        bot.sendMessage(
          chatId,
          `Your token symbol will be ${tokenState.symbol}. How many decimal places should your token have? (typically 9)`,
          {
            reply_markup: cancelKeyboard,
          }
        )
        break

      case "decimals":
        const decimals = parseInt(msg.text!)
        if (isNaN(decimals) || decimals < 0 || decimals > 9) {
          bot.sendMessage(
            chatId,
            "Please enter a valid number between 0 and 9.",
            {
              reply_markup: cancelKeyboard,
            }
          )
          return
        }
        tokenState.decimals = decimals
        tokenState.stage = "supply"
        bot.sendMessage(
          chatId,
          `Your token will have ${tokenState.decimals} decimal places. What should the total supply of your token be?`,
          {
            reply_markup: cancelKeyboard,
          }
        )
        break

      case "supply":
        const supply = parseFloat(msg.text!)
        if (isNaN(supply) || supply <= 0) {
          bot.sendMessage(
            chatId,
            "Please enter a valid positive number for the supply.",
            {
              reply_markup: cancelKeyboard,
            }
          )
          return
        }
        tokenState.supply = supply
        tokenState.stage = "confirm"
        const confirmKeyboard = {
          inline_keyboard: [
            [
              {
                text: "✅ Confirm Transaction",
                callback_data: "confirm_create_token",
              },
              {
                text: "❌ Cancel Transaction",
                callback_data: "cancel_create_token",
              },
            ],
          ],
        }

        const confirmMessage = await bot.sendMessage(
          chatId,
          `Are you sure you want to proceed with this transaction? \n\n<u>Transaction Type</u>: <b>Create Token</b> \n<u>Name</u>: <b>${tokenState.name}</b> \n<u>Symbol</u>: <b>${tokenState.symbol}</b> \n<u>Decimals</u>: <b>${tokenState.decimals}</b> \n<u>Token Supply</u>: <b>${tokenState.supply}</b>`,
          { parse_mode: "HTML", reply_markup: confirmKeyboard }
        )
        tokenState.confirmationMessageId = confirmMessage.message_id
        break
    }
  } catch (error) {
    console.log("handleTransferSolError", error)
    bot.sendMessage(msg.chat.id, "Something went wrong")
    return
  }
}

export async function handleTransferToken(msg: Message) {
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
  try {
    const chatId = msg.chat.id
    const transferTokenState = tokenTransferStates.get(chatId)
    if (!transferTokenState) return

    switch (transferTokenState.stage) {
      case "mint":
        try {
          transferTokenState.mintAddress = new PublicKey(msg.text!).toBase58()
          transferTokenState.stage = "recipient"
          bot.sendMessage(
            chatId,
            `Great! Now, please enter the recipient's Solana address:`,
            { reply_markup: cancelKeyboard }
          )
        } catch (error) {
          bot.sendMessage(
            chatId,
            "Invalid mint address. Please enter a valid Solana public key.",
            { reply_markup: cancelKeyboard }
          )
          return
        }
        break

      case "recipient":
        try {
          transferTokenState.recipientAddress = new PublicKey(
            msg.text!
          ).toBase58()
          transferTokenState.stage = "amount"
          bot.sendMessage(
            chatId,
            `Recipient address set. How many tokens would you like to transfer?`,
            { reply_markup: cancelKeyboard }
          )
        } catch (error) {
          bot.sendMessage(
            chatId,
            "Invalid recipient address. Please enter a valid Solana public key.",
            { reply_markup: cancelKeyboard }
          )
          return
        }
        break

      case "amount":
        const amount = parseFloat(msg.text!)
        if (isNaN(amount) || amount <= 0) {
          bot.sendMessage(
            chatId,
            "Please enter a valid positive number for the amount.",
            { reply_markup: cancelKeyboard }
          )
          return
        }
        transferTokenState.amount = amount
        transferTokenState.stage = "confirm"

        // =
        const confirmKeyboard = {
          inline_keyboard: [
            [
              {
                text: "✅ Confirm Transaction",
                callback_data: "confirm_transfer_token",
              },
              {
                text: "❌ Cancel Transaction",
                callback_data: "cancel_transfer_token",
              },
            ],
          ],
        }

        const confirmMessage = await bot.sendMessage(
          chatId,
          `Are you sure you want to proceed with this transaction? \n <u>Transaction Type</u>: <b>Send Token</b>\n<u>Token Address</u>: <code>${transferTokenState.mintAddress}</code> \n<u>Amount</u>: <b>${transferTokenState.amount}</b> \n<u>To</u>: <code>${transferTokenState.recipientAddress}</code>`,
          { parse_mode: "HTML", reply_markup: confirmKeyboard }
        )
        transferTokenState.confirmationMessageId = confirmMessage.message_id
        break
      case "confirm":
        break
    }
  } catch (error) {
    console.log("handleTransferSolError", error)
    bot.sendMessage(msg.chat.id, "Something went wrong")
    return
  }
}

export async function handlePlayDiceGame(msg: Message) {
  try {
    if (!msg) return null
    const chatId = msg.chat.id
    const state = diceGameStates.get(chatId)

    if (!state) return

    switch (state.stage) {
      case "bet":
        const bet = parseFloat(msg.text!)
        if (isNaN(bet) || bet <= 0 || bet >= 10) {
          bot.sendMessage(
            chatId,
            "Please enter a $SOL amount more than 0 and less than 10.",
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "❌ End Game", callback_data: "dice_game_cancel" }],
                ],
              },
            }
          )
          return
        }
        state.bet = bet
        state.stage = "guess"
        state.confirmationMessageId = msg.chat.id
        const guessKeyboard = {
          inline_keyboard: [
            [
              { text: "1", callback_data: "dice_guess_1" },
              { text: "2", callback_data: "dice_guess_2" },
              { text: "3", callback_data: "dice_guess_3" },
            ],
            [
              { text: "4", callback_data: "dice_guess_4" },
              { text: "5", callback_data: "dice_guess_5" },
              { text: "6", callback_data: "dice_guess_6" },
            ],
            [
              { text: "Even", callback_data: "dice_guess_even" },
              { text: "Odd", callback_data: "dice_guess_odd" },
            ],
            [{ text: "❌ End Game", callback_data: "dice_game_cancel" }],
          ],
        }
        bot.sendMessage(chatId, "Great! Now choose your guess:", {
          reply_markup: guessKeyboard,
        })
        diceGameStates.set(chatId, state)
        break
    }
  } catch (error) {
    console.log("handlePlayDiceGameError", error)
    bot.sendMessage(msg.chat.id, "Something went wrong")
    return
  }
}

export async function handleMainMenu(msg: Message) {
  try {
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
                text: "📂 Open Solscan",
                web_app: {
                  url: `https://solscan.io/account/${responseData}?cluster=devnet`,
                },
              },
              {
                text: "📤 Send $SOL",
                callback_data: "account_send_sol",
              },
            ],
            [
              {
                text: "💸 Get Airdrop",
                callback_data: "account_get_airdrop",
              },
              {
                text: "📤 Send Token",
                callback_data: "account_send_token",
              },
            ],
            [
              {
                text: "🪙 Create Token",
                callback_data: "account_create_token",
              },
              {
                text: "💰 Token Balance",
                callback_data: "account_get_tokenBalance",
              },
            ],
            [
              {
                text: "🎮 Play Mini Games",
                callback_data: "account_play_miniGames",
              },
            ],
          ],
        }
        bot.sendMessage(
          chatId,
          `💳 Your Solana Account Address is \n<code>${responseData}</code> \n\n💵 Your Account Balance is \n<code>${balance} $SOL</code>`,
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
