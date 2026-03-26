/**
 * Hybrid Executor
 * 
 * Provides API-first execution with browser fallback for improved reliability.
 * This is a simplified version focusing on core retry and fallback logic.
 */

import { log } from '../utils/logger.js';

/**
 * Options for hybrid execution
 */
export interface HybridExecutionOptions {
    /** Maximum number of retries for API operation */
    maxRetries?: number;
    /** Initial retry delay in milliseconds */
    retryDelay?: number;
    /** Whether to use exponential backoff */
    exponentialBackoff?: boolean;
    /** Timeout for each operation in milliseconds */
    timeout?: number;
}

/**
 * Result of hybrid execution
 */
export interface HybridExecutionResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    executionMethod: 'api' | 'browser' | 'failed';
    retriesUsed: number;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<HybridExecutionOptions> = {
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
    timeout: 30000,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute operation with timeout
 */
async function withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
): Promise<T> {
    return Promise.race([
        operation(),
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
        ),
    ]);
}

/**
 * Execute with API-first strategy and browser fallback
 * 
 * @param apiOperation - Primary API operation to execute
 * @param browserOperation - Fallback browser operation (optional)
 * @param options - Execution options
 * @returns Hybrid execution result
 */
export async function executeWithFallback<T>(
    apiOperation: () => Promise<T>,
    browserOperation?: () => Promise<T>,
    options: HybridExecutionOptions = {}
): Promise<HybridExecutionResult<T>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let retriesUsed = 0;
    let lastError: Error | undefined;

    // Try API operation with retries
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            log.info(`🔄 Attempting API operation (attempt ${attempt + 1}/${opts.maxRetries + 1})`);

            const result = await withTimeout(apiOperation, opts.timeout);

            log.success(`✅ API operation succeeded on attempt ${attempt + 1}`);
            return {
                success: true,
                data: result,
                executionMethod: 'api',
                retriesUsed: attempt,
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            retriesUsed = attempt;

            if (attempt < opts.maxRetries) {
                const delay = opts.exponentialBackoff
                    ? opts.retryDelay * Math.pow(2, attempt)
                    : opts.retryDelay;

                log.warning(
                    `⚠️  API attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`
                );
                await sleep(delay);
            } else {
                log.error(`❌ API operation failed after ${attempt + 1} attempts`);
            }
        }
    }

    // If browser operation is provided, try it as fallback
    if (browserOperation) {
        try {
            log.info('🌐 Falling back to browser operation...');
            const result = await withTimeout(browserOperation, opts.timeout);

            log.success('✅ Browser operation succeeded');
            return {
                success: true,
                data: result,
                executionMethod: 'browser',
                retriesUsed,
            };
        } catch (error) {
            const browserError = error instanceof Error ? error : new Error(String(error));
            log.error(`❌ Browser operation also failed: ${browserError.message}`);

            return {
                success: false,
                error: `Both API and browser operations failed. Last API error: ${lastError?.message}. Browser error: ${browserError.message}`,
                executionMethod: 'failed',
                retriesUsed,
            };
        }
    }

    // No browser fallback available
    return {
        success: false,
        error: `API operation failed after ${retriesUsed + 1} attempts: ${lastError?.message}`,
        executionMethod: 'failed',
        retriesUsed,
    };
}

/**
 * Execute API operation with retry logic only (no browser fallback)
 * 
 * @param operation - API operation to execute
 * @param options - Execution options
 * @returns Execution result
 */
export async function executeWithRetry<T>(
    operation: () => Promise<T>,
    options: HybridExecutionOptions = {}
): Promise<HybridExecutionResult<T>> {
    return executeWithFallback(operation, undefined, options);
}
