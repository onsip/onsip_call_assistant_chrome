var pref = OnSIP_Preferences; // alias for the OnSIP_Preferences object
var dblClick = false; // timeout to perform the single-click; canceled if second-click detected
var callInProgress = false; // is there any call in progress?
var callingTab; // the tab that initiated the call
var ajaxRequest;
var ajaxAbort;
var currentCustomer = false;
var stropheConnected = false;

pref.set('boshConnection', false);


var ext = new OnSIP_Process();
ext.init(); // set the initial state of the extension icon (ON/OFF)

// Set up listener for onsip calls
if(pref.get('onsipCredentialsGood')){
    dbg.log('APP :: trigger BOSH connection');
    setRoutineConnection();
}

/**
 * SetBoshConnection
 * renews connection every 20min
 */
function setRoutineConnection(){
    dbg.log('BOSH :: start routine connection');
    if(stropheConnected){
        quitOnSipConnection();
    }
    setUpOnSipListener();
    
    // routine
    setTimeout(function(){
        setRoutineConnection();
    }, 1200000);
}

// Add event listener for clicks on the extension icon
chrome.browserAction.onClicked.addListener(function(TAB) {
	
	// if no double-click detected, start listening
	if ( dblClick === false ) {
		dblClick = setTimeout(function(){
			// if this function got called, than there wasn't a double-click; just toggle the status
			ext.toggle();
			dblClick = false;
		}, 250);
	} else {
	//double-click detected; open the settings page instead of changing the extension's status
		clearTimeout(dblClick);
		dblClick = false;
		chrome.tabs.create({"url" : "index.html"});
	}
});

/**
 * Get Highrise info
 * @param callback
 * @param url
 * @param token
 */
function getHighriseMe(callback, url, token){
    dbg.log('SETTING :: get highrise ME');
    var xhr = new XMLHttpRequest();
    var responseSent = false;
    
    xhr.open('POST', url , true, token, "dummyPassword");
    xhr.onreadystatechange = function(){
        if(xhr.readyState == 4){ 
            if (xhr.status == 200) {
                if(callback){
                    callback.onSuccess(xhr.responseText);
                    responseSent = true;
                    dbg.log('SETTING :: highrise credentials OK');
                }
            } else if (xhr.status == 401) {
                dbg.log('SETTING :: highrise credentials NOT OK');
            } else {
                dbg.log('SETTING :: highrise credentials NOT OK');
            }
        }
    }
    
    xhr.send();
    // Trick to handle incorrect highrise credentials
    setTimeout(function(){sendResponseToValidationRequest();}, 5000 );
    function sendResponseToValidationRequest(){
        if(!responseSent){
            callback.onError();
            dbg.log('SETTING :: highrise credentials NOT OK');
        }
    }
}

// Add listener for requests from the pages
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    
    // Validate highrise url
    if( request.validateHighriseAccount ){
        dbg.log('APP :: check highrise credentials');
        var highriseResult = {};

        getHighriseMe({
            onSuccess : function(data){
                dbg.log('APP :: highrise credentials OK');
                // Send back message to BG-page
                sendResponse({tokenValid : true});
            }, onError : function(){
                dbg.log('APP :: highrise credentials NOT OK');
                // Send back message to BG-page 
                sendResponse({tokenValid : false});
            }},
            request.highriseUrl,
            request.highriseToken
        );
    }

    
    // Set up  connection
    if( request.setUpBoshConnection){
        dbg.log('APP :: set up BOSH on demand');
        if( pref.get('boshConnection') ){
            quitOnSipConnection();
        }
        setRoutineConnection();
    }

	// On load parse request
	if ( request.pageLoad && pref.get('enabled') ) {
		sendResponse({parseDOM : true, fromAddress : pref.get('fromAddress')});
	}
	
	// Open settings page request
	if (request.openSettingsPage) {
		chrome.tabs.create({"url" : "index.html"});
	}
	
	// Cancel call request
	if (request.setupCallCancel) {
		ajaxAbort = true;
		ajaxRequest.abort();
	}

    // Make a Call on request
    if (request.setupCall && pref.get('enabled')) {
        dbg.log('APP :: Call requested');
        if(pref.get('onsipCredentialsGood')){
            if(request.extension != null){
                dbg.log('APP : phoneExtension Set ' + request.extension);
                pref.set('phoneExtension', request.extension);
            }
            dbg.log('APP :: Make Call is called');
            makeCall(sender, request);
        }else{
            // Send the Error message
            var msg = 'Please setup the extension first';
            chrome.tabs.sendRequest(sender.tab.id, {settingsError : true, errorMsg : msg});
        }
    }
});


/**
 * Retrive a Companies from Highrise
 */
function getHighriseCompanies(callback){
    // Look at the companies list first
    url = pref.get('highriseUrl') + '/companies.xml';
    $.ajax({
        type    : 'GET',
        url     : url,
        success : function(data, status, xhr){
            callback.onSuccess(data);
        },
        username: pref.get('highriseToken'),
        password: 'X'
    });
}

/**
 * Retract a Contacts from Highrise
 */
function getHighriseContacts( callback ){
    url = pref.get('highriseUrl') + '/people.xml';
    $.ajax({
        type    : 'GET',
        url     : url,
        success : function(data, status, xhr){
            callback.onSuccess(data);
        },
        username: pref.get('highriseToken'),
        password: 'X'
    });
}

/**
 *  Call With Highrise
 *  extracted for cleanliness
 */
function makeCall(sender, request){
    dbg.log('APP :: CALL INPROGRESS is ' + callInProgress);
    if ( !callInProgress ) {
        callInProgress = true;
        callingTab = sender.tab.id;

        var fromAddress = pref.get('fromAddress');
        var toAddress = '';
        console.log(request.phoneNo);
        if(isNumberFormatted(request.phoneNo)){
            toAddress = request.phoneNo;
        }else{
            toAddress = request.phoneNo + '@' + getDomain(fromAddress);
        }

        console.log('APP :: CALL TO' + toAddress);

//        var params = {from : fromAddress, to : toAddress}
//        OnsipApp.OX.createCall(params);
        dbg.log('APP :: CALLING REST');
        ajaxRequest = $.ajax({
            url		: pref.get('apiUrl'),
            data	: {
                            'Action'		: pref.get('apiAction'),
                            'FromAddress'	: fromAddress,
                            'ToAddress'		: toAddress,
                            'Output'		: 'json'
                        },
            dataType: 'json',
            //timeout	: pref.get('apiTimeout'),
            success	: callSetupSuccess,
            error	: callSetupError,
            complete: callSetupComplete
        });
    }
}

/**
 *  Add Note to customers profile on highrise
 */
function addNoteToHighriseCustomerProfile(customer, note){
  
    dbg.log('APP :: add note >>> highrise ');
 
    var url = pref.get('highriseUrl') +"/" +customer.type+ "/"+ customer.id +"/notes.xml";
    
    $.ajax({
        type: "POST",
        url : url,
        data: note,
        username: pref.get('highriseToken'),
        password: 'X',
        contentType : 'application/xml',
        success: function(){
            dbg.log('APP :: addNoteToHighriseCustomerProfile SUCCESS');
        },
        error: function(xhr, status){
            dbg.log('APP :: addNoteToHighriseCustomerProfile ERROR');
        }
    });
}

/**
 * Call setUp Success
 */
function callSetupSuccess(data, status, xhr) {
	
	if (ajaxAbort) {
		ajaxAbort = false;
		return;
	}
	
	var msg;
	if (xhr.status != 200) {
		if (xhr.status == 404) {
			msg = 'OnSIP Request Error: server returned a 404 (Not Found) error.';
		}
		else {
			msg = 'OnSIP Network Error: Are you disconnected from the network?';
		}
		
		chrome.tabs.sendRequest(callingTab, {
			callError: true,
			errorMsg: msg
		});
		
		return;
	}
	
	try {
		var exception = data.Exception;
		if (exception) {
			var msg = 'OnSIP Exception: ' + exception;
			chrome.tabs.sendRequest(callingTab, {
				callError: true,
				errorMsg: msg
			});
			
			return;
		}
	} catch (E) {
		
	}
	
	var msg = 'OnSIP Request Error: ';
	var fromError = false;
	
	try {
	
		var req = data.Response.Context.Request;
		
		if (req.IsValid == 'true') {
			chrome.tabs.sendRequest(callingTab, {
				callSetupCompleted: true
			});
		} else {

			if (req.Errors) {
				for (i in req.Errors) {
					if ( req.Errors[i].Parameter == 'FromAddress' ) {
						fromError = true;
					}
					
					msg += req.Errors[i].Message + '<br />';
				}
			} else {
				msg += 'response parse error';
			}
			
			chrome.tabs.sendRequest(callingTab, {
				callError: true,
				errorMsg: msg,
				fromAddressError: fromError
			});
		}
	} catch (E) {
		msg += 'response parse error';
		chrome.tabs.sendRequest(callingTab, {
			callError: true,
			errorMsg: msg
		});
	}
}


/**
 * Call Setup Error Catching
 */
function callSetupError(xhr, status) {
	var msg;
	
	try {
		if ( xhr.status == 404 ) {
			msg = 'OnSIP Request Error: server returned a 404 (Not Found) error.';
		}
	} catch (E) {
		msg = 'OnSIP Request Timeout: timeout trying to setup call. Did you pickup your phone when it rang?';
	}

	///chrome.tabs.sendRequest(callingTab, {callError : true, errorMsg : msg});
}

/**
 * Call complete
 */
function callSetupComplete(xhr, status) {
	callingTab = null;
	callInProgress = false;
}

/**
 * Setup Onsip Listener
 */
function setUpOnSipListener(){
    stropheConnected = true;
    var aForm = {};
    aForm.http_base = {value : pref.get('onsipHttpBase')};
    aForm.server    = {value : pref.get('onsipServer')};
    aForm.username  = {value : pref.get('fromAddress')};
    aForm.password  = {value : pref.get('onsipPassword')};

 
    OnsipApp.Strophe.init();
    OnsipApp.Strophe.doLogin(aForm);
}

/**
 * Quit  BOSH Connection
 */
function quitOnSipConnection(){
    OnsipApp.Strophe.quit();
}
