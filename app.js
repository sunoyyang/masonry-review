/* 砌体结构 · 第8章总复习 — 答题 PWA 逻辑 */
(function () {
  "use strict";

  const STORE_KEY = "masonry_progress_v1";
  const TYPE_LABEL = { choice: "选择题", judge: "判断题", essay: "简答题", calc: "计算题" };
  const KEYS = ["A", "B", "C", "D", "E", "F"];

  // ---------- 存储 ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save(data) { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
  let store = load();

  function prog(id) {
    if (!store[id]) store[id] = { c: 0, w: 0, m: false };
    return store[id];
  }
  function record(id, correct) {
    const p = prog(id);
    if (correct) p.c++; else p.w++;
    save(store);
    refreshHomeStats();
  }
  function toggleMark(id) {
    const p = prog(id);
    p.m = !p.m;
    save(store);
  }
  function wrongIds() {
    return QUESTIONS.filter((q) => prog(q.id).w > 0).map((q) => q.id);
  }

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const views = {
    home: $("#view-home"), quiz: $("#view-quiz"),
    wrong: $("#view-wrong"), stats: $("#view-stats"),
  };
  const headerTitle = $("#headerTitle");

  function showView(name) {
    Object.keys(views).forEach((k) => (views[k].hidden = k !== name));
    document.querySelectorAll(".nav-tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.tab === name));
    const titles = { home: "砌体结构 · 总复习", quiz: reviewMode ? "背题模式" : "练习模式", wrong: "错题本", stats: "学习统计" };
    headerTitle.textContent = titles[name] || "砌体结构";
    if (name === "home") refreshHomeStats();
    if (name === "wrong") renderWrong();
    if (name === "stats") renderStats();
    window.scrollTo(0, 0);
  }

  // ---------- 练习状态 ----------
  let list = [];   // 当前题目数组
  let pos = 0;
  let sessionAnswered = new Set();
  let sessionResult = {};   // id -> { picked, correct }（本次练习会话内）
  let reviewMode = false;   // 背题模式（直接显示答案）
  let answerHidden = false; // 背题模式下是否隐藏答案（自测）
  let panelTarget = "practice"; // 分类面板用途：practice / review
  let visited = new Set();  // 背题模式下已浏览的题目 id

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startPractice(mode, opts) {
    opts = opts || {};
    if (mode === "sequential") list = QUESTIONS.slice();
    else if (mode === "random") list = shuffle(QUESTIONS);
    else if (mode === "wrong") {
      const ids = wrongIds();
      if (!ids.length) { toast("还没有错题，先去练习吧～"); return; }
      list = QUESTIONS.filter((q) => ids.includes(q.id));
    } else if (mode === "category") {
      list = QUESTIONS.filter((q) => q.topic === opts.topic);
    }
    if (opts.startId != null) {
      const idx = list.findIndex((q) => q.id === opts.startId);
      pos = idx >= 0 ? idx : 0;
    } else pos = 0;
    sessionAnswered = new Set();
    sessionResult = {};
    reviewMode = false;
    visited = new Set();
    $("#categoryPanel").hidden = true;
    showView("quiz");
    renderQuestion();
  }

  // 背题模式：直接展示题目与答案，不做答题交互
  function startReview(mode, opts) {
    opts = opts || {};
    list = mode === "category" ? QUESTIONS.filter((q) => q.topic === opts.topic) : QUESTIONS.slice();
    pos = 0;
    sessionAnswered = new Set();
    sessionResult = {};
    reviewMode = true;
    visited = new Set();
    $("#categoryPanel").hidden = true;
    showView("quiz");
    renderQuestion();
  }

  // 选项 HTML（背题模式下高亮正确项）
  function optionsHTML(q, review) {
    if (q.type === "judge") {
      const items = [["1", "✓", "正确"], ["0", "✗", "错误"]];
      return `<div class="options">` + items.map(([i, k, t]) =>
        `<div class="opt${(review && ((i === "1") === q.answer)) ? " correct" : ""}" data-i="${i}"><span class="key">${k}</span><span>${t}</span></div>`).join("") + `</div>`;
    }
    return `<div class="options">` + q.options.map((o, i) =>
      `<div class="opt${review && i === q.answer ? " correct" : ""}" data-i="${i}"><span class="key">${KEYS[i]}</span><span>${o}</span></div>`).join("") + `</div>`;
  }

  // 背题模式的答案块 HTML
  function answerBoxHTML(q) {
    if (q.type === "choice") {
      return `<div class="answer-box">
        <div class="correct-line">正确答案：<b>${KEYS[q.answer]}</b>　${q.options[q.answer]}</div>
        <div class="explain">${q.explain}</div></div>`;
    }
    if (q.type === "judge") {
      return `<div class="answer-box">
        <div class="correct-line">正确答案：<b>${q.answer ? "正确" : "错误"}</b></div>
        <div class="explain">${q.explain}</div></div>`;
    }
    if (q.type === "essay") {
      return `<div class="answer-box"><div class="explain">${q.answer}</div></div>`;
    }
    if (q.type === "calc") {
      return `<div class="answer-box">
        <div class="explain"><b>解题步骤：</b></div>
        <ol>${q.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
        <div class="verdict ok">结论：${q.answer}</div></div>`;
    }
    return "";
  }

  // ---------- 渲染题目 ----------
  function renderQuestion() {
    const q = list[pos];
    if (reviewMode) visited.add(q.id);
    const card = $("#questionCard");
    let html = `<div class="q-meta">
        <span class="q-type">${TYPE_LABEL[q.type]}</span>
        <span class="q-topic">${q.topic}</span>
      </div><div class="q-text">${q.q}</div>`;

    if (q.type === "choice") {
      html += optionsHTML(q, reviewMode);
      if (reviewMode) html += answerBoxHTML(q);
    } else if (q.type === "judge") {
      html += optionsHTML(q, reviewMode);
      if (reviewMode) html += answerBoxHTML(q);
    } else if (q.type === "essay") {
      if (reviewMode) html += answerBoxHTML(q);
      else html += `<div class="essay-box">
        <button class="btn-reveal" id="revealBtn">显示答案</button>
        <div class="answer-block" id="answerBlock" hidden>${q.answer}</div>
      </div>`;
    } else if (q.type === "calc") {
      const fig = q.figure ? `<img class="q-fig" src="${q.figure}" alt="计算题配图" />` : "";
      const body = reviewMode
        ? answerBoxHTML(q)
        : `<button class="btn-reveal" id="revealBtn">显示分步解析</button>
           <div class="answer-block" id="answerBlock" hidden>
             <div style="font-weight:700;margin-bottom:6px">解题步骤：</div>
             <ol>${q.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
             <div class="verdict ok">结论：${q.answer}</div>
           </div>`;
      html += `<div class="calc-box">${fig}${body}</div>`;
    }
    card.innerHTML = html;

    // 进度
    $("#progressText").textContent = (pos + 1) + " / " + list.length;
    $("#progressFill").style.width = ((pos + 1) / list.length * 100) + "%";
    $("#btnPrev").disabled = pos === 0;
    $("#btnNext").textContent = pos === list.length - 1 ? "完成 ✓" : "下一题";
    const marked = prog(q.id).m;
    $("#btnMark").textContent = marked ? "★" : "☆";
    $("#btnMark").style.color = marked ? "var(--warn)" : "";

    // 背题模式：样式与“隐藏答案”开关状态
    card.classList.toggle("review", reviewMode);
    card.classList.toggle("hide-ans", reviewMode && answerHidden);
    $("#btnToggleAns").hidden = !reviewMode;
    $("#btnToggleAns").textContent = answerHidden ? "显示答案" : "隐藏答案";

    renderToc();

    // 事件（练习模式才绑定答题交互）
    if ((q.type === "choice" || q.type === "judge") && !reviewMode) {
      card.querySelectorAll(".opt").forEach((el) => {
        el.addEventListener("click", () => onPick(q, parseInt(el.dataset.i, 10)));
      });
      if (sessionResult[q.id]) applyResult(q);
    } else if ((q.type === "essay" || q.type === "calc") && !reviewMode) {
      const rb = $("#revealBtn");
      if (rb) rb.addEventListener("click", () => {
        $("#answerBlock").hidden = false;
        rb.hidden = true;
      });
    }
  }

  function onPick(q, picked) {
    if (sessionResult[q.id]) return;
    const correct = q.type === "judge"
      ? (picked === 1 ? true : false) === q.answer
      : picked === q.answer;
    sessionResult[q.id] = { picked, correct };
    applyResult(q);
    record(q.id, correct);
    // 错题本角标实时刷新
    if (!correct) { $("#wrongBadge").textContent = wrongIds().length; }
  }

  function applyResult(q) {
    const res = sessionResult[q.id];
    const opts = document.querySelectorAll("#questionCard .opt");
    opts.forEach((o) => o.classList.add("locked"));
    if (q.type === "judge") {
      const truthIdx = q.answer ? 1 : 0;
      opts[truthIdx].classList.add("correct");
      if (!res.correct) opts[res.picked].classList.add("wrong");
    } else {
      opts[q.answer].classList.add("correct");
      if (!res.correct) opts[res.picked].classList.add("wrong");
    }
    const fb = document.createElement("div");
    fb.className = "feedback " + (res.correct ? "ok" : "err");
    fb.textContent = res.correct ? "✓ 回答正确" : "✗ 回答错误";
    document.querySelector("#questionCard .options").after(fb);
    const ex = document.createElement("div");
    ex.className = "explain";
    ex.innerHTML = (res.correct ? "" : `<b>正确答案：${q.type === "judge" ? (q.answer ? "正确" : "错误") : KEYS[q.answer]}</b><br>`) + q.explain;
    fb.after(ex);
  }

  // 标记
  $("#btnMark").addEventListener("click", () => {
    const q = list[pos];
    toggleMark(q.id);
    const marked = prog(q.id).m;
    $("#btnMark").textContent = marked ? "★" : "☆";
    $("#btnMark").style.color = marked ? "var(--warn)" : "";
  });

  // 背题模式：隐藏/显示答案
  $("#btnToggleAns").addEventListener("click", () => {
    answerHidden = !answerHidden;
    $("#questionCard").classList.toggle("hide-ans", answerHidden);
    $("#btnToggleAns").textContent = answerHidden ? "显示答案" : "隐藏答案";
  });

  // 题号总览抽屉
  function tocStatus(id) {
    if (reviewMode) return visited.has(id) ? "seen" : "none";
    const r = sessionResult[id];
    if (!r) return "none";
    return r.correct ? "ok" : "wrong";
  }
  function renderToc() {
    const grid = $("#tocGrid");
    if (!grid) return;
    const answered = list.filter((q) => reviewMode ? visited.has(q.id) : sessionResult[q.id]).length;
    $("#tocTitle").textContent =
      (reviewMode ? "背题模式" : "练习模式") +
      ` · 共 ${list.length} 题 · 当前第 ${pos + 1} 题 · ${reviewMode ? "已浏览" : "已答"} ${answered} 题`;
    let html = "";
    list.forEach((q, i) => {
      const st = tocStatus(q.id);
      const cls = "toc-cell" + (st !== "none" ? " toc-" + st : "") + (i === pos ? " cur" : "");
      const star = prog(q.id).m ? `<span class="toc-star">★</span>` : "";
      html += `<button class="${cls}" data-i="${i}">${i + 1}${star}</button>`;
    });
    grid.innerHTML = html;
  }
  function openToc() { renderToc(); $("#tocOverlay").hidden = false; }
  function closeToc() { $("#tocOverlay").hidden = true; }

  $("#btnToc").addEventListener("click", openToc);
  $("#tocClose").addEventListener("click", closeToc);
  $("#tocOverlay").addEventListener("click", (e) => {
    if (e.target === $("#tocOverlay")) closeToc();
  });
  $("#tocGrid").addEventListener("click", (e) => {
    const cell = e.target.closest(".toc-cell");
    if (!cell) return;
    pos = parseInt(cell.dataset.i, 10);
    closeToc();
    renderQuestion();
  });

  $("#btnPrev").addEventListener("click", () => { if (pos > 0) { pos--; renderQuestion(); } });
  $("#btnNext").addEventListener("click", () => {
    if (pos < list.length - 1) { pos++; renderQuestion(); }
    else { toast("本组练习完成 🎉"); showView("home"); }
  });
  $("#btnBack").addEventListener("click", () => showView("home"));

  // ---------- 首页 ----------
  function refreshHomeStats() {
    const total = QUESTIONS.length;
    let attempted = 0, correct = 0, wrong = 0, marked = 0;
    QUESTIONS.forEach((q) => {
      const p = store[q.id]; if (!p) return;
      if (p.c + p.w > 0) attempted++;
      correct += p.c; wrong += p.w; if (p.m) marked++;
    });
    const rate = correct + wrong > 0 ? Math.round(correct / (correct + wrong) * 100) : 0;
    $("#homeStats").innerHTML = `
      <div class="stat"><b>${attempted}</b><span>已练习</span></div>
      <div class="stat"><b>${rate}%</b><span>正确率</span></div>
      <div class="stat"><b>${wrong}</b><span>错题</span></div>
      <div class="stat"><b>${marked}</b><span>收藏</span></div>`;
    $("#wrongBadge").textContent = wrongIds().length;
    $("#wrongBadge").style.display = wrongIds().length ? "inline-block" : "none";
  }

  // 模式按钮
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode === "category") { panelTarget = "practice"; openCategoryPanel(); }
      else if (mode === "review") { panelTarget = "review"; openCategoryPanel(); }
      else startPractice(mode);
    });
  });

  // 分类面板（练习 / 背题 共用）
  function openCategoryPanel() {
    const panel = $("#categoryPanel");
    const chips = $("#categoryChips");
    const topics = [...new Set(QUESTIONS.map((q) => q.topic))];
    let html = "";
    if (panelTarget === "review") {
      html += `<button class="chip" data-topic="__all__">全部</button>`;
    }
    html += topics.map((t) => `<button class="chip" data-topic="${t}">${t}</button>`).join("");
    chips.innerHTML = html;
    chips.querySelectorAll(".chip").forEach((c) =>
      c.addEventListener("click", () => {
        const t = c.dataset.topic;
        if (panelTarget === "review") {
          if (t === "__all__") startReview("all");
          else startReview("category", { topic: t });
        } else {
          startPractice("category", { topic: t });
        }
        panel.hidden = true;
      }));
    $("#categoryPanel .section-title").textContent =
      panelTarget === "review" ? "选择分类开始背题" : "选择分类";
    panel.hidden = false;
  }

  // ---------- 错题本 ----------
  function renderWrong() {
    const ids = wrongIds();
    const wrap = $("#wrongList");
    if (!ids.length) { wrap.innerHTML = `<div class="empty">还没有错题，太棒了！</div>`; return; }
    wrap.innerHTML = QUESTIONS.filter((q) => ids.includes(q.id)).map((q) => {
      const p = prog(q.id);
      return `<div class="list-item" data-id="${q.id}">
        <div class="li-topic">${q.topic} · ${TYPE_LABEL[q.type]}</div>
        <div class="li-q">${q.q}</div>
        <div class="li-meta">答错 ${p.w} 次 · 点击重练</div>
      </div>`;
    }).join("");
    wrap.querySelectorAll(".list-item").forEach((it) =>
      it.addEventListener("click", () => {
        const id = parseInt(it.dataset.id, 10);
        list = QUESTIONS.filter((q) => wrongIds().includes(q.id));
        pos = Math.max(0, list.findIndex((q) => q.id === id));
        sessionAnswered = new Set();
        sessionResult = {};
        reviewMode = false;
        $("#categoryPanel").hidden = true;
        showView("quiz");
        renderQuestion();
      }));
  }
  $("#btnWrongBack").addEventListener("click", () => showView("home"));

  // ---------- 统计 ----------
  function renderStats() {
    let correct = 0, wrong = 0, attempted = 0, marked = 0;
    QUESTIONS.forEach((q) => {
      const p = store[q.id]; if (!p) return;
      if (p.c + p.w > 0) attempted++;
      correct += p.c; wrong += p.w; if (p.m) marked++;
    });
    const rate = correct + wrong > 0 ? Math.round(correct / (correct + wrong) * 100) : 0;
    $("#statsOverview").innerHTML = `
      <div class="stat-row"><span>总题量</span><b>${QUESTIONS.length}</b></div>
      <div class="stat-row"><span>已练习</span><b>${attempted}</b></div>
      <div class="stat-row"><span>总正确率</span><b style="color:var(--ok)">${rate}%</b></div>
      <div class="stat-row"><span>累计答错</span><b style="color:var(--err)">${wrong}</b></div>
      <div class="stat-row"><span>收藏题数</span><b>${marked}</b></div>`;

    const topics = [...new Set(QUESTIONS.map((q) => q.topic))];
    let html = `<div class="section-title">各分类掌握度</div>`;
    topics.forEach((t) => {
      let c = 0, w = 0;
      QUESTIONS.filter((q) => q.topic === t).forEach((q) => {
        const p = store[q.id]; if (p) { c += p.c; w += p.w; }
      });
      const total = c + w;
      const r = total ? Math.round(c / total * 100) : 0;
      html += `<div class="bar-line">
        <div class="bl-head"><span>${t}</span><span>${total ? r + "%" : "未练习"}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${r}%"></div></div>
      </div>`;
    });
    $("#statsByTopic").innerHTML = html;
  }
  $("#btnStatsBack").addEventListener("click", () => showView("home"));

  $("#btnReset").addEventListener("click", () => {
    if (confirm("确定清空全部学习记录（含错题与收藏）？")) {
      store = {}; save(store);
      showView("home"); toast("已清空学习记录");
    }
  });

  // 底部导航
  document.querySelectorAll(".nav-tab").forEach((t) =>
    t.addEventListener("click", () => showView(t.dataset.tab)));

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.style.cssText = "position:fixed;left:50%;bottom:100px;transform:translateX(-50%);" +
        "background:rgba(0,0,0,.82);color:#fff;padding:10px 18px;border-radius:22px;font-size:14px;" +
        "z-index:99;max-width:80%;text-align:center;transition:opacity .25s;pointer-events:none;";
      document.body.appendChild(el);
    }
    el.textContent = msg; el.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.style.opacity = "0"), 1800);
  }

  // 启动
  refreshHomeStats();
  showView("home");

  // PWA Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
