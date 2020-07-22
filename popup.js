var backgroundPage = chrome.extension.getBackgroundPage();

var accountsList, lastRunTime;

var popupName = "login";
var api_type = "none";
var editAccount;

var states = {};

function validEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
};
// onLoad
window.onload = function() 
{
    $("#login_action").on("click", async function(){
        $("#login_data_err").hide();

        var email = $("#login_mail").val().trim().replace(/['"]+/g, '');

        if (!validEmail(email)) {
            $("#login_data_err").show(); 
            $("#login_data_err").html("Invalid email address.");
            return;
        }

        $("#login_action").prop('value', "Activating App...");        
        $("#login_action").prop('disabled', true);

        var result = await backgroundPage.onActiveLogin(email, true);
        
        $("#login_action").prop('value', "Activate App");
        if(result.state){
            states = result.data;
            showMainModal();
        }
        else{
            $("#login_data_err").show();
            $("#login_data_err").html(result.text);
        }
    });

    $("#save_btn").on("click", function(){
        $("#check_now").prop("disabled", false);
        var active = $("#active").prop( "checked");
        var interval = $("#time_interval").val() || 0;
        api_type = $("#api_type").val();
        var api_url="", api_key="";
        if(api_type == "ac"){
            api_url = $("#api_url").val(); 
            api_key = $("#api_key").val();
        }

        backgroundPage.saveData({
            isActive: active,
            timeInterval:interval,
            apiType: api_type,
            apiUrl: api_url,
            apiKey: api_key,
            accountsList: accountsList
        });
    });

    $("#check_now").on("click", function(){
        api_type = $("#api_type").val();
        var api_url="", api_key="";
        if(api_type == "ac"){
            api_url = $("#api_url").val(); 
            api_key = $("#api_key").val();
        }

        $("#check_now").val("Checking...");
        $("#check_now").prop("disabled", true);
        $("#save_btn").prop("disabled", true);
        backgroundPage.checkState().then(res=>{
            states = res;
            $("#check_now").val("Check Now");
            showMainModal();
        });
    });

    $("#api_type").on("change", function(event){
        api_type = event.target.value;
        $('.apirow').css('display', api_type === "none"?'none':'block');        
    });

    $("#add_account").on("click", function(){
        var mainState = getCurrentState();
        popupName = "add";
        editAccount = -1;
        states = {popupName, mainState}

        $("#no_logged_in").hide();
        showAddEditModal();
    });

    $("body").on("click", ".edit-account", function(){
        var mainState = getCurrentState();
        popupName = "edit";        
        editAccount = parseInt($(this).attr("id").replace("edit_", ""), 10);
        var acc = accountsList[editAccount];
        states = {
            popupName, mainState,
            account_name:acc.name,
            gsheet_url: acc.gsheet.url,
            contact_list: acc.list
        }

        $("#no_logged_in").hide();
        showAddEditModal();
    });

    $("body").on("click", ".delete-account", function(){
        var num = parseInt($(this).attr("id").replace("del_", ""), 10);
        if(confirm("Will you really remove this account?")){
            accountsList.splice(num, 1);
            showMainModal();
        }        
    });
    
    $("body").on("change", ".check-account", function(event){
        editAccount = parseInt($(this).attr("id").replace("check_", ""), 10);
        accountsList[editAccount].checked = event.currentTarget.checked;
        if (accountsList[editAccount].status !== "New ") accountsList[editAccount].status = "Updated";
        
        showMainModal();
    });

    $("#save_account").on('click', function(){
        var account_name = $("#account_name").val().trim();
        var gsheet_url = $("#gsheet_url").val().trim();
        var ac_list = $("#contact_list").val();
        
        var invalid = false;
        $("#account_name_err").hide(); $("#google_sheet_err").hide();
        if(account_name.trim() == ""){
            invalid = true; 
            $("#account_name_err").show();
            $("#account_name_err").text("Please add your account name.");
        }
        if(gsheet_url.trim() == ""){
            invalid = true; 
            $("#google_sheet_err").show();
            $("#google_sheet_err").text("Please add google sheet url.");
        }
        if(ac_list == null){
            invalid = true;
            alert("please select AC list");
        }

        if(invalid) return;
        $("#save_account").val("Saving...");
        $("#save_account").prop('disabled', true);
        backgroundPage.getSpreadSheet(gsheet_url).then(result=>{
            if(!result.status){
                alert("wrong google sheet url. please try again");
                $("#save_account").val("Save");
                $("#save_account").prop('disabled', false);
                return;
            }

            backgroundPage.checkPromterAccount(account_name).then(res => {                
                var newAccount = {
                    name: account_name,
                    gsheet: {url: gsheet_url, ...result.data},
                    list: ac_list,
                    checked: false,
                    status: res.status == 200 ? "Ok" : "Failed"
                }
                if(editAccount == -1){
                    backgroundPage.console.log(accountsList);
                    accountsList.push(newAccount);
                }
                else{
                    newAccount.checked = accountsList[editAccount].checked;
                    accountsList[editAccount] = newAccount;
                }
    
                popupName = "main";
                states = states.mainState;
                states.accountsList = accountsList;
                $("#save_account").val("Save");
                $("#save_account").prop('disabled', false);
                showMainModal();
            });

        });
    });

    $("#back_btn").on('click', function(){
        popupName = "main";
        states = states.mainState;
        showMainModal();
    });

    $("#contact_refresh").on('click', function(){
        $("#contact_list").empty().append('<option value="0" disabled>Please choose a list</option>');
        $("#contact_refresh").hide();
        backgroundPage.refreshACNamesList().then(res=>{
            $("#contact_refresh").show();
            $("#contact_list").append(
                (res || []).map(({id, name})=>`<option value="${id}">${name}</option>`)
            );
            $("#contact_list").val(0);
        });
    });

    function showMainModal(){
        $("#no_logged_in").show();
        $("#account_modal").hide();
        $("#check_now").prop("disabled", true);
        $("#save_btn").prop("disabled", false);

        lastRunTime = states.lastRunTime;
        $("#last_checked").html(lastRunTime.toLocaleString("en-US"));
        $("#active").prop( "checked", states.isActive );
        $("#time_interval").val( states.timeInterval );
        $("#api_type").val( states.apiType || "none" );
        $("#api_key").val( states.apiKey || "" );
        $("#api_url").val( states.apiUrl || "" );
        $("#api_type").change();

        accountsList = states.accountsList;
        $("#account_list").empty();
        $.each(accountsList, function(key,val){
            var checked = val.checked ? "checked":"";
            $("#account_list").append(
                `<div class="row d-flex mt-1"> \
                    <div class="col-70 d-flex align-items-center"> \
                        <input type="checkbox" id="check_${key}" ${checked} class="check-account"> \
                        <label for="check_${key}">${val.name}</label> \
                    </div> \
                    <div class="col-20 d-flex align-items-center"> \
                        <label>(${val.status})</label> \
                    </div> \
                    <div class="col-10 d-flex align-items-center"> \
                        <label class="edit-account" id="edit_${key}">Edit</label> \
                    </div> \
                    <div class="col-10 d-flex align-items-center"> \
                        <label class="delete-account" id="del_${key}">Del</label> \
                    </div> \
                </div>`
            );
        });
    }

    function showAddEditModal(){
        accountsList = states.mainState.accountsList;
        $("#account_modal").show();
        $("#add_edit_label").text(popupName === "add"?"Add Account":"Edit Accont");
        $("#account_name").val(states.account_name || "");
        $("#gsheet_url").val(states.gsheet_url || "");

        $("#contact_list").empty().append('<option value="0" disabled>Please choose a list</option>');
        $("#contact_list").append(
            backgroundPage.getACListnNames().map(({id, name})=>`<option value="${id}">${name}</option>`)
        );
        $("#contact_list").val(states.contact_list || 0);
        
        $('#contact_div').css('display', states.mainState.apiType === "none"?'none':'flex');

    }
    
    $("#user_login_wrapper").hide();
    $("#no_logged_in").hide();
    $("#account_modal").hide();

    states = backgroundPage.getLastState();
    
    popupName = states.popupName;
    switch(popupName){
        case "main":
            showMainModal();
            break;
        case "add":
        case "edit":
            editAccount = states.editAccount;
            showAddEditModal();
            break;
        case "loading":
            
            break;
        default:
            $("#user_login_wrapper").show();
    }
}

function getCurrentState(){
    var lastState = {};

    switch(popupName){
        case "main":
            api_type = $("#api_type").val();

            lastState = {
                popupName: "main",
                isActive: $("#active").prop( "checked"),
                timeInterval: $("#time_interval").val(),
                apiType: api_type,
                accountsList, lastRunTime
            }
            if(api_type !== "none"){
                lastState["apiKey"] = $("#api_key").val();
                lastState["apiUrl"] = $("#api_url").val();
            }
            break;
        case "add":
        case "edit":
            lastState = {
                popupName, editAccount,
                apiType: api_type,
                account_name: $("#account_name").val(),
                gsheet_url: $("#gsheet_url").val(),
                contact_list: $("#contact_list").val(),
                mainState: states.mainState
            }
            break;
        default:
            return {popupName};
    }
    
    return lastState;
}

window.onunload = function()
{
    if(popupName == "login") return;
    
    backgroundPage.saveLastState( getCurrentState() );
}