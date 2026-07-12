import React, { useState, useMemo } from 'react';
import './FavoriteArtistsStep.css';

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
    <div className="favorite-artists-wrapper">
      <div className="favorite-artists-container">
        
        {/* Progress Bar */}
        <div className="progress-bar">
          <div className="progress-segment completed"></div>
          <div className="progress-segment completed"></div>
          <div className="progress-segment"></div>
        </div>

        {/* Header */}
        <div className="step-header">
          <p className="step-label">
            Step 2 of 3
          </p>
          <h1 className="step-title">
            Pick your favorite artists
          </h1>
          <p className="step-description">
            We'll use this to tailor your viral score benchmarks and recommendations.
          </p>
        </div>

        {/* Search Input */}
        <div className="search-container">
          <div className="search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Search artists..." 
            className="search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="clear-search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        {/* Artist Grid */}
        <div className="artist-grid">
          {filteredArtists.length > 0 ? (
            filteredArtists.map(artist => {
              const isSelected = selectedIds.includes(artist.id);
              return (
                <button 
                  key={artist.id}
                  onClick={() => toggleSelection(artist.id)}
                  className={`artist-card ${isSelected ? 'selected' : ''}`}
                >
                  <div className="artist-avatar">
                    {artist.initials}
                    
                    {/* Checkmark Badge */}
                    <div className="checkmark-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  </div>
                  <span className="artist-name">
                    {artist.name}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="no-artists-found">
              <p>No artists found for "{searchQuery}"</p>
              <button 
                onClick={() => setSearchQuery('')} 
                className="clear-search-btn"
              >
                Clear search
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="step-footer">
          <button 
            onClick={onSkip} 
            className="skip-button"
          >
            Skip for now
          </button>
          
          <div className="footer-actions">
            {!isValid && (
              <span className="remaining-needed">
                Pick {remainingNeeded} more
              </span>
            )}
            <button 
              onClick={isValid ? onNext : undefined}
              disabled={!isValid}
              className={`continue-button ${isValid ? 'active' : ''}`}
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
