import { PrismaClient } from "@prisma/client"
import {
  createMint,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  transfer,
} from "@solana/spl-token"
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js"
import bs58 from "bs58"
import { TokenCreationState, TokenTransferState } from "../index"

const prisma = new PrismaClient()
const rpcUrl = process.env.SOLANA_RPC || ""
const OWNER_ADDRESS = process.env.OWNER_ADDRESS || ""
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || ""

if (rpcUrl === "") {
  throw new Error("SOLANA_RPC environment variable is not set")
}

export async function generateKeypair(): Promise<{
  publicKey?: string
  privateKey?: string
  success: boolean
  error?: string
}> {
  try {
    const keypair = await Keypair.generate()
    const publicKey = await keypair.publicKey.toString()
    const privateKey = await bs58.encode(keypair.secretKey)
    return { publicKey, privateKey, success: true }
  } catch (error) {
    console.log("An Error Occured while generating Keypair: ", error)
    return { success: false, error: "Error generating Keypair" }
  }
}

export async function transferSOL(
  fromAddress: string,
  toAddress: string,
  amount: number
) {
  const connection = new Connection(rpcUrl, "confirmed")
  try {
    let fromKeypair: Keypair
    if (fromAddress === process.env.OWNER_ADDRESS) {
      // Assuming OWNER_PRIVATE_KEY is stored as a base58 encoded string
      const privateKey = bs58.decode(process.env.OWNER_PRIVATE_KEY)
      fromKeypair = Keypair.fromSecretKey(privateKey)
    } else {
      const user = await prisma.user.findUnique({
        where: { chatId: BigInt(fromAddress) },
        include: { solanaAccount: true },
      })
      if (!user || !user.solanaAccount) {
        throw new Error("User not found or has no Solana account")
      }
      // Assuming the private key in the database is stored as a base58 encoded string
      const privateKey = bs58.decode(user.solanaAccount.privateKey)
      fromKeypair = Keypair.fromSecretKey(privateKey)
    }

    const toPublicKey = new PublicKey(toAddress)

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: Math.round(amount * 1000000000), // Convert SOL to lamports, ensuring it's an integer
      })
    )
    const signature = await connection.sendTransaction(transaction, [
      fromKeypair,
    ])
    await connection.confirmTransaction(signature)

    return {
      success: true,
      signature: signature,
    }
  } catch (error: any) {
    console.error("Error in SOL transfer:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

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
    const connection = new Connection(rpcUrl, "confirmed")
    const publicKeyObj = new PublicKey(publicKey)

    const signature = await connection.requestAirdrop(
      publicKeyObj,
      amount * LAMPORTS_PER_SOL
    )
    await connection.confirmTransaction(signature)

    return `💸 Airdrop of <b>${amount} $SOL</b> to <code>${publicKey}</code> successful!`
  } catch (error) {
    console.error("Airdrop error:", error)
    return "❌ Airdrop Failed. \n\nProbably due to rate limiting. \nTry again after some time"
  }
}

export async function getBalance(publicKey: string): Promise<number> {
  try {
    const connection = new Connection(rpcUrl, "confirmed")
    const publicKeyObj = new PublicKey(publicKey)
    const balance = await connection.getBalance(publicKeyObj)
    return balance / LAMPORTS_PER_SOL // Convert lamports to SOL
  } catch (error) {
    console.error("Get balance error:", error)
    throw error
  }
}

export async function getTokenBalance(publicKey: string) {
  try {
    const connection = new Connection(rpcUrl, "confirmed")
    const pubKey = new PublicKey(publicKey)
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubKey,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    )

    const balances = tokenAccounts.value
      .map((accountInfo) => {
        const parsedInfo = accountInfo.account.data.parsed.info
        return {
          mint: parsedInfo.mint,
          balance: parsedInfo.tokenAmount.uiAmount.toFixed(4),
          decimals: parsedInfo.tokenAmount.decimals,
        }
      })
      .filter((token) => token.balance > 0)

    return { totalTokens: balances.length, balances }
  } catch (error) {
    console.log("Error fetcing Token balance", publicKey, error)
    return null
  }
}

export async function sendSol(
  chatId: number,
  toPublicKey: string,
  amount: number
) {
  try {
    const user = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
      include: { solanaAccount: true },
    })

    if (!user || !user.solanaAccount) {
      return null
    }

    const fromPublicKey = user.solanaAccount.publicKey
    const result = await transferSOL(fromPublicKey, toPublicKey, amount)
    return result
  } catch (error) {
    console.log("Error Sending SOL", chatId, error)
    return null
  }
}

export async function createToken(
  chatId: number,
  tokenData: TokenCreationState
) {
  try {
    if (!tokenData || tokenData === undefined) return null
    const user = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
      include: { solanaAccount: true },
    })

    if (!user || !user.solanaAccount) {
      return null
    }

    const connection = new Connection(rpcUrl, "confirmed")
    const fromPrivateKey = bs58.decode(user.solanaAccount.privateKey)
    const fromKeypair = Keypair.fromSecretKey(fromPrivateKey)

    // Create the token mint
    const mint = await createMint(
      connection,
      fromKeypair,
      fromKeypair.publicKey,
      fromKeypair.publicKey,
      tokenData?.decimals!
    )

    // Get the token account of the fromWallet address, and if it does not exist, create it
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      fromKeypair,
      mint,
      fromKeypair.publicKey
    )

    // Mint tokens to the from account
    await mintTo(
      connection,
      fromKeypair,
      mint,
      fromTokenAccount.address,
      fromKeypair.publicKey,
      tokenData.supply! * Math.pow(10, tokenData.decimals!)
    )

    return {
      name: tokenData.name,
      symbol: tokenData.symbol,
      decimals: tokenData.decimals,
      supply: tokenData.supply,
      mintAddress: mint.toBase58(),
      ownerId: user.id,
      tokenAccount: fromTokenAccount.address.toBase58(),
      success: true,
    }
  } catch (error: any) {
    console.log("Error Creating Token", chatId, error)
    return { success: false, error: error.message || "Error Creating Token" }
  }
}

export async function sendToken(
  chatId: number,
  transferInfo: TokenTransferState
) {
  try {
    const user = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
      include: { solanaAccount: true },
    })

    if (!user || !user.solanaAccount) {
      return
    }
    if (!transferInfo) return

    const connection = new Connection(rpcUrl, "confirmed")
    const fromPrivateKey = bs58.decode(user.solanaAccount.privateKey)
    const fromKeypair = Keypair.fromSecretKey(fromPrivateKey)

    const mintPublicKey = new PublicKey(transferInfo.mintAddress!)
    const recipientPublicKey = new PublicKey(transferInfo.recipientAddress!)

    // Get the token account of the fromWallet address, and if it does not exist, create it
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      fromKeypair,
      mintPublicKey,
      fromKeypair.publicKey
    )

    // Get the token account of the toWallet address, and if it does not exist, create it
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      fromKeypair,
      mintPublicKey,
      recipientPublicKey
    )

    // Get the token account info to find out the number of decimals
    const tokenAccountInfo = await getAccount(
      connection,
      fromTokenAccount.address
    )
    const mintInfo = await getMint(connection, mintPublicKey)
    const decimals = mintInfo.decimals

    // Perform the transfer
    const signature = await transfer(
      connection,
      fromKeypair,
      fromTokenAccount.address,
      toTokenAccount.address,
      fromKeypair.publicKey,
      transferInfo.amount! * Math.pow(10, decimals)
    )

    return {
      success: true,
      signature: signature,
    }
  } catch (error) {
    console.log("Error Sending Token", chatId, error)
    return {
      success: false,
    }
  }
}
