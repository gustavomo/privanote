import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from './lib/utils.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Circle, Square, Upload, Save, X, Trash2, AlertCircle } from 'lucide-react';
import ThemeToggle from './components/theme-toggle.jsx';
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

const screenPermissionNotDetermined =
  'Screen recording permission is required to capture system audio. Click Record to allow access.';

const screenPermissionDenied =
  'Screen recording was not granted. Click Record to try again, or enable it in System Settings > Privacy & Security > Screen Recording.';

const screenPermissionBlocked =
  'Screen recording permission is required. Open System Settings > Privacy & Security > Screen Recording and enable access for Privanote, then try again.';

const captureFailureCopy =
  'Camera or microphone access is unavailable. Check device permissions, then retry or switch to import.';


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
    getScreenPermissionStatus: async () => ({ status: 'unknown', denialCount: 0 }),
    recordScreenDenial: async () => ({ denialCount: 0 }),
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

function resolveRequiredPermissions(captureMode) {
  if (captureMode === 'audio') {
    return ['microphone', 'screen'];
  }

  if (captureMode === 'video') {
    return ['camera'];
  }

  return ['camera', 'microphone', 'screen'];
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
  const [captureAppPresets, setCaptureAppPresets] = useState([]);
  const [captureApps, setCaptureApps] = useState({});
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const captureChunksRef = useRef([]);
  const reviewUrlRef = useRef('');
  const displayStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const providerPollingRef = useRef({});
  const selectedNodeIdRef = useRef(null);
  const [isCallRecording, setIsCallRecording] = useState(false);
  const callRecordingStreamRef = useRef(null);
  const callRecordingRecorderRef = useRef(null);
  const callRecordingChunksRef = useRef([]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  function stopMediaStream() {
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((track) => track.stop());
      displayStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

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

  function cleanupCallRecording() {
    const streams = callRecordingStreamRef.current;
    if (streams) {
      if (streams.displayStream) streams.displayStream.getTracks().forEach(t => t.stop());
      if (streams.micStream) streams.micStream.getTracks().forEach(t => t.stop());
      if (streams.audioCtx) streams.audioCtx.close().catch(() => {});
    }
    callRecordingStreamRef.current = null;
    callRecordingRecorderRef.current = null;
    callRecordingChunksRef.current = [];
    setIsCallRecording(false);
  }

  // Call recording trigger handlers from main process
  useEffect(() => {
    if (!client.onCallRecordingStart || !client.onCallRecordingStop) return;

    const removeStartListener = client.onCallRecordingStart(async (data) => {
      if (captureState === 'recording' || isCallRecording) return; // Already recording

      const recordingMode = data.mode || 'audio';
      const includeVideo = recordingMode === 'video';

      setIsCallRecording(true);
      try {
        let displayStream;
        try {
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: includeVideo ? true : { width: 1, height: 1 },
          });
        } catch (displayError) {
          client.sendCallRecordingCompleted({
            success: false,
            error: 'Screen permission denied',
          });
          setIsCallRecording(false);
          return;
        }

        // Audio-only mode: discard video track
        if (!includeVideo) {
          displayStream.getVideoTracks().forEach((track) => track.stop());
        }

        // Get microphone
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        // Mix system audio + microphone via Web Audio API
        const audioCtx = new AudioContext();
        const systemSource = audioCtx.createMediaStreamSource(
          new MediaStream(displayStream.getAudioTracks())
        );
        const micSource = audioCtx.createMediaStreamSource(
          new MediaStream(micStream.getAudioTracks())
        );
        const dest = audioCtx.createMediaStreamDestination();
        systemSource.connect(dest);
        micSource.connect(dest);

        // Build the final stream: mixed audio, optionally with video
        let finalStream;
        if (includeVideo) {
          finalStream = new MediaStream([
            ...dest.stream.getAudioTracks(),
            ...displayStream.getVideoTracks(),
          ]);
        } else {
          finalStream = dest.stream;
        }
        callRecordingStreamRef.current = { displayStream, micStream, audioCtx, finalStream };

        // Resolve MIME type
        let mimeType;
        if (includeVideo) {
          mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : MediaRecorder.isTypeSupported('video/webm')
              ? 'video/webm'
              : undefined;
        } else {
          mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
              ? 'audio/webm'
              : undefined;
        }

        const recorder = mimeType
          ? new MediaRecorder(finalStream, { mimeType })
          : new MediaRecorder(finalStream);

        callRecordingRecorderRef.current = recorder;
        callRecordingChunksRef.current = [];

        recorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) {
            callRecordingChunksRef.current.push(event.data);
          }
        });

        recorder.addEventListener('stop', async () => {
          // Assemble blob and save to temp file
          const ext = (recorder.mimeType || '').includes('webm') ? 'webm' : 'ogg';
          const blob = new Blob(callRecordingChunksRef.current, { type: recorder.mimeType });
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          const kind = includeVideo ? 'video' : 'audio';
          // Save to temp file via IPC
          const tempPath = await client.saveTempBlob(uint8Array, `call-recording.${ext}`);

          client.sendCallRecordingCompleted({
            success: true,
            blob: {
              path: tempPath,
              mimeType: recorder.mimeType || (includeVideo ? 'video/webm' : 'audio/webm'),
              size: blob.size,
              kind,
            },
          });

          // Cleanup
          cleanupCallRecording();
        });

        recorder.start(1000); // Collect data every 1 second
      } catch (err) {
        client.sendCallRecordingCompleted({
          success: false,
          error: err.message || 'Recording failed',
        });
        setIsCallRecording(false);
        cleanupCallRecording();
      }
    });

    const removeStopListener = client.onCallRecordingStop(() => {
      if (callRecordingRecorderRef.current && callRecordingRecorderRef.current.state === 'recording') {
        callRecordingRecorderRef.current.stop();
      }
    });

    return () => {
      removeStartListener();
      removeStopListener();
    };
  }, [captureState, isCallRecording]);

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
      if (permission === 'screen') {
        const { status, denialCount } = await client.getScreenPermissionStatus();

        if (denialCount >= 2) {
          throw new Error(screenPermissionBlocked);
        }

        if (status === 'denied' || status === 'restricted') {
          await client.recordScreenDenial();
          throw new Error(screenPermissionDenied);
        }

        // If 'not-determined', getDisplayMedia will trigger the macOS prompt
        // in handleStartRecording. We only gate on known denials here.
        continue;
      }

      const mediaStatus = await client.getMediaAccessStatus(permission);

      if (mediaStatus === 'denied' || mediaStatus === 'restricted') {
        throw new Error(captureFailureCopy);
      }

      if (mediaStatus === 'not-determined') {
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
      toast.success('Settings saved');
    } catch (saveError) {
      setSettingsError("We couldn't save these settings. Fix the highlighted fields and try again.");
      setSettingsErrorDetail(saveError.message || '');
      toast.error('Could not save settings. Try again.');
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
    toast.info('Credential cleared');
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
      toast.success('Connected to ' + (providerLabels[provider] || provider));
    } catch (connectError) {
      setSettingsError(connectError.message || `Unable to connect ${providerLabels[provider]}.`);
      toast.error('Could not connect provider. Try again.');
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
      toast.info('Disconnected from ' + (providerLabels[provider] || provider));
    } catch (disconnectError) {
      setSettingsError(disconnectError.message || `Unable to disconnect ${providerLabels[provider]}.`);
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
      toast.success('Note saved');
    } catch (updateError) {
      setError(updateError.message || 'Unable to update note.');
      toast.error('Could not save changes. Try again.');
    }
  }

  async function handleDeleteNode(nodeId) {
    setError('');

    try {
      await client.deleteNode(nodeId);
      await loadNodes();
      toast.success('Note deleted');
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete note.');
      toast.error('Could not delete note. Try again.');
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
      toast.error('Import failed. Check the file and try again.');
    }
  }

  async function handleDeleteAttachment(attachmentId) {
    if (!selectedNode) {
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
    if (isCallRecording) {
      setCaptureError('Cannot start recording while a call recording is active.');
      return;
    }

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

      const mimeType = resolveSupportedMimeType(captureMode);
      const needsAudio = captureMode === 'audio' || captureMode === 'video-with-audio';
      const needsVideo = captureMode === 'video' || captureMode === 'video-with-audio';
      let finalStream;

      if (needsAudio) {
        // 1. Get system audio via getDisplayMedia (triggers setDisplayMediaRequestHandler in main)
        let displayStream;
        try {
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: { width: 1, height: 1 },
          });
        } catch (displayError) {
          // Permission denied by user at the macOS prompt
          await client.recordScreenDenial().catch(() => {});
          const { denialCount } = await client.getScreenPermissionStatus().catch(() => ({ denialCount: 0 }));
          if (denialCount >= 2) {
            throw new Error(screenPermissionBlocked);
          }
          throw new Error(screenPermissionDenied);
        }

        displayStreamRef.current = displayStream;

        // Discard the minimal video track from getDisplayMedia -- we only want its audio
        displayStream.getVideoTracks().forEach((track) => track.stop());

        // 2. Get microphone (and camera if video mode)
        const micConstraints = needsVideo ? { audio: true, video: true } : { audio: true, video: false };
        const micStream = await navigator.mediaDevices.getUserMedia(micConstraints);
        mediaStreamRef.current = micStream;

        // 3. Mix system audio + microphone via Web Audio API
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;

        const systemSource = audioCtx.createMediaStreamSource(
          new MediaStream(displayStream.getAudioTracks())
        );
        const micSource = audioCtx.createMediaStreamSource(
          new MediaStream(micStream.getAudioTracks())
        );
        const dest = audioCtx.createMediaStreamDestination();
        systemSource.connect(dest);
        micSource.connect(dest);

        // 4. Build final stream
        if (needsVideo) {
          // Video + mixed audio
          finalStream = new MediaStream([
            ...micStream.getVideoTracks(),
            ...dest.stream.getAudioTracks(),
          ]);
        } else {
          // Audio-only: just the mixed audio
          finalStream = dest.stream;
        }
      } else {
        // Video-only mode (no audio, no system audio needed)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        mediaStreamRef.current = stream;
        finalStream = stream;
      }

      const recorder = mimeType
        ? new MediaRecorder(finalStream, { mimeType })
        : new MediaRecorder(finalStream);

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
    } catch (recordingError) {
      stopMediaStream();
      mediaRecorderRef.current = null;
      setCaptureState('idle');

      // Use the specific error message if it's one of our permission messages
      const message = recordingError?.message || '';
      if (
        message === screenPermissionBlocked ||
        message === screenPermissionDenied ||
        message === screenPermissionNotDetermined
      ) {
        setCaptureError(message);
      } else {
        setCaptureError(captureFailureCopy);
      }
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
      toast.success('Recording saved');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save recording.');
      toast.error('Could not save recording. Try again.');
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

  function handleToggleCaptureApp(appId) {
    const updated = { ...captureApps, [appId]: !captureApps[appId] };
    setCaptureApps(updated);
    // Save immediately via IPC -- no need to wait for "Save Settings" button
    // because the main process needs to know right away for polling decisions
    if (client.updateCaptureApps) {
      client.updateCaptureApps(updated).catch(() => {});
    }
  }

  useEffect(() => {
    loadNodes();
    loadSettings();
    loadProviderConnections();

    // Load capture app presets and whitelist
    if (client.getCaptureAppPresets) {
      client.getCaptureAppPresets().then(setCaptureAppPresets).catch(() => {});
    }
    if (client.getCaptureApps) {
      client.getCaptureApps().then(setCaptureApps).catch(() => {});
    }

    // Refresh notes list when a capture session creates a new note
    if (window.api?.onCaptureNoteCreated) {
      return window.api.onCaptureNoteCreated(({ nodeId }) => {
        loadNodes().then(() => {
          if (nodeId) setSelectedNodeId(nodeId);
        });
      });
    }
  }, []);

  // PR analysis completion toast and auto-select (per D-21, UI-SPEC)
  useEffect(() => {
    if (!window.api?.onPrAnalysisComplete) return;
    const cleanup = window.api.onPrAnalysisComplete((data) => {
      const description = data.title
        ? (data.title.length > 60 ? data.title.slice(0, 57) + '...' : data.title)
        : 'Analysis complete';
      toast.success('PR analysis complete', { description, duration: 5000 });

      if (data.nodeId) {
        loadNodes().then(() => {
          setSelectedNodeId(data.nodeId);
        });
      } else {
        loadNodes();
      }
    });
    return cleanup;
  }, []);

  // PR analysis error toast (per UI-SPEC)
  useEffect(() => {
    if (!window.api?.onPrAnalysisError) return;
    const cleanup = window.api.onPrAnalysisError((data) => {
      toast.error('PR analysis failed', {
        description: data.error || 'Analysis failed. Retry from the overlay button.',
        duration: 8000,
      });
    });
    return cleanup;
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
      <Card className="rounded-[28px] bg-secondary/70 border-0 ring-0 shadow-none">
        <CardHeader className="px-6 pt-6 pb-0">
          <CardTitle className="text-xl font-semibold leading-[1.2]">Capture</CardTitle>
          <CardDescription className="text-sm leading-6">
            Start a recording or import a file — a note is created automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-4">

        <div className="inline-flex flex-wrap gap-2 rounded-2xl bg-background p-2">
          {captureModes.map((mode) => {
            const isActive = captureMode === mode.value;

            return (
              <button
                key={mode.value}
                type="button"
                aria-pressed={isActive}
                disabled={isRecording || isStopping || isSavingRecording}
                onClick={() => setCaptureMode(mode.value)}
                className={cn(
                  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-[0_18px_42px_-22px_rgba(15,23,42,0.95)] ring-2 ring-primary/20 -translate-y-px'
                    : 'border-transparent bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {captureError ? (
          <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
            <AlertCircle className="size-4" />
            <AlertDescription>{captureError}</AlertDescription>
          </Alert>
        ) : null}

        {isReview ? (
          <Card className="rounded-[24px]">
          <CardContent className="p-5 grid gap-4">
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
              <Button size="lg" onClick={handleSaveRecording} disabled={isSavingRecording}>
                <Save className="size-4" />
                Save Recording
              </Button>
              <Button variant="destructive-outline" size="lg" onClick={handleDiscardRecording} disabled={isSavingRecording}>
                <X className="size-4" />
                Discard Recording
              </Button>
            </div>
          </CardContent>
          </Card>
        ) : (
          <Card className="rounded-[24px]">
          <CardContent className="p-5 grid gap-4">
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

            {isRecording && <Progress className="progress-indeterminate h-1" />}

            <div className="flex flex-wrap gap-3">
              {isRecording || isStopping ? (
                <Button variant="outline" size="lg" onClick={handleStopRecording} disabled={isStopping}>
                  <Square className="size-4" />
                  Stop Recording
                </Button>
              ) : (
                <>
                  <Button size="lg" onClick={handleStartRecording}>
                    <Circle className="size-4 fill-current" />
                    Start Recording
                  </Button>
                  <Button variant="outline" size="lg" onClick={handleImportFiles}>
                    <Upload className="size-4" />
                    Import Files
                  </Button>
                </>
              )}
            </div>
          </CardContent>
          </Card>
        )}
      </CardContent>
      </Card>
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
      <aside className="flex flex-col rounded-[28px] border bg-secondary/70 p-6 shadow-sm">
        {renderCapturePanel()}

        <div className="mb-4 mt-6">
          <h2 className="text-xl font-semibold leading-[1.2]">Notes</h2>
          <p className="text-sm leading-5 text-muted-foreground">
            {nodes.length} note{nodes.length === 1 ? '' : 's'} available
          </p>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border bg-background p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : nodes.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-background px-4 py-10 text-center">
              <h3 className="text-xl font-semibold">No notes yet</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Capture a recording or import a file to create your first note.
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
        </ScrollArea>
      </aside>

      <section className="flex flex-col rounded-[32px] border bg-background shadow-sm overflow-hidden">
        {selectedNode ? (
          <ScrollArea className="flex-1 p-6">
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive-outline" size="lg">
                    <Trash2 className="size-4" />
                    Delete Note
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete note?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this note and all its attachments. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => handleDeleteNode(selectedNode.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <form className="grid gap-4" onSubmit={handleSaveNode}>
              <div className="grid gap-2">
                <Label>Title</Label>
                <Input required value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea className="min-h-[180px]" rows={8} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Tags</Label>
                <Input value={editTags} onChange={(event) => setEditTags(event.target.value)} />
              </div>
              <Button type="submit" size="lg">
                <Save className="size-4" />
                Save Changes
              </Button>
            </form>

            <TranscriptSection
              noteId={selectedNode.id}
              transcript={transcript}
              error={transcriptError}
              isLoading={isTranscriptLoading}
              onRefresh={loadTranscript}
              onRetry={handleRetryTranscript}
            />

            <Card className="rounded-[28px] bg-secondary/70 border-0 ring-0 shadow-none">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-xl font-semibold leading-[1.2]">Saved Media</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Recorded and imported media stay attached to the active note and remain stored locally first.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-4">
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
              </CardContent>
            </Card>
          </div>
          </ScrollArea>
        ) : (
          <div className="grid min-h-[520px] content-center gap-3 text-center p-6">
            <h2 className="text-xl font-semibold leading-[1.2]">Select a note to view it</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Capture a recording or import a file from the sidebar to create your first note.
            </p>
          </div>
        )}
      </section>
    </section>
  );

  return (
    <>
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

            <Tabs value={activeView} onValueChange={setActiveView}>
              <TabsList className="rounded-2xl bg-secondary p-2 h-auto">
                <TabsTrigger
                  value="workspace"
                  className="h-11 rounded-xl px-4 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_18px_42px_-22px_rgba(15,23,42,0.95)] data-[state=active]:ring-2 data-[state=active]:ring-primary/20 data-[state=active]:-translate-y-px"
                >
                  Workspace
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="h-11 rounded-xl px-4 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_18px_42px_-22px_rgba(15,23,42,0.95)] data-[state=active]:ring-2 data-[state=active]:ring-primary/20 data-[state=active]:-translate-y-px"
                >
                  Settings
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </header>

        {error ? (
          <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {activeView === 'workspace' ? (
          workspaceView
        ) : (
          <div className="grid gap-8">
            <Card className="rounded-[32px] shadow-sm">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-xl font-semibold leading-[1.2]">Appearance</CardTitle>
                <CardDescription>Choose how Privanote looks on your device.</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-4">
                <ThemeToggle />
              </CardContent>
            </Card>
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
              captureAppPresets={captureAppPresets}
              captureApps={captureApps}
              onToggleCaptureApp={handleToggleCaptureApp}
            />
          </div>
        )}
      </div>
    </main>
    <Toaster />
    </>
  );
}
