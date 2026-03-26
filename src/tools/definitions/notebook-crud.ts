/**
 * Notebook CRUD Tool Definitions
 *
 * Tools for creating and managing notebooks directly in NotebookLM.
 * These operations use the API directly (not browser automation).
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const notebookCRUDTools: Tool[] = [
  {
    name: "add_file_source",
    description:
      `Upload a local file as a source to a NotebookLM notebook.

## Supported Formats
PDF, documents (docx, txt), images, audio files

## Parameters
- notebook_id (required): UUID of the target notebook
- file_path (required): Absolute path to the file on disk

## Example
User: "Add my research paper to the AI notebook"
You: Get file path and notebook ID, then call add_file_source

## Notes
- Uses browser automation (slightly slower than API)
- File must exist and be accessible
- Large files may take longer to upload`,
    inputSchema: {
      type: "object",
      properties: {
        notebook_id: {
          type: "string",
          description: "The notebook ID to add source to (UUID format)",
        },
        file_path: {
          type: "string",
          description: "Absolute path to the file to upload",
        },
      },
      required: ["notebook_id", "file_path"],
    },
  },
  {
    name: "create_notebook_remote",
    description:
      `Create a new notebook directly in NotebookLM.

## What It Does
Creates a new empty notebook in your NotebookLM account via the API.
Returns the notebook ID and URL for immediate use.

## When to Use
- User wants to create a fresh notebook for a new topic
- Starting a new research project
- Need to organize sources into a new collection

## Parameters
- title (optional): Name for the notebook. Defaults to "Untitled notebook"

## Example
User: "Create a notebook for my Python learning"
You: Call create_notebook_remote with title="Python Learning"

## Notes
- The created notebook will be empty (no sources)
- Use add_url_source, add_text_source, etc. to add content
- The notebook is created in the authenticated user's account`,
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Name for the new notebook (optional, defaults to 'Untitled notebook')",
        },
      },
    },
  },
  {
    name: "rename_notebook_remote",
    description:
      `Rename a notebook directly in NotebookLM.

## What It Does
Changes the title of an existing notebook via the API.
This updates the actual notebook in NotebookLM, not just local library metadata.

## When to Use
- User wants to rename an existing notebook
- Correcting typos in notebook names
- Updating notebook name to reflect new scope

## Parameters
- notebook_id (required): The notebook ID to rename
- new_title (required): The new name for the notebook

## Example
User: "Rename my AI notebook to 'Machine Learning Fundamentals'"
You: Get notebook ID from list_notebooks, then call rename_notebook_remote

## Notes
- This changes the name in NotebookLM, visible to all who have access
- Different from update_notebook which only updates local library metadata`,
    inputSchema: {
      type: "object",
      properties: {
        notebook_id: {
          type: "string",
          description: "The notebook ID to rename (UUID format)",
        },
        new_title: {
          type: "string",
          description: "The new title for the notebook",
        },
      },
      required: ["notebook_id", "new_title"],
    },
  },
  {
    name: "delete_notebook_remote",
    description:
      `DANGEROUS - Delete a notebook from NotebookLM permanently.

## What It Does
Permanently deletes a notebook and ALL its sources from NotebookLM.
This action CANNOT be undone.

## Confirmation Required
ALWAYS confirm with the user before calling this tool:
"Are you sure you want to PERMANENTLY DELETE '[notebook_name]' and all its sources? This cannot be undone."

## When to Use
- User explicitly asks to delete a notebook from NotebookLM
- Cleaning up unused notebooks

## Parameters
- notebook_id (required): The notebook ID to delete

## Example
User: "Delete my old test notebook"
You: "Are you sure you want to permanently delete 'Test Notebook' and all its X sources?"
User: "Yes, delete it"
You: Call delete_notebook_remote

## Notes
- Different from remove_notebook which only removes from local library
- This deletes from NotebookLM servers permanently
- All sources, notes, and generated content will be lost`,
    inputSchema: {
      type: "object",
      properties: {
        notebook_id: {
          type: "string",
          description: "The notebook ID to delete (UUID format)",
        },
      },
      required: ["notebook_id"],
    },
  },
];
