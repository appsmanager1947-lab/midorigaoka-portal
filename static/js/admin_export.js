document.addEventListener('DOMContentLoaded', () => {
    const btnExport = document.getElementById('btn-export');
    const btnDelete = document.getElementById('btn-delete');
    let fetchedDocs = []; // 取得したデータを一時保存する箱

    // JSONデータをExcelで文字化けしないCSVに変換する関数
    function convertToCSV(objArray) {
        if(objArray.length === 0) return '';
        const headers = Object.keys(objArray[0]);
        let str = headers.join(',') + '\r\n';

        for (let i = 0; i < objArray.length; i++) {
            let line = '';
            for (let index in headers) {
                if (line != '') line += ',';
                let cell = objArray[i][headers[index]];
                if (cell === null || cell === undefined) cell = '';
                // セル内の改行やカンマに対応するため、ダブルクォーテーションで囲む
                cell = cell.toString().replace(/"/g, '""');
                line += `"${cell}"`;
            }
            str += line + '\r\n';
        }
        return str;
    }

    // 1. ダウンロード（エクスポート）処理
    btnExport.addEventListener('click', async () => {
        const collection = document.getElementById('export-collection').value;
        const start = document.getElementById('export-start').value;
        const end = document.getElementById('export-end').value;

        if (!start || !end) {
            alert("開始日と終了日を指定してください。");
            return;
        }
        if (start > end) {
            alert("終了日は開始日以降の日付にしてください。");
            return;
        }

        btnExport.textContent = "データを取得中...";
        btnExport.disabled = true;

        try {
            // 指定された期間のデータをFirestoreから取得 ('date'フィールドで絞り込み)
            const snapshot = await db.collection(collection)
                .where('date', '>=', start)
                .where('date', '<=', end)
                .get();

            fetchedDocs = [];
            let csvDataArray = [];

            snapshot.forEach(doc => {
                fetchedDocs.push(doc); // 削除用にドキュメントそのものを保存
                
                // CSV出力用に見やすいデータを作成
                const data = doc.data();
                delete data.createdAt; // サーバーの時間はExcelで見づらいので除外
                csvDataArray.push({ id: doc.id, ...data });
            });

            if (csvDataArray.length === 0) {
                alert("指定された期間のデータは見つかりませんでした。");
                btnExport.textContent = "📥 Excel (CSV) をダウンロード";
                btnExport.disabled = false;
                btnDelete.disabled = true;
                return;
            }

            // Excel文字化け防止のためのBOM（\uFEFF）を付けてCSVファイルを作成
            const csvStr = convertToCSV(csvDataArray);
            const blob = new Blob(["\uFEFF" + csvStr], { type: 'text/csv;charset=utf-8;' });
            
            // ダウンロードリンクを生成して自動クリック
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${collection}_${start}_to_${end}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            alert(`${fetchedDocs.length}件のデータをダウンロードしました！\nファイルの中身を確認してから削除を実行してください。`);
            
            btnExport.textContent = "📥 ダウンロード完了";
            btnDelete.disabled = false; // 削除ボタンを解禁！

        } catch (error) {
            console.error("エラー:", error);
            alert("データの取得に失敗しました。");
        } finally {
            btnExport.disabled = false;
        }
    });

    // 2. クラウドからの完全削除処理
    btnDelete.addEventListener('click', async () => {
        if (fetchedDocs.length === 0) return;

        const confirmMsg = `本当に ${fetchedDocs.length}件 のデータをクラウドから完全に削除しますか？\n（※この操作は取り消せません）`;
        
        if (confirm(confirmMsg)) {
            btnDelete.textContent = "削除中...";
            btnDelete.disabled = true;

            try {
                // Firebaseは「バッチ処理」で一括削除すると安全で速いです
                const batch = db.batch();
                fetchedDocs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();

                alert("データの削除が完了しました！クラウドの容量が整理されました。");
                
                // 画面をリセット
                fetchedDocs = [];
                btnDelete.textContent = "🗑️ クラウドから削除する";
                btnExport.textContent = "📥 Excel (CSV) をダウンロード";
                document.getElementById('export-start').value = '';
                document.getElementById('export-end').value = '';
                btnDelete.disabled = true;

            } catch (error) {
                console.error("削除エラー:", error);
                alert("削除に失敗しました。");
                btnDelete.textContent = "🗑️ 削除を再試行";
                btnDelete.disabled = false;
            }
        }
    });
});