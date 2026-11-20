# Tesla Lyrics

A single web page for the Tesla browser that shows what's playing on Spotify, with synced lyrics that scroll and highlight in time. Lyrics are fetched live from [LRCLIB](https://lrclib.net); none are stored here.

## Setup (one time)

### 1. Host it on GitHub Pages
Spotify login needs a real https address.

1. In this repo, go to **Settings → Pages**.
2. Under **Build and deployment**, set Source to **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
3. After a minute the page is live at `https://alsonlim01.github.io/tesla-lyrics/`.

### 2. Create a Spotify developer app
1. Go to <https://developer.spotify.com/dashboard> and click **Create app**.
2. Add this Redirect URI exactly: `https://alsonlim01.github.io/tesla-lyrics/`
3. Tick **Web API** and save.
4. Copy the app's **Client ID**. No client secret is needed (the page uses PKCE).
5. While the app is in development mode, add your Spotify account email under **User Management**.

### 3. Use it in the car
1. Open `https://alsonlim01.github.io/tesla-lyrics/` in the Tesla browser.
2. Tap **Connect Spotify**, log in to Spotify and tap **Agree** (the Client ID is built in; use "Use a different Spotify app" or `?id=<client id>` for your own).
3. Play something on Spotify. The page picks it up automatically.

## Controls
- Tap a lyric line to jump the song to that point.
- **A− / A+**: text size. **±0.5s**: fix lyrics that run early or late. Both are remembered.
- Scrolling manually pauses auto-scroll; **⤓** resumes it.
- Previous / play-pause / next buttons control Spotify playback (needs Spotify Premium).
- Add `?demo` to the address to preview the screen without logging in.
