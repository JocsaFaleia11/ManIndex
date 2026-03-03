/**
 * Configuração do Firebase - App do Usuário com Auth
 */

const firebaseConfig = {
    apiKey: "AIzaSyA6YJJH2uQ9zej1RqJS3rh4dr4vU7_mEZo",
    authDomain: "manindex-adc12.firebaseapp.com",
    databaseURL: "https://manindex-adc12-default-rtdb.firebaseio.com/",
    projectId: "manindex-adc12",
    storageBucket: "manindex-adc12.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:955907721417:web:bcdd8c0f48a52239702518"
};

// Inicializar Firebase
let app, auth, db;

try {
    if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase App inicializado');
    } else {
        app = firebase.app();
    }

    // Inicializar serviços APÓS garantir que o app existe
    auth = firebase.auth();
    db = firebase.firestore();

    console.log('✅ Firebase Auth e Firestore inicializados');

} catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
}

// Configurações do Firestore
if (db) {
    db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
    });

    // Habilitar persistência offline
    db.enablePersistence({ synchronizeTabs: true })
        .then(() => console.log('✅ Persistência offline ativada'))
        .catch((err) => console.warn('⚠️ Persistência:', err.code));
}

// Garantir que as variáveis estão disponíveis globalmente
window.firebaseApp = app;
window.auth = auth;
window.db = db;

console.log('Firebase config concluído. auth:', !!auth, 'db:', !!db);