import { Request, Response } from "express"
import { bot } from "../index"
import { getAccountsWithPublicKey, getSubscribers } from "./accounts.controller"

export function healthCheck(
  req: Request,
  res: Response
): Response<any, Record<string, any>> {
  try {
    return res
      .status(200)
      .json({ message: "Solana Buddy Bot working fine", statusCode: 200 })
  } catch (error) {
    console.log(error)
    return res
      .status(500)
      .json({ message: "Internal Server Error", statusCode: 500 })
  }
}

export function testBot(
  req: Request,
  res: Response
): Response<any, Record<string, any>> {
  try {
    bot.sendMessage(
      req.body.chatId,
      `<b><u>ℹ️ This is a test message please ignore</u></b> \n\n<code>${req.body.testMessage}</code>`,
      { parse_mode: "HTML" }
    )
    return res
      .status(200)
      .json({ message: "Message Sent Successfully", statusCode: 200 })
  } catch (error) {
    return res
      .status(400)
      .json({ message: "Error sending Message", statusCode: 400 })
  }
}

export async function sendWhaleAlerts(
  req: Request,
  res: Response
): Promise<Response<any, Record<string, any>>> {
  try {
    const { message } = req.body
    if (!message) {
      return res
        .status(200)
        .json({ error: "Invalid alert data", statuscode: 400 })
    }
    const subscribers = await getSubscribers("whale_alerts")
    if (subscribers === null) {
      return res
        .status(200)
        .json({ error: "Error getting subscribers", statuscode: 500 })
    }
    if (subscribers.length === 0) {
      return res
        .status(200)
        .json({ message: "No Subscribers found", statusCode: 404 })
    }
    // Send the alert to all subscribed users
    for (const user of subscribers) {
      await bot.sendMessage(Number(user.chatId), message, {
        parse_mode: "HTML",
      })
    }
    return res.status(200).json({ message: "Alert processed successfully" })
  } catch (error) {
    console.error("Error processing alert:", error)
    return res
      .status(200)
      .json({ error: "Internal server error", statuscode: 500 })
  }
}

export async function sentTransactionAlertForAddress(
  req: Request,
  res: Response
): Promise<Response<any, Record<string, any>>> {
  try {
    const { alert, address } = req.body
    if (!alert || !address) {
      return res
        .status(200)
        .json({ error: "Invalid alert data", statuscode: 400 })
    }
    const subscribers = await getAccountsWithPublicKey(address)
    if (subscribers === null) {
      return res
        .status(200)
        .json({ error: "Error getting subscribers", statuscode: 500 })
    }
    for (const user of subscribers) {
      await bot.sendMessage(Number(user.chatId), alert, { parse_mode: "HTML" })
    }
    return res
      .status(200)
      .json({ message: "Transaction alert sent successfully", statusCode: 200 })
  } catch (error) {
    console.log(error)
    return res
      .status(200)
      .json({ message: "Error sending transaction alert", statusCode: 400 })
  }
}
