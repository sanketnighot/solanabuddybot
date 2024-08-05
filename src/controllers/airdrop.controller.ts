import { PrismaClient } from "@prisma/client"
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"

const prisma = new PrismaClient()

export async function canRequestAirdrop(userId: number): Promise<boolean> {
  const lastAirdrop = await prisma.airdropRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })

  if (!lastAirdrop) {
    return true
  }

  const now = new Date()
  const timeSinceLastAirdrop = now.getTime() - lastAirdrop.createdAt.getTime()
  const oneHourInMs = 60 * 60 * 1000

  return timeSinceLastAirdrop >= oneHourInMs
}

export async function recordAirdropRequest(userId: number): Promise<void> {
  await prisma.airdropRequest.create({
    data: { userId },
  })
}

export async function requestAirdrop(
  publicKey: string,
  amount: number = 1
): Promise<string> {
  try {
    const connection = new Connection(
      "https://api.devnet.solana.com",
      "confirmed"
    )
    const publicKeyObj = new PublicKey(publicKey)

    const signature = await connection.requestAirdrop(
      publicKeyObj,
      amount * LAMPORTS_PER_SOL
    )
    await connection.confirmTransaction(signature)

    return `Airdrop of ${amount} SOL to ${publicKey} successful!`
  } catch (error) {
    console.error("Airdrop error:", error)
    return "Airdrop Failed"
  }
}

export async function getBalance(publicKey: string): Promise<number> {
  try {
    const connection = new Connection(
      "https://api.devnet.solana.com",
      "confirmed"
    )
    const publicKeyObj = new PublicKey(publicKey)
    const balance = await connection.getBalance(publicKeyObj)
    return balance / LAMPORTS_PER_SOL // Convert lamports to SOL
  } catch (error) {
    console.error("Get balance error:", error)
    throw error
  }
}
