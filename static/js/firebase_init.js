// ==========================================
// 1. Firebaseの初期化と接続設定 (グローバルに宣言)
// ==========================================
let db, storage;

document.addEventListener('DOMContentLoaded', () => {
    const firebaseConfig = {
      apiKey: "AIzaSyDp-zjaKXdKdzy8iFA_GVOZw9LaLto491c",
      authDomain: "portalsite-midorigaoka-77f17.firebaseapp.com",
      projectId: "portalsite-midorigaoka-77f17",
      storageBucket: "portalsite-midorigaoka-77f17.firebasestorage.app",
      messagingSenderId: "471591129551",
      appId: "1:471591129551:web:dcacc879aaeb026abbc2ba"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    // どのファイルからでもアクセスできるように、グローバル変数にセット
    db = firebase.firestore();
    storage = firebase.storage();
});