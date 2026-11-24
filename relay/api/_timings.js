// Exact line timings for specific Live recordings whose only lyrics come from a different recording.
// Only numbers live here: the words still come from NetEase at request time (song `neteaseId`, whose
// lyrics must still have `lines` lines, or the entry is ignored).
//
// sung: [line number in that NetEase lyric, start time in seconds on the Spotify recording]. A line
// can appear more than once (live versions repeat choruses).
//
// To add a song: transcribe the recording with faster-whisper (word timestamps), save the relay's
// answer for the NetEase lyrics, then run tools/align.mjs (DIAG=1 shows how well each line was heard).
export const TIMINGS = [
  {
    // 占有 (Live), Zhou Shen & Joker Xue. NetEase's own times fit this recording (checked against
    // the audio: within ~0.3 s on every line heard); only its length differs (it trims the ending).
    title: '占有', artists: ['zhoushen', 'jokerxue'], duration: 251, neteaseId: 3335225812, lines: 24,
    sung: [[0, 16.64], [1, 24.65], [2, 32.64], [3, 40.71], [4, 50.54], [5, 58.79], [6, 66.61], [7, 74.49],
      [8, 98.76], [9, 106.46], [10, 114.41], [11, 119.44], [12, 136.89], [13, 144.6], [14, 152.55], [15, 160.44],
      [16, 168.14], [17, 175.12], [18, 179.45], [19, 182.23], [20, 188.63], [21, 196.64], [22, 204.66], [23, 212.55]],
  },
  {
    // 一路生花 (Live), Angela Chang & Zhou Shen: a TV-show cover. Words from a studio upload, timed to
    // the live audio with tools/align.mjs (the live take repeats and reorders choruses).
    title: '一路生花', artists: ['angelachang', 'zhoushen'], duration: 304, neteaseId: 3393922958, lines: 33,
    sung: [[0, 15.45], [1, 19.99], [2, 26.19], [3, 31.03], [4, 36.81], [5, 41.71], [6, 47.75], [7, 52.37],
      [8, 60.17], [9, 65.21], [10, 70.75], [11, 76.39], [8, 81.39], [12, 87.07], [13, 92.13], [14, 97.67],
      [15, 127.51], [17, 138.49], [18, 143.01], [19, 150.71], [12, 156.33], [13, 160.33], [14, 166.99],
      [9, 176.42], [8, 220.13], [9, 225.81], [10, 230.83], [11, 236.45], [8, 241.41], [14, 255.99], [14, 266.69]],
  },
];
