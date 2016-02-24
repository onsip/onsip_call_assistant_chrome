/** SIP supported functionality **/

var SIP_EXT = {
  "name"         : "SIP.js Based Chrome Plug-in",
  "from_address" : undefined,
  "apps"         : [],
  "pwd"          : undefined,
  "log_context"  : "SIP_EXT",
  "DEF_TIMEOUT"  : 7000
};

SIP_EXT.init = function (pref, callback, manualLogin) {
  var that = this,
    resource = 'chrome-sipjs-plugin',
    temp_from = pref.get('fromAddress'),
    temp_pwd = pref.get('onsipPassword');
  /** not ready //
  if (pref.get('highriseEnabled') === true){
    resource += '-highrise';
  } else if (pref.get('zendeskEnabled') === true){
    resource += '-zendesk';
  }
  **/

  if (!manualLogin && this.apiFailed && this.from_address === temp_from && this.pwd === temp_pwd) {
    dbg.log(that.log_context, 'Login attempted with already bad credentials, failing');
    callback.onError();
    return;
  }

  this.apiFailed = false;
  this.from_address = temp_from;
  this.pwd = temp_pwd;
  this.failed = false;

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
  this.failedRecoveries = 0;
  that.users = [];

  apiCalls.UserAddressBrowse(this.from_address, this.pwd)
  .then(function (userAddressResponse) {
    var userId = userAddressResponse.Context.Session.UserId,
      userAddresses = userAddressResponse.Result.UserAddressBrowse.UserAddresses.UserAddress;

    userAddresses = [].concat(userAddresses || []);

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
  }).then(callback.onSuccess)
  .catch(function () {
    that.apiFailed = true;
    callback.onError();
  }).then(that.createUAs)
  .then(that.createSubscriptions)
  .catch(that.recoverUAs);
};

SIP_EXT.iConnectCheck = function (pref, call) {
  var timeoutId;

  var failureTimeout = function (e) {
    clearTimeout(timeoutId);
    if (call && call.onError) {
      call.onError();
    }
  };

  dbg.log(this.log_context, 'Verifying Internet Connectivity');
  apiCalls.NoOp().then(function () {
    clearTimeout(timeoutId);
    call.onSuccess();
  }).catch(failureTimeout);

  timeoutId =  setTimeout(failureTimeout, 30000) // 30 seconds
};

SIP_EXT.createUAs = function () {
  var promises = [],
    that = SIP_EXT;

  that.users.forEach(function (user) {
    var config = {
      wsServers: ['wss://edge.sip.onsip.com'],
      traceSip: true,
      register: false,
      userAgentString: SIP.C.USER_AGENT + ' OnsipChromeCallAssistant/2.0.0-dev',
      uri: user.uri,
      authorizationUser: user.authorizationUser,
      password: user.password
    };

    user.ua = new SIP.UA(config);

    user.ua.data = user.ua.data || {};
    user.ua.data.failedRecoveries = 0;

    promises.push(new Promise(function (resolve, reject) {
      var intervalId = setTimeout(reject, 10000);

      user.ua.afterConnected(function () {
        clearTimeout(intervalId);
        //disconnected does not come out as often as expected
        // so use later 'connected's for recovery
        user.ua.on('connected', that.recoverUA.bind(that, user));

        resolve();
      });
    }));

    user.ua.on('disconnected', that.recoverUA.bind(that, user));

    user.ua.start();
  });

  window.addEventListener('online', that.recoverUAs);

  return Promise.all(promises);
};

SIP_EXT.allUAsConnected = function () {
  return SIP_EXT.users && SIP_EXT.users.every(function (user) {
    return user.ua && user.ua.isConnected();
  });
};

SIP_EXT.removeUAs = function () {
  SIP_EXT.users.forEach(function (user) {
    if (user.ua) {
      user.ua.removeAllListeners();
      user.ua.stop();

      delete user.ua;
    }
  });

  window.removeEventListener('online', this.recoverUAs);
};

SIP_EXT.recoverUAs = function () {
  var that = SIP_EXT;

  dbg.log('SIPJS', 'recovering all UAs');

  that.removeUAs();

  if (that.failedRecoveries > 3) {
    dbg.log('SIPJS', 'giving up on recovery');
    //exit, 30 second auto-recovery will catch up and error_out in background_page.js
    return;
  }

  that.createUAs()
  .then(that.createSubscriptions)
  .then(function () {
    //major retry complete
    that.failedRecoveries = 0;
  })
  .catch(function () {
    that.failedRecoveries++;
    that.recoverUAs();
  });
};

SIP_EXT.recoverUA = function (user) {
  var that = SIP_EXT,
    intervalId;

  dbg.log('SIPJS', 'recovering UA for ' + user.uri);

  if (!user.ua || user.ua.data.failedRecoveries > 3) {
    that.failedRecoveries = 0;
    dbg.log('SIPJS', 'single recovery failed 4 times, moving to total recovery');
    that.recoverUAs();
  }

  if (!user.ua.isConnected()) {
    user.ua.start();
  }

  if (user.sub) {
    user.sub.unsubscribe();
    user.sub.removeAllListeners();
    delete user.sub;
  }

  failureTimeout = function () {
    user.ua.data.failedRecoveries++;
    that.recoverUA(user);
  };

  intervalId = setTimeout(failureTimeout, 10000);

  user.ua.afterConnected(function () {
    clearTimeout(intervalId);
    intervalId = setTimeout(failureTimeout, 10000);

    that.createSub(user);
    user.sub.once('notify', function () {
      user.ua.data.failedRecoveries = 0;
      clearTimeout(intervalId);
    });

    user.sub.once('failed', that.recoverUA.bind(that, user));
  });
};

SIP_EXT.createSub = function (user) {
  /** Re-subscribe every 45 min **/
  var expiresTime  = 60 * 45,
    that = SIP_EXT;

  user.firstNotify = true;
  user.savedDialogs = [];
  user.ignoredDialogs = [];

  dbg.log('SIPJS', 'creating subscription for ' + user.uri);

  user.sub = user.ua.subscribe(user.uri, 'dialog', {expires: expiresTime});

  user.sub.on('notify', that.handleDialog.bind(that, user));
  user.sub.once('failed', that.recoverUA.bind(that, user));
};

SIP_EXT.createSubscriptions = function () {
  var that = SIP_EXT,
    promises = [];

  dbg.log('SIPJS', 'UAs Connected, creating subscriptions');

  that.users.forEach(function (user) {
    that.createSub(user);

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

  //dtls causes duplicate entries in the NOTIFY with different Call Ids,
  //so we strip them and leave the one we saw first
  //sometimes gateway'ed calls flip uris, so check both ways
  // known issue: if a calls b and b calls a and both are ringing simultaneously, you will only see 1
  function isDtlsDupe(incomingDialog) {
    return user.ignoredDialogs[incomingDialog.data.callId] ||
    Object.keys(user.savedDialogs).some(function (savedDialogId) {
      var savedDialog = user.savedDialogs[savedDialogId];

      if ((savedDialog.data.callId !== incomingDialog.data.callId) &&
          (!savedDialog.data.confirmedTime && !incomingDialog.data.confirmedTime) &&
          (((savedDialog.data.localUri === incomingDialog.data.localUri) &&
            (savedDialog.data.remoteUri === incomingDialog.data.remoteUri)) ||
           ((savedDialog.data.localUri === incomingDialog.data.remoteUri) &&
            (savedDialog.data.remoteUri === incomingDialog.data.localUri)))) {
        user.ignoredDialogs[incomingDialog.data.callId] = true;
        return true;
      }
    });
  }

  //updates first, then dupes can be checked
  for (var callId in dialogs) {
    var savedDialog = user.savedDialogs[callId];
    var incomingDialog = dialogs[callId];
    //'unique' in a value in an empty array is why the data check is here
    if (!incomingDialog.data) {
      return;
    }
    dbg.log('SIPJS', 'on notify: condensed dialog', incomingDialog.data.callId, 'is in state', incomingDialog.data.state);

    if (savedDialog) {
      if (incomingDialog.data.state !== savedDialog.data.state) {
        incomingDialog.data.changed = true;
        user.savedDialogs[callId] = incomingDialog;
      }
      delete dialogs[callId];
    }
  }

  //at this point, all that is left is dialogs not found in savedDialogs
  for (var callId in dialogs) {
    var incomingDialog = dialogs[callId];
    //'unique' in a value in an empty array is why the data check is here
    if (!incomingDialog.data) {
      return;
    }
    if (incomingDialog.data.state !== 'terminated' && !isDtlsDupe(incomingDialog)) {
      incomingDialog.data.changed = !user.firstNotify;
      user.savedDialogs[callId] = incomingDialog;
    }
  }

  if (user.firstNotify) {
    user.firstNotify = false;
    return;
  }

  //proceeding is dialing -> created is dialing
  //early is ringing -> requested is ringing
  //terminated -> retract

  //we now have the newest dialog from an actually new event (non-first notify), lets figure out what to publish
  for (var callId in user.savedDialogs) {
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

  if (user.savedDialogs.length === 0) {
    user.ignoredDialogs = [];
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

  apiCalls.AuthCallSetup(from_address, to_address, this.from_address, this.pwd).then(function () {
    dbg.log(that.log_context, 'Create call success');
  }).catch(function () {
    dbg.log(that.log_context, 'Create call error');
  });
};