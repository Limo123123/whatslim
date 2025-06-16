// js/ui.js

let loginSectionEl, registerSectionEl, chatAppSectionEl, userInfoDivEl, chatListEl,
    activeChatHeaderEl, messageListEl, messageTextEl, sendMessageBtnEl,
    modalOverlayEl, myUserShareCodeEl, messageSearchInputEl, searchResultsPanelEl,
    searchResultsListEl, activeChatTitleEl, groupOptionsContainerEl,
    startPersonalChatModalEl, createGroupModalEl, joinGroupModalEl, groupAdminModalEl;

const ui = {
    initDOMElements() {
        console.log('[UI] initDOMElements START');
        loginSectionEl = document.getElementById('loginSection');
        registerSectionEl = document.getElementById('registerSection');
        chatAppSectionEl = document.getElementById('chatAppSection');
        userInfoDivEl = document.getElementById('userInfo');
        chatListEl = document.getElementById('chatList');
        activeChatHeaderEl = document.getElementById('activeChatHeader');
        messageListEl = document.getElementById('messageList');
        messageTextEl = document.getElementById('messageText');
        sendMessageBtnEl = document.getElementById('sendMessageBtn');
        modalOverlayEl = document.getElementById('modalOverlay');
        myUserShareCodeEl = document.getElementById('myUserShareCode');
        messageSearchInputEl = document.getElementById('messageSearchInput');
        searchResultsPanelEl = document.getElementById('searchResultsPanel');
        searchResultsListEl = document.getElementById('searchResultsList');

        startPersonalChatModalEl = document.getElementById('startPersonalChatModal');
        createGroupModalEl = document.getElementById('createGroupModal');
        joinGroupModalEl = document.getElementById('joinGroupModal');
        groupAdminModalEl = document.getElementById('groupAdminModal');

        if (activeChatHeaderEl) {
            activeChatTitleEl = activeChatHeaderEl.querySelector('h4');
            if (!activeChatTitleEl) {
                activeChatTitleEl = document.createElement('h4');
                activeChatHeaderEl.prepend(activeChatTitleEl);
            }
            groupOptionsContainerEl = activeChatHeaderEl.querySelector('.group-options');
            if (!groupOptionsContainerEl) {
                groupOptionsContainerEl = document.createElement('div');
                groupOptionsContainerEl.className = 'group-options';
                activeChatHeaderEl.appendChild(groupOptionsContainerEl);
            }
        } else {
            console.warn("[UI] activeChatHeaderEl nicht gefunden bei initDOMElements");
        }
        console.log('[UI] initDOMElements END');
    },

    showScreen(screenToShow) {
        console.log('[UI] showScreen:', screenToShow ? screenToShow.id : 'none');
        loginSectionEl?.classList.add('hidden');
        registerSectionEl?.classList.add('hidden');
        chatAppSectionEl?.classList.add('hidden');
        if (screenToShow) screenToShow.classList.remove('hidden');
    },
    showLoginScreen() { this.showScreen(loginSectionEl); },
    showRegisterScreen() { this.showScreen(registerSectionEl); },
    showChatApp() { this.showScreen(chatAppSectionEl); },

    updateUserInfoHeader() {
        if (!userInfoDivEl) return;
        console.log('[UI] updateUserInfoHeader, currentUser:', store.currentUser ? store.currentUser.username : 'null');
        if (store.currentUser) {
            userInfoDivEl.innerHTML = `
                <span>Hallo, ${store.currentUser.username}! (Limo ID)</span>
                <button id="logoutButton" class="secondary">Logout</button>
            `;
            document.getElementById('logoutButton')?.addEventListener('click', async () => {
                console.log('[UI] Logout-Button geklickt');
                try {
                    if (window.chatService) chatService.stopAllPolling(); // POLLING HIER STOPPEN
                    await authService.logout(); // authService.logout kümmert sich um Store-Reset
                    this.showLoginScreen();
                    this.clearChatUI();
                } catch (err) {
                    this.displayGlobalError('Fehler beim Logout.');
                }
            });
        } else {
            userInfoDivEl.innerHTML = '';
        }
    },
    updateMyShareCodeUI(code) {
        console.log('[UI] VERSUCH updateMyShareCodeUI auszuführen mit Code:', code);
        console.log('[UI] Aktueller Wert von myUserShareCodeEl BEIM AUFRUF:', myUserShareCodeEl);

        if (myUserShareCodeEl) {
            myUserShareCodeEl.textContent = code || 'Wird geladen...';
            console.log('[UI] updateMyShareCodeUI ERFOLGREICH für Element:', myUserShareCodeEl, 'mit Code:', code);
        } else {
            const directEl = document.getElementById('myUserShareCode');
            console.warn("[UI] myUserShareCodeEl war null/undefined in updateMyShareCodeUI. Direktes Holen ergibt:", directEl, "Code war:", code);
            if (directEl) {
                directEl.textContent = code || 'Direkt geladen';
                console.log("[UI] Direktes Setzen des TextContents war erfolgreich.");
            } else {
                console.error("[UI] Auch direktes Holen von #myUserShareCode in updateMyShareCodeUI fehlgeschlagen!");
            }
        }
    },

    renderChatList() {
        if (!chatListEl) return;
        console.log('[UI] renderChatList, Anzahl Chats:', store.chats.length);
        const preservedScrollTop = chatListEl.scrollTop; // Scrollposition merken

        chatListEl.innerHTML = '';
        if (!store.chats || store.chats.length === 0) {
            chatListEl.innerHTML = '<li class="no-chats-placeholder">Keine Chats vorhanden. Starte einen neuen!</li>';
            return;
        }
        store.chats.forEach(chat => {
            const li = document.createElement('li');
            li.dataset.chatId = chat._id;
            li.dataset.chatType = chat.type;
            if (chat._id === store.activeChatId) {
                li.classList.add('active-chat');
            }

            let displayName = '';
            if (chat.type === 'group') {
                displayName = chat.name || 'Unbenannte Gruppe';
            } else if (chat.type === 'personal' && store.currentUser) {
                const otherParticipantDetail = chat.displayParticipants?.find(p => p.userId.toString() !== store.currentUser.userId.toString());
                if (otherParticipantDetail) {
                    displayName = `Chat mit ${otherParticipantDetail.username}`;
                } else { // Fallback, wenn displayParticipants nicht da ist oder leer
                    const otherPIdObject = chat.participants.find(pObj => pObj.toString() !== store.currentUser.userId.toString());
                    const otherPId = otherPIdObject ? otherPIdObject.toString() : null;
                    displayName = otherPId ? `Chat mit User ${otherPId.substring(0, 6)}...` : 'Persönlicher Chat';
                }
            }

            const nameSpan = document.createElement('span');
            nameSpan.className = 'chat-name';
            nameSpan.textContent = displayName;

            const previewSpan = document.createElement('span');
            previewSpan.className = 'last-message-preview';
            let previewText = chat.lastMessagePreview || (chat.type === 'group' ? 'Gruppe erstellt' : 'Chat gestartet');
            if (chat.lastMessageSenderId === store.currentUser?.userId) {
                previewText = "Du: " + previewText;
            } else if (chat.senderUsername && chat.lastMessageSenderId !== null) { // Nicht für Systemnachrichten ohne Sender
                previewText = chat.senderUsername + ": " + previewText;
            }
            previewSpan.textContent = previewText;


            const muteButton = document.createElement('button');
            muteButton.className = 'mute-chat-btn secondary';
            const isMuted = store.userChatSettings[chat._id]?.isMuted || false;
            muteButton.textContent = isMuted ? 'Laut' : 'Mute';
            muteButton.dataset.muted = isMuted.toString();

            li.appendChild(nameSpan);
            li.appendChild(previewSpan);
            li.appendChild(muteButton);
            chatListEl.appendChild(li);
        });
        chatListEl.scrollTop = preservedScrollTop; // Scrollposition wiederherstellen
    },
    showChatListLoading(isLoading) {
        console.log('[UI] showChatListLoading:', isLoading);
        if (chatListEl && isLoading) {
            if (!chatListEl.querySelector('.loading-placeholder')) { // Nur hinzufügen, wenn nicht schon da
                const placeholder = document.createElement('li');
                placeholder.className = 'loading-placeholder';
                placeholder.textContent = 'Lade Chats...';
                chatListEl.prepend(placeholder); // Oben anzeigen
            }
        } else if (chatListEl) {
            const placeholder = chatListEl.querySelector('.loading-placeholder');
            if (placeholder) placeholder.remove();
            if (!isLoading && store.chats.length === 0) { // Nach Laden prüfen, ob leer
                chatListEl.innerHTML = '<li class="no-chats-placeholder">Keine Chats vorhanden. Starte einen neuen!</li>';
            }
        }
    },
    updateMuteButtonForRow(chatId, isMuted) {
        console.log(`[UI] updateMuteButtonForRow for ${chatId}, muted: ${isMuted}`);
        const li = chatListEl?.querySelector(`li[data-chat-id="${chatId}"]`);
        if (li) {
            const btn = li.querySelector('.mute-chat-btn');
            if (btn) {
                btn.textContent = isMuted ? 'Laut' : 'Mute';
                btn.dataset.muted = isMuted.toString();
            }
        }
    },

    selectChat(chatId) {
        console.log('[UI] selectChat:', chatId);
        if (store.activeChatId === chatId &&
            store.messages[chatId] && store.messages[chatId].length > 0 &&
            !store.ui.isLoadingMessages) {
            console.log('[UI] Chat bereits aktiv und Nachrichten geladen/nicht ladend, nur UI-Highlight.');
            this.renderChatList(); // Nur Highlight aktualisieren
            return;
        }
        if (store.activeChatId === chatId && store.ui.isLoadingMessages) {
            console.log('[UI] Chat bereits aktiv und Nachrichten laden gerade, keine Aktion.');
            return;
        }

        setActiveChat(chatId); // Setzt im Store, ruft updateActiveChatView, startet Polling für diesen Chat
        if (chatId) { // Nur Nachrichten laden, wenn ein Chat ausgewählt wird
            chatService.fetchMessagesForChat(chatId, false); // false für initialLoad
        }
        this.renderChatList(); // Um active-chat Klasse korrekt zu setzen
    },

    updateActiveChatView() {
        console.log('[UI] updateActiveChatView, activeChatId:', store.activeChatId);
        if (!activeChatHeaderEl || !messageListEl) {
            console.warn("[UI] updateActiveChatView: Header oder Nachrichtenliste nicht gefunden.");
            return;
        }
        if (groupOptionsContainerEl) groupOptionsContainerEl.innerHTML = ''; // Sicherstellen, dass es existiert

        if (store.activeChatId && store.activeChatDetails) {
            const chat = store.activeChatDetails;
            let title = '';
            if (chat.type === 'group') {
                title = chat.name || 'Unbenannte Gruppe';
                const isAdmin = chat.adminIds?.some(id => id.toString() === store.currentUser?.userId.toString());
                console.log(`[UI] User ${store.currentUser?.username} isAdmin of group ${chat.name}: ${isAdmin}`);
                if (isAdmin && groupOptionsContainerEl) {
                    const adminBtn = document.createElement('button');
                    adminBtn.textContent = 'Verwalten';
                    adminBtn.className = 'secondary group-admin-btn';
                    adminBtn.id = 'openGroupAdminModalBtn';
                    groupOptionsContainerEl.appendChild(adminBtn);
                }
            } else { // personal
                const otherParticipantDetail = chat.displayParticipants?.find(p => p.userId.toString() !== store.currentUser?.userId.toString());
                if (otherParticipantDetail) {
                    title = `Chat mit ${otherParticipantDetail.username}`;
                } else if (chat.participants && store.currentUser) {
                    const otherPIdObject = chat.participants.find(pObj => pObj.toString() !== store.currentUser.userId.toString());
                    const otherPId = otherPIdObject ? otherPIdObject.toString() : null;
                    title = otherPId ? `Chat mit User ${otherPId.substring(0, 6)}...` : 'Persönlicher Chat';
                } else {
                    title = 'Persönlicher Chat';
                }
            }
            if (activeChatTitleEl) activeChatTitleEl.textContent = title;
            messageListEl.innerHTML = ''; // Nachrichtenliste leeren für neue Nachrichten
            messageTextEl.disabled = false;
            sendMessageBtnEl.disabled = false;
            messageTextEl.placeholder = "Nachricht eingeben...";
        } else {
            this.displayNoActiveChat();
        }
    },
    displayNoActiveChat() {
        console.log('[UI] displayNoActiveChat');
        if (activeChatTitleEl) activeChatTitleEl.textContent = 'Wähle einen Chat';
        if (messageListEl) messageListEl.innerHTML = '<p class="chat-placeholder">Wähle einen Chat aus der Liste oder erstelle einen neuen.</p>';
        if (messageTextEl) {
            messageTextEl.disabled = true;
            messageTextEl.placeholder = "Wähle einen Chat...";
        }
        if (sendMessageBtnEl) sendMessageBtnEl.disabled = true;
        if (groupOptionsContainerEl) groupOptionsContainerEl.innerHTML = '';
    },

    displayMessages(chatId, messages, initialLoad = true) {
        console.log(`[UI] displayMessages WIRD AUFGERUFEN für Chat ${chatId}. messageListEl:`, messageListEl, "Anzahl zu rendernder Nachrichten:", messages.length, "InitialLoad/Replace:", initialLoad);

        if (!messageListEl) {
            console.error("[UI] displayMessages FEHLER: messageListEl ist null! Nachrichten können nicht angezeigt werden.");
            return;
        }
        if (store.activeChatId !== chatId) {
            console.warn(`[UI] displayMessages: Angezeigter Chat ${store.activeChatId} ist nicht der Ziel-Chat ${chatId}. Breche ab.`);
            return;
        }
        const currentUserId = store.currentUser?.userId;
        if (!currentUserId) {
            console.warn("[UI] displayMessages: currentUser nicht vorhanden. Breche ab.");
            return;
        }

        const oldScrollHeight = messageListEl.scrollHeight;
        const oldScrollTop = messageListEl.scrollTop;
        const shouldMaintainScroll = !initialLoad && messageListEl.scrollTop > 0; // Nur bei "load more" und wenn nicht ganz oben

        if (initialLoad) {
            console.log("[UI] displayMessages: initialLoad ist true, leere messageListEl.");
            messageListEl.innerHTML = '';
        }

        if (messages.length === 0 && initialLoad) {
            messageListEl.innerHTML = '<p class="chat-placeholder">Noch keine Nachrichten in diesem Chat.</p>';
            console.log("[UI] displayMessages: Keine Nachrichten, Platzhalter gesetzt.");
            return;
        }

        const fragment = document.createDocumentFragment();
        console.log("[UI] displayMessages: Beginne Iteration über Nachrichten...");
        messages.forEach(msg => {
            // Verhindere doppeltes Rendern, falls Nachricht schon im DOM ist (relevant bei Polling und manuellem Nachladen)
            if (initialLoad || !messageListEl.querySelector(`div[data-message-id="${msg._id}"]`)) {
                // console.log(`[UI] displayMessages: Erstelle Div für Nachricht ID ${msg._id}, Inhalt: "${msg.content.substring(0,20)}..."`);
                const messageDiv = this.createMessageDiv(msg, currentUserId);
                if (messageDiv) {
                    // console.log(`[UI] displayMessages: messageDiv erstellt:`, messageDiv.outerHTML.substring(0, 100) + "...");
                    fragment.appendChild(messageDiv);
                } else {
                    console.error(`[UI] displayMessages: createMessageDiv hat null zurückgegeben für Nachricht:`, msg);
                }
            }
        });
        console.log("[UI] displayMessages: Iteration beendet. Fragment Kinder:", fragment.children.length);

        if (initialLoad) {
            messageListEl.appendChild(fragment);
            console.log("[UI] displayMessages: Fragment an messageListEl (initialLoad) angehängt. Kinder in messageListEl:", messageListEl.children.length);
            this.scrollToBottom(messageListEl);
        } else { // Nachladen älterer Nachrichten
            messageListEl.prepend(fragment); // Neue (ältere) Nachrichten oben einfügen
            console.log("[UI] displayMessages: Fragment vor erstem Kind (loadMore) eingefügt. Kinder in messageListEl:", messageListEl.children.length);
            if (shouldMaintainScroll) {
                messageListEl.scrollTop = oldScrollTop + (messageListEl.scrollHeight - oldScrollHeight);
            }
        }
        console.log("[UI] displayMessages BEENDET.");
    },

    createMessageDiv(msg, currentUserId) {
        // console.log(`[UI] createMessageDiv START für Msg ID ${msg._id}, Inhalt: "${msg.content.substring(0,20)}..."`);
        const div = document.createElement('div');
        div.classList.add('message');
        div.dataset.messageId = msg._id;

        if (msg.senderId === null || msg.senderUsername === "System") {
            div.classList.add('system');
        } else if (msg.senderId.toString() === currentUserId.toString()) {
            div.classList.add('self');
        } else {
            div.classList.add('other');
        }

        const contentP = document.createElement('p');
        contentP.className = 'message-content';
        contentP.textContent = msg.content;

        const metaSpan = document.createElement('span');
        metaSpan.className = 'message-meta';
        const messageTime = new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

        if (msg.senderId !== null && msg.senderUsername !== "System") {
            const senderP = document.createElement('p');
            senderP.className = 'message-sender';
            senderP.textContent = (msg.senderId.toString() === currentUserId.toString()) ? 'Du' : msg.senderUsername;
            div.appendChild(senderP);
            metaSpan.textContent = messageTime;
        } else {
            metaSpan.textContent = messageTime;
        }

        div.appendChild(contentP);
        if (msg.senderId !== null || msg.senderUsername === "System") div.appendChild(metaSpan);

        // console.log(`[UI] createMessageDiv END für Msg ID ${msg._id}, erstelltes div:`, div ? div.className : "null");
        return div;
    },

    renderSingleMessage(msg, currentUserId, scroll = true) {
        console.log(`[UI] renderSingleMessage START für Msg ID ${msg._id}. messageListEl:`, messageListEl, `Inhalt: "${msg.content.substring(0, 20)}..."`);
        if (!messageListEl) {
            console.error("[UI] renderSingleMessage FEHLER: messageListEl ist null!");
            return;
        }

        // WICHTIG: Verhindere doppeltes Rendern, falls Nachricht schon im DOM ist
        // Dies kann passieren, wenn Polling und andere Mechanismen (z.B. direkter Pull nach Senden) sich überschneiden.
        if (messageListEl.querySelector(`div.message[data-message-id="${msg._id}"]`)) {
            console.log(`[UI] renderSingleMessage: Nachricht ${msg._id} ist bereits im DOM. Breche Rendern ab.`);
            return;
        }

        if (store.activeChatId !== msg.chatId) {
            console.warn(`[UI] renderSingleMessage: Aktiver Chat ${store.activeChatId} stimmt nicht mit Nachricht-Chat ${msg.chatId} überein. Breche ab, um Nachricht nicht im falschen Chat anzuzeigen.`);
            return;
        }

        const placeholder = messageListEl.querySelector('p.chat-placeholder');
        if (placeholder) {
            console.log("[UI] renderSingleMessage: Entferne Platzhalter.");
            placeholder.remove();
        }

        const messageDiv = this.createMessageDiv(msg, currentUserId); // 'this' bezieht sich auf das ui-Objekt
        if (messageDiv) {
            console.log(`[UI] renderSingleMessage: messageDiv erstellt, hänge an. HTML (gekürzt):`, messageDiv.outerHTML.substring(0, 100) + "...");
            messageListEl.appendChild(messageDiv);
            if (scroll) {
                console.log("[UI] renderSingleMessage: Scrolle nach unten.");
                this.scrollToBottom(messageListEl);
            }
        } else {
            console.error(`[UI] renderSingleMessage: createMessageDiv hat null zurückgegeben für Nachricht:`, msg);
        }
        console.log("[UI] renderSingleMessage BEENDET für Msg ID:", msg._id);
    },

    showMessageListLoading(isLoading, isLoadMore = false) {
        console.log(`[UI] showMessageListLoading: ${isLoading}, isLoadMore: ${isLoadMore}`);
        const existingSpinner = messageListEl?.querySelector('.loading-spinner');
        if (isLoading) {
            if (!existingSpinner) {
                const spinner = document.createElement('p');
                spinner.className = 'loading-spinner chat-placeholder';
                spinner.textContent = 'Lade Nachrichten...';
                if (isLoadMore && messageListEl) {
                    messageListEl.prepend(spinner);
                } else if (messageListEl) {
                    // Für initiales Laden, wenn die Liste leer ist
                    // messageListEl.innerHTML = ''; // Nicht hier leeren, das macht displayMessages
                    messageListEl.appendChild(spinner);
                }
            }
        } else {
            if (existingSpinner) existingSpinner.remove();
        }
    },
    clearMessageInput() {
        if (messageTextEl) messageTextEl.value = '';
        console.log('[UI] clearMessageInput');
    },
    scrollToBottom(element) {
        if (element) {
            // console.log('[UI] scrollToBottom for element:', element.id || element.className);
            element.scrollTop = element.scrollHeight;
        }
    },

    showModal(modalId) {
        console.log('[UI] showModal:', modalId);
        const modalToShow = document.getElementById(modalId);
        if (modalOverlayEl && modalToShow) {
            modalOverlayEl.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
            modalToShow.classList.remove('hidden');
            modalOverlayEl.classList.remove('hidden');
            modalOverlayEl.style.display = 'flex';
            store.ui.isModalOpen = true;
            store.ui.currentOpenModalId = modalId;
            const errorP = modalToShow.querySelector('.error-message');
            if (errorP) errorP.textContent = '';
        } else {
            console.warn(`[UI] Modal oder Overlay nicht gefunden für Modal-ID: ${modalId}`);
        }
    },
    hideModal(modalId) {
        console.log('[UI] hideModal:', modalId);
        const modalToHide = document.getElementById(modalId);
        if (modalOverlayEl) {
            if (modalToHide) modalToHide.classList.add('hidden');
            modalOverlayEl.classList.add('hidden');
            modalOverlayEl.style.display = 'none';
            store.ui.isModalOpen = false;
            store.ui.currentOpenModalId = null;
        }
    },
    displayModalError(modalErrorElementId, message) {
        console.log(`[UI] displayModalError for ${modalErrorElementId}: "${message}"`);
        const errorEl = document.getElementById(modalErrorElementId);
        if (errorEl) errorEl.textContent = message;
    },
    displayGlobalError(message) {
        console.error('[UI] displayGlobalError:', message);
        alert(message);
    },

    renderSearchResults(results) {
        console.log('[UI] renderSearchResults, Anzahl:', results.length);
        if (!searchResultsListEl) return;
        searchResultsListEl.innerHTML = '';
        if (!results || results.length === 0) {
            searchResultsListEl.innerHTML = '<li>Keine Ergebnisse gefunden.</li>';
            return;
        }
        results.forEach(msg => {
            const li = document.createElement('li');
            li.dataset.messageId = msg._id;
            li.dataset.chatId = msg.chatId;
            const searchTermRegex = new RegExp(messageSearchInputEl.value.trim(), 'gi');
            li.innerHTML = `
                <div class="search-result-chat">In: ${msg.chatDisplay || 'Unbekannter Chat'}</div>
                <div class="search-result-sender">${msg.senderUsername === store.currentUser?.username ? "Du" : msg.senderUsername}:</div>
                <div class="search-result-content">${msg.content.replace(searchTermRegex, (match) => `<mark>${match}</mark>`)}</div>
                <div class="search-result-time">${new Date(msg.timestamp).toLocaleString('de-DE')}</div>
            `;
            li.addEventListener('click', () => {
                console.log(`[UI] Suchergebnis geklickt: Chat ${msg.chatId}, Nachricht ${msg._id}`);
                this.selectChat(msg.chatId);
                this.hideElement('searchResultsPanel');
            });
            searchResultsListEl.appendChild(li);
        });
    },

    hideElement(elementId) {
        const el = document.getElementById(elementId);
        if (el) el.classList.add('hidden');
        else console.warn(`[UI] hideElement: Element mit ID '${elementId}' nicht gefunden.`);
    },
    showElement(elementId) {
        const el = document.getElementById(elementId);
        if (el) el.classList.remove('hidden');
        else console.warn(`[UI] showElement: Element mit ID '${elementId}' nicht gefunden.`);
    },
    clearChatUI() {
        console.log('[UI] clearChatUI');
        if (chatListEl) chatListEl.innerHTML = '';
        this.displayNoActiveChat();
        if (myUserShareCodeEl) myUserShareCodeEl.textContent = '';
        if (messageSearchInputEl) messageSearchInputEl.value = '';
        this.hideElement('searchResultsPanel');
    }
};

const groupAdmin = {
    currentEditingGroupId: null,

    populateAdminModal(group) {
        console.log('[GroupAdmin] populateAdminModal for group:', group.name, group._id);
        if (!groupAdminModalEl || !store.currentUser) {
            console.warn("[GroupAdmin] Modal oder currentUser nicht verfügbar.");
            return;
        }
        this.currentEditingGroupId = group._id;

        document.getElementById('adminModalGroupName').textContent = group.name;
        document.getElementById('adminModalGroupShareCode').textContent = group.groupShareCode || 'N/A';
        document.getElementById('adminEditGroupNameInput').value = group.name;

        const participantListUl = document.getElementById('adminParticipantList');
        participantListUl.innerHTML = '';
        document.getElementById('adminParticipantCount').textContent = group.participants?.length || 0;

        group.participants?.forEach(pIdObject => {
            const pId = pIdObject.toString();
            const li = document.createElement('li');
            let pUsername = `User ${pId.substring(0, 6)}`;
            const isCurrentUser = pId === store.currentUser.userId.toString();
            const isOwner = pId === group.ownerId.toString();
            const isGroupAdmin = group.adminIds?.some(adminId => adminId.toString() === pId);

            const userInChatParticipants = group.displayParticipants?.find(dp => dp.userId.toString() === pId);
            if (userInChatParticipants) {
                pUsername = userInChatParticipants.username;
            } else if (isCurrentUser) {
                pUsername = store.currentUser.username;
            }

            const nameSpan = document.createElement('span');
            nameSpan.textContent = pUsername + (isCurrentUser ? ' (Du)' : '');
            if (isOwner) nameSpan.textContent += ' (Owner)';
            else if (isGroupAdmin) nameSpan.textContent += ' (Admin)';
            li.appendChild(nameSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'admin-actions';

            const currentUserIsOwner = store.currentUser.userId.toString() === group.ownerId.toString();
            const currentUserIsAdmin = group.adminIds?.some(adminId => adminId.toString() === store.currentUser.userId.toString());

            if (!isCurrentUser && !isOwner) {
                if (currentUserIsOwner || (currentUserIsAdmin && !isGroupAdmin)) { // Admins können nur Nicht-Admins kicken/bannen
                    actionsDiv.appendChild(this.createAdminActionButton('Kick', () => chatService.kickParticipant(group._id, pId)));
                    actionsDiv.appendChild(this.createAdminActionButton('Ban', () => chatService.banParticipant(group._id, pId)));
                }
            }
            if (currentUserIsOwner && !isOwner && !isCurrentUser) {
                if (isGroupAdmin) {
                    actionsDiv.appendChild(this.createAdminActionButton('Demote', () => chatService.demoteAdmin(group._id, pId)));
                } else {
                    actionsDiv.appendChild(this.createAdminActionButton('Promote', () => chatService.promoteToAdmin(group._id, pId)));
                }
            }
            li.appendChild(actionsDiv);
            participantListUl.appendChild(li);
        });

        const deleteGroupBtn = document.getElementById('adminDeleteGroupBtn');
        if (group.ownerId.toString() === store.currentUser.userId.toString()) {
            ui.showElement('adminDeleteGroupBtn');
        } else {
            ui.hideElement('adminDeleteGroupBtn');
        }
        ui.showModal('groupAdminModal');
    },

    createAdminActionButton(text, onClickHandler) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.className = (text === 'Kick' || text === 'Ban' || text === 'Demote') ? 'danger' : 'secondary';
        if (text === 'Gruppe LÖSCHEN (Owner)') btn.className = 'danger';
        btn.style.fontSize = '0.75em';
        btn.style.padding = '2px 5px';
        btn.style.marginLeft = '4px';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onClickHandler();
        });
        return btn;
    },

    cleanupAdminModal() {
        console.log('[GroupAdmin] cleanupAdminModal');
        this.currentEditingGroupId = null;
        const addParticipantInput = document.getElementById('adminAddParticipantInput');
        if (addParticipantInput) addParticipantInput.value = '';
        const errorP = groupAdminModalEl?.querySelector('.error-message');
        if (errorP) errorP.textContent = '';
    }
};