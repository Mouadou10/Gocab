const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");

const dbPath = path.resolve(__dirname, "../dev.db");
const db = new Database(dbPath);

const NOW = new Date().toISOString();
const YESTERDAY = "2026-10-29T15:30:00.000Z";

const rawRows = [
  { name: "MOHAMMAD", phone: "212616567890", city: "Casablanca", status: "ALREADY A CLIENT", trainingFixed: "" },
  { name: "Abdenoure", phone: "212021280585", city: "Casablanca", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "Said", phone: "212060528780", city: "Casablanca", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "Ayman", phone: "212063379378", city: "Casablanca", status: "boite vocale", trainingFixed: "" },
  { name: "ياسين جلال", phone: "212031210495", city: "Rabat", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "Wassil", phone: "212070487787", city: "Other", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "Badara mbaye", phone: "212071883189", city: "Casablanca", status: "NO RESPONSE", trainingFixed: "" },
  { name: "Mouhcine dournany", phone: "212068001324", city: "Casablanca", status: "boite vocale", trainingFixed: "" },
  { name: "Abderrahmane afkiria", phone: "212618995857", city: "Casablanca", status: "NO RESPONSE", trainingFixed: "" },
  { name: "Amine", phone: "212070595302", city: "Casablanca", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "عبدالله الصنهاجي", phone: "212076276479", city: "Casablanca", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "Hassan el basrraoui", phone: "212601135699", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "Zakaria", phone: "212021278042", city: "Rabat", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "طريس", phone: "212070323551", city: "Rabat", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "Ayman", phone: "212061255883", city: "Rabat", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "Reda", phone: "212421707071", city: "Casablanca", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "Yassine Abrmallah", phone: "212603163445", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Youssef Youssef", phone: "212691652094", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "اسماعيل حيوش", phone: "212707773561", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "ياسين جلال", phone: "212612104950", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Badr eddine lriti", phone: "212670525257", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Nabil Essathi", phone: "212700448924", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "Bouabbadi amine", phone: "212691980538", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "Said", phone: "212679164380", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "Hammouca kamal", phone: "212671111159", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "Adil hamri", phone: "212720025699", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "Manal najari", phone: "212608777052", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "Mehdi chatbi", phone: "212698722306", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "Sabri", phone: "212644747949", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "SABRI اشرف", phone: "212641916477", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "Mohammed el ayachi", phone: "+212776415725", city: "Other", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "Mohamed iffer", phone: "212631074377", city: "Casablanca", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "said bani", phone: "610631677", city: "kenitra", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Othmane khalouki", phone: "212761679823", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "Mohamed najari", phone: "+212664280792", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "Ayoub kherbech", phone: "212070233832", city: "Casablanca", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "anwar", phone: "212070852000", city: "Casablanca", status: "not interested", trainingFixed: "" },
  { name: "wael", phone: "212021277850", city: "Casablanca", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "Hicham elkhanchouf", phone: "+212771435512", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Ammoura Marouane", phone: "+212677750278", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/30/2026" },
  { name: "chamseddine zghari", phone: "+212653730491", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "ABDELHADI NAFIE", phone: "660120208", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/30/2026" },
  { name: "Hicham", phone: "212664398852", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/30/2026" },
  { name: "Mehdi Mohamed", phone: "212630460849", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Zakaria Tahi", phone: "212657175751", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/30/2026" },
  { name: "Younes", phone: "212710518966", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/30/2026" },
  { name: "Oussama", phone: "212649898503", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/30/2026" },
  { name: "Adil zeggar", phone: "212613248948", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "ADNAN", phone: "212 634-793110", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "11/2/2026" },
  { name: "Salah eddine jourroua", phone: "212601699189", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "Redouan", phone: "212633485217", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Youssef", phone: "212683344483", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/29/2026" },
  { name: "anas sadraoui", phone: "212777332458", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Hamza", phone: "212071713894", city: "Casablanca", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "aymen nafia", phone: "634685753", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/30/2026" },
  { name: "Mohammed boufioux", phone: "212631982104", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/30/2026" },
  { name: "Lhoucine", phone: "212623072392", city: "Rabat", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "Achraf NAKHALI", phone: "212674368538", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "11/2/2026" },
  { name: "Ibrahime EL FERRASSY", phone: "212669930752", city: "Casablanca", status: "NO RESPONSE", trainingFixed: "" },
  { name: "TARIQ FADI", phone: "212681997299", city: "RABAT", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Ayoub Chajari", phone: "212623013309", city: "Rabat", status: "not interested", trainingFixed: "" },
  { name: "ABDELKARIM", phone: "212683451545", city: "Autre", status: "NO RESPONSE", trainingFixed: "" },
  { name: "Hafik", phone: "212676971082", city: "Casablanca", status: "NO RESPONSE", trainingFixed: "" },
  { name: "ABD ALLAH ESSAMI", phone: "212632773823", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/30/2026" },
  { name: "Rihab", phone: "212674362377", city: "Autre", status: "not interested", trainingFixed: "" },
  { name: "Mohammed", phone: "212679243842", city: "Rabat", status: "NO RESPONSE", trainingFixed: "" },
  { name: "Khalil", phone: "212773516301", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Hicham Felaouxx", phone: "212602709364", city: "Other", status: "NO RESPONSE", trainingFixed: "" },
  { name: "KHIDACH", phone: "212675945228", city: "Casablanca", status: "not interested", trainingFixed: "" },
  { name: "Khalid", phone: "212601643712", city: "Casablanca", status: "not interested", trainingFixed: "" },
  { name: "Lahcen bouchouireb", phone: "212602799254", city: "Casablanca", status: "NO RESPONSE", trainingFixed: "" },
  { name: "OUSSAMA EL HOUSSNI", phone: "212650448213", city: "Rabat", status: "not interested", trainingFixed: "" },
  { name: "Abderrahmane afkiria", phone: "212618995857", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/30/2026" },
  { name: "Mohamed el gharbaoui", phone: "212711463917", city: "Autre", status: "not interested", trainingFixed: "" },
  { name: "Aissam Elouafy", phone: "212674824167", city: "Casablanca", status: "NO RESPONSE", trainingFixed: "" },
  { name: "Mohamed", phone: "212687827856", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Mohamed Chaoui", phone: "212719656410", city: "Casablanca", status: "already client/paid", trainingFixed: "DEJA CLIENT" },
  { name: "Mehdi moussaid", phone: "212620745575", city: "Autre", status: "not interested", trainingFixed: "" },
  { name: "Ahmed", phone: "212657771868", city: "Rabat", status: "NO RESPONSE", trainingFixed: "" },
  { name: "Yassine Bachar", phone: "212633070125", city: "Casablanca", status: "NO RESPONSE", trainingFixed: "" },
  { name: "jawad", phone: "212694974437", city: "Casablanca", status: "not interested", trainingFixed: "" },
  { name: "yona", phone: "212694974437", city: "Casablanca", status: "not interested", trainingFixed: "" },
  { name: "Soufiane", phone: "212619147973", city: "Rabat", status: "not interested", trainingFixed: "" },
  { name: "Achraf ahizoune", phone: "212685689479", city: "Autre", status: "boite vocale", trainingFixed: "" },
  { name: "Houcine", phone: "212682529903", city: "Rabat", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "عادل", phone: "212645101543", city: "Rabat", status: "not interested", trainingFixed: "" },
  { name: "Mehdi errajui", phone: "212719811954", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Ammady Abderrazake", phone: "212261284770", city: "Casablanca", status: "WRONG NUMBER", trainingFixed: "" },
  { name: "EL HADDAOUI AYOUB", phone: "212707020995", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Zahnine Abderrazak", phone: "212714509545", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/30/2026" },
  { name: "Hamza elmaslah", phone: "212676049222", city: "Rabat", status: "TRAINING FIXED", trainingFixed: "11/10/2026" },
  { name: "Abdelmoghit", phone: "212700448710", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "11/2/2026" },
  { name: "Youssef mahri", phone: "212707398250", city: "Casablanca", status: "TRAINING FIXED", trainingFixed: "10/30/2026" }
];

function cleanPhone(raw) {
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("2120") && d.length === 12) {
    d = "212" + d.slice(4);
  } else if (d.startsWith("212") && d.length === 11) {
    // standard
  } else if (d.startsWith("0") && d.length === 10) {
    d = "212" + d.slice(1);
  } else if (d.length === 9) {
    d = "212" + d;
  }
  return "+" + d;
}

function parseTrainingDate(dateStr) {
  if (!dateStr || dateStr === "DEJA CLIENT") return null;
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    let m = parseInt(parts[0], 10);
    let d = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    // If m > 12, swap m and d
    if (m > 12) {
      const temp = m;
      m = d;
      d = temp;
    }
    const mStr = String(m).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    return `${y}-${mStr}-${dStr}T15:00:00.000Z`;
  }
  return null;
}

const GOCAB_MAPS_URL =
  "https://www.google.com/maps/place/33%C2%B033'57.8%22N+7%C2%B038'10.4%22W/@33.566063,-7.6387978,17z/data=!3m1!4b1!4m4!3m3!8m2!3d33.566063!4d-7.6362229?hl=en&entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D";

function getWhatsAppMessage(city, trainingDateStr) {
  const isCasa = /casa/i.test(city || "");
  const isRabat = /rabat|kenitra/i.test(city || "");

  if (isCasa) {
    // Check if Friday (Oct 30, 2026 is Friday!)
    if (trainingDateStr && (trainingDateStr.includes("10/30/2026") || trainingDateStr.includes("2026-10-30"))) {
      return {
        template: "vendredi",
        text: `مرحباً، نؤكد لكم موعد تكوينكم مع GoCab يوم الجمعة على الساعة 11 صباحاً. يقع مكتبنا في: زنقة العربي الدغمي، عمارة 96، الطابق الأول، رقم 5، المعاريف، يمكنكم معرفة موقعنا عبر رابط غوغل مابس: ${GOCAB_MAPS_URL}\n إلى اللقاء قريباً`
      };
    }
    return {
      template: "formation",
      text: `نؤكد لكم موعد تكوينكم على الساعة 3 زوالا \nيقع مكتبنا في: زنقة العربي الدغمي، عمارة 96، الطابق الأول، رقم 5، المعاريف، يمكنكم معرفة موقعنا عبر رابط غوغل مابس: ${GOCAB_MAPS_URL}\n إلى اللقاء قريباً`
    };
  }

  if (isRabat) {
    return {
      template: "formation_rabat",
      text: "مرحباً، نؤكد لكم موعد تكوينكم مع GoCab بمدينة الرباط المقررة يوم الثلاثاء 10 نونبر على الساعة 11 صباحاً. سيتم إرسال العنوان ورابط الموقع لتأكيد الحضور. إلى اللقاء قريباً"
    };
  }

  // Fallback
  return {
    template: "formation",
    text: `نؤكد لكم موعد تكوينكم مع GoCab. يقع مكتبنا في: زنقة العربي الدغمي، عمارة 96، الطابق الأول، رقم 5، المعاريف، يمكنكم معرفة موقعنا عبر رابط غوغل مابس: ${GOCAB_MAPS_URL}\n إلى اللقاء قريباً`
  };
}

console.log(`Starting import of ${rawRows.length} leads treated by Kaoutar Ouardi...`);

let createdCount = 0;
let updatedCount = 0;
let callsCount = 0;
let trainingFixedCount = 0;
let whatsappMessagesCount = 0;

// Prepare statements
const findLeadByPhone = db.prepare("SELECT * FROM Lead WHERE sanitized_phone = ?");
const findLeadByPhoneLike = db.prepare("SELECT * FROM Lead WHERE sanitized_phone LIKE ?");

const insertLead = db.prepare(`
  INSERT INTO Lead (
    id, raw_name, sanitized_phone, city, handled_by, campaign_source,
    board_column, brand_status, training_status, reminder_date,
    status_changed_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateLead = db.prepare(`
  UPDATE Lead
  SET raw_name = ?,
      city = ?,
      handled_by = 'Kaoutar Ouardi',
      board_column = ?,
      brand_status = ?,
      training_status = ?,
      reminder_date = ?,
      status_changed_at = ?,
      updated_at = ?
  WHERE id = ?
`);

const insertActivity = db.prepare(`
  INSERT INTO LeadActivityLog (id, lead_id, agent, action, detail, created_at)
  VALUES (?, ?, 'Kaoutar Ouardi', ?, ?, ?)
`);

// WhatsApp tables ensure
db.exec(`
  CREATE TABLE IF NOT EXISTS "WhatsAppConversation" (
    "id" TEXT PRIMARY KEY,
    "phone_number" TEXT UNIQUE NOT NULL,
    "lead_id" TEXT,
    "driver_id" TEXT,
    "unread_count" INTEGER DEFAULT 0,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
    "id" TEXT PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "text" TEXT,
    "media_url" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
  );
`);

const findConv = db.prepare("SELECT id FROM WhatsAppConversation WHERE phone_number = ?");
const insertConv = db.prepare(`
  INSERT INTO WhatsAppConversation (
    id, phone_number, contact_name, lead_id, contact_type, workflow_state,
    routed_department, last_message, last_message_at, unread_count, is_pinned, is_archived,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, 'LEAD', 'TRAINING_INVITED', 'TRAINING', ?, ?, 0, 0, 0, ?, ?)
`);
const updateConvLastMsg = db.prepare(`
  UPDATE WhatsAppConversation
  SET last_message = ?, last_message_at = ?, updated_at = ?
  WHERE id = ?
`);
const insertMsg = db.prepare(`
  INSERT INTO WhatsAppMessage (id, conversation_id, direction, sender_type, sender_name, text, status, created_at)
  VALUES (?, ?, 'OUTBOUND', 'AGENT', 'Kaoutar Ouardi', ?, 'DELIVERED', ?)
`);

const tx = db.transaction(() => {
  for (const item of rawRows) {
    const cleanP = cleanPhone(item.phone);
    const last9 = cleanP.slice(-9);

    let existing = findLeadByPhone.get(cleanP);
    if (!existing) {
      existing = findLeadByPhoneLike.get(`%${last9}`);
    }

    // Determine target board column and brand/training statuses
    let boardColumn = "BRAND_PRE_FILTER";
    let brandStatus = "No response 1";
    let trainingStatus = null;
    let reminderDate = null;

    const normStatus = item.status.trim().toUpperCase();

    if (normStatus === "TRAINING FIXED") {
      boardColumn = "TRAINING_PIPELINE";
      brandStatus = "Training fixed";
      trainingStatus = "Scheduled";
      reminderDate = parseTrainingDate(item.trainingFixed);
      trainingFixedCount++;
    } else if (normStatus.includes("ALREADY") || normStatus.includes("DEJA")) {
      boardColumn = "BRAND_PRE_FILTER";
      brandStatus = "Already a client";
    } else if (normStatus.includes("WRONG")) {
      boardColumn = "BRAND_PRE_FILTER";
      brandStatus = "Wrong number";
    } else if (normStatus.includes("NOT") || normStatus.includes("INTERESTED")) {
      boardColumn = "BRAND_PRE_FILTER";
      brandStatus = "Not interested";
    } else {
      boardColumn = "BRAND_PRE_FILTER";
      brandStatus = "No response 1";
    }

    let leadId = null;

    if (existing) {
      leadId = existing.id;
      updateLead.run(
        item.name || existing.raw_name,
        item.city || existing.city || "Casablanca",
        boardColumn,
        brandStatus,
        trainingStatus,
        reminderDate,
        YESTERDAY,
        NOW,
        existing.id
      );
      updatedCount++;
    } else {
      leadId = crypto.randomUUID();
      insertLead.run(
        leadId,
        item.name,
        cleanP,
        item.city || "Casablanca",
        "Kaoutar Ouardi",
        "GOOGLE_SHEET_IMPORT",
        boardColumn,
        brandStatus,
        trainingStatus,
        reminderDate,
        YESTERDAY,
        YESTERDAY,
        NOW
      );
      createdCount++;
    }

    // Log call treated yesterday by Kaoutar Ouardi
    const existingCall = db.prepare(`
      SELECT id FROM LeadActivityLog
      WHERE lead_id = ? AND action = 'CALL_INITIATED' AND agent LIKE '%Kaoutar%' AND created_at >= '2026-10-29T00:00:00.000Z'
    `).get(leadId);

    if (!existingCall) {
      insertActivity.run(
        crypto.randomUUID(),
        leadId,
        "CALL_INITIATED",
        `Appel prospection Leads - Statut: ${brandStatus} (+1 Appel Comptabilisé pour Kaoutar Ouardi)`,
        YESTERDAY
      );
      callsCount++;
    }

    // If training is fixed, send WhatsApp template message (Casablanca vendredi vs formation, or Rabat)
    if (normStatus === "TRAINING FIXED") {
      const wa = getWhatsAppMessage(item.city, item.trainingFixed);
      let conv = findConv.get(cleanP);
      let convId = conv ? conv.id : null;
      if (!convId) {
        convId = crypto.randomUUID();
        insertConv.run(convId, cleanP, item.name || "Lead", leadId, wa.text, YESTERDAY, YESTERDAY, NOW);
      } else {
        updateConvLastMsg.run(wa.text, YESTERDAY, NOW, convId);
      }

      const msgId = crypto.randomUUID();
      insertMsg.run(msgId, convId, wa.text, YESTERDAY);
      whatsappMessagesCount++;

      insertActivity.run(
        crypto.randomUUID(),
        leadId,
        "WHATSAPP_SENT",
        `Convocation WhatsApp envoyée (${wa.template}): ${wa.text.slice(0, 60)}...`,
        YESTERDAY
      );
    }
  }

  // Update sync state
  const syncSetting = db.prepare("SELECT value FROM Setting WHERE key = 'data_sync_state'").get();
  if (syncSetting) {
    try {
      const parsed = JSON.parse(syncSetting.value);
      parsed.leads = Date.now();
      parsed.tickets = Date.now();
      parsed.updatedAt = Date.now();
      db.prepare("UPDATE Setting SET value = ? WHERE key = 'data_sync_state'").run(JSON.stringify(parsed));
    } catch (e) {}
  }
});

tx();

console.log("=== Import Summary ===");
console.log(`Total Leads Processed: ${rawRows.length}`);
console.log(`Newly Created Leads: ${createdCount}`);
console.log(`Updated Existing Leads: ${updatedCount}`);
console.log(`Training Fixed Leads Scheduled: ${trainingFixedCount}`);
console.log(`Calls Counted for Kaoutar Ouardi: ${callsCount}`);
console.log(`WhatsApp Invitation Messages Generated: ${whatsappMessagesCount}`);

db.close();
