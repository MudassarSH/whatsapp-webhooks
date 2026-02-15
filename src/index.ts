import express from "express";
import dotenv from "dotenv";
import { PRIVACY_POLICIES } from "./components/privacy-policy";
dotenv.config();
const app = express()
app.use(express.json())
const port = process.env.PORT
const token = process.env.WEBHOOK_VERIFY_TOKEN


function pick(obj: any, keys: any) {
  const out = {} as any;
  for (const k of keys) {
    if (obj?.[k] !== undefined) {
      out[k] = obj[k]
    }
  }
}

function logJson(label: string, data: any) {
  console.log(`\n======== ${label} ========`);
  console.log(JSON.stringify(data, null, 2))
}

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
  res.sendStatus(200);

  const entry = req.body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  if (!value) {
    logJson("WEBHOOK RAW (NO VALUE)", req.body);
    return;
  }

  // Meta metadata (phone_number_id etc.)
  const meta = value.metadata || {};
  const metaSummary = pick(meta, ["display_phone_number", "phone_number_id"]);
  logJson("FULL VALUE", value);
  logJson("META", metaSummary);

  // 1) Incoming user messages (user -> you)
  if (Array.isArray(value.messages)) {
    for (const m of value.messages) {
      const msgSummary = {
        id: m.id,
        from: m.from,
        timestamp: m.timestamp,
        type: m.type,
        text: m.text?.body,
        // For media you’ll see these:
        image: m.image ? pick(m.image, ["id", "mime_type", "sha256", "caption"]) : undefined,
        audio: m.audio ? pick(m.audio, ["id", "mime_type", "sha256"]) : undefined,
        document: m.document ? pick(m.document, ["id", "mime_type", "sha256", "filename"]) : undefined,
        interactive: m.interactive ? pick(m.interactive, ["type"]) : undefined,
        referral: m.referral ? pick(m.referral, ["source_url", "source_type", "source_id"]) : undefined,
        context: m.context ? pick(m.context, ["from", "id"]) : undefined, // replies/quoted message
      };

      logJson("INCOMING MESSAGE (SUMMARY)", msgSummary);
      // If you want full raw for schema building, enable this temporarily:
      // logJson("INCOMING MESSAGE (RAW)", m);
    }
  }

  // 2) Delivery/read/failed status updates (you -> user)
  if (Array.isArray(value.statuses)) {
    for (const s of value.statuses) {
      const statusSummary = {
        id: s.id, // wamid
        recipient_id: s.recipient_id,
        status: s.status, // sent/delivered/read/failed
        timestamp: s.timestamp,
        conversation: s.conversation
          ? pick(s.conversation, ["id", "origin"])
          : undefined,
        pricing: s.pricing
          ? pick(s.pricing, ["billable", "pricing_model", "category"])
          : undefined,
        errors: s.errors || undefined,
      };

      logJson("STATUS UPDATE (SUMMARY)", statusSummary);
      // Temporary raw:
      // logJson("STATUS UPDATE (RAW)", s);
    }
  }

  // 3) Contacts array (sometimes present)
  if (Array.isArray(value.contacts)) {
    for (const c of value.contacts) {
      const contactSummary = {
        wa_id: c.wa_id,
        profile_name: c.profile?.name,
      };
      logJson("CONTACT (SUMMARY)", contactSummary);
    }
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