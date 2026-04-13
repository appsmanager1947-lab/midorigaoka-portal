// ==========================================
// 3. エディタ専用スクリプト (portal_editor.js)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const editContent = document.getElementById('edit-content');
    if (editContent) {
        const editTitle = document.getElementById('edit-title');
        const editAuthor = document.getElementById('edit-author');
        const editAuthorName = document.getElementById('edit-author-name');
        const editDate = document.getElementById('edit-date');
        const btnPublish = document.getElementById('btn-publish');
        
        let currentEyecatchData = "";
        let editingColId = null;
        let isHtmlImportMode = false;
        
        const isBoardMode = window.location.pathname.includes('board_edit');
        const urlParams = new URLSearchParams(window.location.search);
        const editIdParam = urlParams.get('edit_id');
        const isDashboardSource = urlParams.get('source') === 'dashboard';
        const isDashboardEdit   = urlParams.get('source') === 'dashboard_edit';
        const isBoardItemSource  = urlParams.get('source') === 'board';
        const isBoardItemEdit    = urlParams.get('source') === 'board_edit';
        const isBoardsListSource = urlParams.get('source') === 'boards_list';
        const isBoardsListEdit   = urlParams.get('source') === 'boards_list_edit';
        const dashTag    = urlParams.get('dash_tag')    || 'その他';
        const dashTitle  = urlParams.get('dash_title')  || '';
        const boardItemTag   = urlParams.get('board_tag')   || 'その他';
        const boardItemTitle = urlParams.get('board_title') || '';
        const boardsListTitle  = urlParams.get('bl_title')  || '';
        const boardsListDept   = urlParams.get('bl_dept')   || '';
        const boardsListPeriod = urlParams.get('bl_period') || '';
        let syncTagsFromValue = null;

        function getTodayStr() {
            const d = new Date();
            return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
        }

        // ① クラウドから既存データを読み込む
        if (editIdParam) {
            editingColId = editIdParam;
            const collectionName = isBoardMode ? 'boards' : ((isBoardItemEdit || isBoardsListEdit) ? 'board_columns' : 'columns');
            
            db.collection(collectionName).doc(editIdParam).get().then((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    editTitle.value = data.title;
                    if(editAuthor) editAuthor.value = isBoardMode ? data.dept : data.author;
                    if (syncTagsFromValue) syncTagsFromValue();
                    if(editAuthorName && !isBoardMode) editAuthorName.value = data.authorName || '';
                    if(editDate) editDate.value = isBoardMode ? data.period : data.date;
                    if (!isBoardMode && data.contentType === 'html') {
                        isHtmlImportMode = true;
                        const htmlImportArea = document.getElementById('html-import-area');
                        const htmlInputEl = document.getElementById('html-input');
                        const btnModeEditorEl = document.getElementById('btn-mode-editor');
                        const btnModeHtmlEl = document.getElementById('btn-mode-html');
                        if (htmlImportArea) htmlImportArea.style.display = 'block';
                        editContent.style.display = 'none';
                        if (htmlInputEl) htmlInputEl.value = data.content || '';
                        if (btnModeEditorEl) { btnModeEditorEl.style.background = '#fff'; btnModeEditorEl.style.color = '#555'; btnModeEditorEl.style.borderColor = '#bbb'; }
                        if (btnModeHtmlEl) { btnModeHtmlEl.style.background = '#0066cc'; btnModeHtmlEl.style.color = '#fff'; btnModeHtmlEl.style.borderColor = '#0066cc'; }
                        const ctToggle = document.getElementById('content-type-toggle');
                        if (ctToggle) ctToggle.style.display = 'flex';
                    } else {
                        editContent.innerHTML = data.content;
                    }
                    if(btnPublish) btnPublish.textContent = "更新する";
                    
                    if (!isBoardMode && data.img) {
                        currentEyecatchData = data.img;
                        const preview = document.getElementById('cover-image-preview');
                        if (preview) {
                            preview.src = currentEyecatchData;
                            preview.style.display = 'block';
                            const btnAdd = document.getElementById('btn-add-cover');
                            const btnRem = document.getElementById('btn-remove-cover');
                            if(btnAdd) btnAdd.style.display = 'none';
                            if(btnRem) btnRem.style.display = 'block';
                        }
                    }
                }
            });
        } else {
            if (!isBoardMode && editDate && editDate.type === 'date') {
                editDate.valueAsDate = new Date();
            }
            if (isDashboardSource && dashTitle && editTitle) {
                editTitle.value = dashTitle;
            }
            if (isBoardItemSource && boardItemTitle && editTitle) {
                editTitle.value = boardItemTitle;
            }
            if (isBoardsListSource && boardsListTitle && editTitle) {
                editTitle.value = boardsListTitle;
            }
        }

        // ① タグセレクター UI (column_edit のみ)
        if (!isBoardMode) {
            const COLUMN_TAG_LIST = ['書類', '教職員', '進路指導部', '教務部', '生徒指導部', '入試対策部', '総務部', '生徒会', '学習サポート', '事務'];
            const tagPresetWrap = document.getElementById('tag-preset-buttons');
            const tagChipWrap = document.getElementById('tag-chip-wrap');
            const tagInput = document.getElementById('tag-text-input');
            const customTagDatalist = document.getElementById('custom-tag-options');
            let customTagList = [];

            // カスタムタグをFirestoreから読み込みdatalistを更新
            async function loadCustomTags() {
                try {
                    const doc = await db.collection('meta').doc('column_custom_tags').get();
                    customTagList = (doc.exists && Array.isArray(doc.data().tags)) ? doc.data().tags : [];
                    refreshCustomTagDatalist();
                } catch(e) {}
            }

            function refreshCustomTagDatalist() {
                if (!customTagDatalist) return;
                customTagDatalist.innerHTML = '';
                customTagList.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t;
                    customTagDatalist.appendChild(opt);
                });
            }

            // 新しいカスタムタグをFirestoreに保存
            async function saveCustomTag(tag) {
                if (COLUMN_TAG_LIST.includes(tag) || customTagList.includes(tag)) return;
                customTagList.push(tag);
                refreshCustomTagDatalist();
                try {
                    await db.collection('meta').doc('column_custom_tags').set(
                        { tags: customTagList },
                        { merge: true }
                    );
                } catch(e) {}
            }

            function syncValueFromUI() {
                const presetTags = Array.from(tagPresetWrap.querySelectorAll('.tag-preset-btn.active')).map(b => b.dataset.tag);
                const customChips = Array.from(tagChipWrap.querySelectorAll('.tag-chip')).map(c => c.dataset.tag);
                editAuthor.value = [...presetTags, ...customChips].join(' ');
            }

            function addCustomChip(text) {
                const chip = document.createElement('span');
                chip.className = 'tag-chip';
                chip.dataset.tag = text;
                chip.innerHTML = `${text}<button class="tag-chip-remove" type="button" aria-label="削除">×</button>`;
                chip.querySelector('.tag-chip-remove').addEventListener('click', () => { chip.remove(); syncValueFromUI(); });
                tagChipWrap.insertBefore(chip, tagInput);
                syncValueFromUI();
                saveCustomTag(text);
            }

            // カスタムタグ読み込み
            loadCustomTags();

            // プリセットボタン生成
            if (tagPresetWrap) {
                COLUMN_TAG_LIST.forEach(tag => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'tag-preset-btn';
                    btn.dataset.tag = tag;
                    btn.textContent = tag;
                    btn.addEventListener('click', () => { btn.classList.toggle('active'); syncValueFromUI(); });
                    tagPresetWrap.appendChild(btn);
                });
            }

            syncTagsFromValue = function() {
                tagPresetWrap.querySelectorAll('.tag-preset-btn').forEach(b => b.classList.remove('active'));
                tagChipWrap.querySelectorAll('.tag-chip').forEach(c => c.remove());
                const val = editAuthor.value.trim();
                if (!val) return;
                val.split(/\s+/).forEach(t => {
                    if (!t) return;
                    const btn = tagPresetWrap.querySelector(`[data-tag="${t}"]`);
                    if (btn) { btn.classList.add('active'); } else { addCustomChip(t); }
                });
            };

            if (tagInput) {
                tagInput.addEventListener('keydown', e => {
                    if (e.isComposing) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const v = tagInput.value.trim();
                        if (!v) return;
                        const preset = tagPresetWrap.querySelector(`[data-tag="${v}"]`);
                        if (preset) { preset.classList.add('active'); syncValueFromUI(); }
                        else { addCustomChip(v); }
                        tagInput.value = '';
                    } else if (e.key === 'Backspace' && tagInput.value === '') {
                        const chips = tagChipWrap.querySelectorAll('.tag-chip');
                        if (chips.length > 0) { chips[chips.length - 1].remove(); syncValueFromUI(); }
                    }
                });
            }
        }

        // ② HTMLインポートモード切替（コラム編集時のみ）
        if (!isBoardMode) {
            const btnModeEditor = document.getElementById('btn-mode-editor');
            const btnModeHtml = document.getElementById('btn-mode-html');
            const htmlImportArea = document.getElementById('html-import-area');
            const htmlInput = document.getElementById('html-input');
            const btnPreviewHtml = document.getElementById('btn-preview-html');
            const htmlPreviewFrame = document.getElementById('html-preview-frame');

            function setEditorMode() {
                isHtmlImportMode = false;
                editContent.style.display = '';
                if (htmlImportArea) htmlImportArea.style.display = 'none';
                if (btnModeEditor) { btnModeEditor.style.background = '#0066cc'; btnModeEditor.style.color = '#fff'; btnModeEditor.style.borderColor = '#0066cc'; }
                if (btnModeHtml) { btnModeHtml.style.background = '#fff'; btnModeHtml.style.color = '#555'; btnModeHtml.style.borderColor = '#bbb'; }
            }
            function setHtmlMode() {
                isHtmlImportMode = true;
                editContent.style.display = 'none';
                if (htmlImportArea) htmlImportArea.style.display = 'block';
                if (btnModeEditor) { btnModeEditor.style.background = '#fff'; btnModeEditor.style.color = '#555'; btnModeEditor.style.borderColor = '#bbb'; }
                if (btnModeHtml) { btnModeHtml.style.background = '#0066cc'; btnModeHtml.style.color = '#fff'; btnModeHtml.style.borderColor = '#0066cc'; }
            }
            if (btnModeEditor) btnModeEditor.addEventListener('click', setEditorMode);
            if (btnModeHtml) btnModeHtml.addEventListener('click', setHtmlMode);

            if (btnPreviewHtml && htmlPreviewFrame && htmlInput) {
                btnPreviewHtml.addEventListener('click', () => {
                    const raw = htmlInput.value.trim();
                    if (!raw) return;
                    const parsed = new DOMParser().parseFromString(raw, 'text/html');
                    const styles = Array.from(parsed.querySelectorAll('style')).map(s => s.outerHTML).join('');
                    const bodyHtml = parsed.body ? parsed.body.innerHTML : raw;
                    htmlPreviewFrame.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8">${styles}</head><body style="margin:0;">${bodyHtml}</body></html>`;
                    htmlPreviewFrame.style.display = 'block';
                    htmlPreviewFrame.onload = () => {
                        try { htmlPreviewFrame.style.height = htmlPreviewFrame.contentDocument.body.scrollHeight + 32 + 'px'; } catch(e) {}
                    };
                });
            }
        }

        // ③ 画像を Blob(ファイル実体) に変換する関数
        function compressImageToBlob(file, maxWidth, quality, callback) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    let width = img.width; let height = img.height;
                    if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => { callback(blob); }, 'image/jpeg', quality);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }

        // ③ カバー画像（アイキャッチ）のクラウドアップロード処理
        const btnAddCover = document.getElementById('btn-add-cover');
        const btnRemoveCover = document.getElementById('btn-remove-cover');
        const coverInput = document.getElementById('edit-eyecatch-file');
        const coverPreview = document.getElementById('cover-image-preview');

        if (btnAddCover && coverInput && coverPreview) {
            btnAddCover.addEventListener('click', () => coverInput.click());
            coverInput.addEventListener('change', (e) => {
                if(e.target.files[0]) {
                    coverPreview.src = "https://placehold.co/800x400/E6E4DF/4A4643?text=Uploading...";
                    coverPreview.style.display = 'block';
                    btnAddCover.style.display = 'none';

                    compressImageToBlob(e.target.files[0], 900, 0.72, async (blob) => {
                        try {
                            const fileName = 'covers/' + Date.now() + '.jpg';
                            const storageRef = storage.ref().child(fileName);
                            await storageRef.put(blob);
                            currentEyecatchData = await storageRef.getDownloadURL();
                            
                            coverPreview.src = currentEyecatchData;
                            if(btnRemoveCover) btnRemoveCover.style.display = 'block';
                        } catch (error) {
                            alert("画像のアップロードに失敗しました");
                            coverPreview.style.display = 'none';
                            btnAddCover.style.display = 'block';
                        }
                    });
                }
            });
            if (btnRemoveCover) {
                btnRemoveCover.addEventListener('click', () => {
                    currentEyecatchData = ""; coverPreview.src = "";
                    coverPreview.style.display = 'none'; btnAddCover.style.display = 'block';
                    btnRemoveCover.style.display = 'none'; coverInput.value = "";
                });
            }
        }

        // ④ ★完成版: Notion風 UI機能（スラッシュメニュー、モーダル等）
        const slashMenu = document.getElementById('slash-menu');
        const floatingToolbar = document.getElementById('floating-toolbar');
        let slashTargetNode = null;
        let slashMenuIndex = -1; 
        let isSlashMenuOpen = false;

        if (slashMenu) {
            slashMenu.innerHTML = '';
            const _s = b => `<svg viewBox="0 0 16 16" width="15" height="15" style="flex-shrink:0;display:block;">${b}</svg>`;
            const C = '#4A4643';
            const menuItems = [
                { cmd: 'h2', icon: _s(`<rect fill="${C}" x="1" y="1.5" width="14" height="4" rx="2"/><rect fill="${C}" x="1" y="8.5" width="11" height="2" rx="1"/><rect fill="${C}" x="1" y="12.5" width="7" height="2" rx="1"/>`), text: '見出し１' },
                { cmd: 'h3', icon: _s(`<rect fill="${C}" x="1" y="1.5" width="14" height="2.5" rx="1.25"/><rect fill="${C}" x="1" y="6.5" width="11" height="2" rx="1"/><rect fill="${C}" x="1" y="10.5" width="8" height="2" rx="1"/><rect fill="${C}" x="1" y="14" width="5" height="1.5" rx=".75"/>`), text: '見出し２' },
                { cmd: 'insertUnorderedList', icon: _s(`<circle fill="${C}" cx="3" cy="4" r="1.5"/><rect fill="${C}" x="6" y="3" width="9" height="2" rx="1"/><circle fill="${C}" cx="3" cy="8.5" r="1.5"/><rect fill="${C}" x="6" y="7.5" width="9" height="2" rx="1"/><circle fill="${C}" cx="3" cy="13" r="1.5"/><rect fill="${C}" x="6" y="12" width="9" height="2" rx="1"/>`), text: '箇条書き' },
                { cmd: 'insertOrderedList', icon: _s(`<rect fill="${C}" x="1.5" y="2.5" width="2.5" height="3.5" rx=".75"/><rect fill="${C}" x="6" y="3" width="9" height="2" rx="1"/><path fill="${C}" d="M1.5 9c0-.8 2.5-.8 2.5 0s-2.5 2-2.5 2.5h2.5"/><rect fill="${C}" x="6" y="8.5" width="9" height="2" rx="1"/><path fill="${C}" d="M1.5 13.5h2.5v.8H2.5v.8h1.5v.9H1.5"/><rect fill="${C}" x="6" y="14" width="9" height="2" rx="1"/>`), text: '番号付き箇条書き' },
                { cmd: 'insertCheckbox', icon: _s(`<rect fill="${C}" x="1.5" y="1.5" width="13" height="13" rx="2.5"/><path fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M4.5 8.5l2.5 2.5 4.5-4.5"/>`), text: 'チェックボックス' },
                { cmd: 'insertHorizontalRule', icon: _s(`<rect fill="${C}" x="0" y="7" width="16" height="2" rx="1"/><rect fill="${C}" x="2" y="3.5" width="12" height="1" rx=".5" opacity=".35"/><rect fill="${C}" x="2" y="11.5" width="12" height="1" rx=".5" opacity=".35"/>`), text: '水平線' },
                { cmd: 'insertCustomLink', icon: _s(`<path fill="none" stroke="${C}" stroke-width="1.8" stroke-linecap="round" d="M6 10.5a3.5 3.5 0 0 0 5 0l1.5-1.5a3.5 3.5 0 0 0-5-5L6 5.5M10 5.5a3.5 3.5 0 0 0-5 0L3.5 7a3.5 3.5 0 0 0 5 5l1.5-1.5"/>`), text: 'リンクを挿入' },
                { cmd: 'image', icon: _s(`<rect fill="${C}" x="1" y="2" width="14" height="12" rx="2"/><circle fill="white" cx="5" cy="5.5" r="1.5"/><path fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M1 12l3.5-4 3 2.5 2-2 4.5 4"/>`), text: '画像を挿入' },
                { cmd: 'insertTable', icon: _s(`<rect fill="${C}" x="1" y="1" width="14" height="14" rx="1.5"/><line stroke="white" stroke-width="1" x1="6.3" y1="1" x2="6.3" y2="15"/><line stroke="white" stroke-width="1" x1="10.7" y1="1" x2="10.7" y2="15"/><line stroke="white" stroke-width="1" x1="1" y1="6.3" x2="15" y2="6.3"/><line stroke="white" stroke-width="1" x1="1" y1="10.7" x2="15" y2="10.7"/>`), text: '表を挿入' },
            ];
            menuItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'slash-menu-item';
                div.setAttribute('data-command', item.cmd);
                div.innerHTML = `${item.icon}<span>${item.text}</span>`;
                div.style.cssText = 'padding: 8px 12px; cursor: pointer; font-size: 14px; border-radius: 4px; transition: background 0.2s; color: #4A4643; display: flex; align-items: center; gap: 10px;';
                slashMenu.appendChild(div);
            });
        }

        let tableModal = document.getElementById('table-modal-overlay');
        if (!tableModal) {
            tableModal = document.createElement('div');
            tableModal.id = 'table-modal-overlay';
            tableModal.className = 'modal-overlay hidden';
            tableModal.innerHTML = `
                <div class="modal-content" style="max-width: 300px;">
                    <h3 class="modal-title">表を挿入</h3>
                    <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                        <div class="form-group" style="flex: 1;"><label>列数 (横)</label><input type="number" id="table-cols" class="modal-input" value="3" min="1" max="10"></div>
                        <div class="form-group" style="flex: 1;"><label>行数 (縦)</label><input type="number" id="table-rows" class="modal-input" value="3" min="1" max="20"></div>
                    </div>
                    <div class="modal-actions"><button id="table-cancel" class="btn-cancel">キャンセル</button><button id="table-submit" class="btn-submit">挿入</button></div>
                </div>
            `;
            document.body.appendChild(tableModal);
        }
        
        let savedEditorRange = null;
        document.getElementById('table-cancel').addEventListener('click', () => tableModal.classList.add('hidden'));
        document.getElementById('table-submit').addEventListener('click', () => {
            const cols = parseInt(document.getElementById('table-cols').value) || 3;
            const rows = parseInt(document.getElementById('table-rows').value) || 3;
            
            let tableHTML = '<table style="width:100%; border-collapse:collapse; margin:16px 0; background-color:#fff; table-layout:fixed; overflow-wrap:break-word;"><tbody>';
            for (let i = 0; i < rows; i++) {
                tableHTML += '<tr>';
                for (let j = 0; j < cols; j++) { tableHTML += '<td style="border:1px solid #E6E4DF; padding:8px 12px; min-width:50px; vertical-align:top;"><br></td>'; }
                tableHTML += '</tr>';
            }
            tableHTML += '</tbody></table><p><br></p>';

            tableModal.classList.add('hidden');

            if (savedEditorRange) {
                let node = savedEditorRange.commonAncestorContainer;
                let editor = node.nodeType === 3 ? node.parentNode : node;
                if (editor && editor.closest) {
                    let ce = editor.closest('[contenteditable="true"]');
                    if (ce) ce.focus();
                }
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(savedEditorRange);
                document.execCommand('insertHTML', false, tableHTML);
            }
        });

        let linkModal = document.getElementById('link-modal-overlay');
        if (!linkModal) {
            linkModal = document.createElement('div');
            linkModal.id = 'link-modal-overlay';
            linkModal.className = 'modal-overlay hidden';
            linkModal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <h3 class="modal-title">リンクを挿入</h3>
                    <div class="form-group"><label>表示テキスト</label><input type="text" id="link-text" class="modal-input" placeholder="例：緑ヶ丘女子高等学校HP"></div>
                    <div class="form-group"><label>リンク先 (URL)</label><input type="text" id="link-url" class="modal-input" placeholder="https://..."></div>
                    <div class="modal-actions"><button id="link-cancel" class="btn-cancel">キャンセル</button><button id="link-submit" class="btn-submit">挿入</button></div>
                </div>
            `;
            document.body.appendChild(linkModal);
        }

        let savedSelectionRange = null;
        document.getElementById('link-cancel').addEventListener('click', () => {
            linkModal.classList.add('hidden'); editContent.focus();
            if (savedSelectionRange) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedSelectionRange); }
        });
        document.getElementById('link-submit').addEventListener('click', () => {
            const text = document.getElementById('link-text').value.trim();
            const url = document.getElementById('link-url').value.trim();
            if (!text || !url) { alert('テキストとURLを両方入力してください。'); return; }

            linkModal.classList.add('hidden'); editContent.focus();
            if (savedSelectionRange) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedSelectionRange); }
            
            const linkHtml = `<a href="${url}" target="_blank" style="color: #0066cc; text-decoration: underline;">${text}</a>`;
            document.execCommand('insertHTML', false, linkHtml);
        });

        function getCaretCoordinates() {
            const selection = window.getSelection();
            if (selection.rangeCount === 0) return null;
            const range = selection.getRangeAt(0).cloneRange();
            range.collapse(false);
            const rect = range.getClientRects()[0];
            if (rect) return { x: rect.left, y: rect.top };
            return null;
        }

        function closeSlashMenu() { 
            if(slashMenu) slashMenu.classList.add('hidden'); 
            isSlashMenuOpen = false; 
            slashMenuIndex = -1; 
        }

        function updateSlashMenuHighlight(items) {
            items.forEach((item, index) => {
                if (index === slashMenuIndex) { 
                    item.style.backgroundColor = '#E6E4DF'; 
                    item.style.fontWeight = 'bold'; 
                } else { 
                    item.style.backgroundColor = 'transparent'; 
                    item.style.fontWeight = 'normal'; 
                }
            });
        }

        function executeSlashCommand(command) {
            closeSlashMenu();
            if (slashTargetNode && slashTargetNode.nodeType === 3) {
                const text = slashTargetNode.textContent;
                const slashIndex = text.lastIndexOf('/');
                if (slashIndex !== -1) {
                    slashTargetNode.textContent = text.slice(0, slashIndex) + text.slice(slashIndex + 1);
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.setStart(slashTargetNode, slashIndex);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }

            setTimeout(() => {
                const sel = window.getSelection();
                let block = sel.anchorNode;
                while (block && block.nodeType !== 1) { block = block.parentNode; }
                const currentText = block ? block.textContent.trim() : '';

                const blockCommands = ['h2', 'h3', 'insertUnorderedList', 'insertOrderedList', 'insertHorizontalRule'];
                if (currentText.length > 0 && blockCommands.includes(command)) {
                    const r = document.createRange();
                    r.selectNodeContents(block);
                    r.collapse(false); 
                    sel.removeAllRanges();
                    sel.addRange(r);
                    document.execCommand('insertParagraph', false, null); 
                }

                if (command === 'insertTable') {
                    if (sel.rangeCount > 0) savedEditorRange = sel.getRangeAt(0).cloneRange();
                    document.getElementById('table-cols').value = 3; 
                    document.getElementById('table-rows').value = 3;
                    tableModal.classList.remove('hidden');
                    setTimeout(() => document.getElementById('table-cols').focus(), 50);
                } 
                else if (command === 'insertCustomLink') {
                    if (sel.rangeCount > 0) savedSelectionRange = sel.getRangeAt(0).cloneRange();
                    document.getElementById('link-text').value = ''; 
                    document.getElementById('link-url').value = '';
                    linkModal.classList.remove('hidden');
                    setTimeout(() => document.getElementById('link-text').focus(), 100);
                } 
                else if (command === 'image') {
                    const hiddenUpload = document.getElementById('hidden-img-upload');
                    if(hiddenUpload) hiddenUpload.click();
                } 
                else if (command === 'h2' || command === 'h3') {
                    const tempId = 'h-' + Date.now();
                    document.execCommand('insertHTML', false, `<${command} id="${tempId}"><br></${command}>`);
                    const el = document.getElementById(tempId);
                    if (el) {
                        el.removeAttribute('id');
                        const r = document.createRange();
                        r.setStart(el, 0);
                        r.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(r);
                    }
                } 
                else if (command === 'insertCheckbox') {
                    const uid = 'cb-' + Date.now();
                    const cbHtml = '<div class="checkbox-row" style="display:flex; align-items:center; gap:8px; margin:3px 0; padding:2px 0;">' +
                        '<input type="checkbox" style="cursor:pointer; width:15px; height:15px; flex-shrink:0; accent-color:#2c8c5a;" ' +
                        'onchange="var s=this.nextElementSibling; s.style.textDecoration=this.checked?\'line-through\':\'none\'; s.style.color=this.checked?\'#aaa\':\'inherit\';">' +
                        `<span id="${uid}" style="flex:1;"></span></div>`;
                    document.execCommand('insertHTML', false, cbHtml);
                    const span = document.getElementById(uid);
                    if (span) {
                        span.removeAttribute('id');
                        const r = document.createRange();
                        r.setStart(span, 0);
                        r.collapse(true);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(r);
                    }
                }
                else if (command === 'insertHorizontalRule') {
                    document.execCommand('insertHTML', false, '<hr><p><br></p>');
                }
                else {
                    document.execCommand(command, false, null);
                }
            }, 10);
        }

        if (editContent && slashMenu) {
            editContent.addEventListener('keydown', (e) => {
                // ── Ctrl+B / Ctrl+I / Ctrl+K ショートカット ──────────────
                if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); document.execCommand('bold', false, null); return; }
                    if (e.key === 'i' || e.key === 'I') { e.preventDefault(); document.execCommand('italic', false, null); return; }
                    if (e.key === 'u' || e.key === 'U') { e.preventDefault(); document.execCommand('underline', false, null); return; }
                    if (e.key === 'k' || e.key === 'K') {
                        e.preventDefault();
                        const sel = window.getSelection();
                        if (sel.rangeCount > 0) savedSelectionRange = sel.getRangeAt(0).cloneRange();
                        const selText = sel.toString();
                        document.getElementById('link-text').value = selText;
                        document.getElementById('link-url').value = '';
                        linkModal.classList.remove('hidden');
                        setTimeout(() => document.getElementById(selText ? 'link-url' : 'link-text').focus(), 100);
                        return;
                    }
                }
                // checkbox-row 内で Enter → 空なら段落に抜ける、テキストありなら次のチェックボックス行を作成
                if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isSlashMenuOpen) {
                    const sel = window.getSelection();
                    if (sel.rangeCount > 0) {
                        const anchor = sel.anchorNode;
                        const el = anchor.nodeType === 3 ? anchor.parentElement : (anchor instanceof Element ? anchor : null);
                        const checkboxRow = el ? el.closest('.checkbox-row') : null;
                        if (checkboxRow) {
                            e.preventDefault();
                            const isEmpty = anchor.textContent.trim() === '';
                            if (isEmpty) {
                                // 空行 → 通常段落に抜ける
                                const p = document.createElement('p');
                                p.innerHTML = '<br>';
                                checkboxRow.parentNode.insertBefore(p, checkboxRow.nextSibling);
                                const r = document.createRange();
                                r.setStart(p, 0);
                                r.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(r);
                            } else {
                                // テキストあり → 新しいチェックボックス行を作成
                                const newRow = document.createElement('div');
                                newRow.className = 'checkbox-row';
                                newRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin:3px 0; padding:2px 0;';
                                const newCb = document.createElement('input');
                                newCb.type = 'checkbox';
                                newCb.style.cssText = 'cursor:pointer; width:15px; height:15px; flex-shrink:0; accent-color:#2c8c5a;';
                                newCb.setAttribute('onchange', "var s=this.nextElementSibling; s.style.textDecoration=this.checked?'line-through':'none'; s.style.color=this.checked?'#aaa':'inherit';");
                                const newSpan = document.createElement('span');
                                newSpan.style.flex = '1';
                                newRow.appendChild(newCb);
                                newRow.appendChild(newSpan);
                                checkboxRow.parentNode.insertBefore(newRow, checkboxRow.nextSibling);
                                const r = document.createRange();
                                r.setStart(newSpan, 0);
                                r.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(r);
                            }
                            return;
                        }
                    }
                }
                if (isSlashMenuOpen) {
                    const items = slashMenu.querySelectorAll('.slash-menu-item');
                    if (e.key === 'ArrowDown') {
                        e.preventDefault(); slashMenuIndex = (slashMenuIndex + 1) % items.length; updateSlashMenuHighlight(items);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault(); slashMenuIndex = (slashMenuIndex - 1 + items.length) % items.length; updateSlashMenuHighlight(items);
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (slashMenuIndex >= 0) {
                            const command = items[slashMenuIndex].getAttribute('data-command');
                            executeSlashCommand(command);
                        }
                    }
                }
            });

            editContent.addEventListener('keyup', (e) => {
                if (e.isComposing) return;
                if (e.key === '/') {
                    // カーソル直前の文字が実際に '/' かどうか確認（日本語IMEで「・」を入力した場合の誤作動防止）
                    const sel = window.getSelection();
                    if (sel.anchorNode && sel.anchorNode.nodeType === 3) {
                        const offset = sel.anchorOffset;
                        if (offset === 0 || sel.anchorNode.textContent[offset - 1] !== '/') return;
                    }
                    const coords = getCaretCoordinates();
                    if (coords) {
                        slashMenu.style.left = `${coords.x}px`;
                        slashMenu.style.top = `${coords.y + window.scrollY + 20}px`;
                        slashMenu.classList.remove('hidden');
                        slashTargetNode = window.getSelection().anchorNode;
                        isSlashMenuOpen = true; slashMenuIndex = 0;
                        updateSlashMenuHighlight(slashMenu.querySelectorAll('.slash-menu-item'));
                    }
                } else if (e.key === 'Escape') {
                    closeSlashMenu();
                }
            });

            slashMenu.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const item = e.target.closest('.slash-menu-item');
                if (item) {
                    const command = item.getAttribute('data-command');
                    executeSlashCommand(command);
                }
            });

            document.addEventListener('mousedown', (e) => {
                if (isSlashMenuOpen && !slashMenu.contains(e.target)) {
                    closeSlashMenu();
                }
            });
        }

        if (floatingToolbar && editContent) {
            document.addEventListener('selectionchange', () => {
                const selection = window.getSelection();
                if (!selection.isCollapsed && editContent.contains(selection.anchorNode)) {
                    const rect = selection.getRangeAt(0).getBoundingClientRect();
                    // 高さ取得のため一時的にvisibility:hiddenで表示
                    floatingToolbar.style.visibility = 'hidden';
                    floatingToolbar.classList.remove('hidden');
                    const tbW = floatingToolbar.offsetWidth;
                    const tbH = floatingToolbar.offsetHeight;
                    floatingToolbar.style.visibility = '';
                    let left = rect.left + rect.width / 2 - tbW / 2;
                    let top = rect.top - tbH - 6;
                    if (left < 4) left = 4;
                    if (left + tbW > window.innerWidth - 4) left = window.innerWidth - tbW - 4;
                    if (top < 4) top = rect.bottom + 6;
                    floatingToolbar.style.left = `${left}px`;
                    floatingToolbar.style.top = `${top}px`;
                } else {
                    floatingToolbar.classList.add('hidden');
                }
            });
            floatingToolbar.querySelectorAll('button[data-command]').forEach(btn => {
                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault(); document.execCommand(e.currentTarget.getAttribute('data-command'), false, null);
                });
            });
            const floatingColorBtn = document.getElementById('floating-color-btn');
            const floatingColor = document.getElementById('floating-color');
            const floatingColorBar = document.getElementById('floating-color-bar');
            if (floatingColorBtn && floatingColor) {
                const COLOR_HISTORY_KEY = 'portalColorHistory';
                const PRESET_COLORS = [
                    // Row 1: Dark colors
                    '#000000','#1F2020','#263238','#1A237E','#311B92','#4A148C','#880E4F','#B71C1C','#BF360C','#E65100',
                    // Row 2: Mid-dark
                    '#424242','#37474F','#1565C0','#283593','#6A1B9A','#AD1457','#C62828','#D84315','#EF6C00','#F9A825',
                    // Row 3: Standard
                    '#0D47A1','#1976D2','#0288D1','#00838F','#2E7D32','#558B2F','#F57F17','#E65100','#BF360C','#4E342E',
                    // Row 4: Mid
                    '#1E88E5','#039BE5','#00ACC1','#00897B','#43A047','#7CB342','#FDD835','#FB8C00','#F4511E','#6D4C41',
                    // Row 5: Light-mid
                    '#42A5F5','#29B6F6','#26C6DA','#26A69A','#66BB6A','#9CCC65','#FFEE58','#FFA726','#FF7043','#8D6E63',
                    // Row 6: Light
                    '#90CAF9','#81D4FA','#80DEEA','#80CBC4','#A5D6A7','#C5E1A5','#FFF59D','#FFCC80','#FFAB91','#BCAAA4',
                    // Row 7: Very light / pastel
                    '#BBDEFB','#B3E5FC','#B2EBF2','#B2DFDB','#C8E6C9','#DCEDC8','#FFF9C4','#FFE0B2','#FBE9E7','#D7CCC8',
                    // Row 8: Near white
                    '#E3F2FD','#E1F5FE','#E0F7FA','#E0F2F1','#E8F5E9','#F1F8E9','#FFFFF0','#FFF8E1','#FBE9E7','#EFEBE9',
                ];

                function getColorHistory() {
                    try { return JSON.parse(localStorage.getItem(COLOR_HISTORY_KEY) || '[]'); } catch { return []; }
                }
                function saveColorHistory(color) {
                    let hist = getColorHistory().filter(c => c.toLowerCase() !== color.toLowerCase());
                    hist.unshift(color);
                    if (hist.length > 10) hist = hist.slice(0, 10);
                    localStorage.setItem(COLOR_HISTORY_KEY, JSON.stringify(hist));
                }

                let savedRange = null;
                function saveSelection() {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
                }
                function restoreSelection() {
                    if (!savedRange) return;
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(savedRange);
                }

                // Build popup
                const colorPopup = document.createElement('div');
                colorPopup.id = 'color-picker-popup';
                colorPopup.style.cssText = 'position:fixed;z-index:10000;background:#fff;border:1px solid #ccc;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.18);padding:10px 12px;min-width:220px;display:none;';
                colorPopup.innerHTML = `
                    <div id="cp-main-panel">
                        <div id="cp-history-section" style="margin-bottom:8px;">
                            <div style="font-size:11px;color:#888;margin-bottom:4px;">最近使った色</div>
                            <div id="cp-history-swatches" style="display:flex;flex-wrap:wrap;gap:3px;"></div>
                        </div>
                        <div style="font-size:11px;color:#888;margin-bottom:4px;">標準の色</div>
                        <div id="cp-preset-swatches" style="display:grid;grid-template-columns:repeat(10,20px);gap:2px;margin-bottom:8px;"></div>
                        <div style="border-top:1px solid #eee;padding-top:8px;">
                            <button id="cp-custom-btn" style="width:100%;padding:5px;font-size:12px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#f9f9f9;color:#333;">🎨 その他の色...</button>
                        </div>
                    </div>
                    <div id="cp-custom-panel" style="display:none;">
                        <div style="font-size:11px;color:#888;margin-bottom:6px;">カスタムカラー</div>
                        <input type="color" id="cp-custom-input" value="#e53e3e" style="width:100%;height:64px;border:1px solid #ddd;padding:2px;cursor:pointer;border-radius:4px;box-sizing:border-box;">
                        <div style="display:flex;gap:6px;margin-top:8px;">
                            <button id="cp-custom-ok" style="flex:1;padding:6px;font-size:13px;cursor:pointer;border:1px solid #0066cc;border-radius:4px;background:#0066cc;color:#fff;font-weight:bold;">決定</button>
                            <button id="cp-custom-cancel" style="flex:1;padding:6px;font-size:13px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#f9f9f9;color:#333;">キャンセル</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(colorPopup);

                function makeSwatch(color, size = 20) {
                    const s = document.createElement('div');
                    s.style.cssText = `width:${size}px;height:${size}px;background:${color};border-radius:2px;cursor:pointer;border:1px solid rgba(0,0,0,0.12);box-sizing:border-box;flex-shrink:0;`;
                    s.title = color;
                    s.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        applyColor(color);
                        closeColorPopup();
                    });
                    return s;
                }

                function applyColor(color) {
                    restoreSelection();
                    document.execCommand('foreColor', false, color);
                    if (floatingColorBar) floatingColorBar.style.background = color;
                    saveColorHistory(color);
                }

                function renderHistory() {
                    const hist = getColorHistory();
                    const section = colorPopup.querySelector('#cp-history-section');
                    const container = colorPopup.querySelector('#cp-history-swatches');
                    container.innerHTML = '';
                    if (hist.length === 0) { section.style.display = 'none'; return; }
                    section.style.display = '';
                    hist.forEach(c => container.appendChild(makeSwatch(c)));
                }

                function renderPresets() {
                    const container = colorPopup.querySelector('#cp-preset-swatches');
                    container.innerHTML = '';
                    PRESET_COLORS.forEach(c => container.appendChild(makeSwatch(c)));
                }

                function openColorPopup() {
                    saveSelection();
                    renderHistory();
                    renderPresets();
                    colorPopup.style.display = 'block';
                    // Position below the A button
                    const btnRect = floatingColorBtn.getBoundingClientRect();
                    const popW = 244;
                    const popH = 280;
                    let left = btnRect.left;
                    let top = btnRect.bottom + 4;
                    if (left + popW > window.innerWidth - 4) left = window.innerWidth - popW - 4;
                    if (top + popH > window.innerHeight - 4) top = btnRect.top - popH - 4;
                    if (left < 4) left = 4;
                    colorPopup.style.left = left + 'px';
                    colorPopup.style.top = top + 'px';
                }

                function closeColorPopup() {
                    colorPopup.style.display = 'none';
                    // サブパネルを閉じた状態に戻す
                    const mp = colorPopup.querySelector('#cp-main-panel');
                    const cp = colorPopup.querySelector('#cp-custom-panel');
                    if (mp) mp.style.display = '';
                    if (cp) cp.style.display = 'none';
                }

                floatingColorBtn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    if (colorPopup.style.display === 'none') {
                        openColorPopup();
                    } else {
                        closeColorPopup();
                    }
                });

                const cpMainPanel = colorPopup.querySelector('#cp-main-panel');
                const cpCustomPanel = colorPopup.querySelector('#cp-custom-panel');
                const cpCustomInput = colorPopup.querySelector('#cp-custom-input');

                colorPopup.querySelector('#cp-custom-btn').addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    cpMainPanel.style.display = 'none';
                    cpCustomPanel.style.display = '';
                });

                colorPopup.querySelector('#cp-custom-ok').addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    applyColor(cpCustomInput.value);
                    cpCustomPanel.style.display = 'none';
                    cpMainPanel.style.display = '';
                    closeColorPopup();
                });

                colorPopup.querySelector('#cp-custom-cancel').addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    cpCustomPanel.style.display = 'none';
                    cpMainPanel.style.display = '';
                });

                document.addEventListener('mousedown', (e) => {
                    if (colorPopup.style.display !== 'none' && !colorPopup.contains(e.target) && e.target !== floatingColorBtn) {
                        closeColorPopup();
                    }
                });
            }
        }

        // ⑤-0 ペースト時のURL→リンク自動変換
        editContent.addEventListener('paste', (e) => {
            const clip = e.clipboardData || window.clipboardData;
            const plainText = clip.getData('text/plain');
            const htmlText = clip.getData('text/html');

            // Case 1: 単体URL → <a> リンクに変換
            if (/^https?:\/\/\S+$/.test(plainText.trim())) {
                e.preventDefault();
                const url = plainText.trim().replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E');
                document.execCommand('insertHTML', false,
                    `<a href="${url}" target="_blank" style="color: #0066cc; text-decoration: underline;">${plainText.trim()}</a>`);
                return;
            }

            // Case 2: HTMLペーストに <a> が含まれる → リンクを保持してクリーンな HTML を挿入
            if (htmlText && /<a[\s>]/i.test(htmlText)) {
                e.preventDefault();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                function extractHtml(node) {
                    let out = '';
                    node.childNodes.forEach(child => {
                        if (child.nodeType === 3) {
                            out += child.textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                        } else if (child.tagName === 'A') {
                            const href = (child.getAttribute('href') || '').replace(/"/g, '%22');
                            out += `<a href="${href}" target="_blank" style="color: #0066cc; text-decoration: underline;">${child.textContent}</a>`;
                        } else if (child.tagName === 'BR') {
                            out += '<br>';
                        } else if (['P','DIV','LI'].includes(child.tagName || '')) {
                            out += extractHtml(child) + '<br>';
                        } else {
                            out += extractHtml(child);
                        }
                    });
                    return out;
                }
                document.execCommand('insertHTML', false, extractHtml(doc.body));
                return;
            }

            // Case 3: プレーンテキスト中にURLが含まれる → URLをリンク化
            if (/https?:\/\/\S+/.test(plainText)) {
                e.preventDefault();
                const parts = plainText.split(/(https?:\/\/\S+)/g);
                const html = parts.map(part =>
                    /^https?:\/\/\S+$/.test(part)
                        ? `<a href="${part.replace(/"/g,'%22').replace(/</g,'%3C').replace(/>/g,'%3E')}" target="_blank" style="color: #0066cc; text-decoration: underline;">${part}</a>`
                        : part.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
                ).join('');
                document.execCommand('insertHTML', false, html);
                return;
            }
            // Default: ブラウザのデフォルト処理に任せる
        });

        // ⑤ エディタ内画像（インライン画像）のクラウドアップロード処理
        const hiddenImgUpload = document.getElementById('hidden-img-upload');
        if (hiddenImgUpload && editContent) {
            hiddenImgUpload.addEventListener('change', function(e) {
                if(e.target.files[0]) {
                    editContent.focus();
                    const tempId = 'img-' + Date.now();
                    document.execCommand('insertHTML', false, `<img id="${tempId}" src="https://placehold.co/400x300?text=Uploading..." style="max-width:100%; opacity:0.5;">`);

                    compressImageToBlob(e.target.files[0], 800, 0.70, async (blob) => {
                        try {
                            const fileName = 'inline/' + Date.now() + '.jpg';
                            const storageRef = storage.ref().child(fileName);
                            await storageRef.put(blob);
                            const downloadURL = await storageRef.getDownloadURL();
                            
                            const tempImg = document.getElementById(tempId);
                            if (tempImg) {
                                tempImg.src = downloadURL;
                                tempImg.style.opacity = '1';
                                tempImg.removeAttribute('id');
                            }
                        } catch (error) {
                            alert("画像の挿入に失敗しました");
                        }
                    });
                }
            });
        }

        // ⑥ 下書き保存機能（コラム編集時のみ）
        if (!isBoardMode) {
            const btnSaveDraft = document.getElementById('btn-save-draft');
            const btnOpenDrafts = document.getElementById('btn-open-drafts');
            const draftModal = document.getElementById('draft-modal');
            const draftListContainer = document.getElementById('draft-list-container');
            const closeDraftModal = document.getElementById('close-draft-modal');

            if (btnSaveDraft) {
                btnSaveDraft.addEventListener('click', async () => {
                    const htmlInputDraft = document.getElementById('html-input');
                    const draftData = {
                        title: editTitle.value.trim() || '（タイトルなし）',
                        author: editAuthor ? editAuthor.value.trim() : '教職員',
                        authorName: editAuthorName ? editAuthorName.value.trim() : '',
                        date: editDate ? editDate.value : getTodayStr(),
                        content: isHtmlImportMode && htmlInputDraft ? htmlInputDraft.value.trim() : editContent.innerHTML,
                        contentType: isHtmlImportMode ? 'html' : 'editor',
                        img: currentEyecatchData,
                        savedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    try {
                        if (editingColId) {
                            await db.collection('drafts').doc(editingColId).update(draftData);
                        } else {
                            const ref = await db.collection('drafts').add(draftData);
                            editingColId = ref.id;
                        }
                        alert('下書きを保存しました');
                    } catch (err) {
                        alert('下書きの保存に失敗しました');
                    }
                });
            }

            if (btnOpenDrafts && draftModal && draftListContainer) {
                btnOpenDrafts.addEventListener('click', (e) => {
                    e.preventDefault();
                    draftModal.classList.remove('hidden');

                    db.collection('drafts').orderBy('savedAt', 'desc').get().then(snapshot => {
                        draftListContainer.innerHTML = '';
                        if (snapshot.empty) {
                            draftListContainer.innerHTML = '<li style="padding:8px; color:#888;">下書きがありません</li>';
                            return;
                        }
                        snapshot.forEach(doc => {
                            const d = doc.data();
                            const savedAt = d.savedAt ? d.savedAt.toDate().toLocaleString('ja-JP') : '—';
                            const li = document.createElement('li');
                            li.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px 4px; border-bottom:1px solid #E6E4DF; cursor:pointer;';
                            li.innerHTML = `
                                <span class="draft-item-label" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${d.title}<br><small style="color:#888;">${savedAt}</small></span>
                                <button class="draft-delete-btn btn-cancel" data-id="${doc.id}" style="margin-left:12px; flex-shrink:0;">削除</button>
                            `;
                            li.querySelector('.draft-item-label').addEventListener('click', () => {
                                editTitle.value = d.title === '（タイトルなし）' ? '' : d.title;
                                if (editAuthor) editAuthor.value = d.author || '';
                                if (syncTagsFromValue) syncTagsFromValue();
                                if (editAuthorName) editAuthorName.value = d.authorName || '';
                                if (editDate) editDate.value = d.date || '';
                                if (d.contentType === 'html') {
                                    const htmlInputEl = document.getElementById('html-input');
                                    const htmlImportAreaEl = document.getElementById('html-import-area');
                                    const btnModeEditorEl = document.getElementById('btn-mode-editor');
                                    const btnModeHtmlEl = document.getElementById('btn-mode-html');
                                    isHtmlImportMode = true;
                                    editContent.style.display = 'none';
                                    if (htmlImportAreaEl) htmlImportAreaEl.style.display = 'block';
                                    if (htmlInputEl) htmlInputEl.value = d.content || '';
                                    if (btnModeEditorEl) { btnModeEditorEl.style.background = '#fff'; btnModeEditorEl.style.color = '#555'; btnModeEditorEl.style.borderColor = '#bbb'; }
                                    if (btnModeHtmlEl) { btnModeHtmlEl.style.background = '#0066cc'; btnModeHtmlEl.style.color = '#fff'; btnModeHtmlEl.style.borderColor = '#0066cc'; }
                                } else {
                                    isHtmlImportMode = false;
                                    editContent.style.display = '';
                                    const htmlImportAreaEl = document.getElementById('html-import-area');
                                    if (htmlImportAreaEl) htmlImportAreaEl.style.display = 'none';
                                    editContent.innerHTML = d.content || '';
                                }
                                currentEyecatchData = d.img || '';
                                const preview = document.getElementById('cover-image-preview');
                                const btnAdd = document.getElementById('btn-add-cover');
                                const btnRem = document.getElementById('btn-remove-cover');
                                if (preview) {
                                    if (currentEyecatchData) {
                                        preview.src = currentEyecatchData;
                                        preview.style.display = 'block';
                                        if (btnAdd) btnAdd.style.display = 'none';
                                        if (btnRem) btnRem.style.display = 'block';
                                    } else {
                                        preview.src = '';
                                        preview.style.display = 'none';
                                        if (btnAdd) btnAdd.style.display = 'block';
                                        if (btnRem) btnRem.style.display = 'none';
                                    }
                                }
                                editingColId = doc.id;
                                draftModal.classList.add('hidden');
                            });
                            li.querySelector('.draft-delete-btn').addEventListener('click', (e) => {
                                e.stopPropagation();
                                if (confirm('この下書きを削除しますか？')) {
                                    db.collection('drafts').doc(doc.id).delete().then(() => {
                                        li.remove();
                                        if (draftListContainer.children.length === 0) {
                                            draftListContainer.innerHTML = '<li style="padding:8px; color:#888;">下書きがありません</li>';
                                        }
                                    });
                                }
                            });
                            draftListContainer.appendChild(li);
                        });
                    });
                });
            }

            if (closeDraftModal && draftModal) {
                closeDraftModal.addEventListener('click', () => draftModal.classList.add('hidden'));
            }
        }

        // ⑦ クラウドデータベース（Firestore）への保存処理
        if (btnPublish) {
            btnPublish.addEventListener('click', () => {
                const title = editTitle.value.trim();
                if (!title) { alert('タイトルを入力してください。'); return; }

                btnPublish.disabled = true;
                btnPublish.textContent = "保存中...";

                const collectionName = isBoardMode ? 'boards' : ((isBoardItemSource || isBoardItemEdit || isBoardsListSource || isBoardsListEdit) ? 'board_columns' : 'columns');
                const htmlInputSave = document.getElementById('html-input');
                let saveData = {
                    title: title,
                    content: (!isBoardMode && isHtmlImportMode && htmlInputSave) ? htmlInputSave.value.trim() : editContent.innerHTML,
                    contentType: (!isBoardMode && isHtmlImportMode) ? 'html' : 'editor',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (isBoardMode) {
                    saveData.dept = editAuthor ? editAuthor.value.trim() : '教職員';
                    saveData.period = editDate ? editDate.value : '';
                    saveData.status = 'active';
                } else {
                    saveData.author = editAuthor ? editAuthor.value.trim() : '教職員';
                    saveData.authorName = editAuthorName ? editAuthorName.value.trim() : '';
                    saveData.date = getTodayStr();
                    saveData.img = currentEyecatchData;
                    if (isDashboardSource || isDashboardEdit) saveData.isDashboardPage = true;
                    if (isBoardItemSource || isBoardItemEdit) saveData.isBoardItemPage = true;
                }

                const afterPublish = () => {
                    if (!isBoardMode && editingColId) {
                        db.collection('drafts').doc(editingColId).delete().catch(() => {});
                    }
                };

                const clearEditorCaches = () => {
                    ['sc_boards','sc_columns','sc_dashboards','sc_dash_tagorder','sc_board_items','sc_board_tag_order'].forEach(k => localStorage.removeItem(k));
                };

                if (editingColId) {
                    db.collection(collectionName).doc(editingColId).update(saveData).then(async () => {
                        afterPublish();
                        alert(isBoardMode ? '掲示を更新しました！' : 'ページを更新しました！');
                        clearEditorCaches();
                        await updateCacheVersion();
                        if (isBoardMode) window.location.href = './boards.html';
                        else if (isDashboardEdit) window.location.href = './index.html';
                        else if (isBoardItemEdit || isBoardsListEdit) window.location.href = './boards.html';
                        else window.location.href = './columns.html';
                    }).catch(err => { alert("エラーが発生しました"); btnPublish.disabled = false; });
                } else {
                    db.collection(collectionName).add(saveData).then(async (ref) => {
                        editingColId = ref.id;
                        afterPublish();
                        if (!isBoardMode && isDashboardSource) {
                            db.collection('dashboards').add({
                                type: 'page',
                                title: dashTitle || title,
                                tag: dashTag,
                                columnId: ref.id,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                order: 9999
                            }).then(async () => {
                                alert('フリーページカードを作成しました！');
                                clearEditorCaches();
                                await updateCacheVersion();
                                window.location.href = './index.html';
                            }).catch(err => { alert("エラーが発生しました"); btnPublish.disabled = false; });
                        } else if (!isBoardMode && isBoardItemSource) {
                            db.collection('board_items').add({
                                type: 'page',
                                title: boardItemTitle || title,
                                tag: boardItemTag,
                                columnId: ref.id,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                order: 9999
                            }).then(async () => {
                                alert('フリーページカードを作成しました！');
                                clearEditorCaches();
                                await updateCacheVersion();
                                window.location.href = './boards.html';
                            }).catch(err => { alert("エラーが発生しました"); btnPublish.disabled = false; });
                        } else if (!isBoardMode && isBoardsListSource) {
                            db.collection('boards').add({
                                type: 'page',
                                title: boardsListTitle || title,
                                dept: boardsListDept,
                                period: boardsListPeriod,
                                columnId: ref.id,
                                status: 'active',
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            }).then(async () => {
                                alert('フリーページを作成しました！');
                                clearEditorCaches();
                                await updateCacheVersion();
                                window.location.href = './boards.html';
                            }).catch(err => { alert("エラーが発生しました"); btnPublish.disabled = false; });
                        } else {
                            alert(isBoardMode ? '掲示を公開しました！' : 'コラムを公開しました！');
                            clearEditorCaches();
                            await updateCacheVersion();
                            window.location.href = isBoardMode ? './boards.html' : './columns.html';
                        }
                    }).catch(err => { alert("エラーが発生しました"); btnPublish.disabled = false; });
                }
            });
        }

        const editorArea = document.getElementById('edit-content');
        if (editorArea) {
            editorArea.addEventListener('click', (e) => {
                if (e.target.tagName === 'A') { window.open(e.target.href, '_blank'); }
            });
        }
    }
});