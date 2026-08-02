# Site fonts

Kungfu uses a deliberately small, self-hosted type system:

- Instrument Sans for display headings and the wordmark. The bundled Latin
  WOFF2 is the normal-width variable font covering weights 400 through 700.
- IBM Plex Mono for commands, protocol labels, and evidence-oriented text. The
  bundled Latin WOFF2 files cover weights 400, 600, and 700.
- The platform UI stack remains the body and navigation font for fast,
  familiar reading.

The WOFF2 files are unmodified Google Fonts web subsets. Each filename includes
the first eight characters of its SHA-256 digest so a future font update cannot
reuse a stale asset URL. Their upstream projects are:

- https://github.com/Instrument/instrument-sans
- https://github.com/IBM/plex

Both families are distributed under the SIL Open Font License 1.1. The exact
license texts are included beside the font files as `OFL-Instrument-Sans.txt`
and `OFL-IBM-Plex-Mono.txt`.
