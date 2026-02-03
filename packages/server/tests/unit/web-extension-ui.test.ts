import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebExtensionUIContext } from '../../src/web-extension-ui';
import type { ExtensionUIResponse } from '@pi-web-ui/shared';

describe('WebExtensionUIContext', () => {
  let sendRequest: ReturnType<typeof vi.fn>;
  let sendNotification: ReturnType<typeof vi.fn>;
  let ctx: WebExtensionUIContext;

  beforeEach(() => {
    sendRequest = vi.fn();
    sendNotification = vi.fn();
    ctx = new WebExtensionUIContext({
      sendRequest,
      sendNotification,
    });
  });

  afterEach(() => {
    ctx.cancelAllPending();
  });

  describe('notify', () => {
    it('sends notification via callback', () => {
      ctx.notify('Hello', 'info');
      expect(sendNotification).toHaveBeenCalledWith('Hello', 'info');
    });

    it('defaults to info type', () => {
      ctx.notify('Hello');
      expect(sendNotification).toHaveBeenCalledWith('Hello', 'info');
    });
  });

  describe('select', () => {
    it('sends select request to client', async () => {
      const promise = ctx.select('Choose', ['a', 'b', 'c']);
      
      expect(sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'select',
          title: 'Choose',
          options: ['a', 'b', 'c'],
        })
      );

      // Simulate response
      const requestId = sendRequest.mock.calls[0][0].requestId;
      ctx.handleResponse({ requestId, cancelled: false, value: 'b' });

      const result = await promise;
      expect(result).toBe('b');
    });

    it('returns undefined when cancelled', async () => {
      const promise = ctx.select('Choose', ['a', 'b']);
      
      const requestId = sendRequest.mock.calls[0][0].requestId;
      ctx.handleResponse({ requestId, cancelled: true });

      const result = await promise;
      expect(result).toBeUndefined();
    });

    it('handles timeout', async () => {
      vi.useFakeTimers();
      
      const promise = ctx.select('Choose', ['a', 'b'], { timeout: 1000 });
      
      vi.advanceTimersByTime(1500);
      
      const result = await promise;
      expect(result).toBeUndefined();
      
      vi.useRealTimers();
    });
  });

  describe('confirm', () => {
    it('sends confirm request to client', async () => {
      const promise = ctx.confirm('Confirm', 'Are you sure?');
      
      expect(sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'confirm',
          title: 'Confirm',
          message: 'Are you sure?',
        })
      );

      const requestId = sendRequest.mock.calls[0][0].requestId;
      ctx.handleResponse({ requestId, cancelled: false, value: true });

      const result = await promise;
      expect(result).toBe(true);
    });

    it('returns undefined (falsy) when cancelled', async () => {
      const promise = ctx.confirm('Confirm', 'Are you sure?');
      
      const requestId = sendRequest.mock.calls[0][0].requestId;
      ctx.handleResponse({ requestId, cancelled: true });

      const result = await promise;
      // handleResponse resolves with undefined for all cancelled requests
      // callers should treat undefined/falsy as cancelled
      expect(result).toBeFalsy();
    });
  });

  describe('input', () => {
    it('sends input request to client', async () => {
      const promise = ctx.input('Enter name', 'Type here');
      
      expect(sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'input',
          title: 'Enter name',
          placeholder: 'Type here',
        })
      );

      const requestId = sendRequest.mock.calls[0][0].requestId;
      ctx.handleResponse({ requestId, cancelled: false, value: 'John' });

      const result = await promise;
      expect(result).toBe('John');
    });

    it('returns undefined when cancelled', async () => {
      const promise = ctx.input('Enter name');
      
      const requestId = sendRequest.mock.calls[0][0].requestId;
      ctx.handleResponse({ requestId, cancelled: true });

      const result = await promise;
      expect(result).toBeUndefined();
    });
  });

  describe('editor', () => {
    it('sends editor request to client', async () => {
      const promise = ctx.editor('Edit text', 'Initial content');
      
      expect(sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'editor',
          title: 'Edit text',
          prefill: 'Initial content',
        })
      );

      const requestId = sendRequest.mock.calls[0][0].requestId;
      ctx.handleResponse({ requestId, cancelled: false, value: 'Edited content' });

      const result = await promise;
      expect(result).toBe('Edited content');
    });
  });

  describe('handleResponse', () => {
    it('ignores responses for unknown request IDs', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      ctx.handleResponse({ requestId: 'unknown', cancelled: false });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No pending request')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('cancelAllPending', () => {
    it('resolves all pending requests with undefined', async () => {
      const promise1 = ctx.select('Choose 1', ['a']);
      const promise2 = ctx.select('Choose 2', ['b']);
      
      ctx.cancelAllPending();
      
      expect(await promise1).toBeUndefined();
      expect(await promise2).toBeUndefined();
    });
  });

  describe('setStatus', () => {
    it('stores status values', () => {
      ctx.setStatus('key1', 'value1');
      // No error thrown - status is stored internally
    });

    it('removes status when undefined', () => {
      ctx.setStatus('key1', 'value1');
      ctx.setStatus('key1', undefined);
      // No error thrown
    });
  });

  describe('editor text', () => {
    it('uses setEditorText callback', () => {
      const setEditorText = vi.fn();
      const ctxWithEditor = new WebExtensionUIContext({
        sendRequest,
        sendNotification,
        setEditorText,
      });

      ctxWithEditor.setEditorText('hello');
      expect(setEditorText).toHaveBeenCalledWith('hello');
    });

    it('uses getEditorText callback', () => {
      const getEditorText = vi.fn().mockReturnValue('current text');
      const ctxWithEditor = new WebExtensionUIContext({
        sendRequest,
        sendNotification,
        getEditorText,
      });

      const result = ctxWithEditor.getEditorText();
      expect(result).toBe('current text');
    });

    it('returns empty string when no getEditorText callback', () => {
      expect(ctx.getEditorText()).toBe('');
    });
  });

  describe('TUI-specific methods (no-ops)', () => {
    it('setWorkingMessage does not throw', () => {
      expect(() => ctx.setWorkingMessage('Working...')).not.toThrow();
      expect(() => ctx.setWorkingMessage()).not.toThrow();
    });

    it('setWidget does not throw', () => {
      expect(() => ctx.setWidget('key', {})).not.toThrow();
    });

    it('setFooter does not throw', () => {
      expect(() => ctx.setFooter(() => null)).not.toThrow();
    });

    it('setHeader does not throw', () => {
      expect(() => ctx.setHeader(() => null)).not.toThrow();
    });

    it('setTitle does not throw', () => {
      expect(() => ctx.setTitle('Title')).not.toThrow();
    });

    it('setEditorComponent does not throw', () => {
      expect(() => ctx.setEditorComponent(() => null)).not.toThrow();
    });
  });

  describe('theme', () => {
    it('returns a minimal theme object', () => {
      expect(ctx.theme).toBeTruthy();
      expect(ctx.theme.fg).toBeDefined();
      expect(ctx.theme.bold).toBeDefined();
    });

    it('theme methods return text as-is', () => {
      expect(ctx.theme.fg('red', 'hello')).toBe('hello');
      expect(ctx.theme.bold('hello')).toBe('hello');
    });

    it('getAllThemes returns empty array', () => {
      expect(ctx.getAllThemes()).toEqual([]);
    });

    it('getTheme returns undefined', () => {
      expect(ctx.getTheme('any')).toBeUndefined();
    });

    it('setTheme returns error', () => {
      const result = ctx.setTheme('theme');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('custom', () => {
    it('returns undefined (cancellation signal)', async () => {
      const result = await ctx.custom(() => null);
      expect(result).toBeUndefined();
    });
  });
});
