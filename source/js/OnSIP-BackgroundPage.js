var pref = OnSIP_Preferences; // alias for the OnSIP_Preferences object
var dblClick = false; // timeout to perform the single-click; canceled if second-click detected
var callInProgress = false; // is there any call in progress?
var callingTab; // the tab that initiated the call
var ajaxRequest;
var ajaxAbort;

var ext = new OnSIP_Process();
ext.init(); // set the initial state of the extension icon (ON/OFF)

// add event listener for clicks on the extension icon 
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

// add listener for requests from the pages
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
	// on load parse request
	if ( request.pageLoad && pref.get('enabled') ) {
		sendResponse({parseDOM : true, fromAddress : pref.get('fromAddress')});
	}
	
	// open settings page request
	if (request.openSettingsPage) {
		chrome.tabs.create({"url" : "index.html"});
	}
	
	// cancel call request
	if (request.setupCallCancel) {
		ajaxAbort = true;
		ajaxRequest.abort();
	}
	
	// setup call request
	if (request.setupCall && pref.get('enabled')) {
		sendResponse({callInProgress : callInProgress});
			
		if ( !callInProgress ) {
			callInProgress = true;
			callingTab = sender.tab.id;
			
			var fromAddress = pref.get('fromAddress');
			var toAddress = request.phoneNo + '@' + getDomain(fromAddress);
			
			ajaxRequest = $.ajax({
				url		: pref.get('apiUrl'),
				data	: {
								'Action'		: pref.get('apiAction'),
								'FromAddress'	: fromAddress,
								'ToAddress'		: toAddress,
								'Output'		: 'json'
							},
				dataType: 'json',
				timeout	: pref.get('apiTimeout'),
				success	: callSetupSuccess,
				error	: callSetupError,
				complete: callSetupComplete,
			});
		}
	}
});

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

function callSetupError(xhr, status) {
	var msg;
	
	try {
		if ( xhr.status == 404 ) {
			msg = 'OnSIP Request Error: server returned a 404 (Not Found) error.';
		}
	} catch (E) {
		msg = 'OnSIP Request Timeout: timeout trying to setup call. Did you pickup your phone when it rang?';
	}

	chrome.tabs.sendRequest(callingTab, {callError : true, errorMsg : msg});
}

function callSetupComplete(xhr, status) {
	callingTab = null;
	callInProgress = false;
}