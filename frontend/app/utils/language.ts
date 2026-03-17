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
