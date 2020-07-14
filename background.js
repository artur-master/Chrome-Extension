var BASE_URL = "https://office.legendarymarketer.com/affiliate/members/export?product=&subscription=&customize=&from=&to=";
var LEADS_URL = "https://office.legendarymarketer.com/affiliate/leads/export?funnel=&tag=&customize=&from=&to=";
var LOGIN_URL = "office.legendarymarketer.com/login";
var DEFAULT_TIME_INTERVAL = 60;
var active = 0;
var currentTabId;
var timer;
var time_interval;
var spreadsheetId, sheetId, sheetName;
var api_type, api_key, api_url;
var customFields = {};
var contactList = [];
var lastRunTime = 0;
var lastSheetWriteTime = 0;
var sheetBusy = false;
var ajaxurlpagepath = "http://popposts.com/dashboard/lmaffiliate/api/";
// LOGIN SCREEN GLOBAL VARS

var windowid = null;
var interval_var = null;
var window_login_open = true;

var returndata1 = null;
var returndata2 = null;

// LOGIN SCREEN GLOBAL VARS
var debug_flag = 1;      // debug mode: 1, active: 0

var isLoged = false;
var lastState = {};
var accountList = {};
/**
 * Handles mesages from front-end
*/
function onActive(email){
    return fetch(ajaxurlpagepath + "usersinput.php",{email: email})
            .then(function(response){
                if(response.status == 200) {
                    isLoged = true;
                    chrome.storage.local.set({ "registerpage": email });
                    lastRunTime = new Date();

                    return {state:true}
                }
                return {state: false, error: "Invalid login info."}
            })
            .catch(function(error){                
                return {state: false, error: error}
            });
}

function saveLastState(state){
    lastState = state;
}

function updateAccountList(list) {
    accountList = list;
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message == null) return;

    if(message.from === "popup"){
        switch(message.action){
            case "get_laststate":
                if(isLoged){
                    sendResponse({
                        isLoged: true,
                        state: lastState,                        
                        accountList: accountList,
                        lastChecked: lastRunTime ? lastRunTime.toLocaleString("en-US") : ""
                    })
                }
                else{
                    chrome.storage.local.get({"registerpage": ""}, function (items) {
                        console.log(items.registerpage);
                        if(items.registerpage === "")
                            sendResponse({isLoged: false});
                        else{
                            isLoged = true;
                            lastState = { popupName: "main",  active: false };
                            sendResponse({
                                isLoged: true,
                                state: lastState,
                                accountList: accountList,
                                lastChecked: lastRunTime ? lastRunTime.toLocaleString("en-US") : ""
                            })
                        }                        
                    });
                }
                return true;
            // case "start":
            //     break;
            default:
                return true;
        }
    }
});

// last time used
function last_time_used() {
    chrome.storage.local.get(["registerpage"], function (result) {
        if (!chrome.runtime.lastError) {
            if (result.registerpage != null && result.registerpage != "" && result.registerpage.length != null && parseInt(result.registerpage.length) > 6) {

            } else {
                return false;
            }
            var emailstring = result.registerpage.trim();
            $.ajax({
                type: "GET",
                url: ajaxurlpagepath + "lastlogin.php",
                encode: false,
                data: {
                    email: emailstring,
                },
                dataType: "json",
                success: function (data) {
                }
            });
        }
    });
}
last_time_used();
setInterval(last_time_used, 43200000);