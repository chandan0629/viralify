import React, { useState, useMemo } from 'react';

// Sample data for demonstration
const INITIAL_ARTISTS = [
  { id: 'ar', name: 'Arijit Singh', initials: 'AR' },
  { id: 'sm', name: 'Shreya Ghoshal', initials: 'SM' },
  { id: 'ts', name: 'Taylor Swift', initials: 'TS' },
  { id: 'wr', name: 'Weeknd', initials: 'WR' },
  { id: 'lg', name: 'Lady Gaga', initials: 'LG' },
  { id: 'db', name: 'Diljit Dosanjh', initials: 'DB' },
  { id: 'be', name: 'Billie Eilish', initials: 'BE' },
  { id: 'pr', name: 'A.R. Rahman', initials: 'PR' },
];

export default function FavoriteArtistsStep({ onNext = () => {}, onSkip = () => {} }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const MIN_SELECTIONS = 3;

  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredArtists = useMemo(() => {
    return INITIAL_ARTISTS.filter(a => 
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const remainingNeeded = Math.max(0, MIN_SELECTIONS - selectedIds.length);
  const isValid = remainingNeeded === 0;

  return (
    <div className="min-h-screen bg-[#0a1f14] flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl bg-[#0d2818] rounded-2xl p-6 md:p-10 shadow-2xl border border-[#163325]">
        
        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          <div className="h-1 flex-1 rounded-full bg-[#f43f8e]"></div>
          <div className="h-1 flex-1 rounded-full bg-[#f43f8e]"></div>
          <div className="h-1 flex-1 rounded-full bg-[#1a3828]"></div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <p className="text-[#00ff88] text-xs font-bold tracking-widest uppercase mb-3">
            Step 2 of 3
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-[#f4f4f0] mb-3">
            Pick your favorite artists
          </h1>
          <p className="text-[#9ca3a3] text-lg">
            We'll use this to tailor your viral score benchmarks and recommendations.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-10">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3a3]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Search artists..." 
            className="w-full bg-[#112d20] border border-[#1a3828] rounded-xl py-3.5 pl-12 pr-4 text-[#f4f4f0] placeholder-[#9ca3a3] focus:outline-none focus:border-[#f43f8e] focus:ring-1 focus:ring-[#f43f8e] transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3a3] hover:text-[#f4f4f0]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        {/* Artist Grid */}
        <div className="grid grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-10 mb-10 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
          {filteredArtists.length > 0 ? (
            filteredArtists.map(artist => {
              const isSelected = selectedIds.includes(artist.id);
              return (
                <button 
                  key={artist.id}
                  onClick={() => toggleSelection(artist.id)}
                  className="flex flex-col items-center gap-4 group focus:outline-none"
                >
                  <div className={`
                    relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-200
                    ${isSelected 
                      ? 'bg-[#1a3828] text-[#f4f4f0] ring-2 ring-[#f43f8e] ring-offset-4 ring-offset-[#0d2818]' 
                      : 'bg-[#112d20] text-[#9ca3a3] group-hover:bg-[#1a3828] hover:ring-2 hover:ring-[#1a3828] hover:ring-offset-4 hover:ring-offset-[#0d2818]'}
                  `}>
                    {artist.initials}
                    
                    {/* Checkmark Badge */}
                    <div className={`
                      absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-[#0d2818] transition-transform duration-200
                      ${isSelected ? 'bg-[#f43f8e] text-white scale-100' : 'bg-transparent scale-0'}
                    `}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  </div>
                  <span className={`text-sm md:text-base font-medium truncate w-full text-center ${isSelected ? 'text-[#f4f4f0]' : 'text-[#9ca3a3]'}`}>
                    {artist.name}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="col-span-full py-8 text-center flex flex-col items-center">
              <p className="text-[#9ca3a3] text-lg mb-3">No artists found for "{searchQuery}"</p>
              <button 
                onClick={() => setSearchQuery('')} 
                className="text-[#f43f8e] hover:text-[#f4f4f0] font-medium transition-colors"
              >
                Clear search
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-8 border-t border-[#1a3828]">
          <button 
            onClick={onSkip} 
            className="text-[#9ca3a3] font-medium hover:text-[#f4f4f0] transition-colors focus:outline-none focus:underline"
          >
            Skip for now
          </button>
          
          <div className="flex items-center gap-4">
            {!isValid && (
              <span className="text-sm font-medium text-[#f43f8e] animate-pulse">
                Pick {remainingNeeded} more
              </span>
            )}
            <button 
              onClick={isValid ? onNext : undefined}
              disabled={!isValid}
              className={`
                px-8 py-3.5 rounded-lg font-bold flex items-center gap-2 transition-all duration-300
                ${isValid 
                  ? 'bg-gradient-to-r from-[#f43f8e] to-[#8b5cf6] text-white shadow-[0_0_20px_rgba(244,63,142,0.4)] hover:scale-105 cursor-pointer' 
                  : 'bg-[#1a3828] text-[#9ca3a3] cursor-not-allowed opacity-50'}
              `}
            >
              Continue
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
