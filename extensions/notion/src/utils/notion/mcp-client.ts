/**
 * MCP (Model Context Protocol) HTTP client for Notion's hosted MCP server.
 *
 * Uses OAuth 2.0 + PKCE for authentication (required by the hosted server).
 * Personal Access Tokens are NOT supported by https://mcp.notion.com/mcp.
 *
 * Protocol reference: https://spec.modelcontextprotocol.io/
 * Server endpoint: https://mcp.notion.com/mcp
 */

import { getMCPAccessToken, authorizeMCPWithToast, isMCPAuthenticated } from "./mcp-oauth";

function log(message: string, ...args: unknown[]) {
  console.log(`[MCP] ${message}`, ...args);
}

export interface MCPToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: MCPToolResult & { _meta?: Record<string, unknown> };
  error?: { code: number; message: string; data?: unknown };
}

const MCP_ENDPOINT = "https://mcp.notion.com/mcp";
let sessionId: string | undefined;

async function mcpRequest(method: string, params: Record<string, unknown> = {}): Promise<MCPResponse> {
  const token = await getMCPAccessToken();
  if (!token) {
    throw new Error("Not authenticated with Notion MCP. Please authorize first.");
  }

  log(`Token available, length: ${token.length}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2025-09-03",
  };

  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params,
  });

  log(`Sending ${method} request to ${MCP_ENDPOINT}`);

  const response = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers,
    body,
  });

  log(`Response status: ${response.status} ${response.statusText}`);

  // Handle 401 Unauthorized (token may have expired)
  if (response.status === 401) {
    log("Received 401 Unauthorized - token may have expired");
    // Clear the session so we re-initialize on next attempt
    sessionId = undefined;
    throw new Error("Notion MCP authentication expired. Please re-authorize.");
  }

  // Capture session ID from response
  const responseSessionId = response.headers.get("mcp-session-id");
  if (responseSessionId) {
    sessionId = responseSessionId;
    log(`Session ID: ${sessionId}`);
  }

  const contentType = response.headers.get("content-type") || "";
  log(`Content-Type: ${contentType}`);

  if (contentType.includes("text/event-stream")) {
    // Handle SSE response
    const text = await response.text();
    log(`SSE response text: ${text.substring(0, 500)}...`);
    return parseSSEResponse(text);
  }

  const jsonResponse = await response.json();
  log(`JSON response:`, jsonResponse);
  return jsonResponse as MCPResponse;
}

function parseSSEResponse(sseText: string): MCPResponse {
  // SSE format: lines starting with "data: " contain JSON
  const lines = sseText.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const jsonStr = line.slice(6).trim();
      if (jsonStr) {
        try {
          return JSON.parse(jsonStr) as MCPResponse;
        } catch {
          // continue to next data line
        }
      }
    }
  }
  throw new Error("Failed to parse SSE response from MCP server");
}

/**
 * Initialize the MCP session with the Notion server.
 * Requires OAuth authentication - call authorizeMCP() first or ensure tokens exist.
 */
export async function mcpInitialize(): Promise<void> {
  await mcpRequest("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: {
      name: "raycast-notion-extension",
      version: "1.0.0",
    },
  });

  // Send initialized notification
  await mcpRequest("notifications/initialized", {});
}

export type ContentSearchMode = "workspace_search" | "ai_search";

export interface MCPSearchOptions {
  query: string;
  queryType?: "internal";
  contentSearchMode?: ContentSearchMode;
  pageSize?: number;
}

export interface MCPSearchResult {
  id: string;
  title: string;
  url: string;
  type: "page" | "database";
  highlight?: string;
  timestamp?: string;
}

export interface MCPSearchResponse {
  results: MCPSearchResult[];
  type: string;
}

/**
 * Search using the Notion MCP's search tool.
 * This provides much richer results than the standard Notion API search,
 * including content within database entries and full page content.
 *
 * Requires OAuth authentication - call authorizeMCP() first.
 */
export async function mcpSearch(options: MCPSearchOptions): Promise<MCPSearchResult[]> {
  const args: Record<string, unknown> = {
    query: options.query,
    query_type: options.queryType ?? "internal",
    content_search_mode: options.contentSearchMode ?? "workspace_search",
  };

  if (options.pageSize) {
    args.page_size = options.pageSize;
  }

  log(`Searching with args:`, args);

  const response = await mcpRequest("tools/call", {
    name: "search",
    arguments: args,
  });

  log(`Search response received:`, response);

  if (response.error) {
    log(`MCP error:`, response.error);
    throw new Error(`MCP search error: ${JSON.stringify(response.error)}`);
  }

  if (!response.result) {
    log(`No result in response`);
    throw new Error("MCP search returned no result");
  }

  if (response.result.isError) {
    const errorText = response.result.content.map((c) => c.text).join("\n");
    log(`MCP tool error:`, errorText);
    throw new Error(`MCP search error: ${errorText}`);
  }

  // Parse the result content
  const contentText = response.result.content.map((c) => c.text).join("");
  log(`Parsing content: ${contentText.substring(0, 200)}...`);

  try {
    const searchResponse: MCPSearchResponse = JSON.parse(contentText);
    log(`Parsed ${searchResponse.results?.length ?? 0} results`);
    return searchResponse.results ?? [];
  } catch (e) {
    log(`Failed to parse search response:`, e);
    throw new Error(`Failed to parse MCP search response: ${e}`);
  }
}
