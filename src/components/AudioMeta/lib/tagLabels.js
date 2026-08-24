const TAG_LABELS = {
  TIT2: 'Title', TIT3: 'Subtitle', TPE1: 'Artist', TPE2: 'Album Artist',
  TALB: 'Album', TDRC: 'Year', TCON: 'Genre', TRCK: 'Track Number',
  TPOS: 'Disc Number', TCOM: 'Composer', COMM: 'Comment', TSSE: 'Encoder',
  TCOP: 'Copyright', USLT: 'Lyrics', TSRC: 'ISRC',
  TBPM: 'BPM', TKEY: 'Initial Key', TLAN: 'Language', TMED: 'Media Type',
  TOAL: 'Original Album', TOPE: 'Original Artist', TOFN: 'Original Filename',
  TPUB: 'Publisher', TOWN: 'File Owner', TRSN: 'Radio Station',
  WCOM: 'Commercial URL', WCOP: 'Copyright URL', WOAS: 'Source URL',
  VC_TITLE: 'Title (Vorbis)', VC_ARTIST: 'Artist (Vorbis)',
};

function getTagLabel(key) {
  return TAG_LABELS[key] || (key.startsWith('VC_') ? key.slice(3) : key);
}


export { TAG_LABELS, getTagLabel };
