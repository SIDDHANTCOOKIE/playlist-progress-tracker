// This is a corrected section starting from line 445 - the return statement

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
          <div className="flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
            <ListVideo className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight text-white">Playlist<span style={{ color: 'var(--theme-text)' }}>Track</span></span>
          </div>
        </div>

        <div className="flex items-center gap-4">
