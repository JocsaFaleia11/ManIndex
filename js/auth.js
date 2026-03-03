/**
 * Módulo de Autenticação para Usuários Comuns
 */

const UserAuth = {
    currentUser: null,
    userData: null,

    init() {
        return new Promise((resolve) => {
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    await this.loadUserData(user.uid);
                    resolve(true);
                } else {
                    this.currentUser = null;
                    this.userData = null;
                    resolve(false);
                }
            });
        });
    },

    async loadUserData(uid) {
        try {
            const doc = await db.collection('userProfiles').doc(uid).get();
            if (doc.exists) {
                this.userData = doc.data();
            } else {
                // Criar perfil se não existir
                this.userData = {
                    nome: this.currentUser.displayName || 'Usuário',
                    email: this.currentUser.email,
                    favoritos: [],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('userProfiles').doc(uid).set(this.userData);
            }
        } catch (error) {
            console.error('Erro ao carregar dados do usuário:', error);
        }
    },

    async login(email, password) {
        try {
            const result = await auth.signInWithEmailAndPassword(email, password);
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: this.translateError(error.code) };
        }
    },

    async register(email, password, nome) {
        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            await result.user.updateProfile({ displayName: nome });
            
            // Criar perfil
            await db.collection('userProfiles').doc(result.user.uid).set({
                nome: nome,
                email: email,
                favoritos: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: this.translateError(error.code) };
        }
    },

    async loginWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            
            if (result.additionalUserInfo.isNewUser) {
                await db.collection('userProfiles').doc(result.user.uid).set({
                    nome: result.user.displayName,
                    email: result.user.email,
                    favoritos: [],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: this.translateError(error.code) };
        }
    },

    async logout() {
        try {
            await auth.signOut();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async updateProfile(data) {
        try {
            await db.collection('userProfiles').doc(this.currentUser.uid).update({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await this.loadUserData(this.currentUser.uid);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    translateError(code) {
        const errors = {
            'auth/invalid-email': 'Email inválido',
            'auth/user-disabled': 'Conta desativada',
            'auth/user-not-found': 'Usuário não encontrado',
            'auth/wrong-password': 'Senha incorreta',
            'auth/email-already-in-use': 'Email já cadastrado',
            'auth/weak-password': 'Senha muito fraca (mín. 6 caracteres)',
            'auth/popup-closed-by-user': 'Login cancelado',
            'auth/popup-blocked': 'Popup bloqueado pelo navegador',
            'auth/network-request-failed': 'Erro de conexão'
        };
        return errors[code] || `Erro: ${code}`;
    }
};