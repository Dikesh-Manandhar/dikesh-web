// review-logic.js — the review rules, kept free of any DOM code so they can be tested on their own.
// Evaluations are in pawns from WHITE's point of view (positive = White is better), as app.js stores them.

// Win-probability points lost. The larger blunder threshold deliberately reserves that label
// for decisive errors; smaller errors remain distinguishable instead of being overclassified.
export const CUT = { excellent:.03, good:.045, okay:.06, inaccuracy:.09, mistake:.30 };
export const MISS = { opponentLost:.10, winningAt:.70, captureMin:.06 };
// Brilliant = a near-best move that gives up material (kept for ≥ 2 pawns of value after the engine line) without being
// winning already or losing afterwards.
export const BRILLIANT = { maxBefore:.85, minAfter:.50, plies:4, minSacrifice:2 };
// Great = a genuinely forced engine-first move in a critical position. A larger gap means
// ordinary best moves stay Best instead of being promoted to Great.
export const GREAT = { gap:.35, minBest:.40, maxBest:.90 };   // maxBest: if the position is already crushing, many moves win

export const LABEL_ORDER = ['Brilliant','Great','Book','Best','Excellent','Good','Okay','Inaccuracy','Mistake','Miss','Blunder'];

export function winProbability(value, color) {
  const white = 1 / (1 + Math.pow(10, -value / 4));
  return color === 'w' ? white : 1 - white;
}
export function pointsLost(record) {
  // The engine's own first choice is never counted as a loss; at a fixed depth the two searches can disagree in sharp
  // tactical lines and would otherwise make a best move look like a blunder.
  if (record.bestMoveUci && record.bestMoveUci === record.uci) return 0;
  return Math.max(0, winProbability(record.evalBefore, record.color) - winProbability(record.evalAfter, record.color));
}
export function isMiss(record, previous) {
  const opponentMissed = !!previous && previous.lossPawns != null
    && pointsLost(previous) >= MISS.opponentLost
    && winProbability(record.evalBefore, record.color) >= MISS.winningAt
    && winProbability(record.evalAfter, record.color) < MISS.winningAt;
  const missedCapture = record.bestMoveSan?.includes('x')
    && !record.san?.includes('x')
    && pointsLost(record) >= MISS.captureMin;
  return opponentMissed || missedCapture;
}

export function labelFor(record, previous) {
  if (record.book) return 'Book';
  if (record.lossPawns == null) return 'Pending';
  if (record.brilliant) return 'Brilliant';
  if (record.great) return 'Great';
  if (record.bestMoveUci === record.uci) return 'Best';
  const lost = pointsLost(record);
  if (lost < CUT.excellent) return 'Excellent';
  if (lost < CUT.good) return 'Good';
  if (lost < CUT.okay) return 'Okay';
  if (isMiss(record, previous)) return 'Miss';
  if (lost >= CUT.mistake) return 'Blunder';
  return lost < CUT.inaccuracy ? 'Inaccuracy' : 'Mistake';
}
export const labelClass = (label) => label.toLowerCase().replace(' ', '');

// ---------------------------------------------------------------------------------------------
// Brilliant / Great
// ---------------------------------------------------------------------------------------------
const VALUE = { p:1, n:3, b:3, r:5, q:9 };
function balance(chess, color) {
  let total = 0;
  for (const row of chess.board()) for (const square of row) {
    if (square && square.type !== 'k') total += (square.color === color ? 1 : -1) * VALUE[square.type];
  }
  return total;
}
// Play the move, then the engine's own continuation (ending on the mover's move so a recapture is counted),
// and see whether the mover is still down material.
export function isSacrifice(record, Chess) {
  const pv = (record.afterPv || '').split(' ').filter(Boolean);
  let count = Math.min(pv.length, BRILLIANT.plies);
  if (count % 2 === 1) count -= 1;
  if (count < 2) return false;
  try {
    const base = balance(new Chess(record.fenBefore), record.color);
    const line = new Chess(record.fenAfter);
    for (let i = 0; i < count; i++) line.move({ from:pv[i].slice(0, 2), to:pv[i].slice(2, 4), promotion:pv[i][4] });
    return balance(line, record.color) - base <= -BRILLIANT.minSacrifice;
  } catch (_) { return false; }
}
export function isBrilliant(record, Chess) {
  if (record.lossPawns == null || record.book) return false;
  return pointsLost(record) < CUT.excellent
    && winProbability(record.evalBefore, record.color) < BRILLIANT.maxBefore
    && winProbability(record.evalAfter, record.color) >= BRILLIANT.minAfter
    && isSacrifice(record, Chess);
}
export function isGreat(record) {
  if (record.lossPawns == null || record.book || record.secondValue == null) return false;
  if (record.bestMoveUci !== record.uci || record.san.endsWith('#')) return false;
  // A straightforward pawn capture/recapture is easier to spot than a genuinely
  // forced critical move, so keep it as Best.
  if (/^[a-h]x/.test(record.san) && /^[a-h]x/.test(record.bestMoveSan || '')) return false;
  const best = winProbability(record.evalBefore, record.color);
  const second = winProbability(record.secondValue, record.color);
  return best >= GREAT.minBest && best <= GREAT.maxBest && best - second >= GREAT.gap;
}

// ---------------------------------------------------------------------------------------------
// Opening book (data/opening-book.json, built by tools/build_book.py)
// ---------------------------------------------------------------------------------------------
export const bookKey = (fen) => fen.split(' ').slice(0, 3).join(' ');

// A move is "book" while the game follows known theory from move 1; after the first non-book move it stops.
export function markBook(reviews, book) {
  let inBook = !!book, name = '', eco = '';
  for (const record of reviews) {
    record.book = false;
    record.openingName = name;
    record.eco = eco;
    if (!inBook) continue;
    const index = book.positions[bookKey(record.fenAfter)];
    if (index === undefined) { inBook = false; continue; }
    record.book = true;
    if (index >= 0) { [eco, name] = book.openings[index]; }
    record.openingName = name;
    record.eco = eco;
  }
}
export function bookMovesFrom(fen, Chess, book) {
  if (!book) return [];
  const position = new Chess(fen);
  return position.moves({ verbose:true }).filter((move) => {
    const next = new Chess(fen); next.move(move);
    return book.positions[bookKey(next.fen())] !== undefined;
  }).map((move) => move.san);
}
export function openingAt(fen, book) {
  const index = book?.positions[bookKey(fen)];
  return index >= 0 ? { eco:book.openings[index][0], name:book.openings[index][1] } : null;
}

// ---------------------------------------------------------------------------------------------
// Accuracy (Lichess-style: per-move accuracy from win% lost, then a volatility-weighted + harmonic mean)
// ---------------------------------------------------------------------------------------------
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const lichessWin = (pawns) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamp(pawns * 100, -1000, 1000))) - 1);
const moveAccuracy = (before, after) => clamp(103.1668 * Math.exp(-0.052 * Math.max(0, before - after)) - 3.1669 + 1, 0, 100);
const stdev = (xs) => { const mean = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length); };

export function gameAccuracy(reviews) {
  if (reviews.length < 2 || reviews.some((r) => r.evalAfter == null)) return null;
  const wins = [lichessWin(0.15), ...reviews.map((r) => lichessWin(r.evalAfter))];   // White's win% after each ply
  const size = clamp(Math.floor(reviews.length / 10), 2, 8);
  const windows = [];
  for (let i = 0; i < Math.min(size, wins.length) - 2; i++) windows.push(wins.slice(0, size));
  for (let i = 0; i + size <= wins.length; i++) windows.push(wins.slice(i, i + size));
  const weights = windows.map((w) => clamp(stdev(w), 0.5, 12));
  const result = {};
  for (const color of ['w', 'b']) {
    const accuracies = [], weighted = [];
    reviews.forEach((record, i) => {
      if (record.color !== color) return;
      const before = color === 'w' ? wins[i] : 100 - wins[i], after = color === 'w' ? wins[i + 1] : 100 - wins[i + 1];
      // Do not give engine-first moves an unconditional 100: a shallow search can call a
      // move "best" while its resulting position is still slightly worse.
      const accuracy = moveAccuracy(before, after);
      accuracies.push(accuracy);
      weighted.push([accuracy, weights[i] ?? 1]);
    });
    if (!accuracies.length) { result[color] = null; continue; }
    const weightedMean = weighted.reduce((s, [a, w]) => s + a * w, 0) / weighted.reduce((s, [, w]) => s + w, 0);
    const harmonic = accuracies.length / accuracies.reduce((s, a) => s + 1 / Math.max(a, 0.01), 0);
    result[color] = (weightedMean + harmonic) / 2;
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Summary table: how many moves of each label each player made, plus accuracy.
// ---------------------------------------------------------------------------------------------
export function summarize(reviews) {
  const counts = { w:{}, b:{} };
  for (const label of LABEL_ORDER) { counts.w[label] = 0; counts.b[label] = 0; }
  reviews.forEach((record, index) => {
    const label = labelFor(record, reviews[index - 1]);
    if (counts[record.color][label] !== undefined) counts[record.color][label]++;
  });
  return { counts, accuracy:gameAccuracy(reviews) };
}
