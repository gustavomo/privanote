import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/renderer/App.jsx';

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);

  constructor(stream, options = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType || 'video/webm';
    this.listeners = {};
  }

  addEventListener(type, handler) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(handler);
  }

  start() {}

  stop() {
    const blob = new Blob(['recorded bytes'], {
      type: this.mimeType,
    });

    queueMicrotask(() => {
      (this.listeners.dataavailable || []).forEach((handler) => handler({ data: blob }));
      (this.listeners.stop || []).forEach((handler) => handler());
    });
  }
}

function createMockApi() {
  let nextNodeId = 1;
  let nextAttachmentId = 1;
  let nodes = [];
  let attachments = [];

  const api = {
    listNodes: vi.fn(async () => [...nodes]),
    createNode: vi.fn(async (payload) => {
      const node = {
        id: nextNodeId++,
        title: payload.title,
        description: payload.description || '',
        tags: payload.tags || '',
        created_at: '2026-03-29T00:00:00.000Z',
        updated_at: '2026-03-29T00:00:00.000Z',
      };
      nodes = [node, ...nodes];
      return node;
    }),
    updateNode: vi.fn(async (payload) => {
      nodes = nodes.map((node) =>
        node.id === payload.id
          ? {
              ...node,
              title: payload.title,
              description: payload.description || '',
              tags: payload.tags || '',
              updated_at: '2026-03-29T01:00:00.000Z',
            }
          : node
      );
      return nodes.find((node) => node.id === payload.id);
    }),
    deleteNode: vi.fn(async (nodeId) => {
      nodes = nodes.filter((node) => node.id !== nodeId);
      attachments = attachments.filter((attachment) => attachment.node_id !== nodeId);
      return true;
    }),
    listAttachments: vi.fn(async (nodeId) =>
      attachments.filter((attachment) => attachment.node_id === nodeId)
    ),
    addAttachment: vi.fn(async (payload) => {
      const attachment = {
        id: nextAttachmentId++,
        node_id: payload.nodeId,
        kind: payload.kind,
        local_path: payload.localPath,
        cloud_url: '',
        created_at: '2026-03-29T00:05:00.000Z',
      };
      attachments = [attachment, ...attachments];
      return attachment;
    }),
    deleteAttachment: vi.fn(async (attachmentId) => {
      attachments = attachments.filter((attachment) => attachment.id !== attachmentId);
      return true;
    }),
    saveRecording: vi.fn(async (payload, file) => {
      const node = nodes.find((item) => item.id === payload.nodeId);
      const attachment = {
        id: nextAttachmentId++,
        node_id: payload.nodeId,
        kind: payload.captureMode === 'audio' ? 'audio' : 'video',
        local_path: `/tmp/${file.fileName}`,
        cloud_url: '',
        created_at: '2026-03-29T00:10:00.000Z',
      };
      attachments = [attachment, ...attachments];
      return {
        node,
        attachment,
      };
    }),
    importMedia: vi.fn(async () => {
      throw new Error('importMedia is not used in capture review tests.');
    }),
    getAttachmentContentUrl: vi.fn(async (attachmentId) => `http://localhost/preview/${attachmentId}`),
    openPath: vi.fn(async () => ''),
    getMediaAccessStatus: vi.fn(async () => 'granted'),
    requestMediaAccess: vi.fn(async () => ({
      granted: true,
      status: 'granted',
    })),
    pickFile: vi.fn(async () => null),
  };

  return api;
}

function createMediaStream() {
  return {
    getTracks: () => [
      {
        stop: vi.fn(),
      },
    ],
  };
}

beforeEach(() => {
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:review-preview'),
    revokeObjectURL: vi.fn(),
  });

  Object.defineProperty(global.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => createMediaStream()),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('capture review flow', () => {
  it('captures audio into review and saves it through saveRecording', async () => {
    const api = createMockApi();

    render(<App api={api} />);

    expect(await screen.findByText('Capture')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));

    await waitFor(() => {
      expect(api.createNode).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/^Audio note - /),
        })
      );
    });

    await waitFor(() => {
      expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: false,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Stop Recording' }));

    expect(await screen.findByRole('button', { name: 'Save Recording' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Recording' }));

    await waitFor(() => {
      expect(api.saveRecording).toHaveBeenCalledWith(
        expect.objectContaining({
          captureMode: 'audio',
        }),
        expect.objectContaining({
          fileName: 'audio-note.webm',
          bytes: expect.any(ArrayBuffer),
        })
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save Recording' })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(api.getAttachmentContentUrl).toHaveBeenCalledTimes(1);
    });

    expect(document.querySelector('audio')).not.toBeNull();
    expect(await screen.findByRole('button', { name: 'Remove Media' })).toBeInTheDocument();
  });

  it('captures Video + Audio into review and deletes the placeholder note when discarded', async () => {
    const api = createMockApi();

    render(<App api={api} />);

    const audioButton = screen.getByRole('button', { name: 'Audio' });
    const videoButton = screen.getByRole('button', { name: 'Video' });
    const videoWithAudioButton = screen.getByRole('button', { name: 'Video + Audio' });

    expect(audioButton).toHaveAttribute('aria-pressed', 'true');
    expect(audioButton).toHaveAttribute('data-state', 'active');
    expect(videoButton).toHaveAttribute('aria-pressed', 'false');
    expect(videoButton).toHaveAttribute('data-state', 'inactive');
    expect(videoWithAudioButton).toHaveAttribute('aria-pressed', 'false');
    expect(videoWithAudioButton).toHaveAttribute('data-state', 'inactive');

    fireEvent.click(videoWithAudioButton);
    expect(audioButton).toHaveAttribute('aria-pressed', 'false');
    expect(audioButton).toHaveAttribute('data-state', 'inactive');
    expect(videoWithAudioButton).toHaveAttribute('aria-pressed', 'true');
    expect(videoWithAudioButton).toHaveAttribute('data-state', 'active');

    fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));

    await waitFor(() => {
      expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: true,
      });
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Stop Recording' }));
    expect(await screen.findByRole('button', { name: 'Discard Recording' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Discard Recording' }));

    await waitFor(() => {
      expect(api.deleteNode).toHaveBeenCalledTimes(1);
    });
  });

  it('renders the inline permission failure copy when media access fails', async () => {
    const api = createMockApi();
    global.navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('permission denied'));

    render(<App api={api} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));

    expect(
      await screen.findByText(
        'Camera or microphone access is unavailable. Check device permissions, then retry or switch to import.'
      )
    ).toBeInTheDocument();
  });
});
