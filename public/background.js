console.log('ContextStore background loaded');

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('Message from external:', request);
  
  if (request.type === 'SUPABASE_AUTH') {
    chrome.storage.local.set({
      supabase_access_token: request.accessToken,
      supabase_refresh_token: request.refreshToken,
      auth_completed: true
    }, () => {
      console.log('Tokens stored');
      sendResponse({ success: true });
    });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {

    chrome.contextMenus.create({
        id: 'savetoContext',
        title: 'Save to ContextStore',
        contexts: ['selection']
    })
});
console.log('Context Menu Created');

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'saveToContext' && info.selectionText) {
        console.log('Context Menu Clicked, tab:', tab.id);
        
        chrome.tabs.sendMessage(tab.id, {type: 'GET_PAGE_ERRORS'}, (response) => {
            let pageErrors = [];
        })

        if (chrome.runtime.lastError) {
            console.log('Could not get page errors:', chrome.runtime.lastError.message);
        } else if (response && response.errors) {
            pageErrors = response.errors;
            console.log('Got page errors:', pageErrors.length);
        }
        }})

const highlightData = {
    text: info.selectionText,
    url: tab?.url || 'Unknown URL',
    title: tab?.title || 'Untitled Page',
    timestamp: new Date().toISOString(),
    pageErrors: pageErrors
};

chrome.storage.local.set({
    pending_highlight: highlightData.text,
    pending_url: highlightData.url,
    pending_titile: highlightData.title,
    pending_timestamp: highlightData.timestamp,
    pending_errors: highlightData.timestamp
 }, () => {
        console.log('Highlight stored, opening popup');
        // Open popup to let user choose folder
        chrome.action.openPopup();
 });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.type === 'GET_PENDING_HIGHLIGHT') {
            chrome.storage.local.get([
                'pending_highlight',
                'pending_url',
                'pending_title',
                'pending_timestamp',
                'pending_errors'
            ], (result) => {
                console.log('Retrieved pending highlight:', result);
                sendResponse(result);
            });
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
    }
    return true;
});

console.log('ContextStore background script initialized');