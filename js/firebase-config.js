// Verificar se já existe configuração para evitar duplicação
if (typeof window.firebaseConfigData === 'undefined') {
    window.firebaseConfigData = {
    apiKey: "AIzaSyA6YJJH2uQ9zej1RqJS3rh4dr4vU7_mEZo",
    authDomain: "manindex-adc12.firebaseapp.com",
    databaseURL: "https://manindex-adc12-default-rtdb.firebaseio.com/",
    projectId: "manindex-adc12",
    storageBucket: "manindex-adc12.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:955907721417:web:bcdd8c0f48a52239702518"
};
    // Inicializar Firebase apenas se não estiver inicializado
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfigData);
    }

    window.database = firebase.database();
    window.auth = firebase.auth();

    // Configuração de persistência
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => console.log('✅ Persistência configurada'))
        .catch(err => console.error('❌ Erro persistência:', err));

    console.log('🔧 Firebase inicializado com sucesso');
} else {
    console.log('ℹ️ Firebase já estava inicializado');
}