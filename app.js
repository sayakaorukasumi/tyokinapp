/* =========================================================
   さやの貯金アプリ
   - 入金履歴の合計を「現在の貯金額」として自動計算
   - 進捗率に応じて stages.js の成長ステージを切り替え
   - 入金履歴 / 目標金額 / タイトルを localStorage に保存
   ========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "saya-tyokin-v2";
  const DEFAULT_TITLE = "さやの貯金アプリ";
  const DEFAULT_GOAL = 100000;

  /* ---------------- DOM ---------------- */
  const el = {
    appTitle: document.getElementById("app-title"),
    // ホーム
    stageImage: document.getElementById("stage-image"),
    stageTitle: document.getElementById("stage-title"),
    stageMessage: document.getElementById("stage-message"),
    amountCurrent: document.getElementById("amount-current"),
    amountGoal: document.getElementById("amount-goal"),
    progressFill: document.getElementById("progress-fill"),
    progressPercent: document.getElementById("progress-percent"),
    progressRemain: document.getElementById("progress-remain"),
    // 記録
    inputAmount: document.getElementById("input-amount"),
    inputMemo: document.getElementById("input-memo"),
    quickButtons: document.getElementById("quick-buttons"),
    addBtn: document.getElementById("add-btn"),
    savedNote: document.getElementById("saved-note"),
    historyList: document.getElementById("history-list"),
    historyTotal: document.getElementById("history-total"),
    historyEmpty: document.getElementById("history-empty"),
    // 設定
    inputTitle: document.getElementById("input-title"),
    inputGoal: document.getElementById("input-goal"),
    saveSettingsBtn: document.getElementById("save-settings-btn"),
    settingsNote: document.getElementById("settings-note"),
    resetBtn: document.getElementById("reset-btn"),
    // タブ
    tabBar: document.getElementById("tab-bar"),
    pages: {
      home: document.getElementById("page-home"),
      record: document.getElementById("page-record"),
      settings: document.getElementById("page-settings"),
    },
  };

  /* ---------------- 状態 ---------------- */
  let state = loadState();

  /* ---------------- 保存 / 読み込み ---------------- */
  function defaultState() {
    return { deposits: [], goal: DEFAULT_GOAL, title: DEFAULT_TITLE };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        deposits: Array.isArray(parsed.deposits) ? parsed.deposits : [],
        goal: toPositiveInt(parsed.goal) || DEFAULT_GOAL,
        title: typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title.trim()
          : DEFAULT_TITLE,
      };
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /* ---------------- 計算ヘルパー ---------------- */
  function toPositiveInt(v) {
    const n = Math.floor(Number(v));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function yen(n) {
    return "¥" + Number(n).toLocaleString("ja-JP");
  }

  // 入金履歴の合計 = 現在の貯金額
  function getTotal() {
    return state.deposits.reduce(function (sum, d) {
      return sum + (Number(d.amount) || 0);
    }, 0);
  }

  // 進捗率（%）。目標0以下なら0。
  function getPercent() {
    if (state.goal <= 0) return 0;
    return (getTotal() / state.goal) * 100;
  }

  // 進捗率からステージを取得（threshold以下で最大のもの）
  function getStage(percent) {
    const floored = Math.floor(percent);
    let stage = STAGES[0];
    for (let i = 0; i < STAGES.length; i++) {
      if (floored >= STAGES[i].threshold) stage = STAGES[i];
    }
    return stage;
  }

  // 日付フォーマット（YYYY/M/D）
  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
  }

  /* ---------------- 画像描画（絵文字 or 画像パス） ---------------- */
  function renderImage(container, image) {
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

  /* ---------------- 描画 ---------------- */
  function renderHome() {
    const total = getTotal();
    const percent = getPercent();
    const stage = getStage(percent);

    renderImage(el.stageImage, stage.image);
    el.stageTitle.textContent = stage.title;
    el.stageMessage.textContent = stage.message;

    el.amountCurrent.textContent = yen(total);
    el.amountGoal.textContent = yen(state.goal);

    const clamped = Math.max(0, Math.min(100, percent));
    el.progressFill.style.width = clamped.toFixed(1) + "%";
    el.progressPercent.textContent = Math.floor(percent) + "%";

    if (state.goal > 0 && total >= state.goal) {
      el.progressRemain.textContent = "目標達成！🎉";
    } else if (state.goal > 0) {
      el.progressRemain.textContent = "あと " + yen(state.goal - total);
    } else {
      el.progressRemain.textContent = "";
    }
  }

  function renderHistory() {
    el.historyTotal.textContent = "合計 " + yen(getTotal());
    el.historyList.innerHTML = "";

    if (state.deposits.length === 0) {
      el.historyEmpty.style.display = "block";
      return;
    }
    el.historyEmpty.style.display = "none";

    // 新しいものを上に
    const items = state.deposits.slice().reverse();
    items.forEach(function (dep) {
      const li = document.createElement("li");
      li.className = "history-item";

      const main = document.createElement("div");
      main.className = "history-main";

      const amt = document.createElement("span");
      amt.className = "history-amount";
      amt.textContent = "+" + yen(dep.amount);

      const meta = document.createElement("span");
      meta.className = "history-meta";
      meta.textContent = formatDate(dep.date) + (dep.memo ? " ・ " + dep.memo : "");

      main.appendChild(amt);
      main.appendChild(meta);

      const del = document.createElement("button");
      del.className = "history-delete";
      del.type = "button";
      del.setAttribute("aria-label", "削除");
      del.textContent = "✕";
      del.addEventListener("click", function () {
        deleteDeposit(dep.id);
      });

      li.appendChild(main);
      li.appendChild(del);
      el.historyList.appendChild(li);
    });
  }

  function renderSettings() {
    el.inputTitle.value = state.title;
    el.inputGoal.value = state.goal ? String(state.goal) : "";
  }

  function renderTitle() {
    el.appTitle.textContent = state.title;
    document.title = state.title;
  }

  function renderAll() {
    renderTitle();
    renderHome();
    renderHistory();
    renderSettings();
  }

  /* ---------------- 入金の追加 / 削除 ---------------- */
  function addDeposit() {
    const amount = toPositiveInt(el.inputAmount.value);
    if (amount <= 0) {
      flash(el.savedNote, "金額を入力してね", true);
      el.inputAmount.focus();
      return;
    }
    state.deposits.push({
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      amount: amount,
      memo: el.inputMemo.value.trim(),
      date: new Date().toISOString(),
    });
    saveState();

    el.inputAmount.value = "";
    el.inputMemo.value = "";
    renderHome();
    renderHistory();
    flash(el.savedNote, "追加しました ✓");
  }

  function deleteDeposit(id) {
    if (!window.confirm("この記録を削除しますか？")) return;
    state.deposits = state.deposits.filter(function (d) {
      return d.id !== id;
    });
    saveState();
    renderHome();
    renderHistory();
  }

  /* ---------------- 設定の保存 / リセット ---------------- */
  function saveSettings() {
    const goal = toPositiveInt(el.inputGoal.value);
    const title = el.inputTitle.value.trim();
    state.goal = goal || DEFAULT_GOAL;
    state.title = title || DEFAULT_TITLE;
    saveState();
    renderAll();
    flash(el.settingsNote, "保存しました ✓");
  }

  function resetData() {
    if (!window.confirm("本当にすべての貯金記録を削除しますか？")) return;
    state = defaultState();
    saveState();
    renderAll();
    switchTab("home");
  }

  /* ---------------- 一時メッセージ ---------------- */
  function flash(node, text, isError) {
    node.textContent = text;
    node.classList.toggle("error", !!isError);
    node.classList.add("show");
    clearTimeout(node._t);
    node._t = setTimeout(function () {
      node.classList.remove("show");
    }, 1800);
  }

  /* ---------------- タブ切り替え ---------------- */
  function switchTab(tab) {
    Object.keys(el.pages).forEach(function (key) {
      el.pages[key].classList.toggle("active", key === tab);
    });
    el.tabBar.querySelectorAll(".tab-item").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    window.scrollTo(0, 0);
  }

  /* ---------------- イベント登録 ---------------- */
  function bindEvents() {
    el.addBtn.addEventListener("click", addDeposit);

    el.inputAmount.addEventListener("keydown", function (e) {
      if (e.key === "Enter") addDeposit();
    });

    // よく使う金額ボタン → 入力欄にセット
    el.quickButtons.querySelectorAll(".quick-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        el.inputAmount.value = btn.dataset.amount;
        el.inputAmount.focus();
      });
    });

    el.saveSettingsBtn.addEventListener("click", saveSettings);
    el.resetBtn.addEventListener("click", resetData);

    el.tabBar.querySelectorAll(".tab-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchTab(btn.dataset.tab);
      });
    });
  }

  /* ---------------- 初期化 ---------------- */
  bindEvents();
  renderAll();
})();
