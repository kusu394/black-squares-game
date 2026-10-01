(function () {
  "use strict";

  const engine = window.GameEngine;
  const $ = (selector) => document.querySelector(selector);
  const board = $("#board");
  const moveGrid = $("#move-grid");
  const selectionOutline = $("#selection-outline");
  const cells = [];
  const moveButtons = [];

  const ui = {
    streak: $("#streak"),
    streakNumber: $("#streak-number"),
    roundNumber: $("#round-number"),
    phaseTag: $("#phase-tag"),
    statusTitle: $("#status-title"),
    statusCopy: $("#status-copy"),
    orderActions: $("#order-actions"),
    playInfo: $("#play-info"),
    turnOwner: $("#turn-owner"),
    legalCount: $("#legal-count"),
    nextButton: $("#next-button"),
    resetButton: $("#reset-button"),
    announcer: $("#announcer")
  };

  const model = {
    phase: "choose-order",
    streak: 0,
    roundIndex: 0,
    roundClasses: [],
    usedStates: new Set(),
    initialState: 0,
    state: 0,
    turn: "human",
    humanOrder: null,
    winner: null,
    lastMove: -1,
    cpuThinking: false,
    runToken: 0
  };

  function createBoard() {
    for (let index = 0; index < 16; index += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      board.appendChild(cell);
      cells.push(cell);
    }

    for (let index = 0; index < 9; index += 1) {
      const row = Math.floor(index / 3) + 1;
      const col = (index % 3) + 1;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "move-button";
      button.dataset.move = String(index);
      button.setAttribute("aria-label", `上から${row}行目、左から${col}列目を左上とする2×2を黒にする`);
      button.addEventListener("mouseenter", () => highlightMove(index));
      button.addEventListener("mouseleave", clearHighlight);
      button.addEventListener("focus", () => highlightMove(index));
      button.addEventListener("blur", clearHighlight);
      button.addEventListener("click", () => humanMove(index));
      moveGrid.appendChild(button);
      moveButtons.push(button);
    }
  }

  function highlightMove(moveIndex) {
    const row = Math.floor(moveIndex / 3);
    const col = moveIndex % 3;
    selectionOutline.style.transform = `translate(${col * 50}%, ${row * 50}%)`;
    selectionOutline.classList.add("visible");
  }

  function clearHighlight() {
    selectionOutline.classList.remove("visible");
  }

  function startNewSet() {
    model.runToken += 1;
    model.streak = 0;
    model.roundIndex = 0;
    model.roundClasses = engine.createClassPlan();
    model.usedStates = new Set();
    prepareRound();
  }

  function prepareRound() {
    model.runToken += 1;
    model.phase = "choose-order";
    model.winner = null;
    model.humanOrder = null;
    model.lastMove = -1;
    model.cpuThinking = false;
    const resultClass = model.roundClasses[model.roundIndex];
    model.initialState = engine.drawState(resultClass, model.usedStates);
    model.usedStates.add(model.initialState);
    model.state = model.initialState;
    render();
    announce(`第${model.roundIndex + 1}局。先手か後手を選んでください。`);
  }

  function selectOrder(order) {
    if (model.phase !== "choose-order") return;
    model.humanOrder = order;
    model.turn = order === "first" ? "human" : "cpu";
    model.phase = "playing";
    render();
    announce(order === "first" ? "あなたが先手です。" : "CPUが先手です。");
    if (model.turn === "cpu") scheduleCpuMove();
  }

  function humanMove(moveIndex) {
    if (model.phase !== "playing" || model.turn !== "human" || model.cpuThinking) return;
    if (!engine.isLegal(model.state, moveIndex)) return;
    makeMove(moveIndex, "human");
  }

  function makeMove(moveIndex, actor) {
    model.state = engine.applyMove(model.state, moveIndex);
    model.lastMove = moveIndex;
    clearHighlight();

    if (engine.legalMoves(model.state).length === 0) {
      finishRound(actor);
      return;
    }

    model.turn = actor === "human" ? "cpu" : "human";
    model.cpuThinking = false;
    render();
    announce(`${actor === "human" ? "あなた" : "CPU"}が着手しました。${model.turn === "human" ? "あなた" : "CPU"}の手番です。`);
    if (model.turn === "cpu") scheduleCpuMove();
  }

  function scheduleCpuMove() {
    model.cpuThinking = true;
    const token = model.runToken;
    render();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      if (token !== model.runToken || model.phase !== "playing" || model.turn !== "cpu") return;
      const move = engine.chooseCpuMove(model.state);
      model.cpuThinking = false;
      if (move >= 0) makeMove(move, "cpu");
    }, reducedMotion ? 40 : 420);
  }

  function finishRound(winner) {
    model.runToken += 1;
    model.winner = winner;
    model.cpuThinking = false;
    if (winner === "human") {
      model.streak += 1;
      model.phase = model.streak === 3 ? "cleared" : "round-result";
    } else {
      model.streak = 0;
      model.phase = "round-result";
    }
    render();
    announce(winner === "human" ? (model.streak === 3 ? "3連勝達成。クリアです。" : `勝利。${model.streak}連勝です。`) : "CPUの勝利。連勝は0に戻ります。");
  }

  function advance() {
    if (model.phase === "cleared") {
      startNewSet();
      return;
    }
    if (model.phase !== "round-result") return;
    if (model.winner === "human") {
      model.roundIndex += 1;
    } else {
      model.roundIndex = 0;
      model.roundClasses = engine.createClassPlan();
      model.usedStates = new Set();
    }
    prepareRound();
  }

  function renderBoard() {
    const lastCells = model.lastMove >= 0 ? new Set(engine.moveCells(model.lastMove)) : new Set();
    cells.forEach((cell, index) => {
      const black = Boolean(model.state & (1 << index));
      cell.classList.toggle("black", black);
      cell.classList.toggle("last-move", lastCells.has(index));
      cell.setAttribute("aria-label", `${Math.floor(index / 4) + 1}行${index % 4 + 1}列、${black ? "黒" : "白"}`);
    });
    moveButtons.forEach((button, index) => {
      const playable = model.phase === "playing" && model.turn === "human" && !model.cpuThinking;
      const legal = engine.isLegal(model.state, index);
      button.disabled = model.phase === "playing" && (!playable || !legal);
      button.setAttribute("aria-disabled", String(!playable || !legal));
    });
  }

  function render() {
    renderBoard();
    ui.streakNumber.textContent = String(model.streak);
    ui.streak.setAttribute("aria-label", `現在${model.streak}連勝`);
    [...ui.streak.children].forEach((dot, index) => dot.classList.toggle("active", index < model.streak));
    ui.roundNumber.textContent = String(Math.min(3, model.roundIndex + 1));
    const choosing = model.phase === "choose-order";
    ui.orderActions.hidden = !choosing;
    ui.playInfo.hidden = model.phase !== "playing";
    ui.nextButton.hidden = !["round-result", "cleared"].includes(model.phase);

    if (choosing) {
      ui.phaseTag.textContent = "先手・後手の選択";
      ui.statusTitle.textContent = "先手・後手を選んでください";
      ui.statusCopy.textContent = "この盤面を読み、勝てる側を選びましょう。";
    } else if (model.phase === "playing") {
      ui.phaseTag.textContent = model.cpuThinking ? "CPUの手番" : "対局中";
      ui.statusTitle.textContent = model.turn === "human" ? "あなたの手番です" : "CPUが考えています";
      ui.statusCopy.textContent = model.turn === "human" ? "白を含む2×2を選んでください。" : "CPUが着手します。";
      ui.turnOwner.textContent = model.turn === "human" ? "あなた" : "CPU";
      ui.legalCount.textContent = String(engine.legalMoves(model.state).length);
    } else if (model.phase === "cleared") {
      ui.phaseTag.textContent = "チャレンジクリア";
      ui.statusTitle.textContent = "3連勝達成です。";
      ui.statusCopy.textContent = "先手必勝と後手必勝、両方の盤面を見抜きました。";
      ui.nextButton.textContent = "もう一度挑戦する";
    } else {
      const won = model.winner === "human";
      ui.phaseTag.textContent = won ? "勝利" : "敗北";
      ui.statusTitle.textContent = won ? `${model.streak}連勝。次の盤面へ。` : "連勝は0に戻りました。";
      ui.statusCopy.textContent = won ? "勝てる側を選び、最後の1手を取りました。" : "連勝数は0に戻り、3局の構成も新しくなります。";
      ui.nextButton.textContent = won ? "次の盤面へ" : "新しい挑戦を始める";
    }
  }

  function announce(message) { ui.announcer.textContent = message; }

  createBoard();
  document.querySelectorAll("[data-order]").forEach((button) => button.addEventListener("click", () => selectOrder(button.dataset.order)));
  ui.nextButton.addEventListener("click", advance);
  ui.resetButton.addEventListener("click", () => {
    if (window.confirm("連勝をリセットして、最初からやり直しますか？")) startNewSet();
  });

  const dialog = $("#rules-dialog");
  $("#rules-button").addEventListener("click", () => dialog.showModal());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  startNewSet();
})();
