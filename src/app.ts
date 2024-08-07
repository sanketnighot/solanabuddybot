import express from "express"
import cors from "cors"
import router from "./routes/routes"

const app = express()

app.use(cors())
app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))

app.get("/", (req, res) => {
  try {
    res.status(200).json({ message: "Connected to Solana Buddy Bot API" })
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error?.message || "Error connecting to server" })
  }
})

app.use("/api/v1", router)

export default app
