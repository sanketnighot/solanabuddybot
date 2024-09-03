import { bot, DiceGameState, diceGameStates } from "../../index"
import { transferSOL } from "../../controllers/solana.controller"
import { getUserPublicKey } from "../../controllers/accounts.controller"

const OWNER_ADDRESS = process.env.OWNER_ADDRESS || ""

export async function playDiceGame(chatId: number, state: DiceGameState) {
  bot.sendMessage(
    chatId,
    `You choose <b>"${state.guess}"</b> ... Wait for dice to roll`,
    { parse_mode: "HTML" }
  )
  const diceResult = await bot.sendDice(chatId, { emoji: "🎲" })
  const diceValue = diceResult.dice!.value

  setTimeout(async () => {
    let userWon = false
    let winMultiplier = 0

    if (state.guess === diceValue.toString()) {
      userWon = true
      winMultiplier = 2
    } else if (
      (state.guess === "even" && diceValue % 2 === 0) ||
      (state.guess === "odd" && diceValue % 2 !== 0)
    ) {
      userWon = true
      winMultiplier = 1.5
    }

    if (userWon) {
      const winAmount = state.bet! * winMultiplier
      const userPublickey = await getUserPublicKey(chatId)
      if (!userPublickey) return
      const res = await transferSOL(OWNER_ADDRESS, userPublickey, winAmount)
      bot.sendMessage(
        chatId,
        `Congratulations! You won <b>${winAmount} SOL!</b>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔗 Check Transaction",
                  web_app: {
                    url: `https://solscan.io/tx/${res.signature}?cluster=devnet`,
                  },
                },
              ],
              [
                {
                  text: "🎲 Play Again",
                  callback_data: "play_dice_game",
                },
              ],
            ],
          },
        }
      )
    } else {
      const userPublickey = await getUserPublicKey(chatId)
      if (!userPublickey) return
      const res = await transferSOL(userPublickey, OWNER_ADDRESS, state.bet!)
      bot.sendMessage(
        chatId,
        `Sorry, you lost <b>${state.bet} $SOL</b>. Better luck next time!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔗 Check Transaction",
                  web_app: {
                    url: `https://solscan.io/tx/${res.signature}?cluster=devnet`,
                  },
                },
              ],
              [
                {
                  text: "🎲 Play Again",
                  callback_data: "play_dice_game",
                },
              ],
            ],
          },
        }
      )
    }

    diceGameStates.delete(chatId)
  }, 3000) // Wait for 3 seconds to show the result after the dice animation
}
