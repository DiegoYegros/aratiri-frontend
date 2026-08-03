/**
 * Spark Bech32m address prefixes (docs.spark.money / SDK samples).
 * Client-side decode — Aratiri's /decoder has no spark1 support.
 */
const SPARK_ADDRESS_RE =
  /^(spark|sparkrt|sparkt|sparkr)1[02-9ac-hj-np-z]{10,200}$/i;

export function isSparkAddress(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return SPARK_ADDRESS_RE.test(trimmed);
}

export function normalizeSparkAddress(value: string): string {
  return value.trim().toLowerCase();
}
