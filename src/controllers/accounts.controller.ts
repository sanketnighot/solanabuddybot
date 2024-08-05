import { PrismaClient } from "@prisma/client"
import { userType } from "../types/user.types"
import { generateKeypair } from "./wallet.controller"

const prisma = new PrismaClient()

export async function getAccountInfo(
  chatId: number
): Promise<userType | undefined> {
  try {
    let user: userType | undefined = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
    })
    return user
  } catch (error) {
    console.log("An Error Occured while fetching user: ", error)
  }
}

export async function createAccountIfNotFound(
  chatId: number,
  username: string
): Promise<userType | undefined> {
  try {
    let user: userType | undefined = await getAccountInfo(chatId)
    if (!user) {
      const newKeypair = await generateKeypair()
      if (!newKeypair.success) return
      user = await prisma.user.create({
        data: {
          chatId: BigInt(chatId),
          username: username,
          solanaAccount: {
            create: {
              publicKey: newKeypair.publicKey,
              privateKey: newKeypair.privateKey,
            },
          },
          subscribedTo: {
            connect: { id: 2 }, // Connect to alert with ID 1
          },
        },
        include: { solanaAccount: true, subscribedTo: true },
      })
      console.log(`New user created: @${username} (${chatId})`)
      return user
    } else {
      console.log(`user already exisits @${user.username} id(${user.id})`)
    }
  } catch (error) {
    console.log("Error Occured: ", error)
  }
}
