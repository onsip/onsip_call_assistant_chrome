/** SIP supported functionality **/

var SIP_EXT = {
  "name"         : "SIP.js Based Chrome Plug-in",
  "sip_ua"      : undefined,
  "from_address" : undefined,
  "apps"         : [],
  "pwd"          : undefined,
  "log_context"  : "SIP_EXT",
  "DEF_TIMEOUT"  : 7000
};

SIP_EXT.getDefaultConfig = function () {
  return {
    wsServers: ['wss://edge.sip.onsip.com'],
    traceSip: true,
    register: false,
    //uri: need from UserAddressBrowse
    //authorizationUser: UserAddressBrowse
    //password: UserAddressBrowse
    userAgentString: SIP.C.USER_AGENT + ' OnsipChromeCallAssistant/2.0.0-dev',
  };
};

SIP_EXT.createUA = function (config) {
  dbg.log (this.log_context, 'Initialized SIP.js UA');
  this.sip_ua = new SIP.UA(config);
};

SIP_EXT.iConnectCheck = function (pref, call) {
  var xhr   = new XMLHttpRequest();
  var url   = pref.get ('onsipHttpBase');
  var ok    = false;
  var that  = this;
  var tmout = 30000; /** 30 sec **/

  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) {
      return false;
    }
    if (xhr.status === 200) {
      ok = true;
      if (call && call.onSuccess) {
        return call.onSuccess();
      }
    }
    else {
      if (call && call.onError) {
        return call.onError();
      }
    }
  };

  var a = function () {
    if (!ok) {
      xhr.abort();
      if (call && call.onError) {
        call.onError();
      }
    }
  };

  dbg.log(this.log_context, 'Verifying Internet Connectivity');
  xhr.open("GET", url, false);
  setTimeout(a, tmout);
  xhr.send();
};

SIP_EXT.init = function (pref, callback) {
  var url = pref.get ('onsipHttpBase');
  var that = this;
  var resource = 'chrome-sipjs-plugin';
  this.from_address = pref.get ('fromAddress');
  this.pwd = pref.get ('onsipPassword');
  /** not ready //
  if (pref.get('highriseEnabled') === true){
    resource += '-highrise';
  } else if (pref.get('zendeskEnabled') === true){
    resource += '-zendesk';
  }
  **/
  var config = that.getDefaultConfig();

  if (that.sip_ua && that.sip_ua.isConnected()) {
    dbg.log (that.log_context, 'Restarting User Agent');

    that.sip_ua.stop();
  }

  apiCalls.SessionCreate(this.from_address, this.pwd).then(function (sessionResponse) {
    var session = sessionResponse.Context.Session;

    return apiCalls.UserAddressBrowse(session.SessionId, session.UserId);
  }).then(function (userAddressResponse) {
    var userAddresses = userAddressResponse.Result.UserAddressBrowse.UserAddresses.UserAddress;
    userAddresses = [].concat(userAddresses || []);

    var user = userAddresses[0];

    config.authorizationUser = user.AuthUsername;
    config.password = user.AuthPassword;
    config.uri = user.Address.Username + '@' + user.Address.Domain;

    return config;
  }).then(function (config) {
    that.createUA(config);

    that.sip_ua.rawLog = function(data) {
      dbg.log ('SIPJS RAW','Log  :: ' + data );
    };

    that.sip_ua.once('connected', that._onConnected.bind(that, callback));
    that.sip_ua.on('disconnected', function () {
      dbg.log (that.log_context, 'User Agent disconnected, attempting to reconnect');
      that.sip_ua.start();
    });

  }).catch(callback.onError);
};

SIP_EXT._onConnected = function (callback) {
  /** Re-subscribe every 45 min **/
  var expiresTime  = 60000 * 45;

  dbg.log('SIPJS', 'UA Connected' );

  this.firstNotify = true;
  this.savedDialogs = {};

  var sub = this.sip_ua.subscribe(this.from_address, 'dialog', {expires: expiresTime});

  sub.on('notify', this.handleDialog);

  sub.once('notify', callback.onSuccess);
};


SIP_EXT.createCall = function (from_address, to_address) {
  var that = this;

  to_address = to_address + '@jnctn.net';
  //from_address = 'sip:' + from_address;
  dbg.log (this.log_context, 'Create Call - ' + from_address + ' ^ ' + to_address);

  apiCalls.CallSetup(from_address, to_address).then(function () {
    dbg.log(that.log_context, 'Create call success');
  }).catch(function () {
    dbg.log(that.log_context, 'Create call error');
  });
};

SIP_EXT.handleDialog = function (notification) {
  var data = JSON.parse(xml2json(parseXml(notification.request.body), ''));
  var that = SIP_EXT;

  var dialogList = [];
  var dialogs = {};
  var states = {
    'terminated': 0,
    'early'     : 1,
    'proceeding': 1,
    'confirmed' : 2
  };
  if (!data['dialog-info'].dialog) {
    this.firstNotify = false;
    return;
  }

  data['dialog-info'].dialog = [].concat(data['dialog-info'].dialog || []);

  data['dialog-info'].dialog.forEach(function(dialog) {
    var callId = dialog['@id'].indexOf('.') === -1 ? dialog['@id'] : dialog['@id'].substring(0, dialog['@id'].indexOf('.'));
    var state = dialog.state;

    if (!dialogs[callId] || (states[state] > states[dialogs[callId].state])) {
      dialog.data = {
        callId: callId,
        address: data['dialog-info']['@entity'],
        state: state,
        direction: dialog['@direction'],
        confirmedTime: dialog['dialog-confirmed-time'] && dialog['dialog-confirmed-time'][0] && dialog['dialog-confirmed-time'][0]._,
      };

      if (dialog.local && dialog.local.identity) {
        //dialog.data.localUri = uriService.toUri(dialog.local[0].identity[0]._ || dialog.local[0].identity[0], ua);
        dialog.data.localUri = dialog.local.identity['#text'];
        dialog.data.localDisplayName = dialog.local.identity['@display'];
      }

      if (dialog.remote && dialog.remote.identity) {
        //dialog.data.remoteUri = uriService.toUri(dialog.remote[0].identity[0]._ || dialog.remote[0].identity[0], ua);
        dialog.data.remoteUri = dialog.remote.identity;
      }

      dialogs[callId] = dialog;
    }
  });

  if (that.firstNotify) {
    that.firstNotify = false;

    for (callId in dialogs) {
      var incomingDialog = dialogs[callId];
      if (incomingDialog.data.state !== 'terminated') {
        that.savedDialogs[callId] = incomingDialog;
      }
    }
    return;
  }

  for (callId in dialogs) {
    var savedDialog = that.savedDialogs[callId];
    var incomingDialog = dialogs[callId];

    if ((savedDialog && incomingDialog.data.state !== savedDialog.data.state) ||
        (!savedDialog && incomingDialog.data.state !== 'terminated')) {
      incomingDialog.data.changed = true;
      that.savedDialogs[callId] = incomingDialog;
    }
  }

  //proceeding is dialing -> created is dialing
  //early is ringing -> requested is ringing
  //terminated -> retract

  //we now have the newest dialog from an actually new event (non-first notify), lets figure out what to publish
  for (callId in that.savedDialogs) {
    var savedDialog = that.savedDialogs[callId];

    if (savedDialog.data.changed) {
      savedDialog.data.changed = false;

      switch (savedDialog.data.state) {
        case 'proceeding':
          that.__publishEventToApps ('activeCallCreated'  , savedDialog.data);
          break;
        case 'early':
          that.__publishEventToApps ('activeCallRequested', savedDialog.data);
          break;
        case 'confirmed':
          that.__publishEventToApps ('activeCallConfirmed', savedDialog.data);
          break;
        case 'terminated':
          that.__publishEventToApps ('activeCallRetract', savedDialog.data);
          break;
        default:
          //unknown state
      }
    }

    if (savedDialog.data.state === 'terminated') {
      delete that.savedDialogs[callId];
    };
  }
}

SIP_EXT.__publishEventToApps = function (event) {
  var i, len, args = [];
  for (i = 1, len = arguments.length; i < len; i += 1) {
    args.push (arguments[i]);
  }
  for (i = 0, len = this.apps.length; i < len; i+= 1) {
    if (this.apps[i] && typeof this.apps[i][event] === 'function'){
      this.apps[i][event] (args[0]);
    }
  }
};

SIP_EXT.cancelCall = function (handle) {
  if (handle && handle.hangup) {
    handle.hangup();
  }
};
