import React, { useEffect, useMemo, useState } from 'react';
import { cn } from './lib/utils.js';

const attachmentKinds = [
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'file', label: 'File' },
];

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
    listAttachments: async () => [],
    addAttachment: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    deleteAttachment: async () => {
      throw new Error('Desktop API is unavailable.');
    },
    pickFile: async () => null,
  };
}

function confirmAction(message) {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true;
  }

  return window.confirm(message);
}

export default function App({ api }) {
  const client = api || globalThis.window?.api || createUnavailableApi();
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeDescription, setNewNodeDescription] = useState('');
  const [newNodeTags, setNewNodeTags] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');
  const [attachmentKind, setAttachmentKind] = useState('audio');
  const [attachmentPath, setAttachmentPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

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

  useEffect(() => {
    loadNodes();
  }, []);

  useEffect(() => {
    if (!selectedNode) {
      setEditTitle('');
      setEditDescription('');
      setEditTags('');
      setAttachments([]);
      return;
    }

    setEditTitle(selectedNode.title || '');
    setEditDescription(selectedNode.description || '');
    setEditTags(selectedNode.tags || '');
    loadAttachments(selectedNode.id);
  }, [selectedNode]);

  async function handleCreateNode(event) {
    event.preventDefault();
    setError('');

    try {
      await client.createNode({
        title: newNodeTitle,
        description: newNodeDescription,
        tags: newNodeTags,
      });

      setNewNodeTitle('');
      setNewNodeDescription('');
      setNewNodeTags('');
      await loadNodes();
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
      await client.updateNode({
        id: selectedNode.id,
        title: editTitle,
        description: editDescription,
        tags: editTags,
      });

      await loadNodes();
    } catch (updateError) {
      setError(updateError.message || 'Unable to update note.');
    }
  }

  async function handleDeleteNode(nodeId) {
    if (
      !confirmAction('Delete this note and all linked attachments? This cannot be undone.')
    ) {
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
      const pickedPath = await client.pickFile();
      if (pickedPath) {
        setAttachmentPath(pickedPath);
      }
    } catch (pickError) {
      setError(pickError.message || 'Unable to open file picker.');
    }
  }

  async function handleAddAttachment(event) {
    event.preventDefault();

    if (!selectedNode) {
      setError('Select a note before adding attachments.');
      return;
    }

    setError('');

    try {
      await client.addAttachment({
        nodeId: selectedNode.id,
        kind: attachmentKind,
        localPath: attachmentPath,
      });
      setAttachmentPath('');
      await loadAttachments(selectedNode.id);
    } catch (addError) {
      setError(addError.message || 'Unable to add attachment.');
    }
  }

  async function handleDeleteAttachment(attachmentId) {
    if (!selectedNode) {
      return;
    }

    if (!confirmAction('Remove this attachment from the note? This cannot be undone.')) {
      return;
    }

    setError('');

    try {
      await client.deleteAttachment(attachmentId);
      await loadAttachments(selectedNode.id);
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to remove attachment.');
    }
  }

  return (
    <main className="theme min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Privanote
          </p>
          <h1 className="text-[28px] font-semibold leading-[1.1]">Local notes workspace</h1>
          <p className="max-w-2xl text-base leading-6 text-muted-foreground">
            Capture note details locally first while the new desktop and backend architecture settles
            into place.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

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
                <h3 className="text-xl font-semibold">Start Your First Note</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Create a note to confirm the new desktop and backend foundation is working end to end.
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

                <div className="grid gap-4 rounded-[28px] bg-secondary/70 p-6">
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold leading-[1.2]">Attachments</h3>
                    <p className="text-sm text-muted-foreground">
                      Keep media and file links connected to the current note.
                    </p>
                  </div>

                  <form className="grid gap-3 lg:grid-cols-[140px_minmax(0,1fr)_auto_auto]" onSubmit={handleAddAttachment}>
                    <select
                      className="h-11 rounded-xl border bg-background px-3 text-sm"
                      value={attachmentKind}
                      onChange={(event) => setAttachmentKind(event.target.value)}
                    >
                      {attachmentKinds.map((kind) => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </select>

                    <input
                      className="h-11 rounded-xl border bg-background px-3 text-sm"
                      placeholder="Local path"
                      required
                      value={attachmentPath}
                      onChange={(event) => setAttachmentPath(event.target.value)}
                    />

                    <button
                      type="button"
                      onClick={handlePickFile}
                      className="inline-flex h-11 items-center justify-center rounded-xl border bg-background px-4 text-sm font-semibold"
                    >
                      Pick File
                    </button>

                    <button
                      type="submit"
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    >
                      Add Attachment
                    </button>
                  </form>

                  {attachments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                      No attachments yet.
                    </div>
                  ) : (
                    <ul className="grid gap-3">
                      {attachments.map((attachment) => (
                        <li
                          key={attachment.id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-background px-4 py-4"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              {attachment.kind}
                            </p>
                            <p className="text-sm leading-6">{attachment.local_path}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(attachment.id)}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-destructive/30 px-4 text-sm font-semibold text-destructive"
                          >
                            Remove Attachment
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center rounded-[28px] bg-secondary/70 px-6 text-center">
                <h2 className="text-xl font-semibold">Start Your First Note</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  Create a note to confirm the new desktop and backend foundation is working end to end.
                </p>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
