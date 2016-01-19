/** Chrome Background Page **/

/** Alias for the OnSIP_Preferences object **/
var pref              = OnSIP_Preferences;
var highrise_app      = HIGHRISE;
var zendesk_app       = Zendesk.App;
var extension         = null;
var rebound_to        = 3; /** minutes **/
var state_inactive    = [];
var state_active      = [];
var found_errors      = false;
var errored_interval  = 30000;
var DEFAULT_INTERVAL  = 30000;
var BG_LOG            = "CHROME-BACKGROUND";

/**
 This is a bit hacky. the problem we're
 trying to solve has to do with identifying
 the intended individual who we are calling
 A single number within a company can represent
 a call to any one of many persons within that company
 We, therefore, are attempting to identify that
 person from the web page context from which their
 number was clicked
*/
var name_from_context = '';

/**
 Connect, subscribe, and register to XMPP API
*/
SIP_EXT.apps = [BG_APP];

if (pref && pref.get('onsipCredentialsGood') === true && pref.get('onsipPassword') && pref.get('fromAddress')) {
  if (pref.get('onsipPassword').length > 0 && pref.get('fromAddress').length > 0) {
    SIP_EXT.init (
      pref, {
        onSuccess: function () {
          dbg.log(BG_LOG, 'Succeeded in SIP_EXT.init for connecting & subscribing');
        },
        onError: function (error) {
          dbg.log(BG_LOG, 'There was an error in SIP_EXT.init ' + error);
          found_errors = true;
        }
      }
    );
  } else {
    dbg.log(BG_LOG, 'SIP_EXT.init NOT called, no credentials found');
  }
};

/**
  An extension to this background page with helper methods
 */
extension = new OnSIP_Process();
extension.init();

/**
  Load and initialize Highrise with contacts
 */
if (pref && pref.get('highriseEnabled') === true) {
  dbg.log(BG_LOG, 'Highrise Enabled --> ' + pref.get ('highriseEnabled'));
  highrise_app.init(pref);
}

/**
 Initialize Zendesk with Contacts
 */
if (pref && pref.get('zendeskEnabled') === true) {
  dbg.log(BG_LOG, 'Is Zendesk Enabled --> '  + pref.get ('zendeskEnabled'));
  setTimeout(function() {
    zendesk_app.init({
        url: pref.get("zendeskUrl"),
        usr: pref.get("zendeskUsr"),
        token: pref.get("zendeskPwd"),
        sipAddress: pref.get('fromAddress')
      }, {
        success: function () {
          dbg.log(BG_LOG, 'Zendesk Credentials OK');
        },
        error: function() {
          dbg.log(BG_LOG, 'Access to Zendesk FAILED');
        }
      }
    );
  }, 1000);
}

/**
  Add event listener for clicks on the extension icon
 */
chrome.browserAction.onClicked.addListener (
  function(TAB) {
    dbg.log(BG_LOG, 'clicked enable / disable icon');
    extension.toggle();
  }
);

var sc_interval;
/**
  This wrapper attempts to fix connection issues to the XMPP server
  In this case, we are relying on Strophe to tell us when it's time
  to re-authorize & re-subscribe to pubsub after failures in BOSH
  These failures occur as a result of putting a computer to sleep, or restarting WIFI
 */
var sc = function() {
  if (!(pref && pref.get('onsipCredentialsGood'))){
    dbg.log (BG_LOG, 'In -sc-, onsip credentials are no good, not running connectivity checker');
    return;
  }
  if (!found_errors) {
    found_errors = !SIP_EXT.sip_ua.isConnected();
  }
  if (found_errors) {
    dbg.log (BG_LOG, 'sip_ua unregistered, lets RE-ESTABLISH connection');
    var do_exec = function() {
      SIP_EXT.failures = 0;
      BG_APP.launched_n = false;
      SIP_EXT.init(
        pref, {
          onSuccess : function() {
            dbg.log (BG_LOG, 'Succeeded in SIP_EXT.init for REBOUND connecting & subscribing');
            found_errors = false;
            // reset interval
            dbg.log(BG_LOG, 'Reconnection interval on success set at ' + errored_interval);
            errored_interval = DEFAULT_INTERVAL;
            if (sc_interval) {
              clearInterval(sc_interval);
            }
            sc_interval = setInterval(sc, errored_interval);
          },
          onError   : function(error) {
            dbg.log (BG_LOG, 'There was an error in do_exec() ' + error);
            found_errors = true;
            // back-off on auto connecting
            var factor = Math.floor(errored_interval / DEFAULT_INTERVAL);
            errored_interval = (factor + 1) * DEFAULT_INTERVAL;
            if (errored_interval > 300000) { // 5 min
              errored_interval = 300000 + (Math.floor((Math.random() * 5)) * DEFAULT_INTERVAL);
            }
            if (sc_interval) {
              clearInterval(sc_interval);
            }
            dbg.log(BG_LOG, 'Reconnection interval on error set at ' + errored_interval);
            sc_interval = setInterval(sc, errored_interval);
          }
        }
      );

      /**
       * Load and initialize Highrise with contacts
       */
      if (pref && pref.get('highriseEnabled')) {
        highrise_app.init(pref);
      }

      /**
       Initialize Zendesk with Contacts
       */
      if (pref && pref.get('zendeskEnabled')) {
        zendesk_app.init({
            url: pref.get("zendeskUrl"),
            usr: pref.get("zendeskUsr"),
            token: pref.get("zendeskPwd"),
            sipAddress: pref.get('fromAddress')
          }, {
            success: function () {
              dbg.log(BG_LOG, 'Zendesk Credentials OK');
            },
            error: function() {
              dbg.log(BG_LOG, 'Access to Zendesk FAILED');
            }
          }
        );
      }
    };

    SIP_EXT.iConnectCheck(
      pref, {
        onSuccess: function() {
          dbg.log(BG_LOG, 'Successfully connected to BOSH Server, do_exec()');
          do_exec();
        },
        onError: function() {
          dbg.log(BG_LOG, 'Failed to connect to BOSH Server ');
        }
      }
    );
  }
};

if (pref && pref.get('onsipCredentialsGood')) {
  sc_interval = setInterval(sc, errored_interval);
}


/**
 * Add listener for requests from the pages
 */
chrome.extension.onMessage.addListener(
  function(request, sender, sendResponse) {

    /**
     * On load parse request
     */
    if (request.pageLoad && pref.get('enabled')) {
      sendResponse({parseDOM:true, fromAddress:pref.get('fromAddress')});
    }

    /**
     * Open settings page request
     */
    if (request.openSettingsPage) {
      chrome.tabs.create({"url":"index.html"});
    }

    /**
     * Clear Highrise client cache
     */
    if (request.clearCache) {
      highrise_app.clearCache();
    }

    /**
     * Make a Call on request
     */
    if (request.setupCall && pref.get('enabled')) {
      var from_address  = pref.get('fromAddress');
      var to_address = request.phone_no;
      /**
        Name from context would ascertain the individual
        we are calling further down the call initiation process
        by scraping the page from which the click-to-call number was clicked
       */
      name_from_context = request.name_from_context;
      dbg.log(BG_LOG, 'Call requested FROM: ' + from_address + ' - TO: ' + to_address);
      SIP_EXT.createCall(from_address, to_address);
    }

    /**
     * Verify SIP User
     */
    if (request.verifyOnSipUser) {
      dbg.log(BG_LOG,
        'Request verify on sip user  ' +
          request.username + ', ***  -- ' +
            pref.get('onsipHttpBase'));

      pref.set('fromAddress', request.username);
      pref.set('onsipPassword', request.password);

      SIP_EXT.init(
        pref, {
          onSuccess: function() {
            dbg.log(BG_LOG, "SIP user Verified Successfully");
            sendResponse({ok : true});
          },
          onError: function(error) {
            dbg.log(BG_LOG, "Error in verifying SIP User [ " + error + " ]");
            /**
             * Strophe will on occasion throw an error after it has
             * successfully verified the end user. Not sure at this point
             * why that happens, but hoping that re-establishing the
             * connection to server will magically clean things up.
             */
            if (pref.set('onsipCredentialsGood')) {
              found_errors = true;
            }
            sendResponse({ok : false});
          }
        }
      );
    }

    /**
     * Execute loop to verify XMPP / BOSH connection
     */
    if (request.checkConnection) {
      dbg.log(BG_LOG, "checkConnection - " + request.run);
      if (sc_interval) {
        dbg.log(BG_LOG, "checkConnection - clear existing interval " + sc_interval);
        clearInterval(sc_interval);
      }
      if (request.run) {
        sc_interval = setInterval(sc, DEFAULT_INTERVAL);
      }
    }

    /**
     * Verify Zendesk User
     */
    if (request.verifyZendesk) {
      dbg.log (BG_LOG, 'Verifying Zendesk account with ' +
               request.zendesk_url + ' - ' +
               request.zendesk_usr + ' - ' +
               request.zendesk_pwd);

      zendesk_app.init({
          url: request.zendesk_url,
          usr: request.zendesk_usr,
          token: request.zendesk_pwd,
          sipAddress: pref.get('fromAddress')
        }, {
          success: function () {
            sendResponse ({ok : true});
            pref.set('zendeskEnabled', true);
            dbg.log(BG_LOG, 'Zendesk Credentials OK');
          },
          error: function() {
            sendResponse ({ok : false});
            dbg.log(BG_LOG, 'Zendesk Credetials INVALID');
        }
      });
    }

    /**
     * Verify Highrise Account
     */
    if (request.verifyHighrise) {
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

    /**
     * In case we need to refresh Highrise from the content page
     */
    if (request.refreshHighrise && pref && pref.get('highriseEnabled')) {
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
    return true;
});

chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    var i, block, extId, re, matchUrl;
    extId = chrome.i18n.getMessage("@@extension_id");
    re = new RegExp("^chrome-extension:\/\/" + extId);
    for (i = 0; i < details.requestHeaders.length; ++i) {
      if (details.requestHeaders[i].name === "Origin") {
        if(re.test(details.requestHeaders[i].value)) {
          block = true;
          break;
        }
      }
    }

    if (!block) return {requestHeaders: details.requestHeaders};

    dbg.log(BG_LOG, "onBeforeSendHeaders " + details.url,
      details.requestHeaders);

    for (i = 0; i < details.requestHeaders.length; ++i) {
      if (details.requestHeaders[i].name === 'Cookie') {
        details.requestHeaders.splice(i, 1);
        break;
      }
    }
    return { requestHeaders: details.requestHeaders };
  }, { urls: ["https://*.zendesk.com/api/v2*"] }, ['requestHeaders','blocking']
);
