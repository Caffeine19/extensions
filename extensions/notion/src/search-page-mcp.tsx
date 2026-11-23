import { ActionPanel, Action, Icon, List, showToast, Toast } from "@raycast/api";
import { useState, useEffect, useCallback } from "react";

import {
  mcpInitialize,
  mcpSearch,
  MCPSearchResult,
  ContentSearchMode,
} from "./utils/notion/mcp-client";
import { authorizeMCPWithToast, getMCPAccessToken } from "./utils/notion/mcp-oauth";

function SearchMCP() {
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<MCPSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [searchMode, setSearchMode] = useState<ContentSearchMode>("workspace_search");

  // Check authentication status on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getMCPAccessToken();
        if (token) {
          setIsAuthenticated(true);
        }
      } catch {
        // Not authenticated
      }
    })();
  }, []);

  // Initialize MCP session when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    (async () => {
      try {
        await mcpInitialize();
        if (!cancelled) {
          setInitialized(true);
        }
      } catch (e) {
        if (!cancelled) {
          // If auth expired, reset state
          if (e instanceof Error && e.message.includes("authentication expired")) {
            setIsAuthenticated(false);
          }
          await showToast({
            style: Toast.Style.Failure,
            title: "MCP connection failed",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Authorize with Notion MCP
  const authorize = useCallback(async () => {
    setIsAuthorizing(true);
    try {
      const success = await authorizeMCPWithToast();
      if (success) {
        setIsAuthenticated(true);
      }
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Authorization failed",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsAuthorizing(false);
    }
  }, []);

  // Search when text changes
  const doSearch = useCallback(
    async (query: string) => {
      if (!initialized || !query.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await mcpSearch({
          query: query.trim(),
          contentSearchMode: searchMode,
          pageSize: 25,
        });
        setResults(results);
      } catch (e) {
        // If auth expired, reset state
        if (e instanceof Error && e.message.includes("authentication expired")) {
          setIsAuthenticated(false);
          setInitialized(false);
        }
        await showToast({
          style: Toast.Style.Failure,
          title: "Search failed",
          message: e instanceof Error ? e.message : String(e),
        });
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [initialized, searchMode],
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, doSearch]);

  const getIcon = (result: MCPSearchResult) => {
    if (result.type === "database") return Icon.List;
    return Icon.Document;
  };

  const getAccessories = (result: MCPSearchResult) => {
    const accessories: List.Item.Accessory[] = [];
    if (result.type === "database") {
      accessories.push({ icon: Icon.List, tooltip: "Database" });
    }
    if (result.timestamp) {
      const date = new Date(result.timestamp);
      accessories.push({
        text: date.toLocaleDateString(),
        tooltip: `Last edited: ${date.toLocaleString()}`,
      });
    }
    return accessories;
  };

  // Show authorization screen if not authenticated
  if (!isAuthenticated) {
    return (
      <List>
        <List.EmptyView
          title="Connect to Notion MCP"
          description="Authorize to search across your workspace content, including database entries and page content"
          icon={Icon.Key}
          actions={
            <ActionPanel>
              <Action
                title="Connect to Notion MCP"
                icon={Icon.Key}
                onAction={authorize}
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  // Show authorizing state
  if (isAuthorizing) {
    return <List isLoading={true} searchBarPlaceholder="Authorizing..." />;
  }

  return (
    <List
      isLoading={isLoading || !initialized}
      searchBarPlaceholder="Search Notion (MCP-powered)"
      onSearchTextChange={setSearchText}
      throttle
      searchBarAccessory={
        <List.Dropdown
          tooltip="Search Mode"
          value={searchMode}
          onChange={(value) => setSearchMode(value as ContentSearchMode)}
        >
          <List.Dropdown.Item title="Workspace Search" value="workspace_search" />
          <List.Dropdown.Item title="AI Search" value="ai_search" />
        </List.Dropdown>
      }
    >
      {results.length > 0 ? (
        <List.Section title={`Results (${results.length})`}>
          {results.map((result) => (
            <List.Item
              key={result.id}
              icon={getIcon(result)}
              title={result.title || "Untitled"}
              subtitle={result.highlight}
              accessories={getAccessories(result)}
              actions={
                <ActionPanel>
                  <Action.OpenInBrowser title="Open in Notion" url={result.url} />
                  <Action.CopyToClipboard title="Copy Link" content={result.url} />
                  <Action.CopyToClipboard title="Copy Title" content={result.title} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : searchText.trim() && !isLoading && initialized ? (
        <List.EmptyView
          title="No results found"
          description={`No pages found for "${searchText}"`}
          icon={Icon.MagnifyingGlass}
        />
      ) : (
        <List.EmptyView
          title="Search your Notion workspace"
          description="Type to search across all pages and databases"
          icon={Icon.MagnifyingGlass}
        />
      )}
    </List>
  );
}

export default SearchMCP;
