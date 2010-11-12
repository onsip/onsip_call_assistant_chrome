var callInProgress   = false;             // is there any call in progress?
var dblClick         = false;             // timeout to perform the single-click; canceled if second-click detected
var callingTab;                           // the tab that initiated the call
var ajaxRequest;
var ajaxAbort;
var currentCustomer  = false;
var stropheConnected = false;

var pref = OnSIP_Preferences; // alias for the OnSIP_Preferences object
var ext  = null;

// Setup Highrise callback hooks
var HIGHRISE_APP = {
    "notifications" : []
};

HIGHRISE_APP.activeCallCreated   = function ( items ) {
    dbg.log ('HIGHRISE LOG :: Active Call Created');
    var i = 0, item = null, args = null, n = null, phone_num = null;
    for (i = 0; i < items.length; i++) {
	item = items[i];
	//args = 'ds=created&toURI=' + escape(item.toURI);
	//n    = webkitNotifications.createHTMLNotification ('notification.html?' + arg);	
	phone_num = extractPhoneNumber(item.toURI);
	n = webkitNotifications.createNotification ('images/i_calling.png', 'Calling', 
						    'To: ' + (phone_num || 'Unknown'));  
	n.uri   = item.uri.query;	
        n.show();

	this.notifications.push (n);	
    }    
};

HIGHRISE_APP.activeCallRequested = function ( items ) {
    dbg.log ('HIGHRISE LOG :: Active Call Requested');
    var i = 0, item, args = null, n = null;
    for (i = 0;i < items.length; i++) {
	item = items[i];
	//arg = 'ds=requested&fromURI=' + escape (item.fromURI);
        //n   =  webkitNotifications.createHTMLNotification ('notification.html?' + arg);
	phone_num = extractPhoneNumber(item.fromURI);
        n = webkitNotifications.createNotification ('images/i_calling.png', 'Incoming Call', 
						    'From: ' + (phone_num || 'Unknown'));
	n.uri   = item.uri.query;
        n.show();

	this.notifications.push (n);
    }
};

HIGHRISE_APP.activeCallConfirmed = function ( item ) {
   dbg.log ('HIGHRISE LOG :: Active Call Confirmed');
   console.log ('There are ' + this.notifications.length + ' notifications ');
   var i = 0;
   for (i = 0; i < item.length; i += 1) {   
       this._cancelNotifications (item[i].uri.query);
   }
   
};

HIGHRISE_APP.strophe_Connected  = function ( item ) {
    dbg.log ('HIGHRISE LOG :: Stophe Connected');
};

HIGHRISE_APP.activeCallPending   = function ( item ) {
    dbg.log ('HIGHRISE LOG :: Active Call Pending');
};

HIGHRISE_APP.activeCallRetract   = function (itemURI) {
    dbg.log ('HIGHRISE LOG :: Active Call Retracted = ' + this.notifications);
    var i;
    for (i = 0; i < itemURI.length;i += 1) {
       this._cancelNotifications (itemURI[i].query);
    }
};

HIGHRISE_APP._cancelNotifications = function (item) {
    console.log ('There are ' + this.notifications.length + ' notifications ');
    var n = this.notifications.pop();
    var a = [];
    while (n) {	
	if (item === n.uri) {
	    n.cancel();
	} else {
	    a.push (n);
	}
	n = this.notifications.pop();
    }
    this.notifications = a;
    
    //console.log ('toURI : ' + toURI + ' --- fromURI ' + fromURI);
};

OX_EXT.apps = [HIGHRISE_APP];
OX_EXT.init();

// Turn extension ON / OFF
ext = new OnSIP_Process();
ext.init();


/**
var n = '<note><body> Test Note </body></note>';
var customer = {
    type : "people",
    id   : 49406880
};
**/
//HIGHRISE.addNodeToProfile (customer, n);

/**
HIGHRISE.getContact({
	onSuccess : function (res) {
	    console.log ('People found = ' + res.length);
	},
	    onError : function (res) {
	    console.log ('Error ' + res);
	}
});
**/

function doThing () {
    console.log ('This is a nice test');
}

// Add event listener for clicks on the extension icon
chrome.browserAction.onClicked.addListener ( function (TAB) {
   dbg.log ('CHROME :: clicked enable / disable icon');
   ext.toggle();
   /**
   // if no double-click detected, start listening                                                                                                               
   if ( dblClick === false ) {
      dblClick = setTimeout( function () {
         // if this function got called,                                                                                                                            
         // than there wasn't a double-click; just toggle the status                                                                                                
         ext.toggle();
         dblClick = false;
      }, 250);
    } else {
       // double-click detected; open the settings page                                                                                                          
       // instead of changing the extension's status                                                                                                             
       clearTimeout(dblClick);
       dblClick = false;
       chrome.tabs.create( {"url" : "index.html"} );
    }
   **/
 });

// Add listener for requests from the pages                                                                                                                      
chrome.extension.onRequest.addListener (function (request, sender, sendResponse) {
    // Validate highrise url                                                                                                                                      
    dbg.log ('CHROME Background :: request ');

    // On load parse request                                                                                                                                     
    if ( request.pageLoad && pref.get('enabled') ) {
	dbg.log ('CHROME Background :: Send response to TAB');
        sendResponse ({ parseDOM : true, fromAddress : pref.get('fromAddress')});
    }

    // Open settings page request                                                                                                                                
    if ( request.openSettingsPage ) {
        chrome.tabs.create ({ "url" : "index.html" });
    }

    // Cancel call request                                                                                                                                       
    if ( request.setupCallCancel ) {
        
    }

    // Make a Call on request                                                                                                                                    
    if ( request.setupCall && pref.get ('enabled')) {
        dbg.log('CHROME Background :: Call requested');
	OX_EXT.createCall();
	/**
        if(pref.get('onsipCredentialsGood')){
            if(request.extension != null){
                dbg.log('BACKGROUND APP :: phoneExtension Set ' + request.extension);
                pref.set('phoneExtension', request.extension);
            }
            dbg.log('BACKGROUND APP :: Make Call is called');
            //makeCall(sender, request);                                                                                                                         
        }else{
            // Send the Error message                                                                                                                            
            var msg = 'Please setup the extension first';
            chrome.tabs.sendRequest(sender.tab.id, {settingsError : true, errorMsg : msg});
        }
	**/
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
   var xhr          = new XMLHttpRequest();
   var responseSent = false;
    
   xhr.open('POST', url , true, token, "dummyPassword");
   xhr.onreadystatechange = function () {
      if (xhr.readyState == 4) { 
          if (xhr.status == 200) {
             if(callback) {
                callback.onSuccess(xhr.responseText);
                responseSent = true;
                dbg.log ('SETTING :: highrise credentials OK');
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
    setTimeout (function () {
       sendResponseToValidationRequest();
    }, 5000);

    function sendResponseToValidationRequest () {
        if (!responseSent) {
            callback.onError();
            dbg.log('SETTING :: highrise credentials NOT OK');
        }
    }
}


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

