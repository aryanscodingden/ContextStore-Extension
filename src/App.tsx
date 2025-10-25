import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import './App.css';

// Add this declaration to let TypeScript know about window.chrome
declare global {
  interface Window {
    chrome?: any;
  }
}

interface Folder {
  id: number;
  name: string;
  user_id: string;
}

interface Note {
  id: number;
  folder_id: number;
  text: string;
  timestamp: string;
  user_id: string;
}

interface DeleteItem {
  type: 'folder' | 'note';
  id: number;
  name?: string;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [noteText, setNoteText] = useState('');
  
  
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DeleteItem | null>(null);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const timeout = setTimeout(() => {
          if (mounted && loading) setLoading(false);
        }, 3000);

        if (window.chrome?.storage) {
          window.chrome.storage.local.get(
            ['supabase_access_token', 'supabase_refresh_token'],
            async (result: any) => {
              clearTimeout(timeout);
              if (!mounted) return;

              if (result.supabase_access_token && result.supabase_refresh_token) {
                try {
                  const { data, error } = await supabase.auth.setSession({
                    access_token: result.supabase_access_token,
                    refresh_token: result.supabase_refresh_token
                  });

                  if (!error && data.session) {
                    setSession(data.session);
                  } else {
                    window.chrome.storage.local.clear();
                  }
                } catch (err) {
                  window.chrome.storage.local.clear();
                }
              }
              setLoading(false);
      }
      );
        } else {
          clearTimeout(timeout);
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (mounted) {
            setSession(currentSession);
            setLoading(false);
              }
        }
      } catch (err) {
        if (mounted) {
          setLoading(false);
          setError('Failed to initialize');
        }
      }
  };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mounted) setSession(newSession);
      }
  );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    }; },
    []
    );

  useEffect(() => {
    if (session?.user?.id) {
      fetchFolders();
    }
  }, [session]);

  useEffect(() => {
    if (selectedFolder) {
      fetchNotes();
    }
  }, [selectedFolder]);

  const fetchFolders = async () => {
    if (!session?.user?.id) return;

    try {
      setError(null);
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', session.user.id)
        .order('id', { ascending: false });

      if (error) throw error;
      setFolders(data || []);
    } catch (err: any) {
      setError('Failed to load folders: ' + err.message);
    }
  };

  const fetchNotes = async () => {
    if (!selectedFolder || !session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('folder_id', selectedFolder.id)
        .eq('user_id', session.user.id)
        .order('id', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (err: any) {
      setError('Failed to load notes: ' + err.message);
    }
  };

  const handleCreateFolder = async () => {
    if (!session?.user?.id || !folderName.trim()) return;

    try {
      setError(null);
      const { data, error } = await supabase
        .from('folders')
        .insert([{ name: folderName.trim(), user_id: session.user.id }])
        .select()
        .single();

      if (error) throw error;

      setFolders([data, ...folders]);
      setFolderName('');
      setShowFolderInput(false);
      setSelectedFolder(data);
    } catch (err: any) {
      setError('Failed to create folder: ' + err.message);
    }
  };

  const handleCreateNote = async () => {
    if (!selectedFolder || !session?.user?.id || !noteText.trim()) return;

    try {
      setError(null);
      const { data, error } = await supabase
        .from('notes')
        .insert([{
          folder_id: selectedFolder.id,
          text: noteText.trim(),
          user_id: session.user.id,
          timestamp: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      setNotes([data, ...notes]);
      setNoteText('');
      setShowNoteInput(false);
    } catch (err: any) {
      setError('Failed to create note: ' + err.message);
    }
  };

  const showDeleteConfirmation = (item: DeleteItem) => {
    setItemToDelete(item);
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'folder') {
        const { error } = await supabase.from('folders').delete().eq('id', itemToDelete.id);
        if (error) throw error;

        await supabase.from('notes').delete().eq('folder_id', itemToDelete.id);
        setFolders(folders.filter(f => f.id !== itemToDelete.id));
        if (selectedFolder?.id === itemToDelete.id) {
          setSelectedFolder(null);
          setNotes([]);
        }
      } else if (itemToDelete.type === 'note') {
        const { error } = await supabase.from('notes').delete().eq('id', itemToDelete.id);
        if (error) throw error;
        setNotes(notes.filter(n => n.id !== itemToDelete.id));
      }
    } catch (err: any) {
      setError(`Failed to delete: ${err.message}`);
    }

    setShowConfirmDelete(false);
    setItemToDelete(null);
  };

  const cancelDelete = () => {
    setShowConfirmDelete(false);
    setItemToDelete(null);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    if (window.chrome?.storage) {
      window.chrome.storage.local.clear();
    }
    setSession(null);
    setFolders([]);
    setNotes([]);
    setSelectedFolder(null);
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', width: 300 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <p style={{ margin: 0, color: '#666' }}>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div style={{ padding: 16, width: 320, maxHeight: 550, overflowY: 'auto', fontFamily: 'system-ui' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '2px solid #e5e7eb'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#1f2937' }}>ContextStore</h2>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>
            {session.user.email}
          </p>
        </div>
        <button
          onClick={logout}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          Logout
        </button>
      </div>

      {error && (
        <div style={{
          padding: 10,
          marginBottom: 12,
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: 6,
          color: '#dc2626',
          fontSize: 12
        }}>
          {error}
        </div>
      )}

      {/* Folders Section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#374151' }}>
            📁 Folders ({folders.length})
          </h3>
          <button
            onClick={() => setShowFolderInput(!showFolderInput)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            + New Folder
          </button>
        </div>

        {/* New Folder Input */}
        {showFolderInput && (
          <div style={{
            padding: 12,
            marginBottom: 8,
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 6
          }}>
            <input
              type="text"
              placeholder="Enter folder name..."
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
              style={{
                width: '100%',
                padding: 8,
                marginBottom: 8,
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleCreateFolder}
                disabled={!folderName.trim()}
                style={{
                  flex: 1,
                  padding: 8,
                  background: folderName.trim() ? '#10b981' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 13,
                  cursor: folderName.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 500
                }}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowFolderInput(false);
                  setFolderName('');
                }}
                style={{
                  flex: 1,
                  padding: 8,
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Folders List */}
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          maxHeight: 180,
          overflowY: 'auto'
        }}>
          {folders.length === 0 ? (
            <p style={{
              padding: 16,
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: 13,
              margin: 0
            }}>
              No folders yet. Click "New Folder" to create one!
            </p>
          ) : (
            folders.map(folder => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolder(folder)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderBottom: '1px solid #f3f4f6',
                  background: selectedFolder?.id === folder.id ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => {
                  if (selectedFolder?.id !== folder.id) {
                    e.currentTarget.style.background = '#f9fafb';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedFolder?.id !== folder.id) {
                    e.currentTarget.style.background = 'white';
                  }
                }}
              >
                <span style={{
                  flex: 1,
                  fontSize: 14,
                  color: selectedFolder?.id === folder.id ? '#2563eb' : '#374151',
                  fontWeight: selectedFolder?.id === folder.id ? 500 : 400
                }}>
                  {folder.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    showDeleteConfirmation({ type: 'folder', id: folder.id, name: folder.name });
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      
      {selectedFolder && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#374151' }}>
              📝 Notes in "{selectedFolder.name}" ({notes.length})
            </h3>
            <button
              onClick={() => setShowNoteInput(!showNoteInput)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              + Add Note
            </button>
          </div>

          {/* New Note Input */}
          {showNoteInput && (
            <div style={{
              padding: 12,
              marginBottom: 8,
              background: '#f0fdf4',
              border: '1px solid #d1fae5',
              borderRadius: 6
            }}>
              <textarea
                placeholder="Enter your note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: 8,
                  marginBottom: 8,
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  fontSize: 13,
                  resize: 'vertical',
                  minHeight: 60,
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleCreateNote}
                  disabled={!noteText.trim()}
                  style={{
                    flex: 1,
                    padding: 8,
                    background: noteText.trim() ? '#10b981' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 13,
                    cursor: noteText.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 500
                  }}
                >
                  Save Note
                </button>
                <button
                  onClick={() => {
                    setShowNoteInput(false);
                    setNoteText('');
                  }}
                  style={{
                    flex: 1,
                    padding: 8,
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            maxHeight: 200,
            overflowY: 'auto'
          }}>
            {notes.length === 0 ? (
              <p style={{
                padding: 16,
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: 13,
                margin: 0
              }}>
                No notes yet. Click "Add Note" to create one!
              </p>
            ) : (
              notes.map(note => (
                <div
                  key={note.id}
                  style={{
                    padding: 12,
                    borderBottom: '1px solid #f3f4f6',
                    background: 'white'
                  }}
                >
                  <p style={{
                    margin: '0 0 8px 0',
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: '#374151',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {note.text}
                  </p>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <small style={{ color: '#9ca3af', fontSize: 11 }}>
                      {new Date(note.timestamp).toLocaleString()}
                    </small>
                    <button
                      onClick={() => showDeleteConfirmation({ type: 'note', id: note.id })}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: 3,
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {!selectedFolder && folders.length > 0 && (
        <div style={{
          padding: 20,
          textAlign: 'center',
          background: '#f9fafb',
          borderRadius: 6,
          border: '1px dashed #d1d5db'
        }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
            👆 Select a folder above to view and add notes
          </p>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDelete && itemToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: 24,
            borderRadius: 8,
            width: 300,
            maxWidth: '90vw',
            maxHeight: '80vh',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#dc2626', fontSize: 16 }}>
              Confirm Delete
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 14, color: '#374151' }}>
              Are you sure you want to delete this{' '}
              {itemToDelete.type === 'folder' ? 'folder' : 'note'}
              {itemToDelete.type === 'folder' && itemToDelete.name && ` "${itemToDelete.name}"`}
              {itemToDelete.type === 'folder' && (
                <br />
              )}{' '}
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={cancelDelete}
                style={{
                  padding: '8px 16px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


