export function formatTrackName(filename) {
  if (!filename) return 'Unknown Track';
  
  // Remove extensions (.mp3, .mp4, .wav, etc)
  let cleanName = filename.replace(/\.[^/.]+$/, "");
  
  // Replace hyphens and underscores with spaces
  cleanName = cleanName.replace(/[-_]/g, " ");
  
  // Truncate to 25 characters
  if (cleanName.length > 25) {
    cleanName = cleanName.substring(0, 22) + "...";
  }
  
  return cleanName;
}
