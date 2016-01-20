/** SIP supported functionality **/

var SIP_EXT = {
  "name"         : "SIP.js Based Chrome Plug-in",
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
    //uri: specific per UserAddress
    //authorizationUser: specific per UserAddress
    //password: specific per UserAddress
    userAgentString: SIP.C.USER_AGENT + ' OnsipChromeCallAssistant/2.0.0-dev',
  };
};

SIP_EXT.createUAs = function (failure) {
  var promises = [],
    that = SIP_EXT;
  failure = failure || function () {};

  that.users.forEach(function (user) {
    var config = that.getDefaultConfig();
    config.uri = user.uri;
    config.authorizationUser = user.authorizationUser;
    config.password = user.password;

    user.ua = new SIP.UA(config);

    promises.push(new Promise(function (resolve, reject) {
      var intervalId = setTimeout(reject, 10000);

      user.ua.afterConnected(function () {
        clearTimeout(intervalId);
        resolve();
      });
    }));

    //probably needs to be better
    user.ua.on('disconnected', failure);

    user.ua.start();
  });

  return Promise.all(promises);
};

SIP_EXT.allUAsConnected = function () {
  return SIP_EXT.users.every(function (user) {
    return user.ua.isConnected();
  });
};

SIP_EXT.removeUAs = function () {
  SIP_EXT.users.forEach(function (user) {
    user.ua.removeAllListeners();
    user.ua.stop();

    delete user.ua;
  });
};

SIP_EXT.createSubscriptions = function (failure) {
  /** Re-subscribe every 45 min **/
  var expiresTime  = 60000 * 45,
    that = SIP_EXT,
    promises = [];
  failure = failure || {};

  dbg.log('SIPJS', 'UAs Connected, creating subscriptions');

  that.users.forEach(function (user) {
    user.firstNotify = true;
    user.savedDialogs = [];

    user.sub = user.ua.subscribe(user.uri, 'dialog', {expires: expiresTime});

    user.sub.on('notify', that.handleDialog.bind(that, user));
    user.sub.once('failed', function () {
      user.sub.removeAllListeners();
      failure();
    });

    promises.push(new Promise(function (resolve, reject) {
      var intervalId = setTimeout(reject, 10000);
      user.sub.once('notify', function () {
        clearTimeout(intervalId);
        resolve();
      });
    }));
  });

  return Promise.all(promises);
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

SIP_EXT.init = function (pref, callback, manualLogin) {
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

  var apiRefresh = false;
  if (!manualLogin) {
    if (this.lastApiCall) {
      var fourDaysInMs = 345600000;

      apiRefresh = ((Date.now() - this.lastApiCall) > fourDaysInMs);
    }
  }

  if (that.users && that.users.length > 0) {
    dbg.log (that.log_context, 'Restarting User Agents');
    that.removeUAs();

    if (!apiRefresh && !manualLogin) {
      return that.createUAs(callback.onError)
      .then(that.createSubscriptions.bind(that, callback.onError))
      .then(callback.onSuccess)
      .catch(callback.onError);
    }
  }

  this.lastApiCall = Date.now();

  apiCalls.UserAddressBrowse(this.from_address, this.pwd)
  .then(function (userAddressResponse) {
    var userId = userAddressResponse.Context.Session.UserId,
      userAddresses = userAddressResponse.Result.UserAddressBrowse.UserAddresses.UserAddress;

    userAddresses = [].concat(userAddresses || []);
    that.users = [];

    userAddresses.forEach(function (tempUser) {
      if (userId === tempUser.UserId) {
        tempUser.uri = tempUser.Address.Username + '@' + tempUser.Address.Domain;
        tempUser.authorizationUser = tempUser.AuthUsername;
        tempUser.password = tempUser.AuthPassword;
        that.users.push(tempUser);
      }
    });

    if (that.users.length === 0) {
      throw 'User not found';
    }

    return;
  }).then(that.createUAs)
  .then(that.createSubscriptions.bind(that, callback.onError))
  .then(callback.onSuccess)
  .catch(callback.onError);
};

SIP_EXT.handleDialog = function (user, notification) {
  var data = JSON.parse(xml2json(parseXml(notification.request.body), ''));
  var that = SIP_EXT;

  var dialogList = [];
  var dialogs = {};
  var refreshNecessary = false;
  var states = {
    'terminated': 0,
    'early'     : 1,
    'proceeding': 1,
    'confirmed' : 2
  };
  if (!data['dialog-info'].dialog) {
    user.firstNotify = false;
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
      } else if (!dialog.local){
        refreshNecessary = true;
      }

      if (dialog.remote && dialog.remote.identity) {
        //dialog.data.remoteUri = uriService.toUri(dialog.remote[0].identity[0]._ || dialog.remote[0].identity[0], ua);
        dialog.data.remoteUri = dialog.remote.identity;
      }

      dialogs[callId] = dialog;
    }
  });

  if (refreshNecessary) {
    dbg.log(that.log_context, 'Received a stripped NOTIFY for ourself, refreshing to try again');

    user.sub.refresh();
    return;
  }

  if (user.firstNotify) {
    user.firstNotify = false;

    for (callId in dialogs) {
      var incomingDialog = dialogs[callId];
      if (!incomingDialog.data) return; //unique in an empty array? what?
      if (incomingDialog.data.state !== 'terminated') {
        user.savedDialogs[callId] = incomingDialog;
      }
    }
    return;
  }

  for (callId in dialogs) {
    var savedDialog = user.savedDialogs[callId];
    var incomingDialog = dialogs[callId];
    if (!incomingDialog.data) return; //unique in an empty array? what?

    if ((savedDialog && incomingDialog.data.state !== savedDialog.data.state) ||
        (!savedDialog && incomingDialog.data.state !== 'terminated')) {
      incomingDialog.data.changed = true;
      user.savedDialogs[callId] = incomingDialog;
    }
  }

  //proceeding is dialing -> created is dialing
  //early is ringing -> requested is ringing
  //terminated -> retract

  //we now have the newest dialog from an actually new event (non-first notify), lets figure out what to publish
  for (callId in user.savedDialogs) {
    var savedDialog = user.savedDialogs[callId];
    if (!savedDialog.data) return; //unique in an empty array? what?

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
      delete user.savedDialogs[callId];
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