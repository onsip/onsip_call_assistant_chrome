/** Chrome Background Page **/

/** Alias for the OnSIP_Preferences object **/
var pref         = OnSIP_Preferences; 
var highrise_app = HIGHRISE;
var zendesk_app  = ZENDESK;
var extension    = null;
var rebound_to   = 10; /** minutes **/
var state_log    = [{ 'state':'', 'time':new Date() }];

/** Setup Highrise callback hooks **/
var BG_APP = {
    "notifications" : [],
    "launched_n"    : false
};

BG_APP.activeCallCreated   = function ( items ) {    
    var i, n, item, phone, len, name, 
        cont_highrise, cont_zendesk, caption;
    var that = this;
    dbg.log ('BG_APP LOG :: Active Call Created');
    for (i = 0, len = items.length; i < len; i++) {
	item          = items[i];
	phone         = extractPhoneNumber(item.toURI);        
	cont_highrise = highrise_app.findContact (phone + '');
	cont_zendesk  = zendesk_app .findContact (phone + '');
	name          = this._normalizeName (cont_zendesk, cont_highrise);
	phone         = name || phone;
	caption       = "Calling: ";
	
	var f_notification = {
            onSuccess : function (record_count, subject, is_onsip, nice_id) {
                if (record_count) {
                    caption += formatPhoneNum('' + phone) + " (" + record_count + ")";
		    subject  = subject.substr (0, 60).toLowerCase();
                } else {
		    subject  = "To: " + formatPhoneNum('' + phone);
		}
                n  = webkitNotifications.createNotification ('images/icon-48.png',
							     caption, subject);		
                n.onclick = function () {
		    if (pref.get('zendeskEnabled')) {                   
			if (!nice_id) {
			    chrome.tabs.create({url: pref.get('zendeskUrl') + '/rules/2007686'});
			} else {
			    chrome.tabs.create({url: pref.get('zendeskUrl') + '/tickets/' + nice_id});
			}
		    } else {
			OX_EXT.cancelCall (item);
		    }
                }
                n.uri               = item.uri.query;
                n.phone             = formatPhoneNum('' + phone);
                n.contact_highrise  = cont_highrise;
                n.contact_zendesk   = cont_zendesk;
		n.is_onsip          = (is_onsip) ? is_onsip : false;
                n.show();
		
                that.notifications.push (n);
            },
            onError  : function () {}
        };

	/** On Call Created. If a notification already exists then we won't produce another. **/
	if (this.notifications.length === 0) {
	    if (cont_zendesk && cont_zendesk.id) {
		zendesk_app.search ( cont_zendesk.id, f_notification);
	    } else {
		f_notification.onSuccess ();
	    }
	}
    }
};

BG_APP.activeCallRequested = function ( items ) {
    var i, n, item, phone, len, cont_highrise,
        cont_zendesk, caption, name, is_setup, that;
    var that = this;    

    dbg.log ('BG_APP LOG :: Active Call Requested');
    for (i = 0, len = items.length; i < len; i++) {
	item        = items[i];
	is_setup    = isSetupCall (item.fromURI); 
	/** Temporarily adding this feature 12/3/2010 **/
	/** If this is just a call setup, then we don't display notification **/
	if (is_setup) {
	    continue;
	}
        caption       = is_setup ? "Call Setup: " : "Incoming Call: ";	
	phone         = extractPhoneNumber(item.fromURI);
	cont_highrise = highrise_app.findContact (phone + ''); 	        
	cont_zendesk  = zendesk_app .findContact (phone + '');
	name          = this._normalizeName (cont_zendesk, cont_highrise);
	phone         = name || phone;
	
	var f_notification = {
	    onSuccess : function (record_count, subject, is_onsip, nice_id) {
		if (record_count) {
                    caption += formatPhoneNum('' + phone) + " (" + record_count + ")";
		    subject  = subject.substr(0, 60).toLowerCase();
                } else {
		    if (!is_setup) {
			subject  = "From: "  + formatPhoneNum('' + phone);
		    } else {
			subject  = "Setup: " + formatPhoneNum('' + phone);
		    }
		}                		
	        n  = webkitNotifications.createNotification ('images/icon-48.png', 
							     caption, subject);				      
		n.onclick = function () {	
		    if (pref.get('zendeskEnabled')) {
			if (!nice_id) {
			    chrome.tabs.create({url: pref.get('zendeskUrl') + '/rules/2007686'});
			} else {
			    chrome.tabs.create({url: pref.get('zendeskUrl') + '/tickets/' + nice_id});
			}
		    } else {
			OX_EXT.cancelCall (item);
		    }
		}
		n.uri               = item.uri.query;
		n.phone             = formatPhoneNum('' + phone);
		n.is_setup          = is_setup;
		n.contact_highrise  = cont_highrise;
		n.contact_zendesk   = cont_zendesk;
		n.is_onsip          = (is_onsip) ? is_onsip : false;
		n.flag_incoming     = true;
		n.show();

		that.notifications.push (n);
		that.launched_n = false;
	    },
	    onError  : function () {
		that.launched_n = false;
	    }
	};

	var p = formatPhoneNum('' + phone);
	console.log ('BG_APP LOG :: Is Launching notification ' + this.launched_n);
	if (!this._isNotificationShowing (p) && !this.launched_n) {
	    this.launched_n = true;
	    if (cont_zendesk && cont_zendesk.id) {
		zendesk_app.search (cont_zendesk.id, f_notification);                
	    } else {
		f_notification.onSuccess ();
	    }
	}
    }
};

/** 
 * Normalize on the variations in the name returned by the various third parties.
 * The returned normalized value will be display in the notification toast.
 * Variations include : 
 * Zendesk, which returns the full name.
 * Highrise, which returns first and last name
 * Highrise also returns company. 
**/
BG_APP._normalizeName    = function () {
    var normalized_name, len, i, c;    
    for (i = 0, len = arguments.length; i < len; i++) {
	c = arguments[i];
	if (c && c.full_name) {
	    normalized_name = trim (c.full_name);
	    if (normalized_name.length === 0) {
		normalized_name = undefined;
	    }
	} 
	if (!normalized_name && c && c.first_name && c.last_name) {
	    normalized_name = c.first_name + ' ' + c.last_name;
	    normalized_name = trim (normalized_name);
	    if (normalized_name.length === 0) {
		normalized_name = undefined;
            }	    
	} 
	if (!normalized_name && c && c.company_name) {
	    normalized_name = c.company_name;
            normalized_name = trim (normalized_name);
            if (normalized_name.length === 0) {
		normalized_name = undefined;
            }	    
	}
	if (normalized_name) {
	    return normalized_name;
	}
    }
    return;
};

/** A phone connection has been established **/
BG_APP.activeCallConfirmed = function ( items ) {
   dbg.log ('BG_APP LOG :: Active Call Confirmed');
   var i, len, name;
   var that = this;
   for (i = 0, len = items.length; i < len; i += 1) {               
       this._postNotetoProfile   (items[i].uri.query)
       var q = items[i].uri.query;
       var f = function() {
	   that._cancelNotifications (q);
       };
       setTimeout (f, 2000);
   }
};

BG_APP.activeCallPending   = function ( item ) {
    dbg.log ('BG_APP LOG :: Active Call Pending');
};

BG_APP.activeCallRetract   = function (itemURI) {    
    var i, len;
    var that = this;
    dbg.log ('BG_APP LOG :: Active Call Retracted = ' + this.notifications);
    for (i = 0, len = itemURI.length; i < len; i += 1) {
	var q = itemURI[i].query;
	var f = function () {	
	    that._cancelNotifications (q);
	};
	setTimeout(f, 1000);
    }
};

/** Helper method. Post a note through the Highrise API **/
BG_APP._postNotetoProfile  = function (item) {
    var i, len, costumer, full_name, is_setup, phone, notif;
    for (i = 0, len = this.notifications.length; i < len; i += 1) {
	if (item === this.notifications[i].uri) {
	    notif       = this.notifications[i];
	    costumer_hr = notif.contact_highrise;
	    costumer_zd = notif.contact_zendesk;
	    is_setup    = notif.is_setup;
	    if (!is_setup) {
		if (pref.get ('highriseEnabled') && costumer_hr && costumer_hr.id) {		
		    highrise_app.postNote (costumer_hr, pref.get('userTimezone'));		    		
		}
		if (pref.get ('zendeskEnabled') && notif.flag_incoming && !notif.is_onsip) {		    
		    if (costumer_zd && costumer_zd.id) {
			zendesk_app.postNote  (costumer_zd, pref.get('userTimezone'));
		    } else {
			phone = notif.phone;
			zendesk_app.postNoteUnknown (phone, pref.get('userTimezone'));
		    }
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

BG_APP._isNotificationShowing = function (item) {
    var i, len;
    var is_showing = false;
    for (i = 0, len = this.notifications.length; i < len; i += 1) {
        if (item === this.notifications[i].phone) {
	    is_showing = true;
	    break;
	}
    }
    return is_showing;
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
            }
	});
    } else {
	dbg.log ('OX_EXT.init NOT called, no credentials found');
    }
};

/** An extension to this background page with helper methods **/
extension = new OnSIP_Process();
extension.init ();

/** Load and initialize Highrise with contacts **/
if (pref && pref.get ('highriseEnabled') === true) {
    highrise_app.init(pref);
}

/** Initialize Zendesk with Contacts **/
dbg.log ('CHROME Background :: Zendesk enabled --> ' + pref.get ('zendeskEnabled'));
if (pref && pref.get ('zendeskEnabled') === true) {
    zendesk_app.init (pref);
}

/** Add event listener for clicks on the extension icon **/
chrome.browserAction.onClicked.addListener ( function (TAB) {
    dbg.log ('CHROME Background :: clicked enable / disable icon');
    extension.toggle ();
});

/** Stores a state every time an "active" event is sent, up to 20 items. **/
chrome.idle.onStateChanged.addListener(function(newstate) {
    var time = new Date();
    if (state_log.length >= 20) {
	state_log.pop();
    }
    state_log.unshift({'state':newstate, 'time':time});
    console.log ('CHROME Background :: Logged a new state @ ' + time);
    /** Rebound BOSH logic **/
    if (state_log.length >= 2) {
	var d_past = state_log[1].time;
	var d_now  = state_log[0].time;	
	var diff   = d_now.getTime() - d_past.getTime();

	/** These are the minutes in idle **/
	var min    = Math.floor (diff/1000/60);
	
	console.log ('CHROME Background :: Minutes since idle ' + min);
	if (min >= rebound_to && pref && pref.get ('onsipCredentialsGood')) {
	    dbg.log ('CHROME Background :: IDLE for ' + min + ' minutes lets RE-ESTABLISH connection');	    
	    var do_exec = function () {	        
		OX_EXT.failures     = 0;
		OX_EXT.strophe_conn = undefined;		
		BG_APP.launched_n   = false;		    
		OX_EXT.init   (pref, {
		    onSuccess : function () {
		        dbg.log ('CHROME Background :: Succeeded in OX_EXT.init for REBOUND connecting & subscribing');
		    },
		    onError   : function (error) {
		        dbg.log ('CHROME Background :: There was an error in REBOUND OX_EXT INIT ' + error);
	            }
	        });
	        		
		/** Load and initialize Highrise with contacts **/
		if (pref && pref.get ('highriseEnabled') === true) {
		    highrise_app.init(pref);
		}

		/** Initialize Zendesk with Contacts **/		
		if (pref && pref.get ('zendeskEnabled')  === true) {
		    zendesk_app.init (pref);
		}
	    };
	    
	    OX_EXT.iConnectCheck  (pref, {
	        onSuccess : function () {		    
		    dbg.log ('CHROME Background :: Successfully connected to BOSH Server, do_exec()');
		    do_exec ();	
		},
                onError   : function () {
		    dbg.log ('CHROME Background :: Failed to connect to BOSH pop off active node ');
		    state_log.shift();
		}
	    });	    
	}
    }
});

var sc = function () {
    chrome.idle.queryState(15, function (newstate) {
        console.log ('CHROME Background :: State Check -> ' + newstate);
    });
    setTimeout (sc, 90000);
};
sc();

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

    /** Verify Zendesk User **/
    if ( request.verifyZendesk ) {
       console.log ('CHROME BACKGROUND :: Verifying Zendesk account with ' + 
		    request.zendesk_url + ' - ' + request.zendesk_usr + ' - ' + request.zendesk_pwd);
       zendesk_app.verify ({
          onSuccess : function () {
	     sendResponse ({ok : true});
	     zendesk_app.init (pref);
             dbg.log ('CHROME Background :: Zendesk Credentials OK');
	  },
          onError   : function () { 
	     sendResponse ({ok : false});
	     dbg.log ('CHROME Background :: Zendesk Credetials INVALID ');	    
          }
       }, request.zendesk_url, request.zendesk_usr, request.zendesk_pwd);
    }

    /** Verify Highrise Account **/
    if ( request.verifyHighrise ) {
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


