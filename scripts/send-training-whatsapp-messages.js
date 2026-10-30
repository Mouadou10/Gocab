const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.resolve(__dirname, "../dev.db");
const db = new Database(dbPath);

const keyRow = db.prepare("SELECT value FROM Setting WHERE key = 'whatsapp_360dialog_api_key'").get();
const key = keyRow?.value;
const d360Base = "https://waba-v2.360dialog.io";

const GOCAB_HQ_LOCATION = {
  latitude: 33.566063,
  longitude: -7.6362229,
  name: "GoCab Rent",
  address: "زنقة العربي الدغمي، عمارة 96، الطابق الأول، رقم 5، المعاريف",
  mapsUrl:
    "https://www.google.com/maps/place/33%C2%B033'57.8%22N+7%C2%B038'10.4%22W/@33.566063,-7.6387978,17z/data=!3m1!4b1!4m4!3m3!8m2!3d33.566063!4d-7.6362229?hl=en&entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D",
};

const GOCAB_RABAT_LOCATION = {
  latitude: 34.0253,
  longitude: -6.8496,
  name: "GoCab Rabat",
  address: "32 زنقة سيام، العمارة 32، حي المحيط، الرباط",
  mapsUrl: "https://maps.app.goo.gl/WaXbchnwMGhzC4kn6",
};

function normalizePhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("2120") && digits.length === 12) {
    digits = "212" + digits.slice(4);
  } else if (digits.startsWith("0") && digits.length === 10) {
    digits = "212" + digits.slice(1);
  } else if (digits.length === 9) {
    digits = "212" + digits;
  }
  return "+" + digits;
}

function resolveTemplate(city, reminderDate) {
  const isRabat = /rabat|kenitra/i.test(city || "");
  if (isRabat) {
    return {
      templateName: "rabat",
      location: GOCAB_RABAT_LOCATION,
      bodyText:
        "مرحباً ، نؤكد لكم موعد تكوينكم مع  على الساعة الثالثة و نصف زوالا. نحن متواجدون في 32 زنقة سيام، العمارة 32، حي المحيط، الرباط . إلى اللقاء قريباً\nhttps://maps.app.goo.gl/WaXbchnwMGhzC4kn6",
    };
  }

  // Casablanca / other
  if (reminderDate) {
    const d = new Date(reminderDate);
    // getUTCDay() === 5 is Friday
    if (!isNaN(d.getTime()) && (d.getUTCDay() === 5 || reminderDate.includes("2026-10-30") || reminderDate.includes("10/30/2026"))) {
      return {
        templateName: "vendredi",
        location: GOCAB_HQ_LOCATION,
        bodyText:
          "مرحباً، نؤكد لكم موعد تكوينكم مع GoCab يوم الجمعة على الساعة 11 صباحاً. يقع مكتبنا في: زنقة العربي الدغمي، عمارة 96، الطابق الأول، رقم 5، المعاريف، يمكنكم معرفة موقعنا عبر رابط غوغل مابس:",
      };
    }
  }

  return {
    templateName: "formation",
    location: GOCAB_HQ_LOCATION,
    bodyText:
      `نؤكد لكم موعد تكوينكم على الساعة 3 زوالا \nيقع مكتبنا في: زنقة العربي الدغمي، عمارة 96، الطابق الأول، رقم 5، المعاريف، يمكنكم معرفة موقعنا عبر رابط غوغل مابس: ${GOCAB_HQ_LOCATION.mapsUrl}\n إلى اللقاء قريباً`,
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendAll() {
  const leads = db.prepare(`
    SELECT id, raw_name, sanitized_phone, city, brand_status, reminder_date
    FROM Lead
    WHERE handled_by LIKE '%Kaoutar%'
      AND brand_status = 'Training fixed'
      AND status_changed_at >= '2026-10-29T00:00:00.000Z'
  `).all();

  console.log(`Found ${leads.length} Training Fixed leads to send WhatsApp messages to.`);

  let successCount = 0;
  let failCount = 0;
  const results = [];

  const updateMsgStmt = db.prepare(`
    UPDATE WhatsAppMessage
    SET wa_message_id = ?, status = 'DELIVERED'
    WHERE conversation_id = ?
  `);

  const findConvStmt = db.prepare(`
    SELECT id FROM WhatsAppConversation WHERE phone_number = ?
  `);

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const phone = normalizePhone(lead.sanitized_phone);
    const tpl = resolveTemplate(lead.city, lead.reminder_date);

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "template",
      template: {
        name: tpl.templateName,
        language: { code: "ar" },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "location",
                location: {
                  latitude: tpl.location.latitude,
                  longitude: tpl.location.longitude,
                  name: tpl.location.name,
                  address: tpl.location.address,
                },
              },
            ],
          },
        ],
      },
    };

    try {
      const res = await fetch(`${d360Base}/messages`, {
        method: "POST",
        headers: {
          "D360-API-KEY": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.messages && data.messages[0]) {
        const wamid = data.messages[0].id;
        successCount++;
        results.push({
          name: lead.raw_name,
          phone,
          city: lead.city,
          template: tpl.templateName,
          status: "SUCCESS",
          wamid,
        });

        // Update database message record with wamid
        const conv = findConvStmt.get(phone);
        if (conv) {
          updateMsgStmt.run(wamid, conv.id);
        }

        console.log(`[${i + 1}/${leads.length}] ✓ Sent to ${lead.raw_name} (${phone}) - Template: ${tpl.templateName} - ID: ${wamid}`);
      } else {
        failCount++;
        const errDetail = data?.errors ? JSON.stringify(data.errors) : JSON.stringify(data);
        results.push({
          name: lead.raw_name,
          phone,
          city: lead.city,
          template: tpl.templateName,
          status: "FAILED",
          error: errDetail,
        });
        console.warn(`[${i + 1}/${leads.length}] ✗ Failed to send to ${lead.raw_name} (${phone}):`, errDetail);
      }
    } catch (err) {
      failCount++;
      results.push({
        name: lead.raw_name,
        phone,
        city: lead.city,
        template: tpl.templateName,
        status: "ERROR",
        error: err.message,
      });
      console.error(`[${i + 1}/${leads.length}] Error sending to ${phone}:`, err.message);
    }

    // Rate-limiting pause (150ms)
    await sleep(150);
  }

  console.log("\n================ SUMMARY ================");
  console.log(`Total Leads: ${leads.length}`);
  console.log(`Successfully Sent: ${successCount}`);
  console.log(`Failed / Blocked: ${failCount}`);
  console.log("=========================================\n");

  db.close();
}

sendAll();
