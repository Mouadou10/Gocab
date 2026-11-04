import { v4 as uuidv4 } from "uuid";
import { prisma } from "../src/lib/prisma";
import { touchSyncState } from "../src/lib/sync";
import { invalidateLeadsCache } from "../src/lib/leads-cache";

interface LeadInput {
  firstName: string;
  lastName: string;
  city: string;
  phone: string;
  rawStatus: string;
  dateStr?: string | null;
}

const RAW_LEADS: LeadInput[] = [
  // --- Sheet 1 ---
  { firstName: "Mounir", lastName: "Taoussi", city: "Casablanca", phone: "212600911412", rawStatus: "TRAINING FIXED", dateStr: "11/4/2026" },
  { firstName: "أسامة", lastName: "صبري", city: "Casablanca", phone: "212777903672", rawStatus: "NOT INTERESTED" },
  { firstName: "Mourad", lastName: "Benemchich", city: "Rabat", phone: "212679333176", rawStatus: "NO RESPONSE 1" },
  { firstName: "Abdelghani", lastName: "Haddad", city: "El Jadida", phone: "212767908020", rawStatus: "NOT INTERESTED" },
  { firstName: "سامي", lastName: "سامي", city: "Casablanca", phone: "212650429379", rawStatus: "WRONG NUMBER" },
  { firstName: "Simo", lastName: "El Ktiri", city: "Meknes", phone: "212619422497", rawStatus: "HORS ZONE" },
  { firstName: "Âÿmãñ", lastName: "Öükãdî", city: "Casablanca", phone: "212707813194", rawStatus: "HORS ZONE" },
  { firstName: "Aziz", lastName: "Elaouny", city: "Casablanca", phone: "212669652660", rawStatus: "NOT INTERESTED" },
  { firstName: "Hamza", lastName: "Boukham", city: "Casablanca", phone: "212694962012", rawStatus: "TRAINING FIXED", dateStr: "11/4/2026" },
  { firstName: "Soufiane", lastName: "Souhail", city: "Casablanca", phone: "212699284957", rawStatus: "NOT INTERESTED" },
  { firstName: "خالد", lastName: "الخطاب", city: "Casablanca", phone: "212613452564", rawStatus: "NOT INTERESTED" },
  { firstName: "Said", lastName: "Akdi", city: "Tanger", phone: "212671180891", rawStatus: "HORS ZONE" },
  { firstName: "Esseddik", lastName: "Benarhila", city: "Casablanca", phone: "212695114673", rawStatus: "NO RESPONSE 1" },
  { firstName: "مراد", lastName: "مبصيم", city: "Casablanca", phone: "212775829073", rawStatus: "NO RESPONSE 1" },
  { firstName: "Mc", lastName: "Yassine", city: "Casablanca", phone: "212626270513", rawStatus: "NO RESPONSE 1" },
  { firstName: "Zenkhour Mohamed", lastName: "Amine", city: "Rabat", phone: "212675412676", rawStatus: "TRAINING FIXED", dateStr: "11/13/2026" },
  { firstName: "Abo Niama", lastName: "Fahili", city: "El Jadida", phone: "212616455591", rawStatus: "NOT INTERESTED" },
  { firstName: "Imad", lastName: "Zarouki", city: "Casablanca", phone: "212610800606", rawStatus: "TRAINING FIXED", dateStr: "11/4/2026" },
  { firstName: "Ali", lastName: "Reda", city: "Casablanca", phone: "212630392996", rawStatus: "WRONG NUMBER" },
  { firstName: "Rachid", lastName: "Karmoumi", city: "Tangier", phone: "212625215334", rawStatus: "HORS ZONE" },
  { firstName: "Younes", lastName: "Merri", city: "Rabat", phone: "212665774663", rawStatus: "NO RESPONSE 1" },
  { firstName: "Abdou Ben", lastName: "L'fqih", city: "Rabat", phone: "212642677420", rawStatus: "TRAINING FIXED", dateStr: "11/13/2026" },
  { firstName: "Salah", lastName: "Rougmani", city: "Casablanca", phone: "212691089281", rawStatus: "TRAINING FIXED", dateStr: "11/4/2026" },
  { firstName: "Hassan", lastName: "Yassin", city: "Casablanca", phone: "212661932433", rawStatus: "TRAINING FIXED", dateStr: "11/5/2026" },
  { firstName: "Naoufal", lastName: "Houari", city: "Rabat", phone: "212699563602", rawStatus: "TRAINING FIXED", dateStr: "11/13/2026" },
  { firstName: "AbdelOUAHED", lastName: "Bartatan", city: "Casablanca", phone: "212607079031", rawStatus: "TRAINING FIXED", dateStr: "11/4/2026" },
  { firstName: "Abdessamad", lastName: "Ounas", city: "Casablanca", phone: "212623845644", rawStatus: "NO RESPONSE 1" },
  { firstName: "Larbi", lastName: "Lina", city: "Casablanca", phone: "212662676743", rawStatus: "TRAINING FIXED", dateStr: "11/4/2026" },
  { firstName: "وديع", lastName: "بولعيش", city: "Tanger", phone: "212618898510", rawStatus: "HORS ZONE" },
  { firstName: "Ayoub", lastName: "Alaoui", city: "Tanger", phone: "674935668", rawStatus: "HORS ZONE" },
  { firstName: "الحاج", lastName: "سفيان", city: "Casablanca", phone: "212629474040", rawStatus: "NO RESPONSE 1" },
  { firstName: "يوسف", lastName: "morsli", city: "El Jadida", phone: "212771094513", rawStatus: "NO RESPONSE 1" },
  { firstName: "Ad", lastName: "Il", city: "Casablanca", phone: "212664687891", rawStatus: "NOT INTERESTED" },
  { firstName: "ElHoussine", lastName: "Tafjouti", city: "Casablanca", phone: "212652156105", rawStatus: "NO RESPONSE 1" },
  { firstName: "Bennani", lastName: "Jad", city: "Rabat", phone: "212664339652", rawStatus: "TRAINING FIXED", dateStr: "11/13/2026" },
  { firstName: "Omar", lastName: "EL", city: "Casablanca", phone: "212638539655", rawStatus: "WRONG NUMBER" },
  { firstName: "Mounacir", lastName: "Hamza", city: "Casablanca", phone: "212646144120", rawStatus: "NO RESPONSE 1" },
  { firstName: "Mustapha", lastName: "Oublaid", city: "Casablanca", phone: "212700766413", rawStatus: "NO RESPONSE 1" },
  { firstName: "شكري", lastName: "مفتاح", city: "Tanger", phone: "212699612299", rawStatus: "HORS ZONE" },

  // --- Sheet 2 ---
  { firstName: "Hafid", lastName: "Bouchikhi", city: "Tanger", phone: "212697346139", rawStatus: "HORS ZONE" },
  { firstName: "Abdo", lastName: "Rguig", city: "Casablanca", phone: "212634620099", rawStatus: "NO RESPONSE 1" },
  { firstName: "Mbarek", lastName: "El Idrissi", city: "Casablanca", phone: "212666733656", rawStatus: "NOT INTERESTED" },
  { firstName: "Abdellatif", lastName: "Ait Salem", city: "Marrakech", phone: "212608952581", rawStatus: "NO RESPONSE 1" },
  { firstName: "Mustapha", lastName: "Bouamer", city: "Casablanca", phone: "212660316122", rawStatus: "NOT INTERESTED" },
  { firstName: "Mohamed", lastName: "Rakibi", city: "Casablanca", phone: "212673802979", rawStatus: "NO RESPONSE 1" },
  { firstName: "Mahdi El", lastName: "Idrissi", city: "Casablanca", phone: "212621998498", rawStatus: "NO RESPONSE 1" },
  { firstName: "Soukaina", lastName: "Achbab", city: "Casablanca", phone: "212 680-714699", rawStatus: "TRAINING FIXED", dateStr: "11/4/2026" },
  { firstName: "Hamza", lastName: "Kamikaze", city: "Casablanca", phone: "212655258652", rawStatus: "NOT INTERESTED" },
  { firstName: "Noureddin", lastName: "Moussaid", city: "Tanger", phone: "212617371672", rawStatus: "HORS ZONE" },
  { firstName: "Centre", lastName: "Farah", city: "Rabat", phone: "212699524553", rawStatus: "NO RESPONSE 1" },
  { firstName: "Mohamed", lastName: "EL", city: "Tétouan", phone: "212601010074", rawStatus: "HORS ZONE" },
  { firstName: "صلاح الدين", lastName: "ابو إسلام", city: "Casablanca", phone: "212687051933", rawStatus: "TRAINING FIXED", dateStr: "11/4/2026" },
  { firstName: "Wail", lastName: "El Manjri", city: "Rabat", phone: "212771705672", rawStatus: "TRAINING FIXED", dateStr: "11/13/2026" },
  { firstName: "Ilyasse", lastName: "Kt", city: "Casablanca", phone: "212625577056", rawStatus: "NO RESPONSE 1" },
  { firstName: "Hossam", lastName: "Zarwali", city: "Casablanca", phone: "212702609898", rawStatus: "WRONG NUMBER" },
  { firstName: "Rida", lastName: "Masrour", city: "Casablanca", phone: "212663695751", rawStatus: "TRAINING FIXED", dateStr: "11/4/2026" },
  { firstName: "Omar", lastName: "Es Sadki", city: "Fez", phone: "212672499776", rawStatus: "HORS ZONE" },
  { firstName: "Hassan", lastName: "Elhayani", city: "Sidi Ifni", phone: "212620868832", rawStatus: "HORS ZONE" },
  { firstName: "Mohamed", lastName: "Bane Faras", city: "Tanger", phone: "212694235448", rawStatus: "HORS ZONE" },
  { firstName: "Idriss", lastName: "Elmahaouchi", city: "Khenifra", phone: "212633313315", rawStatus: "HORS ZONE" },
  { firstName: "Larbi", lastName: "Bell", city: "Casablanca", phone: "212620966564", rawStatus: "NO RESPONSE 1" },
  { firstName: "Choumokh", lastName: "Taib", city: "Casablanca", phone: "212626293709", rawStatus: "TRAINING FIXED", dateStr: "11/5/2026" },
  { firstName: "Hassan", lastName: "Banni", city: "Rabat", phone: "212668090374", rawStatus: "NO RESPONSE 1" },
  { firstName: "Issawi", lastName: "Anwar", city: "Tanger", phone: "212772556214", rawStatus: "HORS ZONE" },
  { firstName: "Moncef", lastName: "Fachtal", city: "Casablanca", phone: "212668015385", rawStatus: "TRAINING FIXED", dateStr: "11/5/2026" },
  { firstName: "SouFian", lastName: "Boukayouh", city: "Fez", phone: "212603508986", rawStatus: "HORS ZONE" },
  { firstName: "Mourad", lastName: "Ait Bihi", city: "Agadir", phone: "660111702", rawStatus: "HORS ZONE" },
  { firstName: "Omar", lastName: "Bachchar", city: "Casablanca", phone: "212609761494", rawStatus: "NOT INTERESTED" },
  { firstName: "Mohssine", lastName: "Elmassnaoui", city: "Casablanca", phone: "212600941985", rawStatus: "NO RESPONSE 1" },
  { firstName: "Hicham", lastName: "Gn", city: "Meknes", phone: "659744868", rawStatus: "HORS ZONE" },
  { firstName: "Ben Chakroun", lastName: "Benchakroun", city: "Casablanca", phone: "212684086437", rawStatus: "NO RESPONSE 1" },
  { firstName: "Hicham", lastName: "Dabachi", city: "Casablanca", phone: "614826510", rawStatus: "TRAINING FIXED", dateStr: "11/4/2026" },
  { firstName: "صفوان", lastName: "علو", city: "Kenitra", phone: "212676393917", rawStatus: "NO RESPONSE 1" },
  { firstName: "محمد", lastName: "فتاح", city: "Bir Jdid", phone: "212641573732", rawStatus: "NOT INTERESTED" },
  { firstName: "Hamza", lastName: "Zouyten", city: "Casablanca", phone: "705636208", rawStatus: "NOT INTERESTED" },
  { firstName: "Ayoub", lastName: "Brüÿnê", city: "Marrakech", phone: "212619927066", rawStatus: "HORS ZONE" },
  { firstName: "Hicham", lastName: "Daiz", city: "Rabat", phone: "212661541907", rawStatus: "NOT INTERESTED" },
  { firstName: "Mohammed", lastName: "Ettahaly", city: "Casablanca", phone: "709800881", rawStatus: "NO RESPONSE 1" },
  { firstName: "Said", lastName: "Adil", city: "Casablanca", phone: "212660787635", rawStatus: "NO RESPONSE 1" },

  // --- Sheet 3 ---
  { firstName: "Rida", lastName: "Boukaissi", city: "Rabat", phone: "212669592526", rawStatus: "TRAINING FIXED", dateStr: "11/13/2026" },
  { firstName: "Fatiha", lastName: "Houboub", city: "Casablanca", phone: "212719275593", rawStatus: "NOT INTERESTED" },
  { firstName: "Mohcine", lastName: "Azlag", city: "Agadir", phone: "212616412195", rawStatus: "HORS ZONE" },
  { firstName: "Elyass", lastName: "Bousabata", city: "Meknes", phone: "212631332799", rawStatus: "HORS ZONE" },
  { firstName: "Aziz", lastName: "Ait Ghanem", city: "Berrechid", phone: "212635088934", rawStatus: "TRAINING FIXED", dateStr: "11/11/2026" },
  { firstName: "Rachid", lastName: "Ouzzi", city: "Casablanca", phone: "212629844869", rawStatus: "NO RESPONSE 1" },
  { firstName: "Mohammed", lastName: "Chmite", city: "Casablanca", phone: "212621477755", rawStatus: "NOT INTERESTED" },
  { firstName: "Salah", lastName: "Elyazdi", city: "Ghmara", phone: "212662588147", rawStatus: "NO RESPONSE 1" },
  { firstName: "Elmehdi", lastName: "Roussi", city: "Casablanca", phone: "212668736887", rawStatus: "TRAINING FIXED", dateStr: "11/3/2026" },
  { firstName: "Saad", lastName: "ANBAR", city: "Casablanca", phone: "212608000848", rawStatus: "ALREADY CLIENT" },
  { firstName: "Simo", lastName: "Reboh", city: "Bouznika", phone: "620453024", rawStatus: "NO RESPONSE 1" },
  { firstName: "Abdilah", lastName: "Elka", city: "Marrakech", phone: "212626268616", rawStatus: "NO RESPONSE 1" },
  { firstName: "Raseed", lastName: "Raseed", city: "Casablanca", phone: "212701310301", rawStatus: "NOT INTERESTED" },
  { firstName: "Cherkaoui", lastName: "Cherki", city: "Rabat", phone: "212660014357", rawStatus: "TRAINING FIXED", dateStr: "11/13/2026" },
  { firstName: "Abdelilah", lastName: "Zr", city: "Casablanca", phone: "212656556385", rawStatus: "NO RESPONSE 1" },
  { firstName: "Mohamed", lastName: "Srifi", city: "Meknes", phone: "212669100435", rawStatus: "HORS ZONE" },
  { firstName: "Ayoub", lastName: "Az", city: "Casablanca", phone: "212603949212", rawStatus: "NO RESPONSE 1" },
  { firstName: "Hamza", lastName: "Taouf", city: "Tanger", phone: "212664776639", rawStatus: "HORS ZONE" },
  { firstName: "Jaouad", lastName: "Larmoud", city: "Casablanca", phone: "212697873159", rawStatus: "NOT INTERESTED" },
];

function sanitizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("212")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    return `+212${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `+212${digits}`;
  }
  return `+${digits}`;
}

function parseTrainingDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    // Set to 10:00:00 AM UTC
    const d = new Date(Date.UTC(year, month, day, 10, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function main() {
  console.log(`Processing ${RAW_LEADS.length} leads treated on 2026-11-03 by Kaoutar...`);

  // Timestamp for yesterday: 2026-11-03 at 15:30:00 UTC (during business calling hours)
  const treatedDate = new Date("2026-11-03T15:30:00.000Z");

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of RAW_LEADS) {
    const sanitized_phone = sanitizePhone(item.phone);
    const raw_name = `${item.firstName} ${item.lastName}`.trim();
    const city = item.city;

    let board_column = "BRAND_PRE_FILTER";
    let brand_status: string | null = null;
    let training_status: string | null = null;
    let reminder_date: Date | null = null;

    const normStatus = item.rawStatus.toUpperCase();

    if (normStatus === "TRAINING FIXED") {
      board_column = "TRAINING_PIPELINE";
      brand_status = "Training fixed";
      training_status = "Scheduled";
      reminder_date = parseTrainingDate(item.dateStr);
    } else if (normStatus === "NOT INTERESTED") {
      board_column = "BRAND_PRE_FILTER";
      brand_status = "Not interested";
    } else if (normStatus === "NO RESPONSE 1") {
      board_column = "BRAND_PRE_FILTER";
      brand_status = "No response 1";
    } else if (normStatus === "WRONG NUMBER") {
      board_column = "BRAND_PRE_FILTER";
      brand_status = "Wrong number";
    } else if (normStatus === "HORS ZONE" || normStatus === "HOR ZONE") {
      board_column = "BRAND_PRE_FILTER";
      brand_status = "Hors zone";
    } else if (normStatus.includes("ALREADY")) {
      board_column = "BRAND_PRE_FILTER";
      brand_status = "Already a client";
    } else {
      board_column = "BRAND_PRE_FILTER";
      brand_status = item.rawStatus;
    }

    // Check if lead exists by phone
    const existing = await prisma.lead.findUnique({
      where: { sanitized_phone }
    });

    let leadId: string;

    if (existing) {
      leadId = existing.id;
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          raw_name,
          city,
          board_column,
          brand_status,
          training_status,
          reminder_date,
          handled_by: "Kaoutar",
          status_changed_at: treatedDate,
          updated_at: new Date()
        }
      });
      updatedCount++;
    } else {
      leadId = uuidv4();
      await prisma.lead.create({
        data: {
          id: leadId,
          raw_name,
          sanitized_phone,
          campaign_source: "FACEBOOK_ADS",
          city,
          board_column,
          brand_status,
          training_status,
          reminder_date,
          handled_by: "Kaoutar",
          status_changed_at: treatedDate,
          created_at: new Date("2026-11-03T10:00:00.000Z"),
          updated_at: new Date()
        }
      });
      createdCount++;
    }

    // Create Audit / Activity Logs attributed to Kaoutar on 2026-11-03
    await prisma.leadActivityLog.createMany({
      data: [
        {
          id: uuidv4(),
          lead_id: leadId,
          agent: "Kaoutar",
          action: "CALL_INITIATED",
          detail: "Appel effectué / prospect traité (+1 Appel Comptabilisé)",
          created_at: new Date("2026-11-03T14:30:00.000Z")
        },
        {
          id: uuidv4(),
          lead_id: leadId,
          agent: "Kaoutar",
          action: "STATUS_CHANGED",
          detail: `Statut changé vers : ${brand_status || training_status || board_column}`,
          created_at: new Date("2026-11-03T14:35:00.000Z")
        },
        ...(brand_status === "Training fixed" && reminder_date
          ? [
              {
                id: uuidv4(),
                lead_id: leadId,
                agent: "Kaoutar",
                action: "TRAINING_STATUS_CHANGED",
                detail: `Formation fixée pour le ${reminder_date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
                created_at: new Date("2026-11-03T14:40:00.000Z")
              }
            ]
          : [])
      ]
    });
  }

  invalidateLeadsCache();
  await touchSyncState("leads");

  console.log(`\n🎉 Completed Integration:`);
  console.log(`- Created: ${createdCount} leads`);
  console.log(`- Updated: ${updatedCount} leads`);
  console.log(`- Total Treated by Kaoutar: ${RAW_LEADS.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
