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
      [15, 127.51], [16, 132.76], [17, 138.49], [18, 143.01], [19, 150.71], [12, 156.33], [13, 160.33], [14, 166.99],
      [9, 176.42], [8, 220.13], [9, 225.81], [10, 230.83], [11, 236.45], [8, 241.41], [14, 255.99], [14, 266.69]],
  },
  {
    // 总有人适合 (Live版), 范茹. Only LRCLIB has the words for this version (untimed): timed to the
    // live audio. A stretch around 45-65 s is hard to hear; those lines are spread by length.
    title: '总有人适合', artists: ['fanru'], duration: 252, lrclibId: 23711880, lines: 61,
    sung: [[0, 0], [1, 4.91], [2, 23.71], [3, 31.09], [4, 35.25], [5, 38.69], [6, 45.04], [7, 50.82],
      [8, 55.44], [9, 59.46], [10, 63.07], [11, 67.49], [12, 69.45], [13, 74.31], [14, 78.06], [15, 79.87],
      [16, 80.91], [17, 82.05], [18, 84.93], [19, 89.79], [20, 93.39], [21, 95.2], [22, 96.34], [23, 97.47],
      [24, 99.25], [25, 116.71], [26, 123.79], [27, 128.13], [28, 132.37], [29, 139.55], [30, 143.59], [31, 147.87],
      [32, 151.55], [33, 155.55], [34, 159.53], [35, 162.33], [36, 167.21], [37, 170.11], [38, 172.97], [39, 173.73],
      [40, 174.85], [41, 178.31], [42, 182.69], [43, 186.31], [44, 188.37], [45, 189.25], [46, 190.33], [47, 192.19],
      [48, 197.47], [49, 202.07], [50, 204.99], [51, 207.89], [52, 208.73], [53, 209.77], [54, 212.73], [55, 217.51],
      [56, 221.11], [57, 223.19], [58, 224.09], [59, 225.19], [60, 227.05]],
  },
  {
    // 占有欲和爱的能力 (Live), 愚青. Words from the 257 s studio version; the live take sings both
    // verses and choruses twice and drops the rest.
    title: '占有欲和爱的能力', artists: ['yuqing'], duration: 236, neteaseId: 864433440, lines: 39,
    sung: [[0, 34.17], [1, 41.75], [2, 49.19], [3, 55.85], [4, 63.45], [5, 66.91], [6, 70.07], [7, 74.61],
      [8, 77.97], [9, 81.35], [10, 85.35], [11, 88.75], [12, 92.45], [13, 95.99], [14, 102.75], [15, 107.19],
      [0, 130.33], [1, 135.81], [2, 145.09], [3, 151.73], [4, 159.25], [5, 162.63], [6, 165.81], [7, 170.35],
      [8, 175.65], [9, 178.97], [10, 182.99], [11, 186.49], [12, 190.15], [13, 193.69], [14, 200.35], [15, 204.47]],
  },
];
