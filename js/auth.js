// js/auth.js

const authService = {
    async register(username, password) {
        console.log('[AuthService] register attempt for:', username);
        try {
            const data = await request('/auth/register', 'POST', { username, password }, false);
            console.log('[AuthService] register success:', data);
            return data;
        } catch (error) {
            console.error("[AuthService] Registrierungsfehler:", error.data?.error || error.message);
            throw error;
        }
    },

    async login(username, password, rememberMe = false) {
        console.log('[AuthService] login attempt for:', username);
        try {
            const data = await request('/auth/login', 'POST', { username, password, rememberMe }, false);
            if (data && data.user) {
                console.log('[AuthService] login success, user:', data.user.username);
                setCurrentUser(data.user);
                return data.user;
            } else {
                console.error('[AuthService] Login-Antwort enthält keine Benutzerdaten.');
                throw new Error("Login-Antwort enthält keine Benutzerdaten.");
            }
        } catch (error) {
            console.error("[AuthService] Login-Fehler:", error.data?.error || error.message);
            throw error;
        }
    },

    async logout() {
        console.log('[AuthService] logout attempt');
        try {
            await request('/auth/logout', 'POST', null, true);
            console.log('[AuthService] logout API call successful');
            clearStoreOnLogout();
            if (window.chatService && chatService.stopMessagePolling) {
                chatService.stopMessagePolling();
            }
        } catch (error) {
            console.error("[AuthService] Logout-Fehler:", error.data?.error || error.message);
            clearStoreOnLogout(); // Auch bei Fehler User lokal entfernen
            if (window.chatService && chatService.stopMessagePolling) {
                chatService.stopMessagePolling();
            }
            throw error;
        }
    },

    async checkLoginStatus() {
        console.log('[AuthService] checkLoginStatus attempt');
        try {
            const data = await request('/auth/me', 'GET', null, true);
            if (data && data.userId) {
                console.log('[AuthService] checkLoginStatus success, user:', data.username);
                setCurrentUser(data);
                return data;
            }
            console.log('[AuthService] checkLoginStatus: No user session found.');
            clearStoreOnLogout();
            return null;
        } catch (error) {
            console.warn("[AuthService] checkLoginStatus: User nicht eingeloggt oder Fehler.", error.message);
            clearStoreOnLogout();
            return null;
        }
    }
};