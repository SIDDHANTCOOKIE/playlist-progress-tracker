import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ExternalLink, 
  CheckCircle2, 
  Circle, 
  MoreVertical, 
  ListVideo,
  Trophy,
  Menu,
  X,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Edit3,
  Download,
  Loader2,
  BookOpen,
  Palette,
  Github,
  Coffee,
  Flame,
  ArrowLeft,
  Layers
} from 'lucide-react';

// --- Environment Variable for API Key ---
// Removed import.meta check to prevent build warnings in ES2015 targets.
// Users can enter their API key directly in the UI settings.
const ENV_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY || '';
const GITHUB_REPO_URL = 'https://github.com/siddhantcookie';

// --- Helper: Duration Parsing ---
const parseDurationToSeconds = (durationStr) => {
  if (!durationStr) return 0;

  // Handle ISO 8601 (API format: PT1H2M10S)
  if (durationStr.startsWith('PT')) {
    const match = durationStr.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Handle Colon format (MM:SS or HH:MM:SS)
  if (durationStr.includes(':')) {
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  
  return 0;
};

const formatSecondsToTime = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const computeStats = (videos = [], checkedIds = []) => {
  let totalSec = 0;
  let completedSec = 0;

  videos.forEach(v => {
    const sec = parseDurationToSeconds(v.duration);
    totalSec += sec;
    if (checkedIds.includes(v.id)) {
      completedSec += sec;
    }
  });

  return {
    total: formatSecondsToTime(totalSec),
    completed: formatSecondsToTime(completedSec),
    percentage: totalSec > 0 ? Math.round((completedSec / totalSec) * 100) : 0,
    totalSeconds: totalSec,
    completedSeconds: completedSec
  };
};

const downloadNotesAsText = (notes, videos, currentVideo) => {
  const currentNote = notes[currentVideo.id];
  
  if (!currentNote || !currentNote.trim()) {
    alert('No notes for this video to download');
    return;
  }

  // Create HTML document format
  let htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${currentVideo.title} - Notes</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { color: #0ea5e9; border-bottom: 3px solid #0ea5e9; padding-bottom: 10px; }
        p { color: #666; font-size: 12px; margin-bottom: 20px; }
        .note { white-space: pre-wrap; line-height: 1.6; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #0ea5e9; }
      </style>
    </head>
    <body>
      <h1>📝 ${currentVideo.title}</h1>
      <p><strong>Downloaded on:</strong> ${new Date().toLocaleString()}</p>
      <div class="note">${currentNote.trim().replace(/\n/g, '<br>')}</div>
    </body>
    </html>
  `;

  // Create safe filename from current video title
  const safeTitle = currentVideo.title
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);

  const blob = new Blob([htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}_notes.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const DEFAULT_PLAYLIST_URL = "https://www.youtube.com/playlist?list=PL424yXxkpGPkx_NM7p2FonWIkZgEitby2";

// --- Theme Definitions ---
const THEMES = {
  cyan: { name: 'Cyan', primary: '#06b6d4', primary600: '#0891b2', text: '#22d3ee', bg: 'rgba(6, 182, 212, 0.2)' },
  purple: { name: 'Purple', primary: '#a855f7', primary600: '#9333ea', text: '#d8b4fe', bg: 'rgba(168, 85, 247, 0.2)' },
  green: { name: 'Green', primary: '#10b981', primary600: '#059669', text: '#6ee7b7', bg: 'rgba(16, 185, 129, 0.2)' },
  orange: { name: 'Orange', primary: '#f97316', primary600: '#ea580c', text: '#fb923c', bg: 'rgba(249, 115, 22, 0.2)' },
  blue: { name: 'Blue', primary: '#3b82f6', primary600: '#2563eb', text: '#93c5fd', bg: 'rgba(59, 130, 246, 0.2)' }
};

const isDefaultPlaylistName = (name = '') => {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (trimmed === 'My Playlist') return true;
  return /^Playlist\s+\d+$/i.test(trimmed);
};

const buildPlaylistShell = (name = 'My Playlist', source = DEFAULT_PLAYLIST_URL) => ({
  id: `pl-${(window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10))}`,
  name,
  source,
  videos: [],
  checkedIds: [],
  notes: {},
  currentVideoId: null,
  thumbnail: null,
  createdAt: Date.now(),
  updatedAt: Date.now()
});

const updateThemeColors = (theme) => {
  document.documentElement.style.setProperty('--theme-primary', theme.primary);
  document.documentElement.style.setProperty('--theme-primary-600', theme.primary600);
  document.documentElement.style.setProperty('--theme-text', theme.text);
};

const App = () => {
  // --- State ---
  const [playlists, setPlaylists] = useState([]);
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [view, setView] = useState('dashboard');
  const [streak, setStreak] = useState({ current: 0, best: 0, lastDate: null });

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');

  const [videos, setVideos] = useState([]);
  const [checkedIds, setCheckedIds] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [notes, setNotes] = useState({}); // { videoId: "note content" }
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('cyan');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('playlist-tracker-onboarded') !== '1';
  });

  const activePlaylist = useMemo(() => playlists.find(p => p.id === activePlaylistId) || null, [playlists, activePlaylistId]);
  
  // Import/Settings State
  const [playlistSource, setPlaylistSource] = useState(DEFAULT_PLAYLIST_URL);
  const [apiKey, setApiKey] = useState(ENV_API_KEY);
  const [isLoading, setIsLoading] = useState(false);

  // Manual Add Form
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');

  // Refs
  const playerRef = useRef(null);
  const isLoadingPlaylistData = useRef(false);
  const [isYTReady, setIsYTReady] = useState(false);
  const hasHydrated = useRef(false);
  const hadStoredPlaylists = useRef(false);
  const hasLoadedInitialPlaylist = useRef(false);
  const prevPlaylistsLength = useRef(0);

  // --- YouTube Player Logic ---

  const normalizeDate = (value) => new Date(value).toISOString().split('T')[0];

  const updateStreakOnCompletion = useCallback(() => {
    const today = normalizeDate(new Date());
    setStreak(prev => {
      if (!prev.lastDate) {
        return { current: 1, best: 1, lastDate: today };
      }

      const last = prev.lastDate;
      const diffDays = Math.floor((new Date(today) - new Date(last)) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return prev;
      if (diffDays === 1) {
        const nextCurrent = prev.current + 1;
        return { current: nextCurrent, best: Math.max(prev.best, nextCurrent), lastDate: today };
      }

      return { current: 1, best: Math.max(prev.best, 1), lastDate: today };
    });
  }, []);

  const handleVideoComplete = useCallback((videoId) => {
    setCheckedIds(prev => {
      if (!prev.includes(videoId)) {
        updateStreakOnCompletion();
        return [...prev, videoId];
      }
      return prev;
    });
  }, [updateStreakOnCompletion]);

  const onPlayerStateChange = useCallback((event) => {
    // YT.PlayerState.ENDED === 0
    if (event.data === 0) {
      const videoData = event.target.getVideoData();
      if (videoData && videoData.video_id) {
         handleVideoComplete(videoData.video_id);
      }
    }
  }, [handleVideoComplete]);

  const initializePlayer = useCallback(() => {
    if (!currentVideo) return;
    if (window.YT && window.YT.Player && !playerRef.current) {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: currentVideo.id,
        playerVars: {
          'playsinline': 1,
          'rel': 0
        },
        events: {
          'onStateChange': onPlayerStateChange
        }
      });
    }
  }, [currentVideo, onPlayerStateChange]);

  // --- Initialization & Storage ---

  useEffect(() => {
    const savedPlaylistsRaw = localStorage.getItem('playlist-tracker-playlists-v2');
    const savedActiveId = localStorage.getItem('playlist-tracker-active');
    const savedKey = localStorage.getItem('playlist-tracker-apikey');
    const savedTheme = localStorage.getItem('playlist-tracker-theme');
    const savedOnboarded = localStorage.getItem('playlist-tracker-onboarded');
    const savedStreak = localStorage.getItem('playlist-tracker-streak');

    if (!ENV_API_KEY && savedKey) setApiKey(savedKey);
    if (savedTheme) setCurrentTheme(savedTheme);
    if (savedStreak) {
      try {
        setStreak(JSON.parse(savedStreak));
      } catch (_) {
        setStreak({ current: 0, best: 0, lastDate: null });
      }
    }

    let loadedPlaylists = [];

    console.log('Loading from localStorage, savedPlaylistsRaw:', savedPlaylistsRaw);

    if (savedPlaylistsRaw) {
      try {
        loadedPlaylists = JSON.parse(savedPlaylistsRaw);
        console.log('Loaded playlists:', loadedPlaylists.length);
        // Ensure all playlists have thumbnail field for backward compatibility
        loadedPlaylists = loadedPlaylists.map(p => ({
          ...p,
          thumbnail: p.thumbnail || null
        }));
      } catch (e) {
        console.error('Failed to parse playlists:', e);
        loadedPlaylists = [];
      }
    } else {
      console.log('No savedPlaylistsRaw found');
      // Migration path from the original single-playlist storage
      const savedVideos = localStorage.getItem('playlist-tracker-videos');
      const savedProgress = localStorage.getItem('playlist-tracker-progress');
      const savedNotes = localStorage.getItem('playlist-tracker-notes');
      const savedSource = localStorage.getItem('playlist-tracker-source');

      if (savedVideos) {
        const migrated = buildPlaylistShell('Imported Playlist', savedSource || DEFAULT_PLAYLIST_URL);
        try {
          migrated.videos = JSON.parse(savedVideos) || [];
          migrated.checkedIds = savedProgress ? JSON.parse(savedProgress) : [];
          migrated.notes = savedNotes ? JSON.parse(savedNotes) : {};
          loadedPlaylists = [migrated];
        } catch (_) {
          loadedPlaylists = [];
        }
      }
    }

    hadStoredPlaylists.current = (loadedPlaylists || []).length > 0;
    setPlaylists(loadedPlaylists);
    const startId = savedActiveId && loadedPlaylists.some(p => p.id === savedActiveId)
      ? savedActiveId
      : loadedPlaylists[0]?.id || null;
    setActivePlaylistId(startId);
    hasHydrated.current = true;

    // Always start on dashboard view
    setView('dashboard');

    // Show onboarding only if never acknowledged
    if (savedOnboarded !== '1') setShowOnboarding(true);

    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      window.onYouTubeIframeAPIReady = () => {
        setIsYTReady(true);
      };
      document.body.appendChild(tag);
    } else if (window.YT && window.YT.Player) {
      setIsYTReady(true);
    }

    return () => window.removeEventListener('resize', checkMobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Persistence Effects
  useEffect(() => {
    if (!activePlaylistId) return;
    const selected = playlists.find(p => p.id === activePlaylistId);
    if (!selected) return;
    
    // Keep existing player instance; simply swap React state to the new playlist
    isLoadingPlaylistData.current = true;
    setVideos(selected.videos || []);
    setCheckedIds(selected.checkedIds || []);
    setNotes(selected.notes || {});
    setPlaylistSource(selected.source || DEFAULT_PLAYLIST_URL);
    const nextVideo = (selected.videos || []).find(v => v.id === selected.currentVideoId) || (selected.videos || [])[0] || null;
    setCurrentVideo(nextVideo);
    
    setTimeout(() => {
      isLoadingPlaylistData.current = false;
      hasLoadedInitialPlaylist.current = true;
    }, 0);
  }, [activePlaylistId, playlists]);

  useEffect(() => {
    // When leaving the playlist view, tear down the player because the DOM node is unmounted
    if (view !== 'playlist' && playerRef.current && playerRef.current.destroy) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
  }, [view]);

  useEffect(() => {
    if (!activePlaylistId || isLoadingPlaylistData.current || !hasLoadedInitialPlaylist.current) return;
    setPlaylists(prev => prev.map(p => p.id === activePlaylistId ? {
      ...p,
      videos,
      checkedIds,
      notes,
      source: playlistSource,
      currentVideoId: currentVideo?.id || null,
      updatedAt: Date.now()
    } : p));
  }, [activePlaylistId, videos, checkedIds, notes, playlistSource, currentVideo]);

  useEffect(() => {
    if (!hasHydrated.current) return;
    
    // Only save if: (1) we have playlists, OR (2) playlists went from non-empty to empty (delete action)
    const wasDeleteAction = prevPlaylistsLength.current > 0 && playlists.length === 0;
    
    if (playlists.length > 0 || wasDeleteAction) {
      try {
        localStorage.setItem('playlist-tracker-playlists-v2', JSON.stringify(playlists));
        if (activePlaylistId) localStorage.setItem('playlist-tracker-active', activePlaylistId);
        console.log('Saved playlists to localStorage:', playlists.length);
      } catch (err) {
        console.error('Failed to save to localStorage:', err);
      }
    }
    
    prevPlaylistsLength.current = playlists.length;
  }, [playlists, activePlaylistId]);

  useEffect(() => localStorage.setItem('playlist-tracker-apikey', apiKey), [apiKey]);
  useEffect(() => localStorage.setItem('playlist-tracker-theme', currentTheme), [currentTheme]);
  useEffect(() => localStorage.setItem('playlist-tracker-streak', JSON.stringify(streak)), [streak]);
  useEffect(() => {
    updateThemeColors(THEMES[currentTheme]);
  }, [currentTheme]);

  // Sync Player with React State
  useEffect(() => {
    if (!currentVideo) {
      // Clean up player if no video selected
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      return;
    }

    // Only proceed if YouTube API is ready
    if (!isYTReady) return;

    // Initialize player if it doesn't exist
    if (!playerRef.current) {
      // Small delay to ensure DOM element exists
      setTimeout(() => {
        if (window.YT && window.YT.Player && !playerRef.current) {
          initializePlayer();
        }
      }, 100);
    }
    // Load video if player already exists
    else if (playerRef.current && playerRef.current.loadVideoById) {
      playerRef.current.loadVideoById(currentVideo.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo, isYTReady]);

  useEffect(() => {
    // When returning to playlist view, ensure the player is recreated and loaded
    if (view !== 'playlist') return;
    if (!currentVideo || !isYTReady) return;

    if (!playerRef.current) {
      setTimeout(() => {
        if (view === 'playlist' && currentVideo && isYTReady && window.YT && window.YT.Player && !playerRef.current) {
          initializePlayer();
        }
      }, 50);
    } else if (playerRef.current.loadVideoById) {
      playerRef.current.loadVideoById(currentVideo.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentVideo, isYTReady]);

  // Tear down player when leaving the playlist view to avoid broken instances when the DOM node is unmounted
  // (Keep player alive across view switches; cleanup only when no current video)

  // --- Stats Calculation ---

  const stats = useMemo(() => computeStats(videos, checkedIds), [videos, checkedIds]);


  // --- Import Handlers ---

  const extractPlaylistId = (url) => {
    const regExp = /[?&]list=([^#&?]+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const extractVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // --- Create & Import Handler (Dashboard Only) ---
  // This function creates a playlist and immediately imports videos from YouTube
  const handleCreateAndImportPlaylist = async (e) => {
    e.preventDefault();
    
    // STEP 1: Validate inputs
    const name = newPlaylistName.trim() || `Playlist ${playlists.length + 1}`;
    const source = newPlaylistUrl.trim();

    if (!source) {
      alert('Please enter a YouTube playlist URL.');
      return;
    }

    const playlistId = extractPlaylistId(source);
    if (!playlistId) {
      alert('Invalid Playlist URL. Must contain \'list=...\'');
      return;
    }
    
    if (!apiKey) {
      alert('API Key missing. Please set REACT_APP_YOUTUBE_API_KEY in env or enter manually.');
      return;
    }

    // STEP 2: Create empty playlist shell
    const shell = buildPlaylistShell(name, source);
    setPlaylists(prev => [...prev, shell]);
    setNewPlaylistName('');
    setNewPlaylistUrl('');

    // STEP 3: Fetch and import videos from YouTube API
    setIsLoading(true);
    try {
      // 3a. Try to fetch playlist title and thumbnail from YouTube (only if user didn't provide custom name)
      let resolvedTitle = name;
      let thumbnailUrl = null;
      try {
        const infoResponse = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`);
        const infoData = await infoResponse.json();
        const fetchedTitle = infoData?.items?.[0]?.snippet?.title;
        const thumbnails = infoData?.items?.[0]?.snippet?.thumbnails;
        if (fetchedTitle && isDefaultPlaylistName(name)) {
          resolvedTitle = fetchedTitle;
        }
        // Get highest quality thumbnail available
        thumbnailUrl = thumbnails?.maxres?.url || thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url || null;
      } catch (_) {
        // Keep user-provided name if API fails
      }

      // 3b. Fetch all playlist items (handles pagination for large playlists)
      let allItems = [];
      let nextPageToken = null;
      do {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const plResponse = await fetch(url);
        const plData = await plResponse.json();
        
        if (plData.error) throw new Error(plData.error.message);
        
        allItems = allItems.concat(plData.items.filter(i => i.snippet.title !== 'Private video'));
        nextPageToken = plData.nextPageToken;
      } while (nextPageToken);

      if (allItems.length === 0) throw new Error('No videos found in this playlist.');

      // 3c. Fetch video durations (batch requests, 50 at a time)
      const durationMap = {};
      for (let i = 0; i < allItems.length; i += 50) {
        const batch = allItems.slice(i, i + 50);
        const videoIds = batch.map(item => item.snippet.resourceId.videoId).join(',');
        const vidResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`);
        const vidData = await vidResponse.json();
        
        if (vidData.items) {
          vidData.items.forEach(v => {
            durationMap[v.id] = v.contentDetails.duration;
          });
        }
      }

      // 3d. Build final video list with titles and durations
      const newVideos = allItems.map(item => {
        const vidId = item.snippet.resourceId.videoId;
        const isoDuration = durationMap[vidId];
        return { 
          id: vidId, 
          title: item.snippet.title, 
          duration: isoDuration || '??:??' 
        };
      });

      // STEP 4: Clean up old player if it exists
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      // STEP 5: Update playlist with imported videos
      setPlaylists(prev => prev.map(p => p.id === shell.id ? {
        ...p,
        videos: newVideos,
        name: resolvedTitle,
        thumbnail: thumbnailUrl,
        currentVideoId: newVideos[0]?.id || null,
        checkedIds: [],
        notes: {},
        updatedAt: Date.now()
      } : p));
      
      // STEP 6: Activate playlist and switch view AFTER import completes
      setActivePlaylistId(shell.id);
      setVideos(newVideos);
      setCurrentVideo(newVideos[0] || null);
      setCheckedIds([]);
      setNotes({});
      setView('playlist');
      setIsSidebarOpen(true);
      
      localStorage.setItem('playlist-tracker-onboarded', '1');
      alert(`✓ Successfully imported ${newVideos.length} video${newVideos.length === 1 ? '' : 's'}!`);
      
    } catch (error) {
      // If import fails, remove the empty playlist shell
      alert(`Import failed: ${error.message}`);
      setPlaylists(prev => prev.filter(p => p.id !== shell.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPlaylist = (id, openImport = false) => {
    setActivePlaylistId(id);
    setView('playlist');
    setIsSidebarOpen(openImport ? true : !isMobile);
    if (openImport) setIsEditMode(true);
  };

  const handleDeletePlaylist = (id) => {
    if (!window.confirm('Delete this playlist? This will remove its local progress and notes.')) return;
    setPlaylists(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (!remaining.length) {
        setActivePlaylistId(null);
        setShowOnboarding(true);
        setView('dashboard');
        return [];
      }

      if (activePlaylistId === id) {
        setActivePlaylistId(remaining[0].id);
        setShowOnboarding(!remaining[0].videos.length);
        setView(remaining[0].videos.length ? 'playlist' : 'dashboard');
      }

      return remaining;
    });
  };

  const handleAddManualVideo = (e) => {
    e.preventDefault();
    const id = extractVideoId(newVideoUrl);
    if (!id || !newVideoTitle) return;
    const newVideo = { id, title: newVideoTitle, duration: '??:??' };
    setVideos(prev => [...prev, newVideo]);
    if (!currentVideo) setCurrentVideo(newVideo);
    setShowOnboarding(false);
    localStorage.setItem('playlist-tracker-onboarded', '1');
    setNewVideoUrl('');
    setNewVideoTitle('');
  };

  // --- Other Handlers ---

  const handleNoteChange = (e) => {
    if (!currentVideo) return;
    setNotes({
      ...notes,
      [currentVideo.id]: e.target.value
    });
  };

  const toggleCheck = (e, id) => {
    e.stopPropagation(); 
    setCheckedIds(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      updateStreakOnCompletion();
      return [...prev, id];
    });
  };

  const playVideo = (video) => {
    setCurrentVideo(video);
    if (isMobile) setIsSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openInNewTab = (e, id) => {
    e.stopPropagation();
    window.open(`https://www.youtube.com/watch?v=${id}`, '_blank');
  };

  if (view === 'dashboard' || !activePlaylist) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-cyan-500/30">
        <nav className="h-16 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md fixed top-0 w-full z-50 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-start" style={{ color: 'var(--theme-text)' }}>
              <div className="flex items-center gap-2">
                <Layers className="w-6 h-6" />
                <span className="font-bold text-lg tracking-tight text-white">Playlist<span style={{ color: 'var(--theme-text)' }}>Track</span></span>
              </div>
              <span className="text-[10px] text-neutral-500 font-medium tracking-wide italic">Let's get shit done</span>
            </div>
            
            <div className="w-px h-6 bg-neutral-800 hidden md:block ml-2"></div>
            
            {/* GitHub & Coffee Links */}
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
              title="View on GitHub"
            >
              <Github size={18} />
            </a>
            <a
              href="https://www.buymeacoffee.com/Siddhantcookie"
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex p-2 text-neutral-500 hover:text-yellow-400 hover:bg-neutral-800 rounded-lg transition-colors"
              title="Buy me a coffee"
            >
              <Coffee size={18} />
            </a>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end text-xs text-neutral-400">
              <span className="uppercase tracking-wide text-[10px]">Playlists</span>
              <span className="text-white font-semibold">{playlists.length}</span>
            </div>

            <div className="w-px h-6 bg-neutral-800" />

            <div className="flex items-center gap-1 text-sm font-bold" style={{ color: streak.current ? '#f97316' : '#9ca3af' }} title={`Best streak: ${streak.best} day${streak.best === 1 ? '' : 's'}`}>
              <Flame size={16} />
              <span>{streak.current}d</span>
            </div>

            <div className="w-px h-6 bg-neutral-800 hidden sm:block" />

            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              style={{ color: 'var(--theme-text)' }}
              title="Change theme"
            >
              <Palette size={20} />
            </button>
            {showThemeMenu && (
              <div className="absolute top-14 right-4 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl p-2 min-w-[140px] z-50">
                {Object.entries(THEMES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setCurrentTheme(key);
                      setShowThemeMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left"
                    style={{
                      backgroundColor: currentTheme === key ? t.bg : 'transparent',
                      color: currentTheme === key ? t.text : '#a3a3a3'
                    }}
                  >
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: t.text }}></div>
                    <span className="text-sm font-medium">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {showOnboarding && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center" style={{ color: 'var(--theme-text)' }}>
                  <Layers size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Welcome to PlaylistTrack</h2>
                  <p className="text-sm text-neutral-400">Start tracking your learning progress in 3 easy steps</p>
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3 text-sm text-neutral-300">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    <p className="font-semibold text-white">Enter a playlist name</p>
                    <p className="text-xs text-neutral-400 mt-0.5">Give your course a memorable name</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">2</span>
                  <div>
                    <p className="font-semibold text-white">Paste YouTube playlist URL</p>
                    <p className="text-xs text-neutral-400 mt-0.5">Copy the link from any YouTube playlist</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">3</span>
                  <div>
                    <p className="font-semibold text-white">Click "Create & Import"</p>
                    <p className="text-xs text-neutral-400 mt-0.5">Your videos will load automatically and you can start learning!</p>
                  </div>
                </div>
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 text-xs text-cyan-200">
                <p className="font-semibold flex items-center gap-1.5">
                  <Layers size={12} />
                  Multi-Playlist Support
                </p>
                <p className="text-cyan-300/70 mt-1">Add as many playlists as you want! Each one tracks progress independently.</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    localStorage.setItem('playlist-tracker-onboarded', '1');
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: THEMES[currentTheme].primary }}
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="pt-20 pb-16 px-4 lg:px-8 max-w-6xl mx-auto space-y-8">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-black text-white tracking-tight">Your playlists</h1>
            <p className="text-neutral-400 text-sm max-w-2xl">Create as many learning playlists as you like, track progress per course, and jump back in when you are ready.</p>
          </header>

          <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 lg:p-6 shadow-lg shadow-cyan-900/10">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-white">Add playlist</h2>
                <p className="text-xs text-neutral-500">Give it a name, paste the playlist link, and import from the next screen.</p>
              </div>
            </div>
            <form onSubmit={handleCreateAndImportPlaylist} className="mt-4 grid grid-cols-1 md:grid-cols-[1.2fr_1.8fr_auto] gap-3">
              <input
                type="text"
                placeholder="Playlist name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                placeholder="YouTube playlist URL (optional)"
                value={newPlaylistUrl}
                onChange={(e) => setNewPlaylistUrl(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Create & Import'}
              </button>
            </form>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {playlists.map((pl) => {
              const plStats = computeStats(pl.videos, pl.checkedIds);
              return (
                <div key={pl.id} className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col hover:border-neutral-700 transition-colors">
                  {/* Thumbnail */}
                  {pl.thumbnail && (
                    <div className="aspect-video w-full bg-neutral-950 overflow-hidden">
                      <img 
                        src={pl.thumbnail} 
                        alt={pl.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    {/* Title Section */}
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-neutral-500">Course</p>
                      <h3 className="text-lg font-bold text-white leading-tight">{pl.name}</h3>
                    </div>

                    {/* Stats */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-xs text-neutral-400">
                        <ListVideo size={14} className="text-neutral-500" />
                        <span>{pl.videos.length} video{pl.videos.length === 1 ? '' : 's'}</span>
                        <span className="w-1 h-1 rounded-full bg-neutral-700" />
                        <span>{plStats.total}</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-neutral-400">
                          <span>Progress</span>
                          <span className="text-white font-semibold">{plStats.percentage}%</span>
                        </div>
                        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${plStats.percentage}%`, background: THEMES[currentTheme].primary }}
                          ></div>
                        </div>
                        <div className="text-[11px] text-neutral-500">{plStats.completed} / {plStats.total}</div>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 mt-auto pt-2 border-t border-neutral-800">
                      <button
                        onClick={() => handleOpenPlaylist(pl.id)}
                        className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                        {pl.videos.length ? 'Continue' : 'Open'}
                      </button>
                      <button
                        onClick={() => handleOpenPlaylist(pl.id, true)}
                        className="px-3 py-2 text-sm rounded-lg border border-neutral-700 text-neutral-200 hover:border-cyan-500 transition-colors"
                      >
                        Import
                      </button>
                      <button
                        onClick={() => handleDeletePlaylist(pl.id)}
                        className="p-2 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition-colors"
                        title="Delete playlist"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {!playlists.length && (
              <div className="border border-dashed border-neutral-800 rounded-2xl p-6 text-center text-neutral-500">
                No playlists yet. Create one to get started.
              </div>
            )}
          </section>

          {/* Footer */}
          <footer className="mt-8 text-center text-[11px] text-neutral-500 flex flex-col items-center gap-3">
            <div>
              <span>Made with ❤️ by </span>
              <a
                href="https://github.com/siddhantcookie"
                target="_blank"
                rel="noreferrer"
                className="text-neutral-300 hover:text-white underline decoration-dotted underline-offset-4"
              >
                siddhantcookie
              </a>
            </div>
            <a
              href="https://www.buymeacoffee.com/Siddhantcookie"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-neutral-400 hover:text-yellow-400 transition-colors"
              title="Buy me a coffee"
            >
              <Coffee size={16} />
              <span className="text-[11px]">Buy me a coffee</span>
            </a>
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-cyan-500/30">
      
      {/* Navbar */}
      <nav className="h-16 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md fixed top-0 w-full z-50 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors lg:hidden"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex flex-col items-start" style={{ color: 'var(--theme-text)' }}>
            <div className="flex items-center gap-2">
              <ListVideo className="w-6 h-6" />
              <span className="font-bold text-lg tracking-tight text-white">Playlist<span style={{ color: 'var(--theme-text)' }}>Track</span></span>
            </div>
            <span className="text-[10px] text-neutral-500 font-medium tracking-wide italic">Let's get shit done</span>
          </div>
          
          <div className="w-px h-6 bg-neutral-800 hidden md:block ml-2"></div>
          
          {/* GitHub & Coffee Links */}
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            title="View on GitHub"
          >
            <Github size={18} />
          </a>
          <a
            href="https://www.buymeacoffee.com/Siddhantcookie"
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex p-2 text-neutral-500 hover:text-yellow-400 hover:bg-neutral-800 rounded-lg transition-colors"
            title="Buy me a coffee"
          >
            <Coffee size={18} />
          </a>
        </div>

        {/* Center Stats */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="text-sm font-semibold text-neutral-300 max-w-xs truncate">
            {activePlaylist?.name}
          </div>
          
          <div className="w-px h-6 bg-neutral-800"></div>
          
          <div className="flex items-center gap-1 text-sm font-bold" style={{ color: streak.current ? '#f97316' : '#9ca3af' }} title={`Best streak: ${streak.best} day${streak.best === 1 ? '' : 's'}`}>
            <Flame size={16} />
            <span>{streak.current}d</span>
          </div>
          
          <div className="w-px h-6 bg-neutral-800"></div>
          
          <div className="text-xs font-mono text-neutral-300">
            {stats.completed} <span className="text-neutral-600">/</span> {stats.total}
          </div>
          
          <div className="w-px h-6 bg-neutral-800"></div>
          
          <div style={{ color: 'var(--theme-text)' }} className="text-sm font-bold">{stats.percentage}%</div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView('dashboard'); setIsSidebarOpen(false); setIsEditMode(false); }}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-200"
          >
            <ArrowLeft size={14} /> Dashboard
          </button>

          {/* Theme Selector */}
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              style={{ color: 'var(--theme-text)' }}
              title="Change theme"
            >
              <Palette size={20} />
            </button>
            {showThemeMenu && (
              <div className="absolute top-12 right-0 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl p-2 min-w-[140px] z-50">
                {Object.entries(THEMES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setCurrentTheme(key);
                      setShowThemeMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left"
                    style={{
                      backgroundColor: currentTheme === key ? t.bg : 'transparent',
                      color: currentTheme === key ? t.text : '#a3a3a3'
                    }}
                  >
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: t.text }}></div>
                    <span className="text-sm font-medium">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Circular Progress */}
          <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center relative overflow-hidden ring-2 ring-neutral-800">
             <div 
               className="absolute bottom-0 left-0 w-full transition-all duration-500"
               style={{ height: `${stats.percentage}%`, backgroundColor: THEMES[currentTheme].bg }}
             ></div>
             {stats.percentage === 100 ? <Trophy size={18} className="text-yellow-400 z-10" /> : <span className="text-xs font-bold z-10">{checkedIds.length}</span>}
          </div>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="pt-16 flex h-screen overflow-hidden">
        
        {/* Left: Content Area */}
        <main className={`flex-1 h-full overflow-y-auto bg-neutral-900 transition-all duration-300 relative ${isSidebarOpen && !isMobile ? 'mr-96' : ''}`}>
          
          <div className="w-full max-w-5xl mx-auto p-4 lg:p-8 pb-32">
            {videos.length > 0 ? (
              <>
                {/* Video Player (API Controlled) */}
                <div className="aspect-video w-full bg-black rounded-2xl shadow-2xl shadow-cyan-900/10 overflow-hidden border border-neutral-800 relative group z-10">
                  <div id="youtube-player"></div>
                </div>

                {/* Video Title & Actions */}
                <div className="mt-6 flex flex-col md:flex-row items-start justify-between gap-4 border-b border-neutral-800 pb-6">
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-white leading-tight">{currentVideo?.title}</h1>
                    <div className="flex items-center gap-3 mt-2 text-sm text-neutral-400">
                       <span className="bg-neutral-800 px-2 py-0.5 rounded text-xs font-mono text-neutral-300">
                         {/* Display simplified duration if possible, or raw if it's colon format */}
                         {currentVideo.duration.startsWith('PT') ? formatSecondsToTime(parseDurationToSeconds(currentVideo.duration)) : currentVideo.duration}
                       </span>
                       <span className="w-1 h-1 bg-neutral-600 rounded-full"></span>
                       <span>ID: {currentVideo?.id}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => openInNewTab(e, currentVideo?.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-all font-medium text-xs whitespace-nowrap"
                  >
                    <span>Open in YouTube</span>
                    <ExternalLink size={14} className="text-neutral-400" />
                  </button>
                </div>

                {/* Notes Section */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--theme-text)' }}>
                      <BookOpen size={16} /> My Notes
                    </label>
                    <button
                      onClick={() => downloadNotesAsText(notes, videos, currentVideo)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-all text-xs font-medium"
                      title="Download all notes"
                    >
                      <Download size={14} />
                      <span>Download Notes</span>
                    </button>
                  </div>
                  <textarea
                    value={notes[currentVideo.id] || ''}
                    onChange={handleNoteChange}
                    placeholder={`Take notes for "${currentVideo.title}" here... (Saved automatically)`}
                    className="w-full h-40 bg-neutral-950/50 border border-neutral-800 rounded-xl p-4 text-sm text-neutral-300 focus:outline-none focus:ring-1 transition-all resize-y placeholder:text-neutral-700"
                    style={{
                      '--focus-border-color': THEMES[currentTheme].primary,
                      '--focus-ring-color': THEMES[currentTheme].primary
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = THEMES[currentTheme].primary;
                      e.target.style.boxShadow = `0 0 0 1px ${THEMES[currentTheme].primary}`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '';
                      e.target.style.boxShadow = '';
                    }}
                  />
                  <div className="flex justify-end mt-2">
                    <span className="text-[10px] text-neutral-600 italic">
                      Notes saved to local storage
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-neutral-500">
                <ListVideo size={48} className="mb-4 opacity-50" />
                <h2 className="text-xl font-bold text-neutral-300">Playlist is empty</h2>
                <p className="mt-2 text-sm">Add a link in the sidebar to get started.</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 text-center text-[11px] text-neutral-500 flex flex-col items-center gap-3">
              <div>
                <span>Made with ❤️ by </span>
                <a
                  href="https://github.com/siddhantcookie"
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-300 hover:text-white underline decoration-dotted underline-offset-4"
                >
                  siddhantcookie
                </a>
              </div>
              <a
                href="https://www.buymeacoffee.com/Siddhantcookie"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-neutral-400 hover:text-yellow-400 transition-colors"
                title="Buy me a coffee"
              >
                <Coffee size={16} />
                <span className="text-[11px]">Buy me a coffee</span>
              </a>
            </div>
          </div>
        </main>

        {/* Right: Sidebar */}
        <aside 
          className={`fixed lg:absolute top-16 bottom-0 right-0 w-full lg:w-96 bg-neutral-950 border-l border-neutral-800 transform transition-transform duration-300 z-40 flex flex-col ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-neutral-800 bg-neutral-950 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                Course Content
              </h2>
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={{
                  border: isEditMode ? `1px solid ${THEMES[currentTheme].primary}` : 'none',
                  background: isEditMode ? THEMES[currentTheme].bg : '#404040',
                  color: isEditMode ? THEMES[currentTheme].text : '#a3a3a3'
                }}
              >
                {isEditMode ? <Save size={14} /> : <Edit3 size={14} />}
                {isEditMode ? 'Done' : 'Import'}
              </button>
            </div>

            {/* Edit / Import Panel */}
            {isEditMode && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-4 bg-neutral-900/50 p-3 rounded-xl border border-neutral-800">
                
                {/* Manual Add */}
                <div className="space-y-2">
                   <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-2">
                    <Plus size={12} /> Manually Add
                  </h3>
                  <form onSubmit={handleAddManualVideo} className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Video URL..."
                      value={newVideoUrl}
                      onChange={(e) => setNewVideoUrl(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-colors"
                      onFocus={(e) => e.target.style.borderColor = THEMES[currentTheme].primary}
                      onBlur={(e) => e.target.style.borderColor = ''}
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Title..."
                        value={newVideoTitle}
                        onChange={(e) => setNewVideoTitle(e.target.value)}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-colors"
                        onFocus={(e) => e.target.style.borderColor = THEMES[currentTheme].primary}
                        onBlur={(e) => e.target.style.borderColor = ''}
                      />
                      <button type="submit" className="text-white px-3 rounded-lg font-bold text-xs" style={{ backgroundColor: THEMES[currentTheme].primary600 }}>Add</button>
                    </div>
                  </form>
                </div>
                
                <div className="border-t border-neutral-800 pt-2 flex justify-center">
                   <button 
                    onClick={() => {
                      if(window.confirm('Reset all data?')) { 
                        setVideos([]); 
                        setCurrentVideo(null);
                        setCheckedIds([]); 
                        setNotes({});
                        setShowOnboarding(true);
                        localStorage.removeItem('playlist-tracker-onboarded');
                      }
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 hover:underline"
                   >
                     <RotateCcw size={10} /> Reset
                   </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="h-1 w-full bg-neutral-900">
            <div 
              className="h-full transition-all duration-500"
              style={{
                width: `${stats.percentage}%`,
                background: `linear-gradient(to right, ${THEMES[currentTheme].primary}, ${THEMES[currentTheme].primary}cc)`
              }}
            ></div>
          </div>

          {/* Video List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {videos.map((video, index) => {
              const isChecked = checkedIds.includes(video.id);
              const isActive = currentVideo?.id === video.id;
              const hasNotes = notes[video.id] && notes[video.id].trim().length > 0;

              return (
                <div 
                  key={video.id + index}
                  onClick={() => !isEditMode && playVideo(video)}
                  className={`
                    group flex items-center gap-3 p-3 rounded-xl transition-all duration-200 border border-transparent
                    ${isEditMode ? 'cursor-default bg-neutral-900/30' : 'cursor-pointer'}
                  `}
                  style={isActive && !isEditMode ? {
                    backgroundColor: '#262626',
                    borderColor: '#404040',
                    boxShadow: `0 0 0 1px ${THEMES[currentTheme].primary}33`
                  } : {}}
                >
                  {/* Checkbox */}
                  {isEditMode ? (
                     <div className="text-neutral-600"><MoreVertical size={16} /></div>
                  ) : (
                    <button
                      onClick={(e) => toggleCheck(e, video.id)}
                      className="flex-shrink-0 p-1 rounded-full hover:bg-neutral-800 transition-colors"
                    >
                      {isChecked ? (
                        <CheckCircle2 size={20} style={{ color: THEMES[currentTheme].primary, fill: THEMES[currentTheme].bg }} />
                      ) : (
                        <Circle className="w-5 h-5 text-neutral-600 group-hover:text-neutral-500" />
                      )}
                    </button>
                  )}

                  {/* Title & Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-medium truncate ${isChecked && !isEditMode ? 'line-through text-neutral-500' : 'text-neutral-300'}`} style={isActive && !isEditMode ? { color: THEMES[currentTheme].text } : {}}>
                      {index + 1}. {video.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 rounded font-mono">
                        {video.duration.startsWith('PT') ? formatSecondsToTime(parseDurationToSeconds(video.duration)) : video.duration}
                      </span>
                      {hasNotes && !isActive && <span className="text-[10px] flex items-center gap-1" style={{ color: THEMES[currentTheme].primary }}><BookOpen size={8} /> Notes</span>}
                      {isActive && !isEditMode && <span className="text-[10px] font-bold tracking-wider animate-pulse" style={{ color: THEMES[currentTheme].text }}>PLAYING</span>}
                    </div>
                  </div>

                  {/* Delete (Edit Mode) */}
                  {isEditMode && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if(window.confirm('Delete?')) setVideos(videos.filter(v => v.id !== video.id));
                        }}
                        className="p-2 text-neutral-500 hover:text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

      </div>
    </div>
  );
};

export default App;