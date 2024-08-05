import { PrismaClient } from "@prisma/client"
import { userType } from "../types/user.types"
import { generateKeypair } from "./wallet.controller"
import { canRequestAirdrop, requestAirdrop } from "./airdrop.controller"

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
            connect: { id: 2 }, // Connect to Subscription with ID 1
          },
        },
        include: { solanaAccount: true, subscribedTo: true },
      })
      return user
    }
  } catch (error) {
    console.log("Error Occured: ", error)
  }
}

export async function getUserPublicKey(chatId: number) {
  try {
    let user: userType | undefined = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
      include: { solanaAccount: true },
    })
    if (!user) return "Unknown User"
    // @ts-ignore
    return user?.solanaAccount?.publicKey
  } catch (error) {
    console.log(`Error Getting User Subscriptions for ${chatId}`, error)
  }
}

export async function getUserSubscriptions(chatId: number) {
  try {
    let user: userType | undefined = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
      include: { subscribedTo: true },
    })
    // @ts-ignore
    if (user && user.subscribedTo?.length > 0) {
      const SubscriptionList =
        user.subscribedTo
          ?.map(
            (subscription: any) =>
              `<b>Subscription:</b> <i>${subscription.name
                .replace(/_/g, " ")
                .split(" ")
                .map(
                  (word: any) => word.charAt(0).toUpperCase() + word.slice(1)
                )
                .join(
                  " "
                )}</i>\n<b>Description:</b> <i>${subscription.description}\n</i>`
          )
          .join("\n") || ""
      return SubscriptionList
    } else {
      return "<b>No Subscription Found. Click Manage Subscriptions below to subscribe.</b>"
    }
  } catch (error) {
    console.log(`Error Getting User Public Key for ${chatId}`, error)
  }
}

export async function getSubscriptionsWithUserStatus(chatId: number) {
  const allSubscriptions = await prisma.subscription.findMany()
  const userSubscriptions = await prisma.user.findUnique({
    where: { chatId: chatId },
    select: { subscribedTo: { select: { id: true } } },
  })

  const userSubscriptionIds = new Set(
    userSubscriptions?.subscribedTo.map((a: any) => a.id) || []
  )

  return allSubscriptions.map((subscription: any) => ({
    ...subscription,
    isSubscribed: userSubscriptionIds.has(subscription.id),
  }))
}

export async function getAllSubscriptions() {
  const allSubscriptions = await prisma.Subscription.findMany()
  return allSubscriptions

  try {
  } catch (error) {
    console.log(`Error Getting All Subscriptions`, error)
  }
}

export async function addSubscriptionForUser(
  chatId: number,
  SubscriptionId: string
) {
  try {
    const user = await getAccountInfo(chatId)
    const response = await prisma.user.update({
      where: { id: user?.id },
      data: { subscribedTo: { connect: { id: parseInt(SubscriptionId) } } },
    })
    return
  } catch (error) {
    console.log(`Error Adding Subscriptions for user User ${chatId}`, error)
  }
}

export async function removeSubscriptionForUser(
  chatId: number,
  SubscriptionId: string
) {
  try {
    const user = await getAccountInfo(chatId)
    const response = await prisma.user.update({
      where: { id: user?.id },
      data: { subscribedTo: { disconnect: { id: parseInt(SubscriptionId) } } },
    })
    return
  } catch (error) {
    console.log(`Error Removing Subscriptions for user User ${chatId}`, error)
  }
}

export async function getAirDrop(chatId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
      include: { solanaAccount: true },
    })

    if (!user || !user.solanaAccount) return
    if (!(await canRequestAirdrop(user.id))) {
      return "Already claimed"
    }
    const publicKey = user.solanaAccount.publicKey
    const result = await requestAirdrop(publicKey)
    return result
  } catch (error) {
    console.log("Error Airdropping Sol", chatId, error)
  }
}
