/**
 * Resolve an LNURL-pay / alias callback to a BOLT11 invoice in the browser.
 * Used by the Spark send path so custodial /lnurl/pay is never called.
 */
export async function fetchLnurlBolt11(params: {
  callback: string;
  amountMsat: number;
  comment?: string;
}): Promise<string> {
  const url = new URL(params.callback);
  url.searchParams.set("amount", String(params.amountMsat));
  if (params.comment) {
    url.searchParams.set("comment", params.comment);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`LNURL callback failed (${response.status})`);
  }

  const body = (await response.json()) as {
    pr?: string;
    status?: string;
    reason?: string;
  };

  if (body.status === "ERROR" || !body.pr) {
    throw new Error(body.reason || "LNURL callback returned no invoice");
  }

  return body.pr;
}
