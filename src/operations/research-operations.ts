/**
 * Research Operations for NotebookLM
 *
 * Provides research and source discovery operations.
 * 
 * Note: NotebookLM API doesn't have native research/discovery endpoints,
 * so these operations provide suggestions and workflows rather than
 * actual web search functionality.
 */

import { getAPIClient, type NotebookLMAPIClient } from '../api/index.js';
import { initializeAPIClientWithCookies } from '../auth/cookie-store.js';
import { log } from '../utils/logger.js';
import * as sourceOps from './source-operations.js';

/**
 * Result of a research operation
 */
export interface ResearchOperationResult {
    success: boolean;
    suggestions?: string[];
    sources?: string[];
    message?: string;
    error?: string;
    notebookId?: string;
}

/**
 * Get an initialized API client
 */
async function getInitializedClient(): Promise<NotebookLMAPIClient | null> {
    const client = getAPIClient();

    if (client.hasValidAuth()) {
        return client;
    }

    const success = await initializeAPIClientWithCookies(client);
    if (!success) {
        log.warning('⚠️  Failed to initialize API client. Please run setup_auth.');
        return null;
    }

    return client;
}

/**
 * Discover potential sources for a topic
 * 
 * Returns search query suggestions and recommended source types.
 * Users can then manually search and use import_source to add them.
 */
export async function discoverSources(
    topic: string,
    notebookId?: string
): Promise<ResearchOperationResult> {
    try {
        log.info(`🔍 Discovering sources for topic: ${topic}`);

        // Generate search query suggestions
        const suggestions = [
            `${topic} site:wikipedia.org`,
            `${topic} site:arxiv.org`,
            `${topic} site:scholar.google.com`,
            `${topic} research paper`,
            `${topic} tutorial`,
            `${topic} documentation`,
            `${topic} case study`,
            `${topic} review`,
        ];

        // Recommended source types
        const sourceTypes = [
            'Academic papers (arXiv, Google Scholar)',
            'Wikipedia articles',
            'Official documentation',
            'Tutorial websites',
            'YouTube educational videos',
            'Blog posts from experts',
            'News articles',
            'Research reports',
        ];

        return {
            success: true,
            suggestions,
            sources: sourceTypes,
            message: `Generated ${suggestions.length} search queries and ${sourceTypes.length} source type recommendations for "${topic}". Use these to manually find sources, then use import_source to add them to your notebook.`,
            notebookId,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to discover sources: ${error}`,
        };
    }
}

/**
 * Import a source URL into a notebook
 * 
 * Validates the URL and adds it as a source.
 * This is a wrapper around addURLSource with additional validation.
 */
export async function importSource(
    url: string,
    notebookId: string
): Promise<ResearchOperationResult> {
    const client = await getInitializedClient();
    if (!client) {
        return {
            success: false,
            error: 'API client not initialized. Please run setup_auth first.',
        };
    }

    try {
        log.info(`📥 Importing source: ${url}`);

        // Validate URL format
        try {
            new URL(url);
        } catch {
            return {
                success: false,
                error: `Invalid URL format: ${url}`,
            };
        }

        // Check if URL is accessible (basic validation)
        const supportedDomains = [
            'wikipedia.org',
            'arxiv.org',
            'youtube.com',
            'youtu.be',
            'github.com',
            'medium.com',
            'docs.google.com',
            'drive.google.com',
        ];

        const urlObj = new URL(url);
        const isKnownDomain = supportedDomains.some(domain =>
            urlObj.hostname.includes(domain)
        );

        if (!isKnownDomain) {
            log.warning(`⚠️  URL from unknown domain: ${urlObj.hostname}`);
        }

        // Use source operations to add the URL
        const result = await sourceOps.addURLSource(notebookId, url);

        if (result.success) {
            return {
                success: true,
                message: `Successfully imported source from ${urlObj.hostname}`,
                notebookId,
            };
        } else {
            return {
                success: false,
                error: result.error,
                notebookId,
            };
        }
    } catch (error) {
        return {
            success: false,
            error: `Failed to import source: ${error}`,
            notebookId,
        };
    }
}

/**
 * Research a topic and optionally import sources
 * 
 * Combines discovery and import in a single workflow.
 * If autoImport is true, attempts to import suggested sources.
 */
export async function researchTopic(
    topic: string,
    notebookId: string,
    autoImport: boolean = false
): Promise<ResearchOperationResult> {
    try {
        log.info(`📚 Researching topic: ${topic}`);

        // First, discover sources
        const discoveryResult = await discoverSources(topic, notebookId);

        if (!discoveryResult.success) {
            return discoveryResult;
        }

        // If autoImport is false, just return suggestions
        if (!autoImport) {
            return {
                success: true,
                suggestions: discoveryResult.suggestions,
                sources: discoveryResult.sources,
                message: `Research complete for "${topic}". Use the search queries to find sources manually, then import them using import_source tool.`,
                notebookId,
            };
        }

        // Auto-import mode: suggest some starter URLs
        const starterUrls = [
            `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/ /g, '_'))}`,
        ];

        log.info(`📥 Auto-importing ${starterUrls.length} starter sources...`);

        const importResults = await Promise.all(
            starterUrls.map(url => importSource(url, notebookId))
        );

        const successCount = importResults.filter(r => r.success).length;

        return {
            success: true,
            suggestions: discoveryResult.suggestions,
            sources: discoveryResult.sources,
            message: `Research complete for "${topic}". Auto-imported ${successCount}/${starterUrls.length} starter sources. Use the search queries to find additional sources.`,
            notebookId,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to research topic: ${error}`,
            notebookId,
        };
    }
}
