import { Router } from "express"
import {
  healthCheck,
  sendWhaleAlerts,
  sentTransactionAlertForAddress,
  testBot,
} from "../controllers/bot.controller"

const router = Router()

router.route("/healthcheck").get(healthCheck)
router.route("/test").post(testBot)
router.route("/sendWhaleAlerts").post(sendWhaleAlerts)
router.route("/addressAlert").post(sentTransactionAlertForAddress)

export default router
