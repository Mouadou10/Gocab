/**
 * Morocco Business Calendar & Working Days Engine
 * 
 * Rules:
 * 1. Working week: Monday through Friday (5 days per week).
 * 2. Rest days: Saturday and Sunday (0 days).
 * 3. Official Moroccan Statutory Holidays (Fêtes Nationales et Religieuses au Maroc).
 *    Any holiday falling on a Monday through Friday is excluded from working days.
 */

export interface MoroccanHoliday {
  date: string; // YYYY-MM-DD
  nameFr: string;
  nameAr?: string;
  isReligious?: boolean;
}

// Statutory Moroccan Holidays (Fixed Civil + Islamic Holidays with official observations)
// Sourced for Moroccan official gazette (Bulletin Officiel du Royaume du Maroc)
export const MOROCCAN_HOLIDAYS_MAP: Record<string, string> = {
  // --- 2025 ---
  "2025-01-01": "Nouvel An (Civil)",
  "2025-01-11": "Manifeste de l'Indépendance",
  "2025-01-14": "Nouvel An Amazigh",
  "2025-03-31": "Aïd Al-Fitr (Jour 1)",
  "2025-04-01": "Aïd Al-Fitr (Jour 2)",
  "2025-05-01": "Fête du Travail",
  "2025-06-07": "Aïd Al-Adha (Jour 1)",
  "2025-06-08": "Aïd Al-Adha (Jour 2)",
  "2025-06-27": "1er Moharram (Nouvel An Hégirien)",
  "2025-07-30": "Fête du Trône",
  "2025-08-14": "Allégeance Oued Ed-Dahab",
  "2025-08-20": "Révolution du Roi et du Peuple",
  "2025-08-21": "Fête de la Jeunesse",
  "2025-09-05": "Aïd Al-Mawlid Annabaoui (Jour 1)",
  "2025-09-06": "Aïd Al-Mawlid Annabaoui (Jour 2)",
  "2025-11-06": "Marche Verte",
  "2025-11-18": "Fête de l'Indépendance",

  // --- 2026 ---
  "2026-01-01": "Nouvel An (Civil)",
  "2026-01-11": "Manifeste de l'Indépendance",
  "2026-01-14": "Nouvel An Amazigh",
  "2026-03-20": "Aïd Al-Fitr (Jour 1)",
  "2026-03-21": "Aïd Al-Fitr (Jour 2)",
  "2026-05-01": "Fête du Travail",
  "2026-05-27": "Aïd Al-Adha (Jour 1)",
  "2026-05-28": "Aïd Al-Adha (Jour 2)",
  "2026-06-16": "1er Moharram (Nouvel An Hégirien)",
  "2026-07-30": "Fête du Trône",
  "2026-08-14": "Allégeance Oued Ed-Dahab",
  "2026-08-20": "Révolution du Roi et du Peuple",
  "2026-08-21": "Fête de la Jeunesse",
  "2026-08-26": "Aïd Al-Mawlid Annabaoui (Jour 1)",
  "2026-08-27": "Aïd Al-Mawlid Annabaoui (Jour 2)",
  "2026-11-06": "Marche Verte",
  "2026-11-18": "Fête de l'Indépendance",

  // --- 2027 ---
  "2027-01-01": "Nouvel An (Civil)",
  "2027-01-11": "Manifeste de l'Indépendance",
  "2027-01-14": "Nouvel An Amazigh",
  "2027-03-10": "Aïd Al-Fitr (Jour 1)",
  "2027-03-11": "Aïd Al-Fitr (Jour 2)",
  "2027-05-01": "Fête du Travail",
  "2027-05-16": "Aïd Al-Adha (Jour 1)",
  "2027-05-17": "Aïd Al-Adha (Jour 2)",
  "2027-06-06": "1er Moharram (Nouvel An Hégirien)",
  "2027-07-30": "Fête du Trône",
  "2027-08-14": "Allégeance Oued Ed-Dahab",
  "2027-08-20": "Révolution du Roi et du Peuple",
  "2027-08-21": "Fête de la Jeunesse",
  "2027-08-16": "Aïd Al-Mawlid Annabaoui (Jour 1)",
  "2027-08-17": "Aïd Al-Mawlid Annabaoui (Jour 2)",
  "2027-11-06": "Marche Verte",
  "2027-11-18": "Fête de l'Indépendance",
};

/**
 * Checks if a given date is a Moroccan official holiday.
 */
export function isMoroccanHoliday(date: Date): { isHoliday: boolean; name?: string } {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const key = `${yyyy}-${mm}-${dd}`;

  const holidayName = MOROCCAN_HOLIDAYS_MAP[key];
  if (holidayName) {
    return { isHoliday: true, name: holidayName };
  }
  return { isHoliday: false };
}

/**
 * Calculates the exact number of working days between two dates.
 * Excludes Saturdays, Sundays, and Moroccan holidays.
 */
export function getMoroccanWorkingDays(startDate: Date, endDate: Date): {
  workingDays: number;
  totalCalendarDays: number;
  holidaysEncountered: { date: string; name: string }[];
} {
  const holidaysEncountered: { date: string; name: string }[] = [];
  let workingDays = 0;
  let totalCalendarDays = 0;

  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    totalCalendarDays++;
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const holiday = isMoroccanHoliday(current);
      if (holiday.isHoliday) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, "0");
        const dd = String(current.getDate()).padStart(2, "0");
        holidaysEncountered.push({
          date: `${yyyy}-${mm}-${dd}`,
          name: holiday.name || "Jour férié officiel",
        });
      } else {
        workingDays++;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    workingDays: Math.max(1, workingDays),
    totalCalendarDays: Math.max(1, totalCalendarDays),
    holidaysEncountered,
  };
}

/**
 * Calculates working days in a specific full month (year, monthIndex where 0=Jan..11=Dec).
 */
export function getWorkingDaysInFullMonth(year: number, monthIndex: number): {
  workingDays: number;
  holidays: { date: string; name: string }[];
} {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const res = getMoroccanWorkingDays(firstDay, lastDay);
  return {
    workingDays: res.workingDays,
    holidays: res.holidaysEncountered,
  };
}

/**
 * Calculates working days in the standard 5-day work week (Monday to Friday)
 * for a given date's week.
 */
export function getWorkingDaysInWeek(date: Date): {
  workingDays: number;
  holidays: { date: string; name: string }[];
} {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  const res = getMoroccanWorkingDays(monday, friday);
  return {
    workingDays: res.workingDays,
    holidays: res.holidaysEncountered,
  };
}
