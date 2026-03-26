// ==========================================
// 2. 共通UIとサイドバー (ショートカット機能含む)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------
    // サイドバーの開閉機能 (Notionライク)
    // ------------------------------------------
    const layoutSidebar = document.querySelector('.sidebar');
    if (layoutSidebar) {
        layoutSidebar.style.position = 'relative';
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '≡'; closeBtn.title = 'サイドバーを閉じる';
        closeBtn.style.cssText = `position: absolute; top: 16px; right: 16px; background: transparent; border: none; font-size: 24px; cursor: pointer; color: #888; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;`;
        closeBtn.onmouseover = () => closeBtn.style.backgroundColor = '#E6E4DF';
        closeBtn.onmouseout = () => closeBtn.style.backgroundColor = 'transparent';
        layoutSidebar.appendChild(closeBtn);

        const openBtn = document.createElement('button');
        openBtn.innerHTML = '≡'; openBtn.title = 'サイドバーを開く';
        openBtn.style.cssText = `position: fixed; top: 16px; left: -50px; background: #FFF; border: 1px solid #E6E4DF; font-size: 20px; cursor: pointer; color: #4A4643; padding: 4px 10px; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); z-index: 1000; transition: left 0.3s ease;`;
        document.body.appendChild(openBtn);

        closeBtn.addEventListener('click', () => layoutSidebar.style.display = 'none');
        openBtn.addEventListener('click', () => { layoutSidebar.style.display = ''; openBtn.style.left = '-50px'; });

        document.addEventListener('mousemove', (e) => {
            if (layoutSidebar.style.display === 'none') {
                if (e.clientX <= 20) openBtn.style.left = '16px';
                else if (e.clientX > 80) openBtn.style.left = '-50px';
            }
        });

        // ──────────────────────────────
        // ホームに戻るボタン（ホーム以外のページで表示）
        // ──────────────────────────────
        const _cp = window.location.pathname;
        const _isHome = _cp === '/' || _cp.endsWith('/index.html');
        if (!_isHome) {
            const homeBtn = document.createElement('a');
            homeBtn.href = './index.html';
            homeBtn.innerHTML = '&#8592; ホームに戻る';
            homeBtn.style.cssText = [
                'display:block', 'padding:9px 16px', 'font-size:13px',
                'color:#4A4643', 'text-decoration:none',
                'border-bottom:1px solid #E6E4DF',
                'transition:background 0.15s'
            ].join(';');
            homeBtn.onmouseover = () => homeBtn.style.backgroundColor = '#dff0ea';
            homeBtn.onmouseout  = () => homeBtn.style.backgroundColor = '';
            const firstSec = layoutSidebar.querySelector('.sidebar-section');
            if (firstSec) layoutSidebar.insertBefore(homeBtn, firstSec);
        }
    }

    // ------------------------------------------
    // Appショートカットの自動整理＆カスタム登録（編集・並び替え対応）
    // ------------------------------------------
    const sidebarTitle = document.querySelector('.sidebar-title');
    const appList = document.querySelector('.app-list');

    if (sidebarTitle && appList && sidebarTitle.textContent.includes('ショートカット')) {
        sidebarTitle.style.display = 'flex'; sidebarTitle.style.justifyContent = 'space-between'; sidebarTitle.style.alignItems = 'center';
        const actionContainer = document.createElement('div');
        const editAppBtn = document.createElement('button');
        editAppBtn.textContent = '編集'; editAppBtn.style.cssText = 'background: transparent; color: #aaa; border: none; font-size: 12px; cursor: pointer; text-decoration: underline; padding: 4px; margin-right: 4px;';
        const addAppBtn = document.createElement('button');
        addAppBtn.textContent = '＋'; addAppBtn.title = '追加'; addAppBtn.style.cssText = 'background: transparent; color: #aaa; border: none; font-size: 12px; cursor: pointer; text-decoration: underline; padding: 4px;';
        actionContainer.appendChild(editAppBtn); actionContainer.appendChild(addAppBtn); sidebarTitle.appendChild(actionContainer);

        let customApps = []; 
        let isAppEditMode = false;
        let editingAppId = null; // 編集中のIDを記録

        function renderApps() {
            appList.innerHTML = '';
            const currentPath = window.location.pathname;

            const hasContext = currentPath.includes('column') || currentPath.includes('board_edit');
            if (currentPath.includes('column')) appList.appendChild(Object.assign(document.createElement('li'), {innerHTML: `<a href="./columns.html" class="app-link"><span class="app-icon">📰</span><span class="app-name">コラム一覧</span></a>`}));
            if (currentPath.includes('board_edit')) appList.appendChild(Object.assign(document.createElement('li'), {innerHTML: `<a href="./boards.html" class="app-link"><span class="app-icon">📋</span><span class="app-name">掲示板一覧</span></a>`}));
            if (hasContext && customApps.length > 0) appList.appendChild(Object.assign(document.createElement('div'), {style: 'height: 1px; background-color: #E6E4DF; margin: 8px 0;'}));

            customApps.forEach(app => {
                const li = document.createElement('li'); li.className = 'custom-app-item'; li.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
                const iconHtml = app.icon ? `<img src="${app.icon}" style="width: 20px; height: 20px; object-fit: cover; border-radius: 4px; margin-right: 8px;">` : `<span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background-color: #4A4643; color: white; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 8px;">${app.title ? app.title.charAt(0).toUpperCase() : '?'}</span>`;
                const pointerEvents = isAppEditMode ? 'pointer-events: none; opacity: 0.5;' : '';
                const linkHtml = `<a href="${isAppEditMode ? 'javascript:void(0)' : app.url}" class="app-link" ${isAppEditMode ? '' : 'target="_blank"'} style="flex: 1; ${pointerEvents}">${iconHtml}<span class="app-name">${app.title}</span></a>`;

                let actionsHtml = '';
                if (isAppEditMode) {
                    li.setAttribute('draggable', 'true');
                    li.dataset.id = app.id;
                    actionsHtml = `
                        <div style="display:flex; gap:4px; align-items:center;">
                            <button class="edit-app-item-btn" data-id="${app.id}" title="編集" style="background:transparent; color:#0066cc; border:none; cursor:pointer; font-size:14px; padding:2px;">✏️</button>
                            <button class="delete-app-btn" data-id="${app.id}" title="削除" style="background: transparent; color: #d9534f; border: none; font-size: 16px; cursor: pointer; padding: 2px; font-weight: bold;">×</button>
                        </div>
                    `;
                }
                li.innerHTML = linkHtml + actionsHtml;
                if (isAppEditMode) {
                    const handle = document.createElement('span');
                    handle.textContent = '⠿';
                    handle.style.cssText = 'color:#bbb; font-size:18px; padding:0 6px 0 2px; cursor:grab; user-select:none; flex:0 0 auto;';
                    li.insertBefore(handle, li.firstChild);
                }
                appList.appendChild(li);
            });
        }

        renderApps(); 

        setTimeout(() => {
            if(typeof db !== 'undefined') {
                db.collection('shortcuts').onSnapshot((snapshot) => {
                    customApps = []; 
                    snapshot.forEach((doc) => customApps.push({ id: doc.id, ...doc.data() })); 
                    
                    // 並び替え処理（orderがあればそれで、なければ作成順）
                    customApps.sort((a, b) => {
                        const orderA = a.order !== undefined ? a.order : (a.createdAt ? a.createdAt.seconds : 0);
                        const orderB = b.order !== undefined ? b.order : (b.createdAt ? b.createdAt.seconds : 0);
                        return orderA - orderB;
                    });
                    
                    // ローカル上で正確な順番を振り直す
                    customApps.forEach((app, index) => { app.order = index; });
                    renderApps();
                });
            }
        }, 500);

        editAppBtn.addEventListener('click', () => { isAppEditMode = !isAppEditMode; editAppBtn.textContent = isAppEditMode ? '完了' : '編集'; editAppBtn.style.color = isAppEditMode ? '#d9534f' : '#aaa'; editAppBtn.style.textDecoration = isAppEditMode ? 'none' : 'underline'; renderApps(); });

        // ドラッグ＆ドロップで並び替え
        let _dndSrcId = null;
        appList.addEventListener('dragstart', (e) => {
            if (e.target.tagName === 'BUTTON') { e.preventDefault(); return; }
            const item = e.target.closest('li.custom-app-item');
            if (!item) return;
            _dndSrcId = item.dataset.id;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => { item.style.opacity = '0.4'; }, 0);
        });
        appList.addEventListener('dragend', () => {
            appList.querySelectorAll('li.custom-app-item').forEach(li => { li.style.opacity = ''; li.style.boxShadow = ''; });
        });
        appList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const item = e.target.closest('li.custom-app-item');
            if (!item || item.dataset.id === _dndSrcId) return;
            appList.querySelectorAll('li.custom-app-item').forEach(li => { li.style.boxShadow = ''; });
            const rect = item.getBoundingClientRect();
            item.style.boxShadow = e.clientY < rect.top + rect.height / 2 ? 'inset 0 2px 0 #0066cc' : 'inset 0 -2px 0 #0066cc';
            e.dataTransfer.dropEffect = 'move';
        });
        appList.addEventListener('drop', async (e) => {
            e.preventDefault();
            appList.querySelectorAll('li.custom-app-item').forEach(li => { li.style.boxShadow = ''; });
            const targetItem = e.target.closest('li.custom-app-item');
            if (!targetItem || !_dndSrcId || targetItem.dataset.id === _dndSrcId) return;
            const srcIdx = customApps.findIndex(a => a.id === _dndSrcId);
            const rect = targetItem.getBoundingClientRect();
            const insertBefore = e.clientY < rect.top + rect.height / 2;
            const arr = [...customApps];
            const [moved] = arr.splice(srcIdx, 1);
            let insertIdx = arr.findIndex(a => a.id === targetItem.dataset.id);
            if (!insertBefore) insertIdx++;
            arr.splice(insertIdx, 0, moved);
            const batch = db.batch();
            arr.forEach((app, idx) => { batch.update(db.collection('shortcuts').doc(app.id), { order: idx }); });
            await batch.commit();
        });
        
        appList.addEventListener('click', async (e) => {
            const appId = e.target.getAttribute('data-id');
            if (!appId) return;

            if (e.target.classList.contains('delete-app-btn')) {
                if (confirm(`このショートカットを削除しますか？`)) { db.collection('shortcuts').doc(appId).delete(); }
            }
            if (e.target.classList.contains('edit-app-item-btn')) {
                const app = customApps.find(a => a.id === appId);
                if(app) {
                    editingAppId = app.id;
                    document.getElementById('app-title').value = app.title;
                    document.getElementById('app-url').value = app.url;
                    document.getElementById('app-icon').value = '';
                    document.getElementById('app-submit').textContent = '更新';
                    document.querySelector('#app-modal-overlay .modal-title').textContent = 'ショートカットを編集';
                    appModal.classList.remove('hidden');
                }
            }
        });

        let appModal = document.getElementById('app-modal-overlay');
        if (!appModal) {
            appModal = document.createElement('div'); appModal.id = 'app-modal-overlay'; appModal.className = 'modal-overlay hidden';
            appModal.innerHTML = `<div class="modal-content"><h3 class="modal-title">ショートカットを追加</h3><div class="form-group"><label>タイトル</label><input type="text" id="app-title" class="modal-input" placeholder="例：経費精算システム"></div><div class="form-group"><label>リンク先 (URL)</label><input type="text" id="app-url" class="modal-input" placeholder="https://..."></div><div class="form-group"><label>アイコン画像 (任意)</label><input type="file" id="app-icon" class="modal-input" accept="image/png, image/jpeg"><small style="color: #666; font-size: 12px;">※指定しない場合は頭文字になります。</small></div><div class="modal-actions"><button id="app-cancel" class="btn-cancel">キャンセル</button><button id="app-submit" class="btn-submit">追加</button></div></div>`;
            document.body.appendChild(appModal);
        }

        addAppBtn.addEventListener('click', () => { 
            editingAppId = null;
            document.getElementById('app-title').value = ''; 
            document.getElementById('app-url').value = ''; 
            document.getElementById('app-icon').value = ''; 
            document.getElementById('app-submit').textContent = '追加';
            document.querySelector('#app-modal-overlay .modal-title').textContent = 'ショートカットを追加';
            appModal.classList.remove('hidden'); 
        });
        
        document.getElementById('app-cancel').addEventListener('click', () => appModal.classList.add('hidden'));

        function compressIconToBlob(file, maxWidth, callback) {
            const r = new FileReader();
            r.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas'); let w = img.width; let h = img.height;
                    if (w > h) { if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; } } else { if (h > maxWidth) { w *= maxWidth / h; h = maxWidth; } }
                    canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(blob => callback(blob), 'image/jpeg', 0.8);
                };
                img.src = e.target.result;
            };
            r.readAsDataURL(file);
        }

        document.getElementById('app-submit').addEventListener('click', () => {
            const title = document.getElementById('app-title').value.trim(); const url = document.getElementById('app-url').value.trim(); const iconFile = document.getElementById('app-icon').files[0]; const submitBtn = document.getElementById('app-submit');
            if (!title || !url) { alert('入力してください。'); return; }
            
            submitBtn.disabled = true; submitBtn.textContent = '保存中...';
            
            const saveShortcut = (iconUrl) => { 
                const data = { title, url };
                if(iconUrl !== null) data.icon = iconUrl;

                if (editingAppId) {
                    db.collection('shortcuts').doc(editingAppId).update(data).then(() => { finishSave(); });
                } else {
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    data.order = customApps.length; // 一番下に追加
                    db.collection('shortcuts').add(data).then(() => { finishSave(); });
                }
            };

            const finishSave = () => {
                submitBtn.disabled = false; submitBtn.textContent = editingAppId ? '更新' : '追加'; appModal.classList.add('hidden');
            };

            if (iconFile) { 
                compressIconToBlob(iconFile, 120, async (blob) => { 
                    try { const r = storage.ref().child('icons/' + Date.now() + '.jpg'); await r.put(blob); saveShortcut(await r.getDownloadURL()); } 
                    catch (err) { submitBtn.disabled = false; submitBtn.textContent = 'エラー'; } 
                }); 
            } else { 
                saveShortcut(editingAppId ? null : ""); // 編集時は画像を上書きしないようにnullを渡す
            }
        });
    }
});