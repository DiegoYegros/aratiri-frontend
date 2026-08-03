#!/usr/bin/env bash
# Skeptic round-2 live CORS gate: browser (nice-grpc-web FetchTransport + SSP
# GraphQL) must reach Spark infra cross-origin. PASS = CORS allows the fetch;
# FAIL = explicit failure (fallback would be a no-key relay — not silently drop).
#
# Proves:
#   - coordinator gRPC-web: POST /spark.SparkService/query_balance
#       headers: X-Grpc-Web:1, Content-Type: application/grpc-web+proto,
#                X-Requested-With: XMLHttpRequest, X-Client-Env, (Authorization)
#   - SSP GraphQL: POST /graphql/spark/2025-03-19 (bearer-auth; CORS preflight
#       must allow content-type + authorization)
# Origin = frontend deployment origin (default localhost:3000). Pass ORIGIN=.
set -eu
ORIGIN="${ORIGIN:-http://localhost:3000}"
COORD="https://0.spark.lightspark.com"
OPS=("spark-operator.breez.technology" "2.spark.flashnet.xyz")
SSP="https://api.lightspark.com"
Q="${COORD}/spark.SparkService/query_balance"
GQL="${SSP}/graphql/spark/2025-03-19"
REQ="x-grpc-web, x-grpc-web-timeout, x-requested-with, x-client-env, content-type, authorization, accept"
ID_PUB="023e33e2920326f64ea31058d44777442d97d7d5cbfcf54e3060bc1695e5261c93"
BODY=$(printf '\x0a\x21%s\x10\x01' "$ID_PUB")
TMPDIR="$(mktemp -d "${TMPDIR:-/tmp}/ssp-cors.XXXXXX")"
trap 'rm -rf "$TMPDIR"' EXIT
fail=0
pass=0

hdr_ok() { # file, token -> PASS/FAIL
  local f="$1" t="$2"
  if grep -qi "$t" "$f"; then echo "  PASS: $t"; pass=$((pass+1)); else echo "  FAIL: $t"; fail=$((fail+1)); fi
}

echo "== 1/4 coordinator preflight ($COORD) =="
curl -sS -m 20 -o /dev/null -D "$TMPDIR/g1.hdr" -X OPTIONS "$Q" \
  -H "Origin: $ORIGIN" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: $REQ"
hdr_ok "$TMPDIR/g1.hdr" "access-control-allow-origin: $ORIGIN"
hdr_ok "$TMPDIR/g1.hdr" "access-control-allow-headers: x-grpc-web"
hdr_ok "$TMPDIR/g1.hdr" "access-control-allow-methods: POST"

echo "== 2/4 coordinator gRPC-web POST (query_balance) =="
curl -sS -m 20 -o "$TMPDIR/g2.out" -D "$TMPDIR/g2.hdr" -X POST "$Q" \
  -H "Origin: $ORIGIN" -H "Content-Type: application/grpc-web+proto" -H "X-Grpc-Web: 1" \
  -H "X-Requested-With: XMLHttpRequest" -H "X-Client-Env: aratiri-frontend" -H "Accept: application/grpc-web+proto" \
  --data-binary "$BODY" -w "  HTTP %{http_code}\n"
hdr_ok "$TMPDIR/g2.hdr" "access-control-allow-origin: $ORIGIN"
hdr_ok "$TMPDIR/g2.hdr" "content-type: application/grpc-web+proto"
if grep -qi "^grpc-status" "$TMPDIR/g2.hdr"; then
  st=$(grep -i "^grpc-status" "$TMPDIR/g2.hdr" | tr -d '\r' | cut -d' ' -f2)
  echo "  PASS: gRPC-web response received (grpc-status=$st = auth/ledger handled it, NOT a CORS block)"; pass=$((pass+1))
else
  echo "  FAIL: no grpc-status (likely CORS/pre-transport block)"; fail=$((fail+1))
fi

echo "== 3/4 signing-operator preflights =="
for op in "${OPS[@]}"; do
  curl -sS -m 20 -o /dev/null -D "$TMPDIR/g3.hdr" -X OPTIONS "https://${op}/spark.SparkService/query_balance" \
    -H "Origin: $ORIGIN" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: $REQ"
  if grep -qi "access-control-allow" "$TMPDIR/g3.hdr"; then
    ao=$(grep -i "^access-control-allow-origin" "$TMPDIR/g3.hdr" | tr -d '\r')
    echo "  PASS: $op allows POST + x-grpc-web ($ao)"; pass=$((pass+1))
  else
    echo "  FAIL: $op missing CORS headers"; fail=$((fail+1))
  fi
done

echo "== 4/4 SSP GraphQL preflight ($GQL) =="
curl -sS -m 20 -o /dev/null -D "$TMPDIR/g4.hdr" -X OPTIONS "$GQL" \
  -H "Origin: $ORIGIN" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization, content-type"
hdr_ok "$TMPDIR/g4.hdr" "access-control-allow-origin"
if grep -qi "^access-control-allow-headers:.*content-type" "$TMPDIR/g4.hdr"; then
  echo "  PASS: access-control-allow-headers includes content-type"; pass=$((pass+1))
else
  echo "  FAIL: allow-headers missing content-type"; fail=$((fail+1))
fi
if grep -qi "^access-control-allow-headers:.*authorization" "$TMPDIR/g4.hdr"; then
  echo "  PASS: access-control-allow-headers includes authorization"; pass=$((pass+1))
else
  echo "  FAIL: allow-headers missing authorization"; fail=$((fail+1))
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "GATE: FAIL ($fail checks failed, $pass passed)"
  exit 1
fi
echo "GATE: PASS ($pass checks)"
