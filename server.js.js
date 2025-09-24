// ==========================
// package.json (복사 후 별도 파일로 저장)
// ==========================
// {
//   "name": "mini-board",
//   "version": "1.1.0",
//   "main": "server.js",
//   "type": "module",
//   "scripts": {
//     "start": "node server.js"
//   },
//   "dependencies": {
//     "express": "^4.19.2",
//     "sqlite3": "^5.1.7",
//     "morgan": "^1.10.0"
//   }
// }

// ==========================
// server.js
// ==========================
import express from 'express';
import sqlite3 from 'sqlite3';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

sqlite3.verbose();
const dbFile = path.join(__dirname, 'board.db');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

function escapeHTML(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function layout({ title = '비상교육 공지사항', body = '' }) {
  return `<!doctype html>
  <html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHTML(title)}</title>
    <style>
      :root { --bg:#f9fbff; --card:#ffffff; --ink:#334155; --muted:#94a3b8; --accent:#93c5fd; }
      *{ box-sizing:border-box; }
      body{ margin:0; background:var(--bg); color:var(--ink); font-family:'Noto Sans KR', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; }
      a{ color:var(--accent); text-decoration:none; }
      .wrap{ max-width:900px; margin:32px auto; padding:0 16px; }
      header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
      .brand{ font-weight:800; font-size:26px; color:var(--accent); }
      .card{ background:var(--card); border:1px solid #e5e7eb; border-radius:16px; padding:20px; box-shadow:0 4px 12px rgba(0,0,0,0.05); margin-bottom:16px; }
      .row{ display:flex; gap:12px; align-items:center; }
      input[type=text], textarea{ width:100%; background:#f3f4f6; color:var(--ink); border:1px solid #d1d5db; border-radius:12px; padding:12px; font-size:14px; }
      input[type=text]:focus, textarea:focus{ outline:none; border-color:var(--accent); background:#fff; }
      textarea{ min-height:160px; line-height:1.5; }
      .btn{ display:inline-block; padding:10px 16px; border-radius:12px; border:1px solid #d1d5db; background:#f9fafb; color:var(--ink); cursor:pointer; font-size:14px; transition:all 0.2s; white-space:nowrap; }
      .btn:hover{ background:#f3f4f6; }
      .btn.primary{ background:var(--accent); border-color:var(--accent); color:#fff; box-shadow:0 1px 0 rgba(0,0,0,0.03); }
      .btn.primary:hover{ background:#60a5fa; }
      .btn.danger{ background:#dc2626; border-color:#dc2626; color:#fff; }
      .btn.danger:hover{ background:#b91c1c; }
      .toolbar{ display:flex; gap:8px; flex-wrap:wrap; }
      .spacer{ flex:1; }
      .muted{ color:var(--muted); font-size:14px; }
      table{ width:100%; border-collapse:collapse; }
      th{ text-align:left; font-weight:600; padding:12px; background:#f3f4f6; }
      td{ padding:12px; border-bottom:1px solid #e5e7eb; }
      .pagination{ display:flex; gap:8px; justify-content:center; margin-top:16px; }
      .pagination a, .pagination span{ padding:8px 12px; border:1px solid #d1d5db; border-radius:10px; background:#f9fafb; font-size:14px; }
      .pagination a:hover{ background:#f3f4f6; }
      form.inline{ display:inline; }
      footer{ text-align:center; margin-top:32px; font-size:13px; color:var(--muted); }
      .meta{ display:flex; gap:12px; align-items:center; color:var(--muted); font-size:13px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <div class="brand"><a href="/">비상교육 공지사항</a></div>
        <nav class="toolbar">
          <a class="btn primary" href="/write">글쓰기</a>
          <a class="btn" href="/">목록</a>
        </nav>
      </header>
      ${body}
      <footer>Made with Express + SQLite</footer>
    </div>
  </body>
  </html>`;
}

// ========== 목록 페이지(검색+페이지네이션) ==========
app.get('/', (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = 10;
  const offset = (page - 1) * pageSize;
  const q = (req.query.q || '').trim();

  const where = q ? `WHERE title LIKE ? OR content LIKE ?` : '';
  const params = q ? [`%${q}%`, `%${q}%`] : [];

  db.get(`SELECT COUNT(*) as cnt FROM posts ${where}`, params, (err, countRow) => {
    if (err) return res.status(500).send('DB 오류: ' + err.message);

    const total = countRow?.cnt || 0;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    db.all(
      `SELECT id, title, substr(content,1,200) AS snippet, views, datetime(created_at, '+9 hours') as created_at
       FROM posts ${where}
       ORDER BY id DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params,
      (err2, rows) => {
        if (err2) return res.status(500).send('DB 오류: ' + err2.message);

        const list = rows
          .map((p) => `
            <tr>
              <td style="width:72px;" class="muted">#${p.id}</td>
              <td>
                <a href="/post/${p.id}">${escapeHTML(p.title)}</a>
                <div class="muted" style="font-size:12px; margin-top:4px;">${escapeHTML(p.snippet)}${p.snippet && p.snippet.length>=200 ? '…' : ''}</div>
              </td>
              <td style="width:80px;" class="muted">${p.views ?? 0}</td>
              <td style="width:180px;" class="muted">${escapeHTML(p.created_at || '')}</td>
            </tr>`)
          .join('');

        const pagination = (() => {
          const items = [];
          const make = (p, label, isCurrent=false) => isCurrent
            ? `<span>${label}</span>`
            : `<a href="/?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ''}">${label}</a>`;
          if (page > 1) items.push(make(page - 1, '이전'));
          for (let i = 1; i <= totalPages; i++) items.push(make(i, String(i), i === page));
          if (page < totalPages) items.push(make(page + 1, '다음'));
          return `<div class="pagination">${items.join('')}</div>`;
        })();

        const body = `
          <div class="card" style="margin-bottom:16px;">
            <form method="GET" action="/" class="row">
              <input type="text" name="q" placeholder="제목/내용 검색" value="${escapeHTML(q)}" />
              <button class="btn primary" type="submit">검색</button>
            </form>
          </div>
          <div class="card">
            <table>
              <thead>
                <tr><th style="width:72px;">ID</th><th>제목 / 내용</th><th style="width:80px;">조회</th><th style="width:180px;">작성일</th></tr>
              </thead>
              <tbody>
                ${list || '<tr><td colspan="4" class="muted">글이 없습니다. 첫 글을 작성해 보세요.</td></tr>'}
              </tbody>
            </table>
            ${pagination}
          </div>`;

        res.send(layout({ title: '비상교육 공지사항', body }));
      }
    );
  });
});

// 이하 나머지 코드는 동일합니다...

app.listen(PORT, () => {
  console.log(`✅ Mini Board running at http://localhost:${PORT}`);
});
