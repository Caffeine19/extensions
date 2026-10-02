import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const SURGE_CLI_PATH = "/Applications/Surge.app/Contents/Applications/surge-cli";

export interface DelayInfo {
  rtt?: number;
  total?: number;
  failed: boolean;
}

export type DelayMap = Map<string, DelayInfo>;

function parseDelayOutput(output: string): DelayMap {
  const delayMap: DelayMap = new Map();
  const lines = output.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Match format: "PolicyName: RTT 125 ms, Total 692 ms" or "PolicyName: Failed"
    const failedMatch = trimmedLine.match(/^(.+?):\s*Failed$/);
    if (failedMatch) {
      delayMap.set(failedMatch[1].trim(), { failed: true });
      continue;
    }

    const successMatch = trimmedLine.match(/^(.+?):\s*RTT\s+(\d+)\s*ms,\s*Total\s+(\d+)\s*ms$/);
    if (successMatch) {
      delayMap.set(successMatch[1].trim(), {
        rtt: parseInt(successMatch[2], 10),
        total: parseInt(successMatch[3], 10),
        failed: false,
      });
    }
  }

  return delayMap;
}

export async function testAllPolicies(): Promise<DelayMap> {
  const { stdout } = await execAsync(`${SURGE_CLI_PATH} test-all-policies`, { timeout: 30000 });
  return parseDelayOutput(stdout);
}
