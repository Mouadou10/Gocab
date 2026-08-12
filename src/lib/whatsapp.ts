/**
 * WhatsApp URL Helpers
 *
 * Generates wa.me deep-links with pre-filled messages
 * for training invitations and post-acceptance thank-you notes.
 */

const DEFAULT_INVITE_TEMPLATE =
  "السلام عليكم {name}،\nتم تأكيد موعد التدريب الخاص بكم يوم {date} على الساعة {time}.\nنتطلع للقائكم في GoCab.\nشكراً لكم.";

/**
 * Generates a WhatsApp invitation URL with custom template.
 * Substitutes {name}, {date}, and {time}.
 * - Monday–Thursday → 3:00 PM (3:00 مساءً)
 * - Friday → 11:00 AM (11:00 صباحاً)
 *
 * @param phone    - Sanitized phone number (e.g., "+212612345678")
 * @param name     - Lead raw name
 * @param date     - The training session date
 * @param template - Custom template string from settings
 * @returns        - Full wa.me URL with encoded message
 */
export function generateTrainingInviteURL(
  phone: string,
  name: string,
  date: Date,
  template?: string
): string {
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const isFriday = dayOfWeek === 5;
  const sessionLabel = isFriday ? "11:00 صباحاً" : "3:00 مساءً";

  // Format the date as DD/MM/YYYY
  const formattedDate = date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const activeTemplate = template || DEFAULT_INVITE_TEMPLATE;

  const message = activeTemplate
    .replace(/{name}/g, name)
    .replace(/{date}/g, formattedDate)
    .replace(/{time}/g, sessionLabel);

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
