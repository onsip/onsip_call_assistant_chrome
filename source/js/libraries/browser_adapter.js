/** SIP supported functionality **/

var OX_EXT = {
    "name"         : "OX Based Chrome Plug-in",
    "ox_conn"      : null,
    "strophe_conn" : null,
    "call_handle"  : null,
    "apps"         : []
};

OX_EXT.createStropheConnection = function (url) {
    console.log( 'ON_EXT :: Initialized Strophe Connection' );
    this.strophe_conn = new Strophe.Connection( url );   
}

OX_EXT.init = function () {    
    var jid        = 'oren@junctionnetworks.com/chrome-ox-plugin';
    var pwd        = 'wvF9gskFEyGmrwsS';
    
    //this.createStropheConnection( 'http://localhost/http-bind/' );  
    this.createStropheConnection ( 'https://dashboard.onsip.com/http-bind' );
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

    this.strophe_conn.connect(jid, pwd, function( status ) {
       switch ( status ){
           case Strophe.Status.CONNECTING : 
	       console.log( 'STROPHE :: Connecting ... ' );
	       break;
	   case Strophe.Status.CONNFAIL :
	       console.log( 'STROPHE :: Connection failed' );
	       break;
	   case Strophe.Status.ERROR :
	       console.log( 'STROPHE :: Connection Error' );
	       break;
	   case Strophe.Status.AUTHENTICATING :
	       console.log( 'STROPHE :: Authenticating' );
	       break;
	   case Strophe.Status.AUTHFAIL:
	       console.log( 'STROPHE :: Authentication Failed' );
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

	       var i;
	       for (i = 0; i < this.apps.length; i+= 1){
		   this.apps[i].strophe_Connected();
	       }

	       this.authorizePlain ();
	       break;
	   default :
	       console.log ('STROPHE :: Something else' );
	       break;
       }	    
    }.bind(this));
};

OX_EXT.createCall = function () {
    
    console.log( 'Create Call' );
    
    var to   = 'sip:18008013381@junctionnetworks.com',
	from = 'sip:oren@junctionnetworks.com';
    
    this.ox_conn.ActiveCalls.create(to, from, null, {
       onSuccess : function (packet) {	 
	  console.log('BOSH :: create call success');
       },
       onError   : function (packet) {
          console.log('BOSH :: create call error  ');
       }
    });

};

OX_EXT.cancelCall = function () {

    if (this.call_handle) {
	this.call_handle.hangup();
    }

};

OX_EXT.authorizePlain = function () {
    
    var sip = 'oren@junctionnetworks.com';
    var pwd = 'wvF9gskFEyGmrwsS';
    var jid = 'oren@junctionnetworks.com';
    
    console.log ( 'OX_EXT :: Authorize ' );
    var that = this;
    var callback = {
       onSuccess : function () {
	   console.log ( '+++++++++++++++++++++  Successfully Authorized' );
	   that.subscribe ();
       },
       onError  : function (error) {
	  console.log ( '+++++++++++++++++++++  Error in authorization' );
       }
    };
        
    this.ox_conn.Auth.authorizePlain (sip, pwd, jid, true, callback);

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

OX_EXT.subscribe = function () {
        
    var that     = this;
    var callback = {
        onSuccess : function (requestedURI, finalURI, subscriptions, packet) {
            var subscription,
	    expiration = new Date(),
	    options = {}, i = 0;

	    if ( subscriptions.length === 0 ) {
	       that.ox_conn.ActiveCalls.subscribe ('/me/oren@junctionnetworks.com', {
	          onSuccess : function (requestedURI, finalURI, subscriptions, packet) {
                     console.log ( '+++++++++++++++++++++  Successfully Subscribed' );
                  },
                  onError  : function (requestedURI, finalURI, packet) {
                     console.log ( '+++++++++++++++++++++  Error while Subscribing' );
                  }
	       });
	    } else { 
               expiration.setDate (expiration.getDate() + 1);
               console.log ('Number of subscriptions ' + subscriptions.length);
	      
	       subscription = subscriptions[0];
	       subscription = { node    : "/me/oren@junctionnetworks.com", jid: subscription.jid, subid: subscription.subid };
	       options      = { expires : expiration };
	       that.ox_conn.ActiveCalls.configureNode (subscription, options, {
	          onSuccess : function (requestedURI, finalURI, subscriptions, packet) {
		     console.log ( '+++++++++++++++++++++  Successfully Got Subscriptions' );
		  },
		  onError   : function (requestedURI, finalURI, packet) {
		     console.log ( '+++++++++++++++++++++  Error in Subscriptions' );
		  }
	       });               
            }            
        },
        onError  : function (requestedURI, finalURI, packet) {
            console.log ( '+++++++++++++++++++++  Error while retrieing subscriptions   ' );
        }
    };

    this.ox_conn.ActiveCalls.getSubscriptions ('/me/oren@junctionnetworks.com', callback);

};

OX_EXT.handleActiveCallUnsubscribed = function () {
    
    console.log ( "BOSH :: UNSUBSCRIBED" );

};

OX_EXT.handleActiveCallSubscribe = function () {

    console.log ( 'BOSH :: SUBSCRIBE' );

};

OX_EXT.handleActiveCallPending = function () {

    console.log ( 'BOSH :: PENDING' );
    this.__publishEventToApps (activeCallPending);

};

OX_EXT.handleActiveCallPublish = function ( item ) {
    
    console.log ( 'BOSH :: CALL MESSAGE : ' + item.dialogState );
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

    console.log ( 'BOSH :: RETRACT ' + itemURI );
    delete this.call_handle;
    this.__publishEventToApps ('activeCallRetract', itemURI);
   
};

OX_EXT.__publishEventToApps = function (event) {
    var i,
       len  = this.apps.length,
       args = [];
    
    for (i = 1; i < arguments.length; i += 1) {
	args.push (arguments[i]);
    }
    for (i = 0; i < len; i+= 1) {
	if (this.apps[i] && typeof this.apps[i][event] === 'function'){ 
	   console.log (event + ' --->  ' + args.length);
	   this.apps[i][event] (args);	   
	}	  
    }

};