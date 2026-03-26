#!/usr/bin/env node

/**
 * NotebookLM MCP Server
 *
 * MCP Server for Google NotebookLM - Chat with Gemini 2.5 through NotebookLM
 * with session support and human-like behavior!
 *
 * Features:
 * - Session-based contextual conversations
 * - Auto re-login on session expiry
 * - Human-like typing and mouse movements
 * - Persistent browser fingerprint
 * - Stealth mode with Patchright
 * - Claude Code integration via npx
 *
 * Usage:
 *   npx notebooklm-mcp
 *   node dist/index.js
 *
 * Environment Variables:
 *   NOTEBOOK_URL - Default NotebookLM notebook URL
 *   AUTO_LOGIN_ENABLED - Enable automatic login (true/false)
 *   LOGIN_EMAIL - Google email for auto-login
 *   LOGIN_PASSWORD - Google password for auto-login
 *   HEADLESS - Run browser in headless mode (true/false)
 *   MAX_SESSIONS - Maximum concurrent sessions (default: 10)
 *   SESSION_TIMEOUT - Session timeout in seconds (default: 900)
 *
 * Based on the Python NotebookLM API implementation
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { AuthManager } from "./auth/auth-manager.js";
import { SessionManager } from "./session/session-manager.js";
import { NotebookLibrary } from "./library/notebook-library.js";
import { ToolHandlers, buildToolDefinitions } from "./tools/index.js";
import { ResourceHandlers } from "./resources/resource-handlers.js";
import { SettingsManager } from "./utils/settings-manager.js";
import { CliHandler } from "./utils/cli-handler.js";
import { CONFIG } from "./config.js";
import { log } from "./utils/logger.js";

/** Single source of truth for the server version — must match package.json. */
const SERVER_VERSION = "2.0.0";

/**
 * Validate that required arguments are present on a tool call.
 * Throws a descriptive error when any required field is missing.
 */
function validateArgs(
  args: Record<string, unknown> | undefined,
  required: string[],
  toolName: string
): void {
  if (!args) {
    throw new Error(`${toolName}: arguments are required`);
  }
  for (const field of required) {
    if (args[field] === undefined || args[field] === null) {
      throw new Error(`${toolName}: missing required argument '${field}'`);
    }
  }
}

/**
 * Main MCP Server Class
 */
class NotebookLMMCPServer {
  private server: Server;
  private authManager: AuthManager;
  private sessionManager: SessionManager;
  private library: NotebookLibrary;
  private toolHandlers: ToolHandlers;
  private resourceHandlers: ResourceHandlers;
  private settingsManager: SettingsManager;
  private toolDefinitions: Tool[];

  constructor() {
    // Initialize MCP Server
    this.server = new Server(
      {
        name: "notebooklm-mcp",
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          resourceTemplates: {},
          prompts: {},
          completions: {}, // Required for completion/complete support
          logging: {},
        },
      }
    );

    // Initialize managers
    this.authManager = new AuthManager();
    this.sessionManager = new SessionManager(this.authManager);
    this.library = new NotebookLibrary();
    this.settingsManager = new SettingsManager();
    
    // Initialize handlers
    this.toolHandlers = new ToolHandlers(
      this.sessionManager,
      this.authManager,
      this.library
    );
    this.resourceHandlers = new ResourceHandlers(this.library);

    // Build and Filter tool definitions
    const allTools = buildToolDefinitions(this.library) as Tool[];
    this.toolDefinitions = this.settingsManager.filterTools(allTools);

    // Setup handlers
    this.setupHandlers();
    this.setupShutdownHandlers();

    const activeSettings = this.settingsManager.getEffectiveSettings();
    log.info("🚀 NotebookLM MCP Server initialized");
    log.info(`  Version: ${SERVER_VERSION}`);
    log.info(`  Node: ${process.version}`);
    log.info(`  Platform: ${process.platform}`);
    log.info(`  Profile: ${activeSettings.profile} (${this.toolDefinitions.length} tools active)`);
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // Register Resource Handlers (Resources, Templates, Completions)
    this.resourceHandlers.registerHandlers(this.server);

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      log.info("📋 [MCP] list_tools request received");
      return {
        tools: this.toolDefinitions,
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const progressToken = (args as any)?._meta?.progressToken;

      log.info(`🔧 [MCP] Tool call: ${name}`);
      if (progressToken) {
        log.info(`  📊 Progress token: ${progressToken}`);
      }

      // Create progress callback function
      const sendProgress = async (message: string, progress?: number, total?: number) => {
        if (progressToken) {
          await this.server.notification({
            method: "notifications/progress",
            params: {
              progressToken,
              message,
              ...(progress !== undefined && { progress }),
              ...(total !== undefined && { total }),
            },
          });
          log.dim(`  📊 Progress: ${message}`);
        }
      };

      try {
        let result;

        switch (name) {
          case "ask_question":
            validateArgs(args as Record<string, unknown>, ["question"], "ask_question");
            result = await this.toolHandlers.handleAskQuestion(
              args as {
                question: string;
                session_id?: string;
                notebook_id?: string;
                notebook_url?: string;
                show_browser?: boolean;
              },
              sendProgress
            );
            break;

          case "add_notebook":
            validateArgs(args as Record<string, unknown>, ["url", "name", "description", "topics"], "add_notebook");
            result = await this.toolHandlers.handleAddNotebook(
              args as {
                url: string;
                name: string;
                description: string;
                topics: string[];
                content_types?: string[];
                use_cases?: string[];
                tags?: string[];
              }
            );
            break;

          case "list_notebooks":
            result = await this.toolHandlers.handleListNotebooks();
            break;

          case "get_notebook":
            validateArgs(args as Record<string, unknown>, ["id"], "get_notebook");
            result = await this.toolHandlers.handleGetNotebook(
              args as { id: string }
            );
            break;

          case "select_notebook":
            validateArgs(args as Record<string, unknown>, ["id"], "select_notebook");
            result = await this.toolHandlers.handleSelectNotebook(
              args as { id: string }
            );
            break;

          case "update_notebook":
            result = await this.toolHandlers.handleUpdateNotebook(
              args as {
                id: string;
                name?: string;
                description?: string;
                topics?: string[];
                content_types?: string[];
                use_cases?: string[];
                tags?: string[];
                url?: string;
              }
            );
            break;

          case "remove_notebook":
            result = await this.toolHandlers.handleRemoveNotebook(
              args as { id: string }
            );
            break;

          case "search_notebooks":
            result = await this.toolHandlers.handleSearchNotebooks(
              args as { query: string }
            );
            break;

          case "get_library_stats":
            result = await this.toolHandlers.handleGetLibraryStats();
            break;

          case "list_sessions":
            result = await this.toolHandlers.handleListSessions();
            break;

          case "close_session":
            validateArgs(args as Record<string, unknown>, ["session_id"], "close_session");
            result = await this.toolHandlers.handleCloseSession(
              args as { session_id: string }
            );
            break;

          case "reset_session":
            result = await this.toolHandlers.handleResetSession(
              args as { session_id: string }
            );
            break;

          case "get_health":
            result = await this.toolHandlers.handleGetHealth();
            break;

          case "setup_auth":
            result = await this.toolHandlers.handleSetupAuth(
              args as { show_browser?: boolean },
              sendProgress
            );
            break;

          case "re_auth":
            result = await this.toolHandlers.handleReAuth(
              args as { show_browser?: boolean },
              sendProgress
            );
            break;


        // Content Generation Tools
        case "generate_faq":
          result = await this.toolHandlers.handleGenerateFAQ(
            args as { notebook_id?: string; source_ids?: string[] },
            sendProgress
          );
          break;

        case "generate_briefing":
          result = await this.toolHandlers.handleGenerateBriefing(
            args as { notebook_id?: string; source_ids?: string[] },
            sendProgress
          );
          break;

        case "generate_timeline":
          result = await this.toolHandlers.handleGenerateTimeline(
            args as { notebook_id?: string; source_ids?: string[] },
            sendProgress
          );
          break;

        case "generate_outline":
          result = await this.toolHandlers.handleGenerateOutline(
            args as { notebook_id?: string; source_ids?: string[] },
            sendProgress
          );
          break;

        case "generate_study_guide":
          result = await this.toolHandlers.handleGenerateStudyGuide(
            args as { notebook_id?: string; source_ids?: string[] },
            sendProgress
          );
          break;

        case "generate_flashcards":
          result = await this.toolHandlers.handleGenerateFlashcards(
            args as { notebook_id?: string; source_ids?: string[] },
            sendProgress
          );
          break;

        case "generate_quiz":
          result = await this.toolHandlers.handleGenerateQuiz(
            args as { notebook_id?: string; source_ids?: string[] },
            sendProgress
          );
          break;

        case "generate_mindmap":
          result = await this.toolHandlers.handleGenerateMindMap(
            args as { notebook_id?: string; source_ids?: string[] },
            sendProgress
          );
          break;

        case "suggest_questions":
          result = await this.toolHandlers.handleSuggestQuestions(
            args as { notebook_id?: string },
            sendProgress
          );
          break;

        // Audio Studio Tools
        case "get_audio_status":
          result = await this.toolHandlers.handleGetAudioStatus(
            args as { notebook_id?: string },
            sendProgress
          );
          break;

        case "create_audio":
          result = await this.toolHandlers.handleCreateAudio(
            args as {
              notebook_id?: string;
              custom_instructions?: string;
              focus_topics?: string[];
              target_audience?: 'general' | 'expert' | 'student';
              wait_for_completion?: boolean;
            },
            sendProgress
          );
          break;

        case "update_audio":
          result = await this.toolHandlers.handleUpdateAudio(
            args as {
              notebook_id?: string;
              custom_instructions?: string;
              focus_topics?: string[];
              target_audience?: 'general' | 'expert' | 'student';
            },
            sendProgress
          );
          break;

        case "delete_audio":
          result = await this.toolHandlers.handleDeleteAudio(
            args as { notebook_id?: string },
            sendProgress
          );
          break;

        case "download_audio":
          result = await this.toolHandlers.handleDownloadAudio(
            args as { notebook_id?: string },
            sendProgress
          );
          break;

        // Source Management Tools
        case "list_sources":
          result = await this.toolHandlers.handleListSources(
            args as { notebook_id?: string },
            sendProgress
          );
          break;

        case "add_url_source":
          validateArgs(args as Record<string, unknown>, ["url"], "add_url_source");
          result = await this.toolHandlers.handleAddURLSource(
            args as { notebook_id?: string; url: string },
            sendProgress
          );
          break;

        case "add_text_source":
          result = await this.toolHandlers.handleAddTextSource(
            args as { notebook_id?: string; title: string; content: string },
            sendProgress
          );
          break;

        case "add_youtube_source":
          result = await this.toolHandlers.handleAddYouTubeSource(
            args as { notebook_id?: string; youtube_url: string },
            sendProgress
          );
          break;

        case "add_drive_source":
          result = await this.toolHandlers.handleAddDriveSource(
            args as { notebook_id?: string; file_id: string },
            sendProgress
          );
          break;

        case "delete_source":
          validateArgs(args as Record<string, unknown>, ["source_id"], "delete_source");
          result = await this.toolHandlers.handleDeleteSource(
            args as { notebook_id?: string; source_id: string },
            sendProgress
          );
          break;

        case "summarize_source":
          result = await this.toolHandlers.handleSummarizeSource(
            args as { notebook_id?: string; source_id: string },
            sendProgress
          );
          break;

        // Research Tools
        case "discover_sources":
          result = await this.toolHandlers.handleDiscoverSources(
            args as { topic: string; notebook_id?: string },
            sendProgress
          );
          break;

        case "import_source":
          result = await this.toolHandlers.handleImportSource(
            args as { url: string; notebook_id?: string },
            sendProgress
          );
          break;

        case "research_topic":
          result = await this.toolHandlers.handleResearchTopic(
            args as { topic: string; notebook_id?: string; auto_import?: boolean },
            sendProgress
          );
          break;

        // Notebook CRUD Tools (API-based)
        case "create_notebook_remote":
          result = await this.toolHandlers.handleCreateNotebookRemote(
            args as { title?: string },
            sendProgress
          );
          break;

        case "rename_notebook_remote":
          validateArgs(args as Record<string, unknown>, ["notebook_id", "new_title"], "rename_notebook_remote");
          result = await this.toolHandlers.handleRenameNotebookRemote(
            args as { notebook_id: string; new_title: string },
            sendProgress
          );
          break;

        case "delete_notebook_remote":
          validateArgs(args as Record<string, unknown>, ["notebook_id"], "delete_notebook_remote");
          result = await this.toolHandlers.handleDeleteNotebookRemote(
            args as { notebook_id: string },
            sendProgress
          );
          break;

        case "add_file_source":
          result = await this.toolHandlers.handleAddFileSource(
            args as { notebook_id: string; file_path: string },
            sendProgress
          );
          break;

          case "cleanup_data":
            result = await this.toolHandlers.handleCleanupData(
              args as { confirm: boolean }
            );
            break;

          default:
            log.error(`❌ [MCP] Unknown tool: ${name}`);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: false,
                      error: `Unknown tool: ${name}`,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
        }

        // Return result
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        log.error(`❌ [MCP] Tool execution error: ${errorMessage}`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: errorMessage,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    let shuttingDown = false;

    const shutdown = async (signal: string) => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;

      log.info(`\n🛑 Received ${signal}, shutting down gracefully...`);

      try {
        // Cleanup tool handlers (closes all sessions)
        await this.toolHandlers.cleanup();

        // Close server
        await this.server.close();

        log.success("✅ Shutdown complete");
        process.exit(0);
      } catch (error) {
        log.error(`❌ Error during shutdown: ${error}`);
        process.exit(1);
      }
    };

    const requestShutdown = (signal: string) => {
      void shutdown(signal);
    };

    process.on("SIGINT", () => requestShutdown("SIGINT"));
    process.on("SIGTERM", () => requestShutdown("SIGTERM"));

    process.on("uncaughtException", (error) => {
      log.error(`💥 Uncaught exception: ${error}`);
      log.error(error.stack || "");
      requestShutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      log.error(`💥 Unhandled rejection at: ${promise}`);
      log.error(`Reason: ${reason}`);
      requestShutdown("unhandledRejection");
    });
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    log.info("🎯 Starting NotebookLM MCP Server...");
    log.info("");
    log.info("📝 Configuration:");
    log.info(`  Config Dir: ${CONFIG.configDir}`);
    log.info(`  Data Dir: ${CONFIG.dataDir}`);
    log.info(`  Headless: ${CONFIG.headless}`);
    log.info(`  Max Sessions: ${CONFIG.maxSessions}`);
    log.info(`  Session Timeout: ${CONFIG.sessionTimeout}s`);
    log.info(`  Stealth: ${CONFIG.stealthEnabled}`);
    log.info("");

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await this.server.connect(transport);

    log.success("✅ MCP Server connected via stdio");
    log.success("🎉 Ready to receive requests from Claude Code!");
    log.info("");
    log.info("💡 Available tools:");
    for (const tool of this.toolDefinitions) {
      const desc = tool.description ? tool.description.split('\n')[0] : 'No description'; // First line only
      log.info(`  - ${tool.name}: ${desc.substring(0, 80)}...`);
    }
    log.info("");
    log.info("📖 For documentation, see: README.md");
    log.info("📖 For MCP details, see: MCP_INFOS.md");
    log.info("");
  }
}

/**
 * Main entry point
 */
async function main() {
  // Handle CLI commands
  const args = process.argv.slice(2);
  if (args.length > 0 && args[0] === "config") {
    const cli = new CliHandler();
    await cli.handleCommand(args);
    process.exit(0);
  }

  // Print banner
  console.error("╔══════════════════════════════════════════════════════════╗");
  console.error("║                                                          ║");
  console.error(`║           NotebookLM MCP Server v${SERVER_VERSION}                 ║`);
  console.error("║                                                          ║");
  console.error("║   Chat with Gemini 2.5 through NotebookLM via MCP       ║");
  console.error("║                                                          ║");
  console.error("╚══════════════════════════════════════════════════════════╝");
  console.error("");

  try {
    const server = new NotebookLMMCPServer();
    await server.start();
  } catch (error) {
    log.error(`💥 Fatal error starting server: ${error}`);
    if (error instanceof Error) {
      log.error(error.stack || "");
    }
    process.exit(1);
  }
}

// Run the server
main();
