import { PrismaClient } from "@prisma/client"
import { subscriptionType, userType, solanaAccType } from "../types/types"
import { generateKeypair } from "./wallet.controller"
import { canRequestAirdrop, requestAirdrop } from "./airdrop.controller"

const prisma = new PrismaClient()

export async function getAccountInfo(chatId: number): Promise<userType | null> {
  try {
    let user: userType | null = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
    })
    return user
  } catch (error: any) {
    console.log("An Error Occured while fetching user: ", error)
    return null
  }
}

export async function createAccountIfNotFound(
  chatId: number,
  username: string
): Promise<userType | null> {
  try {
    let user: userType | null = await getAccountInfo(chatId)
    if (!user) {
      const newKeypair = await generateKeypair()
      if (!newKeypair.success) return null
      const publicKey = newKeypair.publicKey ?? ""
      const privateKey = newKeypair.privateKey ?? ""
      user = await prisma.user.create({
        data: {
          chatId: BigInt(chatId),
          username: username,
          solanaAccount: {
            create: {
              publicKey,
              privateKey,
            },
          },
          subscribedTo: {
            connect: { id: 2 }, // Connect to Subscription with ID 1
          },
        },
        include: { solanaAccount: true, subscribedTo: true },
      })
      return user
    } else {
      return null
    }
  } catch (error: any) {
    console.log("Error Occured: ", error)
    return null
  }
}

export async function getUserPublicKey(chatId: number): Promise<string | null> {
  try {
    let user = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
      include: { solanaAccount: true },
    })
    if (!user) return null
    return user?.solanaAccount?.publicKey || "No User Info Found"
  } catch (error: any) {
    console.log(`Error Getting User Subscriptions for ${chatId}`, error)
    return null
  }
}

export async function getUserSubscriptions(
  chatId: number
): Promise<string | null | { success: boolean; error: string }> {
  try {
    let user = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
      include: { subscribedTo: true },
    })
    if (user && user.subscribedTo?.length > 0) {
      const SubscriptionList =
        user.subscribedTo
          ?.map(
            (subscription: any, index: number) =>
              `${index + 1}. <b>${subscription.name
                .replace(/_/g, " ")
                .split(" ")
                .map(
                  (word: any) => word.charAt(0).toUpperCase() + word.slice(1)
                )
                .join(
                  " "
                )}</b>\n<b>Description:</b> <i>${subscription.description}\n</i>`
          )
          .join("\n") || ""
      return SubscriptionList
    } else {
      return "<b>No Subscription Found. Click Manage Subscriptions below to subscribe.</b>"
    }
  } catch (error) {
    console.log(`Error Getting Subscriptions for ${chatId}`, error)
    return { success: false, error: "Error Getting Subscriptions" }
  }
}

export async function getSubscriptionsWithUserStatus(
  chatId: number
): Promise<subscriptionType[] | null> {
  try {
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
  } catch (error) {
    console.log("Error getting Subscriptions with user status", chatId, error)
    return null
  }
}

export async function getAllSubscriptions(): Promise<
  subscriptionType[] | null
> {
  try {
    const allSubscriptions = await prisma.subscription.findMany()
    return allSubscriptions
  } catch (error) {
    console.log(`Error Getting All Subscriptions`, error)
    return null
  }
}

export async function addSubscriptionForUser(
  chatId: number,
  SubscriptionId: string
): Promise<userType | null> {
  try {
    const user = await getAccountInfo(chatId)
    const response = await prisma.user.update({
      where: { id: user?.id },
      data: { subscribedTo: { connect: { id: parseInt(SubscriptionId) } } },
    })
    return response
  } catch (error) {
    console.log(`Error Adding Subscriptions for user User ${chatId}`, error)
    return null
  }
}

export async function removeSubscriptionForUser(
  chatId: number,
  SubscriptionId: string
): Promise<userType | null> {
  try {
    const user = await getAccountInfo(chatId)
    if (!user) return null
    const response = await prisma.user.update({
      where: { id: user!.id },
      data: { subscribedTo: { disconnect: { id: parseInt(SubscriptionId) } } },
    })
    return response
  } catch (error) {
    console.log(`Error Removing Subscriptions for user User ${chatId}`, error)
    return null
  }
}

export async function getAirDrop(chatId: number): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
      include: { solanaAccount: true },
    })
    if (!user || !user.solanaAccount) return null
    if (!(await canRequestAirdrop(user.id))) {
      return "Already claimed"
    }
    const publicKey = user.solanaAccount.publicKey
    const result = await requestAirdrop(publicKey)
    return result
  } catch (error: any) {
    console.log("Error Airdropping Sol", chatId, error)
    return null
  }
}

export async function getSubscribers(
  alert_name: string
): Promise<{ chatId: bigint }[] | null> {
  try {
    // Fetch all users subscribed to this alert
    const subscribedUsers = await prisma.user.findMany({
      where: {
        subscribedTo: {
          some: {
            name: alert_name,
          },
        },
      },
      select: {
        chatId: true,
      },
    })
    return subscribedUsers
  } catch (error) {
    console.log(error)
    return null
  }
}

export async function getAccountsWithPublicKey(
  publicKey: string
): Promise<(userType & solanaAccType)[] | null> {
  try {
    const solanaAccounts = await prisma.solanaAcc.findMany({
      where: { publicKey },
      include: { user: true },
    })
    const accountsWithPublicKey = solanaAccounts.map(
      ({ user, ...solanaAccFields }) => ({
        ...user, // Spread the user fields
        ...solanaAccFields, // Spread the solanaAcc fields
      })
    )
    return accountsWithPublicKey
  } catch (error) {
    console.log(error)
    return null
  }
}
