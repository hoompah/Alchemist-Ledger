Alchemist's Ledger - site folder

Upload EVERYTHING in this folder to the root of the GitHub Pages site,
keeping the names and the icons/ folder as they are:

  index.html              the Ledger itself (same file as deck-dashboard.html)
  manifest.webmanifest    tells phones and browsers this is an installable app
  sw.js                   keeps a copy on the device: instant opening, offline use
  icons/                  home-screen icons

The page must be named index.html. If the Ledger currently lives under
another name, keep that file too (or replace it with a copy of index.html)
so old links still work.

sw.js does not change between builds. For a new build, replace index.html
only; people get a "new version is ready - Reload" bar the next time they
open the Ledger.
