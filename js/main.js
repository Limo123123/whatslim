// js/main.js
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Main] DOMContentLoaded - Initializing App');
    ui.initDOMElements();

    function showAuthScreen(screenToShow) {
        console.log('[Main] showAuthScreen:', screenToShow);
        ui.hideElement('loginSection');
        ui.hideElement('registerSection');
        ui.hideElement('chatAppSection');
        if (screenToShow === 'login') ui.showElement('loginSection');
        else if (screenToShow === 'register') ui.showElement('registerSection');
        else if (screenToShow === 'chat') ui.showElement('chatAppSection');
    }

    async function initializeApp() {
        console.log('[Main] initializeApp called');
        try {
            const userData = await authService.checkLoginStatus();
            if (userData && userData.userId) {
                // ui.updateUserInfoHeader(); // Wird schon in setCurrentUser gemacht
                showAuthScreen('chat');
                await chatService.fetchMyUserShareCode();
                await chatService.fetchChats(false);
                if (store.chats.length > 0) {
                    ui.selectChat(store.chats[0]._id);
                } else {
                    ui.displayNoActiveChat();
                }
                chatService.startAllPolling();
            } else {
                showAuthScreen('login');
                chatService.stopAllPolling();
            }
        } catch (error) {
            console.error("[Main] Fehler bei Initialisierung:", error);
            showAuthScreen('login');
            chatService.stopAllPolling();
        }
    }

    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('[Main] Login form submitted');
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('loginRememberMe').checked;
        const errorP = document.getElementById('loginError');
        errorP.textContent = '';
        const loginButton = e.target.querySelector('button[type="submit"]');
        if (loginButton) loginButton.disabled = true;

        try {
            const user = await authService.login(username, password, rememberMe);
            if (user) {
                await initializeApp();
                document.getElementById('loginForm').reset();
            }
        } catch (error) {
            errorP.textContent = error.data?.error || "Login fehlgeschlagen.";
        } finally {
            if (loginButton) loginButton.disabled = false;
        }
    });

    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('[Main] Register form submitted');
        const username = document.getElementById('registerUsername').value;
        const password = document.getElementById('registerPassword').value;
        const errorP = document.getElementById('registerError');
        errorP.textContent = '';
        const registerButton = e.target.querySelector('button[type="submit"]');
        if (registerButton) registerButton.disabled = true;
        try {
            const response = await authService.register(username, password);
            alert(response.message + " Bitte logge dich nun ein.");
            showAuthScreen('login');
            document.getElementById('registerForm').reset();
        } catch (error) {
            errorP.textContent = error.data?.error || "Registrierung fehlgeschlagen.";
        } finally {
            if (registerButton) registerButton.disabled = false;
        }
    });

    document.getElementById('showRegisterButton')?.addEventListener('click', () => {
        console.log('[Main] showRegisterButton clicked');
        document.getElementById('loginError').textContent = '';
        document.getElementById('registerError').textContent = '';
        showAuthScreen('register');
    });
    document.getElementById('showLoginButton')?.addEventListener('click', () => {
        console.log('[Main] showLoginButton clicked');
        document.getElementById('loginError').textContent = '';
        document.getElementById('registerError').textContent = '';
        showAuthScreen('login');
    });

    document.getElementById('createPersonalChatBtn')?.addEventListener('click', () => {
        console.log('[Main] createPersonalChatBtn clicked');
        ui.showModal('startPersonalChatModal');
    });
    document.getElementById('createGroupChatBtn')?.addEventListener('click', () => {
        console.log('[Main] createGroupChatBtn clicked');
        ui.showModal('createGroupModal');
    });
    document.getElementById('joinGroupBtn')?.addEventListener('click', () => {
        console.log('[Main] joinGroupBtn clicked');
        ui.showModal('joinGroupModal');
    });
    document.getElementById('regenerateUserShareCodeBtn')?.addEventListener('click', () => {
        console.log('[Main] regenerateUserShareCodeBtn clicked');
        chatService.regenerateMyUserShareCode();
    });
    document.getElementById('messageSearchBtn')?.addEventListener('click', () => {
        console.log('[Main] messageSearchBtn clicked');
        const term = document.getElementById('messageSearchInput').value;
        if (term.trim().length > 1) {
            chatService.searchMessages(term.trim());
        } else {
            alert("Suchbegriff muss mindestens 2 Zeichen lang sein.");
        }
    });
    document.getElementById('closeSearchResultsBtn')?.addEventListener('click', () => {
        console.log('[Main] closeSearchResultsBtn clicked');
        ui.hideElement('searchResultsPanel');
    });

    document.getElementById('confirmStartPersonalChatBtn')?.addEventListener('click', async () => {
        console.log('[Main] confirmStartPersonalChatBtn clicked');
        const codeInput = document.getElementById('targetUserShareCodeInput');
        const code = codeInput.value;
        const errorP = document.getElementById('personalChatError');
        errorP.textContent = '';
        if (!code.trim()) {
            errorP.textContent = "Share-Code darf nicht leer sein.";
            return;
        }
        try {
            await chatService.startPersonalChat(code);
            codeInput.value = '';
            // ui.hideModal('startPersonalChatModal'); // Wird in chatService gemacht
        } catch (err) { /* Fehler wird in chatService/ui behandelt */ }
    });
    document.getElementById('confirmCreateGroupBtn')?.addEventListener('click', async () => {
        console.log('[Main] confirmCreateGroupBtn clicked');
        const nameInput = document.getElementById('newGroupNameInput');
        const codesInput = document.getElementById('initialGroupParticipantsInput');
        const name = nameInput.value;
        const codes = codesInput.value;
        const errorP = document.getElementById('createGroupError');
        errorP.textContent = '';
        if (!name.trim()) {
            errorP.textContent = "Gruppenname darf nicht leer sein.";
            return;
        }
        try {
            await chatService.createGroupChat(name, codes);
            nameInput.value = '';
            codesInput.value = '';
        } catch (err) { /* Fehler wird in chatService/ui behandelt */ }
    });
    document.getElementById('confirmJoinGroupBtn')?.addEventListener('click', async () => {
        console.log('[Main] confirmJoinGroupBtn clicked');
        const codeInput = document.getElementById('groupShareCodeInput');
        const code = codeInput.value;
        const errorP = document.getElementById('joinGroupError');
        errorP.textContent = '';
        if (!code.trim()) {
            errorP.textContent = "Share-Code darf nicht leer sein.";
            return;
        }
        try {
            await chatService.joinGroup(code);
            codeInput.value = '';
        } catch (err) { /* Fehler wird in chatService/ui behandelt */ }
    });

    document.getElementById('chatList')?.addEventListener('click', (e) => {
        const listItem = e.target.closest('li[data-chat-id]');
        if (listItem) {
            const chatId = listItem.dataset.chatId;
            console.log(`[Main] ChatList item clicked, ChatID: ${chatId}`);
            if (e.target.classList.contains('mute-chat-btn')) {
                const currentlyMuted = e.target.dataset.muted === 'true';
                console.log(`[Main] Mute button clicked for ${chatId}, newMuteStatus: ${!currentlyMuted}`);
                chatService.toggleMuteChat(chatId, !currentlyMuted);
            } else {
                ui.selectChat(chatId);
            }
        }
    });

    document.getElementById('sendMessageBtn')?.addEventListener('click', async () => {
        const contentElement = document.getElementById('messageText');
        const content = contentElement.value;
        console.log(`[Main] sendMessageBtn clicked, content: "${content.substring(0, 20)}..."`);
        if (content.trim() && store.activeChatId) {
            const sendButton = document.getElementById('sendMessageBtn');
            try {
                if (sendButton) sendButton.disabled = true;
                await chatService.sendMessage(store.activeChatId, content.trim());
                ui.clearMessageInput();
            } catch (error) {
                console.warn("[Main] Fehler beim Senden der Nachricht, Button wird wieder aktiviert.");
            } finally {
                if (sendButton) sendButton.disabled = false;
                contentElement.focus();
            }
        }
    });
    document.getElementById('messageText')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('sendMessageBtn').click();
        }
    });
    document.getElementById('messageList')?.addEventListener('scroll', (e) => {
        if (e.target.scrollTop === 0 && store.activeChatId && !store.ui.isLoadingMessages) {
            const currentMessages = store.messages[store.activeChatId] || [];
            if (currentMessages.length >= 25) {
                console.log("[Main] Am Anfang der Nachrichtenliste gescrollt, lade mehr...");
                chatService.fetchMessagesForChat(store.activeChatId, true);
            }
        }
    });

    document.getElementById('activeChatHeader')?.addEventListener('click', (e) => {
        if (e.target.id === 'openGroupAdminModalBtn' && store.activeChatId) {
            console.log('[Main] openGroupAdminModalBtn clicked for chat:', store.activeChatId);
            chatService.getGroupDetailsForAdmin(store.activeChatId);
        }
    });

    document.getElementById('groupAdminModal')?.addEventListener('click', async (e) => {
        const groupId = groupAdmin.currentEditingGroupId;
        if (!groupId) return;
        const targetId = e.target.id;
        if (!targetId) return; // Nicht auf das Modal selbst reagieren, nur auf Buttons darin
        console.log(`[Main] Click in groupAdminModal, target: ${targetId}, group: ${groupId}`);

        const errorP = document.getElementById('groupAdminError');
        if (errorP) errorP.textContent = '';


        try {
            if (targetId === 'adminRegenerateGroupShareCodeBtn') {
                await chatService.regenerateGroupShareCode(groupId);
            } else if (targetId === 'adminConfirmEditGroupNameBtn') {
                const newName = document.getElementById('adminEditGroupNameInput').value;
                if (newName.trim()) await chatService.updateGroupName(groupId, newName.trim());
                else if (errorP) errorP.textContent = "Gruppenname darf nicht leer sein.";
            } else if (targetId === 'adminConfirmAddParticipantBtn') {
                const userCode = document.getElementById('adminAddParticipantInput').value;
                if (userCode.trim()) {
                    await chatService.addParticipantToGroup(groupId, userCode.trim());
                    document.getElementById('adminAddParticipantInput').value = '';
                } else if (errorP) errorP.textContent = "User Share-Code darf nicht leer sein.";
            } else if (targetId === 'adminLeaveGroupBtn') {
                if (confirm("Möchtest du diese Gruppe wirklich verlassen?")) {
                    await chatService.leaveGroup(groupId);
                    // Modal wird in chatService.leaveGroup ggf. geschlossen
                }
            } else if (targetId === 'adminDeleteGroupBtn') {
                if (confirm("WARNUNG: Gruppe und alle Nachrichten unwiderruflich LÖSCHEN?")) {
                    await chatService.deleteGroup(groupId);
                    // Modal wird in chatService.deleteGroup geschlossen
                }
            }
        } catch (err) {
            if (errorP) errorP.textContent = err.data?.error || err.message || "Ein Fehler ist aufgetreten.";
        }
    });

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) {
                console.log(`[Main] Close button clicked for modal: ${modal.id}`);
                ui.hideModal(modal.id);
                if (modal.id === 'groupAdminModal' && window.groupAdmin && groupAdmin.cleanupAdminModal) {
                    groupAdmin.cleanupAdminModal();
                }
            }
        });
    });
    document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay' && store.ui.currentOpenModalId) {
            console.log(`[Main] Modal overlay clicked, closing modal: ${store.ui.currentOpenModalId}`);
            ui.hideModal(store.ui.currentOpenModalId);
            if (store.ui.currentOpenModalId === 'groupAdminModal' && window.groupAdmin && groupAdmin.cleanupAdminModal) {
                groupAdmin.cleanupAdminModal();
            }
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            console.log("[Main] Tab wurde unsichtbar, stoppe Polling.");
            chatService.stopAllPolling();
        } else {
            console.log("[Main] Tab wurde sichtbar, starte Polling (wenn eingeloggt).");
            if (store.currentUser) {
                chatService.startAllPolling();
            }
        }
    });

    initializeApp();
});