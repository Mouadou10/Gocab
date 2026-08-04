/**
 * WhatsApp URL Helpers
 *
 * Generates wa.me deep-links with pre-filled Arabic messages
 * for training invitations and post-acceptance thank-you notes.
 */

/**
 * Generates a WhatsApp invitation URL with session time based on day of week.
 * - Monday–Thursday → 3:00 PM
 * - Friday → 11:00 AM
 *
 * @param phone - Sanitized phone number (e.g., "+212612345678")
 * @param date  - The training session date
 * @returns     - Full wa.me URL with encoded Arabic message
 */
export function generateTrainingInviteURL(phone: string, date: Date): string {
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const isFriday = dayOfWeek === 5;
  const sessionTime = isFriday ? "11:00" : "15:00";
  const sessionLabel = isFriday ? "11:00 صباحاً" : "3:00 مساءً";

  // Format the date as DD/MM/YYYY
  const formattedDate = date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const message =
    `السلام عليكم،\n` +
    `تم تأكيد موعد التدريب الخاص بكم يوم ${formattedDate} على الساعة ${sessionLabel}.\n` +
    `نتطلع للقائكم في GoCab.\n` +
    `شكراً لكم.`;

  // Strip the "+" for wa.me format
  const cleanPhone = phone.replace("+", "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generates a WhatsApp thank-you URL after offer acceptance.
 *
 * @param phone - Sanitized phone number (e.g., "+212612345678")
 * @returns     - Full wa.me URL with encoded Arabic message
 */
export function generateThankYouURL(phone: string): string {
  const message = "شكراً لثقتكم، نتمنى لكم رحلة موفقة مع GoCab.";
  const cleanPhone = phone.replace("+", "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
