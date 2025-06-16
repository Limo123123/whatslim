// js/store.js
const store = {
    currentUser: null,
    chats: [],
    activeChatId: null,
    activeChatDetails: null,
    messages: {}, // Objekt: { chatId1: [msg1, msg2], chatId2: [...] }
    userChatSettings: {}, // { chatId1: {isMuted: false}, ... }
    searchResults: [],
    ui: { // Für UI-Zustände, die nicht direkt Serverdaten sind
        isModalOpen: false,
        currentOpenModalId: null,
        isLoadingMessages: false,
        isLoadingChats: false,
    }
};

function setCurrentUser(userData) {
    console.log('[Store] setCurrentUser:', userData ? userData.username : null);
    store.currentUser = userData;
    if (window.ui && ui.updateUserInfoHeader) ui.updateUserInfoHeader(); // ui ist global, window.ui ist ok, aber ui direkt auch
}

function setChats(chatData) {
    console.log('[Store] setChats, Anzahl:', chatData ? chatData.length : 0);
    // Sortiere Chats nach dem letzten Update (neueste zuerst)
    store.chats = chatData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    chatData.forEach(chat => {
        if (!store.userChatSettings[chat._id]) store.userChatSettings[chat._id] = {};
        // Nimm den Mute-Status vom Server, falls vorhanden, sonst default auf false
        store.userChatSettings[chat._id].isMuted = chat.isMuted || false;
    });
    if (ui && typeof ui.renderChatList === 'function') { // Direkte Prüfung auf ui
        ui.renderChatList();
    } else {
        console.warn(`[Store] setChats: ui.renderChatList nicht gefunden oder ui nicht definiert. ui: ${typeof ui}, ui.renderChatList: ${typeof ui?.renderChatList}`);
    }
}

function addOrUpdateChatInStore(chatObject) {
    console.log('[Store] addOrUpdateChatInStore:', chatObject?._id, chatObject?.name);
    const existingChatIndex = store.chats.findIndex(c => c._id.toString() === chatObject._id.toString());
    if (existingChatIndex > -1) {
        store.chats[existingChatIndex] = { ...store.chats[existingChatIndex], ...chatObject };
    } else {
        store.chats.push(chatObject);
    }
    store.chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (ui && typeof ui.renderChatList === 'function') { // Direkte Prüfung auf ui
        ui.renderChatList();
    } else {
        console.warn(`[Store] addOrUpdateChatInStore: ui.renderChatList nicht gefunden. ui: ${typeof ui}, ui.renderChatList: ${typeof ui?.renderChatList}`);
    }
}

function setMessagesForChat(chatId, messagesArray, replace = true) { // messagesArray sind die vom Server
    console.log(`[Store] setMessagesForChat ${chatId} (Typ: ${typeof chatId}), Anzahl: ${messagesArray.length}, Replace: ${replace}`);
    const storeChatIdStr = chatId?.toString(); // Sicherstellen, dass es ein String ist für den Zugriff auf store.messages

    if (replace || !store.messages[storeChatIdStr]) {
        store.messages[storeChatIdStr] = messagesArray.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else {
        const currentMessageIds = new Set(store.messages[storeChatIdStr].map(m => m._id));
        messagesArray.forEach(msg => {
            if (!currentMessageIds.has(msg._id)) {
                store.messages[storeChatIdStr].push(msg);
            }
        });
        store.messages[storeChatIdStr].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    const isActiveChat = store.activeChatId?.toString() === storeChatIdStr;
    console.log(`[Store] setMessagesForChat - Nach Store-Update - TYP activeChatId: ${typeof store.activeChatId}, Wert: "${store.activeChatId}"`);
    console.log(`[Store] setMessagesForChat - Nach Store-Update - TYP storeChatIdStr (key): ${typeof storeChatIdStr}, Wert: "${storeChatIdStr}"`);
    console.log(`[Store] setMessagesForChat - Nach Store-Update - Vergleich (isActiveChat): ${isActiveChat}`);


    if (isActiveChat && ui && typeof ui.displayMessages === 'function') {
        console.log(`[Store] BEDINGUNG ERFÜLLT für Aufruf von ui.displayMessages. activeChatId: ${store.activeChatId}, Ziel-ChatId: ${storeChatIdStr}`);
        ui.displayMessages(storeChatIdStr, store.messages[storeChatIdStr], replace); // 'replace' wird als 'initialLoad' interpretiert
    } else {
        if (!isActiveChat) {
            console.warn(`[Store] setMessagesForChat: Aktueller Chat ${store.activeChatId} ist nicht der Ziel-Chat ${storeChatIdStr}. ui.displayMessages nicht aufgerufen.`);
        }
        if (!ui || typeof ui.displayMessages !== 'function') {
            console.warn(`[Store] setMessagesForChat: ui.displayMessages ist nicht verfügbar oder ui nicht definiert. ui: ${typeof ui}, ui.displayMessages: ${typeof ui?.displayMessages}`);
        }
    }
}

function addMessageToStore(chatId, message) {
    const storeChatIdStr = chatId?.toString();
    const currentUserIdStr = store.currentUser?.userId?.toString();

    console.log(`[Store] addMessageToStore für Chat ${storeChatIdStr} (Typ: ${typeof storeChatIdStr}), Nachricht: "${message.content.substring(0, 20)}..."`);

    if (!store.messages[storeChatIdStr]) {
        store.messages[storeChatIdStr] = [];
    }

    if (!store.messages[storeChatIdStr].find(m => m._id.toString() === message._id.toString())) {
        store.messages[storeChatIdStr].push(message);
        store.messages[storeChatIdStr].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const isActiveChat = store.activeChatId?.toString() === storeChatIdStr;
        console.log(`[Store] addMessageToStore - TYP activeChatId: ${typeof store.activeChatId}, Wert: "${store.activeChatId}"`);
        console.log(`[Store] addMessageToStore - TYP storeChatIdStr (key): ${typeof storeChatIdStr}, Wert: "${storeChatIdStr}"`);
        console.log(`[Store] addMessageToStore - Vergleich (isActiveChat): ${isActiveChat}`);

        if (isActiveChat && ui && typeof ui.renderSingleMessage === 'function') {
            console.log(`[Store] addMessageToStore: Aktiver Chat ${storeChatIdStr} stimmt überein. Rufe ui.renderSingleMessage.`);
            ui.renderSingleMessage(message, currentUserIdStr);
        } else {
            if (!isActiveChat) {
                console.warn(`[Store] addMessageToStore: Nachricht für Chat ${storeChatIdStr}, aber aktiver Chat ist ${store.activeChatId}. Kein direktes UI-Update für Nachrichtenliste.`);
            }
            if (!ui || typeof ui.renderSingleMessage !== 'function') {
                console.warn(`[Store] addMessageToStore: ui.renderSingleMessage ist nicht verfügbar. ui: ${typeof ui}, ui.renderSingleMessage: ${typeof ui?.renderSingleMessage}`);
            }
        }
    } else {
        console.log(`[Store] addMessageToStore: Nachricht ${message._id} bereits im Store für Chat ${storeChatIdStr}. Überspringe Duplikat.`);
    }

    const chatIndex = store.chats.findIndex(c => c._id.toString() === storeChatIdStr);
    if (chatIndex > -1) {
        console.log(`[Store] addMessageToStore: Aktualisiere Chat-Vorschau für Chat ${storeChatIdStr} in der Liste.`);
        store.chats[chatIndex].lastMessagePreview = message.content.substring(0, 50);
        store.chats[chatIndex].lastMessageSenderId = message.senderId;
        store.chats[chatIndex].senderUsername = message.senderUsername;
        store.chats[chatIndex].lastMessageTimestamp = message.timestamp;
        store.chats[chatIndex].updatedAt = message.timestamp;

        const oldChatOrderForLogging = store.chats.map(c => c._id).join(',');
        store.chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        const newChatOrderForLogging = store.chats.map(c => c._id).join(',');

        if (ui && typeof ui.renderChatList === 'function') {
            console.log(`[Store] addMessageToStore: Rufe ui.renderChatList auf. Alte Ordnung: ${oldChatOrderForLogging}, Neue Ordnung: ${newChatOrderForLogging}`);
            ui.renderChatList();
        } else {
            console.warn(`[Store] addMessageToStore: ui.renderChatList NICHT gefunden. ui: ${typeof ui}, ui.renderChatList: ${typeof ui?.renderChatList}`);
        }
    } else {
        console.warn(`[Store] addMessageToStore: Chat ${storeChatIdStr} nicht in store.chats gefunden für Vorschau-Update.`);
        if (window.chatService && chatService.fetchChats) { // window.chatService, da chatService global ist
            console.log(`[Store] addMessageToStore: Chat ${storeChatIdStr} nicht in Liste, fordere komplettes Chat-Listen-Update an.`);
            chatService.fetchChats(false);
        }
    }
}

function setActiveChat(chatId) {
    const activeChatIdStr = chatId?.toString();
    console.log('[Store] setActiveChat:', activeChatIdStr);

    store.activeChatId = activeChatIdStr; // Immer als String speichern für Konsistenz

    if (activeChatIdStr) {
        store.activeChatDetails = store.chats.find(c => c._id.toString() === activeChatIdStr) || null;
        console.log('[Store] activeChatDetails:', store.activeChatDetails);
        if (window.chatService) { // chatService ist global
            chatService.startMessagePolling(activeChatIdStr);
        }
    } else {
        store.activeChatDetails = null;
        if (window.chatService) { // chatService ist global
            chatService.stopMessagePolling();
        }
    }

    if (ui && typeof ui.updateActiveChatView === 'function') { // ui ist global
        ui.updateActiveChatView();
    }
}

function updateChatSettingInStore(chatId, settingKey, value) {
    const storeChatIdStr = chatId?.toString();
    console.log(`[Store] updateChatSettingInStore for ${storeChatIdStr}: ${settingKey} = ${value}`);
    if (!store.userChatSettings[storeChatIdStr]) {
        store.userChatSettings[storeChatIdStr] = {};
    }
    store.userChatSettings[storeChatIdStr][settingKey] = value;

    const chatInList = store.chats.find(c => c._id.toString() === storeChatIdStr);
    if (chatInList && settingKey === 'isMuted') {
        chatInList.isMuted = value;
    }
    if (ui && typeof ui.renderChatList === 'function') { // ui ist global
        ui.renderChatList();
    } else {
        console.warn(`[Store] updateChatSettingInStore: ui.renderChatList nicht gefunden. ui: ${typeof ui}, ui.renderChatList: ${typeof ui?.renderChatList}`);
    }
}

function setSearchResults(results) {
    console.log('[Store] setSearchResults, Anzahl:', results.length);
    store.searchResults = results;
    if (ui && typeof ui.renderSearchResults === 'function') { // ui ist global
        ui.renderSearchResults(results);
    } else {
        console.warn(`[Store] setSearchResults: ui.renderSearchResults nicht gefunden. ui: ${typeof ui}, ui.renderSearchResults: ${typeof ui?.renderSearchResults}`);
    }
}

function clearStoreOnLogout() {
    console.log('[Store] clearStoreOnLogout');
    store.currentUser = null;
    store.chats = [];
    store.activeChatId = null;
    store.activeChatDetails = null;
    store.messages = {};
    store.userChatSettings = {};
    store.searchResults = [];
    if (ui) { // ui ist global
        if (ui.renderChatList) ui.renderChatList();
        if (ui.updateActiveChatView) ui.updateActiveChatView();
        if (ui.updateUserInfoHeader) ui.updateUserInfoHeader();
        if (ui.hideElement) ui.hideElement('searchResultsPanel');
    }
}