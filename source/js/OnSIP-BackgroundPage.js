/** Chrome Background Page **/

/** Alias for the OnSIP_Preferences object **/
var pref       = OnSIP_Preferences; 
var extension  = null;

/** Setup Highrise callback hooks **/
var HIGHRISE_APP = {
    "notifications" : []
};

HIGHRISE_APP.activeCallCreated   = function ( items ) {    
    var i, item, args, n, phone, len, name;
    dbg.log ('HIGHRISE LOG :: Active Call Created');
    for (i = 0, len = items.length; i < len; i++) {
	/** save this bit of code for upgrading to HTML based notifications **/
	//args = 'ds=created&toURI=' + escape(item.toURI);
	//n    = webkitNotifications.createHTMLNotification ('notification.html?' + arg);	
	item   = items[i];
	phone  = extractPhoneNumber(item.toURI);
	cont   = HIGHRISE.findContact (phone + '');	
	if ( cont && cont.first_name && cont.last_name ) {
	    name = cont.first_name + ' ' + cont.last_name;
	    if (trim (name).length === 0) {
		name = undefined;
	    }
	}	
	if ( !name && (cont && cont.company_name) ) {
	    name = cont.company_name;
	}
		
	phone  = name || phone;
	n      = webkitNotifications.createNotification ('images/i_calling.png', 
							 'Calling', 
							 '' + phone);  
	n.uri           = item.uri.query;
	n.contact       = cont;
        n.show();

	this.notifications.push (n);

    }    
};

HIGHRISE_APP.activeCallRequested = function ( items ) {
    var i, item, args, n, phone, len, cont;
    dbg.log ('HIGHRISE LOG :: Active Call Requested');
    for (i = 0, len = items.length; i < len; i++) {
	item  = items[i];
	/** save this bit of code for upgrading to HTML based notifications **/
	//arg = 'ds=requested&fromURI=' + escape (item.fromURI);
        //n   =  webkitNotifications.createHTMLNotification ('notification.html?' + arg);
	phone = extractPhoneNumber(item.fromURI);
	cont  = HIGHRISE.findContact (phone + ''); 	        
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
	
	//console.log (' NAME is ' + name+ ' - phone is ' + phone);
	phone = name || phone;
        n     = webkitNotifications.createNotification ('images/i_calling.png', 
							'Incoming Call', 
							'From: ' + phone);
	n.uri           = item.uri.query;
	n.contact       = cont;
        n.show();

	this.notifications.push (n);
    }
};

HIGHRISE_APP.activeCallConfirmed = function ( items ) {
   dbg.log ('HIGHRISE LOG :: Active Call Confirmed');
   var i, len, name;
   for (i = 0, len = items.length; i < len; i += 1) {               
       this._postNotetoProfile   (items[i].uri.query)
       this._cancelNotifications (items[i].uri.query);
   }
};

HIGHRISE_APP.strophe_Connected  = function ( item ) {
    dbg.log ('HIGHRISE LOG :: Stophe Connected');
};

HIGHRISE_APP.activeCallPending   = function ( item ) {
    dbg.log ('HIGHRISE LOG :: Active Call Pending');
};

HIGHRISE_APP.activeCallRetract   = function (itemURI) {    
    var i, len;
    dbg.log ('HIGHRISE LOG :: Active Call Retracted = ' + this.notifications);
    for (i = 0, len = itemURI.length; i < len; i += 1) {
       this._cancelNotifications (itemURI[i].query);
    }
};

HIGHRISE_APP._postNotetoProfile  = function (item) {
    var i, len, costumer, full_name;
    for (i = 0, len = this.notifications.length; i < len; i += 1) {
	if (item === this.notifications[i].uri) {
	    costumer = this.notifications[i].contact;
	    if (costumer && costumer.id) {		
		var tz = getDateAndTime(getTimezoneAbbrevation(pref.get('userTimezone')));
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
		if (full_name && full_name.length > 0) {
		    nt     = "<note><body>testing note from " + full_name + "  timezone " + tz + "</body></note>";
		    HIGHRISE.postNoteToProfile (costumer, nt);
		}                                
	    }
	}	
    }
};

HIGHRISE_APP._cancelNotifications = function (item) {
    dbg.log ('There are ' + this.notifications.length + ' notifications ');    
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
OX_EXT.apps = [HIGHRISE_APP];
OX_EXT.init();

/** Turn extension on / off **/
extension = new OnSIP_Process();
extension.init();

/** Load contact information from Highrise **/
HIGHRISE.init();

/** Add event listener for clicks on the extension icon **/
chrome.browserAction.onClicked.addListener ( function (TAB) {
    dbg.log ('CHROME :: clicked enable / disable icon');
    extension.toggle();
 });

/** Add listener for requests from the pages **/          
chrome.extension.onRequest.addListener ( function (request, sender, sendResponse) {    
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
	dbg.log ('CHROME Background :: Call requested FROM: ' + from_address + ' - TO: ' + to_address);
	OX_EXT.createCall (from_address, to_address);
    }
});



