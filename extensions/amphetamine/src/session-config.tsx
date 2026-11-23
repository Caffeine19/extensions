import { useEffect, useState } from "react";
import { Action, ActionPanel, Color, Icon, List, Toast, showToast } from "@raycast/api";
import { runAppleScript } from "run-applescript";

import { formatRemainingSeconds } from "./session-time";
import { checkIfAmphetamineInstalled } from "./utils";

interface SessionConfig {
  isActive: boolean;
  remainingSeconds: number;
  displaySleepAllowed: boolean;
  screenSaverAllowed: boolean;
  /** Raw dictionary value; the Amphetamine UI checkbox is the inverse of this. */
  closedDisplayMode: boolean;
  isTrigger: boolean;
  triggersEnabled: boolean;
  driveAliveEnabled: boolean;
}

const READ_SCRIPT = `
  tell application "Amphetamine"
    set isActive to session is active
    set remaining to session time remaining
    set displaySleep to display sleep allowed
    set screenSaver to screen saver allowed
    set closedDisplay to closed display mode enabled
    set trig to session is Trigger
    set triggersOn to Triggers are enabled
    set driveAlive to Drive Alive is enabled
    return (isActive as text) & "|" & (remaining as text) & "|" & (displaySleep as text) & "|" & (screenSaver as text) & "|" & (closedDisplay as text) & "|" & (trig as text) & "|" & (triggersOn as text) & "|" & (driveAlive as text)
  end tell
`;

const REMAINING_TIME_RESULTS: Record<string, string> = {
  "0": "Indeterminate (infinite duration)",
  "-1": "Trigger-based",
  "-2": "App-based or until a specific time",
  "-3": "No session",
};

async function fetchSessionConfig(): Promise<SessionConfig> {
  const result = await runAppleScript(READ_SCRIPT);
  const [isActive, remaining, displaySleep, screenSaver, closedDisplay, isTrigger, triggersOn, driveAlive] =
    result.split("|");
  return {
    isActive: isActive === "true",
    remainingSeconds: Number(remaining),
    displaySleepAllowed: displaySleep === "true",
    screenSaverAllowed: screenSaver === "true",
    closedDisplayMode: closedDisplay === "true",
    isTrigger: isTrigger === "true",
    triggersEnabled: triggersOn === "true",
    driveAliveEnabled: driveAlive === "true",
  };
}

async function runToggleScript(script: string) {
  await runAppleScript(`tell application "Amphetamine"\n${script}\nend tell`);
}

interface ToggleItemProps {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => Promise<void>;
  onReload: () => Promise<void>;
}

function remainingText(config: SessionConfig): string {
  if (!config.isActive) return REMAINING_TIME_RESULTS[String(config.remainingSeconds)] ?? "No session";
  if (config.remainingSeconds > 0) return formatRemainingSeconds(config.remainingSeconds);
  return REMAINING_TIME_RESULTS[String(config.remainingSeconds)] ?? "Unknown";
}

function ToggleItem({ title, description, checked, onToggle, onReload }: ToggleItemProps) {
  return (
    <List.Item
      icon={{ source: checked ? Icon.CheckCircle : Icon.Circle, tintColor: Color.SecondaryText }}
      title={title}
      accessories={[
        {
          tag: { value: checked ? "On" : "Off", color: checked ? Color.Green : Color.SecondaryText },
          tooltip: description,
        },
      ]}
      actions={
        <ActionPanel>
          <Action title={checked ? `Turn Off ${title}` : `Turn On ${title}`} icon={Icon.Switch} onAction={onToggle} />
          <Action
            title="Reload"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={onReload}
          />
        </ActionPanel>
      }
    />
  );
}

export default function SessionConfig() {
  const [config, setConfig] = useState<SessionConfig>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    setError(undefined);

    if (!(await checkIfAmphetamineInstalled())) {
      setError("Amphetamine is not installed.");
      setIsLoading(false);
      return;
    }

    try {
      setConfig(await fetchSessionConfig());
    } catch {
      setError("Failed to read the session config. Allow Raycast to control Amphetamine when prompted.");
    } finally {
      setIsLoading(false);
    }
  }

  async function toggle(script: string) {
    const toast = await showToast({ title: "Updating…", style: Toast.Style.Animated });
    try {
      await runToggleScript(script);
      await load();
      toast.style = Toast.Style.Success;
      toast.title = "Updated";
    } catch {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to update the setting";
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (error) {
    return (
      <List isLoading={false}>
        <List.EmptyView
          title="Session Config"
          description={error}
          icon={{ source: Icon.ExclamationMark, tintColor: Color.SecondaryText }}
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} navigationTitle="Session Config">
      {!config ? null : (
        <>
          <List.Section title="Current Session">
            <List.Item
              icon={{ source: config.isActive ? Icon.Play : Icon.Stop, tintColor: Color.SecondaryText }}
              title="Status"
              accessories={[
                {
                  tag: {
                    value: config.isActive ? "Active" : "Not active",
                    color: config.isActive ? Color.Green : Color.SecondaryText,
                  },
                },
                ...(config.isTrigger ? [{ tag: { value: "Trigger", color: Color.Yellow } }] : []),
              ]}
              actions={
                <ActionPanel>
                  <Action title="Reload" icon={Icon.ArrowClockwise} onAction={load} />
                </ActionPanel>
              }
            />
            <List.Item
              icon={{ source: Icon.Clock, tintColor: Color.SecondaryText }}
              title="Remaining Time"
              accessories={[
                {
                  tag: {
                    value: remainingText(config),
                    color: config.isActive ? Color.Green : Color.SecondaryText,
                  },
                },
              ]}
              actions={
                <ActionPanel>
                  <Action title="Reload" icon={Icon.ArrowClockwise} onAction={load} />
                </ActionPanel>
              }
            />
          </List.Section>

          <List.Section
            title="Sleep Settings"
            subtitle={
              config.isActive ? "Applies to the running session." : "No session running — reflects global preferences."
            }
          >
            <ToggleItem
              title="Allow Display Sleep"
              description="When on, the session keeps the Mac awake but lets the display turn off."
              checked={config.displaySleepAllowed}
              onToggle={() => toggle(config.displaySleepAllowed ? "prevent display sleep" : "allow display sleep")}
              onReload={load}
            />
            <ToggleItem
              title="Allow Screen Saver"
              description="When on, screen saver activation is permitted during the session."
              checked={config.screenSaverAllowed}
              onToggle={() => toggle(config.screenSaverAllowed ? "prevent screen saver" : "allow screen saver")}
              onReload={load}
            />
            <ToggleItem
              title="Allow System Sleep When Display Is Closed"
              description="Dictionary value is the inverse of the Amphetamine UI checkbox. Enabling may show a one-time warning prompt in Amphetamine."
              checked={!config.closedDisplayMode}
              onToggle={() =>
                toggle(config.closedDisplayMode ? "disable closed display mode" : "enable closed display mode")
              }
              onReload={load}
            />
          </List.Section>

          <List.Section title="Automation">
            <ToggleItem
              title="Triggers"
              description="Enable or disable Trigger-based session activation in Amphetamine preferences."
              checked={config.triggersEnabled}
              onToggle={() => toggle(config.triggersEnabled ? "disable Triggers" : "enable Triggers")}
              onReload={load}
            />
            <ToggleItem
              title="Drive Alive"
              description="Drive Alive keeps your Mac awake while a drive is spinning. Toggle it in Amphetamine preferences."
              checked={config.driveAliveEnabled}
              onToggle={() => toggle(config.driveAliveEnabled ? "disable Drive Alive" : "enable Drive Alive")}
              onReload={load}
            />
          </List.Section>
        </>
      )}
    </List>
  );
}
