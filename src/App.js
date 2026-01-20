import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ExternalLink, 
  CheckCircle2, 
  Circle, 
  MoreVertical, 
  ListVideo,
  Trophy,
  Youtube,
  Menu,
  X,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Edit3,
  Download,
  Link as LinkIcon,
  Loader2,
  BookOpen,
  Palette,
  Github,
  Coffee
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

const updateThemeColors = (theme) => {
  document.documentElement.style.setProperty('--theme-primary', theme.primary);
  document.documentElement.style.setProperty('--theme-primary-600', theme.primary600);
  document.documentElement.style.setProperty('--theme-text', theme.text);
};

const App = () => {
  // --- State ---
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Import/Settings State
  const [playlistSource, setPlaylistSource] = useState(DEFAULT_PLAYLIST_URL);
  const [apiKey, setApiKey] = useState(ENV_API_KEY);
  const [isLoading, setIsLoading] = useState(false);

  // Manual Add Form
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');

  // Refs
  const playerRef = useRef(null);

  // --- YouTube Player Logic ---

  const handleVideoComplete = useCallback((videoId) => {
    setCheckedIds(prev => {
      if (!prev.includes(videoId)) {
        return [...prev, videoId];
      }
      return prev;
    });
  }, []);

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
    // Load from LocalStorage
    const savedProgress = localStorage.getItem('playlist-tracker-progress');
    const savedVideos = localStorage.getItem('playlist-tracker-videos');
    const savedKey = localStorage.getItem('playlist-tracker-apikey');
    const savedSource = localStorage.getItem('playlist-tracker-source');
    const savedNotes = localStorage.getItem('playlist-tracker-notes');
    const savedTheme = localStorage.getItem('playlist-tracker-theme');
    const savedOnboarded = localStorage.getItem('playlist-tracker-onboarded');
    
    if (savedProgress) setCheckedIds(JSON.parse(savedProgress));
    let hasSavedVideos = false;
    if (savedVideos) {
      const parsedVideos = JSON.parse(savedVideos);
      if (parsedVideos.length > 0) {
        hasSavedVideos = true;
        setVideos(parsedVideos);
        setCurrentVideo(parsedVideos[0]);
      }
    }
    // Only load manual API key if ENV key is missing
    if (!ENV_API_KEY && savedKey) setApiKey(savedKey);
    if (savedSource) setPlaylistSource(savedSource);
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedTheme) setCurrentTheme(savedTheme);
    if (!savedOnboarded && !hasSavedVideos) setShowOnboarding(true);
    
    // Responsive check
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Load YouTube IFrame API (only once on mount)
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const loadPlayer = () => {
        // This will be called when YT API is ready
        if (window.YT && window.YT.Player) {
          // Player will be initialized by the other useEffect when currentVideo is set
        }
      };
      window.onYouTubeIframeAPIReady = loadPlayer;
      document.body.appendChild(tag);
    }

    return () => window.removeEventListener('resize', checkMobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Persistence Effects
  useEffect(() => localStorage.setItem('playlist-tracker-progress', JSON.stringify(checkedIds)), [checkedIds]);
  useEffect(() => localStorage.setItem('playlist-tracker-videos', JSON.stringify(videos)), [videos]);
  useEffect(() => localStorage.setItem('playlist-tracker-apikey', apiKey), [apiKey]);
  useEffect(() => localStorage.setItem('playlist-tracker-source', playlistSource), [playlistSource]);
  useEffect(() => localStorage.setItem('playlist-tracker-notes', JSON.stringify(notes)), [notes]);
  useEffect(() => localStorage.setItem('playlist-tracker-theme', currentTheme), [currentTheme]);
  useEffect(() => {
    updateThemeColors(THEMES[currentTheme]);
  }, [currentTheme]);

  // Sync Player with React State
  useEffect(() => {
    if (currentVideo && window.YT && window.YT.Player && !playerRef.current) {
      initializePlayer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo]); // Only re-initialize when currentVideo changes

  useEffect(() => {
    if (!currentVideo) return;
    if (playerRef.current && playerRef.current.loadVideoById) {
      playerRef.current.loadVideoById(currentVideo.id);
    }
  }, [currentVideo]);

  // --- Stats Calculation ---

  const stats = useMemo(() => {
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
      percentage: totalSec > 0 ? Math.round((completedSec / totalSec) * 100) : 0
    };
  }, [videos, checkedIds]);


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

  const handleImportPlaylist = async () => {
    const playlistId = extractPlaylistId(playlistSource);

    if (!playlistId) {
      alert("Invalid Playlist URL. Must contain 'list=...'");
      return;
    }
    if (!apiKey) {
      alert("API Key missing. Please set REACT_APP_YOUTUBE_API_KEY in env or enter manually.");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch ALL Playlist Items (handle pagination)
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

      if (allItems.length === 0) throw new Error("No videos found.");

      // 2. Fetch Video Details (for Duration) - in batches of 50
      const durationMap = {};
      for (let i = 0; i < allItems.length; i += 50) {
        const batch = allItems.slice(i, i + 50);
        const videoIds = batch.map(item => item.snippet.resourceId.videoId).join(',');
        const vidResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`
        );
        const vidData = await vidResponse.json();
        
        if (vidData.items) {
          vidData.items.forEach(v => {
            durationMap[v.id] = v.contentDetails.duration;
          });
        }
      }

      // 3. Merge Data
      const newVideos = allItems.map(item => {
        const vidId = item.snippet.resourceId.videoId;
        const isoDuration = durationMap[vidId];
        return {
          id: vidId,
          title: item.snippet.title,
          duration: isoDuration || '??:??' 
        };
      });

      // Destroy old player if it exists
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      // Batch state updates to prevent stale UI
      setCheckedIds([]);
      setNotes({});
      setVideos(newVideos);
      setCurrentVideo(newVideos.length > 0 ? newVideos[0] : null);
      setIsEditMode(false);
      setShowOnboarding(false);
      localStorage.setItem('playlist-tracker-onboarded', '1');
      
      alert(`Imported ${newVideos.length} videos with duration data!`);

    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
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

  const dismissOnboarding = (openImport = false) => {
    setShowOnboarding(false);
    localStorage.setItem('playlist-tracker-onboarded', '1');
    if (openImport) {
      setIsEditMode(true);
      setIsSidebarOpen(true);
    }
  };

  const toggleCheck = (e, id) => {
    e.stopPropagation(); 
    setCheckedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
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
        </div>
        <div className="flex items-center gap-4">
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

          <div className="w-px h-6 bg-neutral-800 hidden sm:block"></div>
           {/* Source Link */}
           <a 
            href={playlistSource}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-2 text-xs font-medium text-neutral-500 hover:text-white transition-colors"
          >
            <Youtube size={16} />
            <span>Source</span>
          </a>
          {/* GitHub Link */}
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            title="View on GitHub"
          >
            <Github size={18} />
          </a>
          {/* Buy Me a Coffee Link */}
          <a
            href="https://www.buymeacoffee.com/Siddhantcookie"
            target="_blank"
            rel="noreferrer"
            className="p-2 text-neutral-500 hover:text-yellow-400 hover:bg-neutral-800 rounded-lg transition-colors"
            title="Buy me a coffee"
          >
            <Coffee size={18} />
          </a>
          <div className="w-px h-6 bg-neutral-800 hidden sm:block"></div>
          
          {/* Time Stats */}
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Time</span>
            <div className="text-xs font-mono text-neutral-300">
              {stats.completed} <span className="text-neutral-600">/</span> {stats.total}
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Progress</span>
            <div style={{ color: 'var(--theme-text)' }} className="text-sm font-bold">{stats.percentage}%</div>
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

      {showOnboarding && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center" style={{ color: 'var(--theme-text)' }}>
                <LinkIcon size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Import your playlist</h2>
                <p className="text-sm text-neutral-400">Paste your YouTube playlist link in the Import panel to start tracking your progress.</p>
              </div>
            </div>

            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-2 text-sm text-neutral-300">
              <div className="flex items-start gap-2">
                <span className="text-neutral-500">1.</span>
                <span>Open the Import panel (Import button on the right).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-neutral-500">2.</span>
                <span>Paste your YouTube playlist URL and click Fetch.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-neutral-500">3.</span>
                <span>Mark videos as complete and take notes as you go.</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => dismissOnboarding(false)}
                className="px-3 py-2 text-sm text-neutral-400 hover:text-white"
              >
                Maybe later
              </button>
              <button
                onClick={() => dismissOnboarding(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: THEMES[currentTheme].primary }}
              >
                Open Import
              </button>
            </div>
          </div>
        </div>
      )}

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
                
                {/* Import Section */}
                <div className="space-y-2 border-b border-neutral-800 pb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
                    <LinkIcon size={12} /> Playlist Link
                  </h3>
                  
                  <input
                    type="text"
                    placeholder="Paste YouTube Playlist URL..."
                    value={playlistSource}
                    onChange={(e) => setPlaylistSource(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-neutral-600 mb-2 transition-colors"
                    onFocus={(e) => e.target.style.borderColor = THEMES[currentTheme].primary}
                    onBlur={(e) => e.target.style.borderColor = ''}
                  />
                  
                  <button 
                    onClick={handleImportPlaylist}
                    disabled={isLoading}
                    className="w-full bg-neutral-800 hover:bg-neutral-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50 text-xs font-bold flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {ENV_API_KEY ? "Fetch Videos (Using Env Key)" : "Fetch Videos"}
                  </button>
                </div>

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