import { sendOutboundWhatsAppMessage } from "../src/lib/services/whatsappApiService";
import { prisma, flushDatabaseSync } from "../src/lib/prisma";

async function main() {
  const phone = "+212601299117";
  const name = "Zakaria";

  const messageText = `Salam Zakaria,

Voici ton espace partenaire exclusif chez GoCab :
🔗 https://gocab-psi.vercel.app/zakaria

Sur cette page, tu peux :
1. 📝 Enregistrer directement les chauffeurs que tu nous recommandes (nom, téléphone, ville).
2. 🚗 Suivre l'avancement de chaque dossier en direct.
3. 💰 Voir tes commissions de 150 DH s'afficher automatiquement dès que le chauffeur prend sa voiture ou dépose son acompte de précommande.

💡 Conseil : Ouvre le lien sur ton téléphone et choisis "Ajouter à l'écran d'accueil" pour l'avoir sous la main comme une application mobile.

Bienvenue parmi nos partenaires !
L'équipe GoCab`;

  console.log(`📡 Sending WhatsApp invitation to ${name} (${phone})...`);

  const result = await sendOutboundWhatsAppMessage({
    phoneNumber: phone,
    text: messageText,
    senderName: "GoCab Operations",
  });

  await flushDatabaseSync();

  console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
