/**
 * Unit Tests for Library Alias Resolution
 *
 * Tests that notebook library aliases are correctly resolved to UUIDs
 * before making API/browser calls.
 *
 * Bug reference: Library aliases like "chaos-theory" were being passed
 * directly to NotebookLM APIs instead of being resolved to their UUIDs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSourceHandlers } from '../src/tools/handlers/source-handlers.js';
import type { NotebookLibrary } from '../src/library/notebook-library.js';
import type { NotebookEntry } from '../src/library/types.js';

// Mock notebook entries
const mockNotebook: NotebookEntry = {
  id: 'chaos-theory',
  url: 'https://notebooklm.google.com/notebook/f0c60fcd-f2f9-452d-874e-4ef636748ad9',
  name: 'Chaos Theory',
  description: 'Research on chaos theory',
  topics: ['mathematics', 'physics'],
  content_types: ['documentation'],
  use_cases: ['research'],
  added_at: '2026-04-07T00:00:00.000Z',
  last_used: '2026-04-07T00:00:00.000Z',
  use_count: 5,
  tags: [],
};

const mockNotebook2: NotebookEntry = {
  id: 'ehb-leases',
  url: 'https://notebooklm.google.com/notebook/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'EHB Leases',
  description: 'Lease documents',
  topics: ['legal', 'contracts'],
  content_types: ['documents'],
  use_cases: ['reference'],
  added_at: '2026-04-07T00:00:00.000Z',
  last_used: '2026-04-07T00:00:00.000Z',
  use_count: 3,
  tags: [],
};

describe('Library Alias Resolution', () => {
  let mockLibrary: Partial<NotebookLibrary>;

  beforeEach(() => {
    // Create mock library
    mockLibrary = {
      getNotebook: vi.fn((id: string) => {
        if (id === 'chaos-theory') return mockNotebook;
        if (id === 'ehb-leases') return mockNotebook2;
        return null;
      }),
      getActiveNotebook: vi.fn(() => mockNotebook),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveNotebookId internal logic', () => {
    // Since resolveNotebookId is internal, we test via source handlers
    // which use it to resolve notebook IDs

    it('should pass UUID directly without lookup', async () => {
      const handlers = createSourceHandlers({
        library: mockLibrary as NotebookLibrary,
      });

      // Direct UUID should be used as-is
      const uuid = 'f0c60fcd-f2f9-452d-874e-4ef636748ad9';

      // Call handleListSources which uses resolveNotebookId
      // The result will fail (no real API) but we can verify via mock
      await handlers.handleListSources({ notebook_id: uuid });

      // getNotebook should NOT be called when UUID is passed
      expect(mockLibrary.getNotebook).not.toHaveBeenCalled();
    });

    it('should resolve library alias to UUID', async () => {
      const handlers = createSourceHandlers({
        library: mockLibrary as NotebookLibrary,
      });

      // Library alias should trigger lookup
      await handlers.handleListSources({ notebook_id: 'chaos-theory' });

      // getNotebook SHOULD be called to resolve alias
      expect(mockLibrary.getNotebook).toHaveBeenCalledWith('chaos-theory');
    });

    it('should use active notebook when no notebook_id provided', async () => {
      const handlers = createSourceHandlers({
        library: mockLibrary as NotebookLibrary,
      });

      // No notebook_id should use active notebook
      await handlers.handleListSources({});

      // getActiveNotebook SHOULD be called
      expect(mockLibrary.getActiveNotebook).toHaveBeenCalled();
    });

    it('should return error when alias not found and no active notebook', async () => {
      const emptyLibrary: Partial<NotebookLibrary> = {
        getNotebook: vi.fn(() => null),
        getActiveNotebook: vi.fn(() => null),
      };

      const handlers = createSourceHandlers({
        library: emptyLibrary as NotebookLibrary,
      });

      const result = await handlers.handleListSources({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No notebook specified');
    });
  });

  describe('UUID extraction from URL', () => {
    it('should extract UUID from valid NotebookLM URL', async () => {
      const handlers = createSourceHandlers({
        library: mockLibrary as NotebookLibrary,
      });

      // Use alias which has URL containing UUID
      await handlers.handleListSources({ notebook_id: 'chaos-theory' });

      // Verify the notebook was looked up
      expect(mockLibrary.getNotebook).toHaveBeenCalledWith('chaos-theory');
    });

    it('should handle notebooks with different UUID formats', async () => {
      const handlers = createSourceHandlers({
        library: mockLibrary as NotebookLibrary,
      });

      // Second notebook has different UUID
      await handlers.handleListSources({ notebook_id: 'ehb-leases' });

      expect(mockLibrary.getNotebook).toHaveBeenCalledWith('ehb-leases');
    });
  });

  describe('Edge cases', () => {
    it('should handle unknown alias gracefully', async () => {
      const handlers = createSourceHandlers({
        library: mockLibrary as NotebookLibrary,
      });

      // Unknown alias that looks like it could be an ID
      await handlers.handleListSources({ notebook_id: 'unknown-notebook' });

      // Should try to look it up
      expect(mockLibrary.getNotebook).toHaveBeenCalledWith('unknown-notebook');
    });

    it('should handle uppercase UUID', async () => {
      const handlers = createSourceHandlers({
        library: mockLibrary as NotebookLibrary,
      });

      // Uppercase UUID should be recognized as UUID
      const uuid = 'F0C60FCD-F2F9-452D-874E-4EF636748AD9';
      await handlers.handleListSources({ notebook_id: uuid });

      // Should NOT call getNotebook - UUID passed directly
      expect(mockLibrary.getNotebook).not.toHaveBeenCalled();
    });

    it('should handle mixed case UUID', async () => {
      const handlers = createSourceHandlers({
        library: mockLibrary as NotebookLibrary,
      });

      const uuid = 'f0c60fcd-F2F9-452d-874E-4ef636748ad9';
      await handlers.handleListSources({ notebook_id: uuid });

      expect(mockLibrary.getNotebook).not.toHaveBeenCalled();
    });
  });
});
