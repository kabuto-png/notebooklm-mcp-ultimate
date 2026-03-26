/**
 * Source Management Tool Definitions
 *
 * MCP tool definitions for managing sources in NotebookLM notebooks.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * List Sources tool
 */
export const listSourcesTool: Tool = {
    name: 'list_sources',
    description: `List all sources in a NotebookLM notebook.

Returns information about each source including:
- Source ID
- Title
- Type (URL, text, YouTube, Google Drive, etc.)
- Creation date
- Status

Use this to see what sources are available in a notebook before performing other operations.`,
    inputSchema: {
        type: 'object',
        properties: {
            notebook_id: {
                type: 'string',
                description: 'ID of the notebook to list sources from. If not provided, uses the active notebook.',
            },
        },
    },
};

/**
 * Add URL Source tool
 */
export const addURLSourceTool: Tool = {
    name: 'add_url_source',
    description: `Add a URL as a source to a NotebookLM notebook.

The URL will be fetched and its content will be added to the notebook.
Supported URL types:
- Web pages (HTML)
- PDF documents
- Text files
- Other publicly accessible content

The source will be processed and indexed for Q&A and content generation.`,
    inputSchema: {
        type: 'object',
        properties: {
            notebook_id: {
                type: 'string',
                description: 'ID of the notebook to add the source to. If not provided, uses the active notebook.',
            },
            url: {
                type: 'string',
                description: 'The URL to add as a source. Must be a valid, publicly accessible URL.',
            },
        },
        required: ['url'],
    },
};

/**
 * Add Text Source tool
 */
export const addTextSourceTool: Tool = {
    name: 'add_text_source',
    description: `Add text content as a source to a NotebookLM notebook.

Use this to add:
- Pasted text
- Notes
- Transcripts
- Any custom text content

The text will be indexed and available for Q&A and content generation.`,
    inputSchema: {
        type: 'object',
        properties: {
            notebook_id: {
                type: 'string',
                description: 'ID of the notebook to add the source to. If not provided, uses the active notebook.',
            },
            title: {
                type: 'string',
                description: 'Title for the text source (e.g., "Meeting Notes", "Research Summary").',
            },
            content: {
                type: 'string',
                description: 'The text content to add as a source.',
            },
        },
        required: ['title', 'content'],
    },
};

/**
 * Add YouTube Source tool
 */
export const addYouTubeSourceTool: Tool = {
    name: 'add_youtube_source',
    description: `Add a YouTube video as a source to a NotebookLM notebook.

The video's transcript will be extracted and added to the notebook.
This allows you to:
- Ask questions about video content
- Generate summaries of videos
- Create study materials from educational videos

Note: The video must have captions/subtitles available.`,
    inputSchema: {
        type: 'object',
        properties: {
            notebook_id: {
                type: 'string',
                description: 'ID of the notebook to add the source to. If not provided, uses the active notebook.',
            },
            youtube_url: {
                type: 'string',
                description: 'YouTube video URL (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...).',
            },
        },
        required: ['youtube_url'],
    },
};

/**
 * Add Google Drive Source tool
 */
export const addDriveSourceTool: Tool = {
    name: 'add_drive_source',
    description: `Add a Google Drive file as a source to a NotebookLM notebook.

Supported file types:
- Google Docs
- Google Slides
- Google Sheets
- PDF files
- Other supported formats

The file must be accessible to the authenticated Google account.`,
    inputSchema: {
        type: 'object',
        properties: {
            notebook_id: {
                type: 'string',
                description: 'ID of the notebook to add the source to. If not provided, uses the active notebook.',
            },
            file_id: {
                type: 'string',
                description: 'Google Drive file ID (found in the file URL: https://drive.google.com/file/d/FILE_ID/...).',
            },
        },
        required: ['file_id'],
    },
};

/**
 * Delete Source tool
 */
export const deleteSourceTool: Tool = {
    name: 'delete_source',
    description: `Delete a source from a NotebookLM notebook.

This permanently removes the source and its content from the notebook.
The source will no longer be available for:
- Q&A
- Content generation
- Audio overviews

Use list_sources first to get the source ID.`,
    inputSchema: {
        type: 'object',
        properties: {
            notebook_id: {
                type: 'string',
                description: 'ID of the notebook containing the source. If not provided, uses the active notebook.',
            },
            source_id: {
                type: 'string',
                description: 'ID of the source to delete (obtained from list_sources).',
            },
        },
        required: ['source_id'],
    },
};

/**
 * Summarize Source tool
 */
export const summarizeSourceTool: Tool = {
    name: 'summarize_source',
    description: `Get summary and metadata for a specific source in a notebook.

Returns:
- Source title
- Source type
- Creation date
- Status
- Basic metadata

For detailed content summaries, use the content generation tools (generate_briefing, etc.).`,
    inputSchema: {
        type: 'object',
        properties: {
            notebook_id: {
                type: 'string',
                description: 'ID of the notebook containing the source. If not provided, uses the active notebook.',
            },
            source_id: {
                type: 'string',
                description: 'ID of the source to summarize (obtained from list_sources).',
            },
        },
        required: ['source_id'],
    },
};

/**
 * All source management tools
 */
export const sourceManagementTools: Tool[] = [
    listSourcesTool,
    addURLSourceTool,
    addTextSourceTool,
    addYouTubeSourceTool,
    addDriveSourceTool,
    deleteSourceTool,
    summarizeSourceTool,
];
