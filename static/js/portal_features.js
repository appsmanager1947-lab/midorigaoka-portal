document.addEventListener('DOMContentLoaded', () => {

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

    // 描画関数
    function renderSubmissions(tbody, showAll) {
        if (!tbody) return;
        tbody.innerHTML = '';
        const displayData = showAll ? submissions : submissions.filter(s => s.status === 'active');

        // クラウド側で並び替えているためそのまま表示
        displayData.forEach(data => {
            const tr = document.createElement('tr');
            const linkHtml = data.url ? `<a href="${data.url}" class="link-btn" target="_blank">開く</a>` : `<span style="color:#ccc;">-</span>`;
            
            let statusHtml = '';
            let actionHtml = '';
            let deleteBtnHtml = showAll ? `<button class="delete-submission-btn" data-id="${data.id}" style="background-color: transparent; color: #d9534f; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px; margin-left: 12px;">削除</button>` : '';

            if (data.status === 'completed') {
                statusHtml = `<span style="background-color: #e0e0e0; color: #666; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 8px;">終了済み</span>`;
                actionHtml = `<span style="color:#ccc; font-size: 12px;">操作不可</span>` + deleteBtnHtml;
            } else {
                actionHtml = `<button class="complete-btn" data-id="${data.id}" style="background-color: transparent; color: #aaa; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px;">終了</button>` + deleteBtnHtml;
            }

            tr.innerHTML = `<td>${data.title} ${statusHtml}</td><td>${data.dept}</td><td>${data.deadline}</td><td>${linkHtml}</td><td>${actionHtml}</td>`;
            tbody.appendChild(tr);
        });
    }

    // ★追加: リアルタイム監視 (作成日時の降順＝新しい順で取得)
    db.collection('submissions').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        submissions = [];
        snapshot.forEach((doc) => { submissions.push({ id: doc.id, ...doc.data() }); });
        renderSubmissions(indexTableBody, false);
        renderSubmissions(allSubmissionsBody, true);
    });

    // ボタン操作（終了・削除）
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('complete-btn')) {
            if(confirm('このタスクを終了済みにしますか？（トップページからは非表示になります）')) {
                const id = e.target.getAttribute('data-id'); // ★parseIntを削除
                db.collection('submissions').doc(id).update({ status: 'completed' });
            }
        }
        if (e.target.classList.contains('delete-submission-btn')) {
            if(confirm('このタスクを完全に削除しますか？（元に戻せません）')) {
                const id = e.target.getAttribute('data-id'); // ★parseIntを削除
                db.collection('submissions').doc(id).delete();
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
            });
        });
    }

    // ==========================================
    // ★修正：共有掲示板の処理 (Firebase版)
    // ==========================================
    const boardTableBody = document.getElementById('board-list-body');
    const allBoardsBody = document.getElementById('all-boards-body'); 

    let boards = [];

    function renderBoards(tbody, showAll) {
        if (!tbody) return;
        tbody.innerHTML = '';
        const displayData = showAll ? boards : boards.filter(b => b.status === 'active');

        displayData.forEach(data => {
            const tr = document.createElement('tr');
            
            // ★ポイント：タイトルをクリックで直接「編集画面」へ飛ぶ
            const titleHtml = `<a href="/board_edit.html?edit_id=${data.id}" style="color: #4A4643; text-decoration: underline; font-weight: bold;">${data.title}</a>`;
            let statusHtml = data.status === 'completed' ? `<span style="background-color: #e0e0e0; color: #666; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 8px;">終了済み</span>` : '';
            
            let deleteBtnHtml = showAll ? `<button class="delete-board-btn" data-id="${data.id}" style="background-color: transparent; color: #d9534f; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px; margin-left: 12px;">削除</button>` : '';
            let actionHtml = data.status === 'completed' 
                ? `<span style="color:#ccc; font-size: 12px;">操作不可</span>` + deleteBtnHtml 
                : `<button class="complete-board-btn" data-id="${data.id}" style="background-color: transparent; color: #aaa; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px;">終了</button>` + deleteBtnHtml;

            tr.innerHTML = `<td>${titleHtml} ${statusHtml}</td><td>${data.dept}</td><td>${data.period}</td><td>${actionHtml}</td>`;
            tbody.appendChild(tr);
        });
    }

    // リアルタイム監視 (新しい順)
    if (boardTableBody || allBoardsBody) {
        db.collection('boards').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
            boards = [];
            snapshot.forEach((doc) => { boards.push({ id: doc.id, ...doc.data() }); });
            renderBoards(boardTableBody, false); 
            renderBoards(allBoardsBody, true);
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('complete-board-btn')) {
            if(confirm('この掲示を終了済みにしますか？')) {
                const id = e.target.getAttribute('data-id');
                db.collection('boards').doc(id).update({ status: 'completed' });
            }
        }
        if (e.target.classList.contains('delete-board-btn')) {
            if(confirm('完全に削除しますか？')) {
                const id = e.target.getAttribute('data-id');
                db.collection('boards').doc(id).delete();
            }
        }
    });

    // ==========================================
    // ★修正: コラムデータの管理と画面遷移 (Firebase版)
    // ==========================================
    let columns = [];
    let drafts = [];

    function createColumnCard(col) {
        const imgSrc = col.img ? col.img : "https://placehold.co/400x400/CCCCCC/FFFFFF?text=No+Image";
        const authorStr = col.author || '教職員';
        const tagsArray = authorStr.split(/[\s　]+/).filter(tag => tag.length > 0);
        const tagsHtml = tagsArray.map(tag => `<span class="column-tag">${tag}</span>`).join('');

        return `
            <div class="column-card" data-id="${col.id}">
                <button class="delete-col-btn" title="削除">×</button>
                <button class="edit-col-btn" title="編集">✏️</button>
                <img src="${imgSrc}" alt="サムネイル" class="column-img">
                <div class="column-content">
                    <div class="column-title">${col.title}</div>
                    <div class="column-tags">
                        ${tagsHtml}
                        <span class="column-tag">${col.date}</span>
                    </div>
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
                    db.collection('columns').doc(colId).delete();
                }
                return; 
            }
            if (e.target.classList.contains('edit-col-btn')) {
                window.location.href = `/column_edit.html?edit_id=${colId}`;
                return;
            }
            window.location.href = `/column_detail.html?id=${colId}`;
        });
    }

    const colContainer = document.getElementById('column-list-container');
    const allColContainer = document.getElementById('all-columns-container');

    // コラムのリアルタイム取得
    if (colContainer || allColContainer) {
        db.collection('columns').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
            columns = [];
            snapshot.forEach((doc) => { columns.push({ id: doc.id, ...doc.data() }); });
            
            if (colContainer) {
                const sortedCols = [...columns].slice(0, 4); // 最新4件
                colContainer.innerHTML = sortedCols.map(createColumnCard).join('');
                setupColumnCardEvents('column-list-container');
            }
            
            if (allColContainer && typeof renderAllColumns === 'function') {
                renderAllColumns(); // 全一覧ページ用（フィルター再描画）
            }
        });
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
                allColContainer.innerHTML = '<div style="color: #888; padding: 20px;">該当するコラムがありません。</div>';
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
        let isWebappEditMode = false;
        let editingWebappId = null;
        let currentWebappFilter = ''; // ★フィルター用の変数

        // ★フィルター用のセレクトボックスをUIに追加
        let webappFilterDiv = document.getElementById('webapp-filter-container');
        if (!webappFilterDiv) {
            webappFilterDiv = document.createElement('div');
            webappFilterDiv.id = 'webapp-filter-container';
            webappFilterDiv.style.cssText = 'margin-bottom: 12px; text-align: right;';
            webappFilterDiv.innerHTML = `<select id="webapp-filter" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #E6E4DF; background: #fff; cursor: pointer; color: #4A4643;"><option value="">🏷️ すべてのタグ</option></select>`;
            webappGrid.parentNode.insertBefore(webappFilterDiv, webappGrid);
            
            document.getElementById('webapp-filter').addEventListener('change', (e) => {
                currentWebappFilter = e.target.value;
                renderWebapps();
            });
        }

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

        function renderLinkGrid(config) {
            const grid = document.getElementById(config.gridId);
            grid.innerHTML = '';

            const tags = [...new Set(config.items.map(i => i.tag).filter(t => t))];
            const selectEl = document.getElementById(config.filterId);
            selectEl.innerHTML = `<option value="">🏷️ すべてのタグ</option>` + tags.map(t => `<option value="${t}">${t}</option>`).join('');
            selectEl.value = config.currentFilter;

            const displayItems = config.currentFilter ? config.items.filter(i => i.tag === config.currentFilter) : config.items;

            displayItems.forEach(item => {
                const card = document.createElement('div');
                card.style.cssText = `position: relative; padding: 16px; background: #fff; border: 1px solid #E6E4DF; border-radius: 8px; display: flex; flex-direction: column; justify-content: space-between; min-height: 80px; transition: box-shadow 0.2s; cursor: ${config.isEditMode ? 'default' : 'pointer'};`;

                let contentHtml;
                if (config.hasDetailModal) {
                    const opacityStyle = config.isEditMode ? 'opacity: 0.5;' : '';
                    contentHtml = `
                        <div class="webapp-card-content" data-id="${item.id}" style="height: 100%; ${opacityStyle}">
                            <div style="font-weight: bold; font-size: 14px; color: #4A4643; margin-bottom: 12px; line-height: 1.4;">${item.title}</div>
                            <div style="font-size: 11px; color: #666; background: #F7F7F5; border: 1px solid #E6E4DF; display: inline-block; padding: 2px 8px; border-radius: 12px;">${item.tag}</div>
                        </div>
                    `;
                } else {
                    const linkPointerEvents = config.isEditMode ? 'pointer-events: none; opacity: 0.5;' : '';
                    const hrefAttr = config.isEditMode ? 'javascript:void(0)' : item.url;
                    const targetAttr = config.isEditMode ? '' : 'target="_blank"';
                    contentHtml = `
                        <a href="${hrefAttr}" ${targetAttr} style="text-decoration: none; color: inherit; display: block; height: 100%; ${linkPointerEvents}">
                            <div style="font-weight: bold; font-size: 14px; color: #4A4643; margin-bottom: 12px; line-height: 1.4;">${item.title}</div>
                            <div style="font-size: 11px; color: #666; background: #F7F7F5; border: 1px solid #E6E4DF; display: inline-block; padding: 2px 8px; border-radius: 12px;">${item.tag}</div>
                        </a>
                    `;
                }

                let editActionsHtml = '';
                if (config.isEditMode) {
                    editActionsHtml = `
                        <div style="position: absolute; top: -12px; right: -8px; display:flex; gap:2px; background:#fff; border:1px solid #E6E4DF; border-radius:4px; padding:2px; box-shadow:0 2px 4px rgba(0,0,0,0.1); z-index:10;">
                            <button class="${config.upBtnClass}" data-id="${item.id}" title="前へ" style="background:transparent; border:none; cursor:pointer; font-size:14px;">◀</button>
                            <button class="${config.downBtnClass}" data-id="${item.id}" title="次へ" style="background:transparent; border:none; cursor:pointer; font-size:14px;">▶</button>
                            <button class="${config.editBtnClass}" data-id="${item.id}" title="編集" style="background:transparent; color:#0066cc; border:none; cursor:pointer; font-size:14px;">✏️</button>
                            <button class="${config.deleteBtnClass}" data-id="${item.id}" title="削除" style="background:transparent; color:#d9534f; border:none; cursor:pointer; font-size:16px; font-weight:bold;">×</button>
                        </div>
                    `;
                    card.style.border = '1px dashed #0066cc';
                }

                card.innerHTML = contentHtml + editActionsHtml;
                card.onmouseover = () => { if (!config.isEditMode) card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; };
                card.onmouseout = () => { if (!config.isEditMode) card.style.boxShadow = 'none'; };

                if (config.hasDetailModal) {
                    card.querySelector('.webapp-card-content').addEventListener('click', () => {
                        if (config.isEditMode) return;
                        document.getElementById('detail-webapp-title').textContent = item.title;
                        document.getElementById('detail-webapp-tag').textContent = item.tag;
                        document.getElementById('detail-webapp-desc').textContent = item.description || '説明文はありません。';
                        document.getElementById('detail-webapp-open').href = item.url;
                        webappDetailModal.classList.remove('hidden');
                    });
                }

                grid.appendChild(card);
            });
        }

        function renderWebapps() {
            renderLinkGrid({
                gridId: 'webapp-grid',
                filterId: 'webapp-filter',
                collectionName: 'webapps',
                items: webappItems,
                isEditMode: isWebappEditMode,
                hasDetailModal: true,
                currentFilter: currentWebappFilter,
                upBtnClass: 'up-webapp-btn',
                downBtnClass: 'down-webapp-btn',
                editBtnClass: 'edit-webapp-item-btn',
                deleteBtnClass: 'delete-webapp-btn',
            });
        }

        db.collection('webapps').onSnapshot((snapshot) => {
            webappItems = [];
            snapshot.forEach((doc) => { webappItems.push({ id: doc.id, ...doc.data() }); });
            webappItems.sort((a, b) => {
                const orderA = a.order !== undefined ? a.order : (a.createdAt ? a.createdAt.seconds : 0);
                const orderB = b.order !== undefined ? b.order : (b.createdAt ? b.createdAt.seconds : 0);
                return orderA - orderB;
            });
            webappItems.forEach((item, index) => { item.order = index; });
            renderWebapps();
        });

        editWebappBtn.addEventListener('click', () => {
            isWebappEditMode = !isWebappEditMode;
            editWebappBtn.textContent = isWebappEditMode ? '完了' : '編集';
            editWebappBtn.style.color = isWebappEditMode ? '#0066cc' : '#aaa';
            editWebappBtn.style.textDecoration = isWebappEditMode ? 'none' : 'underline';
            
            // 編集モード中はフィルターを強制解除して全体を表示する
            if (isWebappEditMode) {
                currentWebappFilter = '';
                document.getElementById('webapp-filter').value = '';
            }
            renderWebapps();
        });

        webappGrid.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            if (!id) return;

            if (e.target.classList.contains('delete-webapp-btn')) {
                const item = webappItems.find(i => i.id === id);
                if (item && confirm(`アプリ「${item.title}」を削除しますか？`)) { db.collection('webapps').doc(id).delete(); }
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
            if (e.target.classList.contains('up-webapp-btn') || e.target.classList.contains('down-webapp-btn')) {
                const idx = webappItems.findIndex(i => i.id === id);
                const isUp = e.target.classList.contains('up-webapp-btn');
                if (isUp && idx > 0) {
                    const batch = db.batch();
                    batch.update(db.collection('webapps').doc(webappItems[idx].id), { order: idx - 1 });
                    batch.update(db.collection('webapps').doc(webappItems[idx - 1].id), { order: idx });
                    await batch.commit();
                } else if (!isUp && idx < webappItems.length - 1) {
                    const batch = db.batch();
                    batch.update(db.collection('webapps').doc(webappItems[idx].id), { order: idx + 1 });
                    batch.update(db.collection('webapps').doc(webappItems[idx + 1].id), { order: idx });
                    await batch.commit();
                }
            }
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
                    <datalist id="webapp-tag-options"><option value="教職員"></option><option value="進路指導部"></option><option value="教務部"></option><option value="生徒指導部"></option><option value="入試対策部"></option><option value="総務部"></option><option value="生徒会"></option><option value="独自アプリ"></option></datalist>
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
                db.collection('webapps').doc(editingWebappId).update(data).then(() => { webappModal.classList.add('hidden'); });
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                data.order = webappItems.length;
                db.collection('webapps').add(data).then(() => { webappModal.classList.add('hidden'); });
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
        let currentDashFilter = ''; // ★フィルター用変数

        // ★フィルター用のセレクトボックスをUIに追加
        let dashFilterDiv = document.getElementById('dash-filter-container');
        if (!dashFilterDiv) {
            dashFilterDiv = document.createElement('div');
            dashFilterDiv.id = 'dash-filter-container';
            dashFilterDiv.style.cssText = 'margin-bottom: 12px; text-align: right;';
            dashFilterDiv.innerHTML = `<select id="dash-filter" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #E6E4DF; background: #fff; cursor: pointer; color: #4A4643;"><option value="">🏷️ すべてのタグ</option></select>`;
            dashboardGrid.parentNode.insertBefore(dashFilterDiv, dashboardGrid);
            
            document.getElementById('dash-filter').addEventListener('change', (e) => {
                currentDashFilter = e.target.value;
                renderDashboard();
            });
        }

        function renderDashboard() {
            renderLinkGrid({
                gridId: 'dashboard-grid',
                filterId: 'dash-filter',
                collectionName: 'dashboards',
                items: dashboardItems,
                isEditMode: isDashEditMode,
                hasDetailModal: false,
                currentFilter: currentDashFilter,
                upBtnClass: 'up-dash-btn',
                downBtnClass: 'down-dash-btn',
                editBtnClass: 'edit-dash-item-btn',
                deleteBtnClass: 'delete-dash-btn',
            });
        }

        db.collection('dashboards').onSnapshot((snapshot) => {
            dashboardItems = [];
            snapshot.forEach((doc) => { dashboardItems.push({ id: doc.id, ...doc.data() }); });
            dashboardItems.sort((a, b) => {
                const orderA = a.order !== undefined ? a.order : (a.createdAt ? a.createdAt.seconds : 0);
                const orderB = b.order !== undefined ? b.order : (b.createdAt ? b.createdAt.seconds : 0);
                return orderA - orderB;
            });
            dashboardItems.forEach((item, index) => { item.order = index; });
            renderDashboard();
        });

        editDashBtn.addEventListener('click', () => {
            isDashEditMode = !isDashEditMode;
            editDashBtn.textContent = isDashEditMode ? '完了' : '編集';
            editDashBtn.style.color = isDashEditMode ? '#0066cc' : '#aaa';
            editDashBtn.style.textDecoration = isDashEditMode ? 'none' : 'underline';
            
            // 編集モード中はフィルターを強制解除して全体を表示する
            if (isDashEditMode) {
                currentDashFilter = '';
                document.getElementById('dash-filter').value = '';
            }
            renderDashboard();
        });

        dashboardGrid.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            if (!id) return;

            if (e.target.classList.contains('delete-dash-btn')) {
                const item = dashboardItems.find(i => i.id === id);
                if (item && confirm(`リンク「${item.title}」を削除しますか？`)) { db.collection('dashboards').doc(id).delete(); }
            }
            if (e.target.classList.contains('edit-dash-item-btn')) {
                const item = dashboardItems.find(i => i.id === id);
                if (item) {
                    editingDashId = id;
                    document.getElementById('dash-title').value = item.title;
                    document.getElementById('dash-tag').value = item.tag;
                    document.getElementById('dash-url').value = item.url;
                    document.getElementById('dash-submit').textContent = '更新';
                    document.querySelector('#dash-modal-overlay .modal-title').textContent = 'ダッシュボードを編集';
                    dashModal.classList.remove('hidden');
                }
            }
            if (e.target.classList.contains('up-dash-btn') || e.target.classList.contains('down-dash-btn')) {
                const idx = dashboardItems.findIndex(i => i.id === id);
                const isUp = e.target.classList.contains('up-dash-btn');
                if (isUp && idx > 0) {
                    const batch = db.batch();
                    batch.update(db.collection('dashboards').doc(dashboardItems[idx].id), { order: idx - 1 });
                    batch.update(db.collection('dashboards').doc(dashboardItems[idx - 1].id), { order: idx });
                    await batch.commit();
                } else if (!isUp && idx < dashboardItems.length - 1) {
                    const batch = db.batch();
                    batch.update(db.collection('dashboards').doc(dashboardItems[idx].id), { order: idx + 1 });
                    batch.update(db.collection('dashboards').doc(dashboardItems[idx + 1].id), { order: idx });
                    await batch.commit();
                }
            }
        });

        const dashModal = document.createElement('div');
        dashModal.id = 'dash-modal-overlay';
        dashModal.className = 'modal-overlay hidden';
        dashModal.innerHTML = `
            <div class="modal-content">
                <h3 class="modal-title">ダッシュボードにリンクを追加</h3>
                <div class="form-group"><label>タイトル</label><input type="text" id="dash-title" class="modal-input" placeholder="例：令和8年度 生徒指導規程"></div>
                <div class="form-group">
                    <label>タグ</label><input type="text" id="dash-tag" class="modal-input" list="dash-tag-options" placeholder="選択または入力してください">
                    <datalist id="dash-tag-options"><option value="教職員"></option><option value="進路指導部"></option><option value="教務部"></option><option value="生徒指導部"></option><option value="入試対策部"></option><option value="総務部"></option><option value="生徒会"></option></datalist>
                </div>
                <div class="form-group"><label>リンク先 (URL)</label><input type="text" id="dash-url" class="modal-input" placeholder="https://..."></div>
                <div class="modal-actions"><button id="dash-cancel" class="btn-cancel">キャンセル</button><button id="dash-submit" class="btn-submit">追加</button></div>
            </div>
        `;
        document.body.appendChild(dashModal);

        addDashBtn.addEventListener('click', () => {
            editingDashId = null;
            document.getElementById('dash-title').value = ''; document.getElementById('dash-tag').value = ''; document.getElementById('dash-url').value = '';
            document.getElementById('dash-submit').textContent = '追加';
            document.querySelector('#dash-modal-overlay .modal-title').textContent = 'ダッシュボードにリンクを追加';
            dashModal.classList.remove('hidden');
        });
        document.getElementById('dash-cancel').addEventListener('click', () => dashModal.classList.add('hidden'));

        document.getElementById('dash-submit').addEventListener('click', () => {
            const title = document.getElementById('dash-title').value.trim();
            const tag = document.getElementById('dash-tag').value.trim() || 'リンク';
            const url = document.getElementById('dash-url').value.trim();
            if (!title || !url) { alert('タイトルとリンクは必ず入力してください。'); return; }

            const data = { title, tag, url };

            if (editingDashId) {
                db.collection('dashboards').doc(editingDashId).update(data).then(() => { dashModal.classList.add('hidden'); });
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                data.order = dashboardItems.length;
                db.collection('dashboards').add(data).then(() => { dashModal.classList.add('hidden'); });
            }
        });
    }

    // ==========================================
    // 4. コラム詳細ページの表示 (column_detail.html)
    // ==========================================
    const detailTitle = document.getElementById('detail-title');
    if (detailTitle) {
        const urlParams = new URLSearchParams(window.location.search);
        const colId = urlParams.get('id');

        db.collection('columns').doc(colId).get().then(doc => {
            if (doc.exists) {
                const colData = doc.data();

                detailTitle.textContent = colData.title;

                const detailActions = document.getElementById('detail-actions');
                if (detailActions) {
                    detailActions.style.display = 'block';

                    document.getElementById('btn-detail-edit').addEventListener('click', () => {
                        window.location.href = `/column_edit.html?edit_id=${colId}`;
                    });

                    document.getElementById('btn-detail-delete').addEventListener('click', () => {
                        if (confirm('このコラムを削除してもよろしいですか？')) {
                            db.collection('columns').doc(colId).delete().then(() => {
                                window.location.href = '/columns.html';
                            });
                        }
                    });
                }

                const authorStr = colData.author || '教職員';
                const tagsArray = authorStr.split(/[\s　]+/).filter(tag => tag.length > 0);
                const tagsHtml = tagsArray.map(tag => `<span class="column-tag">${tag}</span>`).join('');

                const tagsContainer = document.querySelector('.column-tags');
                if (tagsContainer) {
                    tagsContainer.innerHTML = `${tagsHtml} <span class="column-tag">${colData.date}</span>`;
                }

                const eyecatch = document.getElementById('detail-eyecatch');
                if (colData.img) {
                    eyecatch.src = colData.img;
                    eyecatch.style.display = 'inline-block';
                }
                document.getElementById('detail-content').innerHTML = colData.content;
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

        // リアルタイム監視
        if (resBody) {
            db.collection('reservations').onSnapshot(snapshot => {
                reservations = []; snapshot.forEach(doc => reservations.push({ id: doc.id, ...doc.data() }));
                renderTable(resBody, reservations, 'room');
            });
        }
        if (spBody) {
            db.collection('special_rooms').onSnapshot(snapshot => {
                specialRooms = []; snapshot.forEach(doc => specialRooms.push({ id: doc.id, ...doc.data() }));
                renderTable(spBody, specialRooms, 'special');
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-res-btn')) {
                if(confirm('この予約を完全に削除しますか？')) {
                    const id = e.target.getAttribute('data-id');
                    const type = e.target.getAttribute('data-type');
                    if (type === 'room') db.collection('reservations').doc(id).delete();
                    else if (type === 'special') db.collection('special_rooms').doc(id).delete();
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
            }).then(() => modalElement.classList.add('hidden'));
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
    // ★修正: 勤務・出張・来客システム (Firebase版)
    // ==========================================
    const attBody = document.getElementById('attendance-body');
    const visBody = document.getElementById('visitor-body');
    const tripBody = document.getElementById('trip-body');
    const arcAttBody = document.getElementById('archive-attendance-body');
    const arcVisBody = document.getElementById('archive-visitor-body');
    const arcTripBody = document.getElementById('archive-trip-body');

    if (attBody || visBody || tripBody || arcAttBody) {
        let attendances = []; let visitors = []; let trips = [];

        const now = new Date();
        const jstFormatter = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
        const todayParts = jstFormatter.formatToParts(now);
        const todayStr = `${todayParts.find(p=>p.type==='year').value}-${todayParts.find(p=>p.type==='month').value}-${todayParts.find(p=>p.type==='day').value}`;
        const isArchivePage = window.location.pathname.includes('status_archive');
        const sortByDate = (arr) => [...arr].sort((a, b) => (a.date > b.date ? 1 : -1));

        function renderStatusTables() {
            const targetAttBody = isArchivePage ? arcAttBody : attBody;
            if (targetAttBody) {
                targetAttBody.innerHTML = '';
                const filtered = isArchivePage ? attendances.filter(d => d.date !== todayStr) : attendances.filter(d => d.date === todayStr);
                sortByDate(filtered).forEach(d => {
                    const tr = document.createElement('tr');
                    const dateCol = isArchivePage ? `<td>${d.date}</td>` : '';
                    tr.innerHTML = `${dateCol}<td style="font-weight: bold;">${d.name}</td><td><span style="background: #F7F7F5; border: 1px solid #E6E4DF; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${d.type}</span></td><td>${d.start}</td><td>${d.end}</td><td style="white-space: pre-wrap; font-size: 12px; line-height: 1.4; color: #666;">${d.note}</td><td><button class="delete-status-btn" data-id="${d.id}" data-type="att" style="background: transparent; color: #d9534f; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px;">削除</button></td>`;
                    targetAttBody.appendChild(tr);
                });
            }

            const targetVisBody = isArchivePage ? arcVisBody : visBody;
            if (targetVisBody) {
                targetVisBody.innerHTML = '';
                const filtered = isArchivePage ? visitors.filter(d => d.date !== todayStr) : visitors.filter(d => d.date === todayStr);
                sortByDate(filtered).forEach(d => {
                    const tr = document.createElement('tr');
                    const dateCol = isArchivePage ? `<td>${d.date}</td>` : '';
                    tr.innerHTML = `${dateCol}<td style="font-weight: bold;">${d.org}</td><td>${d.count}</td><td>${d.rep}</td><td>${d.purpose}</td><td>${d.host}</td><td><span style="background: #F7F7F5; border: 1px solid #E6E4DF; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${d.loc}</span></td><td>${d.time}</td><td style="white-space: pre-wrap; font-size: 12px; line-height: 1.4; color: #666;">${d.note}</td><td><button class="delete-status-btn" data-id="${d.id}" data-type="vis" style="background: transparent; color: #d9534f; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px;">削除</button></td>`;
                    targetVisBody.appendChild(tr);
                });
            }

            const targetTripBody = isArchivePage ? arcTripBody : tripBody;
            if (targetTripBody) {
                targetTripBody.innerHTML = '';
                const filtered = isArchivePage ? trips.filter(d => d.date !== todayStr) : trips.filter(d => d.date === todayStr);
                sortByDate(filtered).forEach(d => {
                    const tr = document.createElement('tr');
                    const dateCol = isArchivePage ? `<td>${d.date}</td>` : '';
                    tr.innerHTML = `${dateCol}<td style="font-weight: bold;">${d.name}</td><td>${d.purpose}</td><td>${d.loc}</td><td>${d.time}</td><td style="white-space: pre-wrap; font-size: 12px; line-height: 1.4; color: #666;">${d.note}</td><td><button class="delete-status-btn" data-id="${d.id}" data-type="trip" style="background: transparent; color: #d9534f; border: none; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px;">削除</button></td>`;
                    targetTripBody.appendChild(tr);
                });
            }
        }

        // リアルタイム監視
        db.collection('attendances').onSnapshot(snap => { attendances = []; snap.forEach(doc => attendances.push({ id: doc.id, ...doc.data() })); renderStatusTables(); });
        db.collection('visitors').onSnapshot(snap => { visitors = []; snap.forEach(doc => visitors.push({ id: doc.id, ...doc.data() })); renderStatusTables(); });
        db.collection('trips').onSnapshot(snap => { trips = []; snap.forEach(doc => trips.push({ id: doc.id, ...doc.data() })); renderStatusTables(); });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-status-btn')) {
                if(confirm('この項目を完全に削除しますか？')) {
                    const id = e.target.getAttribute('data-id');
                    const type = e.target.getAttribute('data-type');
                    if (type === 'att') db.collection('attendances').doc(id).delete();
                    if (type === 'vis') db.collection('visitors').doc(id).delete();
                    if (type === 'trip') db.collection('trips').doc(id).delete();
                }
            }
        });

        function setupModal(btnId, modalId, cancelId, submitId, dateId, onOpen, onSubmit) {
            const btn = document.getElementById(btnId); const modal = document.getElementById(modalId);
            if (!btn || !modal) return;
            btn.addEventListener('click', () => { onOpen(); document.getElementById(dateId).value = todayStr; modal.classList.remove('hidden'); });
            document.getElementById(cancelId).addEventListener('click', () => modal.classList.add('hidden'));
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
            document.getElementById(submitId).addEventListener('click', () => { if(onSubmit()) modal.classList.add('hidden'); });
        }

        setupModal('add-att-btn', 'att-modal', 'att-cancel', 'att-submit', 'att-date',
            () => { ['name','start','end','note'].forEach(id => document.getElementById(`att-${id}`).value = ''); document.getElementById('att-type').selectedIndex = 0; },
            () => {
                const name = document.getElementById('att-name').value.trim(); const date = document.getElementById('att-date').value;
                if(!name || !date) { alert('対象日と名前は必ず入力してください'); return false; }
                db.collection('attendances').add({ date, name, type: document.getElementById('att-type').value, start: document.getElementById('att-start').value || '-', end: document.getElementById('att-end').value || '-', note: document.getElementById('att-note').value.trim() });
                return true;
            }
        );

        setupModal('add-vis-btn', 'vis-modal', 'vis-cancel', 'vis-submit', 'vis-date',
            () => { ['org','count','rep','purpose','host','loc','time','note'].forEach(id => document.getElementById(`vis-${id}`).value = ''); },
            () => {
                const date = document.getElementById('vis-date').value; const org = document.getElementById('vis-org').value.trim(); const rep = document.getElementById('vis-rep').value.trim();
                if(!date || (!org && !rep)) { alert('対象日と、来客所属または代表者名のいずれかを入力してください'); return false; }
                db.collection('visitors').add({ date, org: org||'-', count: document.getElementById('vis-count').value||'-', rep: rep||'-', purpose: document.getElementById('vis-purpose').value||'-', host: document.getElementById('vis-host').value||'-', loc: document.getElementById('vis-loc').value||'-', time: document.getElementById('vis-time').value||'-', note: document.getElementById('vis-note').value.trim() });
                return true;
            }
        );

        setupModal('add-trip-btn', 'trip-modal', 'trip-cancel', 'trip-submit', 'trip-date',
            () => { ['name','purpose','loc','time','note'].forEach(id => document.getElementById(`trip-${id}`).value = ''); },
            () => {
                const date = document.getElementById('trip-date').value; const name = document.getElementById('trip-name').value.trim();
                if(!date || !name) { alert('対象日と名前は必ず入力してください'); return false; }
                db.collection('trips').add({ date, name, purpose: document.getElementById('trip-purpose').value||'-', loc: document.getElementById('trip-loc').value||'-', time: document.getElementById('trip-time').value||'-', note: document.getElementById('trip-note').value.trim() });
                return true;
            }
        );
    }

    // ==========================================
    // ★修正: 各クラス時間割システム (Firebase版)
    // ==========================================
    const ttBody = document.getElementById('timetable-body');

    if (ttBody) {
        let timetables = [];
        let isTtEditMode = false;
        const days = ['月', '火', '水', '木', '金'];

        function renderTimetable() {
            ttBody.innerHTML = '';
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

        // リアルタイム監視
        db.collection('timetables').onSnapshot(snapshot => {
            timetables = [];
            snapshot.forEach(doc => timetables.push({ id: doc.id, ...doc.data() }));
            renderTimetable();
        });

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

            if (!subject || !teacher) { alert('科目名と担当者は必ず入力してください。'); return; }

            db.collection('timetables').add({ day, period, className, subject, teacher })
              .then(() => closeTtModal());
        });

        ttBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-tt-btn')) {
                const id = e.target.getAttribute('data-id');
                if (confirm('この授業を時間割から削除しますか？')) {
                    db.collection('timetables').doc(id).delete();
                }
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
            const jstFormatter = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
            const parts = jstFormatter.formatToParts(dateObj);
            return `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}-${parts.find(p=>p.type==='day').value}`;
        }

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
                    <button class="edit-notice-btn" data-id="${notice.id}" style="background:transparent; color:#0066cc; border:none; font-size:16px; cursor:pointer; margin-right:8px;" title="編集">✏️</button>
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

        db.collection('notices').orderBy('createdAt', 'asc').onSnapshot((snapshot) => {
            notices = [];
            snapshot.forEach((doc) => { notices.push({ id: doc.id, ...doc.data() }); });
            renderNotices(); 
        });

        prevBtn.addEventListener('click', () => { currentViewDate.setDate(currentViewDate.getDate() - 1); renderNotices(); });
        nextBtn.addEventListener('click', () => { currentViewDate.setDate(currentViewDate.getDate() + 1); renderNotices(); });
        todayBtn.addEventListener('click', () => { currentViewDate = new Date(); renderNotices(); });
        dateInput.addEventListener('change', (e) => { if (e.target.value) { currentViewDate = new Date(e.target.value); renderNotices(); } });

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
            const id = e.target.getAttribute('data-id');
            if (!id) return;

            if (e.target.classList.contains('delete-notice-btn')) {
                if (confirm('この連絡を削除しますか？')) { db.collection('notices').doc(id).delete(); }
            }
            if (e.target.classList.contains('edit-notice-btn')) {
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
                    window.scrollTo({ top: noticeContent.offsetTop - 100, behavior: 'smooth' });
                }
            }
        });
    }
}); // ← ファイルの最後を閉じるカッコです