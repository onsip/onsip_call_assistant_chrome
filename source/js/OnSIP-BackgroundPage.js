/** Chrome Background Page **/

/** Alias for the OnSIP_Preferences object **/
var pref         = OnSIP_Preferences; 
var highrise_app = HIGHRISE;
var extension    = null;

/** Setup Highrise callback hooks **/
var BG_APP = {
    "notifications" : []
};

BG_APP.activeCallCreated   = function ( items ) {    
    var i, item, args, n, phone, len, name;
    dbg.log ('BG_APP LOG :: Active Call Created');
    for (i = 0, len = items.length; i < len; i++) {
	item    = items[i];
	phone   = extractPhoneNumber(item.toURI);
        dbg.log ('"BG_APP LOG :: Number of contacts is ' + 
		     highrise_app.contacts.length + ' -- ' + 
		     highrise_app.companies.length);
	cont   = highrise_app.findContact (phone + '');	
	if ( cont && cont.first_name && cont.last_name ) {
	    name = cont.first_name + ' ' + cont.last_name;
	    if (trim (name).length === 0) {
		name = undefined;
	    }
	}	
	if ( !name && (cont && cont.company_name) ) {
	    name = cont.company_name;
	}
		
	phone    = name || phone;
	n        = webkitNotifications.createNotification ('images/i_calling.png', 
							 "Calling", formatPhoneNum('' + phone));  

	n.onclick = function () {
            OX_EXT.cancelCall (item);
        }

	n.uri     = item.uri.query;
	n.contact = cont;
        n.show();

	this.notifications.push (n);
    }    
};

BG_APP.activeCallRequested = function ( items ) {
    var i, item, args, n, phone, len, cont, caption, name, is_setup;
    dbg.log ('BG_APP LOG :: Active Call Requested');
    for (i = 0, len = items.length; i < len; i++) {
	item     = items[i];
	is_setup = isSetupCall (item.fromURI) 
        caption  = is_setup ? "Call Setup" : "Incoming Call";	
	phone    = extractPhoneNumber(item.fromURI);
	cont     = highrise_app.findContact (phone + ''); 	        
        if ( cont && cont.first_name && cont.last_name ) {
            name = cont.first_name + ' ' + cont.last_name;
            if (trim (name).length === 0) {
		name = undefined;
            }
        } 
        if ( !name && (cont && cont.company_name) ) {
	    name = cont.company_name;
	    if (trim (name).length === 0) {
		name = undefined;
	    }
	}	
		
	phone    = name || phone;	
        n        = webkitNotifications.createNotification ('images/i_calling.png', 
							    caption, 
							    'From: ' + formatPhoneNum('' + phone));

	n.onclick = function () {
	    OX_EXT.cancelCall (item);
	}
	n.uri      = item.uri.query;
	n.is_setup = is_setup;
	n.contact  = cont;
        n.show();

	this.notifications.push (n);
    }
};

/** A phone connection has been established **/
BG_APP.activeCallConfirmed = function ( items ) {
   dbg.log ('BG_APP LOG :: Active Call Confirmed');
   var i, len, name;
   for (i = 0, len = items.length; i < len; i += 1) {               
       this._postNotetoProfile   (items[i].uri.query)
       this._cancelNotifications (items[i].uri.query);
   }
};

BG_APP.activeCallPending   = function ( item ) {
    dbg.log ('BG_APP LOG :: Active Call Pending');
};

BG_APP.activeCallRetract   = function (itemURI) {    
    var i, len;
    dbg.log ('BG_APP LOG :: Active Call Retracted = ' + this.notifications);
    for (i = 0, len = itemURI.length; i < len; i += 1) {
       this._cancelNotifications (itemURI[i].query);
    }
};

/** Helper method. Post a note through the Highrise API **/
BG_APP._postNotetoProfile  = function (item) {
    var i, len, costumer, full_name, is_setup;
    for (i = 0, len = this.notifications.length; i < len; i += 1) {
	if (item === this.notifications[i].uri) {
	    costumer = this.notifications[i].contact;
	    is_setup = this.notifications[i].is_setup;
	    if (costumer && costumer.id) {		
		var tz = getDateAndTime (getTimezoneAbbrevation (pref.get('userTimezone')));
		if ( costumer.first_name && costumer.last_name ) {
		    full_name = costumer.first_name + ' ' + costumer.last_name;
		    if (trim (full_name).length === 0) {
			full_name = undefined;
		    }
		}
		if ( !name && (costumer.company_name) ) {
		    full_name = costumer.company_name;
		    if (trim (full_name).length === 0) {
			full_name = undefined;
		    }
		}
		if (full_name && full_name.length > 0 && !is_setup) {
		    nt = "<note><body>Conversed with " + full_name + " @ " + tz + " By OnSIP</body></note>";
		    highrise_app.postNoteToProfile (costumer, nt);
		}                                
	    }
	}	
    }
};

/** Helper method. hide / cancel and remove desktop notifications **/
BG_APP._cancelNotifications = function (item) {
    dbg.log ('BG_APP :: ' + this.notifications.length + ' notifications ');    
    var a = [];
    var n = this.notifications.pop();
    while (n) {	
	if (item === n.uri) {	   
	    n.cancel();
	} else {
	    a.push (n);
	}
	n = this.notifications.pop();
    }
    this.notifications = a;        
};

/** Connect, subscribe, and register to XMPP API **/
OX_EXT.apps = [BG_APP];
if (pref && pref.get('onsipCredentialsGood') === true && pref.get ('onsipPassword') && pref.get ('fromAddress')) {
    if (pref.get ('onsipPassword').length > 0 && pref.get ('fromAddress').length > 0) {
        OX_EXT.init   (pref, {
            onSuccess : function () {
	        dbg.log ('Succeeded in OX_EXT.init for connecting & subscribing');
            },
            onError   : function (error) {	    
                /** In case of failure, display settings in a new tab **/
                dbg.log ('There was an error in OX_EXT INIT ' + error);
                //chrome.tabs.create ({ "url" : "index.html" });	
            }
	});
    } else {
	dbg.log ('OX_EXT.init NOT called, no credentials found');
    }
}

/** An extension to this background page with helper methods **/
extension = new OnSIP_Process();
extension.init ();

/** Load and initialize Highrise with contacts **/
if (pref && pref.get ('highriseEnabled') === true) {
    highrise_app.init(pref);
}

/** Add event listener for clicks on the extension icon **/
chrome.browserAction.onClicked.addListener ( function (TAB) {
    dbg.log ('CHROME Background :: clicked enable / disable icon');
    extension.toggle ();
 });

/** Add listener for requests from the pages **/          
chrome.extension.onRequest.addListener    ( function (request, sender, sendResponse) {    
    dbg.log ('CHROME Background :: request ');

    /** On load parse request **/                                                                                                              
    if ( request.pageLoad && pref.get('enabled') ) {
	dbg.log ('CHROME Background :: Send response to TAB');
        sendResponse ({ parseDOM : true, fromAddress : pref.get('fromAddress')});
    }

    /** Open settings page request **/                                                                                                                                
    if ( request.openSettingsPage ) {
        chrome.tabs.create ({ "url" : "index.html" });
    }

    /** Make a Call on request **/                                                                                                                                    
    if ( request.setupCall && pref.get ('enabled') ) {
	var from_address = pref.get('fromAddress');	
        var to_address   = request.phone_no; 	
	// var clean_no     = formatPhoneNum (to_address);
	dbg.log ('CHROME Background :: Call requested FROM: ' + 
		 from_address + ' - TO: ' + to_address);
	OX_EXT.createCall (from_address, to_address, to_address);
    }
    
    /** Verify SIP User **/
    if ( request.verifyOnSipUser ) {
	dbg.log ('CHROME BACKGROUND :: Request verify on sip user  ' + 
		 request.username + ', ***  -- ' + 
		 pref.get ('onsipHttpBase'));

	pref.set ('fromAddress'  , request.username);
	pref.set ('onsipPassword', request.password);

	OX_EXT.init (pref, {
	    onSuccess : function () {
	        dbg.log ("CHROME BACKGROUND :: SIP user Verified Successfully");
		sendResponse ({ ok : true  });	    
	    },
	    onError   : function (error) {
	        dbg.log ("CHROME BACKGROUND :: Error in verifying SIP User [ " + error + " ]");
		sendResponse ({ ok : false });
	    }
	});
    }

    /** Verify Highrise Account **/
    if ( request.verifyHighrise ){
	var highriseResult = {};
	dbg.log('CHROME Background :: Verifying Highrise Credentials TOKEN ' + request.highrise_url + '');    
        highrise_app.verifyToken ({
	    onSuccess : function (data) {
	        dbg.log('CHROME BACKGROUND :: HIGHRISE API :: Highrise credentials OK');
	        sendResponse ({ ok : true });		
		highrise_app.init (pref);		  
	    },
	    onError   : function () {
	        dbg.log('CHROME Background :: HIGHRISE API :: Highrise credentials NOT OK');
		sendResponse ({ ok : false });
	    }},
	    request.highrise_url,
            request.highrise_token);	
    } 

});

/** Window focus **/
//chrome.windows.onFocusChanged.addListener ( function (windowId) {
	//console.log ("WINDOW FOCUS *******************************");
    //OX_EXT.	

//}); 


