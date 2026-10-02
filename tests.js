(function (root) {
  "use strict";

  const engine = root.GameEngine || (typeof require === "function" ? require("./game.js") : null);
  const tests = [];

  function test(name, run) { tests.push({ name, run }); }
  function assert(condition, message) { if (!condition) throw new Error(message || "assertion failed"); }

  test("全黒は合法手0の負け局面", () => {
    assert(engine.legalMoves(0xffff).length === 0);
    assert(!engine.isWinning(0xffff));
  });

  test("全白は合法手9の勝ち局面", () => {
    assert(engine.legalMoves(0).length === 9);
    assert(engine.isWinning(0));
  });

  test("9個の着手マスクが正しい", () => {
    const expected = [0x0033, 0x0066, 0x00cc, 0x0330, 0x0660, 0x0cc0, 0x3300, 0x6600, 0xcc00];
    assert(expected.every((mask, index) => mask === engine.MOVE_MASKS[index]));
  });

  test("すべての合法手で黒マスが増える", () => {
    for (let state = 0; state < 0x10000; state += 1) {
      engine.legalMoves(state).forEach((move) => assert(engine.applyMove(state, move) > state));
    }
  });

  test("勝ち局面54,564、負け局面10,972", () => {
    let wins = 0;
    for (let state = 0; state < 0x10000; state += 1) wins += Number(engine.isWinning(state));
    assert(wins === 54564, `実際は${wins}`);
    assert(0x10000 - wins === 10972);
  });

  test("勝ち局面のCPU手は負け局面へ移る", () => {
    for (let state = 0; state < 0x10000; state += 1) {
      if (!engine.isWinning(state)) continue;
      const move = engine.chooseCpuMove(state, () => 0);
      assert(engine.isLegal(state, move));
      assert(!engine.isWinning(engine.applyMove(state, move)), `state=${state}`);
    }
  });

  test("負け局面の全合法手は勝ち局面へ移る", () => {
    for (let state = 0; state < 0x10000; state += 1) {
      if (engine.isWinning(state)) continue;
      engine.legalMoves(state).forEach((move) => assert(engine.isWinning(engine.applyMove(state, move)), `state=${state}`));
    }
  });

  test("盤面抽選は指定クラスを守り、全黒を返さない", () => {
    const first = engine.drawState("first-win", new Set(), () => 0.4);
    const second = engine.drawState("second-win", new Set(), () => 0.4);
    assert(engine.isWinning(first));
    assert(!engine.isWinning(second));
    assert(first !== 0xffff && second !== 0xffff);
  });

  test("盤面抽選は使用済み盤面を返さない", () => {
    const first = engine.drawState("first-win", new Set(), () => 0);
    const second = engine.drawState("first-win", new Set([first]), () => 0);
    assert(first !== second);
    assert(engine.isWinning(second));
  });

  test("3問目用の盤面は白マスを8個以上含む", () => {
    for (const resultClass of ["first-win", "second-win"]) {
      for (const random of [0, 0.25, 0.5, 0.75, 0.999]) {
        const state = engine.drawState(resultClass, new Set(), () => random, 8);
        assert(16 - engine.countBlack(state) >= 8);
        assert(engine.isWinning(state) === (resultClass === "first-win"));
      }
    }
  });

  test("全6種類の3局構成が両クラスを含む", () => {
    for (let index = 0; index < 6; index += 1) {
      const plan = engine.createClassPlan(() => (index + 0.1) / 6);
      assert(plan.length === 3);
      assert(plan.includes("first-win") && plan.includes("second-win"));
    }
  });

  function runAll() {
    const results = [];
    tests.forEach(({ name, run }) => {
      try { run(); results.push({ name, pass: true }); }
      catch (error) { results.push({ name, pass: false, error: error.message }); }
    });
    return results;
  }

  const results = runAll();
  if (typeof document !== "undefined") {
    const list = document.querySelector("#results");
    results.forEach((result) => {
      const item = document.createElement("li");
      item.className = result.pass ? "pass" : "fail";
      item.textContent = `${result.pass ? "✓" : "✗"} ${result.name}${result.error ? ` — ${result.error}` : ""}`;
      list.appendChild(item);
    });
    const passed = results.filter((result) => result.pass).length;
    const summary = document.querySelector("#summary");
    summary.textContent = `${passed} / ${results.length} tests passed`;
    summary.className = passed === results.length ? "pass" : "fail";
  }

  if (typeof module === "object" && module.exports) {
    module.exports = results;
    if (results.some((result) => !result.pass)) process.exitCode = 1;
    results.forEach((result) => console.log(`${result.pass ? "PASS" : "FAIL"} ${result.name}${result.error ? `: ${result.error}` : ""}`));
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
