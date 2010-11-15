/** SIP supported functionality **/

var OX_EXT = {
    "name"         : "OX Based Chrome Plug-in",
    "ox_conn"      : null,
    "strophe_conn" : null,
    "call_handle"  : null,
    "from_address" : null,
    "apps"         : [],
    "jid"          : null,
    "pwd"          : null
};

OX_EXT.createStropheConnection = function (url) {
    console.log('ON_EXT :: Initialized Strophe Connection');
    this.strophe_conn = new Strophe.Connection( url );   
}

OX_EXT.init = function (pref, callback) {        
    var url           = pref.get ('onsipHttpBase');
    this.from_address = pref.get ('fromAddress');
    this.jid          = this.from_address + '/chrome-ox-plugin'; 
    this.pwd          = pref.get ('onsipPassword');
    
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
	       
       	       this.ox_conn = OX.Connection.extend( { connection : OX.StropheAdapter } ); 
	       this.ox_conn.initConnection(); 

	       this.ox_conn.ActiveCalls.registerSubscriptionHandlers();
	       this.ox_conn.ActiveCalls.registerHandler( "onPublish",      this.handleActiveCallPublish.bind (this));
	       this.ox_conn.ActiveCalls.registerHandler( "onRetract",      this.handleActiveCallRetract.bind (this));
	       this.ox_conn.ActiveCalls.registerHandler( "onPending",      this.handleActiveCallPending.bind (this));
	       this.ox_conn.ActiveCalls.registerHandler( "onSubscribed",   this.handleActiveCallSubscribe.bind (this));
	       this.ox_conn.ActiveCalls.registerHandler( "onUnsubscribed", this.handleActiveCallUnsubscribed.bind (this));
	       
	       this.authorizePlain (callback);
	       break;
	   default :
	       console.log ('STROPHE :: Default Case State' );
	       break;
       }	    
    }.bind(this));
};

OX_EXT._recycle   = function () {
    clearTimeout (this._recycle);
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

OX_EXT.createCall = function (from_address, to_address) {    
    if ( isNumberFormatted (to_address) ) {
	to_address = 'sip:' + to_address;
    } else {
	to_address = 'sip:' + to_address + '@' + getDomain(from_address);
    }
    from_address = 'sip:' + from_address;
    console.log ('OX_EXT :: Create Call - ' + from_address + ' ^ ' + to_address);

    this.ox_conn.ActiveCalls.create(to_address, from_address, null, {
       onSuccess : function (packet) {	 
	  console.log('OX_EXT :: create call success');
       },
       onError   : function (packet) {
          console.log('OX_EXT :: create call error  ');
       }
    });
};


OX_EXT.authorizePlain = function (pref, callback) {     
    var sip = this.from_address; //pref.get ('fromAddress');
    var jid = this.jid;          //sip + '/chrome-ox-plugin';
    var pwd = this.pwd;          //pref.get ('onsipPassword');    

    console.log ( 'OX_EXT :: Authorize ' );
    var that = this;
    var call = {
       onSuccess : function () {
	   console.log ('OX_EXT :: Successfully Authorized');
	   that.subscribe (pref, callback);
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
OX_EXT.subscribe = function (pref, callback) {
    var sip      = this.from_address; //pref.get ('fromAddress');
    var node     = '/me/' + sip;
    var that     = this;
    var timeout  = 60000 * 10;  // 10 min
    var call     = {
        onSuccess : function (requestedURI, finalURI, subscriptions, packet) {
            var subscription, expiration = new Date(), options = {}, i = 0;
            if ( subscriptions.length === 0 ) {
		that.ox_conn.ActiveCalls.subscribe (node, {
			onSuccess : function (requestedURI, finalURI, subscriptions, packet) {
			    var f = that._recycle.bind (that);
			    setTimeout (m, timeout);
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
            } else {
		expiration.setDate (expiration.getDate() + 1);
		console.log ('OX_EXT :: Number of subscriptions ' + subscriptions.length);

		subscription = subscriptions[0];
		subscription = { node    : node, jid: subscription.jid, subid: subscription.subid };
		options      = { expires : expiration };
		that.ox_conn.ActiveCalls.configureNode (subscription, options, {
			onSuccess : function (requestedURI, finalURI, subscriptions, packet) {
			    var m = that._recycle.bind (that);
			    setTimeout (m, timeout);
			    if (callback && callback.onSuccess) {
                                callback.onSuccess ();
                            }
			    console.log ('OX_EXT :: Successfully Got Subscriptions' );
			},
			onError   : function (requestedURI, finalURI, packet) {
			    if (callback && callback.onError) {
				callback.onError ('Error while trying to retrieve subscriptions');
			    }
			    console.log ('OX_EXT :: Error in Subscriptions');
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
    this.__publishEventToApps (activeCallPending);
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


/** Temporarily non-functional **/
/**
OX_EXT.cancelCall = function () {

    if (this.call_handle) {
	this.call_handle.hangup();
    }

};
**/

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
