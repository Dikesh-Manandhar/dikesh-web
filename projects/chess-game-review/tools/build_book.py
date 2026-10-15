#!/usr/bin/env python3
"""
Builds data/opening-book.json, the offline opening book used by the app.

Source: lichess-org/chess-openings (a.tsv .. e.tsv, CC0 / public domain), copied in data/openings/.
  eco <TAB> name <TAB> pgn        e.g.   B20   Sicilian Defense   1. e4 c5

A position counts as "book" if it appears after any move of any listed line. Positions are keyed by
piece placement + side to move + castling rights (en passant and move counters are ignored, so
transpositions match). Positions that are the END of a named line also carry that opening's name.

Optional: add more book positions from your own games (e.g. a masters PGN file):
    python3 tools/build_book.py --extra-pgn masters.pgn --min-count 5 --max-ply 20
A position is added when at least --min-count games reach it within --max-ply plies.

Needs:  pip install chess
"""
import argparse
import collections
import glob
import json
import os
import re

import chess
import chess.pgn

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def key_of(board):
    return ' '.join(board.fen().split(' ')[:3])      # placement, side to move, castling


def san_moves(movetext):
    for tok in re.sub(r'\{[^}]*\}', ' ', movetext).split():
        if re.fullmatch(r'\d+\.+', tok) or tok in ('1-0', '0-1', '1/2-1/2', '*'):
            continue
        yield re.sub(r'^\d+\.+', '', tok)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--openings', default=os.path.join(ROOT, 'data', 'openings'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'data', 'opening-book.json'))
    ap.add_argument('--extra-pgn')
    ap.add_argument('--min-count', type=int, default=5)
    ap.add_argument('--max-ply', type=int, default=20)
    args = ap.parse_args()

    names, name_index = [], {}
    positions = {}
    lines = 0
    for path in sorted(glob.glob(os.path.join(args.openings, '*.tsv'))):
        with open(path, encoding='utf-8') as f:
            next(f)                                   # header
            for row in f:
                eco, name, pgn = row.rstrip('\n').split('\t')
                board = chess.Board()
                keys = []
                for san in san_moves(pgn):
                    board.push_san(san)
                    keys.append(key_of(board))
                if not keys:
                    continue
                lines += 1
                if (eco, name) not in name_index:
                    name_index[(eco, name)] = len(names)
                    names.append([eco, name])
                for k in keys[:-1]:
                    positions.setdefault(k, -1)
                end = keys[-1]
                if positions.get(end, -1) == -1:
                    positions[end] = name_index[(eco, name)]   # first named line wins

    extra_added = 0
    if args.extra_pgn:
        counts = collections.Counter()
        with open(args.extra_pgn, encoding='utf-8', errors='ignore') as f:
            while (game := chess.pgn.read_game(f)) is not None:
                board = game.board()
                seen = set()
                for ply, move in enumerate(game.mainline_moves(), start=1):
                    if ply > args.max_ply:
                        break
                    board.push(move)
                    seen.add(key_of(board))
                counts.update(seen)
        for k, n in counts.items():
            if n >= args.min_count and k not in positions:
                positions[k] = -1
                extra_added += 1

    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump({'v': 1, 'source': 'lichess-org/chess-openings (CC0)', 'openings': names, 'positions': positions},
                  f, separators=(',', ':'), ensure_ascii=False)
    print(f'{lines} opening lines -> {len(positions)} book positions ({extra_added} from extra PGN), '
          f'{len(names)} names, {os.path.getsize(args.out) / 1024:.0f} KB')


if __name__ == '__main__':
    main()
