# Pawn Review

A lightweight chess-board and PGN-review interface that runs Stockfish locally in the browser. There is no API key and no server of its own: the engine and the opening book run locally. Only the optional Chess.com/Lichess imports and the CDN-hosted `chess.js` and piece images contact third parties.

## Run it

From this directory:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

The public version is available from the portfolio site at
`https://dikeshmanandhar.com.np/projects/chess-game-review/`.

## How it works

- The board and legal move/PGN handling use `chess.js`.
- A Stockfish 19 Lite single-threaded Web Worker receives standard UCI messages (`position fen`, `go depth`) and returns evaluation and a principal variation.
- The live evaluation bar sits immediately to the right of the board and always matches the board's full height; the numeric evaluation and explanation remain in the review panel.
- PGN review produces one structured object per ply at `window.gameReview`, including the played UCI/SAN move, Stockfish's recommended move, pawn loss, evaluation, and a win-probability-based label. Position evaluations are cached so adjacent plies share searches (review searches use depth 12 with MultiPV 2).
- Labels, all defined in `review-logic.js` (thresholds are constants at the top of that file): `Brilliant`, `Great`, `Book`, `Best`, `Excellent`, `Good`, `Okay`, `Inaccuracy`, `Mistake`, `Miss`, `Blunder`.
  - `Best` is Stockfish's first choice; every other move is graded by how much win probability it gave up.
  - `Great` is the engine's best move when the second-best move is at least 35 win-probability points worse (a genuinely forced "only move"), in a position that was neither lost nor already crushing. Other engine-first moves remain `Best`.
  - `Brilliant` is a near-best move that is still down at least 2 points of material after the engine's next few moves (a real sacrifice), from a position that was not already winning, and that does not leave you worse.
  - `Miss` is a move that throws away a winning position right after the opponent erred, or overlooks a meaningful best-line capture. Capture misses are checked before `Blunder`.
  - `Great` excludes straightforward pawn captures/recaptures; those are labeled `Best` when they are the engine's first choice.
  - `Blunder` is reserved for moves losing at least 0.30 win-probability points; smaller errors are classified as `Inaccuracy`, `Mistake`, or `Miss`.
  - `Book` marks moves that follow known opening theory from move one (see below).
- The game summary card in the review panel shows each side's accuracy and how many moves of each label they made. Click a count to filter the move list to those moves and jump to the first one; click again for the next. Accuracy uses a stricter Lichess-style formula (per-move accuracy from win-probability lost, then a volatility-weighted and harmonic mean); even an engine-first move is scored from the resulting position rather than receiving an unconditional 100, so it will not match Chess.com's numbers exactly.
- Chess.com import uses the public archive endpoints: it fetches a username's newest monthly archive and lets the player choose a game. Chess.com clock annotations are retained and shown as the time remaining after each move. No Chess.com credentials are collected.
- Lichess import uses the public user game export endpoint and lets the player choose one of the latest games. No Lichess credentials are collected.
- Imported Chess.com and Lichess games show the White and Black player names in the player bars around the board. 
- The opening book is bundled in `data/opening-book.json` (about 8,000 positions, 3,300 opening names) and is built from the public-domain [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) data (CC0). Moves are marked `Book` automatically during review while the game follows theory, and the badge and move panel show the ECO code and opening name. Full-game review skips redundant engine searches while the game remains in book, then resumes Stockfish analysis at the first non-book move. The "Check opening book" button lists the book moves from the current position. No network request is made for the book.
- To grow the book, run `python3 tools/build_book.py --extra-pgn games.pgn --min-count 5 --max-ply 20` (needs `pip install chess`). Any position reached in at least `--min-count` games of that PGN within `--max-ply` plies is added. A masters or high-rated PGN works best.
