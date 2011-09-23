/** Chrome Background Page **/

/** Alias for the OnSIP_Preferences object **/
var pref              = OnSIP_Preferences;
var highrise_app      = HIGHRISE;
var zendesk_app       = ZENDESK;
var extension         = null;
var rebound_to        = 3; /** minutes **/
var state_inactive    = [];
var state_active      = [];
var found_errors      = false;
var BG_LOG            = "CHROME-BACKGROUND";

/** This is a bit hacky. the problem we're **/
/** trying to solve has to do with identifying **/
/** the intented individual who we are calling **/
/** A single number within a company can represent **/
/** a call to any one of many persons within that company **/
/** We, therefore, are attempting to identify that **/
/** person from the web page context from which their **/
/** number was clicked **/
var name_from_context = '';

/** Connect, subscribe, and register to XMPP API **/
OX_EXT.apps = [BG_APP];

if (pref && pref.get('onsipCredentialsGood') === true && pref.get('onsipPassword') && pref.get('fromAddress')) {
  if (pref.get('onsipPassword').length > 0 && pref.get('fromAddress').length > 0) {
    OX_EXT.init (
      pref, {
        onSuccess : function () {
		      dbg.log(BG_LOG, 'Succeeded in OX_EXT.init for connecting & subscribing');
        },
        onError   : function (error) {
          /** In case of failure, display settings in a new tab **/
		      dbg.log(BG_LOG, 'There was an error in OX_EXT.init ' + error);
        }
	    });
  } else {
	  dbg.log(BG_LOG, 'OX_EXT.init NOT called, no credentials found');
  }
};

/** An extension to this background page with helper methods **/
extension = new OnSIP_Process();
extension.init();

/** Load and initialize Highrise with contacts **/
dbg.log (BG_LOG, 'Highrise Enabled --> ' + pref.get ('highriseEnabled'));
if (pref && pref.get('highriseEnabled') === true) {
  highrise_app.init(pref);
}

/** Initialize Zendesk with Contacts **/
dbg.log (BG_LOG, 'Zendesk Enabled --> '  + pref.get ('zendeskEnabled'));
if (pref && pref.get('zendeskEnabled') === true) {
  zendesk_app.init(pref);
}

/** Add event listener for clicks on the extension icon **/
chrome.browserAction.onClicked.addListener (
  function (TAB) {
    dbg.log (BG_LOG, 'clicked enable / disable icon');
    extension.toggle();
});

var sc_interval;
/** This wrapper attempts to fix connection issues to the XMPP server **/
/** In this case, we are relying on Strophe to tell us when it's time **/
/** to re-authorize & re-subscribe to pubsub after failures in BOSH **/
/** These failures occur as a result of putting a computer to sleep, or restarting WIFI **/
var sc = function() {
  if (!(pref && pref.get('onsipCredentialsGood'))){
    dbg.log (BG_LOG, 'In -sc-, onsip credentials are no good, not running connectivity checker');
    return;
  }
  if (!found_errors) {
    found_errors = OX_EXT.strophe_conn.errors > 0;
  }
  if (found_errors) {
    dbg.log (BG_LOG, 'Discovered ' + OX_EXT.strophe_conn.errors  + ' errors lets RE-ESTABLISH connection');
    var do_exec = function() {
      OX_EXT.failures = 0;
      BG_APP.launched_n = false;
      OX_EXT.init(
        pref, {
	  onSuccess : function() {
	    dbg.log (BG_LOG, 'Succeeded in OX_EXT.init for REBOUND connecting & subscribing');
	    found_errors = false;
	  },
	  onError   : function(error) {
	    dbg.log (BG_LOG, 'There was an error in do_exec() ' + error);
	    found_errors = true;
	  }
	});

      /** Load and initialize Highrise with contacts **/
      if (pref && pref.get('highriseEnabled')) {
	highrise_app.init(pref);
      }

      /** Initialize Zendesk with Contacts **/
      if (pref && pref.get('zendeskEnabled')) {
	zendesk_app.init(pref);
      }
    };
    OX_EXT.iConnectCheck(
      pref, {
	onSuccess : function() {
	  dbg.log(BG_LOG, 'Successfully connected to BOSH Server, do_exec()');
	  do_exec();
	},
        onError   : function() {
	  dbg.log(BG_LOG, 'Failed to connect to BOSH Server ');
	}
      });
  }
};

if (pref && pref.get('onsipCredentialsGood')) {
  sc_interval = setInterval(sc, 30000);
}


/** Add listener for requests from the pages **/
chrome.extension.onRequest.addListener(
  function(request, sender, sendResponse) {
    dbg.log (BG_LOG, 'Request ');

    /** On load parse request **/
    if ( request.pageLoad && pref.get('enabled') ) {
      dbg.log (BG_LOG, 'Send parseDOM request to Content Page from BG page');
      sendResponse ({ parseDOM : true, fromAddress : pref.get('fromAddress')});
    }

    /** Open settings page request **/
    if ( request.openSettingsPage ) {
      chrome.tabs.create ({ "url" : "index.html" });
    }

    /** Clear Highrise client cache **/
    if ( request.clearCache ) {
      dbg.log (BG_LOG, 'Clearing Highrise client cache');
      highrise_app.clearCache();
    }

    /** Make a Call on request **/
    if ( request.setupCall && pref.get ('enabled') ) {
      var from_address  = pref.get('fromAddress');
      var to_address    = request.phone_no;
      var call_setup_id = new Date().getTime() + '' + Math.floor(Math.random() * 1000);
      /** Name from context would ascertain the individual **/
      /** we are calling further down the call initiation process **/
      /** by scraping the page from which the click-to-call number was clicked **/
      name_from_context = request.name_from_context;
      // var clean_no     = formatPhoneNum (to_address);
      dbg.log (BG_LOG, 'Call requested FROM: ' + from_address + ' - TO: ' + to_address);
      OX_EXT.createCall (from_address, to_address, call_setup_id);
    }

    /** Verify SIP User **/
    if ( request.verifyOnSipUser ) {
      dbg.log (BG_LOG, 'Request verify on sip user  ' +
	       request.username + ', ***  -- ' +
	       pref.get ('onsipHttpBase'));

      pref.set('fromAddress'  , request.username);
      pref.set('onsipPassword', request.password);

      OX_EXT.init (
        pref, {
	  onSuccess : function() {
	    dbg.log (BG_LOG, "SIP user Verified Successfully");
	    sendResponse({ok : true});
	  },
	  onError   : function(error) {
	    dbg.log (BG_LOG, "Error in verifying SIP User [ " + error + " ]");
	    sendResponse({ok : false});
	  }
	});
    }

    /** Execute loop to verify XMPP / BOSH connection **/
    if ( request.checkConnection ) {
      dbg.log (BG_LOG, "checkConnection - " + request.run);
      if (sc_interval) {
	dbg.log (BG_LOG, "checkConnection - clear existing interval " + sc_interval);
	clearInterval(sc_interval);
      }
      if (request.run) {
	sc_interval = setInterval(sc, 30000);
      }
    }

    /** Verify Zendesk User **/
    if ( request.verifyZendesk ) {
      dbg.log (BG_LOG, 'Verifying Zendesk account with ' +
	       request.zendesk_url + ' - ' +
               request.zendesk_usr + ' - ' +
               request.zendesk_pwd);
      zendesk_app.verify ({
        onSuccess : function () {
	  sendResponse ({ok : true});
	  zendesk_app.init (pref);
          dbg.log (BG_LOG, 'Zendesk Credentials OK');
	},
        onError   : function () {
	  sendResponse ({ok : false});
	  dbg.log (BG_LOG, 'Zendesk Credetials INVALID ');
        }
      }, request.zendesk_url, request.zendesk_usr, request.zendesk_pwd);
    }

    /** Verify Highrise Account **/
    if ( request.verifyHighrise ) {
      var highriseResult = {};
      dbg.log(BG_LOG, 'Verifying Highrise Credentials TOKEN ' + request.highrise_url + '');
      highrise_app.verifyToken ({
        onSuccess : function (data) {
	  dbg.log(BG_LOG, 'HIGHRISE API :: Highrise credentials OK');
	  sendResponse({ok : true});
	  highrise_app.init(pref);
	},
	onError   : function () {
	  dbg.log(BG_LOG, 'HIGHRISE API :: Highrise credentials NOT OK');
	  sendResponse({ok : false});
	}
      },request.highrise_url, request.highrise_token);
    }

    /** In case we need to refresh Highrise from the content page **/
    if (request.refreshHighrise && pref && pref.get ('highriseEnabled')) {
      var f_wait = function() {
	dbg.log(BG_LOG, 'HIGHRISE API :: Refreshing Highrise');
	highrise_app.init (pref);
      };
      /** Wait a couple of seconds for the server side changes to take **/
      /** affect before we retrieve the latest & greatest.  This code executes **/
      /** whenever an update is made to the Highrise customer inventory  **/
      setTimeout(f_wait, 2000);
      sendResponse ({ok : true});
    }
});


/** Stores a state every time an "active" event is sent, up to 20 items. **/
/**
chrome.idle.onStateChanged.addListener     ( function (newstate) {
    // Rebound BOSH logic
    if (state_inactive.length >= 1) {
	var d_past      = state_inactive[0].time;
	var d_now       = new Date();
	var diff        = d_now.getTime() - d_past.getTime();
	var from_active = false;
	if (state_active.length > 0) {
	    var d_past_active = state_active[0].time;
	    var diff_active   = d_now.getTime() - d_past_active.getTime();
	    var min_active    = Math.floor (diff_active/1000/60);
	    // 	Here we're trying to account for the case where a computer is put
	    // 	to sleep, taken home, and then reactivated.
	    dbg.log (BG_LOG, 'Minutes since last ACTIVE ' + min_active);
	    if (min_active >= 120) {
		from_active = true;
	    }
	}
	// These are the minutes in idle
	var min    = Math.floor (diff/1000/60);
	dbg.log (BG_LOG, 'Minutes since idle ' + min + ' state inactive log length is (' + state_inactive.length + ')');
	while (state_inactive.length > 0) {
	    state_inactive.pop();
	}
	if ((min >= rebound_to || from_active) && pref && pref.get ('onsipCredentialsGood')) {
	    dbg.log (BG_LOG, 'IDLE for ' + min + ' minutes lets RE-ESTABLISH connection');
	    var do_exec = function () {
		OX_EXT.failures     = 0;
		BG_APP.launched_n   = false;
		OX_EXT.init   (pref, {
		    onSuccess : function () {
			dbg.log (BG_LOG, 'Succeeded in OX_EXT.init for REBOUND connecting & subscribing');
		    },
		    onError   : function (error) {
			dbg.log (BG_LOG, 'There was an error in REBOUND OX_EXT INIT ' + error);
			dbg.log (BG_LOG, "Let's try do_exec() again");
			d_now.setDate (1);
			d_now.setHours(0);
			d_now.setMonth(0);
			state_inactive.unshift({'state':'', 'time':d_now});
	            }
	        });

		// Load and initialize Highrise with contacts
		if (pref && pref.get ('highriseEnabled') === true && from_active) {
		    highrise_app.init(pref);
		}

		// Initialize Zendesk with Contacts
		if (pref && pref.get ('zendeskEnabled')  === true && from_active) {
		    zendesk_app.init (pref);
		}
	    };

	    OX_EXT.iConnectCheck  (pref, {
	        onSuccess : function () {
		    dbg.log (BG_LOG, 'Successfully connected to BOSH Server, do_exec()');
		    do_exec ();
		},
                onError   : function () {
		    dbg.log (BG_LOG, 'Failed to connect to BOSH pop off active node ');
		    state_inactive.shift();
		}
	    });
	}
    }
});
**/

/**
var sc = function () {
    chrome.idle.queryState(15, function (newstate) {
	var time = new Date();
	if (newstate === 'idle') {
	    if (state_inactive.length === 0) {
		state_inactive.unshift({'state':newstate, 'time':time});
		dbg.log (BG_LOG, 'Logged a new idle state @ ' + time);
	    }
	} else if (newstate === 'active') {
	    while (state_active.length >= 20) {
		state_active.pop();
	    }
	    //dbg.log (BG_LOG, 'Logged new ACTIVE state @ ' + time);
	    state_active.unshift({'state':newstate, 'time':time});
	}
    });
};
**/



