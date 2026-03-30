// ==========================================
// 1. Firebaseの初期化と接続設定 (グローバルに宣言)
// ==========================================
let db, storage, auth;

document.addEventListener('DOMContentLoaded', () => {
    const firebaseConfig = {
      apiKey: "AIzaSyC0Av1pu-j2_j3FWwGAEg_Db7dZoLMEeIA",
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
    auth = firebase.auth();

    // 認証ガード: ログインページ以外では未認証ユーザーをリダイレクト
    const isLoginPage = window.location.pathname.endsWith('login.html');
    if (!isLoginPage) {
        document.body.style.visibility = 'hidden';
        auth.onAuthStateChanged(user => {
            if (!user) {
                window.location.replace('./login.html');
            } else {
                document.body.style.visibility = '';
            }
        });
    }
});