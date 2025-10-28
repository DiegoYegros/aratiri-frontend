import { LanguageCode } from "./translations";

const localeForLanguage = (language: LanguageCode) =>
  language === "es" ? "es-ES" : "en-US";

export const formatRelativeDate = (
  dateString: string,
  language: LanguageCode
): string => {
  const date = new Date(dateString);
  const now = Date.now();
  const diffInSeconds = Math.round((date.getTime() - now) / 1000);
  const absSeconds = Math.abs(diffInSeconds);
  const formatter = new Intl.RelativeTimeFormat(localeForLanguage(language), {
    numeric: "auto",
  });

  if (absSeconds < 60) {
    return formatter.format(diffInSeconds, "second");
  }

  const diffInMinutes = Math.round(diffInSeconds / 60);
  if (Math.abs(diffInMinutes) < 60) {
    return formatter.format(diffInMinutes, "minute");
  }

  const diffInHours = Math.round(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) {
    return formatter.format(diffInHours, "hour");
  }

  return date.toLocaleDateString(localeForLanguage(language), {
    month: "long",
    day: "numeric",
  });
};
