import { Keypair } from "@solana/web3.js"
import bs58 from "bs58"

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
