/**
 * CLI Handler
 *
 * Handles CLI commands for configuration and authentication management.
 * Executed when the server is run with 'config' or 'auth' arguments.
 */

import { SettingsManager, ProfileName } from "./settings-manager.js";
import { CONFIG } from "../config.js";
import fs from "fs/promises";
import path from "path";

export class CliHandler {
  private settingsManager: SettingsManager;

  constructor() {
    this.settingsManager = new SettingsManager();
  }

  async handleCommand(args: string[]): Promise<void> {
    const command = args[0];
    const subCommand = args[1];

    try {
      if (command === "config") {
        switch (subCommand) {
          case "set":
            await this.handleSet(args.slice(2));
            break;
          case "get":
            this.handleGet();
            break;
          case "reset":
            await this.handleReset();
            break;
          default:
            this.printHelp();
        }
      } else if (command === "auth") {
        switch (subCommand) {
          case "export":
            await this.handleAuthExport();
            break;
          case "status":
            await this.handleAuthStatus();
            break;
          default:
            this.printAuthHelp();
        }
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  private async handleSet(args: string[]): Promise<void> {
    const key = args[0];
    const value = args[1];

    if (!key || !value) {
      throw new Error("Usage: config set <key> <value>");
    }

    if (key === "profile") {
      if (!["minimal", "standard", "full"].includes(value)) {
        throw new Error("Invalid profile. Allowed: minimal, standard, full");
      }
      await this.settingsManager.saveSettings({ profile: value as ProfileName });
      console.log(`✅ Profile set to: ${value}`);
    } else if (key === "disabled-tools") {
      const tools = value.split(",").map(t => t.trim()).filter(t => t.length > 0);
      await this.settingsManager.saveSettings({ disabledTools: tools });
      console.log(`✅ Disabled tools set to: ${tools.join(", ") || "(none)"}`);
    } else {
      throw new Error(`Unknown setting: ${key}. Allowed: profile, disabled-tools`);
    }
  }

  private handleGet(): void {
    const settings = this.settingsManager.getEffectiveSettings();
    const profiles = this.settingsManager.getProfiles();
    
    console.log("🔧 Current Configuration:");
    console.log(`  Profile: ${settings.profile}`);
    console.log(`  Disabled Tools: ${settings.disabledTools.length > 0 ? settings.disabledTools.join(", ") : "(none)"}`);
    console.log(`  Settings File: ${this.settingsManager.getSettingsPath()}`);
    console.log("");
    console.log("📋 Active Tools in this profile:");
    
    const activeInProfile = profiles[settings.profile];
    if (activeInProfile.includes("*")) {
      console.log("  - All Tools (except disabled)");
    } else {
      activeInProfile.forEach(t => console.log(`  - ${t}`));
    }
  }

  private async handleReset(): Promise<void> {
    await this.settingsManager.saveSettings({
      profile: "full",
      disabledTools: []
    });
    console.log("✅ Configuration reset to defaults (Profile: full, No disabled tools)");
  }

  // ============================================================================
  // Auth Commands (for CI/CD headless auth)
  // ============================================================================

  private async handleAuthExport(): Promise<void> {
    const statePath = path.join(CONFIG.browserStateDir, "state.json");

    try {
      await fs.access(statePath);
      const stats = await fs.stat(statePath);
      const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

      console.log("🔐 Auth State Export\n");
      console.log(`📁 File: ${statePath}`);
      console.log(`📅 Age: ${ageHours.toFixed(1)} hours`);
      console.log("");
      console.log("For CI/CD, set one of these environment variables:\n");
      console.log(`  export GOOGLE_AUTH_COOKIES_PATH="${statePath}"`);
      console.log("");
      console.log("Or copy the file to your CI/CD environment:");
      console.log(`  cp "${statePath}" ./auth-state.json`);
      console.log("  export GOOGLE_AUTH_COOKIES_PATH=./auth-state.json");
      console.log("");
      console.log("⚠️  Keep this file secure — it contains your Google session!");
    } catch {
      console.log("❌ No auth state found.\n");
      console.log("Run the MCP server and use 'setup_auth' tool first:");
      console.log("  1. Start server: npx notebooklm-mcp");
      console.log("  2. In Claude/Codex: \"Log me in to NotebookLM\"");
      console.log("  3. Complete Google login in browser");
      console.log("  4. Run: npx notebooklm-mcp auth export");
    }
  }

  private async handleAuthStatus(): Promise<void> {
    const statePath = path.join(CONFIG.browserStateDir, "state.json");

    try {
      await fs.access(statePath);
      const stats = await fs.stat(statePath);
      const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
      const maxAgeHours = 24 * 14; // ~2 weeks

      const content = await fs.readFile(statePath, "utf-8");
      const state = JSON.parse(content);
      const cookieCount = state.cookies?.length || 0;

      console.log("🔐 Auth Status\n");
      console.log(`📁 File: ${statePath}`);
      console.log(`🍪 Cookies: ${cookieCount}`);
      console.log(`📅 Age: ${ageHours.toFixed(1)} hours (${(ageHours / 24).toFixed(1)} days)`);

      if (ageHours > maxAgeHours) {
        console.log("\n❌ Auth likely EXPIRED (>14 days old)");
        console.log("   Run 'setup_auth' tool to re-authenticate");
      } else if (ageHours > maxAgeHours * 0.8) {
        console.log("\n⚠️  Auth expiring SOON — consider re-authenticating");
      } else {
        const remainingDays = ((maxAgeHours - ageHours) / 24).toFixed(0);
        console.log(`\n✅ Auth valid (~${remainingDays} days remaining)`);
      }
    } catch {
      console.log("❌ No auth state found.\n");
      console.log("Use 'setup_auth' tool to authenticate first.");
    }
  }

  private printAuthHelp(): void {
    console.log(`
Usage: npx notebooklm-mcp auth <command>

Commands:
  auth export    Show auth state location and CI/CD setup instructions
  auth status    Check if auth is valid and when it expires

Workflow for CI/CD:
  1. Authenticate locally: Use 'setup_auth' tool in Claude/Codex
  2. Export: npx notebooklm-mcp auth export
  3. Copy state.json to CI/CD and set GOOGLE_AUTH_COOKIES_PATH
    `);
  }

  private printHelp(): void {
    console.log(`
Usage: npx notebooklm-mcp <command> [args]

Commands:
  config get                       Show current configuration
  config set profile <name>        Set profile (minimal, standard, full)
  config set disabled-tools <list> Set disabled tools (comma-separated)
  config reset                     Reset to default settings

  auth export                      Show auth state for CI/CD setup
  auth status                      Check auth validity

Profiles:
  minimal   Essential read-only tools (low token usage)
  standard  Read + Library management
  full      All tools enabled
    `);
  }
}
