// Validate required environment variables
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error('Missing required environment variable: EXPO_PUBLIC_API_BASE_URL');
}

/** Base URL for all Next.js API route requests */
export const API_BASE_URL: string = apiBaseUrl;

/** Request timeout in milliseconds (30 seconds) */
export const API_TIMEOUT = 30_000;

/** Number of retry attempts for failed requests */
export const API_RETRY_ATTEMPTS = 3;

/** Base delay in milliseconds for exponential backoff between retries */
export const API_RETRY_DELAY = 1_000;
