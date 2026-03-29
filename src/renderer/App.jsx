import React, { useEffect, useMemo, useState } from 'react';

const attachmentKinds = [
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'file', label: 'File' },
];

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

export default function App() {
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
      const rows = await window.api.listNodes();
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
      setError(loadError.message || 'Unable to load nodes.');
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
      const rows = await window.api.listAttachments(nodeId);
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
      await window.api.createNode({
        title: newNodeTitle,
        description: newNodeDescription,
        tags: newNodeTags,
      });

      setNewNodeTitle('');
      setNewNodeDescription('');
      setNewNodeTags('');
      await loadNodes();
    } catch (submitError) {
      setError(submitError.message || 'Unable to create node.');
    }
  }

  async function handleSaveNode(event) {
    event.preventDefault();
    if (!selectedNode) return;

    setError('');

    try {
      await window.api.updateNode({
        id: selectedNode.id,
        title: editTitle,
        description: editDescription,
        tags: editTags,
      });

      await loadNodes();
    } catch (updateError) {
      setError(updateError.message || 'Unable to update node.');
    }
  }

  async function handleDeleteNode(nodeId) {
    setError('');

    try {
      await window.api.deleteNode(nodeId);
      await loadNodes();
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete node.');
    }
  }

  async function handlePickFile() {
    setError('');

    try {
      const pickedPath = await window.api.pickFile();
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
      setError('Select a node before adding attachments.');
      return;
    }

    setError('');

    try {
      await window.api.addAttachment({
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
    if (!selectedNode) return;

    setError('');

    try {
      await window.api.deleteAttachment(attachmentId);
      await loadAttachments(selectedNode.id);
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete attachment.');
    }
  }

  return (
    <main style={{ fontFamily: 'sans-serif', margin: '1.5rem auto', maxWidth: 1200 }}>
      <h1>Privanote</h1>
      <p>Manage local-first content nodes and attach local audio/video/files.</p>

      {error && <p style={{ color: '#b00020' }}>{error}</p>}

      {loading ? (
        <p>Loading nodes…</p>
      ) : (
        <section style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 2fr' }}>
          <aside style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
            <h2 style={{ marginTop: 0 }}>Nodes</h2>
            <form onSubmit={handleCreateNode} style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                placeholder="Title"
                value={newNodeTitle}
                onChange={(event) => setNewNodeTitle(event.target.value)}
                required
              />
              <textarea
                placeholder="Description"
                value={newNodeDescription}
                onChange={(event) => setNewNodeDescription(event.target.value)}
                rows={2}
              />
              <input
                placeholder="Tags (comma separated)"
                value={newNodeTags}
                onChange={(event) => setNewNodeTags(event.target.value)}
              />
              <button type="submit">Create Node</button>
            </form>

            {nodes.length === 0 ? (
              <p>No nodes yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
                {nodes.map((node) => {
                  const isSelected = node.id === selectedNodeId;
                  return (
                    <li key={node.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedNodeId(node.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: isSelected ? '#e8f0ff' : 'white',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                      >
                        <strong>{node.title}</strong>
                        <br />
                        <small>Updated {formatDate(node.updated_at)}</small>
                      </button>
                      <button type="button" onClick={() => handleDeleteNode(node.id)} style={{ marginTop: '0.4rem' }}>
                        Delete
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
            {!selectedNode ? (
              <p>Select a node to edit details and attachments.</p>
            ) : (
              <>
                <h2 style={{ marginTop: 0 }}>Node Details</h2>
                <form onSubmit={handleSaveNode} style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required />
                  <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={4} />
                  <input value={editTags} onChange={(event) => setEditTags(event.target.value)} />
                  <button type="submit">Save Changes</button>
                </form>

                <h3>Attachments</h3>
                <form onSubmit={handleAddAttachment} style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <label>
                    Type
                    <select value={attachmentKind} onChange={(event) => setAttachmentKind(event.target.value)}>
                      {attachmentKinds.map((kind) => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <input
                    placeholder="Local path"
                    value={attachmentPath}
                    onChange={(event) => setAttachmentPath(event.target.value)}
                    required
                  />

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" onClick={handlePickFile}>
                      Pick File
                    </button>
                    <button type="submit">Add Attachment</button>
                  </div>
                </form>

                {attachments.length === 0 ? (
                  <p>No attachments yet.</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
                    {attachments.map((attachment) => (
                      <li key={attachment.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.6rem' }}>
                        <strong>{attachment.kind.toUpperCase()}</strong>
                        <p style={{ margin: '0.3rem 0' }}>{attachment.local_path}</p>
                        <button type="button" onClick={() => handleDeleteAttachment(attachment.id)}>
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </section>
      )}
    </main>
  );
}
