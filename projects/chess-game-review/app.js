import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { playSound, setSoundEnabled, isSoundEnabled } from './sounds.js';
import { winProbability, labelFor, labelClass, isBrilliant, isGreat, markBook, bookMovesFrom, openingAt, summarize, LABEL_ORDER } from './review-logic.js';

const symbols = { w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'}, b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'} };
const boardEl = document.querySelector('#board');
const chess = new Chess();
const $ = (s) => document.querySelector(s);
let orientation = 'w', selected = null, engineReady = false, engine, history = [], historyIndex = 0;
let reviews = [], currentAnalysis = null, activeSearch = null, searchQueue = [], gameName = '', playerNames = {w:'',b:''}, autoAnalysisTimer = null, lastMove = null, manualRedoStack = [], showBestArrow = true, savedReviewContext = null, reviewAnalysisRunning = false, pendingReviewAnalysis = false;
const searchCache = new Map();
let reviewFilter = null;

// Offline opening book: ~8,000 positions from the public-domain lichess-org/chess-openings data (see tools/build_book.py).
let bookData = null;
const bookReady = fetch('./data/opening-book.json').then((response) => response.ok ? response.json() : null).then((data) => { bookData = data; }).catch(() => {});
const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

function soundKind(move) {
  if (chess.isCheckmate()) return 'mate';
  if (chess.isStalemate() || chess.isInsufficientMaterial()) return 'draw';
  if (chess.inCheck()) return 'check';
  if (move.promotion) return 'promote';
  if (/[kq]/.test(move.flags)) return 'castle';
  if (move.captured) return 'capture';
  return 'move';
}
const playMoveSound = (move, opponent = false) => playSound(opponent && soundKind(move) === 'move' ? 'opponentMove' : soundKind(move));

const THUMB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>';
const BOOK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17ZM4 4.5v15A2.5 2.5 0 0 1 6.5 17H20M8 6h8M8 9h8"/></svg>';
const BADGE_ICON = { Brilliant:'!!', Great:'!', Best:'★', Excellent:THUMB, Good:'✓', Okay:'ok', Inaccuracy:'?!', Mistake:'?', Miss:'✕', Blunder:'??', Book:BOOK_ICON };
function badgeFor(square) {
  const record = history.length ? reviews[historyIndex-1] : null;
  if (!record || lastMove?.to !== square) return '';
  const label = labelFor(record, reviews[historyIndex-2]);
  const icon = BADGE_ICON[label];
  return icon ? `<span class="badge ${labelClass(label)}" title="${label}">${icon}</span>` : '';
}

function squarePoint(square) {
  const file = square.charCodeAt(0) - 97, rank = Number(square[1]) - 1;
  return [(orientation === 'w' ? file : 7-file) * 100 + 50, (orientation === 'w' ? 7-rank : rank) * 100 + 50];
}
function currentHint() { return reviews[historyIndex]?.bestMoveUci || currentAnalysis?.bestMoveUci; }
function addBestArrow(uci) {
  if (!uci || uci.length < 4) return;
  const [x1,y1] = squarePoint(uci.slice(0,2)), [x2,y2] = squarePoint(uci.slice(2,4));
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','best-arrow'); svg.setAttribute('viewBox','0 0 800 800');
  svg.innerHTML = `<defs><marker id="arrowhead" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L0,5 L5,2.5 z" fill="#e45f38"/></marker></defs><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e45f38" stroke-width="15" stroke-linecap="round" opacity=".88" marker-end="url(#arrowhead)"/>`;
  boardEl.append(svg);
}
function updateGameClocks() {
  const clocks=$('#gameClocks');
  const latest={w:null,b:null};
  reviews.slice(0,historyIndex).forEach((record) => {
    if (record.remainingTime) latest[record.color]=record.remainingTime;
  });
  const counts={w:{p:0,n:0,b:0,r:0,q:0},b:{p:0,n:0,b:0,r:0,q:0}};
  chess.board().flat().forEach((piece) => { if (piece && piece.type !== 'k') counts[piece.color][piece.type]++; });
  const values={p:1,n:3,b:3,r:5,q:9}, material={w:0,b:0};
  for (const color of ['w','b']) for (const type of Object.keys(values)) material[color]+=counts[color][type]*values[type];
  const capturedFor={w:[],b:[]};
  chess.history({verbose:true}).forEach((move) => {
    if (move.captured) {
      const capturedColor=move.color === 'w' ? 'b' : 'w';
      capturedFor[move.color].push(symbols[capturedColor][move.captured]);
    }
  });
  const advantage=Math.max(0,material.w-material.b), hasInfo=history.length > 0 || chess.history().length > 0;
  clocks.hidden=!hasInfo;
  $('#whiteClockBar').hidden=!hasInfo;
  $('#whitePlayerName').textContent=playerNames.w || 'White';
  $('#blackPlayerName').textContent=playerNames.b || 'Black';
  $('#whiteClock').textContent=latest.w || '--:--';
  $('#blackClock').textContent=latest.b || '--:--';
  const whiteCaptured=capturedFor.w.join(''), blackCaptured=capturedFor.b.join('');
  $('#whiteCaptured').textContent=whiteCaptured;
  $('#blackCaptured').textContent=blackCaptured;
  $('#whiteCaptured').hidden=!whiteCaptured;
  $('#blackCaptured').hidden=!blackCaptured;
  const whiteAdvantage=Math.max(0,material.w-material.b), blackAdvantage=Math.max(0,material.b-material.w);
  $('#whiteAdvantage').textContent=whiteAdvantage ? `+${whiteAdvantage}` : '';
  $('#blackAdvantage').textContent=blackAdvantage ? `+${blackAdvantage}` : '';
  $('#whiteAdvantage').hidden=!whiteAdvantage;
  $('#blackAdvantage').hidden=!blackAdvantage;
}
function drawBoard() {
  boardEl.innerHTML = '';
  const flipped = orientation === 'b';
  boardEl.closest('.board-area').classList.toggle('flipped', flipped);
  boardEl.parentElement.classList.toggle('flipped', flipped);
  const files = orientation === 'w' ? 'abcdefgh' : 'hgfedcba', ranks = orientation === 'w' ? '87654321' : '12345678';
  const moves = selected ? chess.moves({ square:selected, verbose:true }).map(m => m.to) : [];
  for (let ri=0; ri<8; ri++) for (let fi=0; fi<8; fi++) {
    const sq = files[fi] + ranks[ri], piece = chess.get(sq), button = document.createElement('button');
    button.className = `square ${(fi+ri)%2 ? 'dark':'light'} ${selected===sq?'selected':''} ${moves.includes(sq)?'target':''} ${lastMove?.from===sq || lastMove?.to===sq ? 'last-move':''}`;
    if (fi===0) button.dataset.rank = ranks[ri]; if (ri===7) button.dataset.file = files[fi];
    if (piece) {
      const asset = `https://lichess1.org/assets/piece/cburnett/${piece.color}${piece.type.toUpperCase()}.svg`;
      button.innerHTML = `<img class="piece" src="${asset}" alt="${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}" />`;
    }
    button.insertAdjacentHTML('beforeend', badgeFor(sq));
    button.addEventListener('click', () => handleSquare(sq)); boardEl.append(button);
  }
  if (showBestArrow) addBestArrow(currentHint());
  updateGameClocks();
  $('#positionLabel').textContent = chess.isGameOver() ? (chess.isCheckmate() ? 'Checkmate' : 'Game over') : `${chess.turn()==='w'?'White':'Black'} to move`;
  showMoveInsight();
  updateUndoRedoButtons();
}
function updateUndoRedoButtons() {
  const reviewingGame = history.length > 0;
  $('#undoBtn').disabled = reviewingGame ? historyIndex === 0 : chess.history().length === 0;
  $('#redoBtn').disabled = reviewingGame ? historyIndex >= history.length : manualRedoStack.length === 0;
  $('#prevBtn').disabled = !reviewingGame || historyIndex === 0;
  $('#nextBtn').disabled = !reviewingGame || historyIndex >= history.length;
  $('#resumeReviewBtn').hidden = !savedReviewContext;
}
function handleSquare(square) {
  const piece = chess.get(square);
  if (selected) {
    try {
      const move = chess.move({from:selected,to:square,promotion:'q'});
      if (move) {
        playMoveSound(move);
        const wasReviewing = history.length > 0;
        if (wasReviewing) {
          const position = new Chess();
          for (let i=0;i<historyIndex;i++) position.move(history[i]);
          savedReviewContext = { fen:position.fen(), history:history.map((item)=>({...item})), reviews:reviews.map((item)=>({...item})), historyIndex };
        }
        selected=null; history=[]; reviews=[]; historyIndex=0; manualRedoStack=[]; currentAnalysis=null; lastMove=move; renderReviewList(); drawBoard(); queueAutoAnalysis(); return;
      }
    } catch (_) { playSound('illegal'); }
  }
  selected = piece?.color === chess.turn() ? square : null; drawBoard();
}
function scoreFromLine(raw, sign) {
  const mate = raw.match(/score mate (-?\d+)/);
  if (mate) {
    const n = Number(mate[1]) * sign;
    return { value:n > 0 ? 100 : -100, display:`#${Math.abs(n)}`, note:n > 0 ? ' White mates' : ' Black mates' };
  }
  const cp = raw.match(/score cp (-?\d+)/), value = cp ? sign * Number(cp[1])/100 : 0;
  return { value, display:`${value >= 0 ? '+' : ''}${value.toFixed(2)}`, note:Math.abs(value)<.35?' Equal':value>0?' White is better':' Black is better' };
}
function uciToSan(fen, pv = '') {
  const line = new Chess(fen), san = [];
  for (const uci of pv.split(' ').slice(0,10)) { try { const move=line.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]}); if (!move) break; san.push(move.san); } catch (_) { break; } }
  return san.join(' ');
}
function updateEvaluation(result) {
  const height = `${Math.max(4,Math.min(96,50+result.value*7))}%`;
  $('#evaluation').textContent=result.display;
  $('#evaluationNote').textContent=result.note;
  $('#evalFill').style.height=height;
  $('#evalRailScore').textContent=result.display;
}
function terminalScore(fen) {
  const position = new Chess(fen);
  if (position.isCheckmate()) {
    const whiteWon = position.turn() === 'b';
    return { value:whiteWon ? 100 : -100, display:'#0', note:whiteWon ? ' White mates' : ' Black mates', pv:'', bestMoveUci:'' };
  }
  if (position.isStalemate() || position.isInsufficientMaterial()) return { value:0, display:'+0.00', note:' Equal', pv:'', bestMoveUci:'' };
  return null;
}
function pumpSearchQueue() {
  if (activeSearch || !searchQueue.length || !engineReady) return;
  const request = searchQueue.shift();
  activeSearch = { ...request, latest:null, second:null, sign:request.fen.split(' ')[1] === 'w' ? 1 : -1 };
  engine.postMessage(`setoption name MultiPV value ${request.multipv || 1}`);
  engine.postMessage(`position fen ${request.fen}`);
  engine.postMessage(`go depth ${request.depth}`);
}
function engineSearch(fen, depth=Number($('#depth').value), interruptible=false, multipv=1) {
  const key = `${fen}|${depth}|${multipv}`;
  const cached = searchCache.get(key);
  if (cached) return Promise.resolve(cached);
  const finished = terminalScore(fen);
  if (finished) { searchCache.set(key, finished); return Promise.resolve(finished); }
  if (!engineReady) return Promise.reject(new Error('Engine is still loading'));
  return new Promise((resolve) => {
    if (!interruptible) {
      searchQueue.filter((request) => request.interruptible).forEach((request) => request.resolve({ stopped:true }));
      searchQueue = searchQueue.filter((request) => !request.interruptible);
    }
    searchQueue.push({ fen, depth, resolve, key, interruptible, multipv });
    if (activeSearch?.interruptible) {
      activeSearch.stopped = true;
      engine.postMessage('stop');
    }
    pumpSearchQueue();
  });
}
function initEngine() {
  try {
    engine = new Worker('./vendor/stockfish/stockfish-19-lite-single.js');
    engine.onmessage = ({data}) => {
      if (typeof data !== 'string') return;
      if (data === 'uciok') engine.postMessage('isready');
      if (data === 'readyok') {
        engineReady=true; $('#engineDot').classList.add('ready'); $('#engineStatus').textContent='Stockfish is ready — live analysis is on.';
        if (pendingReviewAnalysis) analyzeAllPlies(); else queueAutoAnalysis();
      }
      if (data.startsWith('info ') && data.includes(' pv ') && activeSearch && !/ (lowerbound|upperbound) /.test(data)) {
        const pv=data.match(/\bpv (.+)/)?.[1], line=Number(data.match(/\bmultipv (\d+)/)?.[1] || 1);
        if (pv) { const parsed={ ...scoreFromLine(data, activeSearch.sign), pv, bestMoveUci:pv.split(' ')[0] }; if (line === 1) activeSearch.latest=parsed; else if (line === 2) activeSearch.second=parsed; }
      }
      if (data.startsWith('bestmove ') && activeSearch) {
        const search = activeSearch, result = { ...(search.latest || { value:0, display:'+0.00', note:' Equal', pv:'', bestMoveUci:data.split(' ')[1] }), secondValue:search.second ? search.second.value : null };
        activeSearch = null;
        if (search.stopped) {
          search.resolve({ stopped:true });
        } else {
          searchCache.set(search.key, result);
          search.resolve(result);
        }
        pumpSearchQueue();
      }
    };
    engine.onerror=() => { $('#engineStatus').textContent='Engine could not load. Serve this folder from a local web server, then try again.'; };
    engine.postMessage('uci');
  } catch (_) { $('#engineStatus').textContent='Your browser does not support the local engine.'; }
}
async function analyze() {
  try { $('#engineStatus').textContent='Calculating best line…'; const result=await engineSearch(chess.fen()); currentAnalysis=result; updateEvaluation(result); $('#principalVariation').textContent=uciToSan(chess.fen(),result.pv) || result.pv; $('#engineStatus').textContent='Analysis complete.'; drawBoard(); }
  catch(e) { $('#engineStatus').textContent=e.message; }
}
function queueAutoAnalysis() {
  clearTimeout(autoAnalysisTimer);
  autoAnalysisTimer = setTimeout(async () => {
    if (!engineReady || reviewAnalysisRunning) return;
    const fen = chess.fen();
    try {
      $('#engineStatus').textContent='Auto-analyzing position…';
      const result = await engineSearch(fen, Math.min(14, Number($('#depth').value)), true);
      if (result.stopped || chess.fen() !== fen) return;
      currentAnalysis = result; updateEvaluation(result);
      $('#principalVariation').textContent=uciToSan(fen,result.pv) || result.pv;
      $('#engineStatus').textContent='Live analysis updated.'; drawBoard();
    } catch (_) { /* The next position change schedules a fresh analysis. */ }
  }, 180);
}
function setReviewPublicData() { window.gameReview = reviews.map((record,index) => { const {fenBefore,fenAfter,...move}=record; return {...move,label:labelFor(record,reviews[index-1])}; }); }
function showMoveInsight() {
  const record=historyIndex > 0 ? reviews[historyIndex-1] : null, label=record ? labelFor(record,reviews[historyIndex-2]) : 'Position', chip=$('#moveLabel'); chip.textContent=label.toUpperCase(); chip.className=`move-label ${labelClass(label)}`;
  $('#bookMoveIcon').hidden = !record?.book;
  if (!record) { $('#moveInsight').textContent=currentAnalysis?.bestMoveUci ? `Best move: ${uciToSan(chess.fen(),currentAnalysis.bestMoveUci)}` : 'The orange arrow marks Stockfish’s first choice.'; return; }
  const best = record.bestMoveSan || (record.bestMoveUci ? uciToSan(record.fenBefore,record.bestMoveUci) : 'calculating…');
  $('#moveInsight').textContent=record.book ? `Book move: ${record.san}${record.openingName ? ` · ${record.eco} ${record.openingName}` : ''}.` : `Played ${record.san}. Best move: ${best}${record.lossPawns != null ? ` · ${record.lossPawns.toFixed(2)} pawn loss` : ''}.`;
}
function renderReviewList() {
  const list=$('#reviewList'); list.innerHTML=''; $('#reviewSection').hidden = !reviews.length;
  reviews.forEach((record,index) => { const label=labelFor(record,reviews[index-1]), row=document.createElement('li'); row.className=`review-row ${index===historyIndex?'active':''}`; row.innerHTML=`<span class="ply">${Math.floor(index/2)+1}${index%2?'…':'.'}</span><div><strong>${record.san}</strong><small>${record.remainingTime ? `${record.remainingTime} left · ` : ''}best: ${record.bestMoveSan || '—'}${record.lossPawns != null ? ` · ${record.lossPawns.toFixed(2)} pawns` : ''}</small></div><span class="move-label ${labelClass(label)}">${label}</span>`; row.addEventListener('click',()=>rebuildAt(index)); row.hidden = !!reviewFilter && !(record.color === reviewFilter.color && label === reviewFilter.label); list.append(row); });
  updateFilterNote(); renderSummary(); setReviewPublicData();
}
function rebuildAt(index) {
  const previous = historyIndex;
  chess.reset(); for(let i=0;i<index;i++) chess.move(history[i]); historyIndex=index; selected=null; currentAnalysis=null; lastMove=index ? history[index-1] : null; drawBoard(); renderReviewList(); queueAutoAnalysis(); $('#gameStatus').textContent=`Ply ${index+1} of ${history.length}${gameName ? ` · ${gameName}` : ''}`;
  if (index === previous + 1 && history[index-1]) playMoveSound(history[index-1], true);
}
function undoPosition() {
  if (history.length) { rebuildAt(Math.max(0,historyIndex-1)); return; }
  const move=chess.undo();
  if (move) {
    manualRedoStack.push(move); selected=null; currentAnalysis=null; lastMove=chess.history({verbose:true}).at(-1) || null;
    if (savedReviewContext && chess.fen() === savedReviewContext.fen) {
      history=savedReviewContext.history; reviews=savedReviewContext.reviews; historyIndex=savedReviewContext.historyIndex; savedReviewContext=null; manualRedoStack=[];
      renderReviewList();
    }
    drawBoard(); queueAutoAnalysis();
  }
}
function redoPosition() {
  if (history.length) { rebuildAt(Math.min(history.length,historyIndex+1)); return; }
  const move=manualRedoStack.pop();
  if (move) { const redone=chess.move(move); playMoveSound(redone); selected=null; currentAnalysis=null; lastMove=redone; drawBoard(); queueAutoAnalysis(); }
}
function resumeReview() {
  if (!savedReviewContext) return;
  const context=savedReviewContext;
  chess.load(context.fen);
  history=context.history;
  reviews=context.reviews;
  historyIndex=context.historyIndex;
  savedReviewContext=null;
  manualRedoStack=[];
  selected=null;
  currentAnalysis=null;
  lastMove=historyIndex ? history[historyIndex-1] : null;
  renderReviewList();
  drawBoard();
  queueAutoAnalysis();
  $('#gameStatus').textContent=`Resumed review at ply ${historyIndex + 1} of ${history.length}${gameName ? ` · ${gameName}` : ''}.`;
}
function parseMoveClocks(pgn) {
  return [...pgn.matchAll(/\[%clk\s+(\d+):([0-5]\d):([0-5]\d(?:\.\d+)?)\s*\]/g)].map((match) => {
    const hours=Number(match[1]), minutes=Number(match[2]), seconds=Number(match[3]);
    const [wholeSeconds, fraction='']=match[3].split('.');
    const displaySeconds=`${wholeSeconds.padStart(2,'0')}${fraction ? `.${fraction}` : ''}`;
    return { seconds:hours*3600+minutes*60+seconds, display:hours ? `${hours}:${match[2]}:${displaySeconds}` : `${minutes}:${displaySeconds}` };
  });
}
function loadGameFromPgn(pgn, name='', players=null) {
  try {
    const clocks=parseMoveClocks(pgn), imported=new Chess(); imported.loadPgn(pgn); history=imported.history({verbose:true}); const headers=imported.header(); const realName=(name)=>name && name !== '?' ? name : ''; playerNames={w:players?.w || realName(headers?.White),b:players?.b || realName(headers?.Black)}; const cursor=new Chess(); reviews=[];
    for (const move of history) { const ply=reviews.length, fenBefore=cursor.fen(), played=cursor.move(move), clock=clocks[ply]; reviews.push({ply:ply+1,color:played.color,san:played.san,uci:`${played.from}${played.to}${played.promotion||''}`,fenBefore,fenAfter:cursor.fen(),bestMoveUci:null,bestMoveSan:null,lossPawns:null,book:false,brilliant:false,great:false,secondValue:null,afterPv:'',openingName:'',eco:'',remainingTime:clock?.display||null,remainingSeconds:clock?.seconds??null}); }
    gameName=name; savedReviewContext=null; reviewFilter=null; pendingReviewAnalysis=false; rebuildAt(0); $('#gameStatus').textContent=`Loaded ${history.length} plies${name ? ` · ${name}` : ''}. Analysis will label every move automatically.`;
    analyzeAllPlies();
  } catch (_) { $('#gameStatus').textContent='That PGN could not be read. Check its notation and try again.'; }
}
async function analyzeAllPlies() {
  if (!reviews.length) return;
  if (!engineReady) { pendingReviewAnalysis=true; $('#engineStatus').textContent='Waiting for Stockfish to load before reviewing every move…'; return; }
  pendingReviewAnalysis=false;
  const original=historyIndex;
  reviewAnalysisRunning=true;
  try {
    const depth=Math.min(12,Number($('#depth').value)), positions=[reviews[0].fenBefore,...reviews.map(record=>record.fenAfter)];
    const evaluations = new Map();
    for (let i=0;i<positions.length;i++) {
      $('#engineStatus').textContent=`Analyzing position ${i+1}/${positions.length}…`;
      const fen=positions[i];
      evaluations.set(fen, await engineSearch(fen,depth,false,2));
    }
    await bookReady;
    for (const record of reviews) { const before=evaluations.get(record.fenBefore), after=evaluations.get(record.fenAfter); record.bestMoveUci=before.bestMoveUci; record.bestMoveSan=uciToSan(record.fenBefore,before.bestMoveUci); record.evalBefore=before.value; record.evalAfter=after.value; record.secondValue=before.secondValue ?? null; record.afterPv=after.pv || ''; record.lossPawns=record.uci === before.bestMoveUci ? 0 : Math.max(0,record.color==='w' ? before.value-after.value : after.value-before.value); }
    markBook(reviews, bookData);
    for (const record of reviews) { record.brilliant=isBrilliant(record,Chess); record.great=!record.brilliant && isGreat(record); }
    renderReviewList();
    $('#engineStatus').textContent='Every ply has been reviewed.'; rebuildAt(original);
  } catch(e) { $('#engineStatus').textContent=e.message; } finally { reviewAnalysisRunning=false; }
}
async function checkOpeningBook() {
  $('#bookBtn').textContent='Checking book…'; await bookReady;
  if (!bookData) { $('#moveInsight').textContent='The opening book (data/opening-book.json) could not be loaded.'; $('#bookBtn').textContent='Check opening book'; return; }
  const opening=openingAt(chess.fen(),bookData), moves=bookMovesFrom(chess.fen(),Chess,bookData);
  $('#moveInsight').textContent=`${opening ? `${opening.eco} · ${opening.name}. ` : 'Not a named opening position. '}${moves.length ? `Book moves from here: ${moves.join(', ')}.` : 'No book moves from here.'}`;
  $('#bookBtn').textContent='Check opening book';
}
async function fetchChesscomGames() {
  const username=$('#chesscomUsername').value.trim(); if (!username) { $('#chesscomStatus').textContent='Enter a public Chess.com username first.'; return; } $('#chesscomStatus').textContent='Fetching the newest monthly archive…'; $('#chesscomGames').innerHTML='';
  try { const archiveResponse=await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`); if (!archiveResponse.ok) throw new Error('Username not found'); const archives=(await archiveResponse.json()).archives || []; if (!archives.length) throw new Error('No games found'); let games=[]; for (const archive of archives.slice(-3).reverse()) { const response=await fetch(archive); if (!response.ok) continue; games=(await response.json()).games || []; if (games.length) break; } if (!games.length) throw new Error('Games unavailable'); games.slice(-12).reverse().forEach((game) => { const b=document.createElement('button'); b.className='remote-game'; const white=game.white?.username||'White', black=game.black?.username||'Black'; b.textContent=`${white} vs ${black} · ${game.time_class || 'game'} · ${game.end_time ? new Date(game.end_time*1000).toLocaleDateString() : ''}`; b.addEventListener('click',()=>loadGameFromPgn(game.pgn,`${white} vs ${black}`,{w:white,b:black})); $('#chesscomGames').append(b); }); $('#chesscomStatus').textContent=`Found ${games.length} game(s) in the newest available archive. Choose one to import.`; }
  catch(e) { $('#chesscomStatus').textContent=e.message || 'Could not fetch this public Chess.com archive.'; }
}
async function fetchLichessGames() {
  const username=$('#lichessUsername').value.trim();
  if (!username) { $('#lichessStatus').textContent='Enter a public Lichess username first.'; return; }
  $('#lichessStatus').textContent='Fetching recent Lichess games…'; $('#lichessGames').innerHTML='';
  try {
    const response=await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=12&moves=true&clocks=false&evals=false&opening=false`, { headers:{Accept:'application/x-chess-pgn'} });
    if (!response.ok) throw new Error(response.status === 404 ? 'Lichess user not found.' : 'Lichess games are unavailable.');
    const text=await response.text();
    const games=text.split(/(?=^\[Event )/m).map(pgn=>pgn.trim()).filter(Boolean);
    if (!games.length) throw new Error('No public Lichess games found.');
    games.forEach((pgn,index) => {
      const game=new Chess();
      let white='White', black='Black';
      try {
        game.loadPgn(pgn);
        white=game.header()?.White || white;
        black=game.header()?.Black || black;
      } catch (_) {}
      const button=document.createElement('button');
      button.className='remote-game';
      button.textContent=`${white} vs ${black} · Game ${index+1}`;
      button.addEventListener('click',()=>loadGameFromPgn(pgn,`${white} vs ${black}`,{w:white,b:black}));
      $('#lichessGames').append(button);
    });
    $('#lichessStatus').textContent=`Found ${games.length} game(s). Choose one to import.`;
  } catch(e) { $('#lichessStatus').textContent=e.message || 'Could not fetch this public Lichess profile.'; }
}

function renderSummary() {
  const box=$('#gameSummary'), done=reviews.length > 1 && reviews.every((record) => record.lossPawns != null);
  box.hidden=!done; if (!done) return;
  const { counts, accuracy }=summarize(reviews), name=(color)=>esc(playerNames[color] || (color === 'w' ? 'White' : 'Black')), acc=(value)=>value == null ? '—' : value.toFixed(1);
  const rows=LABEL_ORDER.map((label) => {
    const cell=(color)=>{ const n=counts[color][label], active=reviewFilter && reviewFilter.color === color && reviewFilter.label === label; return `<button class="count c-${labelClass(label)}${active ? ' active' : ''}" data-color="${color}" data-label="${label}" ${n ? '' : 'disabled'}>${n}</button>`; };
    return `<div class="sum-row"><span class="sum-label">${label}</span>${cell('w')}<span class="badge-static ${labelClass(label)}" title="${label}">${BADGE_ICON[label]}</span>${cell('b')}</div>`;
  }).join('');
  $('#summaryBody').innerHTML=`<div class="sum-head"><span></span><strong>${name('w')}</strong><span></span><strong>${name('b')}</strong></div><div class="sum-row sum-acc"><span class="sum-label">Accuracy</span><span class="acc white">${acc(accuracy?.w)}</span><span></span><span class="acc black">${acc(accuracy?.b)}</span></div>${rows}`;
}
function updateFilterNote() {
  const note=$('#reviewFilterNote'); if (!reviewFilter) { note.hidden=true; return; }
  const total=reviews.filter((record,index) => record.color === reviewFilter.color && labelFor(record,reviews[index-1]) === reviewFilter.label).length;
  note.hidden=false; note.innerHTML=`Showing ${esc(playerNames[reviewFilter.color] || (reviewFilter.color === 'w' ? 'White' : 'Black'))} · ${reviewFilter.label} (${total}) <button class="text-button" id="clearFilterBtn">Clear</button>`;
  $('#clearFilterBtn').addEventListener('click',()=>{ reviewFilter=null; renderReviewList(); });
}
// Clicking a count in the summary shows only those moves in the list and jumps to the first one; click again for the next.
$('#summaryBody').addEventListener('click',(event) => {
  const button=event.target.closest('button.count'); if (!button || button.disabled) return;
  const { color, label }=button.dataset, same=reviewFilter && reviewFilter.color === color && reviewFilter.label === label;
  const matches=reviews.map((record,index) => record.color === color && labelFor(record,reviews[index-1]) === label ? index : -1).filter((index) => index >= 0);
  if (!matches.length) return;
  reviewFilter={ color, label, cursor:same ? (reviewFilter.cursor+1) % matches.length : 0 };
  renderReviewList(); rebuildAt(matches[reviewFilter.cursor]+1);
});

$('#analyzeBtn').addEventListener('click', analyze); $('#bookBtn').addEventListener('click',checkOpeningBook);
$('#undoBtn').addEventListener('click',undoPosition); $('#redoBtn').addEventListener('click',redoPosition);
$('#resumeReviewBtn').addEventListener('click',resumeReview);
$('#flipBtn').addEventListener('click',()=>{orientation=orientation==='w'?'b':'w';drawBoard()}); $('#resetBtn').addEventListener('click',()=>{chess.reset();history=[];reviews=[];historyIndex=0;currentAnalysis=null;playerNames={w:'',b:''};lastMove=null;manualRedoStack=[];savedReviewContext=null;pendingReviewAnalysis=false;renderReviewList();drawBoard();queueAutoAnalysis();});
$('#arrowToggleBtn').addEventListener('click',()=>{showBestArrow=!showBestArrow; const button=$('#arrowToggleBtn'); button.textContent=showBestArrow?'↗ Hide best move':'↗ Show best move'; button.setAttribute('aria-pressed',String(showBestArrow)); drawBoard();});
$('#depth').addEventListener('input',e=>$('#depthValue').textContent=e.target.value); $('#loadPgnBtn').addEventListener('click',()=>loadGameFromPgn($('#pgnInput').value));
$('#prevBtn').addEventListener('click',()=>rebuildAt(Math.max(0,historyIndex-1))); $('#nextBtn').addEventListener('click',()=>rebuildAt(Math.min(history.length,historyIndex+1))); $('#fetchChesscomBtn').addEventListener('click',fetchChesscomGames); $('#fetchLichessBtn').addEventListener('click',fetchLichessGames);
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter') analyze();}); drawBoard(); initEngine();
