/** SIP supported functionality **/

var OX_EXT = {
    "name"         : "OX Based Chrome Plug-in",
    "ox_conn"      : undefined,
    "strophe_conn" : undefined,
    "call_handle"  : undefined,
    "from_address" : undefined,
    "apps"         : [],
    "jid"          : undefined,
    "pwd"          : undefined,
    "failures"     : 0,
    "MAX_FAILURES" : 20,
    "DEF_TIMEOUT"  : 7000
};

OX_EXT.createStropheConnection = function (url) {
    console.log('ON_EXT :: Initialized Strophe Connection');
    this.strophe_conn = new Strophe.Connection( url );   
};

OX_EXT.iConnectCheck = function (pref, call) {
    var xhr  = new XMLHttpRequest();
    var url  = pref.get ('onsipHttpBase');
    var ok   = false;
    var that = this;
    var tmout = 30000; // 30 sec

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

    console.log ('OX_EXT APP :: Verifying Internet Connectivity');
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
	console.log ('OX_EXT :: Resetting Connection');
	this.strophe_conn.disconnect();	
	this.strophe_conn.reset();	
	reset = true;
    } 
	
    this.createStropheConnection ( url );

    this.strophe_conn.rawInput = function (data) {
	console.log( 'STROPHE RAW INPUT  :: ' + data );
    };

    this.strophe_conn.rawOutput = function (data) {
	console.log( 'STROPHE RAW OUTPUT :: ' + data );
    };

    Strophe.log = function (level, msg) {
	if (true || level === Strophe.LogLevel.ERROR){
	    console.log( 'STROPHE LOG - ' + level + ' :: Message : ' + msg );
	}
    };
        
    if (reset) {
        var to = that._connect (callback);   
	setTimeout  (to, that.DEF_TIMEOUT);
	console.log ('OX_EXT :: Reset BOSH *************************');
    } else {
	console.log ('OX_EXT :: New BOSH Connection &&&&&&&&&&&&&&&&&&&&&&&&&');
	that._connect (callback);
    }
};

OX_EXT._connect   = function (callback) {
    var that      = this;
    /** var timeout   = this.DEF_TIMEOUT * that.failures; **/
    /**
    var rebound_f = function () {	
	that.failures += 1;
	if (that.failures <= that.MAX_FAILURES) {
	    if (!that.connecting) {
		console.log ('STROPHE :: Trying to re-bound & re-establish connection');
		console.log ('STROPHE :: Connecting ' + that.jid + ' - ' + that.from_address);
		that._connect (callback);
	    } else {		
		console.log ('STROPHE :: HOLD trying to re-bound & re-establish connection, set on timer');	
		setTimeout (rebound_f, 60000);
	    }
	}
    }
    **/
    OX.StropheAdapter.strophe = this.strophe_conn;    
    this.strophe_conn.connect(this.jid, this.pwd, function( status ) {
       switch ( status ){
           case Strophe.Status.CONNECTING : 
	       console.log( 'STROPHE :: Connecting ... ' );
	       break;
	   case Strophe.Status.CONNFAIL :
	       if (callback && callback.onError) {
		   callback.onError ('Connection Failed');
	       }
	       console.log( 'STROPHE :: Connection failed' );
	       break;
	   case Strophe.Status.ERROR :
	       /** setTimeout (rebound_f, timeout); **/
	       if (callback && callback.onError) {
                   callback.onError ('Connection Error through Strophe');
               }
	       console.log( 'STROPHE :: Connection Error' );
	       break;
	   case Strophe.Status.AUTHENTICATING :	       
	       console.log( 'STROPHE :: Authenticating' );
	       break;
	   case Strophe.Status.AUTHFAIL:	    	      
	       if (callback && callback.onError) {
		   callback.onError ('Connection Error - Authenticating');
	       }
	       console.log( 'STROPHE :: Authentication Failed ' );
	       break;
	   case Strophe.Status.CONNECTED:
	       console.log( 'STROPHE :: Connected' );
	       that.failures   = 0;
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
	       //setTimeout (rebound_f, timeout);
	       console.log ('STROPHE :: Default Case State' );
	       break;
       }	    
    });
};

OX_EXT._recycle   = function () {
    this.authorizePlain ({
        onSuccess : function () {
	    console.log ('OX_EXT :: Successfully Re-Authorized & Re-Subscribed');
	},
	onError   : function (error) {
	    /** TODOs : There are cases that we'll have to do a harder reset of our connections **/
	    console.log ('OX_EXT :: Error in recycling ' + error);
	}
    });
};

OX_EXT.createCall = function (from_address, to_address, call_setup_id) {    
    if ( isNumberFormatted (to_address) ) {
	to_address = 'sip:' + to_address;
    } else {
	to_address = 'sip:' + to_address + '@' + getDomain(from_address);
    }
    from_address = 'sip:' + from_address;
    console.log ('OX_EXT :: Create Call - ' + from_address + ' ^ ' + to_address);

    this.ox_conn.ActiveCalls.create(to_address, from_address, call_setup_id, {
       onSuccess : function (packet) {	 
	  console.log('OX_EXT :: create call success');
       },
       onError   : function (packet) {
          console.log('OX_EXT :: create call error  ');
       }
    });
};

OX_EXT.authorizePlain = function (callback) {     
    var sip = this.from_address; 
    var jid = this.jid;          
    var pwd = this.pwd;          
	   
    console.log ( 'OX_EXT :: Authorize ' );
    var that = this;
    var call = {
       onSuccess : function () {
	   console.log ('OX_EXT :: Successfully Authorized')
	   that.subscribe (callback);
       },
       onError  : function (error) {
	   if (callback && callback.onError) {
	       callback.onError ('Connection Error through Authorize Plain');
	   } 
	   console.log ('OX_EXT :: Error in Authorize Plain');           
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
	    console.log ('OX_EXT :: Number of subscriptions ' + subscriptions.length);
		
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
			    console.log ('OX_EXT :: Calling onSuccess method of callback object');
			    callback.onSuccess ();
			}
			console.log ('OX_EXT :: Successfully Got Subscriptions ');
		    },
		    onError   : function (requestedURI, finalURI, packet) {
		        if (callback && callback.onError) {
		            callback.onError ('Error while trying to retrieve subscriptions');
			}
			console.log ('OX_EXT :: Error in Subscriptions');
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
			console.log ('OX_EXT ::  Successfully Subscribed');
		    },
		    onError  : function (requestedURI, finalURI, packet) {
		        if (callback && callback.onError) {
			    callback.onError ('Error while subscribing');
			}
			console.log ('OX_EXT ::  Error while Subscribing');
		    }
		});
	    }           
        },
        onError  : function (requestedURI, finalURI, packet) {
	    if (callback && callback.onError) {
		callback.onError ('Error while trying to retrieve subscriptions');
	    }
            console.log ('OX_EXT :: Error while retrieving subscriptions');
        }
    };

    this.ox_conn.ActiveCalls.getSubscriptions (node, call);
};


OX_EXT.handleActiveCallUnsubscribed = function () {   
    console.log ( "OX_EXT :: UNSUBSCRIBED" );
};

OX_EXT.handleActiveCallSubscribe = function () {
    console.log ( 'OX_EXT :: SUBSCRIBE' );
};

OX_EXT.handleActiveCallPending = function () {
    console.log ( 'OX_EXT :: PENDING' );
    this.__publishEventToApps ('activeCallPending');
};

OX_EXT.handleActiveCallPublish = function ( item ) {    
    console.log ("OX_EXT :: Call Dialog State : " + item.dialogState);
    this.call_handle = item;
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
    console.log ('OX_EXT :: RETRACT ' + itemURI );
    delete this.call_handle;
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
