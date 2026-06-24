/* =========================================================
   さやの貯金アプリ
   - 現在の貯金額 / 目標金額を localStorage に保存
   - 貯金額に応じて stages.js のステージを切り替え
   ========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "saya-tyokin-v1";

  // --- DOM ---
  const el = {
    stageImage: document.getElementById("stage-image"),
    stageTitle: document.getElementById("stage-title"),
    stageMessage: document.getElementById("stage-message"),
    amountCurrent: document.getElementById("amount-current"),
    amountGoal: document.getElementById("amount-goal"),
    progressFill: document.getElementById("progress-fill"),
    progressPercent: document.getElementById("progress-percent"),
    progressRemain: document.getElementById("progress-remain"),
    inputCurrent: document.getElementById("input-current"),
    inputGoal: document.getElementById("input-goal"),
    saveBtn: document.getElementById("save-btn"),
    savedNote: document.getElementById("saved-note"),
    stagesList: document.getElementById("stages-list"),
  };

  // --- 状態 ---
  let state = loadState();

  // --- 保存/読み込み ---
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          current: toNumber(parsed.current),
          goal: toNumber(parsed.goal) || 100000,
        };
      }
    } catch (e) {
      /* 壊れていたら初期値へ */
    }
    return { current: 0, goal: 100000 };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function toNumber(v) {
    const n = Math.floor(Number(v));
    return isFinite(n) && n > 0 ? n : 0;
  }

  // --- 金額フォーマット ---
  function yen(n) {
    return "¥" + Number(n).toLocaleString("ja-JP");
  }

  // --- ステージ判定 ---
  // threshold 以上で一番大きいステージを返す
  function currentStageIndex(amount) {
    let idx = 0;
    for (let i = 0; i < STAGES.length; i++) {
      if (amount >= STAGES[i].threshold) idx = i;
    }
    return idx;
  }

  // image が画像パスか絵文字かを判定して描画
  function renderStageImage(container, image) {
    container.innerHTML = "";
    const isPath = /[\/\\]|\.(png|jpe?g|gif|webp|svg)$/i.test(image);
    if (isPath) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = "";
      img.className = "stage-img-file";
      container.appendChild(img);
    } else {
      const span = document.createElement("span");
      span.className = "stage-img-emoji";
      span.textContent = image;
      container.appendChild(span);
    }
  }

  // --- 描画 ---
  function render() {
    const { current, goal } = state;
    const idx = currentStageIndex(current);
    const stage = STAGES[idx];

    // ステージ
    renderStageImage(el.stageImage, stage.image);
    el.stageTitle.textContent = stage.title;
    el.stageMessage.textContent = stage.message;

    // 金額
    el.amountCurrent.textContent = yen(current);
    el.amountGoal.textContent = yen(goal);

    // 進捗バー
    const percent = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
    el.progressFill.style.width = percent.toFixed(1) + "%";
    el.progressPercent.textContent = Math.floor(percent) + "%";

    if (goal > 0 && current >= goal) {
      el.progressRemain.textContent = "目標達成！🎉";
    } else if (goal > 0) {
      el.progressRemain.textContent = "あと " + yen(goal - current);
    } else {
      el.progressRemain.textContent = "";
    }

    // 入力欄（未入力のときだけ現在値を反映）
    if (document.activeElement !== el.inputCurrent) {
      el.inputCurrent.value = current ? String(current) : "";
    }
    if (document.activeElement !== el.inputGoal) {
      el.inputGoal.value = goal ? String(goal) : "";
    }

    renderStagesList(idx);
  }

  // --- ステージ一覧 ---
  function renderStagesList(activeIdx) {
    el.stagesList.innerHTML = "";
    STAGES.forEach(function (stage, i) {
      const li = document.createElement("li");
      li.className = "stage-row";
      if (i === activeIdx) li.classList.add("active");
      if (state.current >= stage.threshold) li.classList.add("cleared");

      const icon = document.createElement("span");
      icon.className = "stage-row-icon";
      renderStageImage(icon, stage.image);

      const body = document.createElement("div");
      body.className = "stage-row-body";
      const name = document.createElement("span");
      name.className = "stage-row-name";
      name.textContent = stage.title;
      const amt = document.createElement("span");
      amt.className = "stage-row-amount";
      amt.textContent = yen(stage.threshold) + "〜";
      body.appendChild(name);
      body.appendChild(amt);

      li.appendChild(icon);
      li.appendChild(body);
      el.stagesList.appendChild(li);
    });
  }

  // --- 保存ボタン ---
  function handleSave() {
    state.current = toNumber(el.inputCurrent.value);
    state.goal = toNumber(el.inputGoal.value) || 100000;
    saveState();
    render();

    el.savedNote.textContent = "保存しました ✓";
    el.savedNote.classList.add("show");
    clearTimeout(handleSave._t);
    handleSave._t = setTimeout(function () {
      el.savedNote.classList.remove("show");
    }, 1800);
  }

  el.saveBtn.addEventListener("click", handleSave);

  // Enterキーでも保存
  [el.inputCurrent, el.inputGoal].forEach(function (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        input.blur();
        handleSave();
      }
    });
  });

  // --- 初期描画 ---
  render();
})();
