/*
 *This is a minimal mock Identity Provider (IdP) — think Okta, Auth0, or your
 *company's central SSO login server. It implements the real protocol
 *mechanics (authorization code, PKCE, signed JWTs, JWKS) but skips a real
 *login UI — it auto-authenticates as a fixed demo user, since the point of
 *this exercise is the PROTOCOL, not building a login form.
 */

const express = require("express");
const crypto = require("crypto");
const { SignJWT, exportJWK, generateKeyPair } = require("jose");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = 4000;
const ISSUER = `http://localhost:${PORT}`;

const exercise_api_url = `${
  process.env.NODE_ENV === "production"
    ? "http://exercise-api-latest.onrender.com"
    : "http://localhost:8686"
}/api/exercise/callback`;

/** Registered clients (in a real IdP, these are configured per-app) */
const REGISTERED_CLIENTS = {
  "sp-web-app": {
    redirectUris: [exercise_api_url],
  },
};

/**
 * Signing key setup
 * The IdP signs tokens with a PRIVATE key; anyone who wants to verify a token
 * (the SP, the resource API) fetches the matching PUBLIC key from /jwks.json.
 * This is exactly how real SSO works — the IdP never hands out its private key.
 */
let signingKey; // { privateKey, publicKey }
let publicJwk;

const KEY_ID = "demo-key-1";

const setupKeys = async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");

  signingKey = { publicKey, privateKey };

  publicJwk = await exportJWK(publicKey);
  publicJwk.kid = KEY_ID;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
};

/** In-memory store for issued authorization codes (single-use, short-lived)
 * key: code, value: { clientId, redirectUri, codeChallenge, nonce, sub, exp }
 */
const authCodes = new Map();

/** The demo "logged in" User - a real IdP would look this up after actual login. */
const DEMO_USER = {
  sub: "user-123",
  name: "Jane Doe",
  email: "jane@example.com",
};

/** Step 1: /authorize - where the browser gets redirected to "login" */
const authorize = async (req, res) => {
  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    nonce,
    scope,
  } = req.query;

  const client = REGISTERED_CLIENTS[client_id];

  if (!client) return res.status(400).send("Unknown client_id");
  if (!client.redirectUris.includes(redirect_uri))
    return res.status(400).send("redirect_uri not registered for this client");
  if (code_challenge_method !== "S256")
    return res.status(400).send("Only S256 PKCE is supported");

  console.log(
    `[IDP] /authorize - auto-approving demo user for client "${client_id}"`,
  );

  /**
   * In a real IdP, this is where a login form + consent screen would appear.
   * Here we skip straight to "User approved," and issue a one-time code.
   */
  const code = crypto.randomBytes(24).toString("hex");

  authCodes.set(code, {
    clientId: client_id,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    nonce,
    sub: DEMO_USER.sub,
    exp: Date.now() + 60_000, // codes are short-lived: 60s
  });

  const redirectUrl = new URL(redirect_uri);

  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("state", state);

  res.redirect(redirectUrl.toString());
};

app.get("/authorize", authorize);

/** Step 2: /token - the SP exchanges the code (+ PKCE verifier) for real tokens */
const token = async (req, res) => {
  const { grant_type, code, redirect_uri, client_id, code_verifier } = req.body;

  if (grant_type !== "authorization_code")
    return res.status(400).json({
      error: "unsupported_grant_type",
    });

  const stored = authCodes.get(code);

  if (!stored)
    return res.status(400).json({
      error: "invalid_grant",
      detail: "code not found or already used",
    });

  authCodes.delete(code); // single-use: burn the code immediately, whether this succeeds or not

  if (Date.now() > stored.exp)
    return res
      .status(400)
      .json({ error: "invalid_grant", detail: "code expired" });
  if (stored.clientId !== client_id || stored.redirectUri !== redirect_uri)
    return res
      .status(400)
      .json({ error: "invalid_grant", detail: "client/redirect mismatch" });

  /**
   * --- PKCE verification: this is the actual security check ---
   * The SP originally sent us a HASH of a secret (code_challenge).
   * Now it must present the ORIGINAL secret (code_verifier).
   * We hash it ourselves and confirm it matches what we were given up front.
   * This proves that whoever is exchanging the code is the SAME party that
   * started the flow — not an attacker who merely intercepted the code.
   */
  const computedChallenge = crypto
    .createHash("sha256")
    .update(code_verifier)
    .digest("base64url");

  if (computedChallenge !== stored.codeChallenge) {
    console.log("[IDP PKCE verification FAILED - rejecting token exchange");
    return res.status(400).json({
      error: "invalid_grant",
      detail: "PKCE verification failed",
    });
  }

  console.log("[IDP] PKCE verified successfully. Issuing tokens");

  const now = Math.floor(Date.now() / 1000);

  /** Access token: what the SP will send to the RESOURCE API to call it on the User's behalf. */
  const accessToken = await new SignJWT({ sub: stored.sub, scope: "profile" })
    .setProtectedHeader({
      alg: "RS256",
      kid: KEY_ID,
    })
    .setIssuedAt(now)
    .setIssuer(ISSUER)
    .setAudience("resource-api")
    .setExpirationTime(now + 300) // 5 minutes - short-lived on purpose
    .sign(signingKey.privateKey);

  /** ID token: proves to the SP WHO logged in. Never sent to any other service. */
  const idToken = await new SignJWT({
    sub: stored.sub,
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    nonce: stored.nonce,
  })
    .setProtectedHeader({
      alg: "RS256",
      kid: KEY_ID,
    })
    .setIssuedAt(now)
    .setIssuer(ISSUER)
    .setAudience(client_id)
    .setExpirationTime(now + 300) // 5 minutes - short-lived on purpose
    .sign(signingKey.privateKey);

  res.json({
    access_token: accessToken,
    id_token: idToken,
    token_type: "Bearer",
    expires_in: 300,
  });
};

app.post("/token", token);

/** JWKS endpoint: how ANY service (the SP, the resource API) gets our public key */
app.get("/.well-known/jwks.json", (req, res) => {
  res.json({ keys: [publicJwk] });
});

setupKeys().then(() => {
  app.listen(PORT, () => {
    console.log(`mock IdP running at ${ISSUER}`);
    console.log(`JWKS available at ${ISSUER}/.well-known/jwks.json\n`);
  });
});
