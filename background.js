var ajaxurlpagepath = "http://popposts.com/dashboard/lmaffiliate/api/";
var BASE_URL = "https://office.legendarymarketer.com/affiliate/members/export?product=&subscription=&customize=&from=&to=";
var LEADS_URL = "https://office.legendarymarketer.com/affiliate/leads/export?funnel=&tag=&customize=&from=&to=";
var LOGIN_URL = "office.legendarymarketer.com/login";

var DEFAULT_TIME_INTERVAL = 60;
var lastRunTime = 0;
var debug_flag = 1;      // debug mode: 1, active: 0
var active = 0;

var isLoged = false;
var lastState = {};
var accountList = {};

function onActive(email){
    return fetch(ajaxurlpagepath + "usersinput.php",{email: email})
            .then(function(response){
                if(response.status == 200) {
                    chrome.storage.local.set({ "registerpage": email });
                    isLoged = true;
                    lastRunTime = new Date();
                    lastState = { popupName: "main",  active: false };
                    return {
                        state:true, 
                        data:{
                            isLoged: true,
                            state: lastState,                        
                            accountList: accountList,
                            lastChecked: lastRunTime.toLocaleString("en-US")
                        }
                    }
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
                        if(items.registerpage === "")
                            sendResponse({isLoged: false, popupName: "login"});
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