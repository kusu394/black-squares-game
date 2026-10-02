(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GameEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SIZE = 4;
  const FULL_STATE = 0xffff;
  const MOVE_MASKS = [];

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      let mask = 0;
      for (let dr = 0; dr < 2; dr += 1) {
        for (let dc = 0; dc < 2; dc += 1) {
          mask |= 1 << ((row + dr) * SIZE + col + dc);
        }
      }
      MOVE_MASKS.push(mask);
    }
  }

  function isLegal(state, moveIndex) {
    const mask = MOVE_MASKS[moveIndex];
    return Number.isInteger(mask) && (state & mask) !== mask;
  }

  function applyMove(state, moveIndex) {
    if (!isLegal(state, moveIndex)) return state;
    return (state | MOVE_MASKS[moveIndex]) & FULL_STATE;
  }

  function legalMoves(state) {
    const result = [];
    for (let index = 0; index < MOVE_MASKS.length; index += 1) {
      if (isLegal(state, index)) result.push(index);
    }
    return result;
  }

  function analyseAllStates() {
    const winning = new Uint8Array(FULL_STATE + 1);
    const bestMove = new Int8Array(FULL_STATE + 1);
    bestMove.fill(-1);

    for (let state = FULL_STATE - 1; state >= 0; state -= 1) {
      for (let moveIndex = 0; moveIndex < MOVE_MASKS.length; moveIndex += 1) {
        if (!isLegal(state, moveIndex)) continue;
        const next = state | MOVE_MASKS[moveIndex];
        if (winning[next] === 0) {
          winning[state] = 1;
          bestMove[state] = moveIndex;
          break;
        }
      }
    }

    const firstWinStates = [];
    const secondWinStates = [];
    for (let state = 0; state <= FULL_STATE; state += 1) {
      if (winning[state]) firstWinStates.push(state);
      else if (state !== FULL_STATE) secondWinStates.push(state);
    }

    return { winning, bestMove, firstWinStates, secondWinStates };
  }

  const analysis = analyseAllStates();

  function isWinning(state) {
    return analysis.winning[state & FULL_STATE] === 1;
  }

  function randomIndex(length, random) {
    if (length <= 0) throw new Error("空の候補からは選べません。");
    const value = Math.max(0, Math.min(0.9999999999999999, random()));
    return Math.floor(value * length);
  }

  function countBlack(state) {
    let value = state & FULL_STATE;
    let count = 0;
    while (value) {
      value &= value - 1;
      count += 1;
    }
    return count;
  }

  function chooseCpuMove(state, random = Math.random) {
    const legal = legalMoves(state);
    if (!legal.length) return -1;
    const winningMoves = legal.filter((move) => !isWinning(applyMove(state, move)));
    const candidates = winningMoves.length ? winningMoves : legal;
    return candidates[randomIndex(candidates.length, random)];
  }

  const CLASS_PLANS = [
    ["first-win", "first-win", "second-win"],
    ["first-win", "second-win", "first-win"],
    ["second-win", "first-win", "first-win"],
    ["first-win", "second-win", "second-win"],
    ["second-win", "first-win", "second-win"],
    ["second-win", "second-win", "first-win"]
  ];

  function createClassPlan(random = Math.random) {
    return CLASS_PLANS[randomIndex(CLASS_PLANS.length, random)].slice();
  }

  function drawState(resultClass, usedStates = new Set(), random = Math.random, minimumWhite = 0) {
    const allStates = resultClass === "first-win"
      ? analysis.firstWinStates
      : analysis.secondWinStates;
    const source = minimumWhite > 0
      ? allStates.filter((state) => SIZE * SIZE - countBlack(state) >= minimumWhite)
      : allStates;
    if (usedStates.size >= source.length) throw new Error("未使用の盤面がありません。");

    const start = randomIndex(source.length, random);
    for (let offset = 0; offset < source.length; offset += 1) {
      const state = source[(start + offset) % source.length];
      if (!usedStates.has(state)) return state;
    }
    throw new Error("未使用の盤面がありません。");
  }

  function moveCells(moveIndex) {
    const row = Math.floor(moveIndex / 3);
    const col = moveIndex % 3;
    return [
      row * 4 + col,
      row * 4 + col + 1,
      (row + 1) * 4 + col,
      (row + 1) * 4 + col + 1
    ];
  }

  return {
    SIZE,
    FULL_STATE,
    MOVE_MASKS,
    analysis,
    isLegal,
    applyMove,
    legalMoves,
    isWinning,
    chooseCpuMove,
    createClassPlan,
    drawState,
    countBlack,
    moveCells
  };
});
