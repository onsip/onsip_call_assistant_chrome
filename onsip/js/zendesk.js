/**
 * Zendesk Integration for OnSIP Call Assistant
 */
// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

/**
 * Encodes a string in base64
 * @param {String} input The string to encode in base64.
 */
function encode64(input) {
  var output = "";
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;

  do {
    chr1 = input.charCodeAt(i++);
    chr2 = input.charCodeAt(i++);
    chr3 = input.charCodeAt(i++);

    enc1 = chr1 >> 2;
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    enc4 = chr3 & 63;

    if (isNaN(chr2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(chr3)) {
      enc4 = 64;
    }

    output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) +
      keyStr.charAt(enc3) + keyStr.charAt(enc4);
  } while (i < input.length);

  return output;
}

var Zendesk = Zendesk || {};

Zendesk.Config = {
  baseUrl: "",
  auth: ""
};

Zendesk.sync = Backbone.sync;
Backbone.sync = function(method, model, options) {
  options.beforeSend = function (xhr) {
    xhr.setRequestHeader('Authorization', Zendesk.Config.auth);
  };
  Zendesk.sync(method, model, options);
};

Zendesk.User = Backbone.Model.extend({
  defaults: {
    id: null,
    name: null,
    tags: null,
    email: null,
    phone: null,
    external_id: null
  },
  parse: function(response) {
    return {
      id: response.id,
      name: response.name,
      tags: response.tags,
      email: response.email,
      phone: response.phone,
      external_id: response.external_id
    };
  }
});

Zendesk.Users = Backbone.Collection.extend({
  model: Zendesk.User,
  findMe: function(options) {
    this.url = Zendesk.Config.baseUrl + "/api/v2/users/me.json?d=" + new Date().getTime();
    this.fetch(options);
  },
  findAll: function(options) {
    this.url = Zendesk.Config.baseUrl + "/api/v2/users.json";
    this.fetch(options);
  },
  findAllEndUsers: function(options) {
    var that = this, counter = 0, f;
    this.url = Zendesk.Config.baseUrl + "/api/v2/users.json?role[]=end-user";
    f = {
      success: function(data) {
        if (data.next_page) {
          counter++;
          if (counter > 1) return;
          that.url = data.next_page;
          setTimeout(function() {
            that._findNext(f);
          }, 1000);
        }
      }
    };
    this._findNext(f);
  },
  autoComplete: function(data, options) {
    var u = new Zendesk.User();
    u.url = Zendesk.Config.baseUrl + "/api/v2/users/autocomplete.json";
    u.save(data, options);
  },
  parse: function (response) {
    if (response) {
      if (response.user) {
       return response.user;
      }
      this.count = response.count;
      this.next_page = response.next_page;
      this.previous_page = response.previous_page;
      response.users = _.filter(response.users, function(u) { return u.phone });
      return this.models.concat(response.users);
    }
  },
  _findNext: function(options) {
    this.fetch(options);
  }
});

Zendesk.Tickets = Backbone.Model.extend({
  find: function(ticketId) {
    this.url = Zendesk.Config.baseUrl + "/api/v2/tickets/" + ticketId + ".json";
    this.fetch();
  },
  create: function(ticket, options) {
    this.url = Zendesk.Config.baseUrl + "/api/v2/tickets.json";
    this.save(ticket, options);
  },
  update: function(id, ticket, options) {
    this.url = Zendesk.Config.baseUrl + "/api/v2/tickets/" + id + ".json";
    ticket.id = id;
    this.save(ticket, options);
  }
});

Zendesk.TicketFields = Backbone.Model.extend({
  count: 0,
  fields: [],
  findAll: function(options) {
    this.url = Zendesk.Config.baseUrl + "/api/v2/ticket_fields.json";
    this.fetch(options);
  },
  create: function(data, options) {
    this.url = Zendesk.Config.baseUrl + "/api/v2/ticket_fields.json";
    this.save(data, options);
  },
  parse: function(response) {
    if (response) {
      this.count = response.count;
      this.fields = response.ticket_fields;
    }
  }
});

Zendesk.Search = Backbone.Model.extend({
  defaults: {
    count: 0,
    results: [],
    facets: null,
    next_page: null,
    sort_order: "desc",
    previous_page: null,
    sort_by: "updated_at"
  },
  find: function(q) {
    this.url = Zendesk.Config.baseUrl + "/api/v2/search.json?query=" + this.escape(q) +
      "&sort_by" + this.sort_by + "&sort_order" + this.sort_order;
    this.fetch();
  },
  findByPhone: function(phone, options) {
    if (!phone || phone.length < 10) return null;
    var q = escape("phone:" + phone);
    this.url = Zendesk.Config.baseUrl + "/api/v2/search.json?query=" + q;
    options = options || {};
    options.async = false;
    this.fetch(options);
  },
  parse: function (response) {
    if (response) {
      this.set("count", response.count);
      this.set("facets", response.facets);
      this.set("results", response.results);
      this.set("next_page", response.next_page);
      this.set("previous_page", response.previous_page);
    }
  }
});

Zendesk.CustomField = {};

Zendesk.CustomField.ONSIP_SIP_ADDRESS = "OnSIP SIP Address";
Zendesk.CustomField.ONSIP_CALL_SOURCE = "OnSIP Call Source";
Zendesk.CustomField.ONSIP_CALL_DURATION = "OnSIP Call Duration";
Zendesk.CustomField.ONSIP_CALL_DESTINATION = "OnSIP Call Destination";
Zendesk.CustomField.ONSIP_CUSTOM_DURATION_RANGE = "Duration";

Zendesk.App = {
  myId: null,
  sipAddress: null,
  logContext: "ZENDESK",
  customFieldList: [
    {name: Zendesk.CustomField.ONSIP_SIP_ADDRESS, id: null},
    {name: Zendesk.CustomField.ONSIP_CALL_SOURCE, id: null},
    {name: Zendesk.CustomField.ONSIP_CALL_DURATION, id: null},
    {name: Zendesk.CustomField.ONSIP_CALL_DESTINATION, id: null},
    {name: Zendesk.CustomField.ONSIP_CUSTOM_DURATION_RANGE, id: null}
  ],
  init: function(config, options) {
    var url, usr, token, that;
    that = this;
    config = config || {};
    url = config.url || '';
    usr = config.usr || '';
    token = config.token || '';
    options = options || {};
    Zendesk.Config.baseUrl = url;
    Zendesk.Config.auth = "Basic " + encode64(usr + "/token:" + token);
    this.sipAddress = config.sipAddress;
    this.verify({
      success: function() {
        if (options.success) {
          var users = new Zendesk.Users();
          var opt = {async: true, timout: 20000};
          opt.success = function() {
            options.success();
            that._verifyCustomFields();
          };
          opt.error = function() {
            if (options.error) {
              options.error();
            }
          };
          users.autoComplete({"name": "somerand"}, opt);
        }
      },
      error: function() {
        if (options.error) {
          options.error();
        }
      }
    });
  },
  verify: function(options) {
    var users = new Zendesk.Users();
    options = options || {};
    options.timeout = 10000;
    options.async = false;
    users.findMe(options);
    if (users.length > 0) {
      this.myId = users.at(0).get("id");
    }
  },
  _verifyCustomFields: function() {
    this._findCustomFields();
  },
  _findCustomFields: function() {
    var that = this, fields;
    fields = new Zendesk.TicketFields();
    fields.findAll({
      success: function(model, resp, options) {
        var flds = resp.ticket_fields;
        _.each(flds,
          function(f) {
            var i, cFldName, fldTitle, len = that.customFieldList.length;
            fldTitle = f.title.toLowerCase();
            for (i = 0; i < len; i++) {
              cFldName = that.customFieldList[i].name.toLowerCase();
              if (cFldName === fldTitle) {
                that.customFieldList[i].id = f.id;
              }
              else if (cFldName === Zendesk.CustomField.ONSIP_CALL_DURATION.toLowerCase() &&
                fldTitle.indexOf(cFldName) !== -1) {
                  that.customFieldList[i].id = f.id;
              }
            }
          }
        );
      },
      error: function() {}
    });
  },
  findContact: function(phone) {
    var u, p, search;
    search= new Zendesk.Search();
    p = this._injectWildCard(phone);
    search.findByPhone(p);
    if (search.get('results').length > 0) {
      u = search.get('results')[0];
    }
    if (u && u.name) {
      return { id: u.id, full_name: u.name };
    }
    return null;
  },
  updateDuration: function(ticketId, duration, callLength, options) {
    var tickets, customFields = [], that = this, body;

    dbg.log(this.logContext, "Update Call Duration");

    if (ticketId) {
      dbg.log(this.logContext,
        "TicketId " + ticketId + " is valid for updating call duration");

      _.each(this.customFieldList,
        function(fld) {
          var n, f = {};
          if (fld.id) {
            n = fld.name.toLowerCase();
            if (n === Zendesk.CustomField.ONSIP_CUSTOM_DURATION_RANGE.toLowerCase()) {
              dbg.log(that.logContext,
                "Found " + Zendesk.CustomField.ONSIP_CUSTOM_DURATION_RANGE +
                  " call duration field");
              f[fld.id] = duration;
            }
            else if (n.indexOf(Zendesk.CustomField.ONSIP_CALL_DURATION.toLowerCase()) !== -1) {
              dbg.log(that.logContext,
                "Found " + Zendesk.CustomField.ONSIP_CALL_DURATION +
                  " call duration field");
              f[fld.id] = callLength;
              body = "On call with customer for " + callLength + " seconds";
            }
            if (f[fld.id]) {
              customFields.push(f);
            }
          }
        }
      );
    }

    var ticket = {
      "ticket": {
        "comment": {
          "body": body
        }
      }
    };

    if (customFields.length > 0 && body) {
      ticket['ticket'].custom_fields = customFields;
      tickets = new Zendesk.Tickets();
      options = options || {};
      dbg.log(this.logContext, "Now update ticket with call duration");
      tickets.update(ticketId, ticket, options);
    }

  },
  createTicket: function(info, options) {
    var tags = ['onsip', 'call'], status = 'open', phone, that, tmp,
      customFields = [], tickets, priority = 'normal', subject, body = "", item;

    item = info.callItem || {};

    dbg.log(this.logContext, "In Create Ticket - call Id - " + item.callId);

    if (info.isIncoming) {
      tags.push('incoming');
      /**
        Don't create a ticket for extension-to-extension calling
       */
      if (item.localUri) {
        var domain = item.localUri.split("@");
        if (domain.length === 2) {
          if (domain[1].toLowerCase() ===
              this.sipAddress.split("@")[1].toLowerCase()) {
            dbg.log(this.logContext,
              "Extension-to-Extension, will not create ticket " + item.localUri);
            return;
          }
        }
        tmp = this._normalizePhoneNumber(item.localUri);
        if (tmp && tmp.length >= 10) {
          body = ", dial back # " + formatPhoneNum(tmp);
        }
      }
    } else {
      tags.push('outgoing');
    }

    dbg.log(this.logContext, "pass tag creation In Create Ticket");

    subject = "This ticket was automatically " +
      "created when on call with " + info.phoneNumber;

    if (item.remoteUri) {
      body = "Associated SIP User: " + item.remoteUri + body;
    }

    var ticket = {
      "ticket": {
        "subject": subject,
        "comment": {
          "body": body
        },
        "tags": tags,
        "status": status,
        "priority": priority
      }
    };

    dbg.log(this.logContext, "check my Id");

    if (this.myId) {
      ticket['ticket'].assignee_id = this.myId;
      ticket['ticket'].submitter_id = this.myId;
    }
    if (info.zdContact && info.zdContact.id) {
      ticket['ticket'].requester_id = info.zdContact.id;
    }

    that = this;
    if (item) {
      _.each(this.customFieldList,
        function(fld) {
          var n, f = {};
          if (fld.id) {
            n = fld.name.toLowerCase();
            if (item.remoteUri && n === Zendesk.CustomField.ONSIP_SIP_ADDRESS.toLowerCase()) {
              f[fld.id] = item.remoteUri;
            }
            else if (item.remoteUri && n === Zendesk.CustomField.ONSIP_CALL_DESTINATION.toLowerCase()) {
              f[fld.id] = formatPhoneNum(that._normalizePhoneNumber(item.remoteUri));
            }
            else if (item.localUri && n === Zendesk.CustomField.ONSIP_CALL_SOURCE.toLowerCase()) {
              f[fld.id] = formatPhoneNum(that._normalizePhoneNumber(item.localUri));
            }
            if (f[fld.id]) {
              customFields.push(f);
            }
          }
        }
      );

      ticket['ticket'].custom_fields = customFields;
    }

    dbg.log(this.logContext, "custom tickets - " + item.callId);

    tickets = new Zendesk.Tickets();
    options = options || {};
    options.callID = item.callId;
    tickets.create(ticket, options);
    dbg.log(this.logContext, "create tickets");
  },
  _injectWildCard: function(phone) {
    phone = this._normalizePhoneNumber(phone);
    if (!phone || phone.length < 10) {
      return null;
    }
    if (phone.length > 10) {
      phone = phone.substr(phone.length - 10);
    }
    return "*" + phone.substr(0,3) + "*" + phone.substr(3,3) + "*" + phone.substr(6,4);
  },
  _normalizePhoneNumber: function(phone) {
    var cleanPhoneNum;

    cleanPhoneNum = removeExtention(phone);
    cleanPhoneNum = cleanPhoneNo(cleanPhoneNum);
    if (cleanPhoneNum.length === 10) {
      cleanPhoneNum = '1' + cleanPhoneNum;
    }
    return cleanPhoneNum;
  }

  /**
  _addMissingCustomFields: function() {
    var i, data, tf, cf = this.customFieldList;
    tf = new Zendesk.TicketFields();
    for (i = 0; i < cf.length; i++) {
      if (!cf[i].id) {
        data = {"ticket_field": {"type": "text", "title": cf[i].name }};
        tf.create(data, {
          success: function(model, resp, options) {
            var f = resp.ticket_field;
            for (var j = 0; j < cf.length; i++) {
              if (cf[j].name.toLowerCase() === f.title.toLowerCase()) {
                cf[j].id = f.id;
              }
            }
          },
          async: true
        });
      }
    }
  },
  **/
};
