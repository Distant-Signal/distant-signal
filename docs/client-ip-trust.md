# Client IP trust

The api rate-limits per client, keyed on `X-Real-IP`, which the frontend
sets (`frontend/lib/clientIp.ts`). The only source it trusts is
`CF-Connecting-IP`, a literal IP set by Cloudflare. Next 16 gives route
handlers and Server Components no socket peer address, and the client's own
`X-Forwarded-For` and `X-Real-IP` are never relayed, so there is no other
trustworthy value to read.

## The assumption

The frontend's origin is reachable only through the Cloudflare tunnel. If
something else can reach it (another pod with the Service address, a
misconfigured NodePort or ingress), that caller can send any
`CF-Connecting-IP` it likes, so it can dodge or spend another client's rate
limit. The network policy and the tunnel config in ds-deploy and Ranma-Config
are what keep this true.

## Optional hardening: `TRUSTED_PROXY_SECRET`

Off by default, so nothing changes in production until it is set on both
sides:

1. Set `TRUSTED_PROXY_SECRET` on the frontend to a long random value.
2. Have the edge add `X-DS-Proxy-Secret: <same value>` to every request to
   the origin (a Cloudflare Transform Rule, request header modification).

With it set, `CF-Connecting-IP` is honoured only on a request carrying the
matching header (compared in constant time). Any other request gets no
`X-Real-IP`, and the api falls back to its own peer address. Set the edge
rule first, then the variable, or every request loses its client address.

## Warning

In production mode the frontend logs one warning per process the first time
a request has no usable `CF-Connecting-IP` (or has one with a wrong secret),
which is how a direct, tunnel-bypassing request shows up.
