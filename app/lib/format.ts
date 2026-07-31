/** Locale-formatted fiat amount without currency symbol or ISO code. */
export const formatFiatAmount = (
  amount: number,
  locale?: string
): string =>
  amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatFiat = (
  amount: number,
  currency: string,
  locale?: string
): string => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${formatFiatAmount(amount, locale)} ${currency.toUpperCase()}`;
  }
};

export const formatSats = (amount: number, locale?: string): string =>
  amount.toLocaleString(locale);

export const formatBtc = (sats: number): string =>
  (sats / 100_000_000).toFixed(8);
