import express from "express";
import dotenv from "dotenv";
import { PRIVACY_POLICIES, TERMS_CONDITIONS } from "./components/privacy-policy";
import { prismaDb } from "./lib/db";
import { MessageDirection, MessageStatus, MessageType } from "./lib/generated/prisma";
dotenv.config();
const app = express()
app.use(express.json())
const port = process.env.PORT
const token = process.env.WEBHOOK_VERIFY_TOKEN


function pick(obj: any, keys: any) {
  const out: any = {};
  for (const k of keys) {
    if (obj?.[k] !== undefined) {
      out[k] = obj[k]
    }
  }
  return out;
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

app.post("/webhooks", async (req, res) => {
  res.sendStatus(200);
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) {
      logJson("WEBHOOK RAW (NO VALUE)", req.body);
      return;
    }

    // Meta metadata (phone_number_id etc.)
    const meta = value.metadata || {};
    const phoneNumberId = meta.phone_number_id;
    const disaplyNumber = meta.display_phone_number;

    const metaSummary = pick(meta, ["display_phone_number", "phone_number_id"]);
    logJson("FULL VALUE", value);
    logJson("META", metaSummary);

    // 1) Incoming user messages (user -> you)
    if (Array.isArray(value.messages)) {
      for (const m of value.messages) {
        const waId = m.from;
        const wamId = m.id;
        const ts = Number(m.timestamp);
        const tsAt = Number.isFinite(ts) ? new Date(ts * 1000) : null;
        const contactUpdate = await prismaDb.contact.upsert({
          where: {
            waId: waId
          },
          update: {
            profileName: value.contacts[0].profile.name,
            lastInboundAt: tsAt,
            lastMessageAt: tsAt
          },
          create: {
            waId,
            profileName: value.contacts[0].profile.name,
            lastInboundAt: tsAt,
            lastMessageAt: tsAt
          }
        });
        console.log("Contact Update push is: ", contactUpdate);

        const valueMessageUpdate = await prismaDb.message.upsert({
          where: {
            wamId: wamId
          },
          update: {},
          create: {
            wamId,
            contactId: waId,
            messageDirection: MessageDirection.INBOUND,
            messageType: (m.type as MessageType) ?? MessageType.unknown,
            message: m.text.body ?? null,
            timeStampAt: tsAt,
            currentStatus: MessageStatus.accepted,
            currentStatusAt: new Date()
          }
        })
        console.log("Value Message Update push is: ", valueMessageUpdate);
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
        const wamId = s.id;
        const statusEnum = s.status as MessageStatus;
        const ts = Number(s.timestamp);
        const tsAt = Number.isFinite(ts) ? new Date(ts * 1000) : null;
        const recipientId = s.recipient_id ?? null;
        const messageUpsert = await prismaDb.message.upsert({
          where: {
            wamId
          },
          update: {
            currentStatus: statusEnum,
            currentStatusAt: tsAt
          },
          create: {
            wamId,
            contactId: recipientId ?? "unknown",
            messageDirection: MessageDirection.OUTBOUND,
            messageType: MessageType.unknown,
            message: null,
            timeStampAt: tsAt,
            currentStatus: statusEnum,
            currentStatusAt: tsAt
          }
        })
        console.log("FIRST MESSAGE UPSERT IN STATUSES IS: ", messageUpsert);

        if (recipientId) {
          const contactUpsert = await prismaDb.contact.upsert({
            where: {
              waId: recipientId
            },
            update: {
              lastMessageAt: tsAt
            },
            create: {
              waId: recipientId,
              phoneNumber: recipientId,
              lastMessageAt: tsAt
            }
          })
          console.log("CONTACT UPSERT AFTER MESSAGE UPSER IN STATUSES IS: ", contactUpsert);

          const messageUpdate = await prismaDb.message.update({
            where: {
              wamId
            },
            data: {
              contactId: recipientId
            }
          })
          console.log("MESSAGE Update IN STATUSES IS: ", contactUpsert);
        }
        const statusDBPUsh = await prismaDb.status.create({
          data: {
            wamId,
            status: statusEnum,
            timeStamp: tsAt!,
            recipientId: recipientId
          }
        }).catch((e) => {
          // Ignore duplicates due to @@unique (Prisma P2002)
          if (e?.code !== "P2002") throw e;
        });

        console.log("StatusDB push is: ", statusDBPUsh);

        // const statusUpdateMessage = await prismaDb.message.update({
        //   where: {
        //     wamId
        //   },
        //   data: {
        //     currentStatus: statusEnum,
        //     currentStatusAt: tsAt
        //   }
        // })
        // console.log("Status Update Message push is: ", statusUpdateMessage);
        if (statusEnum === MessageStatus.failed && Array.isArray(s.errors) && s.errors.length) {
          const err = s.errors[0];

          await prismaDb.messageError.create({
            data: {
              messageId: wamId,
              errorCode: err.code ?? 0,
              ErrorTitle: err.title ?? null,
              lastErrorDetails: err.error_deta.details ?? err.message ?? null
            }
          })
        }
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
  } catch (err) {
    console.error("Webhook DB error:", err);
  }
});


app.get("/privacy-policy", (req, res) => {
  res.send(PRIVACY_POLICIES)
})
app.get("/terms", (req, res) => {
  res.send(TERMS_CONDITIONS)
})
app.get("/", (req, res) => {
  res.send("Hello world!")
})

async function testConnection() {
  try {
    await prismaDb.$connect();
    console.log('✅ Successfully connected to PostgreSQL database');
  } catch (error) {
    console.error('❌ Error connecting to database:', error);
  }
}


app.listen(port, () => {
  testConnection();
  console.log(`Example app listening on port http://localhost:${port}`)
})