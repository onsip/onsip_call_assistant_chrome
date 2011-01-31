/** Setup OX callback hooks **/

var BG_APP = {
    "notifications" : [],
    "launched_n"    : false,
    "log_context"   : 'BG_APP'
};

BG_APP.activeCallCreated   = function ( items ) {
    var i, n, item, phone, len, name,
    cont_highrise, cont_zendesk, caption;
    var that = this;
    dbg.log (this.log_context, 'Active Call Created');
    for (i = 0, len = items.length; i < len; i++) {
        item          = items[i];
        phone         = extractPhoneNumber(item.toURI);
        cont_highrise = highrise_app.findContact (phone + '');
        cont_zendesk  = zendesk_app .findContact (phone + '');
        name          = this._normalizeName (cont_zendesk, cont_highrise);
        phone         = name || phone;
        caption       = "Calling: ";

        var f_notification = {
            onSuccess : function (record_count, subject, is_onsip, nice_id) {
                if (record_count) {
                    caption += formatPhoneNum('' + phone) + " (" + record_count + ")";
                    subject  = subject.substr (0, 60).toLowerCase();
                } else {
                    subject  = "To: " + formatPhoneNum('' + phone);
                }
                n  = webkitNotifications.createNotification ('images/icon-48.png',
                                                             caption, subject);
                n.onclick = function () {
                    if (pref.get('zendeskEnabled')) {
                        if (!nice_id) {
                            chrome.tabs.create({url: pref.get('zendeskUrl') + '/rules/2007686'});
                        } else {
                            chrome.tabs.create({url: pref.get('zendeskUrl') + '/tickets/' + nice_id});
                        }
                    } else {
                        OX_EXT.cancelCall (item);
                    }
                }
                n.uri               = item.uri.query;
                n.phone             = formatPhoneNum('' + phone);
                n.contact_highrise  = cont_highrise;
                n.contact_zendesk   = cont_zendesk;
		n.is_onsip          = (is_onsip) ? is_onsip : false;
                n.show();

                that.notifications.push (n);
            },
            onError  : function () {}
        };

        /** On Call Created. If a notification already exists then we won't produce another. **/
        if (this.notifications.length === 0) {
            if (cont_zendesk && cont_zendesk.id) {
                zendesk_app.search ( cont_zendesk.id, f_notification);
            } else {
                f_notification.onSuccess ();
            }
	}
    }
};

BG_APP.activeCallRequested = function ( items ) {
    var i, n, item, phone, len, cont_highrise,
    cont_zendesk, caption, name, is_setup, that;
    var that = this;

    dbg.log (this.log_context, 'Active Call Requested');
    for (i = 0, len = items.length; i < len; i++) {
        item        = items[i];
        is_setup    = isSetupCall (item.fromURI);
        /** Temporarily adding this feature 12/3/2010 **/
        /** If this is just a call setup, then we don't display notification **/
        if (is_setup) {
            continue;
        }
        caption       = is_setup ? "Call Setup: " : "Incoming Call: ";
        phone         = extractPhoneNumber(item.fromURI);
        cont_highrise = highrise_app.findContact (phone + '');
        cont_zendesk  = zendesk_app .findContact (phone + '');
        name          = this._normalizeName (cont_zendesk, cont_highrise);
        phone         = name || phone;

        var f_notification = {
            onSuccess : function (record_count, subject, is_onsip, nice_id) {
                if (record_count) {
                    caption += formatPhoneNum('' + phone) + " (" + record_count + ")";
                    subject  = subject.substr(0, 60).toLowerCase();
                } else {
                    if (!is_setup) {
                        subject  = "From: "  + formatPhoneNum('' + phone);
                    } else {
                        subject  = "Setup: " + formatPhoneNum('' + phone);
                    }
                }
                n  = webkitNotifications.createNotification ('images/icon-48.png',
                                                             caption, subject);
                n.onclick = function () {
                    if (pref.get('zendeskEnabled')) {
                        if (!nice_id) {
                            chrome.tabs.create({url: pref.get('zendeskUrl') + '/rules/2007686'});
                        } else {
                            chrome.tabs.create({url: pref.get('zendeskUrl') + '/tickets/' + nice_id});
                        }
                    } else {
                        OX_EXT.cancelCall (item);
                    }
                }
                n.uri               = item.uri.query;
                n.phone             = formatPhoneNum('' + phone);
                n.is_setup          = is_setup;
                n.contact_highrise  = cont_highrise;
                n.contact_zendesk   = cont_zendesk;
                n.is_onsip          = (is_onsip) ? is_onsip : false;
                n.flag_incoming     = true;
                n.show();

                that.notifications.push (n);
                that.launched_n = false;
            },
            onError  : function () {
                that.launched_n = false;
            }
        };

        var p = formatPhoneNum('' + phone);
        dbg.log (this.log_context, 'Is Launching notification ' + this.launched_n);
        if (!this._isNotificationShowing (p) && !this.launched_n) {
            this.launched_n = true;
            if (cont_zendesk && cont_zendesk.id) {
                zendesk_app.search (cont_zendesk.id, f_notification);
            } else {
                f_notification.onSuccess ();
            }
        }
    }
};

/**                                                                                                                                       
 * Normalize on the variations in the name returned by the various third parties.                                                         
 * The returned normalized value will be display in the notification toast.                                                               
 * Variations include :                                                                                                                   
 * Zendesk, which returns the full name.                                                                                                  
 * Highrise, which returns first and last name                                                                                            
 * Highrise also returns company.                                                                                                         
 **/
BG_APP._normalizeName    = function () {
    var normalized_name, len, i, c;
    for (i = 0, len = arguments.length; i < len; i++) {
        c = arguments[i];
        if (c && c.full_name) {
            normalized_name = trim (c.full_name);
            if (normalized_name.length === 0) {
                normalized_name = undefined;
            }
        }
        if (!normalized_name && c && c.first_name && c.last_name) {
            normalized_name = c.first_name + ' ' + c.last_name;
            normalized_name = trim (normalized_name);
            if (normalized_name.length === 0) {
                normalized_name = undefined;
            }
        }
        if (!normalized_name && c && c.company_name) {
            normalized_name = c.company_name;
            normalized_name = trim (normalized_name);
            if (normalized_name.length === 0) {
                normalized_name = undefined;
            }
        }
        if (normalized_name) {
            return normalized_name;
        }
    }
    return;
};

/** A phone connection has been established **/
BG_APP.activeCallConfirmed = function ( items ) {
    dbg.log (this.log_context, 'Active Call Confirmed');
    var i, len, name;
    var that = this;
    for (i = 0, len = items.length; i < len; i += 1) {
	this._postNotetoProfile   (items[i].uri.query)
	    var q = items[i].uri.query;
	var f = function() {
	    that._cancelNotifications (q);
	};
	setTimeout (f, 2000);
    }
};

BG_APP.activeCallPending   = function ( item ) {
    dbg.log (this.log_context, 'Active Call Pending');
};

BG_APP.activeCallRetract   = function (itemURI) {
    var i, len;
    var that = this;
    dbg.log (this.log_context, 'Active Call Retracted = ' + this.notifications);
    for (i = 0, len = itemURI.length; i < len; i += 1) {
        var q = itemURI[i].query;
        var f = function () {
            that._cancelNotifications (q);
        };
        setTimeout(f, 1000);
    }
};

/** Helper method. Post a note through the Highrise API **/
BG_APP._postNotetoProfile  = function (item) {
    var i, len, flag_incoming, costumer, full_name, is_setup, phone, notif;
    for (i = 0, len = this.notifications.length; i < len; i += 1) {
        if (item === this.notifications[i].uri) {
            notif       = this.notifications[i];
            costumer_hr = notif.contact_highrise;
            costumer_zd = notif.contact_zendesk;
            is_setup    = notif.is_setup;

            if (!is_setup) {
                if (pref.get ('highriseEnabled') && costumer_hr && costumer_hr.id) {
                    highrise_app.postNote (costumer_hr, pref.get('userTimezone'), notif.flag_incoming);
                }
                if (pref.get ('zendeskEnabled') && notif.flag_incoming && !notif.is_onsip) {
                    if (costumer_zd && costumer_zd.id) {
                        zendesk_app.postNote  (costumer_zd, pref.get('userTimezone'));
                    } else {
                        phone = notif.phone;
			/** Commented out so no random tickets would be created **/
                        //zendesk_app.postNoteUnknown (phone, pref.get('userTimezone'));
                    }
                }
            }
        }
    }
};

/** Helper method. hide / cancel and remove desktop notifications **/
BG_APP._cancelNotifications = function (item) {
    dbg.log (this.log_context, this.notifications.length + ' notifications ');
    var a = [];
    var n = this.notifications.pop();
    while (n) {
        if (item === n.uri) {
            n.cancel();
        } else {
            a.push (n);
        }
        n = this.notifications.pop();
    }
    this.notifications = a;
};

BG_APP._isNotificationShowing = function (item) {
    var i, len;
    var is_showing = false;
    for (i = 0, len = this.notifications.length; i < len; i += 1) {
        if (item === this.notifications[i].phone) {
            is_showing = true;
            break;
        }
    }
    return is_showing;
};
