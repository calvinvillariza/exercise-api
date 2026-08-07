import { createRemoteJWKSet } from "jose";
import { PORT } from "../config/env";

const CLIENT_ID = "sp-web-app";
const REDIRECT_URI = `http://localhost:${PORT}/api/exercise/callback`;

/** The IdP's identity — must stay this literal string since it's what the
 * IdP signs into every token's `iss` claim. Also the browser-facing address
 * for the /authorize redirect, since the browser runs outside Docker.
 */
const IDP_ISSUER = "http://localhost:4000";
/** Where we actually send server-to-server requests to the IdP (token
 * exchange, JWKS fetch). Same as IDP_ISSUER unless overridden — e.g. Docker
 * Compose points this at the `idp` service instead of localhost.
 */
const IDP_BASE_URL = process.env.IDP_BASE_URL || IDP_ISSUER;
const RESOURCE_API = process.env.RESOURCE_API_URL || "http://localhost:5000";

const JWKS = createRemoteJWKSet(
  new URL(`${IDP_BASE_URL}/.well-known/jwks.json`),
);

/** In-memory store keyed by `state`, tracking the PKCE verifier + nonce for
 * each in-flight login attempt. In a real multi-instance deployment this
 * would need to live in a shared store (Redis, etc.) rather than local
 * memory — noted in the README.
 */
const pendingLogins = new Map();

/** Very simple in-memory "sessions" — maps a random session id to the user's
 *  tokens. In a real app this might be a signed cookie or a server session store.
 */
const sessions = new Map();

const base64Url = (buffer: Buffer) => {
  return buffer.toString("base64url");
};

export const LoginService = {
  base64Url,
  IDP_ISSUER,
  IDP_BASE_URL,
  CLIENT_ID,
  REDIRECT_URI,
  pendingLogins,
  JWKS,
  sessions,
  RESOURCE_API,
};
