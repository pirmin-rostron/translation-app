/**
 * Maps language codes and common names to display names.
 * Handles ISO 639-1 codes (en, de, fr) and full names (English, German).
 */

const CODE_TO_NAME: Record<string, string> = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  ru: "Russian",
  ja: "Japanese",
  zh: "Chinese",
  "zh-cn": "Chinese (Simplified)",
  "zh-tw": "Chinese (Traditional)",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  tr: "Turkish",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  fi: "Finnish",
  el: "Greek",
  cs: "Czech",
  hu: "Hungarian",
  ro: "Romanian",
  uk: "Ukrainian",
  id: "Indonesian",
  ms: "Malay",
  th: "Thai",
  vi: "Vietnamese",
};

const NAME_TO_CODE = Object.fromEntries(
  Object.entries(CODE_TO_NAME).map(([k, v]) => [v.toLowerCase(), v])
);

export function getLanguageDisplayName(value: string | null | undefined): string {
  if (value == null || value === "" || value.toLowerCase() === "unknown") {
    return "Unknown";
  }
  const lower = value.toLowerCase();
  return CODE_TO_NAME[lower] ?? NAME_TO_CODE[lower] ?? value;
}

/** Map any language value (name or code) to its uppercase 2-letter ISO code. */
const NAME_TO_ISO: Record<string, string> = {
  english: "EN", german: "DE", french: "FR", spanish: "ES", italian: "IT",
  portuguese: "PT", dutch: "NL", polish: "PL", russian: "RU", japanese: "JA",
  chinese: "ZH", "chinese (simplified)": "ZH", korean: "KO", arabic: "AR",
  hindi: "HI", turkish: "TR", swedish: "SV", danish: "DA", norwegian: "NO",
  finnish: "FI", thai: "TH", vietnamese: "VI", "portuguese (br)": "PT",
  en: "EN", de: "DE", fr: "FR", es: "ES", it: "IT", pt: "PT", nl: "NL",
  pl: "PL", ru: "RU", ja: "JA", zh: "ZH", "zh-cn": "ZH", ko: "KO",
  ar: "AR", hi: "HI", tr: "TR", sv: "SV", da: "DA", no: "NO", fi: "FI",
  th: "TH", vi: "VI",
};

export function getLanguageCode(value: string | null | undefined): string {
  if (!value) return "??";
  const lower = value.toLowerCase();
  return NAME_TO_ISO[lower] ?? (value.length <= 3 ? value.toUpperCase() : value.substring(0, 2).toUpperCase());
}

/** Map language name/code to flag emoji for display. */
const LANG_FLAGS: Record<string, string> = {
  english: "\u{1F1EC}\u{1F1E7}",
  german: "\u{1F1E9}\u{1F1EA}",
  french: "\u{1F1EB}\u{1F1F7}",
  korean: "\u{1F1F0}\u{1F1F7}",
  spanish: "\u{1F1EA}\u{1F1F8}",
  italian: "\u{1F1EE}\u{1F1F9}",
  japanese: "\u{1F1EF}\u{1F1F5}",
  dutch: "\u{1F1F3}\u{1F1F1}",
  portuguese: "\u{1F1F5}\u{1F1F9}",
  "chinese (simplified)": "\u{1F1E8}\u{1F1F3}",
  chinese: "\u{1F1E8}\u{1F1F3}",
  arabic: "\u{1F1E6}\u{1F1EA}",
  "portuguese (br)": "\u{1F1E7}\u{1F1F7}",
  swedish: "\u{1F1F8}\u{1F1EA}",
  polish: "\u{1F1F5}\u{1F1F1}",
  turkish: "\u{1F1F9}\u{1F1F7}",
  // ISO codes
  en: "\u{1F1EC}\u{1F1E7}",
  de: "\u{1F1E9}\u{1F1EA}",
  fr: "\u{1F1EB}\u{1F1F7}",
  ko: "\u{1F1F0}\u{1F1F7}",
  es: "\u{1F1EA}\u{1F1F8}",
  it: "\u{1F1EE}\u{1F1F9}",
  ja: "\u{1F1EF}\u{1F1F5}",
  nl: "\u{1F1F3}\u{1F1F1}",
  pt: "\u{1F1F5}\u{1F1F9}",
  "zh-cn": "\u{1F1E8}\u{1F1F3}",
  zh: "\u{1F1E8}\u{1F1F3}",
  ar: "\u{1F1E6}\u{1F1EA}",
  sv: "\u{1F1F8}\u{1F1EA}",
  pl: "\u{1F1F5}\u{1F1F1}",
  tr: "\u{1F1F9}\u{1F1F7}",
};

export function getLanguageFlag(value: string | null | undefined): string {
  if (!value) return "";
  return LANG_FLAGS[value.toLowerCase()] ?? "";
}

/** Options for manual source language override (value = ISO code). */
export const SOURCE_LANGUAGE_OVERRIDE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "pt", label: "Portuguese" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
] as const;

/** Target language options for translation modals. Order: most-requested first. */
export const PROJECT_LANGUAGE_OPTIONS = [
  { code: "Spanish",               flag: "\u{1F1EA}\u{1F1F8}", label: "Spanish" },
  { code: "French",                flag: "\u{1F1EB}\u{1F1F7}", label: "French" },
  { code: "German",                flag: "\u{1F1E9}\u{1F1EA}", label: "German" },
  { code: "Portuguese (BR)",       flag: "\u{1F1E7}\u{1F1F7}", label: "Portuguese (BR)" },
  { code: "Italian",               flag: "\u{1F1EE}\u{1F1F9}", label: "Italian" },
  { code: "Japanese",              flag: "\u{1F1EF}\u{1F1F5}", label: "Japanese" },
  { code: "Chinese (Simplified)",  flag: "\u{1F1E8}\u{1F1F3}", label: "Chinese (Simplified)" },
  { code: "Korean",                flag: "\u{1F1F0}\u{1F1F7}", label: "Korean" },
  { code: "Dutch",                 flag: "\u{1F1F3}\u{1F1F1}", label: "Dutch" },
  { code: "Swedish",               flag: "\u{1F1F8}\u{1F1EA}", label: "Swedish" },
  { code: "Portuguese",            flag: "\u{1F1F5}\u{1F1F9}", label: "Portuguese" },
  { code: "Arabic",                flag: "\u{1F1E6}\u{1F1EA}", label: "Arabic" },
  { code: "Polish",                flag: "\u{1F1F5}\u{1F1F1}", label: "Polish" },
  { code: "Turkish",               flag: "\u{1F1F9}\u{1F1F7}", label: "Turkish" },
] as const;
