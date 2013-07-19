/** Setup OX callback hooks **/

var BG_APP = {
  "notifications": [],
  "callIdQueue": [],
  "log_context": 'BG_APP'
};

BG_APP.activeCallCreated = function(items) {
  var i, n, item, phone, len, subject,
    highriseContact, zendeskContact, caption;

  dbg.log(this.log_context, 'Active Call Created');
  for (i = 0, len = items.length; i < len; i++) {
    item = items[i];
    dbg.log(this.log_context, "active call created ", item);
    phone = extractPhoneNumber(item.toURI);

    if (pref.get('highriseEnabled')) {
      highriseContact = highrise_app.findContact(phone, name_from_context);
    }
    if (pref.get('zendeskEnabled')) {
      zendeskContact = zendesk_app.findContact(phone);
    }

    caption = "Calling: ";
    phone = this._normalizeName(zendeskContact, highriseContact) || phone;
    subject  = "To: " + formatPhoneNum(phone);

    n = this._getNotification(caption, subject, item);
    dbg.log(this.log_context, "On Call Created, create the notification");
    n = n || {};
    n.callItem = item;
    n.zendeskContact = zendeskContact;
    n.highriseContact = highriseContact;
    n.phone = formatPhoneNum(phone);
    n.callInitiated = new Date().getTime();

    /**
     * You wouldn't receive multiple Call Create packets, but
     * this check exists when callling yourself
     */
    n.shouldNotify = this._showNotification(item.callID, this.notifications);
    if (n.shouldNotify) {
      dbg.log(this.log_context, "On Call Created, adding to notifications ", n);
      this.notifications.push(n);
      n.show();
    }
  }
};

BG_APP.activeCallRequested = function (items) {
  var i, n, item, phone, len, fmtPhone, highriseContact, zendeskContact, that,
    caption, isSetup, phoneWToUri, highriseContactWToUri, subject, foundCid;

  dbg.log(this.log_context, 'Active Call Requested');

  for (i = 0, len = items.length; i < len; i++) {
    item = items[i];
    dbg.log(this.log_context, "active call requested ", item);

    that = this;
    foundCid = _.find(this.callIdQueue,
      function(element, idx, list) {
        if (element && element.cid === item.callID) {
          that.callIdQueue[idx].count++;
          return true;
        }
      }
    );

    if (!foundCid) {
      dbg.log(this.log_context, "add call id to queue  " + item.callID);
      this.callIdQueue.push({cid: item.callID, count: 1});
    }

    /**
      We check to make sure that the call setup id was not
      only set, but that it matches the id we provided when
      we made initiated the call setup..., or the fromURI
      includes sip:call-setup instring
    */
    isSetup = (item.callSetupID && item.callSetupID.length > 0);
    isSetup = isSetup &&
      (item.callSetupID == OX_EXT.store_cs_id || isSetupCall(item.fromURI));

    /**
      If this is just a call setup, then we don't display notification.
      Optionally, remove to start displaying call setup notifications.
    */
    if (isSetup) {
      dbg.log(this.log_context, 'Call Setup ID is ' + item.callSetupID);
      continue;
    }

    phone = extractPhoneNumber(item.fromURI);
    phoneWToUri = extractPhoneNumber(item.toURI);
    caption = isSetup ? "Call Setup: " : "Incoming Call: ";
    phone = phone || '';

    if (pref.get('highriseEnabled')) {
      highriseContact = highrise_app.findContact(phone, '');
    }
    if (pref.get('zendeskEnabled')) {
      zendeskContact = zendesk_app.findContact(phone);
    }

    phone = this._normalizeName(zendeskContact, highriseContact) || phone;

    /**
      To Uri functionality was built more for Highrise. Might need to
      address this feature for Zendesk as well.
     */
    if (pref.get('showToUri')) {
      highriseContactWToUri = highrise_app.findContact(phoneWToUri, null);
      phoneWToUri = this._normalizeName(highriseContactWToUri) || phoneWToUri;
    }

    /**
      Some comments on this variable can be found in background.js
     */
    name_from_context  = '';

    fmtPhone = formatPhoneNum('' + phone);
    subject = "";

    if (pref.get('showFromUri')) {
      subject = "From: " + fmtPhone + " ";
    }
    if (pref.get('showToUri')) {
      subject += "Line: " + formatPhoneNum('' + phoneWToUri);
    }
    if (isSetup) {
      subject = "Setup: " + fmtPhone;
    }
    if (subject.length === 0) {
      subject = "Ringing ...";
    }

    n = this._getNotification(caption, subject, item);
    dbg.log(this.log_context, "On Call Requested, create the notification");
    n = n || {};
    n.callItem = item;
    n.isSetup = isSetup;
    n.flagIncoming = true;
    n.zendeskContact = zendeskContact;
    n.highriseContact = highriseContact;
    n.phone = formatPhoneNum('' + phone);
    n.callInitiated = new Date().getTime();
    n.highriseContactWToUri = highriseContactWToUri;
    n.shouldNotify = this._showNotification(item.callID, this.notifications);

    /**
      A user can have many registered devices, and the XMPP API will deliver
      an 'incoming' packet for every registered device. Meaning we'll get
      duplicate request packets.'
     */
    if (n.shouldNotify) {
      dbg.log(this.log_context, "On Call Requested, adding to notifications ", n);
      this.notifications.push(n);
      n.show();
    }
  }
};

/**
  A call has been established
*/
BG_APP.activeCallConfirmed = function(items) {
  var i, len, name, that, callItem;

  that = this;
  dbg.log(this.log_context, 'Active Call Confirmed');
  this._reconcileCallItems(items);

  for (i = 0, len = items.length; i < len; i += 1) {
    callItem = items[i];
    dbg.log(this.log_context, "call item confirmed ", callItem);
    this._postNotetoProfile(callItem);
    (function(cItem) {
      setTimeout(function() {
        that._reconcileNotifications(cItem);
      }, 2000);
    })(callItem);
  }
};

BG_APP.activeCallPending = function(item) {
  dbg.log(this.log_context, 'Active Call Pending');
};

BG_APP.activeCallRetract = function(items) {
  var i, len, that, callItem;

  that = this;
  dbg.log(this.log_context, 'Active Call Retracted');
  this._reconcileCallItems(items);

  for (i = 0, len = items.length; i < len; i += 1) {
    callItem = items[i];
    dbg.log(this.log_context, "call item retract ", callItem);
    (function(cItem) {
      setTimeout(function() {
        that._reconcileNotifications(cItem);
      }, 3000);
    })(callItem);
  }
};

BG_APP._getNotification = function(caption, subject, item) {
  return webkitNotifications.createNotification('images/icon-48.png',
    caption, subject);
};

BG_APP._showNotification = function(callId, currentNotifications) {
  /**
    If the extension is disabled, don't show notifications
   */
  if (!pref.get('enabled')) {
    dbg.log(this.log_context, "The extension is disabled");
    return false;
  }

  dbg.log(this.log_context, "Find matching caller id " + callId);

  /**
    There are 4 cases to consider here.
    1. The end user makes an outbound call
      - This is not really an issue, we'll display the notication
    2. The end user receives a call, and only has one registered device
      - This is not an issue.
    3. The end user receives a call, but has many registered devices
      - This is a real problem because we'll receive N receive events for N devices
    4. The end user calls themselves
      - This can be an issue because the same call id will be passed
        on the outbound event and the inbound events
   */
  var isNotifying = _.find(currentNotifications,
    function(element, idx, list) {
      if (element.shouldNotify && element.callItem.callID === callId) {
        return true;
      }
    }
  );

  return !isNotifying;
};

BG_APP._getActiveCallItemId = function(uri) {
  var idx, query, itemId = '', aItem;

  if (uri && uri.query && uri.query.length > 0) {
    query = uri.query;
    idx = query.indexOf('item=');
    if (idx != -1) {
      itemId = query.substring(idx + 5);
      aItem = itemId.split(":");
      if (aItem.length === 2) {
        itemId = aItem[0];
      }
    }
  }
  return itemId;
};

BG_APP._reconcileCallItems = function(items) {
  var that = this;
  items = items || [];
  dbg.log(this.log_context,
    "Found " + this.notifications.length +
      " notifications", this.notifications);

  _.each(this.notifications,
    function(element, index, list) {
      var item, len, i, callId;
      for (i=0, len = items.length; i < len; i++) {
        item = items[i];
        /**
          The call item will have a dialogState property if it's delivered from
          call incoming (requested), outgoing (created), or answered (confirmed)
          events. A dialogState property will not exist for a call retraction.
         */
        if (item.dialogState) {
          if (item.dialogState === 'confirmed') {
            if (list[index].callItem.callID === item.callID &&
                !that.notifications[index].callAnsweredTime) {
              dbg.log(that.log_context, "Update Call Answered Time");
              that.notifications[index].callAnsweredTime = new Date().getTime();
            }
          }
        } else {
          /**
           This is a retraction. In a retraction we'll compare the item id,
           rather than callId
           */
          if (that._getActiveCallItemId(list[index].callItem.uri) ===
              that._getActiveCallItemId(item)) {
            if (that.notifications[index].callAnsweredTime) {
              that.notifications[index].callHangupTime = new Date().getTime();
            }
            that.notifications[index].markForDeletion = new Date().getTime();

            callId = that.notifications[index].callItem.callID;
            _.each(that.callIdQueue,
              function(element, idx, list) {
                if (element && element.cid === callId) {
                  that.callIdQueue[idx].count--;
                  dbg.log(that.log_context,
                    "Count in reconcile retraction for " + element.cid + " is now " +
                      that.callIdQueue[idx].count);
                }
              }
            );

          }
        }
      }
    }
  );
},

/**
  Helper method. Post a note through the Highrise / Zendesk API
 */
BG_APP._postNotetoProfile  = function (item, callback) {
  var i, len, customer, n, tz, that, zdContact, hrContact,
    hrContactWToUri, toAor;

  for (i = 0, len = this.notifications.length; i < len; i += 1) {
    n = this.notifications[i];
    dbg.log(this.log_context,
      "PostNote item -> " + i + ", incoming = " + n.flagIncoming +
        ", shouldNotify = " + n.shouldNotify + ", matching " + item.callID  +
          " and " + n.callItem.callID);
    if (n.shouldNotify && item.callID === n.callItem.callID) {
      zdContact = n.zendeskContact;
      hrContact = n.highriseContact;
      hrContactWToUri = n.highriseContactWToUri;

      if (!n.isSetup) {
        /**
         highrise
         */
        if (pref.get('highriseEnabled')) {
          toAor = item && item.toAOR;
          tz = pref.get('userTimezone');
          if (hrContact && hrContact.id) {
            highrise_app.postNote(hrContact, tz, n.flagIncoming, toAor);
          }
          if (hrContactWToUri && hrContactWToUri.id) {
            highrise_app.postReceiveNote(hrContactWToUri,
              tz, n.flagIncoming, n.phone, toAor);
          }
        }
        /**
         zendesk
         */
        if (pref.get('zendeskEnabled') && n.flagIncoming) {
          that = this;
          var info = {
            callItem: item,
            zdContact: zdContact,
            phoneNumber: n.phone,
            isCallSetup: n.isSetup,
            isIncoming: n.flagIncoming
          };
          dbg.log(this.log_context, "Zendesk enabled, let's try to create the ticket");
          zendesk_app.createTicket(info, {
            success: function(model, resp, options) {
              dbg.log(that.log_context, 'Created ticket successfully');
              if (!pref.get('focusZdTab')) return;
              var u = pref.get('zendeskUrl') + "/agent/#/tickets/" + resp.ticket.id;
              _.each(that.notifications,
                function(element, index, list) {
                  if (element.callItem.callID === options.callID) {
                    that.notifications[index].ticketId = resp.ticket.id;
                  }
                });
              chrome.windows.getAll({populate:true},
                function(windows) {
                  for (var w in windows) {
                    for (var t in windows[w].tabs) {
                      var cUrl = windows[w].tabs[t].url;
                      if (cUrl && cUrl.indexOf(pref.get('zendeskUrl')) !== -1) {
                        var tabId = windows[w].tabs[t].id;
                        chrome.tabs.update(tabId, {url: u, active: true});
                        return;
                      }
                    }
                  }
                }
              );
            }
          });
        }
      }
    }
  }
};

/**
 * Helper method. remove desktop notifications
 */
BG_APP._reconcileNotifications = function(item) {
  var n, a = [], tdiff;

  dbg.log(this.log_context,
    'Removing marked notifications for a set of ' +
      this.notifications.length);

  n = this.notifications.pop();
  while(n) {
    if (n.markForDeletion ||
       (item.dialogState && item.callID === n.callItem.callID)) {
      if (n.shouldNotify && n.flagIncoming) {
        n.shouldNotify = false;
        if (n.markForDeletion) {
          tdiff = new Date().getTime() - n.markForDeletion;
          tdiff = (tdiff / 1000);
          if (tdiff <= 60) {
            n.shouldNotify = true;
            dbg.log(this.log_context,
              'Keep shouldNotify prop @ true');
          }
        } else {
          dbg.log(this.log_context,
            'Set shouldNotify prop to false for call id ' +
              item.callID);

          var that = this;
          _.each(this.callIdQueue,
            function(element, idx, list) {
              if (element && element.cid === item.callID) {
                if (that.callIdQueue[idx].count > 1) {
                  n.shouldNotify = true;
                  dbg.log(that.log_context, 'REVERT shouldNotify prop to TRUE');
                }
              }
            }
          );
        }
        n.cancel();
        if (this._updateCallLength(n)) {
          dbg.log(this.log_context, 'Reset ticketId');
          n.ticketId = null;
        }
        a.push(n);
        n = this.notifications.pop();
        continue;
      }

      // likely a superfluous call here, but no matter
      this._updateCallLength(n);
      n.cancel();
      delete n;
    } else {
      a.push(n);
    }
    n = this.notifications.pop();
  }
  if (a.length === 0) {
    this.callIdQueue = [];
  }
  this.notifications = a;
  /** global variable, resetting **/
  name_from_context = '';
};

BG_APP._updateCallLength = function(n) {
  var updated, foundCid, that, t, callId;
  if (n.ticketId) {
    that = this;
    dbg.log(this.log_context, "Ticket is valid");
    callId = n.callItem.callID;
    foundCid = _.find(this.callIdQueue,
      function(element, idx, list) {
        if (element && element.cid === callId) {
          dbg.log(that.log_context,
            "in updateCallLength, count is " +
              that.callIdQueue[idx].count);
          return (that.callIdQueue[idx].count === 0);
        }
      }
    );

    if (!foundCid) return false;

    dbg.log(this.log_context,
      "Found Ticket id " + n.ticketId + " for callId " + callId);
    if (n.callAnsweredTime && n.callHangupTime) {
      dbg.log(this.log_context,
        "Call Hangup time is set to " + n.callHangupTime);
      t = n.callHangupTime - n.callAnsweredTime;
      if (t > 0) {
        dbg.log(this.log_context,  "Time T =  " + (t / 1000) + " (sec)");
        zendesk_app.updateDuration(n.ticketId,
          this._normalizeZdDuration(t), this._callLengthInSec(t));
        updated = true;
      }
    }
  }
  return updated;
};

BG_APP._callLengthInSec = function(t) {
  t = (t / 1000);
  if (t < 0) {
    t = 0;
  }
  return Math.round(t);
};

BG_APP._normalizeZdDuration = function(t) {
  t = (t / (1000 * 60));
  if (t < 5) {
    t = "less_than_5_minutes";
  } else if (t <= 15) {
    t = "5_15_minutes";
  } else if (t <= 30) {
    t = "15_30_minutes";
  } else if (t <= 60) {
    t = "30_60_minutes";
  } else {
    t = "over_1_hour";
  }
  return t;
};

/**
  Normalize on the variations in the name returned by the
  various third parties.  The returned normalized value will
  be display in the notification toast.

  Zendesk:  returns the full name.
  Highrise: splits first and last name, and company
*/
BG_APP._normalizeName = function() {
  var normalizedName, len, i, c;
  for (i = 0, len = arguments.length; i < len; i++) {
    c = arguments[i];
    if (c) {
      if (c.full_name) {
        normalizedName = trim(c.full_name);
        if (normalizedName.length > 0) {
          return normalizedName;
        }
      }
      if (c.first_name && c.last_name) {
        normalizedName = trim(c.first_name + ' ' + c.last_name);
        if (normalizedName.length > 0) {
          return normalizedName;
        }
      }
      if (c.company_name) {
        normalizedName = trim(c.company_name);
        return normalizedName;
      }
    }
  }
  return null;
};
