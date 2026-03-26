/**
 * Streaming Chat Client for NotebookLM Q&A
 *
 * EXPERIMENTAL: Direct HTTP streaming to the GenerateFreeFormStreamed gRPC-Web
 * endpoint. This is an alternative to the browser-based Q&A approach.
 *
 * The endpoint uses chunked transfer encoding and returns SSE-style fragments.
 * Each chunk starts with a 5-byte gRPC-Web header followed by the payload.
 *
 * Note: This may break if Google changes the endpoint or auth scheme.
 */

import type { Cookie } from './types.js';
import { csrfManager } from './csrf-manager.js';
import { log } from '../utils/logger.js';

/** Base URL for gRPC-Web streaming endpoint */
const STREAMING_BASE = 'https://notebooklm.google.com/_/LabsTailwindUi/data';
const GENERATE_FREEFORM_PATH =
  '/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed';

/** Options for streamChat */
export interface StreamChatOptions {
  /** Timeout for the full response in ms (default: 60_000) */
  timeoutMs?: number;
}

/** Result type for collectStreamChat */
export interface StreamChatResult {
  success: boolean;
  content: string | null;
  error?: string;
}

/**
 * Build a minimal proto-encoded body for GenerateFreeFormStreamed.
 *
 * The request proto (field 1 = notebook_id string, field 2 = question string)
 * is length-prefixed with a 5-byte gRPC-Web header (0x00 + uint32 big-endian).
 */
function buildGrpcWebBody(notebookId: string, question: string): Uint8Array {
  // Encode proto manually (field 1 = notebookId, field 2 = question)
  const encodeString = (fieldNumber: number, value: string): Uint8Array => {
    const bytes = new TextEncoder().encode(value);
    // Field tag: (fieldNumber << 3) | 2 (wire type 2 = length-delimited)
    const tag = (fieldNumber << 3) | 2;
    const tagBuf = encodeVarint(tag);
    const lenBuf = encodeVarint(bytes.length);
    const out = new Uint8Array(tagBuf.length + lenBuf.length + bytes.length);
    out.set(tagBuf, 0);
    out.set(lenBuf, tagBuf.length);
    out.set(bytes, tagBuf.length + lenBuf.length);
    return out;
  };

  const field1 = encodeString(1, notebookId);
  const field2 = encodeString(2, question);

  const protoBytes = new Uint8Array(field1.length + field2.length);
  protoBytes.set(field1, 0);
  protoBytes.set(field2, field1.length);

  // 5-byte gRPC-Web header: 0x00 (no compression) + 4-byte message length
  const header = new Uint8Array(5);
  header[0] = 0x00;
  new DataView(header.buffer).setUint32(1, protoBytes.length, false);

  const body = new Uint8Array(5 + protoBytes.length);
  body.set(header, 0);
  body.set(protoBytes, 5);
  return body;
}

/** Encode a number as a varint (for proto field tags and lengths) */
function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return new Uint8Array(bytes);
}

/**
 * Extract text fragments from gRPC-Web chunked response bytes.
 * Looks for UTF-8 strings of 10+ chars that look like answer text.
 * Filters out proto metadata, binary noise, and UTF-8 replacement chars.
 */
function* extractTextFragments(chunk: Uint8Array): Generator<string> {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(chunk);
  // gRPC-Web messages are separated by 5-byte headers; extract readable text
  // by splitting on control characters and filtering noise
  // eslint-disable-next-line no-control-regex
  const parts = text.split(/[\x00-\x08\x0b-\x0c\x0e-\x1f]/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (
      trimmed.length >= 10 &&
      !trimmed.startsWith('{') &&
      !trimmed.startsWith('[') &&
      !trimmed.includes('\uFFFD') && // UTF-8 replacement char = binary noise
      !/^[a-z_]+\.[a-z_]+/i.test(trimmed) // Skip proto field paths like "google.internal..."
    ) {
      yield trimmed;
    }
  }
}

/**
 * Stream a Q&A response from NotebookLM.
 *
 * EXPERIMENTAL — the gRPC-Web encoding is approximated; real proto schema
 * is not publicly documented. Yields text fragments as they arrive.
 *
 * @param notebookId - The notebook to query
 * @param question - The question to ask
 * @param cookies - Auth cookies
 * @param options - Optional configuration
 * @yields Text fragments from the streaming response
 * @throws Error if notebookId or question are empty, or if auth is missing
 */
export async function* streamChat(
  notebookId: string,
  question: string,
  cookies: Cookie[],
  options: StreamChatOptions = {},
): AsyncGenerator<string> {
  // Fix 2: Input validation
  if (!notebookId || !notebookId.trim()) {
    throw new Error('streamChat: notebookId is required');
  }
  if (!question || !question.trim()) {
    throw new Error('streamChat: question is required');
  }

  const { timeoutMs = 60_000 } = options;

  const cookieHeader = csrfManager.buildCookieHeader(cookies);
  const authHeader = csrfManager.generateSAPISIDHash(cookies);

  // Fix 1: Validate auth before proceeding
  if (!authHeader) {
    throw new Error(
      'streamChat: No SAPISID cookie found — streaming chat requires authentication',
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/grpc-web+proto',
    'X-Grpc-Web': '1',
    Cookie: cookieHeader,
    Origin: 'https://notebooklm.google.com',
    Referer: 'https://notebooklm.google.com/',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/grpc-web+proto',
    'X-Same-Domain': '1',
    Authorization: authHeader,
  };

  const body = buildGrpcWebBody(notebookId, question);
  const url = `${STREAMING_BASE}${GENERATE_FREEFORM_PATH}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  log.dim(`🔄 [EXPERIMENTAL] Streaming chat for notebook ${notebookId}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Streaming chat failed: HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body from streaming endpoint');
    }

    const reader = response.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const fragment of extractTextFragments(value)) {
          yield fragment;
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Streaming chat timed out', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Collect all streaming chat fragments into a single string.
 *
 * EXPERIMENTAL — convenience wrapper around streamChat.
 *
 * @param notebookId - The notebook to query
 * @param question - The question to ask
 * @param cookies - Auth cookies
 * @param options - Optional configuration
 * @returns Structured result with success flag, content, and optional error
 */
export async function collectStreamChat(
  notebookId: string,
  question: string,
  cookies: Cookie[],
  options: StreamChatOptions = {},
): Promise<StreamChatResult> {
  const fragments: string[] = [];
  try {
    for await (const fragment of streamChat(notebookId, question, cookies, options)) {
      fragments.push(fragment);
    }
    return {
      success: true,
      content: fragments.length > 0 ? fragments.join(' ') : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warning(`⚠️  ${message}`);
    return {
      success: false,
      content: null,
      error: message,
    };
  }
}
