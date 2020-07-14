var backgroundPage = chrome.extension.getBackgroundPage();
var isLoged = false;
var popupName = "login";
var accountList = {};
var editAccount = "";

function validEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
};

/*
function validApiUrl(url) {
    var pos = url.trim().indexOf('.com');
    if (pos === -1)
        return '';
    else
        return url.substring(0, pos + 5);
}
*/

// onLoad
window.onload = function() 
{
    $("#login_action").on("click", async function () {
        $("#login_data_err").hide();

        if (!validEmail($("#login_mail").val().trim())) {
            $("#login_data_err").show(); 
            $("#login_data_err").html("Invalid email address.");
            return;
        }
        // Allow users to use app.
        var email = $("#login_mail").val().trim().replace(/['"]+/g, '');

        var result = await backgroundPage.onActive(email);
        
        if(result.state){
            $("#user_login_wrapper").hide();
            $("#no_logged_in").show();
            $("#last_checked").html(new Date());
        }
        else{
            $("#login_data_err").show();
            $("#login_data_err").html(result.text);
        }
    });

    $("#api_type").on("change", function (event) {
        var type = event.target.value;
        if (type === "none"){
            $('.apirow').css('display', 'none');
        }
        else{
            $('.apirow').css('display', 'block');
        }
    });

    $("#add_account").on("click", function () {
        popupName = "add";
        editAccount = "";
        $("#no_logged_in").hide();
        $("#account_modal").show();
        $("#add_edit_label").text("Add Account");
    });

    $("body").on("click", ".edit-account", function() {
        popupName = "edit";
        $("#no_logged_in").hide();
        $("#account_modal").show();
        $("#add_edit_label").text("Edit Account");
        editAccount = $(this).attr("id").replace("edit_", "");

        var val = accountList[editAccount];
        $("#account_name").val(editAccount);
        $("#gsheet_url").val(val.url);
        $("#contact_list").val(val.list);
    });
    
    $("body").on("change", ".check-account", function(event) {
        var account_name = $(this).attr("id").replace("check_", "");
        accountList[account_name].checked = event.currentTarget.checked;
        backgroundPage.updateAccountList(accountList);
    });

    $("#account_form").submit(function(event){        
        var account_name = this.account_name.value;
        var gsheet_url = this.gsheet_url.value;
        var contact_list = this.contact_list.value;
        
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
        if(invalid) { event.preventDefault(); return }

        if(editAccount !== "") //edit
            delete accountList[editAccount];

        if(accountList[account_name] === undefined){
            accountList[account_name] = {url: gsheet_url.trim(), list: contact_list, checked: false}
            backgroundPage.updateAccountList(accountList);
            popupName = "main";
        }
        else{
            $("#account_name_err").text("Duplicated account name.");
            $("#account_name_err").show();
            event.preventDefault();
        }
    });

    $("#back_btn").on('click', function(){
        popupName = "main";
        $("#no_logged_in").show();
        $("#account_modal").hide();
    });

    chrome.runtime.sendMessage({ from: "popup", action: "get_laststate" }, function (result) {
        if (chrome.runtime.lastError) return;

        isLoged = result.isLoged;
        if(!isLoged){
            $("#user_login_wrapper").show();
            $("#no_logged_in").hide();
            $("#account_modal").hide();
            return;
        }

        $("#user_login_wrapper").hide();
        var state = result.state;
        popupName = state.popupName;

        switch(popupName){
            case "main":
                $("#no_logged_in").show();
                $("#account_modal").hide();
                $("#last_checked").html(result.lastChecked);
                $("#active").prop( "checked", state.active );
                $("#time_interval").val( state.time_interval );
                $("#api_type").val( state.api_type || "none" );
                $("#api_key").val( state.api_key || "" );
                $("#api_url").val( state.api_url || "" );
                $("#api_type").change();
                accountList = result.accountList;
                $.each(accountList, function(key,val){
                    var checked = val.checked ? "checked":"";
                    $("#account_list").append(
                        `<div class="row d-flex mt-1"> \
                            <div class="col-70 d-flex align-items-center"> \
                                <input type="checkbox" id="check_${key}" ${checked} class="check-account"> \
                                <label for="check_${key}">${key}</label> \
                            </div> \
                            <div class="col-20 d-flex align-items-center"> \
                                <label>(Ok)</label> \
                            </div> \
                            <div class="col-10 d-flex align-items-center"> \
                                <label class="edit-account" id="edit_${key}">Edit</label> \
                            </div> \
                        </div>`
                    );
                });
                break;
            case "add":
                $("#account_modal").show();
                $("#add_edit_label").text("Add Account");
                $("#account_name").val(state.account_name || "");
                $("#gsheet_url").val(state.gsheet_url || "");
                $("#contact_list").val(state.contact_list);
                break;
            case "edit":                
                $("#account_modal").show();
                $("#add_edit_label").text("Edit Account");
                $("#account_name").val(state.account_name || "");
                $("#gsheet_url").val(state.gsheet_url || "");
                $("#contact_list").val(state.contact_list);
                break;
            default:
                return;
        }
    });
}

window.onunload = function()
{
    if(!isLoged) return;

    var lastSate = {};
    switch(popupName){
        case "main":
            var api_type = $("#api_type").val();
            lastSate = {
                popupName: "main",
                active: $("#active").prop( "checked"),
                time_interval: $("#time_interval").val(),
                api_type: api_type
            }
            if(api_type !== "none"){
                lastSate["api_key"] = $("#api_key").val();
                lastSate["api_url"] = $("#api_url").val();
            }
            break;
        case "add":
        case "edit":
            lastSate = {
                popupName: popupName,
                account_name: $("#account_name").val(),
                gsheet_url: $("#gsheet_url").val(),
                contact_list: $("#contact_list").val()
            }
            break;
        default:
            return;
    }

    backgroundPage.saveLastState(lastSate);
}