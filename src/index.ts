import express from "express";
import dotenv from "dotenv";
import { PRIVACY_POLICIES } from "./components/privacy-policy";
dotenv.config();
const app = express()
app.use(express.json())
const port = process.env.PORT
const token = process.env.WEBHOOK_VERIFY_TOKEN

app.get('/webhooks', (req, res) => {
  const mode = req.query["hub.mode"]
  const verifyToken = req.query["hub.verify_token"]
  const challenge = req.query["hub.challenge"]
  if (mode === "subscribe" && verifyToken === token) {
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

app.post("/webhooks", (req, res) => {
  res.sendStatus(200)
  console.log("Webhook event:", JSON.stringify(req.body, null, 2));
  const value = req.body.entry?.[0]?.changes?.[0]?.value;

  if (!value) return;

  // Incoming message
  if (value.messages) {
    console.log("Incoming message:", value.messages);
  }

  // Delivery status update
  if (value?.statuses) {
    console.log("Message status update:");
    console.log(JSON.stringify(value.statuses, null, 2));
  }
});

app.get("/privacy-policy", (req, res) => {
  res.send(PRIVACY_POLICIES)
})
app.get("/", (req, res) => {
  res.send("Hello world!")
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})