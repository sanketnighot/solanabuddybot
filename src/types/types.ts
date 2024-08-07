export type userType = {
  id: number
  username: string
  chatId: bigint
  createdAt: Date
  updatedAt: Date
}

export type subscriptionType = {
  isSubscribed?: any
  id: number
  name: string
  description: string
  createdAt: Date
  updatedAt: Date
}

export type solanaAccType = {
  id: number
  userId: number
  publicKey: string
  privateKey: string
  createdAt: Date
  updatedAt: Date
}

export type tokenCreateData = {
  stage: string
  name: string
  symbol: string
  decimals: number
  supply: number
}
