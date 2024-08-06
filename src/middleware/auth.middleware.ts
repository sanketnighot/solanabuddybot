import { PrismaClient } from "@prisma/client"
import TelegramBot from "node-telegram-bot-api"
import { createAccountIfNotFound } from "../controllers/accounts.controller"
import { userType } from "../types/types"

const prisma = new PrismaClient()

export default async function ensureUser(
  msg: TelegramBot.Message
): Promise<userType | undefined> {
  const chatId = msg.chat.id
  const username = msg.from?.username || "unknown"
  const user: userType | undefined = await createAccountIfNotFound(
    chatId,
    username
  )
  return user
}
