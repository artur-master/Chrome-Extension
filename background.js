var ajaxurlpagepath = "http://popposts.com/dashboard/lmaffiliate/api/";
var BASE_URL = "https://office.legendarymarketer.com/affiliate/members/export?product=&subscription=&customize=&from=&to=";
var LEADS_URL = "https://office.legendarymarketer.com/affiliate/leads/export?funnel=&tag=&customize=&from=&to=";
// var LOGIN_URL = "office.legendarymarketer.com/login";

var DEFAULT_TIME_INTERVAL = 60;
var debug_flag = 1;      // debug mode: 1, active: 0
var customFieldId = null;

var isActive = false;
var timeInterval = 0;
var apiType="none", apiUrl="", apiKey="";
// var api_url="https://digitbit865.api-us1.com", api_key="032f4af92d61f7f83c364e549f4eb7a5f80a63bc2ccb5795068d0165f6d85e4f7c78144b";
var accountsList = [];
var lastRunTime = 0;

var acNamesList = [];

var lastState = { popupName:"loading" };

var valuesOfSheet = {};
var newRowsOfSheetNumber = {};

chrome.storage.local.get({"email": ""}, function (res) {
    if(res.email === "") lastState = { popupName:"login" }
    else onActiveLogin(res.email, false);
});

function onActiveLogin (email, saveEmail=true) {
    return (
        fetch(ajaxurlpagepath + "usersinput.php",{email: email}).then(response=>{
            if(response.status == 200) {
                if (saveEmail) chrome.storage.local.set({ "email": email });
                
                return getSavedData();
            }
            return {status: false, error: "Invalid login info."}
        }).catch(error=>{                
            return {status: false, error: error}
        })
    );
}

function getSavedData() {
    return new Promise(resolve=>{
        chrome.storage.local.get({
            isActive:false,
            timeInterval:0,
            apiType:"none", 
            apiUrl:"",
            apiKey:"",
            accountsList:[],
        }, function(res){
            saveData(res, false);

            checkState(true).then(state=>{
                lastState = state;
                resolve( {status: true, data: lastState} );
            });
        });
    })
}

function getLastState(){
    return lastState;
}

function saveLastState(state){
    lastState = state;
}

function saveData(data, saveStore=true) {    
    isActive = data.isActive;
    timeInterval = data.timeInterval;
    apiType = data.apiType;
    apiUrl = data.apiUrl;
    apiKey = data.apiKey;
    accountsList = data.accountsList;
    
    if(saveStore){
        chrome.storage.local.set({isActive, timeInterval, apiType, apiUrl, apiKey, accountsList});
    }
}

function allTimersClear() {
    window.originalSetTimeout = window.setTimeout;
    window.originalClearTimeout = window.clearTimeout;
    window.activeTimers = 0;

    // window.setTimeout = function(func, delay) {
    //     window.activeTimers++;
    //     console.log(window.activeTimers, "1");
    //     return window.originalSetTimeout(func, delay);
    // };

    window.clearTimeout = function(timerID) {
        window.activeTimers--;
        console.log(window.activeTimers, "2");
        window.originalClearTimeout(timerID);
    };

    return window.activeTimers;
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
}

function saveSpreadSheet(res, account){
    chrome.identity.getAuthToken({ interactive: true }, function (token) {
        var spreadsheetId = convertUrlToSheetId(account.gsheet.url);
        
        async function insertNewRows(table) {
            var init = {headers: {Authorization: `Bearer ${token}`}}
            return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(account.gsheet.title)}`,init)
                   .then(resp=>resp.json()).then(data=>{

                var lastSheetRow = data.values.length; 
                
                let requests = [
                    {
                        "pasteData": {
                            "coordinate": { "sheetId": account.gsheet.id, "rowIndex": lastSheetRow, "columnIndex": 0 },
                            "data": table,
                            "type": "PASTE_NORMAL",
                            "html": true
                        }
                    },
                    {
                        "autoResizeDimensions": {
                            "dimensions": { "sheetId": account.gsheet.id, "dimension": "COLUMNS", "startIndex": 0, "endIndex": 10}
                        }
                    }
                ];
    
                let params = {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
                    body: JSON.stringify({"requests":requests}),
                    contentType: 'json'
                };
    
                return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, params);
            });

        }
        // update rows
        function updateRows(updatedRows) {
            let body = {
                "valueInputOption": "RAW",
                "includeValuesInResponse": false,
                "responseValueRenderOption": "FORMATTED_VALUE",
                "data": updatedRows
            };
            let init = {
                method: 'POST',
                headers: {'Authorization': `Bearer ${token}`,'Content-Type': 'application/json'},
                body: JSON.stringify(body),
                contentType: 'json'
            };
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, init)
        }

        if(res.table !== "<table></table>"){
            await insertNewRows(res.table);
        }
        if(res.updatedRows.length > 0){
            updateRows(res.updatedRows);
        }
    });
}

async function startWorking(loop) {
    await asyncForEach(accountsList, (account)=>{
        if(account.checked){
            setTimeout(() => {
                getSpreadSheet(account.gsheet.url).then(res=>{
                    if(res.status) {
                        account.gsheet.id = res.data.id;
                        account.gsheet.title = res.data.title;
                        getPromoterList(account, 1, "<table>", []).then(res=>{
                            saveSpreadSheet(res, account);
                        });
                    }
                });
            }, 0);
        }
    });

    if(loop){
        await asyncForEach(accountsList, (account)=>{
            if(account.checked){
                setTimeout(() => {
                    getSpreadSheet(account.gsheet.url).then(res=>{
                        if(res.status) {
                            account.gsheet.id = res.data.id;
                            account.gsheet.title = res.data.title;
                            getPromoterList(account, 1, "<table>", []).then(res=>{
                                saveSpreadSheet(res, account);
                            });
                        }
                    });
                }, timeInterval * 60 * 1000);
            }
        });
    }
}

async function checkState(loop=false){
    var listChecked = false;
    if(apiType !== "none" && apiUrl !== "" && apiKey !== ""){
        listChecked = await setACNamesList(apiUrl, apiKey);
        customFieldId = await getCustomFieldId();
    }
    
    await asyncForEach(accountsList, async (account)=>{
        let res = await checkPromterAccount(account.name);
        account.status = (res.status == 200) ? "Ok" : "Failed";
    });

    if( allTimersClear() == 0) startWorking(loop);

    lastRunTime = new Date();
    
    return ({popupName:"main",isActive, timeInterval, apiType, apiUrl, apiKey, accountsList, lastRunTime});
}

function getACListnNames(){
    return acNamesList;
}

function setACNamesList(url, key){
    acNamesList = [];
    return fetch(`${url}/api/3/lists`,{
        method: 'GET',
        headers: {'Api-Token': key,'Accept': '*\/*'},
        contentType: 'json'
    }).then(response => response.json()).then(re => {
        re.lists.forEach(({id, name})=>{
            acNamesList.push({id, name});
        });
        
        return true;
    }).catch(()=>{
        alert("Please type real API_KEY or API_URL");
        return false;
    });
}

async function getCustomFieldId(){
    var body = { "type": "text","title": "FP_status", "descript": "FP_status","isrequired": 0, "perstag": "FP_status", "defval": "",  "visible": 1, "ordernum": 1 }
    let re = await fetch(`${apiUrl}/api/3/fields`, {method: 'POST', headers: {'Api-Token': apiKey, 'Accept': '*\/*'}, body: JSON.stringify({"field": body}), contentType: 'json'})

    switch(re.status){
        case 201:
            return await re.json().then(res=>(res.field.id));
        case 422:
            let getRe = await fetch(`${apiUrl}/api/3/fields?filters[title]=FP_status`, {headers: {'Api-Token': apiKey,'Accept': '*\/*' }, contentType: 'json'})
                              .then(re=>re.json());
            return getRe.fields[0].id;
        default:
            return null;
    }    
}

async function refreshACNamesList(){
    await setACNamesList(apiUrl, apiKey);
    return acNamesList;
}

function convertUrlToSheetId(sheetUrl) {
    return sheetUrl.match(/spreadsheets\/d\/([a-z0-9_-]{40,})/i)[1];    
}

function getSpreadSheet(sheetUrl) {
    var arr = sheetUrl.match(/spreadsheets\/d\/([a-z0-9_-]{40,})/i);
    return new Promise(resolve=>{
        if (arr == null || arr.length<1) resolve({status:false, error: "Wrong Sheets URL"});

        var spreadsheetId = arr[1];
    
        chrome.identity.getAuthToken({ interactive: true }, function (token) {
            var init = {headers: {Authorization: `Bearer ${token}`}}
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, init)
            .then(response => response.json()).then(data => {
                if (data.error && data.error.message) {
                    resolve({status: false, error: data.error.message});
                } else {
                    var properties = data.sheets.find(sheet=> sheet.properties.id !== 0);
                    // data.values
                    if(properties){
                        properties = properties.properties;
                        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(properties.title)}`,init)
                        .then(resp=>resp.json()).then(data=>{
                            valuesOfSheet[spreadsheetId] = data.values; //Array(Array(3))
                            // rowsOfSheet[spreadsheetId] = data.values;

                            resolve({status: true, data:{ id: properties.sheetId, title: properties.title }});
                        });
                    }
                    else resolve({status: false, error: "Empty sheet"});
                }
            });
        });
    });    
}

function checkPromterAccount(account){
    return fetch(`https://${account}.firstpromoter.com/`);
}

async function saveToActiveCompain(email, date, state, account){
    function getContactFieldId(email){
        return fetch(`${apiUrl}/api/3/contact/sync`, {method: 'POST', headers: {'Api-Token': apiKey, 'Accept': '*\/*'}, body: JSON.stringify({"contact":{email:email}}), contentType: 'json'})
               .then(response => response.json()).then(res=>res.contact.id);
    }
    
    function contactToList(contactId, listId) {
        let contactList = {"list": listId, "contact": contactId,"status": 1}    
        fetch(`${apiUrl}/api/3/contactLists`, {
                method: 'POST',
                headers: {'Api-Token': apiKey, 'Accept': '*\/*'},
                body: JSON.stringify({"contactList":contactList}),
                contentType: 'json'
            });
    }

    let contactFieldId = await getContactFieldId(email);

    contactToList(contactFieldId, account.list);
    
    let fieldValue = { "contact": contactFieldId,"field": customFieldId, "value":state}

    return fetch(`${apiUrl}/api/3/fieldValues`, {
            method: 'POST',
            headers: {'Api-Token': apiKey, 'Accept': '*\/*'},
            body: JSON.stringify({"fieldValue":fieldValue}),
            contentType: 'json'
        });
}

function getPromoterList(account, page, table, updatedRows){
    var url = `https://${account.name}.firstpromoter.com/my-leads?page=${page}`;
    
    return fetch(url).then(res=>res.text()).then(async (response) => {
        let doms = $(response).find("tr[data-id]");
        
        if(doms.length == 0){
            table += "</table>";
            return {table, updatedRows};
        } else {
            var spreadSheetId = convertUrlToSheetId(account.gsheet.url);
            var myValueOfSheet = valuesOfSheet[spreadSheetId];
            await asyncForEach(doms, async (dom)=>{
                let email = $(dom).find('.col-email')[0];
                let date = $(dom).find('.col-created')[0];
                let state = $(dom).find('.col-customer-since')[0];
                email = $(email).text().trim();
                date = $(date).text().trim();
                state = $(state).text().trim();

                var index = myValueOfSheet.findIndex((value)=>value[0]===email);
                if(index > -1){
                    if(myValueOfSheet[index][2] !== state){
                        myValueOfSheet[index][2] = state;
                        updatedRows.push({
                            "range": `A${index+1}:G${index+1}`,
                            "majorDimension": "ROWS",
                            "values": [email, date, state]
                        });

                        if(apiType !== "none") await saveToActiveCompain(email, date, state, account);
                    }
                } else {
                    myValueOfSheet.push([email, date, state]);

                    table += `<tr>
                                <td style='border-right:1px solid black'>${email}</td>
                                <td style='border-right:1px solid black'>${date}</td>
                                <td style='border-right:1px solid black'>${state}</td>
                            </tr>`;
                    
                    if(apiType !== "none") await saveToActiveCompain(email, date, state, account);
                }
            });

            return getPromoterList(account, page+1, table, updatedRows);
        }
    });
}

function erorfunction() {
    chrome.browserAction.setBadgeBackgroundColor({ color: [204, 39, 25, 255] });
    chrome.browserAction.setBadgeText({ text: "X" });
}