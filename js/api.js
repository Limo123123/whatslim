// js/api.js
const BASE_URL = 'https://api.limazon.v6.rocks/api'; // Dein API-Basispfad

async function request(endpoint, method = 'GET', data = null, requiresAuth = true) {
    console.log(`[API Request] ${method} ${BASE_URL}${endpoint}`, data || ''); // Log Request

    const config = {
        method: method,
        headers: {},
    };

    if (data) {
        config.body = JSON.stringify(data);
        config.headers['Content-Type'] = 'application/json';
    }

    config.credentials = 'include'; // Wichtig für Sessions/Cookies

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, config);
        let responseData;
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            responseData = await response.json();
        } else {
            const responseText = await response.text();
            responseData = {
                error: `Server sendete keine JSON-Antwort. Status: ${response.status}`,
                _nonJsonText: responseText
            };
            // Wenn der Status OK war, aber kein JSON kam (z.B. für Logout, das nur Text sendet)
            // dann ist es kein "Fehler" im Sinne von response.ok, aber wir wollen den Text.
            if (response.ok && !contentType) { // response.ok und kein Content-Type -> oft leere Antwort
                console.warn(`[API Response] ${method} ${BASE_URL}${endpoint} - Status: ${response.status} - Leere oder Nicht-JSON Antwort.`);
                return { message: "Aktion erfolgreich (kein JSON-Inhalt).", _nonJsonText: responseText }; // Für Logout etc.
            }
        }

        console.log(`[API Response] ${method} ${BASE_URL}${endpoint} - Status: ${response.status}`, responseData); // Log Response

        if (!response.ok) {
            const error = new Error(responseData.error || `HTTP error! status: ${response.status}`);
            error.data = responseData;
            error.status = response.status;
            throw error;
        }
        return responseData;
    } catch (err) {
        console.error(`[API CATCH] Fehler bei ${method} ${BASE_URL}${endpoint}:`, err.message, err.data || '');
        if (err.data && err.data._nonJsonText) {
            console.error("Non-JSON response text:", err.data._nonJsonText.substring(0, 500));
        }
        throw err;
    }
}