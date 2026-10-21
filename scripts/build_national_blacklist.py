import json
import os
import re
import unicodedata

def normalize_text(text: str) -> str:
    if not text:
        return ""
    # Normalize unicode to decomposed form (NFD) to strip accents
    nfd = unicodedata.normalize('NFD', text)
    stripped = "".join(c for c in nfd if unicodedata.category(c) != 'Mn')
    # Uppercase
    cleaned = stripped.upper()
    # Replace special characters, apostrophes, hyphens with spaces
    cleaned = re.sub(r"[^A-Z0-9\s]", " ", cleaned)
    # Collapse whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

def clean_reason(reason: str) -> str:
    r = reason.strip()
    if not r:
        return "Non spécifié (Signalé sur liste noire)"
    if "DETOURNEM" in r or "DÉTOURNEM" in r:
        return "DÉTOURNEMENT DE VÉHICULE"
    if "UVAIS CLIENT" in r:
        return "MAUVAIS CLIENT"
    if "MAUVAISE CLIENT" in r:
        return "MAUVAISE CLIENTE"
    if "PAPIER FALSIFI" in r or "PAPIERS FAL" in r:
        return "PAPIERS FALSIFIÉS"
    if "RESEAU CRIMINEL" in r or "RÉSEAU CRIMINEL" in r:
        return "RÉSEAU CRIMINEL"
    if "LOUEUR NOIR" in r:
        return "LOUEUR NOIR"
    if "DEALER" in r or "STUP" in r:
        return "TRAFIC / STUPÉFIANT"
    if "ESCRO" in r:
        return "ESCROQUERIE / ESCROC"
    if "IMPOST" in r:
        return "IMPOSTEUR"
    if "INDRIVE" in r:
        return "INDRIVE NON CONFORME / RISQUE"
    return r

def main():
    raw_path = "scripts/raw_blacklist_lines.txt"
    if not os.path.exists(raw_path):
        print("Missing raw file:", raw_path)
        return

    entries = []
    seen = set()

    with open(raw_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            parts = [p.strip() for p in line.split("\t")]
            
            # parts could be [name, city, reason, date]
            name = parts[0] if len(parts) > 0 else ""
            city = parts[1] if len(parts) > 1 else ""
            reason = parts[2] if len(parts) > 2 else ""
            date = parts[3] if len(parts) > 3 else ""

            # If 3 parts, check if 3rd is date
            if len(parts) == 3:
                if re.match(r"^\d{2}/\d{2}/\d{2}$", parts[2]):
                    date = parts[2]
                    reason = ""
                else:
                    reason = parts[2]
                    date = ""

            cleaned_reason = clean_reason(reason)
            norm_name = normalize_text(name)

            key = (norm_name, date, cleaned_reason)
            if key in seen:
                continue
            seen.add(key)

            entries.append({
                "id": f"NBL-{len(entries)+1:04d}",
                "fullName": name,
                "city": city or "Région Casa-Settat",
                "reason": cleaned_reason,
                "date": date or "Non daté",
                "normalizedName": norm_name,
            })

    out_dir = "src/data"
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "national_blacklist.json")

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    print(f"Successfully generated {out_file} with {len(entries)} blacklist records!")

if __name__ == "__main__":
    main()
