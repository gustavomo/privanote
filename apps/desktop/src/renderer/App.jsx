import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from './lib/utils.js';
import MediaCard from './components/media-card.jsx';
import SettingsView from './components/settings-view.jsx';
import TranscriptSection from './components/transcript-section.jsx';

const captureModes = [
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'video-with-audio', label: 'Video + Audio' },
];

const defaultSettings = {
  storageDestination: 'local',
  localMediaDirectory: '',
  transcriptionMode: 'local',
  providerKind: 'openai',
  backendApiKey: '',
  backendApiKeyConfigured: false,
  backendApiKeyMaskedHint: '',
  clearBackendApiKey: false,
  localRuntimeStatus: 'not-ready',
};

const providerLabels = {
  'google-drive': 'Google Drive',
  onedrive: 'OneDrive',
};

const captureFailureCopy =
  'Camera or microphone access is unavailable. Check device permissions, then retry or switch to import.';

function renderToggleIndicator(isActive) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'h-2.5 w-2.5 rounded-full border transition-all',
        isActive
          ? 'border-primary-foreground/70 bg-primary-foreground shadow-[0_0_0_3px_rgba(255,255,255,0.16)]'
          : 'border-border bg-transparent opacity-70'
      )}
    />
  );
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString();
}

function createUnavailableApi() {
  return {
    listNodes: async () => {
      throw new Error("We couldn't load your notes. Relaunch Privanote or restart the local backend, then try again.");
    },
    createNode: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    updateNode: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    deleteNode: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    getSettings: async () => ({ ...defaultSettings }),
    updateSettings: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    listProviderConnections: async () => [],
    beginProviderConnection: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    disconnectProvider: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    getNoteTranscript: async () => null,
    retryNoteTranscript: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    retryAttachmentSync: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    listAttachments: async () => [],
    addAttachment: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    deleteAttachment: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    saveRecording: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    importMedia: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    getAttachmentContentUrl: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    openPath: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    openExternalUrl: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    getMediaAccessStatus: async () => 'unknown',
    requestMediaAccess: async () => ({ granted: false, status: 'unknown' }),
    pickFile: async () => null,
    pickDirectory: async () => null,
  };
}

function confirmAction(message) {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true;
  }

  return window.confirm(message);
}

function resolveCaptureConstraints(captureMode) {
  if (captureMode === 'audio') {
    return {
      audio: true,
      video: false,
    };
  }

  if (captureMode === 'video') {
    return {
      audio: false,
      video: true,
    };
  }

  return {
    audio: true,
    video: true,
  };
}

function resolveRequiredPermissions(captureMode) {
  if (captureMode === 'audio') {
    return ['microphone'];
  }

  if (captureMode === 'video') {
    return ['camera'];
  }

  return ['camera', 'microphone'];
}

function resolveSupportedMimeType(captureMode) {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  const candidates =
    captureMode === 'audio'
      ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
      : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
}

function createPlaceholderTitle(captureMode, createdAt = new Date()) {
  const prefix = captureMode === 'audio' ? 'Audio note' : 'Video note';
  return `${prefix} - ${createdAt.toLocaleString()}`;
}

function resolveFileExtension(mimeType) {
  if (mimeType.includes('ogg')) {
    return 'ogg';
  }

  if (mimeType.includes('mp4')) {
    return 'mp4';
  }

  if (mimeType.includes('wav')) {
    return 'wav';
  }

  return 'webm';
}

function createRecordingFileName(captureMode, mimeType) {
  const prefix = captureMode === 'audio' ? 'audio-note' : 'video-note';
  return `${prefix}.${resolveFileExtension(mimeType || '')}`;
}

function inferImportedKind(filePath) {
  const normalizedPath = String(filePath || '').toLowerCase();

  if (/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(normalizedPath)) {
    return 'audio';
  }

  if (/\.(mp4|mov|mkv|webm|avi|m4v)$/.test(normalizedPath)) {
    return 'video';
  }

  return 'file';
}

function createImportPlaceholderTitle(kind, createdAt = new Date()) {
  const prefix =
    kind === 'audio' ? 'Imported audio' : kind === 'video' ? 'Imported video' : 'Imported file';

  return `${prefix} - ${createdAt.toLocaleString()}`;
}

async function buildRecordingFile(blob, captureMode) {
  const mimeType = blob.type || (captureMode === 'audio' ? 'audio/webm' : 'video/webm');
  const bytes =
    typeof blob.arrayBuffer === 'function'
      ? await blob.arrayBuffer()
      : await new Response(blob).arrayBuffer();

  return {
    fileName: createRecordingFileName(captureMode, mimeType),
    mimeType,
    bytes,
  };
}

function getProviderConnection(providerConnections, provider) {
  return (
    providerConnections.find((connection) => connection.provider === provider) || {
      provider,
      connectionStatus: 'disconnected',
      accountLabel: '',
      lastError: '',
    }
  );
}

export default function App({ api }) {
  const client = {
    ...createUnavailableApi(),
    ...(api || globalThis.window?.api || {}),
  };
  const [activeView, setActiveView] = useState('workspace');
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeDescription, setNewNodeDescription] = useState('');
  const [newNodeTags, setNewNodeTags] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');
  const [captureMode, setCaptureMode] = useState('audio');
  const [captureState, setCaptureState] = useState('idle');
  const [captureError, setCaptureError] = useState('');
  const [reviewRecording, setReviewRecording] = useState(null);
  const [isSavingRecording, setIsSavingRecording] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(defaultSettings);
  const [providerConnections, setProviderConnections] = useState([]);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsErrorDetail, setSettingsErrorDetail] = useState('');
  const [transcript, setTranscript] = useState(null);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState('');
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const captureChunksRef = useRef([]);
  const reviewUrlRef = useRef('');
  const providerPollingRef = useRef({});
  const selectedNodeIdRef = useRef(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  function stopMediaStream() {
    if (!mediaStreamRef.current) {
      return;
    }

    mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function clearReviewRecording() {
    if (reviewUrlRef.current && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(reviewUrlRef.current);
    }

    reviewUrlRef.current = '';
    setReviewRecording(null);
    setCaptureState('idle');
  }

  async function loadNodes() {
    setLoading(true);
    setError('');

    try {
      const rows = await client.listNodes();
      setNodes(rows);

      if (!rows.length) {
        setSelectedNodeId(null);
        return;
      }

      setSelectedNodeId((current) => {
        const stillExists = rows.some((node) => node.id === current);
        return stillExists ? current : rows[0].id;
      });
    } catch (loadError) {
      setError(
        loadError.message ||
          "We couldn't load your notes. Relaunch Privanote or restart the local backend, then try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    setIsSettingsLoading(true);
    setSettingsError('');
    setSettingsErrorDetail('');

    try {
      const nextSettings = await client.getSettings();
      setSettingsDraft({
        ...defaultSettings,
        ...nextSettings,
        backendApiKey: '',
        clearBackendApiKey: false,
      });
    } catch (loadError) {
      setSettingsError(loadError.message || "We couldn't load your settings.");
    } finally {
      setIsSettingsLoading(false);
    }
  }

  async function loadProviderConnections() {
    try {
      const rows = await client.listProviderConnections();
      setProviderConnections(Array.isArray(rows) ? rows : []);
      return Array.isArray(rows) ? rows : [];
    } catch (loadError) {
      setSettingsError(loadError.message || "We couldn't load your cloud sync providers.");
      return [];
    }
  }

  async function loadAttachments(nodeId) {
    if (!nodeId) {
      setAttachments([]);
      return;
    }

    try {
      const rows = await client.listAttachments(nodeId);
      setAttachments(rows);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load attachments.');
    }
  }

  async function loadTranscript(nodeId) {
    if (!nodeId) {
      setTranscript(null);
      setTranscriptError('');
      setIsTranscriptLoading(false);
      return;
    }

    setIsTranscriptLoading(true);
    setTranscriptError('');

    try {
      const nextTranscript = await client.getNoteTranscript(nodeId);
      setTranscript(nextTranscript);
    } catch (loadError) {
      setTranscriptError(loadError.message || 'Unable to load transcript.');
    } finally {
      setIsTranscriptLoading(false);
    }
  }

  function stopProviderPolling(provider) {
    const activeTimer = providerPollingRef.current[provider];
    if (activeTimer) {
      clearInterval(activeTimer);
      delete providerPollingRef.current[provider];
    }
  }

  function startProviderPolling(provider) {
    stopProviderPolling(provider);

    providerPollingRef.current[provider] = setInterval(async () => {
      const rows = await loadProviderConnections();
      const connection = getProviderConnection(rows, provider);
      if (connection.connectionStatus === 'pending') {
        return;
      }

      stopProviderPolling(provider);
      await loadSettings();

      if (selectedNodeIdRef.current) {
        await loadAttachments(selectedNodeIdRef.current);
      }
    }, 2000);
  }

  async function ensureCapturePermissions(mode) {
    const requiredPermissions = resolveRequiredPermissions(mode);

    for (const permission of requiredPermissions) {
      const status = await client.getMediaAccessStatus(permission);

      if (status === 'denied' || status === 'restricted') {
        throw new Error(captureFailureCopy);
      }

      if (status === 'not-determined') {
        const result = await client.requestMediaAccess(permission);
        if (!result.granted) {
          throw new Error(captureFailureCopy);
        }
      }
    }
  }

  async function ensureCaptureNode(mode) {
    if (selectedNode) {
      return {
        node: selectedNode,
        placeholderNoteId: null,
        placeholderTitle: selectedNode.title,
      };
    }

    const placeholderTitle = createPlaceholderTitle(mode);
    const node = await client.createNode({
      title: placeholderTitle,
      description: '',
      tags: '',
    });

    setNodes((current) => [node, ...current.filter((item) => item.id !== node.id)]);
    setSelectedNodeId(node.id);

    return {
      node,
      placeholderNoteId: node.id,
      placeholderTitle,
    };
  }

  function updateSettingsDraft(patch) {
    setSettingsDraft((current) => ({
      ...current,
      ...patch,
    }));
    setSettingsError('');
    setSettingsErrorDetail('');
  }

  async function handleChooseDirectory() {
    setSettingsError('');

    try {
      const nextPath = await client.pickDirectory();
      if (!nextPath) {
        return;
      }

      updateSettingsDraft({ localMediaDirectory: nextPath });
    } catch (pickError) {
      setSettingsError(pickError.message || 'Unable to choose a local folder.');
    }
  }

  async function handleSaveSettings() {
    const nextProviderConnection =
      settingsDraft.storageDestination === 'local'
        ? null
        : getProviderConnection(providerConnections, settingsDraft.storageDestination);

    if (nextProviderConnection && nextProviderConnection.connectionStatus !== 'connected') {
      setSettingsError(
        `Connect ${providerLabels[settingsDraft.storageDestination]} before saving it as the default destination.`
      );
      setSettingsErrorDetail('');
      return;
    }

    setIsSavingSettings(true);
    setSettingsError('');
    setSettingsErrorDetail('');

    try {
      const updatedSettings = await client.updateSettings({
        storageDestination: settingsDraft.storageDestination,
        localMediaDirectory: settingsDraft.localMediaDirectory,
        transcriptionMode: settingsDraft.transcriptionMode,
        providerKind: settingsDraft.providerKind,
        backendApiKey: settingsDraft.backendApiKey,
        clearBackendApiKey: settingsDraft.clearBackendApiKey,
      });

      setSettingsDraft({
        ...defaultSettings,
        ...updatedSettings,
        backendApiKey: '',
        clearBackendApiKey: false,
      });
      await loadProviderConnections();
      if (selectedNodeIdRef.current) {
        await loadAttachments(selectedNodeIdRef.current);
      }
    } catch (saveError) {
      setSettingsError("We couldn't save these settings. Fix the highlighted fields and try again.");
      setSettingsErrorDetail(saveError.message || '');
    } finally {
      setIsSavingSettings(false);
    }
  }

  function handleClearCredential() {
    if (
      !confirmAction(
        'Clear Credential: Remove the saved backend API key from this device? Transcript jobs in Backend mode will fail until a new key is saved.'
      )
    ) {
      return;
    }

    updateSettingsDraft({
      backendApiKey: '',
      clearBackendApiKey: true,
      backendApiKeyConfigured: false,
      backendApiKeyMaskedHint: '',
    });
  }

  async function handleBeginProviderConnection(provider) {
    setSettingsError('');
    setSettingsErrorDetail('');

    try {
      const result = await client.beginProviderConnection(provider);
      await loadProviderConnections();

      if (result?.authorizationUrl) {
        await client.openExternalUrl(result.authorizationUrl);
      }

      startProviderPolling(provider);
    } catch (connectError) {
      setSettingsError(connectError.message || `Unable to connect ${providerLabels[provider]}.`);
    }
  }

  async function handleDisconnectProvider(provider) {
    if (
      !confirmAction(
        'Disconnect Provider: Remove this provider connection from Privanote? Existing remote files stay in your account, and local attachments remain available here.'
      )
    ) {
      return;
    }

    setSettingsError('');
    setSettingsErrorDetail('');

    try {
      await client.disconnectProvider(provider);
      stopProviderPolling(provider);
      await loadProviderConnections();
      setSettingsDraft((current) => ({
        ...current,
        storageDestination: current.storageDestination === provider ? 'local' : current.storageDestination,
      }));
      if (selectedNodeIdRef.current) {
        await loadAttachments(selectedNodeIdRef.current);
      }
    } catch (disconnectError) {
      setSettingsError(disconnectError.message || `Unable to disconnect ${providerLabels[provider]}.`);
    }
  }

  async function handleCreateNode(event) {
    event.preventDefault();
    setError('');

    try {
      const node = await client.createNode({
        title: newNodeTitle,
        description: newNodeDescription,
        tags: newNodeTags,
      });

      setNodes((current) => [node, ...current.filter((item) => item.id !== node.id)]);
      setSelectedNodeId(node.id);
      setNewNodeTitle('');
      setNewNodeDescription('');
      setNewNodeTags('');
    } catch (submitError) {
      setError(submitError.message || 'Unable to create note.');
    }
  }

  async function handleSaveNode(event) {
    event.preventDefault();
    if (!selectedNode) {
      return;
    }

    setError('');

    try {
      const updatedNode = await client.updateNode({
        id: selectedNode.id,
        title: editTitle,
        description: editDescription,
        tags: editTags,
      });

      setNodes((current) =>
        current.map((node) => (node.id === updatedNode.id ? updatedNode : node))
      );
    } catch (updateError) {
      setError(updateError.message || 'Unable to update note.');
    }
  }

  async function handleDeleteNode(nodeId) {
    if (!confirmAction('Delete Note: Delete this note and all linked media? This cannot be undone.')) {
      return;
    }

    setError('');

    try {
      await client.deleteNode(nodeId);
      await loadNodes();
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete note.');
    }
  }

  async function handlePickFile() {
    setError('');

    try {
      return await client.pickFile();
    } catch (pickError) {
      setError(pickError.message || 'Unable to open file picker.');
      return null;
    }
  }

  async function handleImportFiles() {
    setError('');
    setCaptureError('');

    try {
      const sourcePath = await handlePickFile();
      if (!sourcePath) {
        return;
      }

      const kind = inferImportedKind(sourcePath);
      const result = await client.importMedia({
        nodeId: selectedNode?.id,
        title: createImportPlaceholderTitle(kind),
        kind,
        sourcePath,
      });

      await loadNodes();
      setSelectedNodeId(result.node.id);
      await loadAttachments(result.node.id);
    } catch (importError) {
      setError(importError.message || 'Unable to import files.');
    }
  }

  async function handleDeleteAttachment(attachmentId) {
    if (!selectedNode) {
      return;
    }

    if (!confirmAction('Remove Media: Remove this saved media from the note? This cannot be undone.')) {
      return;
    }

    setError('');

    try {
      await client.deleteAttachment(attachmentId);
      await loadAttachments(selectedNode.id);
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to remove media.');
    }
  }

  async function handleOpenAttachment(localPath) {
    setError('');

    try {
      const message = await client.openPath(localPath);
      if (message) {
        setError(message);
      }
    } catch (openError) {
      setError(openError.message || 'Unable to open saved file.');
    }
  }

  async function handleStartRecording() {
    setError('');
    setCaptureError('');

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      setCaptureError(captureFailureCopy);
      return;
    }

    try {
      const noteContext = await ensureCaptureNode(captureMode);
      await ensureCapturePermissions(captureMode);

      const stream = await navigator.mediaDevices.getUserMedia(resolveCaptureConstraints(captureMode));
      const mimeType = resolveSupportedMimeType(captureMode);
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      captureChunksRef.current = [];

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) {
          captureChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('stop', async () => {
        const blob = new Blob(captureChunksRef.current, {
          type: recorder.mimeType || mimeType || (captureMode === 'audio' ? 'audio/webm' : 'video/webm'),
        });
        const previewUrl =
          typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL(blob)
            : '';

        stopMediaStream();
        reviewUrlRef.current = previewUrl;

        setReviewRecording({
          captureMode,
          file: await buildRecordingFile(blob, captureMode),
          nodeId: noteContext.node.id,
          placeholderNoteId: noteContext.placeholderNoteId,
          placeholderTitle: noteContext.placeholderTitle,
          previewUrl,
        });
        setCaptureState('review');
      });

      recorder.start();
      setCaptureState('recording');
    } catch (_captureError) {
      stopMediaStream();
      mediaRecorderRef.current = null;
      setCaptureState('idle');
      setCaptureError(captureFailureCopy);
    }
  }

  function handleStopRecording() {
    if (!mediaRecorderRef.current) {
      return;
    }

    setCaptureState('stopping');
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
  }

  async function handleSaveRecording() {
    if (!reviewRecording) {
      return;
    }

    setError('');
    setCaptureError('');
    setIsSavingRecording(true);

    try {
      const result = await client.saveRecording(
        {
          nodeId: reviewRecording.nodeId,
          title: reviewRecording.placeholderTitle,
          captureMode: reviewRecording.captureMode,
          mimeType: reviewRecording.file.mimeType,
          fileName: reviewRecording.file.fileName,
        },
        reviewRecording.file
      );

      clearReviewRecording();
      await loadNodes();
      setSelectedNodeId(result.node.id);
      await loadAttachments(result.node.id);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save recording.');
    } finally {
      setIsSavingRecording(false);
    }
  }

  async function handleDiscardRecording() {
    if (
      !reviewRecording ||
      !confirmAction('Discard Recording: Discard this unsaved recording? This cannot be undone.')
    ) {
      return;
    }

    const placeholderNoteId = reviewRecording.placeholderNoteId;
    const placeholderTitle = reviewRecording.placeholderTitle;

    clearReviewRecording();
    setCaptureError('');

    const placeholderNode = nodes.find((node) => node.id === placeholderNoteId);
    if (!placeholderNode || placeholderNode.title !== placeholderTitle || attachments.length > 0) {
      return;
    }

    try {
      await client.deleteNode(placeholderNoteId);
      await loadNodes();
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to remove placeholder note.');
    }
  }

  useEffect(() => {
    loadNodes();
    loadSettings();
    loadProviderConnections();
  }, []);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    if (!selectedNode) {
      setEditTitle('');
      setEditDescription('');
      setEditTags('');
      setAttachments([]);
      setTranscript(null);
      setTranscriptError('');
      return;
    }

    setEditTitle(selectedNode.title || '');
    setEditDescription(selectedNode.description || '');
    setEditTags(selectedNode.tags || '');
    loadAttachments(selectedNode.id);
    loadTranscript(selectedNode.id);
  }, [selectedNode]);

  useEffect(() => {
    return () => {
      stopMediaStream();
      Object.keys(providerPollingRef.current).forEach((provider) => {
        stopProviderPolling(provider);
      });
      if (reviewUrlRef.current && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(reviewUrlRef.current);
      }
    };
  }, []);

  const renderCapturePanel = () => {
    const isReview = captureState === 'review' && reviewRecording;
    const isRecording = captureState === 'recording';
    const isStopping = captureState === 'stopping';

    return (
      <div className="grid gap-4 rounded-[28px] bg-secondary/70 p-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-[1.2]">
            {selectedNode ? 'Capture and review' : 'Capture Your First Note'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Start a recording or import files to create a note and keep the media stored locally.
          </p>
        </div>

        <div className="inline-flex flex-wrap gap-2 rounded-2xl bg-background p-2">
          {captureModes.map((mode) => {
            const isActive = captureMode === mode.value;

            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setCaptureMode(mode.value)}
                aria-pressed={isActive}
                data-state={isActive ? 'active' : 'inactive'}
                disabled={isRecording || isStopping || isSavingRecording}
                className={cn(
                  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-[0_18px_42px_-22px_rgba(15,23,42,0.95)] ring-2 ring-primary/20 -translate-y-px'
                    : 'border-transparent bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                {renderToggleIndicator(isActive)}
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {captureError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {captureError}
          </div>
        ) : null}

        {isReview ? (
          <div className="grid gap-4 rounded-[24px] border bg-background p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Recording Review
                </p>
                <h4 className="text-xl font-semibold leading-[1.2]">
                  {reviewRecording.captureMode === 'audio' ? 'Audio preview' : 'Video preview'}
                </h4>
              </div>
            </div>

            {reviewRecording.captureMode === 'audio' ? (
              <audio controls preload="metadata" src={reviewRecording.previewUrl} />
            ) : (
              <video
                controls
                preload="metadata"
                src={reviewRecording.previewUrl}
                className="max-h-[320px] rounded-2xl bg-secondary"
              />
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveRecording}
                disabled={isSavingRecording}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Save Recording
              </button>
              <button
                type="button"
                onClick={handleDiscardRecording}
                disabled={isSavingRecording}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-destructive/30 px-4 text-sm font-semibold text-destructive"
              >
                Discard Recording
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 rounded-[24px] border bg-background p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Recorder
              </p>
              <h4 className="text-xl font-semibold leading-[1.2]">
                {isRecording ? 'Recording in progress' : 'Ready to capture'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {isRecording || isStopping
                  ? 'Stop the recording to review it before saving.'
                  : 'Choose a mode, start the recorder, then review before saving.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {isRecording || isStopping ? (
                <button
                  type="button"
                  onClick={handleStopRecording}
                  disabled={isStopping}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/30 px-4 text-sm font-semibold text-primary"
                >
                  Stop Recording
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  >
                    Start Recording
                  </button>
                  <button
                    type="button"
                    onClick={handleImportFiles}
                    className="inline-flex h-11 items-center justify-center rounded-xl border bg-background px-4 text-sm font-semibold"
                  >
                    Import Files
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  async function handleRetryTranscript() {
    if (!selectedNode) {
      return;
    }

    setTranscriptError('');

    try {
      const nextTranscript = await client.retryNoteTranscript(selectedNode.id);
      setTranscript(nextTranscript);
    } catch (retryError) {
      setTranscriptError(retryError.message || 'Unable to retry transcript.');
    }
  }

  async function handleRetryAttachmentSync(attachmentId) {
    if (!selectedNode) {
      return;
    }

    setError('');

    try {
      await client.retryAttachmentSync(attachmentId);
      await loadAttachments(selectedNode.id);
    } catch (retryError) {
      setError(retryError.message || 'Unable to retry sync.');
    }
  }

  const workspaceView = (
    <section className="grid gap-8 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
      <aside className="rounded-[28px] border bg-secondary/70 p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold leading-[1.2]">Notes</h2>
            <p className="text-sm leading-5 text-muted-foreground">
              {nodes.length} note{nodes.length === 1 ? '' : 's'} available
            </p>
          </div>
        </div>

        <form className="mb-6 grid gap-3" onSubmit={handleCreateNode}>
          <input
            className="h-11 rounded-xl border bg-background px-3 text-sm"
            placeholder="New note title"
            required
            value={newNodeTitle}
            onChange={(event) => setNewNodeTitle(event.target.value)}
          />
          <textarea
            className="min-h-[88px] rounded-xl border bg-background px-3 py-3 text-sm"
            placeholder="Description"
            rows={3}
            value={newNodeDescription}
            onChange={(event) => setNewNodeDescription(event.target.value)}
          />
          <input
            className="h-11 rounded-xl border bg-background px-3 text-sm"
            placeholder="Tags"
            value={newNodeTags}
            onChange={(event) => setNewNodeTags(event.target.value)}
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Create Note
          </button>
        </form>

        {loading ? (
          <div className="rounded-2xl border border-dashed bg-background px-4 py-10 text-center text-sm text-muted-foreground">
            Loading notes...
          </div>
        ) : nodes.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-background px-4 py-10 text-center">
            <h3 className="text-xl font-semibold">Capture Your First Note</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Start a recording or import files to create a note and keep the media stored locally.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {nodes.map((node) => {
              const isSelected = node.id === selectedNodeId;

              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    className={cn(
                      'flex w-full flex-col gap-2 rounded-2xl border bg-background px-4 py-4 text-left transition',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-transparent hover:border-border hover:bg-card'
                    )}
                  >
                    <span className="text-base font-semibold">{node.title}</span>
                    <span
                      className={cn(
                        'text-sm leading-5',
                        isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      )}
                    >
                      Updated {formatDate(node.updated_at)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="rounded-[32px] border bg-background p-6 shadow-sm">
        {selectedNode ? (
          <div className="grid gap-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Active Note
                </p>
                <h2 className="text-xl font-semibold leading-[1.2]">{selectedNode.title}</h2>
                <p className="text-sm text-muted-foreground">
                  Last updated {formatDate(selectedNode.updated_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteNode(selectedNode.id)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-destructive/30 px-4 text-sm font-semibold text-destructive"
              >
                Delete Note
              </button>
            </div>

            <form className="grid gap-4" onSubmit={handleSaveNode}>
              <div className="grid gap-2">
                <label className="text-sm font-semibold">Title</label>
                <input
                  className="h-11 rounded-xl border bg-background px-3 text-sm"
                  required
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold">Description</label>
                <textarea
                  className="min-h-[180px] rounded-xl border bg-background px-3 py-3 text-sm"
                  rows={8}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold">Tags</label>
                <input
                  className="h-11 rounded-xl border bg-background px-3 text-sm"
                  value={editTags}
                  onChange={(event) => setEditTags(event.target.value)}
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Save Changes
              </button>
            </form>

            {renderCapturePanel()}

            <TranscriptSection
              noteId={selectedNode.id}
              transcript={transcript}
              error={transcriptError}
              isLoading={isTranscriptLoading}
              onRefresh={loadTranscript}
              onRetry={handleRetryTranscript}
            />

            <div className="grid gap-4 rounded-[28px] bg-secondary/70 p-6">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold leading-[1.2]">Saved Media</h3>
                <p className="text-sm text-muted-foreground">
                  Recorded and imported media stay attached to the active note and remain stored locally first.
                </p>
              </div>

              {attachments.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-background px-4 py-8 text-center">
                  <h4 className="text-xl font-semibold leading-[1.2]">Saved media appears here</h4>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Start a recording or import files to keep audio, video, and files connected to this note.
                  </p>
                </div>
              ) : (
                <ul className="grid gap-4">
                  {attachments.map((attachment) => (
                    <MediaCard
                      key={attachment.id}
                      attachment={attachment}
                      formatDate={formatDate}
                      getAttachmentContentUrl={client.getAttachmentContentUrl}
                      onOpenFile={handleOpenAttachment}
                      onRemove={() => handleDeleteAttachment(attachment.id)}
                      onRetrySync={() => handleRetryAttachmentSync(attachment.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="grid min-h-[520px] content-center gap-6">{renderCapturePanel()}</div>
        )}
      </section>
    </section>
  );

  return (
    <main className="theme min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Privanote
              </p>
              <h1 className="text-[28px] font-semibold leading-[1.1]">Local notes workspace</h1>
              <p className="max-w-2xl text-base leading-6 text-muted-foreground">
                Capture note details locally first while the new desktop and backend architecture settles
                into place.
              </p>
            </div>

            <div className="inline-flex rounded-2xl bg-secondary p-2">
              {['Workspace', 'Settings'].map((label) => {
                const value = label.toLowerCase();
                const isActive = activeView === value;

                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setActiveView(value)}
                    aria-pressed={isActive}
                    aria-current={isActive ? 'page' : undefined}
                    data-state={isActive ? 'active' : 'inactive'}
                    className={cn(
                      'inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all duration-200',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground shadow-[0_18px_42px_-22px_rgba(15,23,42,0.95)] ring-2 ring-primary/20 -translate-y-px'
                        : 'border-transparent text-muted-foreground hover:bg-background hover:text-foreground'
                    )}
                  >
                    {renderToggleIndicator(isActive)}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {activeView === 'workspace' ? (
          workspaceView
        ) : (
          <SettingsView
            settings={settingsDraft}
            providerConnections={providerConnections}
            error={settingsError}
            errorDetail={settingsErrorDetail}
            isLoading={isSettingsLoading}
            isSaving={isSavingSettings}
            onChange={updateSettingsDraft}
            onChooseDirectory={handleChooseDirectory}
            onClearCredential={handleClearCredential}
            onSave={handleSaveSettings}
            onBeginProviderConnection={handleBeginProviderConnection}
            onDisconnectProvider={handleDisconnectProvider}
          />
        )}
      </div>
    </main>
  );
}
