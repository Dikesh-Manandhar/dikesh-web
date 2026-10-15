// Chess sound effects loaded from the bundled chess-sounds directory.

const SOUND_FILES = {
  move: 'move-self.mp3',
  opponentMove: 'move-opponent.mp3',
  capture: 'capture.mp3',
  check: 'move-check.mp3',
  castle: 'castle.mp3',
  promote: 'promote.mp3',
  mate: 'game-end.mp3',
  draw: 'game-end.mp3',
  illegal: 'illegal.mp3',
};

const sounds = new Map();
let enabled = true;

try { enabled = localStorage.getItem('pawnReviewSound') !== 'off'; } catch (_) {}

export const isSoundEnabled = () => enabled;
export function setSoundEnabled(value) {
  enabled = !!value;
  try { localStorage.setItem('pawnReviewSound', enabled ? 'on' : 'off'); } catch (_) {}
}

function getSound(kind) {
  const file = SOUND_FILES[kind];
  if (!file) return null;
  if (!sounds.has(kind)) {
    const audio = new Audio(`./chess-sounds/${file}`);
    audio.preload = 'auto';
    sounds.set(kind, audio);
  }
  return sounds.get(kind);
}

export function playSound(kind) {
  if (!enabled) return;
  const sound = getSound(kind);
  if (!sound) return;
  sound.currentTime = 0;
  const playback = sound.play();
  if (playback?.catch) playback.catch(() => {});
}
