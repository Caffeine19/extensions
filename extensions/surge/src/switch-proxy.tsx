import { ActionPanel, Icon, List, getPreferenceValues, showHUD, showToast, Color, Toast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState, useEffect } from "react";
import api from "./api.js";
import { testAllPolicies, DelayInfo } from "./cli.js";

type DelayRecord = Record<string, DelayInfo>;

interface PolicyOption {
  name: string;
  lineHash: string;
}

interface PolicyGroups {
  [groupName: string]: PolicyOption[];
}

type DelayLevel = "all" | "fast" | "medium" | "slow" | "failed";

function getDelayLevel(delayInfo: DelayInfo | undefined): DelayLevel {
  if (!delayInfo) return "all";
  if (delayInfo.failed) return "failed";
  if (delayInfo.rtt === undefined) return "all";
  if (delayInfo.rtt < 100) return "fast";
  if (delayInfo.rtt < 200) return "medium";
  return "slow";
}

function getDelayColor(rtt: number | undefined, failed: boolean): Color {
  if (failed || rtt === undefined) return Color.Red;
  if (rtt < 100) return Color.Green;
  if (rtt < 200) return Color.Yellow;
  if (rtt < 300) return Color.Orange;
  return Color.Red;
}

function formatDelay(delayInfo: DelayInfo | undefined, isTesting: boolean): string {
  if (delayInfo) {
    if (delayInfo.failed) return "Failed";
    if (delayInfo.rtt !== undefined) {
      return `${delayInfo.rtt}ms`;
    }
  }
  if (isTesting) return "Testing...";
  return "";
}

function getDelayIcon(delayInfo: DelayInfo | undefined, isTesting: boolean): Icon {
  if (delayInfo) {
    if (delayInfo.failed) return Icon.XMarkCircle;
    return Icon.Bolt;
  }
  if (isTesting) return Icon.Clock;
  return Icon.Circle;
}

export default function Command() {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  const xKey = preferences["x-key"];
  const port = preferences.port;

  const [policyGroups, setPolicyGroups] = useState<PolicyGroups>({});
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<DelayLevel>("all");

  // Use useCachedPromise to cache delay data (convert Map to object for JSON serialization)
  const { data: delayData = {}, isLoading: isTesting } = useCachedPromise(
    async (): Promise<DelayRecord> => {
      const result = await testAllPolicies();
      return Object.fromEntries(result);
    },
    [],
    {
      keepPreviousData: true,
    },
  );

  // Fetch policy groups first (fast)
  useEffect(() => {
    async function fetchPolicyData() {
      try {
        // Fetch policy groups
        const groupsResponse = await api(xKey, port).getPolicyGroups();
        const groups = groupsResponse.data;

        setPolicyGroups(groups);

        // Fetch current selected options for each group
        const groupNames = Object.keys(groups);
        const selectedOptionsPromises = groupNames.map((groupName) =>
          api(xKey, port).getSelectOptionFromPolicyGroup(groupName),
        );

        const selectedOptionsResponses = await Promise.all(selectedOptionsPromises);
        const currentSelections = selectedOptionsResponses.map((response) => response.data.policy);
        setSelectedOptions(currentSelections);
      } catch (err) {
        console.error("Failed to fetch policy data:", err);
        await showToast(Toast.Style.Failure, "Failed to fetch proxy policies", "Please check your X-Key and port");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPolicyData();
  }, []);

  async function switchProxy(groupName: string, optionName: string) {
    try {
      await api(xKey, port).changeOptionOfGroup(groupName, optionName);
      await showHUD(`🔄 Switched ${groupName} to ${optionName}`);

      // Update local state to reflect the change
      const groupNames = Object.keys(policyGroups);
      const groupIndex = groupNames.indexOf(groupName);
      if (groupIndex !== -1) {
        const newSelectedOptions = [...selectedOptions];
        newSelectedOptions[groupIndex] = optionName;
        setSelectedOptions(newSelectedOptions);
      }
    } catch (error) {
      console.error("🚀 ~ switch-proxy.tsx:66 ~ switchProxy ~ error:", error);
      await showToast(
        Toast.Style.Failure,
        "Failed to switch proxy",
        "Please check your X-Key, port and function availability",
      );
    }
  }

  const groupEntries = Object.entries(policyGroups);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search proxy policies..."
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by Delay" value={filterLevel} onChange={(v) => setFilterLevel(v as DelayLevel)}>
          <List.Dropdown.Item title="Available" value="all" icon={Icon.Globe} />
          <List.Dropdown.Item title="Fast (<100ms)" value="fast" icon={{ source: Icon.Bolt, tintColor: Color.Green }} />
          <List.Dropdown.Item
            title="Medium (100-200ms)"
            value="medium"
            icon={{ source: Icon.Bolt, tintColor: Color.Yellow }}
          />
          <List.Dropdown.Item
            title="Slow (>200ms)"
            value="slow"
            icon={{ source: Icon.Bolt, tintColor: Color.Orange }}
          />
          <List.Dropdown.Item title="Failed" value="failed" icon={{ source: Icon.XMarkCircle, tintColor: Color.Red }} />
        </List.Dropdown>
      }
    >
      {groupEntries.map(([groupName, groupOptions], groupIndex) => {
        const currentSelection = selectedOptions[groupIndex];

        return groupOptions
          .filter((option) => {
            const delayInfo = delayData[option.name];
            if (filterLevel === "all") {
              // Exclude failed from "all"
              return !delayInfo?.failed;
            }

            return getDelayLevel(delayInfo) === filterLevel;
          })
          .map((option) => {
            const isSelected = currentSelection === option.name;
            const delayInfo = delayData[option.name];
            const delayText = formatDelay(delayInfo, isTesting);

            return (
              <List.Item
                key={`${groupName}-${option.name}`}
                icon={{
                  source: Icon.MemoryChip,
                  tintColor: isSelected ? Color.Green : Color.SecondaryText,
                }}
                title={option.name}
                subtitle={`${groupName}${isSelected ? " (Current)" : ""}`}
                accessories={[
                  ...(isSelected ? [{ icon: Icon.Checkmark }] : []),
                  ...(delayText
                    ? [
                        {
                          text: delayText,
                          icon: {
                            source: getDelayIcon(delayInfo, isTesting),
                            tintColor: delayInfo ? getDelayColor(delayInfo.rtt, delayInfo.failed) : Color.SecondaryText,
                          },
                        },
                      ]
                    : []),
                ]}
                actions={
                  <ActionPanel>
                    <ActionPanel.Item
                      title={`Switch to ${option.name}`}
                      onAction={() => switchProxy(groupName, option.name)}
                      icon={Icon.ArrowRight}
                    />
                  </ActionPanel>
                }
              />
            );
          });
      })}
    </List>
  );
}
