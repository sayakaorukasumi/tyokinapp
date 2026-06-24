/* =========================================================
   さやの貯金アプリ
   - 記録(入金/引き出し)の履歴から現在の貯金額を自動計算
     現在の貯金額 = 入金合計 − 引き出し合計
   - 進捗率に応じて stages.js の成長ステージを切り替え
   - 記録 / 目標金額 / タイトルを localStorage に保存
   ========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "saya-tyokin-v2";
  const DEFAULT_TITLE = "さやの貯金アプリ";
  const DEFAULT_GOAL = 100000;

  // メモの候補（モードごと）
  const MEMO_SUGGESTIONS = {
    deposit: ["おこづかい", "お給料", "ボーナス", "おつり貯金", "臨時収入"],
    withdrawal: ["病院代", "急な出費", "家の用事", "交通費", "生活費補填"],
  };

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
    modeSegment: document.getElementById("mode-segment"),
    amountLabel: document.getElementById("amount-label"),
    inputAmount: document.getElementById("input-amount"),
    inputDate: document.getElementById("input-date"),
    inputMemo: document.getElementById("input-memo"),
    memoSuggestions: document.getElementById("memo-suggestions"),
    quickButtons: document.getElementById("quick-buttons"),
    addBtn: document.getElementById("add-btn"),
    savedNote: document.getElementById("saved-note"),
    historyList: document.getElementById("history-list"),
    historyEmpty: document.getElementById("history-empty"),
    sumDeposit: document.getElementById("sum-deposit"),
    sumWithdrawal: document.getElementById("sum-withdrawal"),
    sumBalance: document.getElementById("sum-balance"),
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
  let mode = "deposit"; // "deposit" | "withdrawal"

  /* ---------------- 保存 / 読み込み ---------------- */
  function defaultState() {
    return { records: [], goal: DEFAULT_GOAL, title: DEFAULT_TITLE };
  }

  // 旧データ(deposits[] / typeなし)を records[] に移行して取りこぼさない
  function migrateRecords(parsed) {
    let raw = [];
    if (Array.isArray(parsed.records)) {
      raw = parsed.records;
    } else if (Array.isArray(parsed.deposits)) {
      raw = parsed.deposits; // 旧バージョン
    }
    return raw.map(function (r) {
      return {
        id: r.id || (Date.now() + "-" + Math.random().toString(36).slice(2, 7)),
        // typeが無い古い履歴は入金として扱う
        type: r.type === "withdrawal" ? "withdrawal" : "deposit",
        amount: toPositiveInt(r.amount),
        memo: typeof r.memo === "string" ? r.memo : "",
        date: r.date || new Date().toISOString(),
      };
    });
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        records: migrateRecords(parsed),
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

  function getDepositTotal() {
    return state.records.reduce(function (sum, r) {
      return r.type === "deposit" ? sum + r.amount : sum;
    }, 0);
  }

  function getWithdrawalTotal() {
    return state.records.reduce(function (sum, r) {
      return r.type === "withdrawal" ? sum + r.amount : sum;
    }, 0);
  }

  // 現在の貯金額 = 入金合計 − 引き出し合計
  function getBalance() {
    return getDepositTotal() - getWithdrawalTotal();
  }

  // 進捗率（%）。残高が0未満なら0%扱い。
  function getPercent() {
    if (state.goal <= 0) return 0;
    const balance = Math.max(0, getBalance());
    return (balance / state.goal) * 100;
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

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
  }

  // input[type=date] 用の YYYY-MM-DD（ローカル日付）
  function todayInputValue() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
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

  /* ---------------- 描画：ホーム ---------------- */
  function renderHome() {
    const balance = getBalance();
    const percent = getPercent();
    const stage = getStage(percent);

    renderImage(el.stageImage, stage.image);
    el.stageTitle.textContent = stage.title;
    el.stageMessage.textContent = stage.message;

    el.amountCurrent.textContent = yen(balance);
    el.amountGoal.textContent = yen(state.goal);

    // バーは最大100%で止める
    const clamped = Math.max(0, Math.min(100, percent));
    el.progressFill.style.width = clamped.toFixed(1) + "%";
    el.progressPercent.textContent = Math.floor(percent) + "%";

    if (state.goal > 0 && balance >= state.goal) {
      el.progressRemain.textContent = "目標達成！🎉";
    } else if (state.goal > 0) {
      el.progressRemain.textContent = "あと " + yen(state.goal - balance);
    } else {
      el.progressRemain.textContent = "";
    }
  }

  /* ---------------- 描画：集計 ---------------- */
  function renderSummary() {
    el.sumDeposit.textContent = yen(getDepositTotal());
    el.sumWithdrawal.textContent = yen(getWithdrawalTotal());
    el.sumBalance.textContent = yen(getBalance());
  }

  /* ---------------- 描画：履歴 ---------------- */
  function renderHistory() {
    el.historyList.innerHTML = "";

    if (state.records.length === 0) {
      el.historyEmpty.style.display = "block";
      return;
    }
    el.historyEmpty.style.display = "none";

    // 新しいものを上に
    const items = state.records.slice().reverse();
    items.forEach(function (rec) {
      const isW = rec.type === "withdrawal";
      const li = document.createElement("li");
      li.className = "history-item " + (isW ? "is-withdrawal" : "is-deposit");

      const main = document.createElement("div");
      main.className = "history-main";

      const amt = document.createElement("span");
      amt.className = "history-amount";
      amt.textContent = (isW ? "−" : "＋") + yen(rec.amount);

      const meta = document.createElement("span");
      meta.className = "history-meta";
      const label = isW ? "引き出し" : "入金";
      meta.textContent = formatDate(rec.date) + " ・ " + label +
        (rec.memo ? " ・ " + rec.memo : "");

      main.appendChild(amt);
      main.appendChild(meta);

      const del = document.createElement("button");
      del.className = "history-delete";
      del.type = "button";
      del.setAttribute("aria-label", "削除");
      del.textContent = "✕";
      del.addEventListener("click", function () {
        deleteRecord(rec.id);
      });

      li.appendChild(main);
      li.appendChild(del);
      el.historyList.appendChild(li);
    });
  }

  /* ---------------- 描画：設定 / タイトル ---------------- */
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
    renderSummary();
    renderHistory();
    renderSettings();
  }

  /* ---------------- モード切り替え（入金/引き出し） ---------------- */
  function setMode(newMode) {
    mode = newMode === "withdrawal" ? "withdrawal" : "deposit";
    const isW = mode === "withdrawal";

    el.modeSegment.querySelectorAll(".segment-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    el.modeSegment.classList.toggle("withdrawal", isW);

    el.amountLabel.textContent = isW ? "引き出し額" : "入金額";
    el.addBtn.textContent = isW ? "引き出しを記録" : "追加する";
    el.inputMemo.placeholder = isW ? "病院代・急な出費 など" : "おこづかい・ボーナス など";

    // メモ候補を入れ替え
    el.memoSuggestions.innerHTML = "";
    MEMO_SUGGESTIONS[mode].forEach(function (text) {
      const opt = document.createElement("option");
      opt.value = text;
      el.memoSuggestions.appendChild(opt);
    });
  }

  /* ---------------- 記録の追加 / 削除 ---------------- */
  function addRecord() {
    const amount = toPositiveInt(el.inputAmount.value);
    if (amount <= 0) {
      flash(el.savedNote, "金額を入力してね", true);
      el.inputAmount.focus();
      return;
    }

    const isW = mode === "withdrawal";

    if (isW) {
      // 残高を超える場合は先に警告
      if (amount > getBalance()) {
        if (!window.confirm("現在の貯金額を超えています。記録しますか？")) return;
      }
      // 引き出しの確認ダイアログ
      if (!window.confirm("この金額を貯金から引き出しとして記録しますか？")) return;
    }

    // 日付：入力値（YYYY-MM-DD）優先、無ければ今日
    const dateStr = el.inputDate.value || todayInputValue();
    const dateIso = new Date(dateStr + "T00:00:00").toISOString();

    state.records.push({
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      type: mode,
      amount: amount,
      memo: el.inputMemo.value.trim(),
      date: dateIso,
    });
    saveState();

    el.inputAmount.value = "";
    el.inputMemo.value = "";
    el.inputDate.value = todayInputValue();

    renderHome();
    renderSummary();
    renderHistory();
    flash(el.savedNote, isW ? "引き出しを記録しました ✓" : "追加しました ✓");
  }

  function deleteRecord(id) {
    if (!window.confirm("この記録を削除しますか？")) return;
    state.records = state.records.filter(function (r) {
      return r.id !== id;
    });
    saveState();
    renderHome();
    renderSummary();
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
    el.addBtn.addEventListener("click", addRecord);

    el.inputAmount.addEventListener("keydown", function (e) {
      if (e.key === "Enter") addRecord();
    });

    el.quickButtons.querySelectorAll(".quick-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        el.inputAmount.value = btn.dataset.amount;
        el.inputAmount.focus();
      });
    });

    el.modeSegment.querySelectorAll(".segment-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setMode(btn.dataset.mode);
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
  setMode("deposit");
  el.inputDate.value = todayInputValue();
  renderAll();
})();
