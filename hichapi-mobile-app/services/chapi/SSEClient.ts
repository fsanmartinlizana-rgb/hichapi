/**
 * SSE (Server-Sent Events) client for streaming Chapi responses.
 */

/**
 * SSE (Server-Sent Events) client for streaming Chapi responses.
 * Uses XMLHttpRequest since React Native fetch does not support streams.
 */

export class SSEClient {
  async stream(
    url: string,
    body: Record<string, unknown>,
    onEvent: (event: string, data: any) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');

    let lastIndex = 0;
    let currentEvent = '';

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3 || xhr.readyState === 4) {
        const newData = xhr.responseText.substring(lastIndex);
        lastIndex = xhr.responseText.length;

        const lines = newData.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim();
          } else if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6).trim());
              onEvent(currentEvent || 'message', data);
            } catch {
              // Partial JSON — wait for next chunk
            }
          }
        }
      }

      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          onComplete();
        } else {
          onError(new Error(`SSE request failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      onError(new Error('Network error during SSE request'));
    };

    xhr.send(JSON.stringify(body));
  }
}

export const sseClient = new SSEClient();
