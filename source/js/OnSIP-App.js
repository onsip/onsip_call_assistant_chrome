// Global vars
var activeTabId = 0;
var SIP_SETUP_ADDRESS = 'sip:call-setup@onsip.com';
var requestStack = Array();
var requestStackState = false;

OnsipApp = {};

OnsipApp.OX = function() {
  con: undefined;

  /**
   * Get Input values
   * @param formID
   * @param inputName
   */
  function _getFormValue(formID, inputName) {
    return $('form#' + formID + ' input[name=' + inputName + ']').val();
  }
  
  /**
   * Log a message
   * @param message text
   */
  function _addOutput(msg) {
      console.log(msg);
  }

  return {
    /**
     * Setup connection
     */
    setup: function (con) {
      var handlers = {};

      var adapter = OX.ConnectionAdapter.extend({
        _callbacks: [],

        jid: function () {return con.jid;},

        registerHandler: function (event, handler) {
          function wrapped(stanza) {
            var packetAdapter = {
              getFrom: function () {return stanza.getAttribute('from');},
              getType: function () {return stanza.getAttribute('type');},
              getTo:   function () {return stanza.getAttribute('to');},
              getNode: function () {return stanza;}
            };

            var newArgs = [packetAdapter];
            for (var i = 1, len = arguments.length; i < len; i++) {
              newArgs.push(arguments[i]);
            }

            handler.apply(this, newArgs);
            return true;
          }

          this.unregisterHandler(event);
          handlers[event] = con.addHandler(wrapped, null, event,
                                           null, null, null);
        },

        unregisterHandler: function (event) {
          if (handlers[event]) {
            con.deleteHandler(handlers[event]);
            delete handlers[event];
          }
        },

        send: function (xml, cb, args) {
          var node = document.createElement('wrapper');
          node.innerHTML = xml;         
          node = node.firstChild;

          if (cb) {
            function wrapped(stanza) {
              var packetAdapter = {
                getFrom: function () {return stanza.getAttribute('from');},
                getType: function () {return stanza.getAttribute('type');},
                getTo:   function () {return stanza.getAttribute('to');},
                getNode: function () {return stanza;}
              };

              var newArgs = [packetAdapter];
              for (var i = 0, len = args.length; i < len; i++) {
                newArgs.push(args[i]);
              }

              cb.apply(this, newArgs);
              return false;
            }

            var id = node.getAttribute('id');
            if (!id) {
              id = con.getUniqueId();
              node.setAttribute('id', id);
            }

            this._callbacks[id] = con.addHandler(wrapped, null, null,
                                                 null, id, null);
          }

          node.setAttribute('xmlns', 'jabber:client');
          return con.send(node);
        }
      });

      this.con = OX.Connection.extend({connection: adapter});
      this.con.initConnection();

      this.con.ActiveCalls.registerSubscriptionHandlers();
      this.con.ActiveCalls.registerHandler('onPublish',
                                           this._handleActiveCallPublish);
      this.con.ActiveCalls.registerHandler('onRetract',
                                           this._handleActiveCallRetract);
      this.con.ActiveCalls.registerHandler('onPending',
                                           this._handleActiveCallPending);
      this.con.ActiveCalls.registerHandler('onSubscribed',
                                           this._handleActiveCallSubscribe);
      this.con.ActiveCalls.registerHandler('onUnsubscribed',
                                           this._handleActiveCallUnsubscribe);
    },

    /**
    *  Authorize
    * @param FormID
    */
    authorize: function (formID) {
      var sip = _getFormValue(formID, 'sip-address'),
          pw  = _getFormValue(formID, 'password'),
          jid = _getFormValue(formID, 'jid');

      this.con.Auth.authorizePlain(sip, pw, jid, {
        onSuccess: function (packet) {
          var f      = packet.getNode().getElementsByTagName('x')[0].getElementsByTagName('field')[0],
              expiry = f.getElementsByTagName('value')[0].firstChild.nodeValue,
              note   = packet.getNode().getElementsByTagName('command')[0].getElementsByTagName('note')[0];

          _addOutput(note.firstChild.nodeValue + ', Authorized until: ' + expiry);
        },

        onError: function (packet) {
          _addOutput('AuthorizePlain Error');
        }
      });

      return false;
    },

    /**
     * Initiate a Call
     */
    createCall: function (params) {
        dbg.log('BOSH :: Create Call');
      var to   = 'sip:'+params.to,
          from = 'sip:'+params.from;

      this.con.ActiveCalls.create(to, from, {
        onSuccess: function (packet) {
          dbg.log('BOSH :: create call success');
        },

        onError: function (packet) {
          dbg.log('BOSH :: create call error');
        }
      });

      return false;
    },

    /**
     * Subscribe To node in order to recieve an incoming call
     */
    subscribeActiveCalls: function (node) {

      this.con.ActiveCalls.subscribe(node, {
        onSuccess: function ( reqURI, finalURI, packet ) {
          dbg.log('BOSH :: subscribe to node SUCCESS');
        },

        onError: function (reqURI, finalURI, packet) {
          dbg.log('BOSH :: subscribe to node ERROR');
        }
      });
    },

    /**
     * Unsubscribe from node
     */
    unsubscribeActiveCalls : function( node, item, callback ){
        
        this.con.ActiveCalls.unsubscribe( node, {
            onSuccess: function( uri ){
                dbg.log('BOSH :: Calls Unsubscribe Success');
                callback.onSuccess();
            },
            onError: function(uri){
                db.log('BOSH :: Calls Unsubscribe Error');
                callback.onError();
            }
        }, item );
    },

    /**
     * Get Subscription to node
     */
    getActiveCallsSubscriptions : function(node, connectCallback){
        this.con.ActiveCalls.getSubscriptions(node,{
            onSuccess: function(requestedURI, finalURI, subscriptions, packet){
                dbg.log('BOSH :: got ' + subscriptions.length  + ' Active subscribtions ' );

                var subscriptionArray = new Array();
                var subscribedNode = '/me/'+pref.get('fromAddress');
                for(var i = subscriptions.length-1; i >= 0; --i ){
                    var temp = {jid :subscriptions[i].jid, sid: subscriptions[i].subid};
                    subscriptionArray.push(temp);
                }

                // Unsubscribe Recursively by JID
                unsubscribeRecursively(node, subscriptions.length, subscriptionArray, connectCallback);
            },
            onError: function(requestedURI, finalURI, packet){
                dbg.log('BOSH :: ERROR while getting Active subscribtions');
            }
        });
    },

    /**
     * Listener for a Call Restract
     */
    _handleActiveCallRetract: function ( itemURI ) {
      dbg.log('BOSH::CALL Retract');
      // Clear RequestStack - these are global vars
      requestStackState = false;
      requestStack = [];

      // clear request number
      ///clearRequestedNumber();

      // Set phone extension to false
      pref.set('phoneExtension' , false);
      callInProgress = false;

      // Send Content script that call was retracted
      chrome.tabs.sendRequest( activeTabId, {
         incomingCallRetract : true
      }, function( response ){});
    },
    
    /**
     *  Listener for active calls
     */
    _handleActiveCallPublish: function (item) {
      dbg.log('BOSH::CALL MESSAGE : ' +item.dialogState);
 
      switch(item.dialogState){
            case "created":
                if(!isCreatedDetailsMatchRequested(item)){
                    // extract phone number
                    var phoneNumber = extractPhoneNumber( item.toURI );
                    // Check if highrise enabled
                    if(pref.get('highriseEnabled')){
                      getHighriseCompanies({
                          onSuccess: function(data){
                                // Try to Find matched Company
                                var company = getRightCompany( phoneNumber, data );
                                
                                if( company  != null ){
                                    // Prepare and Add a Note
                                    company.type = 'companies';
                                    onSipUser = pref.get( 'userInfo' );
                                    var note = '<note> <body> ' + onSipUser.Name+' called ' + company.name  + ' at '+ getDateAndTime(getTimezoneAbbrevation(pref.get('userTimezone'))) +'</body> </note>';
                                    addNoteToHighriseCustomerProfile(company, note);

                                    // Trigger Message display
                                    chrome.tabs.getSelected( null, function( tab ) {
                                        activeTabId = tab.id;
                                        if(!pref.get('popupDisabled')){
                                             chrome.tabs.sendRequest( tab.id, {outgoingCall: true, outgoingNumber : phoneNumber, outgoingName: company.name}, function( response ) {});
                                        }
                                    });
                                }else{
                                    // Else if company search result didn't give result we look for a Customer
                                    getHighriseContacts({
                                          onSuccess : function(data) {
                                              // Parse the matching Customer
                                              customer = getRightCustomer(phoneNumber, data);
                                              if(customer != null){

                                                  // Prepare and Add Note
                                                  onSipUser = pref.get( 'userInfo' );
                                                  var note = '<note> <body> ' + onSipUser.Name + ' called ' + customer.name + ' at '+ getDateAndTime(getTimezoneAbbrevation(pref.get('userTimezone'))) +'</body> </note>';
                                                  customer.type = 'people';
                                                  addNoteToHighriseCustomerProfile(customer, note);

                                                  // Trigger Message display
                                                  if(!pref.get('popupDisabled')){
                                                       chrome.tabs.getSelected( null, function( tab ) {
                                                            activeTabId = tab.id;
                                                            chrome.tabs.sendRequest( tab.id, {outgoingCall: true, outgoingNumber : phoneNumber, outgoingName: customer.name}, function( response ) {});
                                                       });
                                                  }
                                              }else{
                                                  // Else if we were not able to find  highrise customer/company we just display simple call message
                                                  // Trigger Message Display
                                                  if(!pref.get('popupDisabled')){
                                                      chrome.tabs.getSelected( null, function( tab ) {
                                                          activeTabId = tab.id;
                                                          chrome.tabs.sendRequest( tab.id, {outgoingCall: true, outgoingNumber : phoneNumber}, function( response ) {});
                                                      });
                                                  }
                                              }
                                          }
                                      });
                                }
                          }
                      });
                    }else{
                        // Simple call
                        // Trigger Message Display
                        if(!pref.get('popupDisabled')){
                                 chrome.tabs.getSelected( null, function( tab ) {
                                    activeTabId = tab.id;
                                    chrome.tabs.sendRequest( tab.id, {outgoingCall: true, outgoingNumber : phoneNumber}, function( response ) {});
                                });
                        }

                    }
                }

            break;
            case "requested":
                // Global var needed to handle click-to-call calls
                requestStack.push(item.branch);
                if(!requestStackState){
                    requestStackState = true;
                    setRequestedDetails(item);

                    // Extract phone number
                    var phoneNumber = extractPhoneNumber( item.fromURI );
                    ownSipAddress = 'sip:' + pref.get('fromAddress');
                    var callActionTitle = ' Incoming call from ';

                    // Handle call from string address
                    if(item.fromURI.replace(/;[a-zA-Z0-9_=]*/,'') == SIP_SETUP_ADDRESS){
                        break;
                    }
                    // Handle weather call is Icoming or Outgoing
                    if( item.toURI == ownSipAddress && item.callSetupID == null && !isFromSipAddress(item.fromURI)){
                        callActionTitle = ' Calling ';
                    }
                    
                    // if highrise Enabled
                    if(pref.get('highriseEnabled')){
                        dbg.log('APP::GET highrise Companies');
                        getHighriseCompanies({
                            onSuccess: function(data){
                                 // Prepare variables
                                 var company  = null;
                                 var extension = null;

                                 // Handle numbers with extension
                                 if(pref.get('phoneExtension') == 'null'){
                                     dbg.log('APP :: EXTENSION FALSE');
                                     company = getRightCompany( phoneNumber, data );
                                 }else{
                                     dbg.log('APP :: EXTENSION TRUE');
                                     extension = pref.get('phoneExtension');
                                 }

                                 // If matched Company found 
                                 if( company  != null ){
                                     // Prepare and add Note
                                     company.type = 'companies';
                                     onSipUser = pref.get( 'userInfo' );
                                     if( item.toURI == ownSipAddress && item.callSetupID == null ){
                                         var note = '<note> <body> ' + onSipUser.Name +' called ' + company.name + ' at '+ getDateAndTime(getTimezoneAbbrevation(pref.get('userTimezone'))) +'</body> </note>';
                                     }else{
                                         var note = '<note> <body> ' + company.name +' called ' + onSipUser.Name + ' at '+ getDateAndTime(getTimezoneAbbrevation(pref.get('userTimezone'))) +'</body> </note>';
                                     }
                                     addNoteToHighriseCustomerProfile(company, note);

                                     // Trigger Message Display
                                     if(!pref.get('popupDisabled')){
                                         chrome.tabs.getSelected( null, function( tab ) {activeTabId = tab.id;chrome.tabs.sendRequest( tab.id, {incomingCall: true, incomingNumber : phoneNumber, incomingName: company.name, incomingCallTitle: callActionTitle}, function( response ) {});});
                                     }
                                 }else{
                                     // Else if Company not found we look for Customer
                                      getHighriseContacts({
                                          onSuccess : function(data) {
                                              customer = getRightCustomer(phoneNumber, data, extension);
                                              if(customer != null){
                                                  // Prepare and add Note
                                                  onSipUser = pref.get( 'userInfo' );
                                                  if( item.toURI == ownSipAddress && item.callSetupID == null){
                                                      var note = '<note> <body> ' + onSipUser.Name + ' called ' + customer.name + ' at '+ getDateAndTime(getTimezoneAbbrevation(pref.get('userTimezone'))) +'</body> </note>';
                                                  }else{
                                                      var note = '<note> <body> ' + customer.name + ' called ' + onSipUser.Name + ' at '+ getDateAndTime(getTimezoneAbbrevation(pref.get('userTimezone'))) +'</body> </note>';
                                                  }
                                                  customer.type = 'people'
                                                  addNoteToHighriseCustomerProfile(customer, note)
                                                  
                                                  // Trigger Message Display
                                                  if(!pref.get('popupDisabled')){
                                                      chrome.tabs.getSelected( null, function( tab ) {activeTabId = tab.id;chrome.tabs.sendRequest( tab.id, {incomingCall: true, incomingNumber : phoneNumber, incomingName: customer.name,  incomingCallTitle: callActionTitle}, function( response ) {});});
                                                  }

                                              }else{
                                                  // Trigger call from unidentified number
                                                  if(!pref.get('popupDisabled')){
                                                      chrome.tabs.getSelected( null, function( tab ) { activeTabId = tab.id; chrome.tabs.sendRequest( tab.id, {incomingCall: true, incomingNumber : phoneNumber, incomingCallTitle: callActionTitle}, function( response ) {});});
                                                  }
                                              }

                                          }
                                      });
                                 }
                            }
                        });
                    }else{
                        // Trigger Message | regular call without looking in highrise
                        if(!pref.get('popupDisabled')){
                            chrome.tabs.getSelected( null, function( tab ) { activeTabId = tab.id; chrome.tabs.sendRequest( tab.id, {incomingCall: true, incomingNumber : phoneNumber, incomingCallTitle: callActionTitle}, function( response ) {});});
                        }
                    }
                    

                }
                break;
            case "confirmed":
                // Prepare sip address
                ownSipAddress = 'sip:' + pref.get('fromAddress');
                
                if( item.toURI !=  ownSipAddress){
                    dbg.log('App::Clearing Request number');
                    clearRequestedNumber();
                }

                // Trigger Call confirmed message
                if(!pref.get('popupDisabled')){
                    dbg.log('APP::CALL Confirmed ');
                    chrome.tabs.sendRequest( activeTabId, {incomingCallConfirmed: true}, function( response ) {});
                }
            default :
                break;
      }
    },

    _handleActiveCallSubscribe: function (uri) {

    },

    _handleActiveCallUnsubscribe: function (uri) {

    },

    _handleActiveCallPending: function (uri) {
      console.log(uri);
    },

    pushRosterGroups: function (formID) {
      var jid = null;
      this.con.Rosters.pushRosterGroups(jid, {
        onSuccess: function (packet) {
          console.log('successful roster push');
        },

        onError: function (packet) {
          console.log('ERROR: roster push failed.');
        }
      });

      return false;
    },

    requestRoster: function (formID) {
      var iq    = OX.XMPP.IQ.extend(),
          query = OX.XMPP.Stanza.extend();

      var callbacks = {
        onSuccess: function (packet) {
          console.log('successful roster request');
        },

        onError: function (packet) {
          console.log('ERROR: roster request failed.');
        }
      };

      iq.type('get');
      query.name = 'query';
      query.attr('xmlns', 'jabber:iq:roster');
      iq.addChild(query);

      OnsipApp.OX.con.send(iq.toString(), function (packet) {
        if (!packet)
          return;

        if (packet.getType() === 'error' && callbacks.onError) {
          callbacks.onError(packet);
        } else if (callbacks.onSuccess) {
          callbacks.onSuccess(packet);
        }
      }, []);

      return false;
    },

    addRosterItem: function (formID) {
      var name   = _getFormValue(formID, 'name'),
          jid    = _getFormValue(formID, 'jid'),
          groups = [ _getFormValue(formID, 'group') ],
          iq     = OX.XMPP.IQ.extend(),
          query  = OX.XMPP.Stanza.extend(),
          item   = OX.XMPP.Stanza.extend();

      var callbacks = {
        onSuccess: function (packet) {
          console.log('Succesfully added roster item.');
        },

        onError: function (packet) {
          console.log('ERROR: roster add failed.');
        }
      };

      iq.type('set');
      query.name = 'query';
      query.attr('xmlns', 'jabber:iq:roster');
      item.name = 'item';
      item.attr('jid', jid);
      item.attr('name', name);

      for (var i = 0;  i < groups.length; i++) {
        groupStanza = OX.XMPP.Stanza.extend();
        groupStanza.name = 'group';
        groupStanza.text = groups[i];
        item.addChild(groupStanza);
      }
      iq.addChild(query.addChild(item));

      OnsipApp.OX.con.send(iq.toString(), function (packet) {
        if (!packet)
          return;

        if (packet.getType() === 'error' && callbacks.onError) {
          callbacks.onError(packet);
        } else if (callbacks.onSuccess) {
          callbacks.onSuccess(packet);
        }
      }, []);

      return false;
    },

    deleteRosterItem: function (formID) {
      var jid   = _getFormValue(formID, 'jid'),
          iq    = OX.XMPP.IQ.extend(),
          query = OX.XMPP.Stanza.extend(),
          item  = OX.XMPP.Stanza.extend();

      var callbacks = {
        onSuccess: function (packet) {
          console.log('Succesfully deleted roster item.');
        },

        onError: function (packet) {
          console.log('ERROR: roster delete failed.');
        }
      };

      iq.type('set');
      query.name = 'query';
      query.attr('xmlns', 'jabber:iq:roster');
      item.name = 'item';
      item.attr('jid', jid);
      item.attr('subscription', 'remove');

      iq.addChild(query.addChild(item));

      OnsipApp.OX.con.send(iq.toString(), function (packet) {
        if (!packet)
          return;

        if (packet.getType() === 'error' && callbacks.onError) {
          callbacks.onError(packet);
        } else if (callbacks.onSuccess) {
          callbacks.onSuccess(packet);
        }
      }, []);

      return false;
    },

    _handleRostersIq: function (packet) {
     var items = packet.getElementsByTagName('x')[0].getElementsByTagName('item');
     for (var i=0; i < items.length; i++) {
       var name         = items[i].attributes["name"].value,
           jid          = items[i].attributes["jid"].value,
           group        = items[i].getElementsByTagName('group')[0].firstChild.nodeValue,
           uniqueFormId = 'add-roster-item-' + jid.replace(/@/, '').replace(/\./g, ''),
           action       = items[i].attributes["action"].value;

       if (action == 'add') {
         _addOutput('#rosters_xmpp_onsip_com .xmpp_roster', name +
                    '<form id="' + uniqueFormId + '" action="#">' +
                    '<input type="hidden" name="name" id="name" value="' + name + '"/>' +
                    '<input type="hidden" name="jid" id="jid" value="' + jid + '"/>' +
                    '<input type="hidden" name="group" id="group" value="' + group + '"/>' +
                    '<input type="submit" value="Add Item"/></form>');
         $('#' + uniqueFormId).bind('submit', function (e) {
                 e.preventDefault();
                 OnsipApp.OX.addRosterItem(uniqueFormId);
          });
       } else if (action == 'modify') {
         _addOutput('#rosters_xmpp_onsip_com .xmpp_roster', name +
                    '<form id="' + uniqueFormId + '" action="#">' +
                    '<input type="hidden" name="name" id="name" value="' + name + '"/>' +
                    '<input type="hidden" name="jid" id="jid" value="' + jid + '"/>' +
                    '<input type="hidden" name="group" id="group" value="' + group + '"/>' +
                    '<input type="submit" value="Modify Item"/></form>');
         $('#' + uniqueFormId).bind('submit', function (e) {
                 e.preventDefault();
                 OnsipApp.OX.addRosterItem(uniqueFormId);
         });
       } else if (action == 'delete') {
         _addOutput('#rosters_xmpp_onsip_com .xmpp_roster', name +
                    '<form id="' + uniqueFormId + '" action="#">' +
                    '<input type="hidden" name="name" id="name" value="' + name + '"/>' +
                    '<input type="hidden" name="jid" id="jid" value="' + jid + '"/>' +
                    '<input type="hidden" name="group" id="group" value="' + group + '"/>' +
                    '<input type="submit" value="Delete Item"/></form>');
         $('#' + uniqueFormId).bind('submit', function (e) {
                 e.preventDefault();
                 OnsipApp.OX.deleteRosterItem(uniqueFormId);
         });
       }
     }

      var id   = packet.attributes["id"].value;
      var from = packet.attributes["to"].value;
      var to   = packet.attributes["from"].value;
      var iq    = OX.XMPP.IQ.extend();
      iq.from(from);
      iq.to(to);
      iq.type('result');
      iq.attr('id', id);
      OnsipApp.OX.con.send(iq.toString());

      return true;
    },

    _handleEjabberdIq: function (packet) {
      if (packet.getElementsByTagName('query')[0]) {
        var items = packet.getElementsByTagName('query')[0].getElementsByTagName('item');
        for (var i = 0; i < items.length; i++) {
          if (items[i].attributes["subscription"].value != 'remove') {
            var item  = items[i],
                name_str   = item.attributes["name"].value,
                jid_str    = item.attributes["jid"].value,
                groups_str = '',
                groups     = item.getElementsByTagName('group');
            if (groups) {
              for (var j = 0; j < groups.length; j++) {
                if (groups[j].firstChild) {
                  if (groups_str != '') groups_str += ", ";
                  groups_str += groups[j].firstChild.nodeValue;
                } else {
                  groups_str = "n/a";
                }
              }
            }
            _addOutput('#rosters_xmpp_onsip_com .current_roster',
                       name_str + ' :: ' + jid_str + ' :: ' + groups_str);
          }
        }
      }

      var id   = packet.attributes["id"].value;
      var from = packet.attributes["to"].value;
      var to   = packet.attributes["from"].value;
      var iq    = OX.XMPP.IQ.extend();
      iq.from(from);
      iq.to(to);
      iq.type('result');
      iq.attr('id', id);
      OnsipApp.OX.con.send(iq.toString());

      return true;
    }

  };
}();

OnsipApp.Strophe = function() {
  var con;

  function htmlEnc(str) {
    return str.split(/&/).join("&amp;")
              .split(/;/).join("&semi;")
              .split(/</).join("&lt;")
              .split(/>/).join("&gt;");
  }

  function handleStatusChanged(status) {
    switch (status) {
    case Strophe.Status.CONNECTED:
      dbg.log('BOSH :: connected ');
      pref.set('boshConnection', true);

      var callbackConnect = {
          connect : function(){
               OnsipApp.OX.subscribeActiveCalls('/me/'+pref.get('fromAddress'))
          }
      }
      // Clear previous subscribtion
      OnsipApp.OX.getActiveCallsSubscriptions('/me/'+pref.get('fromAddress'), callbackConnect);

      // Set current JID
      pref.set( 'userJid', con.jid );
                  
      con.send($pres().tree());
      break;

    case Strophe.Status.DISCONNECTED:
      dbg.log('BOSH :: disconnected');
      break;

    default:
        break;
    }
  }

  function logMessage(xml, outbound) {
    var sent = (!!outbound) ? 'outbound' : 'inbound',
        msg  = "<div class='msg %s'>" + htmlEnc(xml) + "</div>";
  }

  return {
    /**
     * doLogin , function for logging in
     */
    doLogin: function (aForm) {
      var jid  = aForm.username.value;
          pass = aForm.password.value;
      con.connect(jid, pass, handleStatusChanged);

      OnsipApp.OX.setup(con);
    },

    quit: function() {
      con.send($pres({type: 'unavailable'}).tree());
      con.disconnect();
      dbg.log('BOSH :: logout');
    },

    init: function() {
      con = new Strophe.Connection('https://dashboard.onsip.com/http-bind/');
      con.rawInput  = function (data) {logMessage(data, false);};
      con.rawOutput = function (data) {logMessage(data, true);};

      con.addHandler(OnsipApp.OX._handleRostersIq, 'http://jabber.org/protocol/rosterx', 'iq', 'set', null, null);
      con.addHandler(OnsipApp.OX._handleEjabberdIq, 'jabber:iq:roster', 'iq', 'set', null, null);
      con.addHandler(OnsipApp.OX._handleEjabberdIq, 'jabber:client', 'iq', 'result', null, null);
    }
  };
}();

var onerror = function (e) {
  OnsipApp.Strophe.quit();
  return false;
};

/**
 * Recursive Unsubscribe
 * @param node
 * @param number of subscribtions
 * @param subscriptions 
 * @param callback
 */
function unsubscribeRecursively(node, subscribtionNumber, subscriptions, connectCallback){
    dbg.log('BOSH::unsubscribeRecursively');

    var item = subscriptions.pop();
    if(subscribtionNumber > 0){
        dbg.log('BOSH:: more than 0  subscriptions');
        // do our job
        OnsipApp.OX.unsubscribeActiveCalls(
            node,
            item,{
            onSuccess : function(){
                dbg.log('RESURSIVE::unsubscribe SUCCESS');
                if( subscribtionNumber > 0 ){
                    // Call self again
                    unsubscribeRecursively(node, --subscribtionNumber, subscriptions, connectCallback);
                }
            },
            onError : function(){
                if(subscribtionNumber == 0 ){
                    // should not reach here | connect
                    connectCallback.connect();
                }
            }
        });

    }else{
         dbg.log('RECURSIVE ::0 subscriptions');
         // Connect
         connectCallback.connect();
    }
}