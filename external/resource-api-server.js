/**
 * This represents a completely separate backend service — think "the actual
 *product API" as opposed to the login server. It never talks to the IdP
 *directly per-request. Instead, it fetches the IdP's PUBLIC key once (via
 *JWKS) and verifies token signatures locally. This is the actual point of
 *SSO/JWT-based auth: the resource server can verify tokens WITHOUT calling
 *back to the IdP on every request.
 */

const express = require("express");
const { createRemoteJWKSet, jwtVerify } = require("jose");

const app = express();
const PORT = 5000;
/** Must stay this literal string — it's what the IdP signs into every
 * token's `iss` claim, and that's what we check tokens against below.
 */
const IDP_ISSUER = "http://localhost:4000";
/** Where we actually reach the IdP to fetch its public keys. Same as
 * IDP_ISSUER unless overridden — e.g. Docker Compose points this at the
 * `idp` service instead of localhost.
 */
const IDP_BASE_URL = process.env.IDP_BASE_URL || IDP_ISSUER;
const EXPECTED_AUDIENCE = "resource-api";

/**
 * jose handles fetching + caching the IdP's public keys for us, and will
 * automatically re-fetch if it sees a 'kid' (key ID) it doesn't recognize
 * yet (e.g., after the IdP rotates its signing key).
 */
const JWKS = createRemoteJWKSet(new URL(`${IDP_BASE_URL}/.well-known/jwks.json`));

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "missing bearer token",
    });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: IDP_ISSUER, // must have been issued by OUR trusted IdP
      audience: EXPECTED_AUDIENCE, // must have been issued FOR this API specifically
    });

    req.user = payload;
    next();
  } catch (err) {
    console.log(`[API] Token rejected: ${err.message}`);
    return res.status(401).json({
      error: "invalid token",
      detail: err.message,
    });
  }
};

app.get("/me", requireAuth, (req, res) => {
  console.log(`[API] Serving /me for sub=${req.user.sub}`);
  res.json({
    sub: req.user.sub,
    scope: req.user.scope,
  });
});

app.listen(PORT, () => {
  console.log(`Resource API running at http://localhost:${PORT}`);
  console.log(`Validates tokens issued by: ${IDP_ISSUER}\n`);
});
