/**
 * Research Tool Definitions
 *
 * MCP tool definitions for research and source discovery.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Discover Sources tool
 */
export const discoverSourcesTool: Tool = {
    name: 'discover_sources',
    description: `Discover potential sources for a research topic.

Returns:
- Search query suggestions optimized for finding quality sources
- Recommended source types (academic papers, documentation, etc.)
- Tips for finding relevant content

Use this to get ideas for sources to add to your notebook.
After finding sources, use import_source to add them.`,
    inputSchema: {
        type: 'object',
        properties: {
            topic: {
                type: 'string',
                description: 'The research topic or subject to find sources for.',
            },
            notebook_id: {
                type: 'string',
                description: 'Optional notebook ID. If not provided, uses the active notebook.',
            },
        },
        required: ['topic'],
    },
};

/**
 * Import Source tool
 */
export const importSourceTool: Tool = {
    name: 'import_source',
    description: `Import a source URL into a notebook.

Validates the URL and adds it as a source to the notebook.
Supported sources:
- Web pages (Wikipedia, documentation sites, etc.)
- YouTube videos
- Google Drive files
- Academic papers (arXiv, etc.)
- GitHub repositories

The source will be processed and indexed for Q&A and content generation.`,
    inputSchema: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The URL of the source to import.',
            },
            notebook_id: {
                type: 'string',
                description: 'ID of the notebook to import into. If not provided, uses the active notebook.',
            },
        },
        required: ['url'],
    },
};

/**
 * Research Topic tool
 */
export const researchTopicTool: Tool = {
    name: 'research_topic',
    description: `Research a topic and optionally auto-import sources.

This is a workflow tool that:
1. Generates search queries for the topic
2. Suggests source types to look for
3. Optionally auto-imports starter sources (Wikipedia, etc.)

Use this as a starting point for building a research notebook.
You can then manually add more specific sources using import_source.`,
    inputSchema: {
        type: 'object',
        properties: {
            topic: {
                type: 'string',
                description: 'The research topic or subject.',
            },
            notebook_id: {
                type: 'string',
                description: 'ID of the notebook to research in. If not provided, uses the active notebook.',
            },
            auto_import: {
                type: 'boolean',
                description: 'If true, automatically imports starter sources (e.g., Wikipedia). Default: false.',
                default: false,
            },
        },
        required: ['topic'],
    },
};

/**
 * All research tools
 */
export const researchTools: Tool[] = [
    discoverSourcesTool,
    importSourceTool,
    researchTopicTool,
];
