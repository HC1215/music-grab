import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Download, Play, Music, Library, X, Save, Pause, Trash2, Folder as FolderIcon, FolderPlus, ArrowLeft, Mic2, Check, Square, RefreshCw, Upload, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveTrack, getFolders, getTracksByFolder, deleteFolder, createFolder, deleteTrack, type SavedTrack, type Folder } from './db';

interface Video {
  id: string;
  url: string;
  title: string;
  timestamp: string;
  seconds: number;
  thumbnail: string;
  author: string;
}

// Simple VTT Parser
interface LyricLine {
  startTime: number;
  endTime: number;
  text: string;
}

const parseVTT = (vtt: string): LyricLine[] => {
  const lines = vtt.split('\n');
  const result: LyricLine[] = [];
  let currentStart = 0;
  let currentEnd = 0;

  // Regex for 00:00:00.000 or 00:00.000
  const timeRegex = /(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const times = line.split('-->');
      if (times.length === 2) {
        // Parse start
        const startParts = times[0].trim().match(timeRegex);
        const endParts = times[1].trim().match(timeRegex);

        if (startParts) {
          const h = startParts[1] ? parseInt(startParts[1].replace(':', '')) : 0;
          const m = parseInt(startParts[2]);
          const s = parseInt(startParts[3]);
          const ms = parseInt(startParts[4]);
          currentStart = h * 3600 + m * 60 + s + ms / 1000;
        }

        if (endParts) {
          const h = endParts[1] ? parseInt(endParts[1].replace(':', '')) : 0;
          const m = parseInt(endParts[2]);
          const s = parseInt(endParts[3]);
          const ms = parseInt(endParts[4]);
          currentEnd = h * 3600 + m * 60 + s + ms / 1000;
        }
      }
    } else if (line && !line.startsWith('WEBVTT') && !line.match(/^\d+$/)) {
      // Aggressively strip time tags and timestamps
      // Remove <00:00:00.000>
      // Remove [00:00.000]
      // Remove (00:00.000)
      // Remove isolated 00:00 or 00:00:00 patterns
      let cleanText = line
        .replace(/<[^>]+>/g, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\([^)]+\)/g, '')
        .replace(/\b\d{1,2}:\d{2}(:\d{2})?(\.\d{1,3})?\b/g, '')
        .replace(/-->/g, '') // Cleanup stray arrows
        .trim();

      if (cleanText) {
        if (result.length > 0 && result[result.length - 1].startTime === currentStart) {
          result[result.length - 1].text += ' ' + cleanText;
        } else {
          if (result.length === 0 || result[result.length - 1].text !== cleanText) {
            result.push({
              startTime: currentStart,
              endTime: currentEnd,
              text: cleanText
            });
          }
        }
      }
    }
  }
  return result;
};

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Toast Component
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl z-50 backdrop-blur-md border ${type === 'success'
        ? 'bg-green-500/10 border-green-500/20 text-green-200'
        : 'bg-red-500/10 border-red-500/20 text-red-200'
        }`}
    >
      {type === 'success' ? <div className="p-1 bg-green-500 rounded-full"><Check size={12} className="text-black" /></div> : <X size={18} />}
      <span className="font-medium">{message}</span>
    </motion.div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'library'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [apiBase, setApiBase] = useState(localStorage.getItem('music-grab-api-base') || '');
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  const API_BASE = apiBase;

  // Persist API Base and Check Status
  useEffect(() => {
    localStorage.setItem('music-grab-api-base', apiBase);
    checkBackend();
  }, [apiBase]);

  const checkBackend = async () => {
    setBackendStatus('checking');
    try {
      // If apiBase is empty, we check the relative /health (Cloud Backend)
      const testUrl = apiBase ? `${apiBase}/health` : '/health';
      await axios.get(testUrl, { timeout: 3000 });
      setBackendStatus('online');
    } catch (e) {
      setBackendStatus('offline');
    }
  };


  // Player Progress State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Download Status Tracking: 'loading' | 'success' | 'error' | number (progress 0-100)
  const [downloadStatus, setDownloadStatus] = useState<Record<string, 'loading' | 'success' | 'error' | number>>({});

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Local Player State
  const [libraryTracks, setLibraryTracks] = useState<SavedTrack[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [currentTrack, setCurrentTrack] = useState<SavedTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [parsedLyrics, setParsedLyrics] = useState<LyricLine[]>([]);

  // Preview State (YouTube)
  const [previewTrack, setPreviewTrack] = useState<Video | null>(null);

  // Rename/Save Dialog State
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [targetFolderId, setTargetFolderId] = useState<string>(''); // '' = Root

  // Create Folder Dialog
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  useEffect(() => {
    // Try to persist storage
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(granted => {
        if (granted) {
          console.log("Storage will not be cleared except by explicit user action");
        } else {
          console.log("Storage may be cleared by the UA under storage pressure.");
        }
      });
    }
    loadLibrary();
  }, [currentFolderId]);

  useEffect(() => {
    if (currentTrack) {
      setParsedLyrics(currentTrack.lyrics ? parseVTT(currentTrack.lyrics) : []);
      setCurrentLyricIndex(-1);
      setShowLyrics(false);

      if (audioRef.current) {
        const url = URL.createObjectURL(currentTrack.blob);
        audioRef.current.src = url;
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(e => console.error("Playback failed", e));
        return () => { URL.revokeObjectURL(url); };
      }
    }
  }, [currentTrack]);

  // Sync Lyrics
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioRef.current && isPlaying && parsedLyrics.length > 0) {
        const t = audioRef.current.currentTime;
        const idx = parsedLyrics.findIndex(l => t >= l.startTime && t <= l.endTime);
        if (idx !== -1 && idx !== currentLyricIndex) {
          setCurrentLyricIndex(idx);
        }
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying, parsedLyrics, currentLyricIndex]);


  const loadLibrary = async () => {
    const [loadedFolders, loadedTracks] = await Promise.all([
      getFolders(),
      getTracksByFolder(currentFolderId)
    ]);
    setFolders(loadedFolders);
    setLibraryTracks(loadedTracks.reverse());
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);

      // If Firebase Hosting returns index.html for a 404
      if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
        setResults([]);
        showToast('Backend connection needed. Visit Settings.', 'error');
        setBackendStatus('offline');
        return;
      }

      if (Array.isArray(response.data)) {
        setResults(response.data);
        setBackendStatus('online');
      } else {
        console.error('Invalid search response:', response.data);
        setResults([]);
        showToast('Search failed: Unexpected response', 'error');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'ERR_NETWORK') {
        showToast('Cannot reach backend. Check your local IP in Settings.', 'error');
      } else {
        showToast('Connection error. Is the backend running?', 'error');
      }
      setBackendStatus('offline');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const openRenameModal = (video: Video) => {
    setSelectedVideo(video);
    setRenameValue(video.title);
    setTargetFolderId(''); // Default to root
    setRenameModalOpen(true);
  };

  const handleDownload = async () => {
    if (!selectedVideo || !renameValue.trim()) return;

    const video = selectedVideo;
    const finalTitle = renameValue.trim();
    const folderToSave = targetFolderId || undefined;

    setRenameModalOpen(false);
    setDownloadStatus(prev => ({ ...prev, [video.id]: 0 })); // Start at 0%
    showToast(`Starting download: ${finalTitle}`, 'success');

    try {
      // 1. Start Job
      const startRes = await axios.post('/api/download/start', {
        videoId: video.id,
        title: finalTitle
      });
      const { jobId } = startRes.data;

      // 2. Poll for Status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`/api/download/status/${jobId}`);
          const { status, progress, error } = statusRes.data;

          if (status === 'error') {
            clearInterval(pollInterval);
            throw new Error(error || 'Download failed');
          }

          if (status === 'downloading' || status === 'processing') {
            setDownloadStatus(prev => ({ ...prev, [video.id]: progress }));
          }

          if (status === 'completed') {
            clearInterval(pollInterval);

            // 3. Fetch Result
            const resultRes = await axios.get(`/api/download/result/${jobId}`);
            const { audioBase64, lyrics, metadata } = resultRes.data;

            const byteCharacters = atob(audioBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'audio/mpeg' });

            await saveTrack({
              id: video.id,
              title: finalTitle,
              author: video.author,
              timestamp: video.timestamp,
              blob: blob,
              addedAt: metadata.downloadDate || Date.now(),
              folderId: folderToSave,
              lyrics: lyrics,
              size: metadata.size
            });

            await loadLibrary();
            setDownloadStatus(prev => ({ ...prev, [video.id]: 'success' }));

            // AUTOMATIC DOWNLOAD TO DEVICE
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${finalTitle.replace(/[<>:"/\\|?*]+/g, '_')}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast(`${finalTitle} saved to library & device!`, 'success');

            // Clear success status after 3s
            setTimeout(() => {
              setDownloadStatus(prev => {
                const newState = { ...prev };
                delete newState[video.id];
                return newState;
              });
            }, 3000);
          }
        } catch (err: any) {
          clearInterval(pollInterval);
          console.error('Polling error', err);
          setDownloadStatus(prev => ({ ...prev, [video.id]: 'error' }));
          showToast('Download interrupted', 'error');
          setTimeout(() => {
            setDownloadStatus(prev => { delete prev[video.id]; return prev });
          }, 3000);
        }
      }, 1000);

    } catch (err: any) {
      console.error('Download init failed', err);
      setDownloadStatus(prev => ({ ...prev, [video.id]: 'error' }));
      showToast('Could not start download', 'error');
      setTimeout(() => {
        setDownloadStatus(prev => { delete prev[video.id]; return prev });
      }, 3000);
    } finally {
      setSelectedVideo(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim());
    setNewFolderName('');
    setCreateFolderModalOpen(false);
    loadLibrary();
    showToast('Folder created!', 'success');
  };

  // Helper to toggle track from list
  const toggleTrack = (track: SavedTrack) => {
    if (currentTrack?.id === track.id) {
      // Toggle play/pause for current
      togglePlayPause();
    } else {
      // New track
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const handleDeleteTrack = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this track?')) {
      await deleteTrack(id);
      if (currentTrack?.id === id) {
        setCurrentTrack(null);
        setIsPlaying(false);
      }
      loadLibrary();
      showToast('Track deleted', 'success');
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this folder and move all tracks to root?')) {
      await deleteFolder(id);
      loadLibrary();
      showToast('Folder deleted', 'success');
    }
  }

  const handleSyncFiles = async () => {
    try {
      showToast('Scanning downloads folder...', 'success');
      setLoading(true);

      const res = await axios.get('/api/downloads');
      const files: { filename: string, size: number, mtime: number, lyricFile: string | null }[] = res.data;

      let added = 0;

      const currentTracks = await getTracksByFolder(undefined);

      for (const file of files) {
        // Clean title: "Song [ID].mp3" -> "Song"
        // Also handles old "Song.mp3" -> "Song"
        let title = file.filename.replace(/\.(mp3|m4a|wav)$/i, '');

        // Remove [ID] suffix if present
        title = title.replace(/\s*\[.*?\]$/, '').trim();
        title = title.replace(/_/g, ' ');

        // Check if we already have a track with this exact title
        // Note: If user has duplicates with same name but different ID, this skips.
        // Ideally we check ID but we don't have it for old files easily without parsing.
        const exists = libraryTracks.some(t => t.title === title) || currentTracks.some(t => t.title === title);

        if (!exists) {
          try {
            const blobRes = await axios.get(`/downloads/${encodeURIComponent(file.filename)}`, { responseType: 'blob' });

            let lyrics = '';
            if (file.lyricFile) {
              try {
                const lyricRes = await axios.get(`/downloads/${encodeURIComponent(file.lyricFile)}`, { responseType: 'text' });
                lyrics = lyricRes.data;
              } catch (e) {
                console.warn('Failed to fetch lyrics for', file.filename);
              }
            }

            await saveTrack({
              id: 'local-' + Date.now() + Math.random(),
              title: title,
              author: 'Imported',
              timestamp: formatTime(0),
              blob: blobRes.data,
              addedAt: file.mtime || Date.now(),
              folderId: undefined,
              lyrics: lyrics,
              size: file.size
            });
            added++;
          } catch (e) {
            console.error("Failed to import", file.filename);
          }
        }
      }
      if (added > 0) {
        showToast(`Imported ${added} missing tracks!`, 'success');
        loadLibrary();
      } else {
        showToast('Library is up to date', 'success');
      }
    } catch (e) {
      console.error(e);
      showToast('Sync failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadToDevice = (track: SavedTrack) => {
    const url = URL.createObjectURL(track.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${track.title.replace(/[<>:"/\\|?*]+/g, '_')}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Saving to device...', 'success');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    let added = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const title = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');

        await saveTrack({
          id: 'local-upload-' + Date.now() + Math.random(),
          title: title,
          author: 'Uploaded',
          timestamp: formatTime(0),
          blob: file,
          addedAt: Date.now(),
          size: file.size,
          lyrics: ''
        });
        added++;
      }
      showToast(`Uploaded ${added} tracks`, 'success');
      loadLibrary();
    } catch (err) {
      console.error(err);
      showToast('Upload failed', 'error');
    } finally {
      setLoading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-screen pb-32">
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="bg-blur-circle top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-600/20" />
        <div className="bg-blur-circle top-[30%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20" />
        <div className="bg-blur-circle bottom-[-10%] left-[20%] w-[30%] h-[35%] bg-blue-600/10" />
      </div>

      {/* Header */}
      <header className="glass-panel sticky top-4 z-[70] mx-4 px-6 py-4 flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 relative">
            <Music className="text-white" size={24} />
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#1a1a23] ${backendStatus === 'online' ? 'bg-green-500' :
              backendStatus === 'checking' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
              }`} title={`Backend: ${backendStatus}`} />
          </div>
          <h1 className="text-xl font-bold premium-gradient-text">
            MusicGrab
          </h1>
        </div>

        <nav className="flex gap-2 bg-white/5 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'search' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
          >
            <Search size={16} /> <span className="hidden sm:inline">Search</span>
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'library' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
          >
            <Library size={16} /> <span className="hidden sm:inline">Library</span>
          </button>
        </nav>

        <button
          onClick={() => setShowSettings(true)}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* Rename Modal */}
      <AnimatePresence>
        {renameModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-md p-6 bg-[#1a1a23] border border-white/10"
            >
              <h3 className="text-xl font-bold mb-4 text-white">Save Audio As...</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Filename</label>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-purple-500 outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Save to Folder</label>
                  <select
                    value={targetFolderId}
                    onChange={(e) => setTargetFolderId(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-purple-500 outline-none appearance-none"
                  >
                    <option value="">My Library (Root)</option>
                    {Array.isArray(folders) && folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                  <button
                    onClick={() => setRenameModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDownload}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Save size={18} /> Save & Download
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Folder Modal */}
      <AnimatePresence>
        {createFolderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-sm p-6 bg-[#1a1a23]"
            >
              <h3 className="text-lg font-bold mb-4 text-white">New Folder</h3>
              <input
                type="text"
                placeholder="Folder Name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-purple-500 outline-none mb-6"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => setCreateFolderModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                <button onClick={handleCreateFolder} className="btn-primary">Create</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-sm p-6 bg-[#1a1a23]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Settings</h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm text-gray-400">Backend API URL</label>
                    <div className={`text-[10px] px-2 py-0.5 rounded-full border ${backendStatus === 'online' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}>
                      {backendStatus === 'online' ? 'Connected' : 'Disconnected'}
                    </div>
                  </div>
                  <input
                    type="url"
                    placeholder="http://192.168.1.10:3001"
                    value={apiBase}
                    onChange={(e) => setApiBase(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 outline-none mb-2"
                  />
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    To search/download on mobile, enter your computer's <b>Local IP address</b> (e.g. http://192.168.x.x:3001).
                    Run the backend on your PC first!
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <button
                    onClick={() => {
                      if (confirm("Reset everything? This will clear all downloaded songs.")) {
                        indexedDB.deleteDatabase('music-grab-db-clean-v4');
                        window.location.reload();
                      }
                    }}
                    className="w-full py-2 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all"
                  >
                    Clear All Cache & Library
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Content Area */}
      <div className="max-w-3xl mx-auto px-4">
        {activeTab === 'search' ? (
          <>
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500">
                Find your rhythm
              </h2>
            </div>

            <form onSubmit={handleSearch} className="relative group mb-8">
              <input
                type="text"
                placeholder="Search for songs..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-12 pr-24 py-4 bg-white/5 border border-white/10 rounded-2xl focus:border-purple-500/50 focus:bg-white/10 transition-all text-lg placeholder:text-gray-500"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-2 px-6 rounded-xl text-sm"
                disabled={loading}
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Search'}
              </button>
            </form>

            <div className="space-y-3">
              {Array.isArray(results) && results.map((video, idx) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="glass-panel p-2 flex items-center gap-3 hover:bg-white/5 transition-all group"
                >
                  <div
                    className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer shadow-md"
                    onClick={() => setPreviewTrack(video)}
                  >
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play size={16} className="text-white fill-current" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-white truncate">{video.title}</h3>
                    {typeof downloadStatus[video.id] === 'number' ? (
                      <div className="w-full max-w-[200px] mt-2">
                        <div className="flex justify-between text-[10px] text-purple-300 mb-1 font-medium">
                          <span>Downloading...</span>
                          <span>{Math.round(downloadStatus[video.id] as number)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300 ease-out"
                            style={{ width: `${downloadStatus[video.id]}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 truncate">{video.author} • {video.timestamp}</p>
                    )}
                  </div>

                  <button
                    onClick={() => openRenameModal(video)}
                    disabled={typeof downloadStatus[video.id] === 'number' || downloadStatus[video.id] === 'loading' || downloadStatus[video.id] === 'success'}
                    className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${downloadStatus[video.id] === 'success'
                      ? 'bg-green-500/20 text-green-500'
                      : downloadStatus[video.id] === 'error'
                        ? 'bg-red-500/20 text-red-500'
                        : 'hover:bg-white/10 text-gray-400 hover:text-white'
                      }`}
                  >
                    {typeof downloadStatus[video.id] === 'number' ? (
                      <div className="relative w-8 h-8 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-gray-700"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="text-purple-500 transition-all duration-300 ease-out"
                            strokeDasharray={`${downloadStatus[video.id] as number}, 100`}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                        </svg>
                        <span className="absolute text-[8px] font-bold text-white">{Math.round(downloadStatus[video.id] as number)}</span>
                      </div>
                    ) : downloadStatus[video.id] === 'loading' ? (
                      <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    ) : downloadStatus[video.id] === 'success' ? (
                      <Check size={18} />
                    ) : downloadStatus[video.id] === 'error' ? (
                      <X size={18} />
                    ) : (
                      <Download size={18} />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Preview Player Overlay */}
            <AnimatePresence>
              {previewTrack && (
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  className="fixed bottom-0 left-0 right-0 glass-panel border-t border-white/10 p-3 z-50 rounded-t-2xl shadow-2xl bg-[#0f0f17]"
                >
                  <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <img src={previewTrack.thumbnail} className="w-10 h-10 rounded object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">Preview: {previewTrack.title}</p>
                    </div>

                    <div className="flex-shrink-0 w-[120px] h-[30px] opacity-80 relative overflow-hidden rounded">
                      <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${previewTrack.id}?autoplay=1&controls=0&modestbranding=1&playsinline=1`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope;"
                        className="pointer-events-none"
                      ></iframe>
                    </div>

                    <button
                      onClick={() => setPreviewTrack(null)}
                      className="p-2 rounded-full hover:bg-white/10"
                    >
                      <X size={18} className="text-gray-400" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {currentFolderId ? (
                  <button onClick={() => setCurrentFolderId(undefined)} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
                    <ArrowLeft size={20} className="text-white" />
                  </button>
                ) : null}
                <h2 className="text-2xl font-bold text-white">
                  {currentFolderId ? folders.find(f => f.id === currentFolderId)?.name || 'Folder' : 'Your Library'}
                </h2>
              </div>

              {!currentFolderId && (
                <div className="flex bg-white/5 rounded-lg p-1">
                  <button
                    onClick={() => setCreateFolderModalOpen(true)}
                    className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 font-medium px-3 py-2 hover:bg-purple-500/10 rounded-lg transition-all"
                  >
                    <FolderPlus size={18} /> New Folder
                  </button>
                  <button
                    onClick={handleSyncFiles}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white font-medium px-3 py-2 hover:bg-white/10 rounded-lg transition-all"
                    title="Sync files from Downloads folder"
                  >
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                  </button>
                  <label className="flex items-center gap-2 text-sm text-gray-400 hover:text-white font-medium px-3 py-2 hover:bg-white/10 rounded-lg transition-all cursor-pointer" title="Upload local files">
                    <Upload size={18} />
                    <input type="file" multiple accept="audio/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              )}
            </div>

            {/* Breadcrumbs / Status */}
            {!currentFolderId && (
              <p className="text-sm text-gray-400 mb-4">{libraryTracks.length} tracks • {folders.length} folders</p>
            )}

            {/* Folders Grid (Only show in Root) */}
            {!currentFolderId && folders.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {Array.isArray(folders) && folders.map(folder => (
                  <div
                    key={folder.id}
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="glass-panel p-4 flex flex-col items-center justify-center gap-2 hover:bg-white/10 cursor-pointer transition-all hover:scale-[1.02] group relative"
                  >
                    <FolderIcon size={32} className="text-purple-500 group-hover:text-purple-400" />
                    <span className="text-sm font-medium text-gray-200 truncate w-full text-center">{folder.name}</span>

                    <button
                      onClick={(e) => handleDeleteFolder(folder.id, e)}
                      className="absolute top-2 right-2 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tracks List */}
            {libraryTracks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Music size={48} className="mx-auto mb-4 opacity-20" />
                <p>No tracks here.</p>
              </div>
            ) : (
              <div className="space-y-4 mb-32">
                {Array.isArray(libraryTracks) && libraryTracks.map((track) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isThisPlaying = isCurrent && isPlaying;

                  return (
                    <div
                      key={track.id}
                      className={`glass-panel p-3 transition-all ${isCurrent ? 'bg-purple-900/20 border-purple-500/50' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Play/Pause Button */}
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center flex-shrink-0 text-gray-400">
                          <Music size={20} />
                        </div>

                        <div className="flex-1 min-w-0" onClick={() => toggleTrack(track)}>
                          <h3 className={`font-medium text-sm truncate cursor-pointer hover:underline flex items-center gap-2 ${isCurrent ? 'text-purple-300' : 'text-white'}`}>
                            <Music size={14} className="flex-shrink-0 opacity-50" />
                            {track.title}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="truncate max-w-[150px]">{track.author}</span>
                            <span>•</span>
                            <span>{new Date(track.addedAt).toLocaleDateString()}</span>
                            {track.size && (
                              <>
                                <span>•</span>
                                <span>{formatBytes(track.size)}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Play/Pause Button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleTrack(track); }}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isThisPlaying ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/40' : 'bg-white/10 text-white hover:bg-white/20'}`}
                          >
                            {isThisPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-1" />}
                          </button>

                          {/* Lyrics Button */}
                          {isCurrent && track.lyrics && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowLyrics(true); }}
                              className="p-2 text-purple-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                              title="Show Lyrics"
                            >
                              <Mic2 size={18} />
                            </button>
                          )}

                          {/* Stop Button */}
                          {isCurrent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (audioRef.current) {
                                  audioRef.current.pause();
                                  audioRef.current.currentTime = 0;
                                  setIsPlaying(false);
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full"
                              title="Stop"
                            >
                              <Square size={16} fill="currentColor" />
                            </button>
                          )}

                          <button
                            onClick={(e) => handleDeleteTrack(track.id, e)}
                            className="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-full hover:bg-white/5"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownloadToDevice(track); }}
                            className="p-2 text-indigo-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
                            title="Save to Device"
                          >
                            <Download size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Inline Progress Bar (Active Track Only) */}
                      {isCurrent && (
                        <div className="mt-3 pl-[52px] pr-2 flex items-center gap-3 animate-fade-in">
                          <span className="text-[10px] text-gray-400 font-mono w-8 text-right">{formatTime(currentTime)}</span>
                          <div className="flex-1 relative h-1 bg-white/10 rounded-full overflow-hidden group">
                            <div
                              className="absolute top-0 left-0 h-full bg-purple-500 rounded-full"
                              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                            />
                            <input
                              type="range"
                              min="0"
                              max={duration || 1}
                              value={currentTime}
                              onChange={(e) => {
                                const t = parseFloat(e.target.value);
                                setCurrentTime(t);
                                if (audioRef.current) audioRef.current.currentTime = t;
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono w-8">{formatTime(duration)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
            }
          </div>
        )}
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setIsPlaying(false)}
        onError={() => console.error("Audio error")}
      />

      {/* Full Screen Lyrics Overlay (Only UI popping up) */}
      {/* Note: Logic for lyrics overlay remains the same but ensure it is not nested inside any removed player div */}
      <AnimatePresence>
        {activeTab === 'library' && showLyrics && currentTrack && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center p-8 text-center"
            onClick={() => setShowLyrics(false)}
          >
            {/* ... (Kept existing karaoke logic as is, just wrapped cleanly) ... */}
            <div className="absolute top-8 right-8 text-white/30 text-sm animate-pulse">
              Tap anywhere to close
            </div>

            {parsedLyrics.length > 0 ? (
              <div
                className="max-w-2xl w-full max-h-[70vh] overflow-y-auto custom-scrollbar text-left space-y-4 px-4"
                onClick={(e) => e.stopPropagation()}
              >
                {Array.isArray(parsedLyrics) && parsedLyrics.map((line, idx) => {
                  // Basic approximate progress for styling if current line
                  const isCurrent = currentLyricIndex === idx;

                  return (
                    <p
                      key={idx}
                      className={`text-lg transition-all duration-300 ${isCurrent
                        ? 'font-bold scale-105 origin-left'
                        : 'text-gray-500 hover:text-gray-300'
                        }`}
                      style={isCurrent ? {
                        background: 'linear-gradient(to right, #22d3ee, #a855f7)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        color: 'transparent'
                      } : {}}
                    >
                      {line.text}
                    </p>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                  <Music size={40} className="text-purple-500/50" />
                </div>
                <p className="text-gray-500 font-medium tracking-widest uppercase text-sm">Instrumental / No Lyrics</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
}

export default App;
