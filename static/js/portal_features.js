document.addEventListener('DOMContentLoaded', () => {



    // 対象ラベル → 色マップ（annual_events と共通）
    const EV_TARGET_COLORS = {
        '全校':'#FADBD8','中学':'#D6EAF8','高１':'#D5F5E3',
        '高２':'#FCF3CF','高３':'#FDEBD0','教職員':'#D7BDE2','その他':'#D5D8DC'
    };

    function getEvBackground(targets, fallbackColor) {
        if (!targets || targets.length === 0) return fallbackColor || '#F0F0F0';
        if (targets.length === 1) return EV_TARGET_COLORS[targets[0]] || fallbackColor || '#F0F0F0';
        const colors = targets.map(t => EV_TARGET_COLORS[t] || '#F0F0F0');
        const n = colors.length;
        const stops = [];
        colors.forEach((c, i) => {
            const start = i === 0 ? 0 : Math.round(i * 10000 / n) / 100;
            const end   = i === n - 1 ? 100 : Math.round((i + 1) * 10000 / n) / 100;
            stops.push(`${c} ${start}%`, `${c} ${end}%`);
        });
        return `linear-gradient(to right, ${stops.join(', ')})`;
    }

    // 共通関数: 今日の日付取得
    function getTodayStr() {
        const d = new Date();
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    }

    // ==========================================
    // 1. サブミッションズリストの処理 (Firebase版)
    // ==========================================
    const indexTableBody = document.getElementById('active-list-body');
    const allSubmissionsBody = document.getElementById('all-submissions-body');
    const addBtn = document.getElementById('add-btn');
    const modal = document.getElementById('modal-overlay');
    const btnCancel = document.getElementById('modal-cancel');
    const btnSubmit = document.getElementById('modal-submit');

    let submissions = [];
    let loadSubmissions = async () => {};

    // 描画関数
    function renderSubmissions(tbody, showAll) {
        if (!tbody) return;
        tbody.innerHTML = '';
        const displayData = showAll ? submissions : submissions.filter(s => s.status === 'active');

        // クラウド側で並び替えているためそのまま表示
        if (displayData.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="5" style="text-align:center;color:#aaa;padding:20px;font-size:14px;">登録されたサブミッションズはありません</td>`;
            tbody.appendChild(tr);
        } else {
        displayData.forEach(data => {
            const tr = document.createElement('tr');
            const linkHtml = data.url ? `<a href="${data.url}" class="link-btn" target="_blank">開く</a>` : `<span style="color:#ccc;">-</span>`;

            let statusHtml = '';
            let actionHtml = '';
            let deleteBtnHtml = showAll ? `<button class="delete-submission-btn" data-id="${data.id}" style="background-color: transparent; color: #d9534f; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px; margin-left: 12px;">削除</button>` : '';

            if (data.status === 'completed') {
                statusHtml = `<span style="background-color: #e0e0e0; color: #666; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 8px;">終了済み</span>`;
                actionHtml = `<button class="reactivate-submission-btn" data-id="${data.id}" style="background-color: transparent; color: #2c8c5a; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px;">取り消し</button>` + deleteBtnHtml;
            } else {
                actionHtml = `<button class="complete-btn" data-id="${data.id}" style="background-color: transparent; color: #aaa; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px;">終了</button>` + deleteBtnHtml;
            }

            tr.innerHTML = `<td>${data.title} ${statusHtml}</td><td>${data.dept}</td><td>${data.deadline}</td><td>${linkHtml}</td><td>${actionHtml}</td>`;
            tbody.appendChild(tr);
        });
        }
    }

    // DOMガード: submissions関連の要素がないページでは起動しない
    if (indexTableBody || allSubmissionsBody) {
        loadSubmissions = async function() {
            await ensureCacheVersionChecked();
            const cached = getSC('sc_submissions');
            if (cached) {
                submissions = cached;
                renderSubmissions(indexTableBody, false);
                renderSubmissions(allSubmissionsBody, true);
                return;
            }
            try {
                const snap = await db.collection('submissions').orderBy('createdAt', 'desc').get();
                submissions = [];
                snap.forEach(doc => submissions.push({ id: doc.id, ...doc.data() }));
                setSC('sc_submissions', submissions);
            } catch(e) { console.error('loadSubmissions error:', e); }
            renderSubmissions(indexTableBody, false);
            renderSubmissions(allSubmissionsBody, true);
        };
        loadSubmissions();
    }

    // ボタン操作（終了・削除）
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('complete-btn')) {
            if(confirm('このタスクを終了済みにしますか？（トップページからは非表示になります）')) {
                const id = e.target.getAttribute('data-id');
                db.collection('submissions').doc(id).update({ status: 'completed' }).then(() => { clearSC('sc_submissions'); updateCacheVersion(); loadSubmissions(); });
            }
        }
        if (e.target.classList.contains('reactivate-submission-btn')) {
            if(confirm('終了済みを取り消して、進行中に戻しますか？')) {
                const id = e.target.getAttribute('data-id');
                db.collection('submissions').doc(id).update({ status: 'active' }).then(() => { clearSC('sc_submissions'); updateCacheVersion(); loadSubmissions(); });
            }
        }
        if (e.target.classList.contains('delete-submission-btn')) {
            if(confirm('このタスクを完全に削除しますか？（元に戻せません）')) {
                const id = e.target.getAttribute('data-id');
                db.collection('submissions').doc(id).delete().then(() => { clearSC('sc_submissions'); updateCacheVersion(); loadSubmissions(); });
            }
        }
    });

    // 新規追加
    if (addBtn && modal) {
        addBtn.addEventListener('click', () => {
            document.getElementById('item-title').value = '';
            document.getElementById('item-dept').value = ''; 
            document.getElementById('item-date').value = ''; 
            document.getElementById('item-url').value = '';
            modal.classList.remove('hidden');
        });

        btnCancel.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

        btnSubmit.addEventListener('click', () => {
            const title = document.getElementById('item-title').value.trim();
            const dept = document.getElementById('item-dept').value.trim() || '指定なし';
            const dateInput = document.getElementById('item-date').value;
            const url = document.getElementById('item-url').value.trim();

            if (!title) { alert('内容を入力してください。'); return; }

            let deadlineStr = "-";
            if (dateInput) {
                const d = new Date(dateInput);
                deadlineStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
            }
            
            db.collection('submissions').add({
                title: title, dept: dept, deadline: deadlineStr, url: url, status: 'active',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                modal.classList.add('hidden');
                clearSC('sc_submissions'); updateCacheVersion(); loadSubmissions();
            });
        });
    }

    // ==========================================
    // ★修正：共有掲示板の処理 (Firebase版)
    // ==========================================
    const boardTableBody = document.getElementById('board-list-body');
    const allBoardsBody  = document.getElementById('all-boards-body');
    const addBoardBtn    = document.getElementById('add-board-btn');

    let boards = [];
    let loadBoards = async () => {};
    let editingBoardId = null;

    const BOARD_DEPT_OPTIONS_HTML = ['教職員','進路指導部','教務部','生徒指導部','入試対策部','総務部','生徒会'].map(d => `<option value="${d}"></option>`).join('');

    function renderBoards(tbody, showAll) {
        if (!tbody) return;
        tbody.innerHTML = '';
        const displayData = showAll ? boards : boards.filter(b => b.status === 'active');

        if (displayData.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="4" style="text-align:center;color:#aaa;padding:20px;font-size:14px;">登録された掲示板はありません</td>`;
            tbody.appendChild(tr);
            return;
        }

        displayData.forEach(data => {
            const tr = document.createElement('tr');
            const type = data.type || '';

            let titleHtml;
            if (type === 'multi') {
                titleHtml = `<span class="board-multi-link" data-id="${data.id}" style="color:#4A4643; font-weight:bold; cursor:pointer; text-decoration:underline;">${data.title}</span>`;
            } else if (type === 'page') {
                titleHtml = `<a href="./column_detail.html?id=${data.columnId}&board_id=${data.id}&source=boards_list" style="color:#4A4643; font-weight:bold; text-decoration:underline;">${data.title}</a>`;
            } else if (data.url) {
                titleHtml = `<a href="${data.url}" target="_blank" style="color:#4A4643; font-weight:bold; text-decoration:underline;">${data.title}</a>`;
            } else {
                titleHtml = `<a href="./board_edit.html?edit_id=${data.id}" style="color:#4A4643; font-weight:bold; text-decoration:underline;">${data.title}</a>`;
            }

            const statusHtml = data.status === 'completed' ? `<span style="background-color:#e0e0e0; color:#666; padding:2px 6px; border-radius:4px; font-size:12px; margin-left:8px;">終了済み</span>` : '';
            const editBtnHtml = type
                ? `<button class="edit-board-btn" data-id="${data.id}" style="background:transparent; color:#0066cc; border:none; font-size:13px; cursor:pointer; text-decoration:underline; padding:4px;">編集</button>`
                : `<a href="./board_edit.html?edit_id=${data.id}" style="color:#0066cc; font-size:13px; text-decoration:underline; padding:4px;">編集</a>`;
            const deleteBtnHtml = showAll ? `<button class="delete-board-btn" data-id="${data.id}" style="background:transparent; color:#d9534f; border:none; font-size:13px; cursor:pointer; text-decoration:underline; padding:4px; margin-left:8px;">削除</button>` : '';
            const actionHtml = data.status === 'completed'
                ? `<span style="color:#ccc; font-size:12px;">操作不可</span>` + deleteBtnHtml
                : editBtnHtml + `<button class="complete-board-btn" data-id="${data.id}" style="background:transparent; color:#aaa; border:none; font-size:13px; cursor:pointer; text-decoration:underline; padding:4px;">終了</button>` + deleteBtnHtml;

            tr.innerHTML = `<td>${titleHtml} ${statusHtml}</td><td>${data.dept || ''}</td><td>${data.period || ''}</td><td>${actionHtml}</td>`;
            tbody.appendChild(tr);
        });
    }

    if (boardTableBody || allBoardsBody || addBoardBtn) {
        loadBoards = async function() {
            await ensureCacheVersionChecked();
            const cached = getSC('sc_boards');
            if (cached) {
                boards = cached;
                renderBoards(boardTableBody, false);
                renderBoards(allBoardsBody, true);
                return;
            }
            try {
                const snap = await db.collection('boards').orderBy('createdAt', 'desc').get();
                boards = [];
                snap.forEach(doc => boards.push({ id: doc.id, ...doc.data() }));
                setSC('sc_boards', boards);
            } catch(e) { console.error('loadBoards error:', e); }
            renderBoards(boardTableBody, false);
            renderBoards(allBoardsBody, true);
        };
        loadBoards();

        // ── 種類選択モーダル ──────────────────────────────────────
        const bTypeCardStyle = 'display:flex; align-items:flex-start; gap:14px; padding:14px 16px; border:1px solid #E6E4DF; border-radius:8px; background:#fff; cursor:pointer; text-align:left; width:100%; transition:border-color 0.2s;';
        const bTypeModal = document.createElement('div');
        bTypeModal.className = 'modal-overlay hidden';
        bTypeModal.innerHTML = `
            <div class="modal-content" style="max-width:480px;">
                <h3 class="modal-title">掲示の種類を選択</h3>
                <div style="display:flex; flex-direction:column; gap:10px; margin:4px 0 8px;">
                    <button id="b-type-simple" style="${bTypeCardStyle}">
                        <span style="font-size:22px; flex:0 0 auto; margin-top:2px;">🔗</span>
                        <div><div style="font-weight:bold; font-size:14px; margin-bottom:3px;">シンプルリンク</div><div style="font-size:12px; color:#888;">1つのリンクを開く掲示</div></div>
                    </button>
                    <button id="b-type-multi" style="${bTypeCardStyle}">
                        <span style="font-size:22px; flex:0 0 auto; margin-top:2px;">📋</span>
                        <div><div style="font-weight:bold; font-size:14px; margin-bottom:3px;">マルチリンク</div><div style="font-size:12px; color:#888;">クリックすると複数リンクから選択できる</div></div>
                    </button>
                    <button id="b-type-page" style="${bTypeCardStyle}">
                        <span style="font-size:22px; flex:0 0 auto; margin-top:2px;">📝</span>
                        <div><div style="font-weight:bold; font-size:14px; margin-bottom:3px;">フリーページ</div><div style="font-size:12px; color:#888;">自由に書き込めるページ</div></div>
                    </button>
                </div>
                <div class="modal-actions"><button id="b-type-cancel" class="btn-cancel">キャンセル</button></div>
            </div>
        `;
        document.body.appendChild(bTypeModal);

        // ── シンプルリンクモーダル ────────────────────────────────
        const bSimpleModal = document.createElement('div');
        bSimpleModal.className = 'modal-overlay hidden';
        bSimpleModal.innerHTML = `
            <div class="modal-content">
                <h3 id="b-simple-modal-title" class="modal-title">シンプルリンクを追加</h3>
                <div class="form-group"><label>タイトル</label><input type="text" id="b-simple-title" class="modal-input" placeholder="例：令和8年度 学校便り"></div>
                <div class="form-group">
                    <label>部署</label>
                    <input type="text" id="b-simple-dept" class="modal-input" list="b-simple-dept-options" placeholder="選択または入力してください">
                    <datalist id="b-simple-dept-options">${BOARD_DEPT_OPTIONS_HTML}</datalist>
                </div>
                <div class="form-group"><label>掲載期間</label><input type="text" id="b-simple-period" class="modal-input" placeholder="例：〜4/30"></div>
                <div class="form-group"><label>リンク先 (URL)</label><input type="text" id="b-simple-url" class="modal-input" placeholder="https://..."></div>
                <div class="modal-actions"><button id="b-simple-cancel" class="btn-cancel">キャンセル</button><button id="b-simple-submit" class="btn-submit">追加</button></div>
            </div>
        `;
        document.body.appendChild(bSimpleModal);

        // ── マルチリンクモーダル ──────────────────────────────────
        const bMultiModal = document.createElement('div');
        bMultiModal.className = 'modal-overlay hidden';
        bMultiModal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <h3 id="b-multi-modal-title" class="modal-title">マルチリンクを追加</h3>
                <div class="form-group"><label>タイトル</label><input type="text" id="b-multi-title" class="modal-input" placeholder="例：参考資料一覧"></div>
                <div class="form-group">
                    <label>部署</label>
                    <input type="text" id="b-multi-dept" class="modal-input" list="b-multi-dept-options" placeholder="選択または入力してください">
                    <datalist id="b-multi-dept-options">${BOARD_DEPT_OPTIONS_HTML}</datalist>
                </div>
                <div class="form-group"><label>掲載期間</label><input type="text" id="b-multi-period" class="modal-input" placeholder="例：〜4/30"></div>
                <div class="form-group">
                    <label>リンク一覧</label>
                    <div id="b-multi-links-container" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"></div>
                    <button id="b-multi-add-link" type="button" style="width:100%; padding:8px; border:1px dashed #aaa; border-radius:6px; background:#fafafa; color:#555; cursor:pointer; font-size:13px;">＋ リンクを追加</button>
                </div>
                <div class="modal-actions"><button id="b-multi-cancel" class="btn-cancel">キャンセル</button><button id="b-multi-submit" class="btn-submit">追加</button></div>
            </div>
        `;
        document.body.appendChild(bMultiModal);

        // ── フリーページ新規モーダル ──────────────────────────────
        const bPageModal = document.createElement('div');
        bPageModal.className = 'modal-overlay hidden';
        bPageModal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <h3 class="modal-title">フリーページを追加</h3>
                <p style="font-size:13px; color:#666; margin:-8px 0 16px;">情報を入力すると、ページ編集画面に移動します。</p>
                <div class="form-group"><label>タイトル</label><input type="text" id="b-page-title" class="modal-input" placeholder="例：職員会議資料"></div>
                <div class="form-group">
                    <label>部署</label>
                    <input type="text" id="b-page-dept" class="modal-input" list="b-page-dept-options" placeholder="選択または入力してください">
                    <datalist id="b-page-dept-options">${BOARD_DEPT_OPTIONS_HTML}</datalist>
                </div>
                <div class="form-group"><label>掲載期間</label><input type="text" id="b-page-period" class="modal-input" placeholder="例：〜4/30"></div>
                <div class="modal-actions"><button id="b-page-cancel" class="btn-cancel">キャンセル</button><button id="b-page-submit" class="btn-submit">ページを作成 →</button></div>
            </div>
        `;
        document.body.appendChild(bPageModal);

        // ── フリーページ編集モーダル ──────────────────────────────
        const bPageEditModal = document.createElement('div');
        bPageEditModal.className = 'modal-overlay hidden';
        bPageEditModal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <h3 class="modal-title">フリーページを編集</h3>
                <div class="form-group"><label>タイトル</label><input type="text" id="b-page-edit-title" class="modal-input"></div>
                <div class="form-group">
                    <label>部署</label>
                    <input type="text" id="b-page-edit-dept" class="modal-input" list="b-page-edit-dept-options">
                    <datalist id="b-page-edit-dept-options">${BOARD_DEPT_OPTIONS_HTML}</datalist>
                </div>
                <div class="form-group"><label>掲載期間</label><input type="text" id="b-page-edit-period" class="modal-input"></div>
                <div style="margin-bottom:16px;">
                    <a id="b-page-edit-link" href="#" style="font-size:13px; color:#2c8c5a; text-decoration:none; display:inline-flex; align-items:center; gap:6px; padding:9px 14px; border:1px solid #c3e6d6; border-radius:6px; background:#f0faf5;">📝 ページ内容を編集する →</a>
                </div>
                <div class="modal-actions"><button id="b-page-edit-cancel" class="btn-cancel">キャンセル</button><button id="b-page-edit-submit" class="btn-submit">保存</button></div>
            </div>
        `;
        document.body.appendChild(bPageEditModal);

        // ── リンク選択モーダル（マルチリンク用）─────────────────
        const bLinkSelectModal = document.createElement('div');
        bLinkSelectModal.className = 'modal-overlay hidden';
        bLinkSelectModal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <h3 id="b-link-select-title" class="modal-title"></h3>
                <div id="b-link-select-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:4px;"></div>
                <div class="modal-actions"><button id="b-link-select-close" class="btn-cancel">閉じる</button></div>
            </div>
        `;
        document.body.appendChild(bLinkSelectModal);

        // ── イベントハンドラ ─────────────────────────────────────

        // 追加ボタン
        if (addBoardBtn) {
            addBoardBtn.addEventListener('click', () => { editingBoardId = null; bTypeModal.classList.remove('hidden'); });
        }

        // 種類選択
        document.getElementById('b-type-cancel').addEventListener('click', () => bTypeModal.classList.add('hidden'));
        bTypeModal.addEventListener('click', (e) => { if (e.target === bTypeModal) bTypeModal.classList.add('hidden'); });
        document.getElementById('b-type-simple').addEventListener('click', () => { bTypeModal.classList.add('hidden'); bOpenSimpleModal(null); });
        document.getElementById('b-type-multi').addEventListener('click',  () => { bTypeModal.classList.add('hidden'); bOpenMultiModal(null); });
        document.getElementById('b-type-page').addEventListener('click', () => {
            bTypeModal.classList.add('hidden');
            document.getElementById('b-page-title').value = '';
            document.getElementById('b-page-dept').value  = '';
            document.getElementById('b-page-period').value = '';
            bPageModal.classList.remove('hidden');
        });

        // シンプルリンク
        function bOpenSimpleModal(item) {
            document.getElementById('b-simple-title').value  = item ? item.title : '';
            document.getElementById('b-simple-dept').value   = item ? (item.dept || '') : '';
            document.getElementById('b-simple-period').value = item ? (item.period || '') : '';
            document.getElementById('b-simple-url').value    = item ? (item.url || '') : '';
            document.getElementById('b-simple-modal-title').textContent = item ? 'シンプルリンクを編集' : 'シンプルリンクを追加';
            document.getElementById('b-simple-submit').textContent = item ? '更新' : '追加';
            bSimpleModal.classList.remove('hidden');
        }
        document.getElementById('b-simple-cancel').addEventListener('click', () => { bSimpleModal.classList.add('hidden'); editingBoardId = null; });
        bSimpleModal.addEventListener('click', (e) => { if (e.target === bSimpleModal) { bSimpleModal.classList.add('hidden'); editingBoardId = null; } });
        document.getElementById('b-simple-submit').addEventListener('click', () => {
            const title  = document.getElementById('b-simple-title').value.trim();
            const dept   = document.getElementById('b-simple-dept').value.trim() || '教職員';
            const period = document.getElementById('b-simple-period').value.trim();
            const url    = document.getElementById('b-simple-url').value.trim();
            if (!title || !url) { alert('タイトルとURLは必ず入力してください。'); return; }
            const data = { type: 'simple', title, dept, period, url };
            if (editingBoardId) {
                db.collection('boards').doc(editingBoardId).update(data).then(() => {
                    editingBoardId = null; bSimpleModal.classList.add('hidden'); clearSC('sc_boards'); updateCacheVersion(); loadBoards();
                });
            } else {
                data.status = 'active';
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                db.collection('boards').add(data).then(() => { bSimpleModal.classList.add('hidden'); clearSC('sc_boards'); updateCacheVersion(); loadBoards(); });
            }
        });

        // マルチリンク
        function bAddMultiLinkRow(container, linkTitle, linkUrl) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; gap:6px; align-items:center;';
            row.innerHTML = `
                <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                    <input type="text" class="b-multi-link-title modal-input" placeholder="リンクのタイトル" style="margin:0; font-size:13px; padding:6px 10px;">
                    <input type="text" class="b-multi-link-url modal-input" placeholder="https://..." style="margin:0; font-size:13px; padding:6px 10px;">
                </div>
                <button type="button" class="b-multi-link-remove" style="flex:0 0 auto; background:transparent; color:#d9534f; border:1px solid #d9534f; border-radius:4px; cursor:pointer; padding:4px 8px; font-weight:bold; align-self:center;">×</button>
            `;
            if (linkTitle) row.querySelector('.b-multi-link-title').value = linkTitle;
            if (linkUrl)   row.querySelector('.b-multi-link-url').value   = linkUrl;
            row.querySelector('.b-multi-link-remove').addEventListener('click', () => row.remove());
            container.appendChild(row);
        }
        function bOpenMultiModal(item) {
            const container = document.getElementById('b-multi-links-container');
            container.innerHTML = '';
            document.getElementById('b-multi-title').value  = item ? item.title : '';
            document.getElementById('b-multi-dept').value   = item ? (item.dept || '') : '';
            document.getElementById('b-multi-period').value = item ? (item.period || '') : '';
            document.getElementById('b-multi-modal-title').textContent = item ? 'マルチリンクを編集' : 'マルチリンクを追加';
            document.getElementById('b-multi-submit').textContent = item ? '更新' : '追加';
            if (item && item.links && item.links.length > 0) {
                item.links.forEach(link => bAddMultiLinkRow(container, link.title, link.url));
            } else {
                bAddMultiLinkRow(container, '', '');
            }
            bMultiModal.classList.remove('hidden');
        }
        document.getElementById('b-multi-add-link').addEventListener('click', () => bAddMultiLinkRow(document.getElementById('b-multi-links-container'), '', ''));
        document.getElementById('b-multi-cancel').addEventListener('click', () => { bMultiModal.classList.add('hidden'); editingBoardId = null; });
        bMultiModal.addEventListener('click', (e) => { if (e.target === bMultiModal) { bMultiModal.classList.add('hidden'); editingBoardId = null; } });
        document.getElementById('b-multi-submit').addEventListener('click', () => {
            const title  = document.getElementById('b-multi-title').value.trim();
            const dept   = document.getElementById('b-multi-dept').value.trim() || '教職員';
            const period = document.getElementById('b-multi-period').value.trim();
            if (!title) { alert('タイトルを入力してください。'); return; }
            const links = [];
            document.querySelectorAll('#b-multi-links-container > div').forEach(row => {
                const lt = row.querySelector('.b-multi-link-title').value.trim();
                const lu = row.querySelector('.b-multi-link-url').value.trim();
                if (lt && lu) links.push({ title: lt, url: lu });
            });
            if (links.length === 0) { alert('リンクを1件以上入力してください。'); return; }
            const data = { type: 'multi', title, dept, period, links };
            if (editingBoardId) {
                db.collection('boards').doc(editingBoardId).update(data).then(() => {
                    editingBoardId = null; bMultiModal.classList.add('hidden'); clearSC('sc_boards'); updateCacheVersion(); loadBoards();
                });
            } else {
                data.status = 'active';
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                db.collection('boards').add(data).then(() => { bMultiModal.classList.add('hidden'); clearSC('sc_boards'); updateCacheVersion(); loadBoards(); });
            }
        });

        // フリーページ新規
        document.getElementById('b-page-cancel').addEventListener('click', () => bPageModal.classList.add('hidden'));
        bPageModal.addEventListener('click', (e) => { if (e.target === bPageModal) bPageModal.classList.add('hidden'); });
        document.getElementById('b-page-submit').addEventListener('click', () => {
            const title  = document.getElementById('b-page-title').value.trim();
            const dept   = document.getElementById('b-page-dept').value.trim() || '教職員';
            const period = document.getElementById('b-page-period').value.trim();
            if (!title) { alert('タイトルを入力してください。'); return; }
            bPageModal.classList.add('hidden');
            const params = new URLSearchParams({ source: 'boards_list', bl_title: title, bl_dept: dept, bl_period: period });
            window.location.href = `./column_edit.html?${params.toString()}`;
        });

        // フリーページ編集
        function bOpenPageEditModal(item) {
            document.getElementById('b-page-edit-title').value  = item.title;
            document.getElementById('b-page-edit-dept').value   = item.dept || '';
            document.getElementById('b-page-edit-period').value = item.period || '';
            document.getElementById('b-page-edit-link').href    = `./column_edit.html?edit_id=${item.columnId}&source=boards_list_edit`;
            bPageEditModal.classList.remove('hidden');
        }
        document.getElementById('b-page-edit-cancel').addEventListener('click', () => { bPageEditModal.classList.add('hidden'); editingBoardId = null; });
        bPageEditModal.addEventListener('click', (e) => { if (e.target === bPageEditModal) { bPageEditModal.classList.add('hidden'); editingBoardId = null; } });
        document.getElementById('b-page-edit-submit').addEventListener('click', () => {
            if (!editingBoardId) return;
            const title  = document.getElementById('b-page-edit-title').value.trim();
            const dept   = document.getElementById('b-page-edit-dept').value.trim() || '教職員';
            const period = document.getElementById('b-page-edit-period').value.trim();
            if (!title) { alert('タイトルを入力してください。'); return; }
            db.collection('boards').doc(editingBoardId).update({ title, dept, period }).then(() => {
                editingBoardId = null; bPageEditModal.classList.add('hidden'); clearSC('sc_boards'); updateCacheVersion(); loadBoards();
            });
        });

        // リンク選択（マルチリンク用）
        function bOpenLinkSelectModal(item) {
            document.getElementById('b-link-select-title').textContent = item.title;
            const list = document.getElementById('b-link-select-list');
            list.innerHTML = '';
            (item.links || []).forEach(link => {
                const a = document.createElement('a');
                a.href = link.url;
                a.target = '_blank';
                a.style.cssText = 'display:block; padding:12px 14px; border:1px solid #E6E4DF; border-radius:6px; text-decoration:none; color:#4A4643; background:#fff; transition:background 0.15s;';
                a.textContent = link.title || link.url;
                a.onmouseover = () => a.style.backgroundColor = '#F7F7F5';
                a.onmouseout  = () => a.style.backgroundColor = '#fff';
                list.appendChild(a);
            });
            bLinkSelectModal.classList.remove('hidden');
        }
        document.getElementById('b-link-select-close').addEventListener('click', () => bLinkSelectModal.classList.add('hidden'));
        bLinkSelectModal.addEventListener('click', (e) => { if (e.target === bLinkSelectModal) bLinkSelectModal.classList.add('hidden'); });

        // デリゲーションクリック
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('board-multi-link')) {
                const id = e.target.getAttribute('data-id');
                const item = boards.find(b => b.id === id);
                if (item) bOpenLinkSelectModal(item);
            }
            if (e.target.classList.contains('edit-board-btn')) {
                const id = e.target.getAttribute('data-id');
                const item = boards.find(b => b.id === id);
                if (item) {
                    editingBoardId = id;
                    if (item.type === 'multi')      bOpenMultiModal(item);
                    else if (item.type === 'page')  bOpenPageEditModal(item);
                    else                            bOpenSimpleModal(item);
                }
            }
            if (e.target.classList.contains('complete-board-btn')) {
                if (confirm('この掲示を終了済みにしますか？')) {
                    const id = e.target.getAttribute('data-id');
                    db.collection('boards').doc(id).update({ status: 'completed' }).then(() => { clearSC('sc_boards'); updateCacheVersion(); loadBoards(); });
                }
            }
            if (e.target.classList.contains('delete-board-btn')) {
                if (confirm('完全に削除しますか？')) {
                    const id = e.target.getAttribute('data-id');
                    const item = boards.find(b => b.id === id);
                    if (item && item.type === 'page' && item.columnId) {
                        db.collection('board_columns').doc(item.columnId).delete().catch(() => {});
                    }
                    db.collection('boards').doc(id).delete().then(() => { clearSC('sc_boards'); updateCacheVersion(); loadBoards(); });
                }
            }
        });
    }

    // ==========================================
    // ★修正: コラムデータの管理と画面遷移 (Firebase版)
    // ==========================================
    let columns = [];
    let drafts = [];
    let loadColumns = async () => {};

    function makeTitleIcon(title) {
        const chars = (title || '無題').slice(0, 2);
        let hash = 0;
        for (let i = 0; i < (title || '').length; i++) {
            hash = (title.charCodeAt(i) + ((hash << 5) - hash)) | 0;
        }
        const hue = Math.abs(hash) % 360;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">`
            + `<rect width="400" height="400" fill="hsl(${hue},35%,78%)"/>`
            + `<text x="200" y="200" dominant-baseline="central" text-anchor="middle"`
            + ` font-family="sans-serif" font-size="160" font-weight="bold" fill="hsl(${hue},35%,28%)">${chars}</text>`
            + `</svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function createColumnCard(col) {
        const imgSrc = col.img ? col.img : makeTitleIcon(col.title || '');
        const authorStr = col.author || '教職員';
        const tagsArray = authorStr.split(/[\s　]+/).filter(tag => tag.length > 0);
        const tagsHtml = tagsArray.map(tag => `<span class="column-tag">${tag}</span>`).join('');

        return `
            <div class="column-card" data-id="${col.id}">
                <button class="delete-col-btn" title="削除">×</button>
                <button class="edit-col-btn" title="編集"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                <img src="${imgSrc}" alt="サムネイル" class="column-img">
                <div class="column-content">
                    <div class="column-title">${col.title}</div>
                    <div class="column-tags">
                        ${tagsHtml}
                        <span class="column-tag">${col.date}</span>
                    </div>
                    ${col.authorName ? `<div style="font-size:11px; color:#888; margin-top:4px;">👤 ${col.authorName}</div>` : ''}
                </div>
            </div>
        `;
    }

    function setupColumnCardEvents(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.addEventListener('click', (e) => {
            const card = e.target.closest('.column-card');
            if (!card) return;
            const colId = card.getAttribute('data-id');

            if (e.target.classList.contains('delete-col-btn')) {
                if (confirm('このコラムを削除してもよろしいですか？')) {
                    db.collection('columns').doc(colId).delete().then(() => { clearSC('sc_columns'); updateCacheVersion(); loadColumns(); });
                }
                return;
            }
            if (e.target.classList.contains('edit-col-btn')) {
                window.location.href = `./column_edit.html?edit_id=${colId}`;
                return;
            }
            window.location.href = `./column_detail.html?id=${colId}`;
        });
    }

    const colContainer = document.getElementById('column-list-container');
    const allColContainer = document.getElementById('all-columns-container');

    if (colContainer || allColContainer) {
        loadColumns = async function() {
            await ensureCacheVersionChecked();
            const cached = getSC('sc_columns');
            if (cached) {
                columns = cached;
            } else {
                try {
                    const snap = await db.collection('columns').orderBy('createdAt', 'desc').get();
                    columns = [];
                    snap.forEach(doc => { const d = doc.data(); if (!d.isDashboardPage) columns.push({ id: doc.id, ...d }); });
                    setSC('sc_columns', columns);
                } catch(e) { console.error('loadColumns error:', e); }
            }
            if (colContainer) {
                const sortedCols = [...columns].slice(0, 4);
                if (sortedCols.length === 0) {
                    colContainer.innerHTML = '<div style="color:#bbb; text-align:center; padding:32px; font-size:13px; grid-column:1/-1;">コラムはありません<br><small>右上の「＋ 新規」から追加できます</small></div>';
                } else {
                    colContainer.innerHTML = sortedCols.map(createColumnCard).join('');
                    setupColumnCardEvents('column-list-container');
                }
            }
            if (allColContainer && typeof renderAllColumns === 'function') { renderAllColumns(); }
        };
        loadColumns();
    }

    // ★フィルター＆ソート機能（一覧ページのみ）
    if (allColContainer) {
        const controlsDiv = document.createElement('div');
        controlsDiv.style.cssText = 'display: flex; gap: 16px; margin-bottom: 20px; align-items: center;';
        
        const filterSelect = document.createElement('select');
        filterSelect.style.cssText = 'padding: 8px 12px; border-radius: 6px; border: 1px solid #E6E4DF; outline: none; font-size: 14px; background-color: #fff; color: #4A4643; cursor: pointer;';
        
        const sortSelect = document.createElement('select');
        sortSelect.style.cssText = 'padding: 8px 12px; border-radius: 6px; border: 1px solid #E6E4DF; outline: none; font-size: 14px; background-color: #fff; color: #4A4643; cursor: pointer;';
        sortSelect.innerHTML = `<option value="date-desc">📅 日付 (新しい順)</option><option value="date-asc">📅 日付 (古い順)</option><option value="title-asc">あ タイトル (昇順)</option><option value="title-desc">ん タイトル (降順)</option>`;

        controlsDiv.appendChild(filterSelect);
        controlsDiv.appendChild(sortSelect);
        allColContainer.parentNode.insertBefore(controlsDiv, allColContainer);

        window.renderAllColumns = function() {
            // タグリストの更新
            const allTags = new Set();
            columns.forEach(col => {
                const tagsArray = (col.author || '教職員').split(/[\s　]+/).filter(t => t.length > 0);
                tagsArray.forEach(t => allTags.add(t));
            });
            const currentFilter = filterSelect.value;
            filterSelect.innerHTML = `<option value="">🏷️ すべてのタグ</option>` + Array.from(allTags).map(tag => `<option value="${tag}">${tag}</option>`).join('');
            filterSelect.value = currentFilter || "";

            const filterValue = filterSelect.value;
            const sortValue = sortSelect.value;

            let filteredCols = columns.filter(col => {
                if (!filterValue) return true;
                return (col.author || '教職員').split(/[\s　]+/).filter(t => t.length > 0).includes(filterValue);
            });

            filteredCols.sort((a, b) => {
                if (sortValue === 'date-desc') return b.createdAt - a.createdAt;
                if (sortValue === 'date-asc') return a.createdAt - b.createdAt; 
                if (sortValue === 'title-asc') return a.title.localeCompare(b.title, 'ja'); 
                if (sortValue === 'title-desc') return b.title.localeCompare(a.title, 'ja');
            });

            if (filteredCols.length === 0) {
                allColContainer.innerHTML = '<div style="color:#bbb; text-align:center; padding:32px; font-size:13px; grid-column:1/-1;">コラムはありません<br><small>右上の「＋ 新規」から追加できます</small></div>';
            } else {
                allColContainer.innerHTML = filteredCols.map(createColumnCard).join('');
            }
            setupColumnCardEvents('all-columns-container');
        };

        filterSelect.addEventListener('change', renderAllColumns);
        sortSelect.addEventListener('change', renderAllColumns);
    }

    // ==========================================
    // ★修正: アプリケーション機能 (Firebase版)
    // ==========================================
    const webappGrid = document.getElementById('webapp-grid');
    if (webappGrid) {
        const editWebappBtn = document.getElementById('edit-webapp-btn');
        const addWebappBtn = document.getElementById('add-webapp-btn');
        let webappItems = [];
        let loadWebapps = async () => {};
        let isWebappEditMode = false;
        let editingWebappId = null;
        const WEBAPP_TAG_COLORS = {
            '教職員': '#FADBD8', '全校': '#FADBD8',
            '進路指導部': '#D6EAF8', '中学': '#D6EAF8',
            '教務部': '#D5F5E3', '高１': '#D5F5E3',
            '生徒指導部': '#FCF3CF', '高２': '#FCF3CF',
            '入試対策部': '#E8DAEF', '高３': '#E8DAEF',
            '総務部': '#F0F0F0', 'その他': '#F0F0F0',
            '生徒会': '#FAE5D3', '独自アプリ': '#D1F2EB'
        };

        const webappDetailModal = document.createElement('div');
        webappDetailModal.className = 'modal-overlay hidden';
        webappDetailModal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                    <h3 id="detail-webapp-title" class="modal-title" style="margin: 0; font-size: 20px;"></h3>
                    <span id="detail-webapp-tag" style="font-size: 11px; color: #666; background: #F7F7F5; border: 1px solid #E6E4DF; padding: 4px 10px; border-radius: 12px; margin-left: 12px; white-space: nowrap;"></span>
                </div>
                <div id="detail-webapp-desc" style="font-size: 14px; color: #4A4643; margin-bottom: 24px; white-space: pre-wrap; line-height: 1.6; background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #eee;"></div>
                <div class="modal-actions" style="justify-content: flex-end;">
                    <button id="detail-webapp-close" class="btn-cancel" style="margin-right: 8px;">閉じる</button>
                    <a id="detail-webapp-open" href="#" target="_blank" class="btn-submit" style="text-decoration: none; display: inline-block; text-align: center;">開く</a>
                </div>
            </div>
        `;
        document.body.appendChild(webappDetailModal);
        document.getElementById('detail-webapp-close').addEventListener('click', () => webappDetailModal.classList.add('hidden'));
        webappDetailModal.addEventListener('click', (e) => { if (e.target === webappDetailModal) webappDetailModal.classList.add('hidden'); });

        function renderWebapps() {
            webappGrid.innerHTML = '';
            webappGrid.style.display = 'grid';
            webappGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(116px, 1fr))';
            webappGrid.style.gap = '12px';

            if (webappItems.length === 0) {
                webappGrid.innerHTML = '<div style="color:#bbb; text-align:center; padding:32px; font-size:13px; grid-column:1/-1;">登録されたアプリはありません<br><small>右上の「＋ 新規」から追加できます</small></div>';
                return;
            }

            webappItems.forEach(item => {
                const card = document.createElement('div');
                const tagColor = WEBAPP_TAG_COLORS[item.tag] || '#EBEBEB';
                card.dataset.id = item.id;
                card.style.cssText = `position:relative; background:#fff; border:${isWebappEditMode ? '2px dashed #0066cc' : '1px solid #E6E4DF'}; border-radius:12px; padding:16px 10px 12px; display:flex; flex-direction:column; align-items:center; text-align:center; cursor:${isWebappEditMode ? 'grab' : 'pointer'}; transition:box-shadow 0.2s, transform 0.2s; user-select:none;`;

                if (!isWebappEditMode) {
                    card.onmouseover = () => { card.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; card.style.transform = 'translateY(-2px)'; };
                    card.onmouseout = () => { card.style.boxShadow = ''; card.style.transform = ''; };
                }

                const iconLetter = item.title ? item.title.charAt(0).toUpperCase() : '?';
                let editOverlay = '';
                if (isWebappEditMode) {
                    card.setAttribute('draggable', 'true');
                    editOverlay = `
                        <div style="position:absolute; top:5px; left:7px; font-size:16px; color:#bbb; user-select:none; pointer-events:none; line-height:1;">⠿</div>
                        <div style="position:absolute; top:-10px; right:-8px; display:flex; background:#fff; border:1px solid #E6E4DF; border-radius:4px; padding:2px; box-shadow:0 2px 4px rgba(0,0,0,0.1); z-index:10;">
                            <button class="edit-webapp-item-btn" data-id="${item.id}" title="編集" style="background:transparent; color:#0066cc; border:none; cursor:pointer; font-size:13px; padding:1px 4px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                            <button class="delete-webapp-btn" data-id="${item.id}" title="削除" style="background:transparent; color:#d9534f; border:none; cursor:pointer; font-size:15px; font-weight:bold; padding:1px 4px;">×</button>
                        </div>
                    `;
                }

                card.innerHTML = `
                    ${editOverlay}
                    <div style="width:56px; height:56px; border-radius:14px; background:${tagColor}; display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:bold; color:#4A4643; margin-bottom:10px; border:1px solid rgba(0,0,0,0.07); flex-shrink:0; ${isWebappEditMode ? 'opacity:0.65;' : ''}">${iconLetter}</div>
                    <div style="font-size:12px; font-weight:bold; color:#4A4643; line-height:1.4; width:100%; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; margin-bottom:5px; ${isWebappEditMode ? 'opacity:0.65;' : ''}">${item.title}</div>
                    <div style="font-size:10px; color:#555; background:${tagColor}; padding:2px 7px; border-radius:10px; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.tag || ''}</div>
                `;

                if (!isWebappEditMode) {
                    card.addEventListener('click', () => {
                        document.getElementById('detail-webapp-title').textContent = item.title;
                        document.getElementById('detail-webapp-tag').textContent = item.tag;
                        document.getElementById('detail-webapp-desc').textContent = item.description || '説明文はありません。';
                        document.getElementById('detail-webapp-open').href = item.url;
                        webappDetailModal.classList.remove('hidden');
                    });
                }

                webappGrid.appendChild(card);
            });
        }

        loadWebapps = async function() {
            await ensureCacheVersionChecked();
            const cached = getSC('sc_webapps');
            if (cached) {
                webappItems = cached;
                renderWebapps();
                return;
            }
            try {
                const snap = await db.collection('webapps').get();
                webappItems = [];
                snap.forEach(doc => webappItems.push({ id: doc.id, ...doc.data() }));
                webappItems.sort((a, b) => {
                    const orderA = a.order !== undefined ? a.order : (a.createdAt ? a.createdAt.seconds : 0);
                    const orderB = b.order !== undefined ? b.order : (b.createdAt ? b.createdAt.seconds : 0);
                    return orderA - orderB;
                });
                webappItems.forEach((item, idx) => { item.order = idx; });
                setSC('sc_webapps', webappItems);
            } catch(e) { console.error('loadWebapps error:', e); }
            renderWebapps();
        };
        loadWebapps();

        editWebappBtn.addEventListener('click', () => {
            isWebappEditMode = !isWebappEditMode;
            editWebappBtn.textContent = isWebappEditMode ? '完了' : '編集';
            editWebappBtn.style.color = isWebappEditMode ? '#0066cc' : '#aaa';
            editWebappBtn.style.textDecoration = isWebappEditMode ? 'none' : 'underline';
            renderWebapps();
        });

        webappGrid.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            if (!id) return;

            if (e.target.classList.contains('delete-webapp-btn')) {
                const item = webappItems.find(i => i.id === id);
                if (item && confirm(`アプリ「${item.title}」を削除しますか？`)) {
                    db.collection('webapps').doc(id).delete().then(() => { clearSC('sc_webapps'); updateCacheVersion(); loadWebapps(); });
                }
            }
            if (e.target.classList.contains('edit-webapp-item-btn')) {
                const item = webappItems.find(i => i.id === id);
                if (item) {
                    editingWebappId = id;
                    document.getElementById('webapp-title').value = item.title;
                    document.getElementById('webapp-tag').value = item.tag;
                    document.getElementById('webapp-desc').value = item.description;
                    document.getElementById('webapp-url').value = item.url;
                    document.getElementById('webapp-submit').textContent = '更新';
                    document.querySelector('#webapp-modal-overlay .modal-title').textContent = 'アプリケーションを編集';
                    webappModal.classList.remove('hidden');
                }
            }
        });

        // webappGrid ドラッグ＆ドロップ並び替え
        let _webDndSrcId = null;
        webappGrid.addEventListener('dragstart', (e) => {
            if (e.target.tagName === 'BUTTON') { e.preventDefault(); return; }
            const card = e.target.closest('[draggable]');
            if (!card || !card.dataset.id) return;
            _webDndSrcId = card.dataset.id;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => { card.style.opacity = '0.4'; }, 0);
        });
        webappGrid.addEventListener('dragend', () => {
            webappGrid.querySelectorAll('[draggable]').forEach(c => { c.style.opacity = ''; c.style.outline = ''; });
        });
        webappGrid.addEventListener('dragover', (e) => {
            e.preventDefault();
            const card = e.target.closest('[draggable]');
            if (!card) return;
            webappGrid.querySelectorAll('[draggable]').forEach(c => { c.style.outline = ''; });
            if (card.dataset.id !== _webDndSrcId) card.style.outline = '2px solid #0066cc';
            e.dataTransfer.dropEffect = 'move';
        });
        webappGrid.addEventListener('drop', async (e) => {
            e.preventDefault();
            webappGrid.querySelectorAll('[draggable]').forEach(c => { c.style.opacity = ''; c.style.outline = ''; });
            const targetCard = e.target.closest('[draggable]');
            if (!targetCard || !_webDndSrcId || targetCard.dataset.id === _webDndSrcId) return;
            const srcIdx = webappItems.findIndex(i => i.id === _webDndSrcId);
            const tgtIdx = webappItems.findIndex(i => i.id === targetCard.dataset.id);
            if (srcIdx === -1 || tgtIdx === -1) return;
            const arr = [...webappItems];
            const [moved] = arr.splice(srcIdx, 1);
            arr.splice(tgtIdx, 0, moved);
            const batch = db.batch();
            arr.forEach((item, idx) => { batch.update(db.collection('webapps').doc(item.id), { order: idx }); });
            await batch.commit();
            clearSC('sc_webapps'); updateCacheVersion(); loadWebapps();
        });

        const webappModal = document.createElement('div');
        webappModal.id = 'webapp-modal-overlay';
        webappModal.className = 'modal-overlay hidden';
        webappModal.innerHTML = `
            <div class="modal-content">
                <h3 class="modal-title">アプリケーションを追加</h3>
                <div class="form-group"><label>タイトル</label><input type="text" id="webapp-title" class="modal-input" placeholder="例：時間割管理アプリ"></div>
                <div class="form-group">
                    <label>タグ</label><input type="text" id="webapp-tag" class="modal-input" list="webapp-tag-options" placeholder="選択または入力してください">
                    <datalist id="webapp-tag-options"><option value="教職員"></option><option value="進路指導部"></option><option value="教務部"></option><option value="生徒指導部"></option><option value="入試対策部"></option><option value="総務部"></option><option value="生徒会"></option><option value="学習サポート"></option><option value="事務"></option><option value="独自アプリ"></option></datalist>
                </div>
                <div class="form-group"><label>説明文</label><textarea id="webapp-desc" class="modal-input" rows="4" placeholder="アプリの概要や使い方を入力してください（改行可能）" style="resize: vertical;"></textarea></div>
                <div class="form-group"><label>リンク先 (URL)</label><input type="text" id="webapp-url" class="modal-input" placeholder="https://..."></div>
                <div class="modal-actions"><button id="webapp-cancel" class="btn-cancel">キャンセル</button><button id="webapp-submit" class="btn-submit">追加</button></div>
            </div>
        `;
        document.body.appendChild(webappModal);

        addWebappBtn.addEventListener('click', () => {
            editingWebappId = null;
            document.getElementById('webapp-title').value = ''; document.getElementById('webapp-tag').value = '';
            document.getElementById('webapp-desc').value = ''; document.getElementById('webapp-url').value = '';
            document.getElementById('webapp-submit').textContent = '追加';
            document.querySelector('#webapp-modal-overlay .modal-title').textContent = 'アプリケーションを追加';
            webappModal.classList.remove('hidden');
        });
        document.getElementById('webapp-cancel').addEventListener('click', () => webappModal.classList.add('hidden'));

        document.getElementById('webapp-submit').addEventListener('click', () => {
            const title = document.getElementById('webapp-title').value.trim();
            const tag = document.getElementById('webapp-tag').value.trim() || 'アプリ';
            const desc = document.getElementById('webapp-desc').value.trim();
            const url = document.getElementById('webapp-url').value.trim();
            if (!title || !url) { alert('タイトルとリンクは必ず入力してください。'); return; }

            const data = { title, tag, description: desc, url };

            if (editingWebappId) {
                db.collection('webapps').doc(editingWebappId).update(data).then(() => { webappModal.classList.add('hidden'); clearSC('sc_webapps'); updateCacheVersion(); loadWebapps(); });
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                data.order = webappItems.length;
                db.collection('webapps').add(data).then(() => { webappModal.classList.add('hidden'); clearSC('sc_webapps'); updateCacheVersion(); loadWebapps(); });
            }
        });
    }

    // ==========================================
    // ★追加: ダッシュボード機能 (Firebase版)
    // ==========================================
    const dashboardGrid = document.getElementById('dashboard-grid');
    if (dashboardGrid) {
        const editDashBtn = document.getElementById('edit-dashboard-btn');
        const addDashBtn = document.getElementById('add-dashboard-btn');
        let dashboardItems = [];
        let isDashEditMode = false;
        let editingDashId = null;
        let dashTagOrder = [];

        dashboardGrid.style.display = 'block';

        const DASH_TAG_COLORS = {
            '教職員': '#FADBD8', '全校': '#FADBD8',
            '進路指導部': '#D6EAF8', '中学': '#D6EAF8',
            '教務部': '#D5F5E3', '高１': '#D5F5E3',
            '生徒指導部': '#FCF3CF', '高２': '#FCF3CF',
            '入試対策部': '#E8DAEF', '高３': '#E8DAEF',
            '総務部': '#F0F0F0', 'その他': '#F0F0F0',
            '生徒会': '#FAE5D3', '書類': '#E3F0FB',
            '学習サポート': '#C8F7F1',
            '事務': '#F5E6D3'
        };
        const DASH_TAG_LIST = ['書類', '教職員', '進路指導部', '教務部', '生徒指導部', '入試対策部', '総務部', '生徒会', '学習サポート', '事務'];
        const dashTagOptionsHtml = DASH_TAG_LIST.map(t => `<option value="${t}"></option>`).join('');
        const editIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;

        // ── レンダリング ──────────────────────────────────────────
        function renderDashboard() {
            dashboardGrid.innerHTML = '';
            if (dashboardItems.length === 0) {
                dashboardGrid.innerHTML = '<div style="color:#bbb; text-align:center; padding:32px; font-size:13px;">登録されたカードはありません<br><small>右上の「＋ 新規」から追加できます</small></div>';
                return;
            }
            const groups = {};
            const naturalTagOrder = [];
            dashboardItems.forEach(item => {
                const tag = item.tag || 'その他';
                if (!groups[tag]) { groups[tag] = []; naturalTagOrder.push(tag); }
                groups[tag].push(item);
            });
            // dashTagOrder 順で並べ替え（未登録タグは末尾に追加）
            const sortedTags = [...dashTagOrder.filter(t => groups[t])];
            naturalTagOrder.forEach(t => { if (!sortedTags.includes(t)) sortedTags.push(t); });
            sortedTags.forEach(tag => {
                const items = groups[tag];
                const color = DASH_TAG_COLORS[tag] || '#F0F0F0';
                const section = document.createElement('div');
                section.dataset.sectionTag = tag;
                section.style.cssText = `margin-bottom:16px; border:1px solid ${isDashEditMode ? '#0066cc' : '#E6E4DF'}; border-radius:8px; overflow:hidden;`;
                const header = document.createElement('div');
                if (isDashEditMode) {
                    header.setAttribute('draggable', 'true');
                    header.dataset.tagSection = tag;
                    header.style.cssText = `background:${color}; padding:7px 16px; font-size:12px; font-weight:bold; color:#4A4643; border-bottom:1px solid rgba(0,0,0,0.07); letter-spacing:0.04em; cursor:grab; display:flex; align-items:center; gap:8px;`;
                    header.innerHTML = `<span style="color:#aaa; font-size:16px; user-select:none; flex:0 0 auto; pointer-events:none;">⠿</span><span>${tag}</span>`;
                } else {
                    header.style.cssText = `background:${color}; padding:7px 16px; font-size:12px; font-weight:bold; color:#4A4643; border-bottom:1px solid rgba(0,0,0,0.07); letter-spacing:0.04em;`;
                    header.textContent = tag;
                }
                section.appendChild(header);
                items.forEach((item, idx) => {
                    const row = document.createElement('div');
                    const isLast = idx === items.length - 1;
                    row.dataset.id = item.id;
                    row.dataset.tag = tag;
                    if (isDashEditMode) {
                        row.setAttribute('draggable', 'true');
                        row.style.cssText = `display:flex; align-items:center; gap:10px; padding:10px 14px; background:#fff; ${isLast ? '' : 'border-bottom:1px solid #F0EEE9;'} cursor:grab;`;
                        const typeIcon = item.type === 'multi' ? '📋' : item.type === 'page' ? '📝' : '🔗';
                        row.innerHTML = `
                            <span style="color:#bbb; font-size:20px; user-select:none; flex:0 0 auto; pointer-events:none;">⠿</span>
                            <span style="font-size:14px; flex:0 0 auto; pointer-events:none;">${typeIcon}</span>
                            <span style="flex:1; font-size:14px; color:#4A4643; opacity:0.7;">${item.title}</span>
                            <button class="edit-dash-item-btn" data-id="${item.id}" title="編集" style="background:transparent; color:#0066cc; border:none; cursor:pointer; padding:2px 6px;">${editIconSvg}</button>
                            <button class="delete-dash-btn" data-id="${item.id}" title="削除" style="background:transparent; color:#d9534f; border:none; cursor:pointer; font-size:18px; font-weight:bold; padding:2px 6px;">×</button>
                        `;
                    } else {
                        row.style.cssText = `display:flex; align-items:center; padding:10px 16px; gap:12px; background:#fff; ${isLast ? '' : 'border-bottom:1px solid #F0EEE9;'} transition:background 0.15s;`;
                        row.onmouseover = () => row.style.backgroundColor = '#F7F7F5';
                        row.onmouseout = () => row.style.backgroundColor = '#fff';
                        if (item.type === 'multi') {
                            row.style.cursor = 'pointer';
                            const linkCount = (item.links || []).length;
                            row.innerHTML = `
                                <span style="flex:1; font-size:14px; color:#4A4643;">${item.title}</span>
                                <span style="font-size:12px; color:#888; white-space:nowrap;">${linkCount}件 ▸</span>
                            `;
                            row.addEventListener('click', () => openLinkSelectModal(item));
                        } else if (item.type === 'page') {
                            row.style.cursor = 'pointer';
                            row.innerHTML = `
                                <span style="flex:1; font-size:14px; color:#4A4643;">${item.title}</span>
                                <span style="font-size:12px; color:#2c8c5a; white-space:nowrap;">開く →</span>
                            `;
                            row.addEventListener('click', () => { window.location.href = `./column_detail.html?id=${item.columnId}&dash_id=${item.id}&source=dashboard`; });
                        } else {
                            row.innerHTML = `
                                <span style="flex:1; font-size:14px; color:#4A4643;">${item.title}</span>
                                <a href="${item.url || '#'}" target="_blank" style="font-size:12px; color:#2c8c5a; text-decoration:none; white-space:nowrap; padding:4px 10px; border:1px solid #c3e6d6; border-radius:4px; background:#f0faf5; transition:all 0.15s;"
                                   onmouseover="this.style.backgroundColor='#2c8c5a'; this.style.color='#fff';"
                                   onmouseout="this.style.backgroundColor='#f0faf5'; this.style.color='#2c8c5a';">開く ↗</a>
                            `;
                        }
                    }
                    section.appendChild(row);
                });
                dashboardGrid.appendChild(section);
            });
        }

        let loadDashboard = async () => {};
        loadDashboard = async function() {
            await ensureCacheVersionChecked();
            const cachedItems = getSC('sc_dashboards');
            const cachedTagOrder = getSC('sc_dash_tagorder');
            if (cachedItems !== null && cachedTagOrder !== null) {
                dashboardItems = cachedItems;
                dashTagOrder = cachedTagOrder;
                renderDashboard();
                return;
            }
            try {
                const [snap, tagDoc] = await Promise.all([
                    db.collection('dashboards').get(),
                    db.collection('settings').doc('dashboardTagOrder').get()
                ]);
                dashboardItems = [];
                snap.forEach(doc => dashboardItems.push({ id: doc.id, ...doc.data() }));
                dashboardItems.sort((a, b) => {
                    const orderA = a.order !== undefined ? a.order : (a.createdAt ? a.createdAt.seconds : 0);
                    const orderB = b.order !== undefined ? b.order : (b.createdAt ? b.createdAt.seconds : 0);
                    return orderA - orderB;
                });
                dashboardItems.forEach((item, index) => { item.order = index; });
                dashTagOrder = (tagDoc.exists && Array.isArray(tagDoc.data().order)) ? tagDoc.data().order : [];
                setSC('sc_dashboards', dashboardItems);
                setSC('sc_dash_tagorder', dashTagOrder);
            } catch(e) { console.error('loadDashboard error:', e); }
            renderDashboard();
        };
        loadDashboard().then(() => {
            // 他ページ用データをバックグラウンドでプリフェッチ（MDM環境対策）
            const prefetchTargets = [
                { key: 'sc_boards',      fetch: () => db.collection('boards').orderBy('createdAt', 'desc').get(), filter: null },
                { key: 'sc_submissions', fetch: () => db.collection('submissions').get(), filter: null },
                { key: 'sc_timetables', fetch: () => db.collection('timetables').get(), filter: null },
                { key: 'sc_columns',     fetch: () => db.collection('columns').get(), filter: d => !d.isDashboardPage },
            ];
            Promise.all(prefetchTargets.map(async ({ key, fetch, filter }) => {
                if (getSC(key) !== null) return;
                try {
                    const snap = await fetch();
                    const items = [];
                    snap.forEach(doc => { const d = doc.data(); if (!filter || filter(d)) items.push({ id: doc.id, ...d }); });
                    setSC(key, items);
                } catch(e) {}
            }));
        });

        editDashBtn.addEventListener('click', () => {
            isDashEditMode = !isDashEditMode;
            editDashBtn.textContent = isDashEditMode ? '完了' : '編集';
            editDashBtn.style.color = isDashEditMode ? '#0066cc' : '#aaa';
            editDashBtn.style.textDecoration = isDashEditMode ? 'none' : 'underline';
            renderDashboard();
        });

        // ── 編集モードのクリックハンドラ（SVG子要素対応）────────
        dashboardGrid.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-id]');
            if (!btn) return;
            const id = btn.getAttribute('data-id');
            if (btn.classList.contains('delete-dash-btn')) {
                const item = dashboardItems.find(i => i.id === id);
                if (item && confirm(`カード「${item.title}」を削除しますか？`)) {
                    if (item.type === 'page' && item.columnId) {
                        db.collection('columns').doc(item.columnId).delete().catch(() => {});
                    }
                    db.collection('dashboards').doc(id).delete().then(() => { clearSC('sc_dashboards'); clearSC('sc_dash_tagorder'); updateCacheVersion(); loadDashboard(); });
                }
            }
            if (btn.classList.contains('edit-dash-item-btn')) {
                const item = dashboardItems.find(i => i.id === id);
                if (item) {
                    editingDashId = id;
                    if (item.type === 'multi') { openMultiModal(item); }
                    else if (item.type === 'page') { openPageEditModal(item); }
                    else { openSimpleModal(item); }
                }
            }
        });

        // ── ドラッグ＆ドロップ（同タグ内のアイテム順 ＆ タグセクション順）───────────────────
        let _dashDndSrcId = null;
        let _dashDndSrcTag = null;
        let _dashSectionDndSrc = null;
        dashboardGrid.addEventListener('dragstart', (e) => {
            if (e.target.tagName === 'BUTTON') { e.preventDefault(); return; }
            const draggable = e.target.closest('[draggable]');
            if (!draggable) return;
            if (draggable.dataset.tagSection) {
                // タグセクションのドラッグ
                _dashSectionDndSrc = draggable.dataset.tagSection;
                _dashDndSrcId = null; _dashDndSrcTag = null;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { draggable.parentElement.style.opacity = '0.4'; }, 0);
            } else if (draggable.dataset.id) {
                // アイテム行のドラッグ
                _dashSectionDndSrc = null;
                _dashDndSrcId = draggable.dataset.id;
                _dashDndSrcTag = draggable.dataset.tag;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { draggable.style.opacity = '0.4'; }, 0);
            }
        });
        dashboardGrid.addEventListener('dragend', () => {
            dashboardGrid.querySelectorAll('[draggable]').forEach(r => { r.style.opacity = ''; r.style.boxShadow = ''; });
            dashboardGrid.querySelectorAll('[data-section-tag]').forEach(s => { s.style.opacity = ''; s.style.boxShadow = ''; });
        });
        dashboardGrid.addEventListener('dragover', (e) => {
            e.preventDefault();
            dashboardGrid.querySelectorAll('[draggable]').forEach(r => { r.style.boxShadow = ''; });
            dashboardGrid.querySelectorAll('[data-section-tag]').forEach(s => { s.style.boxShadow = ''; });
            if (_dashSectionDndSrc) {
                const targetSection = e.target.closest('[data-section-tag]');
                if (!targetSection || targetSection.dataset.sectionTag === _dashSectionDndSrc) return;
                const rect = targetSection.getBoundingClientRect();
                targetSection.style.boxShadow = e.clientY < rect.top + rect.height / 2 ? 'inset 0 2px 0 #0066cc' : 'inset 0 -2px 0 #0066cc';
                e.dataTransfer.dropEffect = 'move';
            } else if (_dashDndSrcId) {
                const row = e.target.closest('[draggable][data-id]');
                if (!row || row.dataset.id === _dashDndSrcId || row.dataset.tag !== _dashDndSrcTag) return;
                const rect = row.getBoundingClientRect();
                row.style.boxShadow = e.clientY < rect.top + rect.height / 2 ? 'inset 0 2px 0 #0066cc' : 'inset 0 -2px 0 #0066cc';
                e.dataTransfer.dropEffect = 'move';
            }
        });
        dashboardGrid.addEventListener('drop', async (e) => {
            e.preventDefault();
            dashboardGrid.querySelectorAll('[draggable]').forEach(r => { r.style.opacity = ''; r.style.boxShadow = ''; });
            dashboardGrid.querySelectorAll('[data-section-tag]').forEach(s => { s.style.opacity = ''; s.style.boxShadow = ''; });
            if (_dashSectionDndSrc) {
                // タグセクションの順番入れ替え
                const targetSection = e.target.closest('[data-section-tag]');
                if (!targetSection || targetSection.dataset.sectionTag === _dashSectionDndSrc) return;
                const currentOrder = [...dashboardGrid.querySelectorAll('[data-section-tag]')].map(s => s.dataset.sectionTag);
                const srcIdx = currentOrder.indexOf(_dashSectionDndSrc);
                const targetTag = targetSection.dataset.sectionTag;
                const rect = targetSection.getBoundingClientRect();
                const insertBefore = e.clientY < rect.top + rect.height / 2;
                const arr = [...currentOrder];
                const [moved] = arr.splice(srcIdx, 1);
                let insertIdx = arr.indexOf(targetTag);
                if (!insertBefore) insertIdx++;
                arr.splice(insertIdx, 0, moved);
                _dashSectionDndSrc = null;
                await db.collection('settings').doc('dashboardTagOrder').set({ order: arr });
                clearSC('sc_dashboards'); clearSC('sc_dash_tagorder'); updateCacheVersion(); loadDashboard();
            } else if (_dashDndSrcId) {
                // 同タグ内アイテムの順番入れ替え
                const targetRow = e.target.closest('[draggable][data-id]');
                if (!targetRow || !_dashDndSrcId || targetRow.dataset.id === _dashDndSrcId || targetRow.dataset.tag !== _dashDndSrcTag) return;
                const srcIdx = dashboardItems.findIndex(i => i.id === _dashDndSrcId);
                const rect = targetRow.getBoundingClientRect();
                const insertBefore = e.clientY < rect.top + rect.height / 2;
                const arr = [...dashboardItems];
                const [moved] = arr.splice(srcIdx, 1);
                let insertIdx = arr.findIndex(i => i.id === targetRow.dataset.id);
                if (!insertBefore) insertIdx++;
                arr.splice(insertIdx, 0, moved);
                const batch = db.batch();
                arr.forEach((item, idx) => { batch.update(db.collection('dashboards').doc(item.id), { order: idx }); });
                await batch.commit();
                clearSC('sc_dashboards'); clearSC('sc_dash_tagorder'); updateCacheVersion(); loadDashboard();
            }
        });

        // ── 1. 種類選択モーダル ──────────────────────────────────
        const typeCardStyle = 'display:flex; align-items:flex-start; gap:14px; padding:14px 16px; border:1px solid #E6E4DF; border-radius:8px; background:#fff; cursor:pointer; text-align:left; width:100%; transition:border-color 0.2s;';
        const dashTypeModal = document.createElement('div');
        dashTypeModal.className = 'modal-overlay hidden';
        dashTypeModal.innerHTML = `
            <div class="modal-content" style="max-width:480px;">
                <h3 class="modal-title">カードの種類を選択</h3>
                <div style="display:flex; flex-direction:column; gap:10px; margin:4px 0 8px;">
                    <button id="dash-type-simple" style="${typeCardStyle}">
                        <span style="font-size:22px; flex:0 0 auto; margin-top:2px;">🔗</span>
                        <div><div style="font-weight:bold; font-size:14px; margin-bottom:3px;">シンプルリンクカード</div><div style="font-size:12px; color:#888;">1つのリンクを開くシンプルなカード</div></div>
                    </button>
                    <button id="dash-type-multi" style="${typeCardStyle}">
                        <span style="font-size:22px; flex:0 0 auto; margin-top:2px;">📋</span>
                        <div><div style="font-weight:bold; font-size:14px; margin-bottom:3px;">マルチリンクカード</div><div style="font-size:12px; color:#888;">クリックすると複数リンクから選択するモーダルが開く</div></div>
                    </button>
                    <button id="dash-type-page" style="${typeCardStyle}">
                        <span style="font-size:22px; flex:0 0 auto; margin-top:2px;">📝</span>
                        <div><div style="font-weight:bold; font-size:14px; margin-bottom:3px;">フリーページカード</div><div style="font-size:12px; color:#888;">自由に書き込めるページを持つカード（コラム機能を使用）</div></div>
                    </button>
                </div>
                <div class="modal-actions"><button id="dash-type-cancel" class="btn-cancel">キャンセル</button></div>
            </div>
        `;
        document.body.appendChild(dashTypeModal);

        // ── 2. シンプルリンクモーダル ─────────────────────────────
        const dashModal = document.createElement('div');
        dashModal.id = 'dash-modal-overlay';
        dashModal.className = 'modal-overlay hidden';
        dashModal.innerHTML = `
            <div class="modal-content">
                <h3 id="dash-modal-title" class="modal-title">シンプルリンクカードを追加</h3>
                <div class="form-group"><label>タイトル</label><input type="text" id="dash-title" class="modal-input" placeholder="例：令和8年度 生徒指導規程"></div>
                <div class="form-group">
                    <label>タグ</label><input type="text" id="dash-tag" class="modal-input" list="dash-tag-options" placeholder="選択または入力してください">
                    <datalist id="dash-tag-options">${dashTagOptionsHtml}</datalist>
                </div>
                <div class="form-group"><label>リンク先 (URL)</label><input type="text" id="dash-url" class="modal-input" placeholder="https://..."></div>
                <div class="modal-actions"><button id="dash-cancel" class="btn-cancel">キャンセル</button><button id="dash-submit" class="btn-submit">追加</button></div>
            </div>
        `;
        document.body.appendChild(dashModal);

        // ── 3. マルチリンクモーダル ───────────────────────────────
        const dashMultiModal = document.createElement('div');
        dashMultiModal.className = 'modal-overlay hidden';
        dashMultiModal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <h3 id="dash-multi-modal-title" class="modal-title">マルチリンクカードを追加</h3>
                <div class="form-group"><label>カードタイトル</label><input type="text" id="dash-multi-title" class="modal-input" placeholder="例：参考資料一覧"></div>
                <div class="form-group">
                    <label>タグ</label><input type="text" id="dash-multi-tag" class="modal-input" list="dash-multi-tag-options" placeholder="選択または入力してください">
                    <datalist id="dash-multi-tag-options">${dashTagOptionsHtml}</datalist>
                </div>
                <div class="form-group">
                    <label>リンク一覧</label>
                    <div id="dash-multi-links-container" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"></div>
                    <button id="dash-multi-add-link" type="button" style="width:100%; padding:8px; border:1px dashed #aaa; border-radius:6px; background:#fafafa; color:#555; cursor:pointer; font-size:13px;">＋ リンクを追加</button>
                </div>
                <div class="modal-actions"><button id="dash-multi-cancel" class="btn-cancel">キャンセル</button><button id="dash-multi-submit" class="btn-submit">追加</button></div>
            </div>
        `;
        document.body.appendChild(dashMultiModal);

        // ── 4. フリーページ作成モーダル ──────────────────────────
        const dashPageModal = document.createElement('div');
        dashPageModal.className = 'modal-overlay hidden';
        dashPageModal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <h3 class="modal-title">フリーページカードを追加</h3>
                <p style="font-size:13px; color:#666; margin:-8px 0 16px;">カード情報を入力すると、ページ編集画面に移動します。</p>
                <div class="form-group"><label>カードタイトル</label><input type="text" id="dash-page-title" class="modal-input" placeholder="例：学校ニュース"></div>
                <div class="form-group">
                    <label>タグ</label><input type="text" id="dash-page-tag" class="modal-input" list="dash-page-tag-options" placeholder="選択または入力してください">
                    <datalist id="dash-page-tag-options">${dashTagOptionsHtml}</datalist>
                </div>
                <div class="modal-actions"><button id="dash-page-cancel" class="btn-cancel">キャンセル</button><button id="dash-page-submit" class="btn-submit">ページを作成 →</button></div>
            </div>
        `;
        document.body.appendChild(dashPageModal);

        // ── 5. フリーページ編集モーダル（タイトル/タグ変更）────────
        const dashPageEditModal = document.createElement('div');
        dashPageEditModal.className = 'modal-overlay hidden';
        dashPageEditModal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <h3 class="modal-title">フリーページカードを編集</h3>
                <div class="form-group"><label>カードタイトル</label><input type="text" id="dash-page-edit-title" class="modal-input"></div>
                <div class="form-group">
                    <label>タグ</label><input type="text" id="dash-page-edit-tag" class="modal-input" list="dash-page-edit-tag-options">
                    <datalist id="dash-page-edit-tag-options">${dashTagOptionsHtml}</datalist>
                </div>
                <div style="margin-bottom:16px;">
                    <a id="dash-page-edit-link" href="#" style="font-size:13px; color:#2c8c5a; text-decoration:none; display:inline-flex; align-items:center; gap:6px; padding:9px 14px; border:1px solid #c3e6d6; border-radius:6px; background:#f0faf5;">📝 ページ内容を編集する →</a>
                </div>
                <div class="modal-actions"><button id="dash-page-edit-cancel" class="btn-cancel">キャンセル</button><button id="dash-page-edit-submit" class="btn-submit">保存</button></div>
            </div>
        `;
        document.body.appendChild(dashPageEditModal);

        // ── 6. リンク選択モーダル（マルチリンク用）──────────────
        const dashLinkSelectModal = document.createElement('div');
        dashLinkSelectModal.className = 'modal-overlay hidden';
        dashLinkSelectModal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <h3 id="dash-link-select-title" class="modal-title"></h3>
                <div id="dash-link-select-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:4px;"></div>
                <div class="modal-actions"><button id="dash-link-select-close" class="btn-cancel">閉じる</button></div>
            </div>
        `;
        document.body.appendChild(dashLinkSelectModal);

        // ── イベントハンドラ ──────────────────────────────────────

        // 種類選択
        addDashBtn.addEventListener('click', () => { editingDashId = null; dashTypeModal.classList.remove('hidden'); });
        document.getElementById('dash-type-cancel').addEventListener('click', () => dashTypeModal.classList.add('hidden'));
        dashTypeModal.addEventListener('click', (e) => { if (e.target === dashTypeModal) dashTypeModal.classList.add('hidden'); });
        document.getElementById('dash-type-simple').addEventListener('click', () => { dashTypeModal.classList.add('hidden'); openSimpleModal(null); });
        document.getElementById('dash-type-multi').addEventListener('click', () => { dashTypeModal.classList.add('hidden'); openMultiModal(null); });
        document.getElementById('dash-type-page').addEventListener('click', () => {
            dashTypeModal.classList.add('hidden');
            document.getElementById('dash-page-title').value = '';
            document.getElementById('dash-page-tag').value = '';
            dashPageModal.classList.remove('hidden');
        });

        // シンプルリンク
        function openSimpleModal(item) {
            document.getElementById('dash-title').value = item ? item.title : '';
            document.getElementById('dash-tag').value = item ? (item.tag || '') : '';
            document.getElementById('dash-url').value = item ? (item.url || '') : '';
            document.getElementById('dash-modal-title').textContent = item ? 'シンプルリンクカードを編集' : 'シンプルリンクカードを追加';
            document.getElementById('dash-submit').textContent = item ? '更新' : '追加';
            dashModal.classList.remove('hidden');
        }
        document.getElementById('dash-cancel').addEventListener('click', () => { dashModal.classList.add('hidden'); editingDashId = null; });
        dashModal.addEventListener('click', (e) => { if (e.target === dashModal) { dashModal.classList.add('hidden'); editingDashId = null; } });
        document.getElementById('dash-submit').addEventListener('click', () => {
            const title = document.getElementById('dash-title').value.trim();
            const tag = document.getElementById('dash-tag').value.trim() || 'その他';
            const url = document.getElementById('dash-url').value.trim();
            if (!title || !url) { alert('タイトルとリンクは必ず入力してください。'); return; }
            const data = { type: 'simple', title, tag, url };
            if (editingDashId) {
                db.collection('dashboards').doc(editingDashId).update(data).then(() => { editingDashId = null; dashModal.classList.add('hidden'); clearSC('sc_dashboards'); clearSC('sc_dash_tagorder'); updateCacheVersion(); loadDashboard(); });
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                data.order = dashboardItems.length;
                db.collection('dashboards').add(data).then(() => { dashModal.classList.add('hidden'); clearSC('sc_dashboards'); clearSC('sc_dash_tagorder'); updateCacheVersion(); loadDashboard(); });
            }
        });

        // マルチリンク
        function addMultiLinkRow(container, linkTitle, linkUrl) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; gap:6px; align-items:center;';
            row.innerHTML = `
                <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                    <input type="text" class="multi-link-title modal-input" placeholder="リンクのタイトル" style="margin:0; font-size:13px; padding:6px 10px;">
                    <input type="text" class="multi-link-url modal-input" placeholder="https://..." style="margin:0; font-size:13px; padding:6px 10px;">
                </div>
                <button type="button" class="multi-link-remove" style="flex:0 0 auto; background:transparent; color:#d9534f; border:1px solid #d9534f; border-radius:4px; cursor:pointer; padding:4px 8px; font-weight:bold; align-self:center;">×</button>
            `;
            if (linkTitle) row.querySelector('.multi-link-title').value = linkTitle;
            if (linkUrl)   row.querySelector('.multi-link-url').value   = linkUrl;
            row.querySelector('.multi-link-remove').addEventListener('click', () => row.remove());
            container.appendChild(row);
        }
        function openMultiModal(item) {
            const container = document.getElementById('dash-multi-links-container');
            container.innerHTML = '';
            document.getElementById('dash-multi-title').value = item ? item.title : '';
            document.getElementById('dash-multi-tag').value = item ? (item.tag || '') : '';
            document.getElementById('dash-multi-modal-title').textContent = item ? 'マルチリンクカードを編集' : 'マルチリンクカードを追加';
            document.getElementById('dash-multi-submit').textContent = item ? '更新' : '追加';
            if (item && item.links && item.links.length > 0) {
                item.links.forEach(link => addMultiLinkRow(container, link.title, link.url));
            } else {
                addMultiLinkRow(container, '', '');
            }
            dashMultiModal.classList.remove('hidden');
        }
        document.getElementById('dash-multi-add-link').addEventListener('click', () => addMultiLinkRow(document.getElementById('dash-multi-links-container'), '', ''));
        document.getElementById('dash-multi-cancel').addEventListener('click', () => { dashMultiModal.classList.add('hidden'); editingDashId = null; });
        dashMultiModal.addEventListener('click', (e) => { if (e.target === dashMultiModal) { dashMultiModal.classList.add('hidden'); editingDashId = null; } });
        document.getElementById('dash-multi-submit').addEventListener('click', () => {
            const title = document.getElementById('dash-multi-title').value.trim();
            const tag = document.getElementById('dash-multi-tag').value.trim() || 'その他';
            if (!title) { alert('タイトルを入力してください。'); return; }
            const links = [];
            document.querySelectorAll('#dash-multi-links-container > div').forEach(row => {
                const lt = row.querySelector('.multi-link-title').value.trim();
                const lu = row.querySelector('.multi-link-url').value.trim();
                if (lt && lu) links.push({ title: lt, url: lu });
            });
            if (links.length === 0) { alert('リンクを1件以上入力してください。'); return; }
            const data = { type: 'multi', title, tag, links };
            if (editingDashId) {
                db.collection('dashboards').doc(editingDashId).update(data).then(() => { editingDashId = null; dashMultiModal.classList.add('hidden'); clearSC('sc_dashboards'); clearSC('sc_dash_tagorder'); updateCacheVersion(); loadDashboard(); });
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                data.order = dashboardItems.length;
                db.collection('dashboards').add(data).then(() => { dashMultiModal.classList.add('hidden'); clearSC('sc_dashboards'); clearSC('sc_dash_tagorder'); updateCacheVersion(); loadDashboard(); });
            }
        });

        // フリーページ作成
        document.getElementById('dash-page-cancel').addEventListener('click', () => dashPageModal.classList.add('hidden'));
        dashPageModal.addEventListener('click', (e) => { if (e.target === dashPageModal) dashPageModal.classList.add('hidden'); });
        document.getElementById('dash-page-submit').addEventListener('click', () => {
            const title = document.getElementById('dash-page-title').value.trim();
            const tag = document.getElementById('dash-page-tag').value.trim() || 'その他';
            if (!title) { alert('タイトルを入力してください。'); return; }
            dashPageModal.classList.add('hidden');
            const params = new URLSearchParams({ source: 'dashboard', dash_tag: tag, dash_title: title });
            window.location.href = `./column_edit.html?${params.toString()}`;
        });

        // フリーページ編集（タイトル/タグのみ。ページ内容はリンクから）
        function openPageEditModal(item) {
            document.getElementById('dash-page-edit-title').value = item.title;
            document.getElementById('dash-page-edit-tag').value = item.tag || '';
            document.getElementById('dash-page-edit-link').href = `./column_edit.html?edit_id=${item.columnId}&source=dashboard_edit`;
            dashPageEditModal.classList.remove('hidden');
        }
        document.getElementById('dash-page-edit-cancel').addEventListener('click', () => { dashPageEditModal.classList.add('hidden'); editingDashId = null; });
        dashPageEditModal.addEventListener('click', (e) => { if (e.target === dashPageEditModal) { dashPageEditModal.classList.add('hidden'); editingDashId = null; } });
        document.getElementById('dash-page-edit-submit').addEventListener('click', () => {
            if (!editingDashId) return;
            const title = document.getElementById('dash-page-edit-title').value.trim();
            const tag = document.getElementById('dash-page-edit-tag').value.trim() || 'その他';
            if (!title) { alert('タイトルを入力してください。'); return; }
            db.collection('dashboards').doc(editingDashId).update({ title, tag }).then(() => { editingDashId = null; dashPageEditModal.classList.add('hidden'); clearSC('sc_dashboards'); clearSC('sc_dash_tagorder'); updateCacheVersion(); loadDashboard(); });
        });

        // リンク選択（マルチリンクカードクリック時）
        function openLinkSelectModal(item) {
            document.getElementById('dash-link-select-title').textContent = item.title;
            const list = document.getElementById('dash-link-select-list');
            list.innerHTML = '';
            (item.links || []).forEach(link => {
                const a = document.createElement('a');
                a.href = link.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border:1px solid #E6E4DF; border-radius:6px; background:#fff; text-decoration:none; color:#4A4643; font-size:14px; transition:background 0.15s;';
                a.innerHTML = `<span>${link.title || link.url}</span><span style="font-size:12px; color:#2c8c5a; flex:0 0 auto; margin-left:12px;">開く ↗</span>`;
                a.onmouseover = () => a.style.background = '#F7F7F5';
                a.onmouseout  = () => a.style.background = '#fff';
                list.appendChild(a);
            });
            dashLinkSelectModal.classList.remove('hidden');
        }
        document.getElementById('dash-link-select-close').addEventListener('click', () => dashLinkSelectModal.classList.add('hidden'));
        dashLinkSelectModal.addEventListener('click', (e) => { if (e.target === dashLinkSelectModal) dashLinkSelectModal.classList.add('hidden'); });
    }

    // ==========================================
    // ★追加: 共有掲示板アイテム機能 (board_items)
    // ==========================================
    const boardsGrid = document.getElementById('boards-grid');
    if (boardsGrid) {
        const editBoardsBtn = document.getElementById('edit-boards-btn');
        const addBoardsBtn  = document.getElementById('add-boards-btn');
        let boardItems         = [];
        let isBoardItemEditMode = false;
        let editingBoardItemId  = null;
        let boardItemTagOrder   = [];

        const BI_TAG_COLORS = {
            '教職員': '#FADBD8', '全校': '#FADBD8',
            '進路指導部': '#D6EAF8', '中学': '#D6EAF8',
            '教務部': '#D5F5E3', '高１': '#D5F5E3',
            '生徒指導部': '#FCF3CF', '高２': '#FCF3CF',
            '入試対策部': '#E8DAEF', '高３': '#E8DAEF',
            '総務部': '#F0F0F0', 'その他': '#F0F0F0',
            '生徒会': '#FAE5D3', '書類': '#E3F0FB',
            '学習サポート': '#C8F7F1', '事務': '#F5E6D3'
        };
        const BI_TAG_LIST = ['書類', '教職員', '進路指導部', '教務部', '生徒指導部', '入試対策部', '総務部', '生徒会', '学習サポート', '事務'];
        const biTagOptionsHtml = BI_TAG_LIST.map(t => `<option value="${t}"></option>`).join('');
        const biEditIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;

        function clearBoardItemCaches() {
            ['sc_board_items','sc_board_tag_order'].forEach(k => clearSC(k));
        }

        function renderBoardsGrid() {
            boardsGrid.innerHTML = '';
            if (editBoardsBtn) {
                editBoardsBtn.textContent = isBoardItemEditMode ? '完了' : '編集';
                editBoardsBtn.style.color = isBoardItemEditMode ? '#0066cc' : '#aaa';
                editBoardsBtn.style.textDecoration = isBoardItemEditMode ? 'none' : 'underline';
            }
            if (addBoardsBtn) addBoardsBtn.style.display = isBoardItemEditMode ? '' : 'none';

            if (boardItems.length === 0) {
                boardsGrid.innerHTML = '<div style="color:#bbb; text-align:center; padding:32px; font-size:13px;">登録されたカードはありません<br><small>右上の「編集」→「＋ 追加」から追加できます</small></div>';
                return;
            }
            const groups = {};
            const naturalTagOrder = [];
            boardItems.forEach(item => {
                const tag = item.tag || 'その他';
                if (!groups[tag]) { groups[tag] = []; naturalTagOrder.push(tag); }
                groups[tag].push(item);
            });
            const sortedTags = [...boardItemTagOrder.filter(t => groups[t])];
            naturalTagOrder.forEach(t => { if (!sortedTags.includes(t)) sortedTags.push(t); });

            sortedTags.forEach(tag => {
                const items = groups[tag];
                const color = BI_TAG_COLORS[tag] || '#F0F0F0';
                const section = document.createElement('div');
                section.dataset.sectionTag = tag;
                section.style.cssText = `margin-bottom:16px; border:1px solid ${isBoardItemEditMode ? '#0066cc' : '#E6E4DF'}; border-radius:8px; overflow:hidden;`;
                const header = document.createElement('div');
                if (isBoardItemEditMode) {
                    header.setAttribute('draggable', 'true');
                    header.dataset.tagSection = tag;
                    header.style.cssText = `background:${color}; padding:7px 16px; font-size:12px; font-weight:bold; color:#4A4643; border-bottom:1px solid rgba(0,0,0,0.07); letter-spacing:0.04em; cursor:grab; display:flex; align-items:center; gap:8px;`;
                    header.innerHTML = `<span style="color:#aaa; font-size:16px; user-select:none; flex:0 0 auto; pointer-events:none;">⠿</span><span>${tag}</span>`;
                } else {
                    header.style.cssText = `background:${color}; padding:7px 16px; font-size:12px; font-weight:bold; color:#4A4643; border-bottom:1px solid rgba(0,0,0,0.07); letter-spacing:0.04em;`;
                    header.textContent = tag;
                }
                section.appendChild(header);
                items.forEach((item, idx) => {
                    const row = document.createElement('div');
                    const isLast = idx === items.length - 1;
                    row.dataset.id  = item.id;
                    row.dataset.tag = tag;
                    if (isBoardItemEditMode) {
                        row.setAttribute('draggable', 'true');
                        row.style.cssText = `display:flex; align-items:center; gap:10px; padding:10px 14px; background:#fff; ${isLast ? '' : 'border-bottom:1px solid #F0EEE9;'} cursor:grab;`;
                        const typeIcon = item.type === 'multi' ? '📋' : item.type === 'page' ? '📝' : '🔗';
                        row.innerHTML = `
                            <span style="color:#bbb; font-size:20px; user-select:none; flex:0 0 auto; pointer-events:none;">⠿</span>
                            <span style="font-size:14px; flex:0 0 auto; pointer-events:none;">${typeIcon}</span>
                            <span style="flex:1; font-size:14px; color:#4A4643; opacity:0.7;">${item.title}</span>
                            <button class="edit-board-item-btn" data-id="${item.id}" title="編集" style="background:transparent; color:#0066cc; border:none; cursor:pointer; padding:2px 6px;">${biEditIconSvg}</button>
                            <button class="delete-board-item-btn" data-id="${item.id}" title="削除" style="background:transparent; color:#d9534f; border:none; cursor:pointer; font-size:18px; font-weight:bold; padding:2px 6px;">×</button>
                        `;
                    } else {
                        row.style.cssText = `display:flex; align-items:center; padding:10px 16px; gap:12px; background:#fff; ${isLast ? '' : 'border-bottom:1px solid #F0EEE9;'} transition:background 0.15s;`;
                        row.onmouseover = () => row.style.backgroundColor = '#F7F7F5';
                        row.onmouseout  = () => row.style.backgroundColor = '#fff';
                        if (item.type === 'multi') {
                            row.style.cursor = 'pointer';
                            const linkCount = (item.links || []).length;
                            row.innerHTML = `<span style="flex:1; font-size:14px; color:#4A4643;">${item.title}</span><span style="font-size:12px; color:#888; white-space:nowrap;">${linkCount}件 ▸</span>`;
                            row.addEventListener('click', () => bIOpenLinkSelectModal(item));
                        } else if (item.type === 'page') {
                            row.style.cursor = 'pointer';
                            row.innerHTML = `<span style="flex:1; font-size:14px; color:#4A4643;">${item.title}</span><span style="font-size:12px; color:#2c8c5a; white-space:nowrap;">開く →</span>`;
                            row.addEventListener('click', () => { window.location.href = `./column_detail.html?id=${item.columnId}&board_id=${item.id}&source=board`; });
                        } else {
                            row.innerHTML = `
                                <span style="flex:1; font-size:14px; color:#4A4643;">${item.title}</span>
                                <a href="${item.url || '#'}" target="_blank" style="font-size:12px; color:#2c8c5a; text-decoration:none; white-space:nowrap; padding:4px 10px; border:1px solid #c3e6d6; border-radius:4px; background:#f0faf5; transition:all 0.15s;"
                                   onmouseover="this.style.backgroundColor='#2c8c5a'; this.style.color='#fff';"
                                   onmouseout="this.style.backgroundColor='#f0faf5'; this.style.color='#2c8c5a';">開く ↗</a>
                            `;
                        }
                    }
                    section.appendChild(row);
                });
                boardsGrid.appendChild(section);
            });
        }

        async function loadBoardItems() {
            await ensureCacheVersionChecked();
            const cachedItems    = getSC('sc_board_items');
            const cachedTagOrder = getSC('sc_board_tag_order');
            if (cachedItems !== null && cachedTagOrder !== null) {
                boardItems       = cachedItems;
                boardItemTagOrder = cachedTagOrder;
                renderBoardsGrid();
                return;
            }
            try {
                const [snap, tagDoc] = await Promise.all([
                    db.collection('board_items').get(),
                    db.collection('settings').doc('boardItemTagOrder').get()
                ]);
                boardItems = [];
                snap.forEach(doc => boardItems.push({ id: doc.id, ...doc.data() }));
                boardItems.sort((a, b) => {
                    const oa = a.order !== undefined ? a.order : (a.createdAt ? a.createdAt.seconds : 0);
                    const ob = b.order !== undefined ? b.order : (b.createdAt ? b.createdAt.seconds : 0);
                    return oa - ob;
                });
                boardItems.forEach((item, idx) => { item.order = idx; });
                boardItemTagOrder = (tagDoc.exists && Array.isArray(tagDoc.data().order)) ? tagDoc.data().order : [];
                setSC('sc_board_items',    boardItems);
                setSC('sc_board_tag_order', boardItemTagOrder);
            } catch(e) { console.error('loadBoardItems error:', e); }
            renderBoardsGrid();
        }
        loadBoardItems();

        // 編集モード切替
        if (editBoardsBtn) {
            editBoardsBtn.addEventListener('click', () => {
                isBoardItemEditMode = !isBoardItemEditMode;
                renderBoardsGrid();
            });
        }
        if (addBoardsBtn) {
            addBoardsBtn.addEventListener('click', () => { editingBoardItemId = null; biTypeModal.classList.remove('hidden'); });
        }

        // 編集・削除クリック
        boardsGrid.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-id]');
            if (!btn) return;
            const id = btn.getAttribute('data-id');
            if (btn.classList.contains('delete-board-item-btn')) {
                const item = boardItems.find(i => i.id === id);
                if (item && confirm(`カード「${item.title}」を削除しますか？`)) {
                    if (item.type === 'page' && item.columnId) {
                        db.collection('board_columns').doc(item.columnId).delete().catch(() => {});
                    }
                    db.collection('board_items').doc(id).delete().then(() => { clearBoardItemCaches(); updateCacheVersion(); loadBoardItems(); });
                }
            }
            if (btn.classList.contains('edit-board-item-btn')) {
                const item = boardItems.find(i => i.id === id);
                if (item) {
                    editingBoardItemId = id;
                    if (item.type === 'multi')      biOpenMultiModal(item);
                    else if (item.type === 'page')  biOpenPageEditModal(item);
                    else                            biOpenSimpleModal(item);
                }
            }
        });

        // ── ドラッグ＆ドロップ ──────────────────────────────────
        let _biDndSrcId = null, _biDndSrcTag = null, _biSectionDndSrc = null;
        boardsGrid.addEventListener('dragstart', (e) => {
            if (e.target.tagName === 'BUTTON') { e.preventDefault(); return; }
            const draggable = e.target.closest('[draggable]');
            if (!draggable) return;
            if (draggable.dataset.tagSection) {
                _biSectionDndSrc = draggable.dataset.tagSection; _biDndSrcId = null; _biDndSrcTag = null;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { draggable.parentElement.style.opacity = '0.4'; }, 0);
            } else if (draggable.dataset.id) {
                _biSectionDndSrc = null; _biDndSrcId = draggable.dataset.id; _biDndSrcTag = draggable.dataset.tag;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { draggable.style.opacity = '0.4'; }, 0);
            }
        });
        boardsGrid.addEventListener('dragend', () => {
            boardsGrid.querySelectorAll('[draggable]').forEach(r => { r.style.opacity = ''; r.style.boxShadow = ''; });
            boardsGrid.querySelectorAll('[data-section-tag]').forEach(s => { s.style.opacity = ''; s.style.boxShadow = ''; });
        });
        boardsGrid.addEventListener('dragover', (e) => {
            e.preventDefault();
            boardsGrid.querySelectorAll('[draggable]').forEach(r => { r.style.boxShadow = ''; });
            boardsGrid.querySelectorAll('[data-section-tag]').forEach(s => { s.style.boxShadow = ''; });
            if (_biSectionDndSrc) {
                const ts = e.target.closest('[data-section-tag]');
                if (!ts || ts.dataset.sectionTag === _biSectionDndSrc) return;
                const rect = ts.getBoundingClientRect();
                ts.style.boxShadow = e.clientY < rect.top + rect.height / 2 ? 'inset 0 2px 0 #0066cc' : 'inset 0 -2px 0 #0066cc';
            } else if (_biDndSrcId) {
                const row = e.target.closest('[draggable][data-id]');
                if (!row || row.dataset.id === _biDndSrcId || row.dataset.tag !== _biDndSrcTag) return;
                const rect = row.getBoundingClientRect();
                row.style.boxShadow = e.clientY < rect.top + rect.height / 2 ? 'inset 0 2px 0 #0066cc' : 'inset 0 -2px 0 #0066cc';
            }
        });
        boardsGrid.addEventListener('drop', async (e) => {
            e.preventDefault();
            boardsGrid.querySelectorAll('[draggable]').forEach(r => { r.style.opacity = ''; r.style.boxShadow = ''; });
            boardsGrid.querySelectorAll('[data-section-tag]').forEach(s => { s.style.opacity = ''; s.style.boxShadow = ''; });
            if (_biSectionDndSrc) {
                const ts = e.target.closest('[data-section-tag]');
                if (!ts || ts.dataset.sectionTag === _biSectionDndSrc) return;
                const currentOrder = [...boardsGrid.querySelectorAll('[data-section-tag]')].map(s => s.dataset.sectionTag);
                const srcIdx = currentOrder.indexOf(_biSectionDndSrc);
                const rect   = ts.getBoundingClientRect();
                const arr    = [...currentOrder];
                const [moved] = arr.splice(srcIdx, 1);
                let insertIdx = arr.indexOf(ts.dataset.sectionTag);
                if (e.clientY >= rect.top + rect.height / 2) insertIdx++;
                arr.splice(insertIdx, 0, moved);
                _biSectionDndSrc = null;
                await db.collection('settings').doc('boardItemTagOrder').set({ order: arr });
                clearBoardItemCaches(); updateCacheVersion(); loadBoardItems();
            } else if (_biDndSrcId) {
                const targetRow = e.target.closest('[draggable][data-id]');
                if (!targetRow || !_biDndSrcId || targetRow.dataset.id === _biDndSrcId || targetRow.dataset.tag !== _biDndSrcTag) return;
                const srcIdx  = boardItems.findIndex(i => i.id === _biDndSrcId);
                const rect    = targetRow.getBoundingClientRect();
                const arr     = [...boardItems];
                const [moved] = arr.splice(srcIdx, 1);
                let insertIdx = arr.findIndex(i => i.id === targetRow.dataset.id);
                if (e.clientY >= rect.top + rect.height / 2) insertIdx++;
                arr.splice(insertIdx, 0, moved);
                const batch = db.batch();
                arr.forEach((item, idx) => { batch.update(db.collection('board_items').doc(item.id), { order: idx }); });
                await batch.commit();
                clearBoardItemCaches(); updateCacheVersion(); loadBoardItems();
            }
        });

        // ── 1. 種類選択モーダル ──────────────────────────────────
        const biTypeCardStyle = 'display:flex; align-items:flex-start; gap:14px; padding:14px 16px; border:1px solid #E6E4DF; border-radius:8px; background:#fff; cursor:pointer; text-align:left; width:100%; transition:border-color 0.2s;';
        const biTypeModal = document.createElement('div');
        biTypeModal.className = 'modal-overlay hidden';
        biTypeModal.innerHTML = `
            <div class="modal-content" style="max-width:480px;">
                <h3 class="modal-title">カードの種類を選択</h3>
                <div style="display:flex; flex-direction:column; gap:10px; margin:4px 0 8px;">
                    <button id="bi-type-simple" style="${biTypeCardStyle}">
                        <span style="font-size:22px; flex:0 0 auto; margin-top:2px;">🔗</span>
                        <div><div style="font-weight:bold; font-size:14px; margin-bottom:3px;">シンプルリンクカード</div><div style="font-size:12px; color:#888;">1つのリンクを開くシンプルなカード</div></div>
                    </button>
                    <button id="bi-type-multi" style="${biTypeCardStyle}">
                        <span style="font-size:22px; flex:0 0 auto; margin-top:2px;">📋</span>
                        <div><div style="font-weight:bold; font-size:14px; margin-bottom:3px;">マルチリンクカード</div><div style="font-size:12px; color:#888;">クリックすると複数リンクから選択するモーダルが開く</div></div>
                    </button>
                    <button id="bi-type-page" style="${biTypeCardStyle}">
                        <span style="font-size:22px; flex:0 0 auto; margin-top:2px;">📝</span>
                        <div><div style="font-weight:bold; font-size:14px; margin-bottom:3px;">フリーページカード</div><div style="font-size:12px; color:#888;">自由に書き込めるページを持つカード</div></div>
                    </button>
                </div>
                <div class="modal-actions"><button id="bi-type-cancel" class="btn-cancel">キャンセル</button></div>
            </div>
        `;
        document.body.appendChild(biTypeModal);

        // ── 2. シンプルリンクモーダル ────────────────────────────
        const biSimpleModal = document.createElement('div');
        biSimpleModal.className = 'modal-overlay hidden';
        biSimpleModal.innerHTML = `
            <div class="modal-content">
                <h3 id="bi-simple-modal-title" class="modal-title">シンプルリンクカードを追加</h3>
                <div class="form-group"><label>タイトル</label><input type="text" id="bi-simple-title" class="modal-input" placeholder="例：令和8年度 学校便り"></div>
                <div class="form-group">
                    <label>タグ</label><input type="text" id="bi-simple-tag" class="modal-input" list="bi-simple-tag-options" placeholder="選択または入力してください">
                    <datalist id="bi-simple-tag-options">${biTagOptionsHtml}</datalist>
                </div>
                <div class="form-group"><label>リンク先 (URL)</label><input type="text" id="bi-simple-url" class="modal-input" placeholder="https://..."></div>
                <div class="modal-actions"><button id="bi-simple-cancel" class="btn-cancel">キャンセル</button><button id="bi-simple-submit" class="btn-submit">追加</button></div>
            </div>
        `;
        document.body.appendChild(biSimpleModal);

        // ── 3. マルチリンクモーダル ──────────────────────────────
        const biMultiModal = document.createElement('div');
        biMultiModal.className = 'modal-overlay hidden';
        biMultiModal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <h3 id="bi-multi-modal-title" class="modal-title">マルチリンクカードを追加</h3>
                <div class="form-group"><label>カードタイトル</label><input type="text" id="bi-multi-title" class="modal-input" placeholder="例：参考資料一覧"></div>
                <div class="form-group">
                    <label>タグ</label><input type="text" id="bi-multi-tag" class="modal-input" list="bi-multi-tag-options" placeholder="選択または入力してください">
                    <datalist id="bi-multi-tag-options">${biTagOptionsHtml}</datalist>
                </div>
                <div class="form-group">
                    <label>リンク一覧</label>
                    <div id="bi-multi-links-container" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"></div>
                    <button id="bi-multi-add-link" type="button" style="width:100%; padding:8px; border:1px dashed #aaa; border-radius:6px; background:#fafafa; color:#555; cursor:pointer; font-size:13px;">＋ リンクを追加</button>
                </div>
                <div class="modal-actions"><button id="bi-multi-cancel" class="btn-cancel">キャンセル</button><button id="bi-multi-submit" class="btn-submit">追加</button></div>
            </div>
        `;
        document.body.appendChild(biMultiModal);

        // ── 4. フリーページ作成モーダル ─────────────────────────
        const biPageModal = document.createElement('div');
        biPageModal.className = 'modal-overlay hidden';
        biPageModal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <h3 class="modal-title">フリーページカードを追加</h3>
                <p style="font-size:13px; color:#666; margin:-8px 0 16px;">カード情報を入力すると、ページ編集画面に移動します。</p>
                <div class="form-group"><label>カードタイトル</label><input type="text" id="bi-page-title" class="modal-input" placeholder="例：掲示板ニュース"></div>
                <div class="form-group">
                    <label>タグ</label><input type="text" id="bi-page-tag" class="modal-input" list="bi-page-tag-options" placeholder="選択または入力してください">
                    <datalist id="bi-page-tag-options">${biTagOptionsHtml}</datalist>
                </div>
                <div class="modal-actions"><button id="bi-page-cancel" class="btn-cancel">キャンセル</button><button id="bi-page-submit" class="btn-submit">ページを作成 →</button></div>
            </div>
        `;
        document.body.appendChild(biPageModal);

        // ── 5. フリーページ編集モーダル ─────────────────────────
        const biPageEditModal = document.createElement('div');
        biPageEditModal.className = 'modal-overlay hidden';
        biPageEditModal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <h3 class="modal-title">フリーページカードを編集</h3>
                <div class="form-group"><label>カードタイトル</label><input type="text" id="bi-page-edit-title" class="modal-input"></div>
                <div class="form-group">
                    <label>タグ</label><input type="text" id="bi-page-edit-tag" class="modal-input" list="bi-page-edit-tag-options">
                    <datalist id="bi-page-edit-tag-options">${biTagOptionsHtml}</datalist>
                </div>
                <div style="margin-bottom:16px;">
                    <a id="bi-page-edit-link" href="#" style="font-size:13px; color:#2c8c5a; text-decoration:none; display:inline-flex; align-items:center; gap:6px; padding:9px 14px; border:1px solid #c3e6d6; border-radius:6px; background:#f0faf5;">📝 ページ内容を編集する →</a>
                </div>
                <div class="modal-actions"><button id="bi-page-edit-cancel" class="btn-cancel">キャンセル</button><button id="bi-page-edit-submit" class="btn-submit">保存</button></div>
            </div>
        `;
        document.body.appendChild(biPageEditModal);

        // ── 6. リンク選択モーダル（マルチリンク用）─────────────
        const biLinkSelectModal = document.createElement('div');
        biLinkSelectModal.className = 'modal-overlay hidden';
        biLinkSelectModal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <h3 id="bi-link-select-title" class="modal-title"></h3>
                <div id="bi-link-select-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:4px;"></div>
                <div class="modal-actions"><button id="bi-link-select-close" class="btn-cancel">閉じる</button></div>
            </div>
        `;
        document.body.appendChild(biLinkSelectModal);

        // ── イベントハンドラ ─────────────────────────────────────

        // 種類選択
        document.getElementById('bi-type-cancel').addEventListener('click', () => biTypeModal.classList.add('hidden'));
        biTypeModal.addEventListener('click', (e) => { if (e.target === biTypeModal) biTypeModal.classList.add('hidden'); });
        document.getElementById('bi-type-simple').addEventListener('click', () => { biTypeModal.classList.add('hidden'); biOpenSimpleModal(null); });
        document.getElementById('bi-type-multi').addEventListener('click', ()  => { biTypeModal.classList.add('hidden'); biOpenMultiModal(null); });
        document.getElementById('bi-type-page').addEventListener('click', () => {
            biTypeModal.classList.add('hidden');
            document.getElementById('bi-page-title').value = '';
            document.getElementById('bi-page-tag').value = '';
            biPageModal.classList.remove('hidden');
        });

        // シンプルリンク
        function biOpenSimpleModal(item) {
            document.getElementById('bi-simple-title').value = item ? item.title : '';
            document.getElementById('bi-simple-tag').value   = item ? (item.tag || '') : '';
            document.getElementById('bi-simple-url').value   = item ? (item.url || '') : '';
            document.getElementById('bi-simple-modal-title').textContent = item ? 'シンプルリンクカードを編集' : 'シンプルリンクカードを追加';
            document.getElementById('bi-simple-submit').textContent = item ? '更新' : '追加';
            biSimpleModal.classList.remove('hidden');
        }
        document.getElementById('bi-simple-cancel').addEventListener('click', () => { biSimpleModal.classList.add('hidden'); editingBoardItemId = null; });
        biSimpleModal.addEventListener('click', (e) => { if (e.target === biSimpleModal) { biSimpleModal.classList.add('hidden'); editingBoardItemId = null; } });
        document.getElementById('bi-simple-submit').addEventListener('click', () => {
            const title = document.getElementById('bi-simple-title').value.trim();
            const tag   = document.getElementById('bi-simple-tag').value.trim() || 'その他';
            const url   = document.getElementById('bi-simple-url').value.trim();
            if (!title || !url) { alert('タイトルとリンクは必ず入力してください。'); return; }
            const data = { type: 'simple', title, tag, url };
            if (editingBoardItemId) {
                db.collection('board_items').doc(editingBoardItemId).update(data).then(() => { editingBoardItemId = null; biSimpleModal.classList.add('hidden'); clearBoardItemCaches(); updateCacheVersion(); loadBoardItems(); });
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                data.order = boardItems.length;
                db.collection('board_items').add(data).then(() => { biSimpleModal.classList.add('hidden'); clearBoardItemCaches(); updateCacheVersion(); loadBoardItems(); });
            }
        });

        // マルチリンク
        function biAddMultiLinkRow(container, linkTitle, linkUrl) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; gap:6px; align-items:center;';
            row.innerHTML = `
                <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                    <input type="text" class="bi-multi-link-title modal-input" placeholder="リンクのタイトル" style="margin:0; font-size:13px; padding:6px 10px;">
                    <input type="text" class="bi-multi-link-url modal-input" placeholder="https://..." style="margin:0; font-size:13px; padding:6px 10px;">
                </div>
                <button type="button" class="bi-multi-link-remove" style="flex:0 0 auto; background:transparent; color:#d9534f; border:1px solid #d9534f; border-radius:4px; cursor:pointer; padding:4px 8px; font-weight:bold; align-self:center;">×</button>
            `;
            if (linkTitle) row.querySelector('.bi-multi-link-title').value = linkTitle;
            if (linkUrl)   row.querySelector('.bi-multi-link-url').value   = linkUrl;
            row.querySelector('.bi-multi-link-remove').addEventListener('click', () => row.remove());
            container.appendChild(row);
        }
        function biOpenMultiModal(item) {
            const container = document.getElementById('bi-multi-links-container');
            container.innerHTML = '';
            document.getElementById('bi-multi-title').value = item ? item.title : '';
            document.getElementById('bi-multi-tag').value   = item ? (item.tag || '') : '';
            document.getElementById('bi-multi-modal-title').textContent = item ? 'マルチリンクカードを編集' : 'マルチリンクカードを追加';
            document.getElementById('bi-multi-submit').textContent = item ? '更新' : '追加';
            if (item && item.links && item.links.length > 0) {
                item.links.forEach(link => biAddMultiLinkRow(container, link.title, link.url));
            } else {
                biAddMultiLinkRow(container, '', '');
            }
            biMultiModal.classList.remove('hidden');
        }
        document.getElementById('bi-multi-add-link').addEventListener('click', () => biAddMultiLinkRow(document.getElementById('bi-multi-links-container'), '', ''));
        document.getElementById('bi-multi-cancel').addEventListener('click', () => { biMultiModal.classList.add('hidden'); editingBoardItemId = null; });
        biMultiModal.addEventListener('click', (e) => { if (e.target === biMultiModal) { biMultiModal.classList.add('hidden'); editingBoardItemId = null; } });
        document.getElementById('bi-multi-submit').addEventListener('click', () => {
            const title = document.getElementById('bi-multi-title').value.trim();
            const tag   = document.getElementById('bi-multi-tag').value.trim() || 'その他';
            if (!title) { alert('タイトルを入力してください。'); return; }
            const links = [];
            document.querySelectorAll('#bi-multi-links-container > div').forEach(row => {
                const lt = row.querySelector('.bi-multi-link-title').value.trim();
                const lu = row.querySelector('.bi-multi-link-url').value.trim();
                if (lt && lu) links.push({ title: lt, url: lu });
            });
            if (links.length === 0) { alert('リンクを1件以上入力してください。'); return; }
            const data = { type: 'multi', title, tag, links };
            if (editingBoardItemId) {
                db.collection('board_items').doc(editingBoardItemId).update(data).then(() => { editingBoardItemId = null; biMultiModal.classList.add('hidden'); clearBoardItemCaches(); updateCacheVersion(); loadBoardItems(); });
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                data.order = boardItems.length;
                db.collection('board_items').add(data).then(() => { biMultiModal.classList.add('hidden'); clearBoardItemCaches(); updateCacheVersion(); loadBoardItems(); });
            }
        });

        // フリーページ作成
        document.getElementById('bi-page-cancel').addEventListener('click', () => biPageModal.classList.add('hidden'));
        biPageModal.addEventListener('click', (e) => { if (e.target === biPageModal) biPageModal.classList.add('hidden'); });
        document.getElementById('bi-page-submit').addEventListener('click', () => {
            const title = document.getElementById('bi-page-title').value.trim();
            const tag   = document.getElementById('bi-page-tag').value.trim() || 'その他';
            if (!title) { alert('タイトルを入力してください。'); return; }
            biPageModal.classList.add('hidden');
            const params = new URLSearchParams({ source: 'board', board_tag: tag, board_title: title });
            window.location.href = `./column_edit.html?${params.toString()}`;
        });

        // フリーページ編集
        function biOpenPageEditModal(item) {
            document.getElementById('bi-page-edit-title').value = item.title;
            document.getElementById('bi-page-edit-tag').value   = item.tag || '';
            document.getElementById('bi-page-edit-link').href   = `./column_edit.html?edit_id=${item.columnId}&source=board_edit`;
            biPageEditModal.classList.remove('hidden');
        }
        document.getElementById('bi-page-edit-cancel').addEventListener('click', () => { biPageEditModal.classList.add('hidden'); editingBoardItemId = null; });
        biPageEditModal.addEventListener('click', (e) => { if (e.target === biPageEditModal) { biPageEditModal.classList.add('hidden'); editingBoardItemId = null; } });
        document.getElementById('bi-page-edit-submit').addEventListener('click', () => {
            if (!editingBoardItemId) return;
            const title = document.getElementById('bi-page-edit-title').value.trim();
            const tag   = document.getElementById('bi-page-edit-tag').value.trim() || 'その他';
            if (!title) { alert('タイトルを入力してください。'); return; }
            db.collection('board_items').doc(editingBoardItemId).update({ title, tag }).then(() => { editingBoardItemId = null; biPageEditModal.classList.add('hidden'); clearBoardItemCaches(); updateCacheVersion(); loadBoardItems(); });
        });

        // リンク選択（マルチリンクカードクリック時）
        function bIOpenLinkSelectModal(item) {
            document.getElementById('bi-link-select-title').textContent = item.title;
            const list = document.getElementById('bi-link-select-list');
            list.innerHTML = '';
            (item.links || []).forEach(link => {
                const a = document.createElement('a');
                a.href = link.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
                a.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border:1px solid #E6E4DF; border-radius:6px; background:#fff; text-decoration:none; color:#4A4643; font-size:14px; transition:background 0.15s;';
                a.innerHTML = `<span>${link.title || link.url}</span><span style="font-size:12px; color:#2c8c5a; flex:0 0 auto; margin-left:12px;">開く ↗</span>`;
                a.onmouseover = () => a.style.background = '#F7F7F5';
                a.onmouseout  = () => a.style.background = '#fff';
                list.appendChild(a);
            });
            biLinkSelectModal.classList.remove('hidden');
        }
        document.getElementById('bi-link-select-close').addEventListener('click', () => biLinkSelectModal.classList.add('hidden'));
        biLinkSelectModal.addEventListener('click', (e) => { if (e.target === biLinkSelectModal) biLinkSelectModal.classList.add('hidden'); });
    }

    // ==========================================
    // 4. コラム詳細ページの表示 (column_detail.html)
    // ==========================================
    const detailTitle = document.getElementById('detail-title');
    if (detailTitle) {
        const urlParams = new URLSearchParams(window.location.search);
        const colId       = urlParams.get('id');
        const detailSource = urlParams.get('source');
        const detailDashId = urlParams.get('dash_id');
        const detailBoardId = urlParams.get('board_id');
        const detailCollection = (detailSource === 'board' || detailSource === 'boards_list') ? 'board_columns' : 'columns';

        db.collection(detailCollection).doc(colId).get().then(doc => {
            if (doc.exists) {
                const colData = doc.data();

                detailTitle.textContent = colData.title;

                const detailActions = document.getElementById('detail-actions');
                if (detailActions) {
                    detailActions.style.display = 'block';

                    document.getElementById('btn-detail-edit').addEventListener('click', () => {
                        let editUrl = `./column_edit.html?edit_id=${colId}`;
                        if (detailSource === 'dashboard') editUrl += '&source=dashboard_edit';
                        else if (detailSource === 'board') editUrl += '&source=board_edit';
                        else if (detailSource === 'boards_list') editUrl += '&source=boards_list_edit';
                        window.location.href = editUrl;
                    });

                    document.getElementById('btn-detail-delete').addEventListener('click', () => {
                        if (confirm('このページを削除してもよろしいですか？')) {
                            const batch = db.batch();
                            batch.delete(db.collection(detailCollection).doc(colId));
                            if (detailSource === 'dashboard' && detailDashId) {
                                batch.delete(db.collection('dashboards').doc(detailDashId));
                            } else if (detailSource === 'board' && detailBoardId) {
                                batch.delete(db.collection('board_items').doc(detailBoardId));
                            } else if (detailSource === 'boards_list' && detailBoardId) {
                                batch.delete(db.collection('boards').doc(detailBoardId));
                            }
                            batch.commit().then(async () => {
                                await updateCacheVersion();
                                if (detailSource === 'dashboard') {
                                    ['sc_columns','sc_dashboards','sc_dash_tagorder'].forEach(k => localStorage.removeItem(k));
                                    window.location.href = './index.html';
                                } else if (detailSource === 'board') {
                                    ['sc_board_items','sc_board_tag_order'].forEach(k => localStorage.removeItem(k));
                                    window.location.href = './boards.html';
                                } else if (detailSource === 'boards_list') {
                                    localStorage.removeItem('sc_boards');
                                    window.location.href = './boards.html';
                                } else {
                                    localStorage.removeItem('sc_columns');
                                    window.location.href = './columns.html';
                                }
                            });
                        }
                    });
                }

                const authorStr = colData.author || '教職員';
                const tagsArray = authorStr.split(/[\s　]+/).filter(tag => tag.length > 0);
                const tagsHtml = tagsArray.map(tag => `<span class="column-tag">${tag}</span>`).join('');

                const tagsContainer = document.querySelector('.column-tags');
                if (tagsContainer) {
                    const authorNameHtml = colData.authorName ? `<span style="font-size:12px; color:#888; margin-left:6px;">👤 ${colData.authorName}</span>` : '';
                    tagsContainer.innerHTML = `${tagsHtml} <span class="column-tag">${colData.date}</span>${authorNameHtml}`;
                }

                const eyecatch = document.getElementById('detail-eyecatch');
                if (colData.img) {
                    eyecatch.src = colData.img;
                    eyecatch.style.display = 'inline-block';
                }
                if (colData.contentType === 'html') {
                    const parsed = new DOMParser().parseFromString(colData.content || '', 'text/html');
                    const styles = Array.from(parsed.querySelectorAll('style')).map(s => s.outerHTML).join('');
                    const bodyHtml = parsed.body ? parsed.body.innerHTML : (colData.content || '');
                    // リンククリック制御スクリプト:
                    //   アンカーリンク(#xxx)はiframe内スムーズスクロール、それ以外は新規タブで開く
                    //   → iframeがポータルページ全体に遷移してサイドバーが二重表示されるバグを防止
                    const linkScript = `<script>document.addEventListener('click',function(e){var a=e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href');if(h&&h.startsWith('#')){e.preventDefault();var el=document.getElementById(h.slice(1));if(el)el.scrollIntoView({behavior:'smooth'});}else if(h&&!h.startsWith('javascript:')){e.preventDefault();window.open(a.href,'_blank');}});<\/script>`;
                    const srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8">${styles}${linkScript}</head><body style="margin:0;">${bodyHtml}</body></html>`;
                    const container = document.getElementById('detail-content');
                    const iframe = document.createElement('iframe');
                    iframe.style.cssText = 'width:100%; border:none; display:block; min-height:200px;';
                    iframe.srcdoc = srcdoc;
                    iframe.addEventListener('load', () => {
                        try { iframe.style.height = iframe.contentDocument.body.scrollHeight + 32 + 'px'; } catch(e) {}
                    });
                    container.appendChild(iframe);
                } else {
                    document.getElementById('detail-content').innerHTML = colData.content;
                }
            } else {
                detailTitle.textContent = "コラムが見つかりませんでした。";
            }
        });
    }

    // ==========================================
    // ★修正: 会議室＆特別教室 予約システム (Firebase版)
    // ==========================================
    const resBody = document.getElementById('reservations-body');
    const spBody = document.getElementById('special-rooms-body');

    if (resBody || spBody) {
        let reservations = []; let specialRooms = [];

        function renderTable(tbody, dataArray, storageType) {
            if (!tbody) return;
            tbody.innerHTML = '';
            
            const sortedArray = [...dataArray].sort((a, b) => {
                const dateA = a.date && a.date !== "-" ? a.date : "9999/99/99";
                const dateB = b.date && b.date !== "-" ? b.date : "9999/99/99";
                if (dateA < dateB) return -1; if (dateA > dateB) return 1;
                const timeA = a.startTime && a.startTime !== "-" ? a.startTime : "99:99";
                const timeB = b.startTime && b.startTime !== "-" ? b.startTime : "99:99";
                if (timeA < timeB) return -1; if (timeA > timeB) return 1;
                return 0;
            });

            sortedArray.forEach(data => {
                const tr = document.createElement('tr');
                const deleteBtnHtml = `<button class="delete-res-btn" data-id="${data.id}" data-type="${storageType}" style="background-color: transparent; color: #d9534f; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px;">削除</button>`;
                tr.innerHTML = `
                    <td style="font-weight: bold; color: #4A4643;">${data.purpose}</td>
                    <td><span style="background: #F7F7F5; border: 1px solid #E6E4DF; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${data.location}</span></td>
                    <td>${data.date}</td><td>${data.startTime}</td><td>${data.endTime}</td><td>${data.user}</td><td>${deleteBtnHtml}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // .get()で1回取得
        async function loadReservations() {
            try {
                if (resBody) {
                    const snap = await db.collection('reservations').get();
                    reservations = []; snap.forEach(doc => reservations.push({ id: doc.id, ...doc.data() }));
                    renderTable(resBody, reservations, 'room');
                }
                if (spBody) {
                    const snap = await db.collection('special_rooms').get();
                    specialRooms = []; snap.forEach(doc => specialRooms.push({ id: doc.id, ...doc.data() }));
                    renderTable(spBody, specialRooms, 'special');
                }
            } catch(e) { console.warn('reservations 取得エラー', e); }
        }
        loadReservations();

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-res-btn')) {
                if(confirm('この予約を完全に削除しますか？')) {
                    const id = e.target.getAttribute('data-id');
                    const type = e.target.getAttribute('data-type');
                    if (type === 'room') db.collection('reservations').doc(id).delete().then(() => loadReservations());
                    else if (type === 'special') db.collection('special_rooms').doc(id).delete().then(() => loadReservations());
                }
            }
        });

        function addReservation(purposeId, locationId, dateId, startId, endId, userId, collectionName, modalElement) {
            const purpose = document.getElementById(purposeId).value.trim();
            const location = document.getElementById(locationId).value;
            const date = document.getElementById(dateId).value;
            const start = document.getElementById(startId).value;
            const end = document.getElementById(endId).value;
            const user = document.getElementById(userId).value.trim();

            if (!purpose || !user) { alert('使用用途と使用者は必ず入力してください。'); return; }

            let dateStr = "-";
            if (date) {
                const d = new Date(date);
                dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
            }

            db.collection(collectionName).add({
                purpose: purpose, location: location, date: dateStr, 
                startTime: start || '-', endTime: end || '-', user: user,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => { modalElement.classList.add('hidden'); loadReservations(); });
        }

        const resModal = document.getElementById('reservation-modal');
        const addResBtn = document.getElementById('add-reservation-btn');
        if (addResBtn && resModal) {
            addResBtn.addEventListener('click', () => {
                document.getElementById('res-purpose').value = ''; document.getElementById('res-location').selectedIndex = 0;
                document.getElementById('res-date').valueAsDate = new Date(); document.getElementById('res-start').value = '';
                document.getElementById('res-end').value = ''; document.getElementById('res-user').value = '';
                resModal.classList.remove('hidden');
            });
            document.getElementById('res-cancel').addEventListener('click', () => resModal.classList.add('hidden'));
            resModal.addEventListener('click', (e) => { if (e.target === resModal) resModal.classList.add('hidden'); });
            document.getElementById('res-submit').addEventListener('click', () => {
                addReservation('res-purpose', 'res-location', 'res-date', 'res-start', 'res-end', 'res-user', 'reservations', resModal);
            });
        }

        const spModal = document.getElementById('special-room-modal');
        const addSpBtn = document.getElementById('add-special-room-btn');
        if (addSpBtn && spModal) {
            addSpBtn.addEventListener('click', () => {
                document.getElementById('sp-purpose').value = ''; document.getElementById('sp-location').selectedIndex = 0;
                document.getElementById('sp-date').valueAsDate = new Date(); document.getElementById('sp-start').value = '';
                document.getElementById('sp-end').value = ''; document.getElementById('sp-user').value = '';
                spModal.classList.remove('hidden');
            });
            document.getElementById('sp-cancel').addEventListener('click', () => spModal.classList.add('hidden'));
            spModal.addEventListener('click', (e) => { if (e.target === spModal) spModal.classList.add('hidden'); });
            document.getElementById('sp-submit').addEventListener('click', () => {
                addReservation('sp-purpose', 'sp-location', 'sp-date', 'sp-start', 'sp-end', 'sp-user', 'special_rooms', spModal);
            });
        }
    }

    // ==========================================
    // ★修正: 勤務・出張・来客システム (日付切り替え＋遅延読み込み版)
    // ==========================================
    const attBody = document.getElementById('attendance-body');
    const visBody = document.getElementById('visitor-body');
    const tripBody = document.getElementById('trip-body');

    if (attBody || visBody || tripBody) {
        let attendances = []; let visitors = []; let trips = [];
        let editingAttId = null, editingVisId = null, editingTripId = null;
        let clearVisLoc = null, setVisLoc = null;
        let currentViewDate = new Date();

        // ja-JP ロケールは元号年を返す場合があるため UTC+9 オフセットで直接計算
        function getDateStr(dateObj) {
            const jst = new Date(dateObj.getTime() + 9 * 60 * 60 * 1000);
            return jst.toISOString().slice(0, 10);
        }
        const todayStr = getDateStr(new Date());

        const dateInput = document.getElementById('status-view-date');
        const prevBtn   = document.getElementById('status-prev-btn');
        const nextBtn   = document.getElementById('status-next-btn');
        const todayBtn  = document.getElementById('status-today-btn');

        // セクションタイトルを選択日付に合わせて更新
        function updateSectionTitles(dateStr) {
            const [, m, d] = dateStr.split('-');
            const isToday = dateStr === todayStr;
            const label = isToday ? `本日（${parseInt(m)}/${parseInt(d)}）` : `${parseInt(m)}/${parseInt(d)}`;
            const attTitle  = document.getElementById('att-section-title');
            const visTitle  = document.getElementById('vis-section-title');
            const tripTitle = document.getElementById('trip-section-title');
            if (attTitle)  attTitle.textContent  = `${label}の出勤状況`;
            if (visTitle)  visTitle.textContent  = `${label}の来客状況`;
            if (tripTitle) tripTitle.textContent = `${label}の出張状況`;
        }

        function renderStatusTables() {
            if (attBody) {
                attBody.innerHTML = '';
                if (attendances.length === 0) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td colspan="6" style="text-align:center;color:#aaa;padding:20px;font-size:14px;">登録された出勤情報はありません</td>`;
                    attBody.appendChild(tr);
                } else {
                    attendances.forEach(d => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td style="font-weight: bold;">${d.name}</td><td><span style="background: #F7F7F5; border: 1px solid #E6E4DF; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${d.type}</span></td><td>${d.start}</td><td>${d.end}</td><td style="white-space: pre-wrap; font-size: 12px; line-height: 1.4; color: #666;">${d.note}</td><td><button class="edit-status-btn" data-id="${d.id}" data-type="att" style="background: transparent; color: #0066cc; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px; margin-right: 4px;">編集</button><button class="delete-status-btn" data-id="${d.id}" data-type="att" style="background: transparent; color: #d9534f; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px;">削除</button></td>`;
                        attBody.appendChild(tr);
                    });
                }
            }

            if (visBody) {
                visBody.innerHTML = '';
                if (visitors.length === 0) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td colspan="9" style="text-align:center;color:#aaa;padding:20px;font-size:14px;">登録された来客情報はありません</td>`;
                    visBody.appendChild(tr);
                } else {
                    visitors.forEach(d => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td style="font-weight: bold;">${d.org}</td><td>${d.count}</td><td>${d.rep}</td><td>${d.purpose}</td><td>${d.host}</td><td><span style="background: #F7F7F5; border: 1px solid #E6E4DF; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${d.loc}</span></td><td>${d.time}</td><td style="white-space: pre-wrap; font-size: 12px; line-height: 1.4; color: #666;">${d.note}</td><td><button class="edit-status-btn" data-id="${d.id}" data-type="vis" style="background: transparent; color: #0066cc; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px; margin-right: 4px;">編集</button><button class="delete-status-btn" data-id="${d.id}" data-type="vis" style="background: transparent; color: #d9534f; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px;">削除</button></td>`;
                        visBody.appendChild(tr);
                    });
                }
            }

            if (tripBody) {
                tripBody.innerHTML = '';
                if (trips.length === 0) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td colspan="6" style="text-align:center;color:#aaa;padding:20px;font-size:14px;">登録された出張情報はありません</td>`;
                    tripBody.appendChild(tr);
                } else {
                    trips.forEach(d => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td style="font-weight: bold;">${d.name}</td><td>${d.purpose}</td><td>${d.loc}</td><td>${d.time}</td><td style="white-space: pre-wrap; font-size: 12px; line-height: 1.4; color: #666;">${d.note}</td><td><button class="edit-status-btn" data-id="${d.id}" data-type="trip" style="background: transparent; color: #0066cc; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px; margin-right: 4px;">編集</button><button class="delete-status-btn" data-id="${d.id}" data-type="trip" style="background: transparent; color: #d9534f; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px;">削除</button></td>`;
                        tripBody.appendChild(tr);
                    });
                }
            }
        }

        // 日付別キャッシュヘルパー（1つのlocalStorageキーにオブジェクト形式で蓄積）
        // キャッシュ済みかどうかは専用フラグキー（"_ok"）で判定し、空配列も正しくヒットさせる
        function getCacheForDate(cacheKey, dateStr) {
            try {
                const c = getSC(cacheKey);
                if (!c || !c[dateStr + '_ok']) return null;
                return c[dateStr] || [];
            } catch(e) { return null; }
        }
        function setCacheForDate(cacheKey, dateStr, data) {
            try {
                const c = getSC(cacheKey) || {};
                c[dateStr] = data;
                c[dateStr + '_ok'] = true; // 空配列も「取得済み」と識別するためのフラグ
                setSC(cacheKey, c);
            } catch(e) {}
        }
        const clearStatusCaches = () => { ['sc_att_cache','sc_vis_cache','sc_trip_cache'].forEach(k => clearSC(k)); };

        // 直近の loadStatusData 呼び出しを追跡し、古いリクエストの結果を無視する
        let _loadSeq = 0;

        // 指定日付のデータを取得（キャッシュがあればキャッシュを使用）
        async function loadStatusData(dateStr) {
            const seq = ++_loadSeq; // このリクエストのシーケンス番号
            if (dateInput) dateInput.value = dateStr;
            updateSectionTitles(dateStr);

            await ensureCacheVersionChecked();
            if (seq !== _loadSeq) return; // より新しいリクエストが出ていたら結果を捨てる

            const cachedAtt  = getCacheForDate('sc_att_cache',  dateStr);
            const cachedVis  = getCacheForDate('sc_vis_cache',  dateStr);
            const cachedTrip = getCacheForDate('sc_trip_cache', dateStr);

            if (cachedAtt !== null && cachedVis !== null && cachedTrip !== null) {
                attendances = cachedAtt; visitors = cachedVis; trips = cachedTrip;
                renderStatusTables(); return;
            }
            try {
                const [attSnap, visSnap, tripSnap] = await Promise.all([
                    db.collection('attendances').where('date', '==', dateStr).get(),
                    db.collection('visitors').where('date', '==', dateStr).get(),
                    db.collection('trips').where('date', '==', dateStr).get()
                ]);
                if (seq !== _loadSeq) return; // フェッチ中により新しいリクエストが出ていたら捨てる
                attendances = []; attSnap.forEach(doc => attendances.push({ id: doc.id, ...doc.data() }));
                visitors    = []; visSnap.forEach(doc => visitors.push({ id: doc.id, ...doc.data() }));
                trips       = []; tripSnap.forEach(doc => trips.push({ id: doc.id, ...doc.data() }));
                setCacheForDate('sc_att_cache',  dateStr, attendances);
                setCacheForDate('sc_vis_cache',  dateStr, visitors);
                setCacheForDate('sc_trip_cache', dateStr, trips);
            } catch(e) { console.error('loadStatusData error:', e); }
            if (seq !== _loadSeq) return;
            renderStatusTables();
        }

        // 初回は本日のみ読み込む
        loadStatusData(todayStr);

        // 日付ナビゲーション
        if (prevBtn) prevBtn.addEventListener('click', () => {
            currentViewDate.setDate(currentViewDate.getDate() - 1);
            loadStatusData(getDateStr(currentViewDate));
        });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            currentViewDate.setDate(currentViewDate.getDate() + 1);
            loadStatusData(getDateStr(currentViewDate));
        });
        if (todayBtn) todayBtn.addEventListener('click', () => {
            currentViewDate = new Date();
            loadStatusData(getDateStr(currentViewDate));
        });
        if (dateInput) dateInput.addEventListener('change', (e) => {
            if (e.target.value) {
                currentViewDate = new Date(e.target.value + 'T00:00:00');
                loadStatusData(getDateStr(currentViewDate));
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-status-btn')) {
                if(confirm('この項目を完全に削除しますか？')) {
                    const id = e.target.getAttribute('data-id');
                    const type = e.target.getAttribute('data-type');
                    if (type === 'att') db.collection('attendances').doc(id).delete().then(() => { clearStatusCaches(); updateCacheVersion(); loadStatusData(getDateStr(currentViewDate)); });
                    if (type === 'vis') db.collection('visitors').doc(id).delete().then(() => { clearStatusCaches(); updateCacheVersion(); loadStatusData(getDateStr(currentViewDate)); });
                    if (type === 'trip') db.collection('trips').doc(id).delete().then(() => { clearStatusCaches(); updateCacheVersion(); loadStatusData(getDateStr(currentViewDate)); });
                }
            }
            if (e.target.classList.contains('edit-status-btn')) {
                const id = e.target.getAttribute('data-id');
                const type = e.target.getAttribute('data-type');
                if (type === 'att') openEditAttModal(id);
                if (type === 'vis') openEditVisModal(id);
                if (type === 'trip') openEditTripModal(id);
            }
        });

        function setupModal(btnId, modalId, cancelId, submitId, dateId, onOpen, onSubmit) {
            const btn = document.getElementById(btnId); const modal = document.getElementById(modalId);
            if (!btn || !modal) return;
            btn.addEventListener('click', () => { onOpen(); document.getElementById(dateId).value = getDateStr(currentViewDate); modal.classList.remove('hidden'); });
            document.getElementById(cancelId).addEventListener('click', () => modal.classList.add('hidden'));
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
            document.getElementById(submitId).addEventListener('click', () => { if(onSubmit()) modal.classList.add('hidden'); });
        }

        // ── vis-loc 複数場所チップ UI ──────────────────────────
        (function() {
            const visLocInput = document.getElementById('vis-loc');
            if (!visLocInput) return;
            visLocInput.style.display = 'none';
            let chips = [];
            const container = document.createElement('div');
            container.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; padding:6px 8px; border:1px solid #E6E4DF; border-radius:6px; background:#fff; min-height:38px; align-items:center; cursor:text;';
            const chipInput = document.createElement('input');
            chipInput.type = 'text';
            chipInput.setAttribute('list', 'vis-loc-options');
            chipInput.placeholder = '場所を選択（複数可、Enterで確定）';
            chipInput.style.cssText = 'border:none; outline:none; flex:1; min-width:120px; font-size:14px; padding:2px 0; background:transparent;';
            container.appendChild(chipInput);
            visLocInput.parentNode.insertBefore(container, visLocInput);

            function renderChips() {
                container.querySelectorAll('.vis-loc-chip').forEach(c => c.remove());
                chips.forEach(chip => {
                    const span = document.createElement('span');
                    span.className = 'vis-loc-chip';
                    span.style.cssText = 'background:#e8f5e9; border:1px solid #a5d6a7; padding:2px 10px 2px 8px; border-radius:12px; font-size:13px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;';
                    const text = document.createElement('span');
                    text.textContent = chip;
                    const btn = document.createElement('button');
                    btn.type = 'button'; btn.textContent = '×';
                    btn.style.cssText = 'background:none; border:none; cursor:pointer; color:#888; padding:0 0 0 2px; font-size:13px; line-height:1;';
                    btn.addEventListener('click', () => { chips = chips.filter(c => c !== chip); visLocInput.value = chips.join('、') || ''; renderChips(); });
                    span.appendChild(text); span.appendChild(btn);
                    container.insertBefore(span, chipInput);
                });
            }

            function addChip(val) {
                val = val.trim();
                if (!val || chips.includes(val)) { chipInput.value = ''; return; }
                chips.push(val);
                visLocInput.value = chips.join('、');
                renderChips();
                chipInput.value = '';
            }

            clearVisLoc = function() { chips = []; visLocInput.value = ''; chipInput.value = ''; renderChips(); };
            setVisLoc = function(val) {
                clearVisLoc();
                if (val && val !== '-') { val.split(/[、,]/).forEach(v => { if (v.trim()) addChip(v.trim()); }); }
            };

            container.addEventListener('click', () => chipInput.focus());
            chipInput.addEventListener('change', () => { if (chipInput.value.trim()) addChip(chipInput.value); });
            chipInput.addEventListener('keydown', (e) => {
                if (!e.isComposing && (e.key === 'Enter' || e.key === ',') && chipInput.value.trim()) { e.preventDefault(); addChip(chipInput.value); }
                else if (e.key === 'Backspace' && chipInput.value === '' && chips.length > 0) { chips.pop(); visLocInput.value = chips.join('、'); renderChips(); }
            });
        })();

        function resetAttModal() {
            editingAttId = null;
            const title = document.getElementById('att-modal-title');
            const submit = document.getElementById('att-submit');
            if (title) title.textContent = '出勤状況を追加';
            if (submit) submit.textContent = '追加';
        }
        function resetVisModal() {
            editingVisId = null;
            const title = document.getElementById('vis-modal-title');
            const submit = document.getElementById('vis-submit');
            if (title) title.textContent = '来客状況を追加';
            if (submit) submit.textContent = '追加';
        }
        function resetTripModal() {
            editingTripId = null;
            const title = document.getElementById('trip-modal-title');
            const submit = document.getElementById('trip-submit');
            if (title) title.textContent = '出張状況を追加';
            if (submit) submit.textContent = '追加';
        }

        setupModal('add-att-btn', 'att-modal', 'att-cancel', 'att-submit', 'att-date',
            () => {
                resetAttModal();
                ['name','start','end','note'].forEach(id => document.getElementById(`att-${id}`).value = '');
                document.getElementById('att-type').selectedIndex = 0;
                document.getElementById('att-other-text').value = '';
                document.getElementById('att-other-wrap').style.display = 'none';
            },
            () => {
                const name = document.getElementById('att-name').value.trim(); const date = document.getElementById('att-date').value;
                if(!name || !date) { alert('対象日と名前は必ず入力してください'); return false; }
                const selectedType = document.getElementById('att-type').value;
                const type = selectedType === 'その他'
                    ? (document.getElementById('att-other-text').value.trim() || 'その他')
                    : selectedType;
                const data = { date, name, type, start: document.getElementById('att-start').value || '-', end: document.getElementById('att-end').value || '-', note: document.getElementById('att-note').value.trim() };
                const attPromise = editingAttId
                    ? db.collection('attendances').doc(editingAttId).update(data)
                    : db.collection('attendances').add(data);
                attPromise.then(() => { clearStatusCaches(); updateCacheVersion(); currentViewDate = new Date(date + 'T00:00:00'); loadStatusData(date); });
                resetAttModal();
                return true;
            }
        );
        const attCancelBtn = document.getElementById('att-cancel');
        if (attCancelBtn) attCancelBtn.addEventListener('click', resetAttModal);
        const attTypeEl = document.getElementById('att-type');
        if (attTypeEl) attTypeEl.addEventListener('change', function() {
            document.getElementById('att-other-wrap').style.display = this.value === 'その他' ? '' : 'none';
        });

        function openEditAttModal(id) {
            const d = attendances.find(a => a.id === id);
            if (!d) return;
            const modal = document.getElementById('att-modal');
            if (!modal) return;
            editingAttId = id;
            document.getElementById('att-date').value = d.date || '';
            document.getElementById('att-name').value = d.name || '';
            const attTypeEl2 = document.getElementById('att-type');
            const knownTypes = Array.from(attTypeEl2.options).map(o => o.value);
            if (knownTypes.includes(d.type)) {
                attTypeEl2.value = d.type;
                document.getElementById('att-other-wrap').style.display = 'none';
            } else {
                attTypeEl2.value = 'その他';
                document.getElementById('att-other-text').value = d.type || '';
                document.getElementById('att-other-wrap').style.display = '';
            }
            document.getElementById('att-start').value = (d.start === '-') ? '' : (d.start || '');
            document.getElementById('att-end').value = (d.end === '-') ? '' : (d.end || '');
            document.getElementById('att-note').value = d.note || '';
            const title = document.getElementById('att-modal-title');
            const submit = document.getElementById('att-submit');
            if (title) title.textContent = '出勤状況を編集';
            if (submit) submit.textContent = '更新';
            modal.classList.remove('hidden');
        }

        setupModal('add-vis-btn', 'vis-modal', 'vis-cancel', 'vis-submit', 'vis-date',
            () => {
                resetVisModal();
                ['org','count','rep','purpose','host','time','note'].forEach(id => document.getElementById(`vis-${id}`).value = '');
                if (clearVisLoc) clearVisLoc();
            },
            () => {
                const date = document.getElementById('vis-date').value; const org = document.getElementById('vis-org').value.trim(); const rep = document.getElementById('vis-rep').value.trim();
                if(!date || (!org && !rep)) { alert('対象日と、来客所属または代表者名のいずれかを入力してください'); return false; }
                const locVal = document.getElementById('vis-loc').value || '-';
                const data = { date, org: org||'-', count: document.getElementById('vis-count').value||'-', rep: rep||'-', purpose: document.getElementById('vis-purpose').value||'-', host: document.getElementById('vis-host').value||'-', loc: locVal||'-', time: document.getElementById('vis-time').value||'-', note: document.getElementById('vis-note').value.trim() };
                const visPromise = editingVisId
                    ? db.collection('visitors').doc(editingVisId).update(data)
                    : db.collection('visitors').add(data);
                visPromise.then(() => { clearStatusCaches(); updateCacheVersion(); currentViewDate = new Date(date + 'T00:00:00'); loadStatusData(date); });
                resetVisModal();
                return true;
            }
        );
        const visCancelBtn = document.getElementById('vis-cancel');
        if (visCancelBtn) visCancelBtn.addEventListener('click', resetVisModal);

        function openEditVisModal(id) {
            const d = visitors.find(v => v.id === id);
            if (!d) return;
            const modal = document.getElementById('vis-modal');
            if (!modal) return;
            editingVisId = id;
            document.getElementById('vis-date').value = d.date || '';
            document.getElementById('vis-org').value = (d.org === '-') ? '' : (d.org || '');
            document.getElementById('vis-count').value = (d.count === '-') ? '' : (d.count || '');
            document.getElementById('vis-rep').value = (d.rep === '-') ? '' : (d.rep || '');
            document.getElementById('vis-purpose').value = (d.purpose === '-') ? '' : (d.purpose || '');
            document.getElementById('vis-host').value = (d.host === '-') ? '' : (d.host || '');
            if (setVisLoc) { setVisLoc(d.loc); } else { document.getElementById('vis-loc').value = (d.loc === '-') ? '' : (d.loc || ''); }
            document.getElementById('vis-time').value = (d.time === '-') ? '' : (d.time || '');
            document.getElementById('vis-note').value = d.note || '';
            const title = document.getElementById('vis-modal-title');
            const submit = document.getElementById('vis-submit');
            if (title) title.textContent = '来客状況を編集';
            if (submit) submit.textContent = '更新';
            modal.classList.remove('hidden');
        }

        setupModal('add-trip-btn', 'trip-modal', 'trip-cancel', 'trip-submit', 'trip-date',
            () => {
                resetTripModal();
                ['name','purpose','loc','time','note'].forEach(id => document.getElementById(`trip-${id}`).value = '');
            },
            () => {
                const date = document.getElementById('trip-date').value; const name = document.getElementById('trip-name').value.trim();
                if(!date || !name) { alert('対象日と名前は必ず入力してください'); return false; }
                const data = { date, name, purpose: document.getElementById('trip-purpose').value||'-', loc: document.getElementById('trip-loc').value||'-', time: document.getElementById('trip-time').value||'-', note: document.getElementById('trip-note').value.trim() };
                const tripPromise = editingTripId
                    ? db.collection('trips').doc(editingTripId).update(data)
                    : db.collection('trips').add(data);
                tripPromise.then(() => { clearStatusCaches(); updateCacheVersion(); currentViewDate = new Date(date + 'T00:00:00'); loadStatusData(date); });
                resetTripModal();
                return true;
            }
        );
        const tripCancelBtn = document.getElementById('trip-cancel');
        if (tripCancelBtn) tripCancelBtn.addEventListener('click', resetTripModal);

        function openEditTripModal(id) {
            const d = trips.find(t => t.id === id);
            if (!d) return;
            const modal = document.getElementById('trip-modal');
            if (!modal) return;
            editingTripId = id;
            document.getElementById('trip-date').value = d.date || '';
            document.getElementById('trip-name').value = d.name || '';
            document.getElementById('trip-purpose').value = (d.purpose === '-') ? '' : (d.purpose || '');
            document.getElementById('trip-loc').value = (d.loc === '-') ? '' : (d.loc || '');
            document.getElementById('trip-time').value = (d.time === '-') ? '' : (d.time || '');
            document.getElementById('trip-note').value = d.note || '';
            const title = document.getElementById('trip-modal-title');
            const submit = document.getElementById('trip-submit');
            if (title) title.textContent = '出張状況を編集';
            if (submit) submit.textContent = '更新';
            modal.classList.remove('hidden');
        }
    }

    // ==========================================
    // ★修正: 各クラス時間割システム (Firebase版)
    // ==========================================
    const ttBody = document.getElementById('timetable-body');

    if (ttBody) {
        let timetables = [];
        let isTtEditMode = false;
        const days = ['月', '火', '水', '木', '金'];
        const TT_CLASSES = ['1-1','1-2','1-3','1-4','2-1','2-2','2-3','2-4','3-1','3-2','3-3','3-4','3-A','A選択','B選択','C選択','D選択','E選択','F選択','プログラム','芸術'];
        const TT_DAYS = ['月','火','水','木','金'];
        const TT_PERIODS = ['1','2','3','4','5','6','7'];

        function renderTimetable() {
            ttBody.innerHTML = '';
            if (timetables.length === 0) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="8" style="text-align:center;color:#aaa;padding:24px;font-size:14px;">登録された時間割はありません</td>`;
                ttBody.appendChild(tr);
                return;
            }
            days.forEach(day => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<th class="tt-day-col">${day}</th>`;
                for (let period = 1; period <= 7; period++) {
                    const td = document.createElement('td');
                    td.className = 'tt-cell';
                    if (isTtEditMode) td.classList.add('edit-mode');

                    const classesInSlot = timetables.filter(t => t.day === day && t.period === String(period));
                    classesInSlot.sort((a, b) => a.className.localeCompare(b.className)).forEach(data => {
                        const tag = document.createElement('div');
                        tag.className = 'tt-tag';
                        tag.innerHTML = `
                            <span class="tt-class">${data.className}</span> ${data.subject} <span class="tt-teacher">(${data.teacher})</span>
                            <button class="delete-tt-btn" data-id="${data.id}">×</button>
                        `;
                        td.appendChild(tag);
                    });
                    tr.appendChild(td);
                }
                ttBody.appendChild(tr);
            });
        }

        async function loadTimetables() {
            await ensureCacheVersionChecked();
            const cached = getSC('sc_timetables');
            if (cached) { timetables = cached; renderTimetable(); return; }
            try {
                const snapshot = await db.collection('timetables').get();
                timetables = [];
                snapshot.forEach(doc => timetables.push({ id: doc.id, ...doc.data() }));
                setSC('sc_timetables', timetables);
                renderTimetable();
            } catch(e) { console.warn('timetables 取得エラー', e); }
        }
        loadTimetables();

        const ttReloadBtn = document.getElementById('tt-reload-btn');
        if (ttReloadBtn) {
            ttReloadBtn.addEventListener('click', async () => {
                ttReloadBtn.classList.add('loading');
                clearSC('sc_timetables');
                await loadTimetables();
                ttReloadBtn.classList.remove('loading');
            });
        }

        const editBtn = document.getElementById('edit-tt-btn');
        const ttModal = document.getElementById('tt-modal');

        editBtn.addEventListener('click', () => {
            if (!isTtEditMode) {
                isTtEditMode = true;
                editBtn.innerHTML = '＋ 新規追加 ｜ 完了';
                editBtn.style.color = '#d9534f'; editBtn.style.borderColor = '#d9534f';
            } else {
                document.getElementById('tt-subject').value = ''; document.getElementById('tt-teacher').value = '';
                ttModal.classList.remove('hidden');
            }
            renderTimetable();
        });

        const closeTtModal = () => {
            ttModal.classList.add('hidden'); isTtEditMode = false;
            editBtn.innerHTML = '⚙️ 設定 (追加/削除)'; editBtn.style.color = ''; editBtn.style.borderColor = '';
            renderTimetable();
        };

        document.getElementById('tt-cancel').addEventListener('click', closeTtModal);
        ttModal.addEventListener('click', (e) => { if (e.target === ttModal) closeTtModal(); });

        document.getElementById('tt-submit').addEventListener('click', () => {
            const day = document.getElementById('tt-day').value; const period = document.getElementById('tt-period').value;
            const className = document.getElementById('tt-class').value;
            const subject = document.getElementById('tt-subject').value.trim(); const teacher = document.getElementById('tt-teacher').value.trim();

            if (!subject) { alert('科目名は必ず入力してください。'); return; }

            db.collection('timetables').add({ day, period, className, subject, teacher })
              .then(() => { clearSC('sc_timetables'); updateCacheVersion(); closeTtModal(); loadTimetables(); });
        });

        ttBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-tt-btn')) {
                const id = e.target.getAttribute('data-id');
                if (confirm('この授業を時間割から削除しますか？')) {
                    db.collection('timetables').doc(id).delete().then(() => { clearSC('sc_timetables'); updateCacheVersion(); loadTimetables(); });
                }
            }
        });

        // ── CSV一括登録 ──────────────────────────────────────────
        const ttCsvBtn = document.getElementById('tt-csv-btn');
        const ttCsvModal = document.getElementById('tt-csv-modal');
        const ttCsvFile = document.getElementById('tt-csv-file');
        const ttCsvPreviewWrap = document.getElementById('tt-csv-preview-wrap');
        const ttCsvPreviewBody = document.getElementById('tt-csv-preview-body');
        const ttCsvCount = document.getElementById('tt-csv-count');
        const ttCsvErrors = document.getElementById('tt-csv-errors');
        const ttCsvSubmit = document.getElementById('tt-csv-submit');

        let parsedTtRows = [];

        // テンプレートDL
        document.getElementById('tt-csv-template-dl').addEventListener('click', () => {
            const header = '曜日,時限,クラス,科目名,担当者';
            const examples = [
                '月,1,1-1,現代文,山田',
                '月,1,1-2,数学I,鈴木',
                '月,2,A選択,英語表現,田中',
                '火,3,プログラム,情報,佐藤',
            ].join('\n');
            const blob = new Blob(['\uFEFF' + header + '\n' + examples], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = 'timetable_template.csv'; a.click();
        });

        if (ttCsvBtn) {
            ttCsvBtn.addEventListener('click', () => {
                ttCsvFile.value = ''; ttCsvPreviewWrap.style.display = 'none';
                ttCsvErrors.textContent = ''; ttCsvSubmit.disabled = true; parsedTtRows = [];
                ttCsvModal.classList.remove('hidden');
            });
        }

        document.getElementById('tt-csv-cancel').addEventListener('click', () => ttCsvModal.classList.add('hidden'));
        ttCsvModal.addEventListener('click', (e) => { if (e.target === ttCsvModal) ttCsvModal.classList.add('hidden'); });

        ttCsvFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target.result;
                const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
                if (lines.length < 2) { ttCsvErrors.textContent = 'データ行がありません。'; return; }

                const errors = [];
                parsedTtRows = [];
                ttCsvPreviewBody.innerHTML = '';

                lines.slice(1).forEach((line, i) => {
                    const cols = line.split(',').map(c => c.trim());
                    const [day, period, className, subject, teacher] = cols;
                    const rowNum = i + 2;
                    if (!day || !period || !className || !subject) {
                        errors.push(`${rowNum}行目: 必須項目が不足しています（曜日・時限・クラス・科目名）`); return;
                    }
                    if (!TT_DAYS.includes(day)) { errors.push(`${rowNum}行目: 曜日「${day}」が不正です`); return; }
                    if (!TT_PERIODS.includes(period)) { errors.push(`${rowNum}行目: 時限「${period}」が不正です（1〜7）`); return; }

                    parsedTtRows.push({ day, period, className, subject, teacher });
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #F0EEE9';
                    tr.innerHTML = [day, period, className, subject, teacher].map(v =>
                        `<td style="padding:5px 10px;">${v}</td>`).join('');
                    ttCsvPreviewBody.appendChild(tr);
                });

                ttCsvCount.textContent = parsedTtRows.length;
                ttCsvErrors.innerHTML = errors.length ? errors.join('<br>') : '';
                ttCsvPreviewWrap.style.display = 'block';
                ttCsvSubmit.disabled = parsedTtRows.length === 0;
            };
            reader.readAsText(file, 'UTF-8');
        });

        ttCsvSubmit.addEventListener('click', async () => {
            if (parsedTtRows.length === 0) return;
            if (!confirm(`現在の時間割をすべて削除し、${parsedTtRows.length}件のデータで置き換えます。よろしいですか？`)) return;

            ttCsvSubmit.disabled = true;
            ttCsvSubmit.textContent = '登録中...';

            try {
                // 既存データを500件ずつ削除
                const existing = [...timetables];
                for (let i = 0; i < existing.length; i += 400) {
                    const batch = db.batch();
                    existing.slice(i, i + 400).forEach(t => batch.delete(db.collection('timetables').doc(t.id)));
                    await batch.commit();
                }
                // 新データを500件ずつ追加
                for (let i = 0; i < parsedTtRows.length; i += 400) {
                    const batch = db.batch();
                    parsedTtRows.slice(i, i + 400).forEach(row => batch.set(db.collection('timetables').doc(), row));
                    await batch.commit();
                }
                ttCsvModal.classList.add('hidden');
                alert(`${parsedTtRows.length}件の時間割を登録しました。`);
                clearSC('sc_timetables'); updateCacheVersion(); loadTimetables();
            } catch (err) {
                alert('登録中にエラーが発生しました。');
            } finally {
                ttCsvSubmit.disabled = false;
                ttCsvSubmit.textContent = '一括登録する';
            }
        });
    }
    
    // ==========================================
    // ★修正: 本日の連絡事項 (Firebase リアルタイム同期版)
    // ==========================================
    const noticeTimeline = document.getElementById('notice-timeline');
    
    if (noticeTimeline) {
        let notices = []; 
        let currentViewDate = new Date();
        let editingNoticeId = null; 

        const urlParams = new URLSearchParams(window.location.search);
        const currentCategory = urlParams.get('category') || '全教職員';
        const isAllMode = (currentCategory === 'all');

        const categoryTitle = document.getElementById('notice-category-title');
        if (categoryTitle) { categoryTitle.textContent = isAllMode ? `■ すべての連絡事項 (一括表示)` : `■ ${currentCategory} 連絡事項`; }

        const targetCategorySelect = document.getElementById('notice-target-category');
        if (targetCategorySelect && !isAllMode) { targetCategorySelect.value = currentCategory; }

        // ★「朝の連絡・帰りの連絡」を選ぶセレクトボックスを動的に追加
        let timingSelect = document.getElementById('notice-timing-select');
        if (targetCategorySelect && !timingSelect) {
            timingSelect = document.createElement('select');
            timingSelect.id = 'notice-timing-select';
            timingSelect.style.cssText = 'padding: 8px; border-radius: 4px; border: 1px solid #ccc; margin-left: 8px; display: none; background: #fff; font-size: 14px;';
            timingSelect.innerHTML = `<option value="朝の連絡">☀️ 朝の連絡</option><option value="帰りの連絡">🌙 帰りの連絡</option><option value="その他">📌 その他</option>`;
            targetCategorySelect.parentNode.insertBefore(timingSelect, targetCategorySelect.nextSibling);

            // 対象の学年が選ばれた時だけ表示する
            const updateTimingVisibility = () => {
                if (['中学', '高１', '高２', '高３'].includes(targetCategorySelect.value)) {
                    timingSelect.style.display = 'inline-block';
                } else {
                    timingSelect.style.display = 'none';
                    timingSelect.value = '朝の連絡'; // リセット
                }
            };
            targetCategorySelect.addEventListener('change', updateTimingVisibility);
            updateTimingVisibility();
        }

        const dateInput = document.getElementById('current-view-date');
        const prevBtn = document.getElementById('prev-day-btn');
        const nextBtn = document.getElementById('next-day-btn');
        const todayBtn = document.getElementById('today-btn');
        const postBtn = document.getElementById('btn-post-notice');
        const noticeAuthor = document.getElementById('notice-author');
        const noticeContent = document.getElementById('edit-content');

        const orderedCategories = ['全教職員', '中学', '高１', '高２', '高３'];

        function getFormattedDateStr(dateObj) {
            // ja-JP ロケールは元号年を返す場合があるため UTC+9 オフセットで直接計算
            const jst = new Date(dateObj.getTime() + 9 * 60 * 60 * 1000);
            return jst.toISOString().slice(0, 10); // 'YYYY-MM-DD'
        }

        // Firestore 応答を待たず日付入力を即時初期化
        if (dateInput) dateInput.value = getFormattedDateStr(currentViewDate);

        function getFormattedTimeStr(dateObj) {
            return `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        }

        // 連絡カードを生成する共通部品
        function createNoticeCard(notice) {
            const card = document.createElement('div');
            card.className = 'notice-card';
            card.innerHTML = `
                <div class="notice-header">
                    <span class="notice-author">👤 ${notice.author}</span>
                    <span class="notice-time">🕒 ${notice.time}</span>
                    <button class="edit-notice-btn" data-id="${notice.id}" style="background:transparent; color:#0066cc; border:none; font-size:16px; cursor:pointer; margin-right:8px;" title="編集"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                    <button class="delete-notice-btn" data-id="${notice.id}" style="background:transparent; color:#d9534f; border:none; font-size:18px; cursor:pointer;" title="削除">×</button>
                </div>
                <div class="rich-textarea" style="border:none; padding:0; min-height:auto;">${notice.content}</div>
            `;
            return card;
        }

        function renderNotices() {
            const viewDateStr = getFormattedDateStr(currentViewDate);
            dateInput.value = viewDateStr;
            noticeTimeline.innerHTML = '';

            const displayCategories = isAllMode ? orderedCategories : [currentCategory];

            displayCategories.forEach(cat => {
                const catNotices = notices.filter(n => n.date === viewDateStr && n.category === cat);
                
                if (isAllMode) {
                    const catHeader = document.createElement('h3');
                    catHeader.style.cssText = 'margin-top: 32px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #E6E4DF; color: #2c6e49;';
                    catHeader.textContent = `▼ ${cat}`;
                    noticeTimeline.appendChild(catHeader);
                }

                // ★「中学・高１〜３」の場合は、常に「▶ 朝の連絡」「▶ 帰りの連絡」の枠を表示する
                if (['中学', '高１', '高２', '高３'].includes(cat)) {
                    const morning = catNotices.filter(n => n.timing === '朝の連絡');
                    const evening = catNotices.filter(n => n.timing === '帰りの連絡');
                    const others = catNotices.filter(n => n.timing !== '朝の連絡' && n.timing !== '帰りの連絡');

                    const createSection = (title, items) => {
                        const secHeader = document.createElement('h4');
                        // 先生のイメージに合わせたデザイン（▶ と 下線で区切る）
                        secHeader.style.cssText = 'margin: 24px 0 16px; font-size: 16px; color: #4A4643; border-bottom: 1px solid #E6E4DF; padding-bottom: 6px;';
                        secHeader.textContent = title;
                        noticeTimeline.appendChild(secHeader);

                        // 投稿がない場合でも「枠」は残して分かりやすくする
                        if (items.length === 0) {
                            const emptyMsg = document.createElement('div');
                            emptyMsg.style.cssText = 'color:#888; font-size: 13px; margin-bottom: 24px; padding-left: 8px;';
                            emptyMsg.textContent = 'この時間帯の連絡はありません。';
                            noticeTimeline.appendChild(emptyMsg);
                        } else {
                            items.forEach(notice => { noticeTimeline.appendChild(createNoticeCard(notice)); });
                        }
                    };

                    // 朝と帰りのセクションを必ず順番に作成
                    createSection('▶ 朝の連絡', morning);
                    createSection('▶ 帰りの連絡', evening);
                    
                    // 「その他」は投稿がある時だけ表示する
                    if (others.length > 0) {
                        createSection('▶ その他の連絡', others); 
                    }

                } else {
                    // 全教職員などはセクション分けせずそのまま表示
                    if (catNotices.length === 0) {
                        const emptyMsg = document.createElement('div');
                        emptyMsg.style.cssText = 'text-align:center; color:#888; padding:20px; background:#fafafa; border-radius:8px; margin-bottom:24px;';
                        emptyMsg.textContent = '連絡事項はありません。';
                        noticeTimeline.appendChild(emptyMsg);
                    } else {
                        catNotices.forEach(notice => { noticeTimeline.appendChild(createNoticeCard(notice)); });
                    }
                }
            });
        }

        // notices をリアルタイム同期しつつ、表示日付でフィルタしてFirestore読み取りを削減
        // onSnapshotのリスナーを日付ごとに張り直す方式
        let unsubscribeNotices = null;

        function subscribeNotices() {
            // 既存のリスナーを解除してから張り直す
            if (unsubscribeNotices) {
                unsubscribeNotices();
                unsubscribeNotices = null;
            }
            const viewDateStr = getFormattedDateStr(currentViewDate);
            // 日付を即時反映（Firestore 応答前に表示を確定させる）
            if (dateInput) dateInput.value = viewDateStr;
            // orderBy を外してコンポジットインデックス不要に。ソートはクライアント側で行う
            unsubscribeNotices = db.collection('notices')
                .where('date', '==', viewDateStr)
                .onSnapshot((snapshot) => {
                    notices = [];
                    snapshot.forEach((doc) => { notices.push({ id: doc.id, ...doc.data() }); });
                    // createdAt の昇順にクライアント側でソート
                    notices.sort((a, b) => {
                        const ta = a.createdAt ? a.createdAt.toMillis() : 0;
                        const tb = b.createdAt ? b.createdAt.toMillis() : 0;
                        return ta - tb;
                    });
                    renderNotices();
                }, (err) => { console.error('notices listener error:', err); });
        }

        // 初回取得
        subscribeNotices();

        prevBtn.addEventListener('click', () => { currentViewDate.setDate(currentViewDate.getDate() - 1); subscribeNotices(); });
        nextBtn.addEventListener('click', () => { currentViewDate.setDate(currentViewDate.getDate() + 1); subscribeNotices(); });
        todayBtn.addEventListener('click', () => { currentViewDate = new Date(); subscribeNotices(); });
        dateInput.addEventListener('change', (e) => { if (e.target.value) { currentViewDate = new Date(e.target.value + 'T00:00:00'); subscribeNotices(); } });

        postBtn.addEventListener('click', () => {
            const content = noticeContent.innerHTML.trim();
            if (!content || content === '<br>' || content === '<p><br></p>') {
                alert('連絡内容を入力してください。'); return;
            }

            const author = noticeAuthor.value.trim() || '教職員';
            const targetCat = targetCategorySelect ? targetCategorySelect.value : '全教職員';
            const timing = (timingSelect && timingSelect.style.display !== 'none') ? timingSelect.value : '';
            const viewDateStr = getFormattedDateStr(currentViewDate);
            const now = new Date();

            const data = {
                category: targetCat,
                timing: timing, // ★朝か帰りかのデータを追加
                author: author,
                content: content
            };

            if (editingNoticeId) {
                db.collection('notices').doc(editingNoticeId).update(data).then(() => {
                    editingNoticeId = null; 
                    postBtn.textContent = '投稿する';
                    noticeContent.innerHTML = ''; 
                });
            } else {
                data.date = viewDateStr;
                data.time = getFormattedTimeStr(now);
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                db.collection('notices').add(data).then(() => {
                    noticeContent.innerHTML = ''; 
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                });
            }
        });

        noticeTimeline.addEventListener('click', (e) => {
            const delBtn = e.target.closest('.delete-notice-btn');
            const editBtn = e.target.closest('.edit-notice-btn');

            if (delBtn) {
                const id = delBtn.getAttribute('data-id');
                if (id && confirm('この連絡を削除しますか？')) { db.collection('notices').doc(id).delete(); }
            }
            if (editBtn) {
                const id = editBtn.getAttribute('data-id');
                const targetNotice = notices.find(n => n.id === id);
                if (targetNotice) {
                    editingNoticeId = targetNotice.id;
                    noticeContent.innerHTML = targetNotice.content;
                    noticeAuthor.value = targetNotice.author;
                    if (targetCategorySelect) {
                        targetCategorySelect.value = targetNotice.category;
                        // 学年が選ばれたらタイミング選択を表示して、値をセット
                        targetCategorySelect.dispatchEvent(new Event('change'));
                        if (timingSelect && targetNotice.timing) timingSelect.value = targetNotice.timing;
                    }
                    postBtn.textContent = '更新する';
                    noticeContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setTimeout(() => noticeContent.focus(), 400);
                }
            }
        });
    }
    // ==========================================
    // 行事予定ウィジェット（サイドバー：全日付縦一覧表示）
    // ==========================================
    const eventsWidgetList = document.getElementById('events-widget-list');
    if (eventsWidgetList) {
        const DAYS_JP   = ['日','月','火','水','木','金','土'];
        const MONTHS_JP = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
        const now       = new Date();
        const todayStr  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        let viewYear    = now.getFullYear();
        let viewMonth   = now.getMonth();

        // スクロール可能なラッパーに変更
        eventsWidgetList.style.cssText = 'list-style:none; padding:0; margin:0; max-height:420px; overflow-y:auto;';

        // 月ナビゲーションバー
        const navBar = document.createElement('div');
        navBar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:2px 2px 6px;';
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '‹';
        prevBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:20px; color:#888; padding:0 6px; line-height:1;';
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '›';
        nextBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:20px; color:#888; padding:0 6px; line-height:1;';
        const monthLabel = document.createElement('span');
        monthLabel.style.cssText = 'font-size:13px; font-weight:bold; color:#4A4643;';
        navBar.appendChild(prevBtn);
        navBar.appendChild(monthLabel);
        navBar.appendChild(nextBtn);
        eventsWidgetList.parentElement.insertBefore(navBar, eventsWidgetList);

        // 日付文字列を正規化してゼロ埋め ("2026-4-1" → "2026-04-01")
        function normEvDate(s) {
            if (!s) return '';
            const parts = s.replace(/\//g, '-').split('-');
            if (parts.length !== 3) return s;
            return `${parts[0]}-${String(parseInt(parts[1])).padStart(2,'0')}-${String(parseInt(parts[2])).padStart(2,'0')}`;
        }
        function parseEvDate(s) {
            if (!s) return new Date(NaN);
            const parts = s.replace(/\//g, '-').split('-');
            if (parts.length !== 3) return new Date(NaN);
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }

        let allEventsCache = [];

        function renderEventsWidget() {
            monthLabel.textContent = `${viewYear}年${MONTHS_JP[viewMonth]}`;
            const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
            const monthStart = new Date(viewYear, viewMonth, 1);
            const monthEnd   = new Date(viewYear, viewMonth, lastDay);

            // 全件から当月に該当するものを期間展開してevMapに入れる
            const evMap = {};
            allEventsCache.forEach(ev => {
                const from = parseEvDate(ev.dateFrom || ev.date);
                const to   = parseEvDate(ev.dateTo   || ev.dateFrom || ev.date);
                if (isNaN(from) || isNaN(to)) return;
                let d = new Date(Math.max(from, monthStart));
                const end = new Date(Math.min(to, monthEnd));
                while (d <= end) {
                    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    if (!evMap[ds]) evMap[ds] = [];
                    evMap[ds].push(ev);
                    d.setDate(d.getDate() + 1);
                }
            });

            eventsWidgetList.innerHTML = '';

            // 月の全日付を順に描画
            for (let day = 1; day <= lastDay; day++) {
                const dateStr  = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const d        = new Date(viewYear, viewMonth, day);
                const dow      = d.getDay();
                const isToday  = dateStr === todayStr;
                const isSun    = dow === 0;
                const isSat    = dow === 6;
                const dayEvs   = evMap[dateStr] || [];
                const hasEvs   = dayEvs.length > 0;

                const dowColor = isToday ? '#2c8c5a' : isSun ? '#c0392b' : isSat ? '#1a5276' : '#4A4643';
                const rowBg    = isToday ? '#EBF7F1' : isSun ? '#FFF8F8' : isSat ? '#F5F9FF' : '';

                const li = document.createElement('li');
                li.style.cssText = `display:flex; align-items:flex-start; padding:2px 4px;`
                    + (rowBg ? ` background:${rowBg};` : '')
                    + (isToday ? ' border-left:3px solid #2c8c5a;' : 'border-left:3px solid transparent;');

                // 日付ラベル列（固定幅）
                const dateCol = document.createElement('div');
                dateCol.style.cssText = `flex:0 0 30px; font-size:11px; font-weight:${hasEvs || isToday ? 'bold' : 'normal'}; color:${dowColor}; padding-top:1px; line-height:1.6;`;
                dateCol.textContent = `${day}${DAYS_JP[dow]}`;

                // 行事列
                const evCol = document.createElement('div');
                evCol.style.cssText = 'flex:1; min-width:0; padding-top:1px;';

                dayEvs.forEach(ev => {
                    const evLine = document.createElement('div');
                    const normT = s => s.replace(/[0-9]/g, d => '０１２３４５６７８９'[d]);
                    const rawTargets = (ev.targets && ev.targets.length) ? ev.targets : (ev.target ? ev.target.split(/[,、]/).map(t => t.trim()).filter(t => t) : []);
                    const targets = rawTargets.map(normT);
                    const bg = getEvBackground(targets, ev.color);
                    evLine.style.cssText = `font-size:11px; line-height:1.7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; background:${bg}; color:#333; border-radius:3px; padding:0 5px; margin-bottom:2px;`;
                    evLine.textContent = ev.title;
                    evLine.title = ev.title + (targets.length ? ` [${targets.join('・')}]` : '') + (ev.note ? `　${ev.note}` : '');
                    evCol.appendChild(evLine);
                });

                li.appendChild(dateCol);
                li.appendChild(evCol);
                eventsWidgetList.appendChild(li);
            }

            // 今日の行が見えるようにスクロール（レイアウト確定後に実行）
            const todayEl = [...eventsWidgetList.children].find(el => el.style.borderLeft.includes('#2c8c5a'));
            if (todayEl) {
                requestAnimationFrame(() => {
                    const elRect   = todayEl.getBoundingClientRect();
                    const listRect = eventsWidgetList.getBoundingClientRect();
                    eventsWidgetList.scrollTop += elRect.top - listRect.top - eventsWidgetList.clientHeight / 2 + todayEl.offsetHeight / 2;
                });
            }
        }

        // localStorage キャッシュ優先（annual_events.html と同じキーを共有）
        // TTL 60分: 変更がない限り何度開いても Firestore 読み取りゼロ
        const SIDEBAR_EV_KEY = 'cache_annual_events';
        const SIDEBAR_EV_TTL = 60 * 60 * 1000;
        async function startSidebarEventsListener() {
            if (typeof db === 'undefined' || !db) { setTimeout(startSidebarEventsListener, 200); return; }
            try {
                const ts  = parseInt(localStorage.getItem(SIDEBAR_EV_KEY + '_ts') || '0');
                const raw = Date.now() - ts <= SIDEBAR_EV_TTL ? localStorage.getItem(SIDEBAR_EV_KEY) : null;
                if (raw) {
                    allEventsCache = JSON.parse(raw);
                    renderEventsWidget();
                    return;
                }
            } catch(e) {}
            eventsWidgetList.innerHTML = '<li style="font-size:12px;color:#aaa;padding:6px 4px;">読み込み中...</li>';
            try {
                const snap = await db.collection('annual_events').get();
                allEventsCache = [];
                snap.forEach(doc => allEventsCache.push(doc.data()));
                try {
                    localStorage.setItem(SIDEBAR_EV_KEY, JSON.stringify(allEventsCache));
                    localStorage.setItem(SIDEBAR_EV_KEY + '_ts', String(Date.now()));
                } catch(e) {}
                renderEventsWidget();
            } catch (err) {
                console.error('sidebar events load error:', err);
            }
        }

        prevBtn.addEventListener('click', () => {
            viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } renderEventsWidget();
        });
        nextBtn.addEventListener('click', () => {
            viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } renderEventsWidget();
        });
        startSidebarEventsListener();
    }

    // ==========================================
    // 連絡事項 2カテゴリ比較ページ
    // ==========================================
    const compareContainer = document.getElementById('notice-compare-container');
    if (compareContainer) {
        const NOTICE_CAT_COLORS = {
            '全教職員': '#FADBD8', '中学': '#D6EAF8', '高１': '#D5F5E3',
            '高２': '#FCF3CF', '高３': '#E8DAEF'
        };

        let compareDate = new Date();
        let compareNotices = [];
        let unsubscribeCompare = null;

        const urlParams = new URLSearchParams(window.location.search);
        let cat1 = urlParams.get('cat1') || '中学';
        let cat2 = urlParams.get('cat2') || '高１';

        const dateInput   = document.getElementById('current-view-date');
        const prevBtn     = document.getElementById('prev-day-btn');
        const nextBtn     = document.getElementById('next-day-btn');
        const todayBtn    = document.getElementById('today-btn');
        const catLeft     = document.getElementById('cat-select-left');
        const catRight    = document.getElementById('cat-select-right');
        const tlLeft      = document.getElementById('timeline-left');
        const tlRight     = document.getElementById('timeline-right');

        catLeft.value  = cat1;
        catRight.value = cat2;

        function getDateStr(d) {
            const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
            return jst.toISOString().slice(0, 10);
        }
        if (dateInput) dateInput.value = getDateStr(compareDate);

        function createCard(notice) {
            const card = document.createElement('div');
            card.className = 'notice-card';
            card.innerHTML = `
                <div class="notice-header">
                    <span class="notice-author">👤 ${notice.author}</span>
                    <span class="notice-time">🕒 ${notice.time}</span>
                </div>
                <div class="rich-textarea" style="border:none; padding:0; min-height:auto;">${notice.content}</div>
            `;
            return card;
        }

        function renderPanel(timeline, category) {
            timeline.innerHTML = '';
            const viewDateStr = getDateStr(compareDate);
            const color = NOTICE_CAT_COLORS[category] || '#F0F0F0';
            const catNotices = compareNotices.filter(n => n.date === viewDateStr && n.category === category);

            const header = document.createElement('div');
            header.style.cssText = `background:${color}; padding:8px 16px; border-radius:6px; margin-bottom:16px; font-weight:bold; font-size:15px; color:#4A4643;`;
            header.textContent = `▼ ${category}`;
            timeline.appendChild(header);

            if (['中学', '高１', '高２', '高３'].includes(category)) {
                const morning = catNotices.filter(n => n.timing === '朝の連絡');
                const evening = catNotices.filter(n => n.timing === '帰りの連絡');
                const others  = catNotices.filter(n => n.timing !== '朝の連絡' && n.timing !== '帰りの連絡');

                const createSection = (title, items) => {
                    const sec = document.createElement('h4');
                    sec.style.cssText = 'margin:16px 0 12px; font-size:14px; color:#4A4643; border-bottom:1px solid #E6E4DF; padding-bottom:4px;';
                    sec.textContent = title;
                    timeline.appendChild(sec);
                    if (items.length === 0) {
                        const empty = document.createElement('div');
                        empty.style.cssText = 'color:#888; font-size:12px; margin-bottom:16px; padding-left:8px;';
                        empty.textContent = 'この時間帯の連絡はありません。';
                        timeline.appendChild(empty);
                    } else {
                        items.forEach(n => timeline.appendChild(createCard(n)));
                    }
                };
                createSection('▶ 朝の連絡', morning);
                createSection('▶ 帰りの連絡', evening);
                if (others.length > 0) createSection('▶ その他の連絡', others);
            } else {
                if (catNotices.length === 0) {
                    const empty = document.createElement('div');
                    empty.style.cssText = 'text-align:center; color:#888; padding:20px; background:#fafafa; border-radius:8px;';
                    empty.textContent = '連絡事項はありません。';
                    timeline.appendChild(empty);
                } else {
                    catNotices.forEach(n => timeline.appendChild(createCard(n)));
                }
            }
        }

        function renderBoth() {
            renderPanel(tlLeft, cat1);
            renderPanel(tlRight, cat2);
        }

        function subscribeCompare() {
            if (unsubscribeCompare) { unsubscribeCompare(); unsubscribeCompare = null; }
            const viewDateStr = getDateStr(compareDate);
            if (dateInput) dateInput.value = viewDateStr;
            unsubscribeCompare = db.collection('notices')
                .where('date', '==', viewDateStr)
                .onSnapshot(snapshot => {
                    compareNotices = [];
                    snapshot.forEach(doc => compareNotices.push({ id: doc.id, ...doc.data() }));
                    compareNotices.sort((a, b) => {
                        const ta = a.createdAt ? a.createdAt.toMillis() : 0;
                        const tb = b.createdAt ? b.createdAt.toMillis() : 0;
                        return ta - tb;
                    });
                    renderBoth();
                }, err => console.error('compare notices error:', err));
        }

        function updateUrl() {
            const url = new URL(window.location);
            url.searchParams.set('cat1', cat1);
            url.searchParams.set('cat2', cat2);
            window.history.replaceState({}, '', url);
        }

        catLeft.addEventListener('change',  () => { cat1 = catLeft.value;  updateUrl(); renderBoth(); });
        catRight.addEventListener('change', () => { cat2 = catRight.value; updateUrl(); renderBoth(); });
        prevBtn.addEventListener('click',   () => { compareDate.setDate(compareDate.getDate() - 1); subscribeCompare(); });
        nextBtn.addEventListener('click',   () => { compareDate.setDate(compareDate.getDate() + 1); subscribeCompare(); });
        todayBtn.addEventListener('click',  () => { compareDate = new Date(); subscribeCompare(); });
        dateInput.addEventListener('change', e => { if (e.target.value) { compareDate = new Date(e.target.value + 'T00:00:00'); subscribeCompare(); } });

        subscribeCompare();
    }

}); // ← ファイルの最後を閉じるカッコです