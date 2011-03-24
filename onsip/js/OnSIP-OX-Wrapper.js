/** SIP supported functionality **/

var OX_EXT = {
    "name"         : "OX Based Chrome Plug-in",
    "ox_conn"      : undefined,
    "strophe_conn" : undefined,
    "from_address" : undefined,
    "apps"         : [],
    "jid"          : undefined,
    "pwd"          : undefined,
    "log_context"  : "OX_EXT",
    "store_cs_id"  : undefined,
    "DEF_TIMEOUT"  : 7000
};

OX_EXT.createStropheConnection = function (url) {
    dbg.log (this.log_context, 'Initialized Strophe Connection');
    this.strophe_conn = new Strophe.Connection( url );
};

OX_EXT.iConnectCheck = function (pref, call) {
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
        } else {
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

    dbg.log (this.log_context, 'Verifying Internet Connectivity');
    xhr.open ("GET", url, false);
    setTimeout (a, tmout);
    xhr.send ();
};

OX_EXT.init = function (pref, callback) {
    var url           = pref.get ('onsipHttpBase');
    var that          = this;
    var reset         = false;
    this.from_address = pref.get ('fromAddress');
    this.pwd          = pref.get ('onsipPassword');
    this.jid          = this.from_address + '/chrome-ox-plugin';

    if (this.strophe_conn) {
	dbg.log (this.log_context, 'Resetting Connection');
	this.strophe_conn.disconnect();
	this.strophe_conn.reset();
	reset = true;
    }

    this.createStropheConnection ( url );

    this.strophe_conn.rawInput = function (data) {
	dbg.log ('STROPHE RAW','INPUT  :: ' + data );
    };

    this.strophe_conn.rawOutput = function (data) {
	dbg.log ('STROPHE RAW','OUTPUT :: ' + data );
    };

    Strophe.log = function (level, msg) {
	if (true || level === Strophe.LogLevel.ERROR){
	    dbg.log ('STROPHE LOG', level + ' :: Message : ' + msg );
	}
    };

    if (reset) {
        var to = that._connect (callback);
	setTimeout  (to, this.DEF_TIMEOUT);
        dbg.log (this.log_context, 'Reset BOSH in ' + this.DEF_TIMEOUT + ' seconds');
    } else {
	dbg.log (this.log_context, 'Estalish BOSH Connection &&&&&&&&&&&&&&&&&&&&&');
	that._connect (callback);
    }
};

OX_EXT._connect   = function (callback) {
    var that      = this;
    OX.StropheAdapter.strophe = this.strophe_conn;
    this.strophe_conn.connect(this.jid, this.pwd, function( status ) {
       switch ( status ){
           case Strophe.Status.CONNECTING :
	       dbg.log('STROPHE', 'Connecting ... ' );
	       break;
	   case Strophe.Status.CONNFAIL :
	       if (callback && callback.onError) {
		   callback.onError ('Connection Failed');
	       }
	       dbg.log('STROPHE', 'Connection failed' );
	       break;
	   case Strophe.Status.ERROR :
	       if (callback && callback.onError) {
                   callback.onError ('Connection Error through Strophe');
               }
	       dbg.log('STROPHE', 'Connection Error' );
	       break;
	   case Strophe.Status.AUTHENTICATING :
	       dbg.log('STROPHE', 'Authenticating' );
	       break;
	   case Strophe.Status.AUTHFAIL:
	       if (callback && callback.onError) {
		   callback.onError ('Connection Error - Authenticating');
	       }
	       dbg.log('STROPHE', 'Authentication Failed ' );
	       break;
	   case Strophe.Status.CONNECTED:
	       dbg.log('STROPHE', 'Connected' );
       	       that.ox_conn    = OX.Connection.extend( { connection : OX.StropheAdapter } );
	       that.ox_conn.initConnection();

	       that.ox_conn.ActiveCalls.registerSubscriptionHandlers();
	       that.ox_conn.ActiveCalls.registerHandler( "onPublish"     , that.handleActiveCallPublish.bind (that));
	       that.ox_conn.ActiveCalls.registerHandler( "onRetract"     , that.handleActiveCallRetract.bind (that));
	       that.ox_conn.ActiveCalls.registerHandler( "onPending"     , that.handleActiveCallPending.bind (that));
	       that.ox_conn.ActiveCalls.registerHandler( "onSubscribed"  , that.handleActiveCallSubscribe.bind (that));
	       that.ox_conn.ActiveCalls.registerHandler( "onUnsubscribed", that.handleActiveCallUnsubscribed.bind (that));

	       that.authorizePlain (callback);
	       break;
	   default :
	       dbg.log ('STROPHE', 'Default Case State' );
	       break;
       }
    });
};


OX_EXT._recycle   = function () {
    var that = this;
    this.authorizePlain ({
        onSuccess : function () {
	    dbg.log (that.log_context, 'Successfully Re-Authorized & Re-Subscribed');
	},
	onError   : function (error) {
	    /** TODOs : There are cases that we'll have to do a harder reset of our connections **/
	    dbg.log (that.log_context, 'Error in recycling ' + error);
	}
    });
};

OX_EXT.createCall = function (from_address, to_address, call_setup_id) {
    var that = this;
    if ( isNumberFormatted (to_address) ) {
	to_address = 'sip:' + to_address;
    } else {
	to_address = 'sip:' + to_address + '@' + getDomain(from_address);
    }
    from_address = 'sip:' + from_address;
    dbg.log (this.log_context, 'Create Call - ' + from_address + ' ^ ' + to_address + ' with setup_id ' + call_setup_id);
    this.ox_conn.ActiveCalls.create(to_address, from_address, call_setup_id, {
       onSuccess : function (packet) {
           dbg.log(that.log_context, 'Create call success');
	   that.store_cs_id = call_setup_id;
       },
       onError   : function (packet) {
	   dbg.log(that.log_context, 'Create call error');
       }
    });
};

OX_EXT.authorizePlain = function (callback) {
    var sip = this.from_address;
    var jid = this.jid;
    var pwd = this.pwd;

    dbg.log (this.log_context, 'Authorize Plain');
    var that = this;
    var call = {
       onSuccess : function () {
	   dbg.log (that.log_context, 'Successfully Authorized')
	   that.subscribe (callback);
       },
       onError  : function (error) {
	   if (callback && callback.onError) {
	       callback.onError ('Connection Error through Authorize Plain');
	   }
	   dbg.log (that.log_context, 'Error in Authorize Plain');
       }
    };

    this.ox_conn.Auth.authorizePlain (sip, pwd, jid, true, call);
};

/**  TODO :  We want to be prudent about when we recycle our subscriptions **/
/**          This should be done during some state of inactivity           **/
OX_EXT.subscribe = function (callback) {
    var sip      = this.from_address;
    var node     = '/me/' + sip;
    var that     = this;
    var j, len;

    /** Re-authorize & Re-subscribe every 45 min **/
    var timeout  = 60000 * 45;

    var call     = {
        onSuccess : function (requestedURI, finalURI, subscriptions, packet) {
            var subscription, expiration = new Date(), options = {}, i = 0;

	    expiration.setDate (expiration.getDate() + 1);
	    dbg.log (that.log_context, 'Number of subscriptions ' + subscriptions.length);

	    for (j = 0, len = subscriptions.length; j < len; j += 1) {
		subscription = subscriptions[j];
		if (subscription.jid.indexOf ('chrome-ox-plugin') > 0) {
		    subscription = { node    : node, jid: subscription.jid, subid: subscription.subid };
		    break;
		} else {
		    subscription = undefined;
		}
	    }

	    if (subscription) {
		options      = { expires : expiration };
		that.ox_conn.ActiveCalls.configureNode (subscription, options, {
		    onSuccess : function (requestedURI, finalURI, subscriptions, packet) {
		        var m = that._recycle.bind (that);
			setTimeout (m, timeout);
			if (callback && callback.onSuccess) {
			    dbg.log (that.log_context, 'Calling onSuccess method of callback object');
			    callback.onSuccess ();
			}
			dbg.log (that.log_context, 'Successfully Got Subscriptions ');
		    },
		    onError   : function (requestedURI, finalURI, packet) {
		        if (callback && callback.onError) {
		            callback.onError ('Error while trying to retrieve subscriptions');
			}
			dbg.log (that.log_context, 'Error in Subscriptions');
		    }
	       });
	    } else {
		that.ox_conn.ActiveCalls.subscribe (node, {
		    onSuccess : function (requestedURI, finalURI, subscriptions, packet) {
		        var f = that._recycle.bind (that);
			setTimeout (f, timeout);
			if (callback && callback.onSuccess) {
			    callback.onSuccess ();
			}
			dbg.log (that.log_context, 'Successfully Subscribed');
		    },
		    onError  : function (requestedURI, finalURI, packet) {
		        if (callback && callback.onError) {
			    callback.onError ('Error while subscribing');
			}
			dbg.log (that.log_context, 'Error while Subscribing');
		    }
		});
	    }
        },
        onError  : function (requestedURI, finalURI, packet) {
	    if (callback && callback.onError) {
		callback.onError ('Error while trying to retrieve subscriptions');
	    }
            dbg.log (that.log_context, 'Error while retrieving subscriptions');
        }
    };

    this.ox_conn.ActiveCalls.getSubscriptions (node, call);
};


OX_EXT.handleActiveCallUnsubscribed = function () {
    dbg.log (this.log_context, "UNSUBSCRIBED" );
};

OX_EXT.handleActiveCallSubscribe = function () {
    dbg.log (this.log_context, 'SUBSCRIBE' );
};

OX_EXT.handleActiveCallPending = function () {
    dbg.log (this.log_context, 'PENDING' );
    this.__publishEventToApps ('activeCallPending');
};

OX_EXT.handleActiveCallPublish = function ( item ) {
    dbg.log (this.log_context, "Call Dialog State : " + item.dialogState);
    switch ( item.dialogState ) {
     case "created":
	this.__publishEventToApps ('activeCallCreated'  , item);
	break;
     case "requested":
	this.__publishEventToApps ('activeCallRequested', item);
	break;
     case "confirmed":
	this.__publishEventToApps ('activeCallConfirmed', item);
	break;
    }
};

OX_EXT.handleActiveCallRetract = function ( itemURI ) {
    dbg.log (this.log_context, 'RETRACT ' + itemURI );
    this.__publishEventToApps ('activeCallRetract', itemURI);
};

OX_EXT.__publishEventToApps = function (event) {
    var i, len, args = [];
    for (i = 1, len = arguments.length; i < len; i += 1) {
	args.push (arguments[i]);
    }
    for (i = 0, len = this.apps.length; i < len; i+= 1) {
	if (this.apps[i] && typeof this.apps[i][event] === 'function'){
	   this.apps[i][event] (args);
	}
    }
};

OX_EXT.cancelCall = function (handle) {
    if (handle && handle.hangup) {
	handle.hangup();
    }
};


/**
OX_EXT.getSubscriptions = function () {

    console.log ('Get Subscriptions');

    var that     = this;
    var callback = {
	onSuccess : function (requestedURI, finalURI, subscriptions, packet) {
	    var subscription,
	        expiration = new Date(),
	        options = {}, i = 0;

	    expiration.setDate (expiration.getDate() + 1);
	    console.log ('Number of subscriptions ' + subscriptions.length);

	    for (i = 0; i < subscriptions.length; i += 1) {
		subscription = subscriptions[i];
		subscription = { node    : "/me/oren@junctionnetworks.com", jid: subscription.jid, subid: subscription.subid };
		options      = { expires : expiration };
		that.ox_conn.ActiveCalls.configureNode (subscription, options, {
		   onSuccess : function (requestedURI, finalURI, subscriptions, packet) {
		      console.log ( '+++++++++++++++++++++  Successfully Got Subscriptions' );
		   },
		   onError  : function (requestedURI, finalURI, packet) {
		      console.log ( '+++++++++++++++++++++  Error in Subscriptions' );
		   }
		});
            }
	    console.log ( '+++++++++++++++++++++  Successfully RENEWED Subscriptions' );
	},
	onError  : function (requestedURI, finalURI, packet) {
	    console.log ( '+++++++++++++++++++++  Error in Subscriptions' );
	}
    };

    this.ox_conn.ActiveCalls.getSubscriptions ('/me/oren@junctionnetworks.com', callback);
};

OX_EXT.unsubscribe = function () {

    var that     = this;
    var callback = {
        onSuccess : function (requestedURI, finalURI, subscriptions, packet) {
            var subscription;

            console.log ('Number of subscriptions ' + subscriptions.length);

            for (i = 0; i < subscriptions.length; i += 1) {
                subscription = subscriptions[i];
                subscription = { node    : "/me/oren@junctionnetworks.com", jid: subscription.jid, subid: subscription.subid };
		that.ox_conn.ActiveCalls.unsubscribe ('/me/oren@junctionnetworks.com', {
		   onSuccess : function (uri) {
		      console.log ( '-----------------------------  Successfully Unsubscribed ' );
		   },
		   onError   : function (uri) {
		      console.log ( '-----------------------------  Error while Unsubscribing ' );
		   }
		});
            }
        },
        onError  : function (requestedURI, finalURI, packet) {
            console.log ( '+++++++++++++++++++++  Error in Subscriptions' );
        }
    };

    this.ox_conn.ActiveCalls.getSubscriptions ('/me/oren@junctionnetworks.com', callback);

};
**/
