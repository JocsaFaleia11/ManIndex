// Verificar se já existe configuração para evitar duplicação
if (typeof window.firebaseConfigData === 'undefined') {
    window.firebaseConfigData = {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
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
