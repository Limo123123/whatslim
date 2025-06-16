// js/chatService.js
let messagePollingInterval = null;
let chatListPollingInterval = null;
const MESSAGE_POLLING_INTERVAL_MS = 7000;
const CHAT_LIST_POLLING_INTERVAL_MS = 15000;

const chatService = {
    async fetchMyUserShareCode() {
        console.log('[ChatService] fetchMyUserShareCode');
        try {
            const data = await request('/chat/me/sharecode');
            if (store.currentUser) store.currentUser.userShareCode = data.userShareCode;

            console.log('[ChatService] Prüfe ui.updateMyShareCodeUI (Typ):', typeof ui?.updateMyShareCodeUI);
            console.log('[ChatService] Daten vom Backend für Share-Code:', data);

            if (ui && typeof ui.updateMyShareCodeUI === 'function') {
                console.log('[ChatService] Bedingung erfüllt - Rufe ui.updateMyShareCodeUI auf mit Code:', data.userShareCode);
                ui.updateMyShareCodeUI(data.userShareCode);
            } else {
                console.error('[ChatService] ui-Objekt oder ui.updateMyShareCodeUI-Funktion ist NICHT definiert!');
            }
            return data.userShareCode;
        } catch (error) {
            console.error("[ChatService] Fehler beim Holen des User Share Codes:", error);
            if (ui && ui.displayGlobalError) ui.displayGlobalError("Konnte User Share-Code nicht laden.");
        }
    },

    async regenerateMyUserShareCode() {
        console.log('[ChatService] regenerateMyUserShareCode');
        try {
            const data = await request('/chat/me/sharecode/regenerate', 'POST');
            if (store.currentUser) store.currentUser.userShareCode = data.userShareCode;
            if (ui && ui.updateMyShareCodeUI) ui.updateMyShareCodeUI(data.userShareCode);
            alert("Dein User Share-Code wurde neu generiert.");
        } catch (error) {
            console.error("[ChatService] Fehler beim Regenerieren des User Share Codes:", error);
            alert(error.data?.error || "Fehler beim Regenerieren.");
        }
    },

    async fetchChats(isPoll = false) {
        if (!store.currentUser) {
            if (isPoll && this.stopChatListPolling) this.stopChatListPolling();
            return;
        }
        if (!isPoll) {
            console.log('[ChatService] fetchChats (manuell/initial)');
            store.ui.isLoadingChats = true;
            if (ui && ui.showChatListLoading) ui.showChatListLoading(true);
        } else {
            // console.log('[ChatService] fetchChats (Polling)');
        }

        try {
            const data = await request('/chat/chats');
            if (!data || !Array.isArray(data.chats)) {
                console.warn("[ChatService] fetchChats: Ungültige Chat-Listen-Antwort vom Server erhalten.", data);
                if (!isPoll) setChats([]);
                return;
            }

            let triggerUIRender = false;

            if (!isPoll) {
                triggerUIRender = true;
            } else {
                if (store.chats.length !== data.chats.length) {
                    triggerUIRender = true;
                    console.log('[ChatService] Chat-Liste (Polling): Längenunterschied erkannt.');
                } else {
                    const oldChatsMap = new Map(store.chats.map(chat => [chat._id.toString(), { updatedAt: chat.updatedAt, lastMessagePreview: chat.lastMessagePreview, name: chat.name, isMutedServer: chat.isMuted }]));
                    for (const newChat of data.chats) {
                        const oldChatData = oldChatsMap.get(newChat._id.toString());
                        const currentMuteStateInStore = store.userChatSettings[newChat._id.toString()]?.isMuted || false;

                        if (!oldChatData ||
                            new Date(oldChatData.updatedAt).getTime() !== new Date(newChat.updatedAt).getTime() ||
                            oldChatData.lastMessagePreview !== newChat.lastMessagePreview ||
                            (oldChatData.name || '') !== (newChat.name || '') ||
                            (newChat.isMuted !== undefined && currentMuteStateInStore !== (newChat.isMuted || false))
                        ) {
                            triggerUIRender = true;
                            console.log(`[ChatService] Chat-Liste (Polling): Änderung bei Chat ID ${newChat._id} erkannt.`);
                            break;
                        }
                    }
                }
            }

            if (triggerUIRender) {
                console.log(`[ChatService] Chat-Liste wird neu gesetzt und UI gerendert (isPoll: ${isPoll}).`);
                setChats(data.chats);
            } else if (isPoll) {
                // console.log('[ChatService] Chat-Liste (Polling): Keine signifikanten Änderungen für Neu-Rendern erkannt.');
            }

        } catch (error) {
            console.error("[ChatService] Fehler beim Laden der Chats:", error);
            if (!isPoll && ui && ui.displayGlobalError) ui.displayGlobalError("Chats konnten nicht geladen werden.");
            if (error.status === 401 || error.status === 403) {
                if (isPoll && this.stopChatListPolling) this.stopChatListPolling();
            }
        } finally {
            if (!isPoll) {
                store.ui.isLoadingChats = false;
                if (ui && ui.showChatListLoading) ui.showChatListLoading(false);
            }
        }
    },

    async startPersonalChat(targetUserShareCode) {
        console.log('[ChatService] startPersonalChat with code:', targetUserShareCode);
        try {
            const data = await request('/chat/chats/personal', 'POST', { targetUserShareCode });
            this.fetchChats(false); // Chatliste sofort aktualisieren
            setActiveChat(data.chat._id); // Neuen Chat aktiv setzen
            if (ui && ui.hideModal) ui.hideModal('startPersonalChatModal');
            return data.chat;
        } catch (error) {
            console.error("[ChatService] Fehler beim Starten des persönlichen Chats:", error);
            if (ui && ui.displayModalError) ui.displayModalError('personalChatError', error.data?.error || error.message);
            throw error;
        }
    },

    async createGroupChat(name, initialParticipantShareCodesString) {
        console.log(`[ChatService] createGroupChat: "${name}", Participants: "${initialParticipantShareCodesString}"`);
        try {
            const codes = initialParticipantShareCodesString
                ? initialParticipantShareCodesString.split(',').map(s => s.trim()).filter(s => s)
                : [];
            const data = await request('/chat/chats/group', 'POST', { name, initialParticipantShareCodes: codes });
            this.fetchChats(false);
            setActiveChat(data.chat._id);
            if (ui && ui.hideModal) ui.hideModal('createGroupModal');
            return data.chat;
        } catch (error) {
            console.error("[ChatService] Fehler beim Erstellen der Gruppe:", error);
            if (ui && ui.displayModalError) ui.displayModalError('createGroupError', error.data?.error || error.message);
            throw error;
        }
    },

    async joinGroup(groupShareCode) {
        console.log('[ChatService] joinGroup with code:', groupShareCode);
        try {
            const data = await request(`/chat/groups/join/${groupShareCode}`);
            this.fetchChats(false);
            setActiveChat(data.chat._id);
            if (ui && ui.hideModal) ui.hideModal('joinGroupModal');
            return data.chat;
        } catch (error) {
            console.error("[ChatService] Fehler beim Beitreten zur Gruppe:", error);
            if (ui && ui.displayModalError) ui.displayModalError('joinGroupError', error.data?.error || error.message);
            throw error;
        }
    },

    async fetchMessagesForChat(chatId, loadMore = false) {
        const storeChatIdStr = chatId?.toString();
        console.log(`[ChatService] fetchMessagesForChat: ${storeChatIdStr}, loadMore: ${loadMore}`);
        if (store.ui.isLoadingMessages && !loadMore && store.activeChatId === storeChatIdStr) {
            console.log('[ChatService] fetchMessagesForChat: Nachrichten für diesen Chat laden bereits, breche ab.');
            return;
        }
        store.ui.isLoadingMessages = true;
        if (ui && ui.showMessageListLoading) ui.showMessageListLoading(true, loadMore);

        try {
            let endpoint = `/chat/chats/${storeChatIdStr}/messages?limit=30`;
            if (loadMore && store.messages[storeChatIdStr] && store.messages[storeChatIdStr].length > 0) {
                const oldestMessageId = store.messages[storeChatIdStr][0]._id; // Älteste Nachricht hat Index 0 im Store
                endpoint += `&beforeMessageId=${oldestMessageId}`;
            }
            const data = await request(endpoint);
            if (!data || !Array.isArray(data.messages)) {
                console.warn(`[ChatService] fetchMessagesForChat: Ungültige Nachrichtenantwort für Chat ${storeChatIdStr}`, data);
                setMessagesForChat(storeChatIdStr, [], !loadMore);
                return;
            }
            setMessagesForChat(storeChatIdStr, data.messages, !loadMore);
        } catch (error) {
            console.error(`[ChatService] Fehler beim Laden der Nachrichten für Chat ${storeChatIdStr}:`, error);
        } finally {
            store.ui.isLoadingMessages = false;
            if (ui && ui.showMessageListLoading) ui.showMessageListLoading(false, loadMore);
        }
    },

    async pollLatestMessages(chatId) {
        const storeChatIdStr = chatId?.toString();
        if (!storeChatIdStr || !store.currentUser || document.hidden) {
            return;
        }
        try {
            const existingMessages = store.messages[storeChatIdStr] || [];
            const data = await request(`/chat/chats/${storeChatIdStr}/messages?limit=15`);

            if (!data || !Array.isArray(data.messages)) {
                console.warn(`[ChatService] pollLatestMessages: Ungültige Nachrichtenantwort für Chat ${storeChatIdStr}`, data);
                return;
            }

            if (data.messages.length > 0) {
                const currentMessageIdsInStore = new Set(existingMessages.map(m => m._id.toString()));
                let newMessagesFound = false;

                data.messages.forEach(msg => {
                    const isNew = !currentMessageIdsInStore.has(msg._id.toString());
                    if (isNew) {
                        console.log(`[Polling] Nachricht ${msg._id} ("${msg.content.substring(0, 20)}...") ist NEU für Chat ${storeChatIdStr}. Füge zum Store hinzu.`);
                        addMessageToStore(storeChatIdStr, msg);
                        newMessagesFound = true;
                    }
                });
                // if (!newMessagesFound) {
                //     console.log(`[Polling] Keine neuen Nachrichten für Chat ${storeChatIdStr} gefunden.`);
                // }
            }
        } catch (error) {
            if (error.status !== 401 && error.status !== 403) {
                console.warn(`[ChatService] Polling Fehler für Chat ${storeChatIdStr}:`, error.message);
            } else {
                console.warn(`[ChatService] Auth error during polling for chat ${storeChatIdStr}, stopping all polling.`);
                this.stopAllPolling();
            }
        }
    },

    startMessagePolling(chatId) {
        const storeChatIdStr = chatId?.toString();
        this.stopMessagePolling();
        if (!storeChatIdStr || !store.currentUser) return;
        console.log(`[ChatService] startMessagePolling for chat ${storeChatIdStr}`);
        setTimeout(() => {
            if (store.activeChatId === storeChatIdStr && store.currentUser) this.pollLatestMessages(storeChatIdStr);
        }, 1500); // Kurze Verzögerung, um initiale Ladevorgänge nicht zu stören
        messagePollingInterval = setInterval(() => {
            if (store.activeChatId === storeChatIdStr && store.currentUser) this.pollLatestMessages(storeChatIdStr);
        }, MESSAGE_POLLING_INTERVAL_MS);
    },
    stopMessagePolling() {
        if (messagePollingInterval) {
            console.log('[ChatService] stopMessagePolling');
            clearInterval(messagePollingInterval);
            messagePollingInterval = null;
        }
    },

    startChatListPolling() {
        this.stopChatListPolling();
        if (!store.currentUser) return;
        console.log('[ChatService] startChatListPolling');
        this.fetchChats(true); // true für isPoll
        chatListPollingInterval = setInterval(() => {
            if (store.currentUser && !document.hidden) this.fetchChats(true);
        }, CHAT_LIST_POLLING_INTERVAL_MS);
    },
    stopChatListPolling() {
        if (chatListPollingInterval) {
            console.log('[ChatService] stopChatListPolling');
            clearInterval(chatListPollingInterval);
            chatListPollingInterval = null;
        }
    },

    startAllPolling() {
        console.log('[ChatService] startAllPolling');
        if (store.activeChatId) { // store.activeChatId ist jetzt ein String
            this.startMessagePolling(store.activeChatId);
        }
        this.startChatListPolling();
    },
    stopAllPolling() {
        console.log('[ChatService] stopAllPolling');
        this.stopMessagePolling();
        this.stopChatListPolling();
    },

    async sendMessage(chatId, content) {
        const storeChatIdStr = chatId?.toString();
        console.log(`[ChatService] sendMessage to ${storeChatIdStr}: "${content.substring(0, 30)}..."`);
        try {
            const data = await request(`/chat/chats/${storeChatIdStr}/messages`, 'POST', { content });
            addMessageToStore(storeChatIdStr, data.sentMessage);

            console.log('[ChatService] Nachricht gesendet, starte direkten Pull für Nachrichten und Chat-Liste.');
            this.pollLatestMessages(storeChatIdStr);
            this.fetchChats(true);

            return data.sentMessage;
        } catch (error) {
            console.error("[ChatService] Fehler beim Senden der Nachricht:", error);
            alert(`Fehler beim Senden: ${error.data?.error || error.message}`);
            throw error;
        }
    },

    async searchMessages(term) {
        console.log('[ChatService] searchMessages for term:', term);
        try {
            const data = await request(`/chat/messages/search?term=${encodeURIComponent(term)}`);
            setSearchResults(data.results);
            if (ui && ui.showElement) ui.showElement('searchResultsPanel');
        } catch (error) {
            console.error("[ChatService] Fehler bei der Nachrichtensuche:", error);
            alert(`Suchfehler: ${error.data?.error || error.message}`);
        }
    },

    async getGroupDetailsForAdmin(chatId) {
        const storeChatIdStr = chatId?.toString();
        console.log('[ChatService] getGroupDetailsForAdmin for chat:', storeChatIdStr);
        try {
            const group = store.chats.find(c => c._id.toString() === storeChatIdStr);

            if (group && group.type === 'group') {
                const currentUserIsAdmin = group.adminIds?.some(id => id.toString() === store.currentUser?.userId.toString());
                console.log(`[ChatService] getGroupDetailsForAdmin: Gruppe "${group.name}" gefunden. User ist Admin: ${currentUserIsAdmin}`);

                // Korrigierte Bedingung: Prüfe direkt auf 'groupAdmin' und seine Methode
                // 'groupAdmin' sollte global verfügbar sein, wenn ui.js korrekt geladen wurde.
                if (currentUserIsAdmin && typeof groupAdmin !== 'undefined' && typeof groupAdmin.populateAdminModal === 'function') {
                    console.log('[ChatService] getGroupDetailsForAdmin: User ist Admin und groupAdmin.populateAdminModal existiert. Rufe es auf.');
                    groupAdmin.populateAdminModal(group); // Direkter Aufruf
                } else if (!currentUserIsAdmin) {
                    console.warn("[ChatService] getGroupDetailsForAdmin: User ist KEIN Admin dieser Gruppe. Modal wird nicht geöffnet.");
                    alert("Du bist kein Administrator dieser Gruppe.");
                } else {
                    // Dieser Block wird jetzt detaillierter loggen, was fehlt
                    console.error("[ChatService] getGroupDetailsForAdmin: Bedingung für Modalaufruf NICHT erfüllt.");
                    if (typeof groupAdmin === 'undefined') {
                        console.error("[ChatService] FEHLER: Das 'groupAdmin' Objekt ist global nicht definiert. Stelle sicher, dass ui.js korrekt vor chatService.js geladen wurde und 'const groupAdmin = {...}' auf oberster Ebene von ui.js enthält.");
                    } else if (typeof groupAdmin.populateAdminModal !== 'function') {
                        console.error("[ChatService] FEHLER: Das 'groupAdmin' Objekt existiert, aber die Methode 'populateAdminModal' fehlt oder ist keine Funktion.");
                        console.log("[ChatService] Inhalt von groupAdmin:", groupAdmin);
                    }
                }
            } else {
                console.warn("[ChatService] getGroupDetailsForAdmin: Chat nicht gefunden oder ist keine Gruppe für ID:", storeChatIdStr);
                if (group && group.type !== 'group') {
                    alert("Diese Aktion ist nur für Gruppenchats verfügbar.");
                } else if (!group) {
                    alert("Gruppe nicht gefunden. Versuche, die Chatliste durch Neuladen der Seite zu aktualisieren.");
                }
            }
        } catch (error) {
            console.error("[ChatService] Schwerwiegender Fehler in getGroupDetailsForAdmin:", error);
            alert("Ein interner Fehler ist beim Öffnen der Gruppenverwaltung aufgetreten.");
        }
    },
    async updateGroupName(chatId, name) {
        const storeChatIdStr = chatId?.toString();
        console.log(`[ChatService] updateGroupName for ${storeChatIdStr} to "${name}"`);
        try {
            const data = await request(`/chat/groups/${storeChatIdStr}/details`, 'PUT', { name });
            addOrUpdateChatInStore(data.chat);
            if (store.activeChatId === storeChatIdStr) setActiveChat(storeChatIdStr);
            if (window.groupAdmin && groupAdmin.populateAdminModal) groupAdmin.populateAdminModal(data.chat);
            alert("Gruppenname geändert.");
        } catch (error) {
            alert(`Fehler Gruppenname: ${error.data?.error || error.message}`);
            throw error;
        }
    },
    async addParticipantToGroup(chatId, userShareCode) {
        const storeChatIdStr = chatId?.toString();
        console.log(`[ChatService] addParticipantToGroup ${userShareCode} to ${storeChatIdStr}`);
        try {
            const data = await request(`/chat/groups/${storeChatIdStr}/participants`, 'POST', { userShareCodes: [userShareCode] });
            addOrUpdateChatInStore(data.chat);
            if (window.groupAdmin && groupAdmin.populateAdminModal) groupAdmin.populateAdminModal(data.chat);
            alert(data.message || "Teilnehmer hinzugefügt/versucht.");
        } catch (error) {
            alert(`Fehler Teilnehmer hinzufügen: ${error.data?.error || error.message}`);
            throw error;
        }
    },
    async kickParticipant(chatId, participantUserId) {
        const storeChatIdStr = chatId?.toString();
        const participantUserIdStr = participantUserId?.toString();
        console.log(`[ChatService] kickParticipant ${participantUserIdStr} from ${storeChatIdStr}`);
        try {
            const data = await request(`/chat/groups/${storeChatIdStr}/participants/${participantUserIdStr}`, 'DELETE');
            addOrUpdateChatInStore(data.chat);
            if (window.groupAdmin && groupAdmin.populateAdminModal) groupAdmin.populateAdminModal(data.chat);
            alert(data.message);
        } catch (error) {
            alert(`Fehler Kick: ${error.data?.error || error.message}`);
            throw error;
        }
    },
    async banParticipant(chatId, userIdToBan) {
        const storeChatIdStr = chatId?.toString();
        const userIdToBanStr = userIdToBan?.toString();
        console.log(`[ChatService] banParticipant ${userIdToBanStr} from ${storeChatIdStr}`);
        try {
            const data = await request(`/chat/groups/${storeChatIdStr}/ban`, 'POST', { userIdToBan: userIdToBanStr });
            addOrUpdateChatInStore(data.chat);
            if (window.groupAdmin && groupAdmin.populateAdminModal) groupAdmin.populateAdminModal(data.chat);
            alert(data.message);
        } catch (error) {
            alert(`Fehler Bann: ${error.data?.error || error.message}`);
            throw error;
        }
    },
    async unbanParticipant(chatId, bannedUserId) {
        const storeChatIdStr = chatId?.toString();
        const bannedUserIdStr = bannedUserId?.toString();
        console.log(`[ChatService] unbanParticipant ${bannedUserIdStr} from ${storeChatIdStr}`);
        try {
            const data = await request(`/chat/groups/${storeChatIdStr}/ban/${bannedUserIdStr}`, 'DELETE');
            addOrUpdateChatInStore(data.chat);
            if (window.groupAdmin && groupAdmin.populateAdminModal) groupAdmin.populateAdminModal(data.chat);
            alert(data.message);
        } catch (error) {
            alert(`Fehler Entbannen: ${error.data?.error || error.message}`);
            throw error;
        }
    },
    async promoteToAdmin(chatId, participantUserId) {
        const storeChatIdStr = chatId?.toString();
        const participantUserIdStr = participantUserId?.toString();
        console.log(`[ChatService] promoteToAdmin ${participantUserIdStr} in ${storeChatIdStr}`);
        try {
            const data = await request(`/chat/groups/${storeChatIdStr}/admins/${participantUserIdStr}`, 'POST');
            addOrUpdateChatInStore(data.chat);
            if (window.groupAdmin && groupAdmin.populateAdminModal) groupAdmin.populateAdminModal(data.chat);
            alert(data.message);
        } catch (error) {
            alert(`Fehler Promote: ${error.data?.error || error.message}`);
            throw error;
        }
    },
    async demoteAdmin(chatId, adminUserIdToRemove) {
        const storeChatIdStr = chatId?.toString();
        const adminUserIdToRemoveStr = adminUserIdToRemove?.toString();
        console.log(`[ChatService] demoteAdmin ${adminUserIdToRemoveStr} in ${storeChatIdStr}`);
        try {
            const data = await request(`/chat/groups/${storeChatIdStr}/admins/${adminUserIdToRemoveStr}`, 'DELETE');
            addOrUpdateChatInStore(data.chat);
            if (window.groupAdmin && groupAdmin.populateAdminModal) groupAdmin.populateAdminModal(data.chat);
            alert(data.message);
        } catch (error) {
            alert(`Fehler Demote: ${error.data?.error || error.message}`);
            throw error;
        }
    },
    async leaveGroup(chatId) {
        const storeChatIdStr = chatId?.toString();
        console.log(`[ChatService] leaveGroup ${storeChatIdStr}`);
        try {
            const data = await request(`/chat/groups/${storeChatIdStr}/leave`, 'POST');
            alert(data.message);
            if (data.chat) {
                addOrUpdateChatInStore(data.chat);
            } else {
                store.chats = store.chats.filter(c => c._id.toString() !== storeChatIdStr);
                if (store.activeChatId === storeChatIdStr) setActiveChat(null);
                if (ui && ui.renderChatList) ui.renderChatList();
            }
            if (ui && ui.hideModal) ui.hideModal('groupAdminModal');
            this.fetchChats(false);
        } catch (error) {
            alert(`Fehler Gruppe verlassen: ${error.data?.error || error.message}`);
            throw error;
        }
    },
    async deleteGroup(chatId) {
        const storeChatIdStr = chatId?.toString();
        console.log(`[ChatService] deleteGroup ${storeChatIdStr}`);
        try {
            const data = await request(`/chat/groups/${storeChatIdStr}`, 'DELETE');
            alert(data.message);
            store.chats = store.chats.filter(c => c._id.toString() !== storeChatIdStr);
            if (store.activeChatId === storeChatIdStr) setActiveChat(null);
            if (ui && ui.renderChatList) ui.renderChatList();
            if (ui && ui.hideModal) ui.hideModal('groupAdminModal');
            this.fetchChats(false);
        } catch (error) {
            alert(`Fehler Gruppe löschen: ${error.data?.error || error.message}`);
            throw error;
        }
    },
    async regenerateGroupShareCode(chatId) {
        const storeChatIdStr = chatId?.toString();
        console.log(`[ChatService] regenerateGroupShareCode for ${storeChatIdStr}`);
        try {
            const data = await request(`/chat/groups/${storeChatIdStr}/regenerateShareCode`, 'POST');
            addOrUpdateChatInStore(data.chat);
            if (window.groupAdmin && groupAdmin.populateAdminModal) groupAdmin.populateAdminModal(data.chat);
            alert("Neuer Gruppen Share-Code generiert.");
        } catch (error) {
            alert(`Fehler Share-Code Gen.: ${error.data?.error || error.message}`);
            throw error;
        }
    },

    async toggleMuteChat(chatId, newMuteStatus) {
        const storeChatIdStr = chatId?.toString();
        console.log(`[ChatService] toggleMuteChat for ${storeChatIdStr} to ${newMuteStatus}`);
        try {
            await request(`/chat/chats/${storeChatIdStr}/settings/mute`, 'PUT', { isMuted: newMuteStatus });
            updateChatSettingInStore(storeChatIdStr, 'isMuted', newMuteStatus);
        } catch (error) {
            console.error("[ChatService] Fehler beim Muten des Chats:", error);
            alert(`Fehler beim Ändern des Mute-Status: ${error.data?.error || error.message}`);
        }
    }
};