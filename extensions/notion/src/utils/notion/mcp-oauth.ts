/**
 * MCP OAuth 2.0 + PKCE authentication module.
 *
 * The hosted Notion MCP server (https://mcp.notion.com/mcp) requires
 * OAuth 2.0 authentication with PKCE. Personal Access Tokens are NOT supported.
 *
 * This module handles:
 * - Dynamic client registration (RFC 7591)
 * - OAuth authorization flow with PKCE
 * - Token exchange and storage
 * - Token refresh
 */

import { OAuth, LocalStorage, showToast, Toast } from "@raycast/api";

// OAuth endpoints discovered from https://mcp.notion.com/.well-known/oauth-authorization-server
const MCP_AUTHORIZE_URL = "https://mcp.notion.com/authorize";
const MCP_TOKEN_URL = "https://mcp.notion.com/token";
const MCP_REGISTER_URL = "https://mcp.notion.com/register";

// Storage keys
const MCP_CLIENT_ID_KEY = "mcp_oauth_client_id";

// MCP OAuth PKCE client (separate from the existing Notion API OAuth)
const mcpClient = new OAuth.PKCEClient({
  redirectMethod: OAuth.RedirectMethod.Web,
  providerName: "Notion MCP",
  providerIcon: "notion-logo.png",
  providerId: "notion-mcp",
  description: "Connect to Notion MCP for enhanced search across your workspace content",
});

/**
 * Register a new OAuth client with the Notion MCP server (RFC 7591).
 * Caches the client_id in LocalStorage for reuse.
 * The redirect_uri must match what Raycast's PKCEClient generates.
 */
async function registerMCPOAuthClient(redirectUri: string): Promise<string> {
  // Check if we already have a cached client_id
  const cachedClientId = await LocalStorage.getItem<string>(MCP_CLIENT_ID_KEY);
  if (cachedClientId) {
    console.log("[MCP OAuth] Using cached client_id:", cachedClientId);
    return cachedClientId;
  }

  console.log("[MCP OAuth] Registering new OAuth client with redirect_uri:", redirectUri);

  const response = await fetch(MCP_REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Raycast Notion MCP",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[MCP OAuth] Registration failed:", response.status, errorText);
    // Clear cached client_id if registration fails (maybe the old one is invalid)
    await LocalStorage.removeItem(MCP_CLIENT_ID_KEY);
    throw new Error(`Failed to register MCP OAuth client: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as { client_id: string; client_id_issued_at?: number };
  console.log("[MCP OAuth] Registered client_id:", data.client_id);

  // Cache the client_id
  await LocalStorage.setItem(MCP_CLIENT_ID_KEY, data.client_id);

  return data.client_id;
}

/**
 * Start the MCP OAuth flow.
 * 1. Create authorization request to determine the redirect URI
 * 2. Register the client dynamically with that exact redirect URI
 * 3. Open browser for user authorization
 * 4. Exchange authorization code for tokens
 */
export async function authorizeMCP(): Promise<void> {
  console.log("[MCP OAuth] Starting authorization flow...");

  // Step 1: Check if we have a cached client_id
  const cachedClientId = await LocalStorage.getItem<string>(MCP_CLIENT_ID_KEY);

  // Step 2: Create authorization request to get the exact redirect URI
  // If we don't have a client_id yet, use a temporary one just to get the redirect URI
  const tempAuthRequest = await mcpClient.authorizationRequest({
    endpoint: MCP_AUTHORIZE_URL,
    clientId: cachedClientId || "placeholder",
    scope: "",
  });

  const redirectUri = tempAuthRequest.redirectURI;
  console.log("[MCP OAuth] PKCEClient generated redirect_uri:", redirectUri);

  // Step 3: Register client (or use cached) with the exact redirect URI
  let clientId: string;

  if (cachedClientId) {
    // We already have a client_id, but the redirect_uri might not be registered
    // Re-register to ensure the current redirect_uri is included
    console.log("[MCP OAuth] Re-registering with cached client_id and redirect_uri");
    clientId = cachedClientId;
    // Try to use the cached client first. If it fails, we'll register a new one.
    // For safety, also register a new client with the current redirect_uri
    try {
      const registerResponse = await fetch(MCP_REGISTER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Raycast Notion MCP",
          redirect_uris: [redirectUri],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        }),
      });

      if (registerResponse.ok) {
        const data = (await registerResponse.json()) as { client_id: string };
        clientId = data.client_id;
        console.log("[MCP OAuth] Registered new client_id:", clientId);
        await LocalStorage.setItem(MCP_CLIENT_ID_KEY, clientId);
      } else {
        console.log("[MCP OAuth] Using cached client_id:", clientId);
      }
    } catch {
      console.log("[MCP OAuth] Registration error, using cached client_id:", clientId);
    }
  } else {
    // No cached client_id, register a new one
    clientId = await registerMCPOAuthClient(redirectUri);
  }

  // Step 4: Create the actual authorization request with the real client_id
  const authRequest = await mcpClient.authorizationRequest({
    endpoint: MCP_AUTHORIZE_URL,
    clientId,
    scope: "",
  });

  console.log("[MCP OAuth] Authorization request created, redirect_uri:", authRequest.redirectURI);

  // Step 5: Open browser for user authorization
  const { authorizationCode } = await mcpClient.authorize(authRequest);

  console.log("[MCP OAuth] Authorization code received, exchanging for tokens...");

  // Step 6: Exchange authorization code for tokens
  // Notion MCP token endpoint requires application/x-www-form-urlencoded
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code: authorizationCode,
    redirect_uri: authRequest.redirectURI,
    code_verifier: authRequest.codeVerifier,
    client_id: clientId,
  });

  const tokenResponse = await fetch(MCP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("[MCP OAuth] Token exchange failed:", tokenResponse.status, errorText);
    throw new Error(`Failed to exchange authorization code: ${tokenResponse.status} - ${errorText}`);
  }

  const tokens = (await tokenResponse.json()) as OAuth.TokenResponse;
  console.log("[MCP OAuth] Tokens received, access_token length:", tokens.access_token?.length);

  // Step 7: Store tokens securely
  await mcpClient.setTokens(tokens);

  console.log("[MCP OAuth] Authorization complete!");
}

/**
 * Get a valid MCP OAuth access token.
 * Refreshes the token if it's expired.
 * Returns undefined if not authenticated.
 */
export async function getMCPAccessToken(): Promise<string | undefined> {
  const tokens = await mcpClient.getTokens();

  if (!tokens?.accessToken) {
    console.log("[MCP OAuth] No access token found");
    return undefined;
  }

  // Check if token is expired and needs refresh
  if (tokens.isExpired()) {
    console.log("[MCP OAuth] Access token expired, refreshing...");
    const refreshed = await refreshMCPToken();
    if (!refreshed) {
      console.log("[MCP OAuth] Token refresh failed");
      return undefined;
    }
    // Get the refreshed token
    const newTokens = await mcpClient.getTokens();
    return newTokens?.accessToken;
  }

  return tokens.accessToken;
}

/**
 * Refresh the MCP OAuth access token using the refresh token.
 * Returns true if the refresh was successful.
 */
async function refreshMCPToken(): Promise<boolean> {
  const tokens = await mcpClient.getTokens();
  if (!tokens?.refreshToken) {
    console.log("[MCP OAuth] No refresh token available");
    return false;
  }

  const clientId = await LocalStorage.getItem<string>(MCP_CLIENT_ID_KEY);
  if (!clientId) {
    console.log("[MCP OAuth] No client_id available for refresh");
    return false;
  }

  try {
    const response = await fetch(MCP_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
        client_id: clientId,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[MCP OAuth] Token refresh failed:", response.status, errorText);
      // Clear tokens so user needs to re-authorize
      await mcpClient.removeTokens();
      // Also clear cached client_id since it might be invalid
      await LocalStorage.removeItem(MCP_CLIENT_ID_KEY);
      return false;
    }

    const newTokens = (await response.json()) as OAuth.TokenResponse;
    await mcpClient.setTokens(newTokens);

    console.log("[MCP OAuth] Token refreshed successfully");
    return true;
  } catch (error) {
    console.error("[MCP OAuth] Token refresh error:", error);
    return false;
  }
}

/**
 * Check if the user is authenticated with MCP.
 */
export async function isMCPAuthenticated(): Promise<boolean> {
  const tokens = await mcpClient.getTokens();
  return !!tokens?.accessToken;
}

/**
 * Sign out of MCP (remove stored tokens and cached client_id).
 */
export async function signOutMCP(): Promise<void> {
  await mcpClient.removeTokens();
  await LocalStorage.removeItem(MCP_CLIENT_ID_KEY);
  console.log("[MCP OAuth] Signed out and cleared cache");
}

/**
 * Authorize MCP with error handling and toast notifications.
 * This is the main entry point for the UI.
 */
export async function authorizeMCPWithToast(): Promise<boolean> {
  try {
    await authorizeMCP();
    await showToast({
      style: Toast.Style.Success,
      title: "Connected to Notion MCP",
      message: "You can now search across your workspace content",
    });
    return true;
  } catch (error) {
    console.error("[MCP OAuth] Authorization failed:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to connect to Notion MCP",
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}