/**
 * Web-based implementation of ExtensionUIContext.
 * 
 * Sends UI requests to the client via callbacks and waits for responses.
 * This enables extension commands like /review to show interactive UI
 * in the web client.
 */

import type { ExtensionUIContext, ExtensionUIDialogOptions, WidgetPlacement, ExtensionWidgetOptions } from '@mariozechner/pi-coding-agent';
import type { ExtensionUIRequest, ExtensionUIResponse } from '@pi-web-ui/shared';

// Generate unique request IDs
let requestIdCounter = 0;
function generateRequestId(): string {
  return `ext-ui-${Date.now()}-${++requestIdCounter}`;
}

/** Callback to send UI request to client */
export type SendUIRequestCallback = (request: ExtensionUIRequest) => void;

/** Callback to send notification */
export type SendNotificationCallback = (message: string, type: 'info' | 'warning' | 'error') => void;

/** Callback to set editor text */
export type SetEditorTextCallback = (text: string) => void;

/** Callback to get editor text */
export type GetEditorTextCallback = () => string;

export interface WebExtensionUIContextOptions {
  /** Callback to send UI requests to the client */
  sendRequest: SendUIRequestCallback;
  /** Callback to send notifications */
  sendNotification: SendNotificationCallback;
  /** Callback to set editor text */
  setEditorText?: SetEditorTextCallback;
  /** Callback to get editor text */
  getEditorText?: GetEditorTextCallback;
}

/**
 * Web-based ExtensionUIContext implementation.
 * 
 * For interactive methods (select, confirm, input, editor), this sends
 * a request to the client and waits for a response via the pending
 * requests map.
 * 
 * For non-interactive methods (notify, setStatus, setWidget, etc.),
 * these are either forwarded to the client or are no-ops in web mode.
 */
export class WebExtensionUIContext implements ExtensionUIContext {
  private sendRequest: SendUIRequestCallback;
  private sendNotification: SendNotificationCallback;
  private _setEditorText?: SetEditorTextCallback;
  private _getEditorText?: GetEditorTextCallback;
  
  /** Pending requests waiting for client responses */
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeoutId?: ReturnType<typeof setTimeout>;
  }>();

  /** Status text values (stored locally, not sent to client yet) */
  private statusValues = new Map<string, string>();

  constructor(options: WebExtensionUIContextOptions) {
    this.sendRequest = options.sendRequest;
    this.sendNotification = options.sendNotification;
    this._setEditorText = options.setEditorText;
    this._getEditorText = options.getEditorText;
  }

  /**
   * Handle a response from the client.
   * Call this when receiving a WsExtensionUIResponseMessage.
   */
  handleResponse(response: ExtensionUIResponse): void {
    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) {
      console.warn(`No pending request for response: ${response.requestId}`);
      return;
    }

    // Clear timeout if set
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    this.pendingRequests.delete(response.requestId);

    if (response.cancelled) {
      pending.resolve(undefined);
    } else {
      pending.resolve(response.value);
    }
  }

  /**
   * Cancel all pending requests (e.g., when session is disposed).
   */
  cancelAllPending(): void {
    for (const [requestId, pending] of this.pendingRequests) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.resolve(undefined);
    }
    this.pendingRequests.clear();
  }

  // ============================================================================
  // Interactive UI Methods (send request, wait for response)
  // ============================================================================

  async select(title: string, options: string[], opts?: ExtensionUIDialogOptions): Promise<string | undefined> {
    const requestId = generateRequestId();
    
    return new Promise((resolve, reject) => {
      // Set up timeout if specified
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (opts?.timeout) {
        timeoutId = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          resolve(undefined);
        }, opts.timeout);
      }

      // Handle abort signal
      if (opts?.signal) {
        opts.signal.addEventListener('abort', () => {
          if (timeoutId) clearTimeout(timeoutId);
          this.pendingRequests.delete(requestId);
          resolve(undefined);
        });
      }

      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      this.sendRequest({
        method: 'select',
        requestId,
        title,
        options,
        timeout: opts?.timeout,
      });
    });
  }

  async confirm(title: string, message: string, opts?: ExtensionUIDialogOptions): Promise<boolean> {
    const requestId = generateRequestId();
    
    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (opts?.timeout) {
        timeoutId = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          resolve(false);
        }, opts.timeout);
      }

      if (opts?.signal) {
        opts.signal.addEventListener('abort', () => {
          if (timeoutId) clearTimeout(timeoutId);
          this.pendingRequests.delete(requestId);
          resolve(false);
        });
      }

      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      this.sendRequest({
        method: 'confirm',
        requestId,
        title,
        message,
        timeout: opts?.timeout,
      });
    });
  }

  async input(title: string, placeholder?: string, opts?: ExtensionUIDialogOptions): Promise<string | undefined> {
    const requestId = generateRequestId();
    
    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (opts?.timeout) {
        timeoutId = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          resolve(undefined);
        }, opts.timeout);
      }

      if (opts?.signal) {
        opts.signal.addEventListener('abort', () => {
          if (timeoutId) clearTimeout(timeoutId);
          this.pendingRequests.delete(requestId);
          resolve(undefined);
        });
      }

      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      this.sendRequest({
        method: 'input',
        requestId,
        title,
        placeholder,
        timeout: opts?.timeout,
      });
    });
  }

  async editor(title: string, prefill?: string): Promise<string | undefined> {
    const requestId = generateRequestId();
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      this.sendRequest({
        method: 'editor',
        requestId,
        title,
        prefill,
      });
    });
  }

  // ============================================================================
  // Non-interactive methods
  // ============================================================================

  notify(message: string, type?: 'info' | 'warning' | 'error'): void {
    this.sendNotification(message, type || 'info');
  }

  setStatus(key: string, text: string | undefined): void {
    if (text === undefined) {
      this.statusValues.delete(key);
    } else {
      this.statusValues.set(key, text);
    }
    // TODO: Could send status updates to client if needed
  }

  setWorkingMessage(message?: string): void {
    // Not implemented for web UI - could show in status bar
  }

  setWidget(key: string, content: any, options?: ExtensionWidgetOptions): void {
    // Widgets are TUI-specific, not supported in web UI
    // Could potentially render simple text widgets in future
  }

  setFooter(factory: any): void {
    // Footer is TUI-specific
  }

  setHeader(factory: any): void {
    // Header is TUI-specific
  }

  setTitle(title: string): void {
    // Could potentially update browser tab title
  }

  // custom<T>() is not fully supported in web UI
  // We return a promise that rejects to signal unsupported, which extensions
  // should handle gracefully. This is better than returning undefined immediately
  // because it allows the extension to know the feature isn't available.
  async custom<T>(factory: any, options?: any): Promise<T> {
    // Custom components are TUI-specific
    // We could potentially implement a basic version for simple select lists,
    // but for now we signal cancellation by returning a rejected promise
    // that extensions can catch
    console.warn('[WebExtensionUIContext] custom() called but not fully supported in web mode');
    // Return undefined cast as T - this signals cancellation in most extension code
    return undefined as T;
  }

  setEditorText(text: string): void {
    if (this._setEditorText) {
      this._setEditorText(text);
    }
  }

  getEditorText(): string {
    if (this._getEditorText) {
      return this._getEditorText();
    }
    return '';
  }

  setEditorComponent(factory: any): void {
    // Custom editor components are TUI-specific
  }

  // Theme-related methods
  get theme(): any {
    // Return a minimal theme object for web UI
    // Extensions shouldn't rely on theme in web mode
    return {
      fg: (color: string, text: string) => text,
      bold: (text: string) => text,
    };
  }

  getAllThemes(): { name: string; path: string | undefined }[] {
    return [];
  }

  getTheme(name: string): any {
    return undefined;
  }

  setTheme(theme: string | any): { success: boolean; error?: string } {
    return { success: false, error: 'Theme switching not supported in web UI' };
  }
}
