/**
 * Content Generation Tool Definitions
 *
 * Defines MCP tools for generating various types of content
 * from NotebookLM notebook sources.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Generate FAQ tool
 */
export const generateFAQTool: Tool = {
  name: 'generate_faq',
  title: 'Generate FAQ',
  description:
    'Generate a Frequently Asked Questions document from notebook sources. ' +
    'Creates a list of common questions and answers based on the content.',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: {
        type: 'string',
        description:
          'The notebook ID to generate FAQ from. If not provided, uses the currently selected notebook.',
      },
      source_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional list of specific source IDs to use. If not provided, uses all sources.',
      },
    },
    required: [],
  },
};

/**
 * Generate Briefing tool
 */
export const generateBriefingTool: Tool = {
  name: 'generate_briefing',
  title: 'Generate Briefing',
  description:
    'Generate a comprehensive briefing document from notebook sources. ' +
    'Creates an executive summary with key points and takeaways.',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: {
        type: 'string',
        description:
          'The notebook ID to generate briefing from. If not provided, uses the currently selected notebook.',
      },
      source_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional list of specific source IDs to use. If not provided, uses all sources.',
      },
    },
    required: [],
  },
};

/**
 * Generate Timeline tool
 */
export const generateTimelineTool: Tool = {
  name: 'generate_timeline',
  title: 'Generate Timeline',
  description:
    'Generate a chronological timeline from notebook sources. ' +
    'Extracts and orders events, dates, and milestones mentioned in the content.',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: {
        type: 'string',
        description:
          'The notebook ID to generate timeline from. If not provided, uses the currently selected notebook.',
      },
      source_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional list of specific source IDs to use. If not provided, uses all sources.',
      },
    },
    required: [],
  },
};

/**
 * Generate Outline tool
 */
export const generateOutlineTool: Tool = {
  name: 'generate_outline',
  title: 'Generate Outline',
  description:
    'Generate a structured outline from notebook sources. ' +
    'Creates a hierarchical organization of topics and subtopics.',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: {
        type: 'string',
        description:
          'The notebook ID to generate outline from. If not provided, uses the currently selected notebook.',
      },
      source_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional list of specific source IDs to use. If not provided, uses all sources.',
      },
    },
    required: [],
  },
};

/**
 * Generate Study Guide tool
 */
export const generateStudyGuideTool: Tool = {
  name: 'generate_study_guide',
  title: 'Generate Study Guide',
  description:
    'Generate a comprehensive study guide from notebook sources. ' +
    'Includes key concepts, definitions, and review materials.',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: {
        type: 'string',
        description:
          'The notebook ID to generate study guide from. If not provided, uses the currently selected notebook.',
      },
      source_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional list of specific source IDs to use. If not provided, uses all sources.',
      },
    },
    required: [],
  },
};

/**
 * Generate Flashcards tool
 */
export const generateFlashcardsTool: Tool = {
  name: 'generate_flashcards',
  title: 'Generate Flashcards',
  description:
    'Generate a set of flashcards from notebook sources. ' +
    'Creates question/answer pairs for key concepts and terms.',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: {
        type: 'string',
        description:
          'The notebook ID to generate flashcards from. If not provided, uses the currently selected notebook.',
      },
      source_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional list of specific source IDs to use. If not provided, uses all sources.',
      },
    },
    required: [],
  },
};

/**
 * Generate Quiz tool
 */
export const generateQuizTool: Tool = {
  name: 'generate_quiz',
  title: 'Generate Quiz',
  description:
    'Generate a quiz from notebook sources. ' +
    'Creates questions to test understanding of the material.',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: {
        type: 'string',
        description:
          'The notebook ID to generate quiz from. If not provided, uses the currently selected notebook.',
      },
      source_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional list of specific source IDs to use. If not provided, uses all sources.',
      },
    },
    required: [],
  },
};

/**
 * Generate Mind Map tool
 */
export const generateMindMapTool: Tool = {
  name: 'generate_mindmap',
  title: 'Generate Mind Map',
  description:
    'Generate a mind map structure from notebook sources. ' +
    'Creates a hierarchical visualization of concepts and their relationships.',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: {
        type: 'string',
        description:
          'The notebook ID to generate mind map from. If not provided, uses the currently selected notebook.',
      },
      source_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional list of specific source IDs to use. If not provided, uses all sources.',
      },
    },
    required: [],
  },
};

/**
 * Suggest Questions tool
 */
export const suggestQuestionsTool: Tool = {
  name: 'suggest_questions',
  title: 'Suggest Questions',
  description:
    'Get suggested questions for a notebook based on its sources. ' +
    'Returns questions that can be asked about the content.',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: {
        type: 'string',
        description:
          'The notebook ID to get suggestions for. If not provided, uses the currently selected notebook.',
      },
    },
    required: [],
  },
};

/**
 * All content generation tools
 */
export const contentGenerationTools: Tool[] = [
  generateFAQTool,
  generateBriefingTool,
  generateTimelineTool,
  generateOutlineTool,
  generateStudyGuideTool,
  generateFlashcardsTool,
  generateQuizTool,
  generateMindMapTool,
  suggestQuestionsTool,
];

/**
 * Content generation tool names for filtering
 */
export const contentGenerationToolNames = contentGenerationTools.map((t) => t.name);
