 /* Start ----------------------------------------------------- ox.js*/

/**
 * @namespace
 */
var OX = {
  debug: function() {
    return window.console && window.console.debug && window.console.debug.apply(window.console, arguments);
  },

  log: function() {
    return window.console && window.console.log && window.console.log.apply(window.console, arguments);
  },

  warn: function() {
    return window.console && window.console.warn && window.console.warn.apply(window.console, arguments);
  },

  error: function() {
    return window.console && window.console.error && window.console.error.apply(window.console, arguments);
  },

  group: function() {
    if (window.console && window.console.group) {
      window.console.group.apply(window.console, arguments);
    } else {
      OX.log.apply(OX, arguments);
    }
  },

  groupEnd: function() {
    if (window.console && window.console.groupEnd) window.console.groupEnd();
  }

};
/**
 * Simple error class of OXJS.
 *
 * @example
 * throw new OX.Error('the error message');
 *
 */
OX.Error = function(message) {
  this.message = message;
};
OX.Error.prototype = new Error();
OX.Error.prototype.name = "OX.Error";
/**
 * Base object for OXJS. All other objects inherit from this one.
 * @class
 */
OX.Base = {
  /**
   * Creates a new object which extends the current object.  Any
   * arguments are mixed in to the new object as if {@link OX.Base.mixin}
   * was called on the new object with remaining args.
   *
   * @example
   * var obj = OX.Base.extend({param: value});
   *
   * @returns {OX.Base} the new object
   *
   * @see OX.Base.mixin
   */
  extend: function () {
    var F = function () {};
    F.prototype = this;

    var rc = new F();
    rc.mixin.apply(rc, arguments);

    if (rc.init && rc.init.constructor === Function) {
      rc.init.call(rc);
    }

    return rc;
  },

  /**
   * Iterates over all arguments, adding their own properties to the
   * receiver.
   *
   * @example
   * obj.mixin({param: value});
   *
   * @returns {OX.Base} the receiver
   *
   * @see OX.Base.extend
   */
  mixin: function () {
    for (var i = 0, len = arguments.length; i < len; i++) {
      for (var k in arguments[i]) if (arguments[i].hasOwnProperty(k)) {
        this[k] = arguments[i][k];
      }
    }

    return this;
  }
};
/**
 * URI namespace.
 * @namespace
 * @extends OX.Base
 */
OX.URI = OX.Base.extend(/** @lends OX.URI */{
  /**
   * Parse a string into an OX.URI.Base object.
   *
   * @param {String} uriString the URI to parse
   * @returns {OX.URI.Base} A new OX.URI.Base object
   *
   * @example
   * var uri = OX.URI.parse('xmpp:lisa@example.com');
   */
  parse: function (uriString) {
    var scheme, authority, path, query, fragment;

    // Scan for : to find scheme                    - required
    // Scan between // and / to find authority      - optional
    // Scan from end of authority to ? to find path - required
    // Scan from ? to # to find query               - optional
    // Scan from # to EOL to find fragment          - optional
    var parts = uriString.match(/^([^:]*:)(\/\/[^\/]*\/)?([^?]*)(\?[^#]*)?(#.*)?/);
    if (parts[1])
      scheme = parts[1].substr(0, parts[1].length - 1);
    if (parts[2])
      authority = parts[2].substr(2, parts[2].length - 2).substr(0, parts[2].length - 3);
    if (parts[3])
      path = parts[3];
    if (parts[4])
      query = parts[4].substr(1, parts[4].length - 1);
    if (parts[5])
      fragment = parts[5].substr(1, parts[5].length - 1);

    return OX.URI.Base.extend({scheme: scheme, authority: authority,
                               path: path, query: query, fragment: fragment});
  },

  /**
   * Convert an object into an OX.URI.Base object.
   *
   * @param {Object} object an object with these members: scheme, path, authority, query, fragment
   * @returns {OX.URI.Base} A new URI object
   *
   * @example
   * var uri = OX.URI.fromObject({scheme: 'xmpp', path: 'lisa@example.com'});
   */
  fromObject: function (object) {
    return OX.URI.Base.extend(object);
  }
});

/**
 * Traits object for URI.
 * @namespace
 * @extends OX.Base
 */
OX.URI.Base = OX.Base.extend(/** @lends OX.URI.Base# */{
  /**
   * The URI scheme.
   *
   * @default "xmpp"
   */
  scheme: 'xmpp',

  /**
   * The URI authority section.
   */
  authority: null,

  /**
   * The URI path.
   */
  path: null,

  /**
   * The URI query parameters.
   */
  query: null,

  /**
   * The URI fragment identifier.
   */
  fragment: null,

  /**
   * Return the action, if any, in the query parameters.
   *
   * @example
   * uri.action();
   *
   * @returns {String} The action of this query, or undefined if none found.
   */
  action: function () {
    if (!this.query)
      return undefined;

    var parts = this.query.split(';');
    if (parts[0] === '')
      return undefined;
    else
      return parts[0];
  },

  /**
   * Return the value, if any, for a parameter in the query
   * parameters.
   *
   * @example
   * uri.queryParam('paramName');
   *
   * @param {String} param The parameter who's value is looked up.
   * @returns {String} The value of the parameter, or undefined if not found.
   */
  queryParam: function (param) {
    if (!this.query)
      return undefined;

    var parts = this.query.split(';');
    for (var i = 1, len = parts.length; i < len; i++) {
      var kvp = parts[i].split('=');
      if (kvp[0] === param)
        return kvp[1] || '';
    }
    return undefined;
  },

  /**
   * Convert URI object to string representation.
   */
  convertToString: function () {
    var authority = this.authority ? '//' + this.authority + '/' : '',
        query     = this.query     ? '?'  + this.query           : '',
        fragment  = this.fragment  ? '#'  + this.fragment        : '';
    return this.scheme + ':' + authority + this.path + query + fragment;
  }
});
/**
 * Namespace for OX settings.
 *
 * This provides top-level knobs to tweak in order to adjust behavior.
 */
OX.Settings = OX.Base.extend(/** @lends OX.Settings*/{
  /**
   * Various URIs of interest.
   */
  URIs: {
    entity: {
      auth: OX.URI.parse('xmpp:commands.auth.xmpp.onsip.com')
    },

    /**
     * URIs for Ad Hoc Commands.
     */
    command: {
      /** URI for Ad Hoc Command to create a call. */
      createCall: OX.URI.parse('xmpp:commands.active-calls.xmpp.onsip.com?;node=create'),
      /** URI for Ad Hoc Command to transfer a call. */
      transferCall: OX.URI.parse('xmpp:commands.active-calls.xmpp.onsip.com?;node=transfer'),
      /** URI for Ad Hoc Command to terminate a call. */
      terminateCall: OX.URI.parse('xmpp:commands.active-calls.xmpp.onsip.com?;node=terminate'),
      /** URI for Ad Hoc Command to cancel a call. */
      cancelCall: OX.URI.parse('xmpp:commands.active-calls.xmpp.onsip.com?;node=cancel'),
      /** URI for Ad Hoc Command to label a call. */
      labelCall: OX.URI.parse('xmpp:commands.recent-calls.xmpp.onsip.com?;node=label'),

      /** URI for Ad Hoc Command to cache a voicemail. */
      cacheVoicemail: OX.URI.parse('xmpp:commands.voicemail.xmpp.onsip.com?;node=cache'),
      /** URI for Ad Hoc Command to delete a voicemail. */
      deleteVoicemail: OX.URI.parse('xmpp:commands.voicemail.xmpp.onsip.com?;node=delete'),

      /** URI for Ad Hoc Command to authorize with a plain-text password. */
      authorizePlain: OX.URI.parse('xmpp:commands.auth.xmpp.onsip.com?;node=authorize-plain'),

      /** URI for Ad Hoc Command to push roster groups. */
      pushRosterGroups: OX.URI.parse('xmpp:commands.rosters.xmpp.onsip.com?;node=push-roster-groups')
    },

    /**
     * URIs for PubSub.
     */
    pubSub: {
      /** URI for active call PubSub service. */
      activeCalls: OX.URI.parse('xmpp:pubsub.active-calls.xmpp.onsip.com'),
      /** URI for organization directory PubSub service. */
      directories: OX.URI.parse('xmpp:pubsub.directories.xmpp.onsip.com'),
      /** URI for user preferences PubSub service. */
      preferences: OX.URI.parse('xmpp:pubsub.preferences.xmpp.onsip.com'),
      /** URI for recent call PubSub service. */
      recentCalls: OX.URI.parse('xmpp:pubsub.recent-calls.xmpp.onsip.com'),
      /** URI for user agent PubSub service. */
      userAgents: OX.URI.parse('xmpp:pubsub.user-agents.xmpp.onsip.com'),
      /** URI for voicemail PubSub service. */
      voicemail: OX.URI.parse('xmpp:pubsub.voicemail.xmpp.onsip.com')
    },

    /**
     * URIs for Presence.
     */
    presence: {
      /** URI for sending directed Presence. */
      userAgents: OX.URI.parse('xmpp:commands.user-agents.xmpp.onsip.com')
    }
  }
});
/**
 * OX Connection Adapter abstract object.
 *
 * An instance of this object MUST be supplied to the OX.Connection
 * instance. This object is to be defined by consumers of the API as
 * an adapter to the XMPP connection library that is being used. See
 * the example for using the OX.ConnectionAdapter with the JSJaC XMPP
 * library.
 *
 * @example
 * var conn = new JSJaCConnection();
 * var adapter = OX.ConnectionAdapter.extend({
 *   jid: conn.jid,
 *
 *   registerHandler: function (event, handler) {
 *     return conn.registerHandler(event, handler);
 *   },
 *
 *   unregisterHandler: function (event, handler) {
 *     return conn.unregisterHandler(event, handler);
 *   },
 *
 *   send: function (xml, cb, args) {
 *     return conn._sendRaw(xml, cb, args);
 *   }
 * });
 *
 * var tmp = OX.Connection.extend({connection: adapter});
 *
 * @class
 * @extends OX.Base
 */
OX.ConnectionAdapter = OX.Base.extend(/** @lends OX.ConnectionAdapter# */{
  /** The JID of this connection. */
  jid: function () {},

  /**
   * Send an XML string to the underlying connection.
   *
   * @param {String} xml The XML String to send.
   * @param {Function} callback Called when a response to this packet is received with the first argument being the received packet.
   * @param {Array} args An array of arguments to be passed to callback after the packet.
   *
   * @see OX.Connection#send
   */
  send: function (xml, callback, args) {},

  /**
   * Registers an event handler.
   *
   * @param {String} event The type of stanza for which to listen (i.e., `message', `iq', `presence.')
   * @param {Function} handler The stanza is passed to this function when it is received.
   *
   * @see OX.ConnectionAdapter#unregisterHandler
   * @see OX.Connection#registerJIDHandler
   */
  registerHandler: function (event, handler) {},

  /**
   * Unregisters an event handler.
   *
   * @param {String} event The type of stanza we were listening to (i.e., `message', `iq', `presence.')
   *
   * @see OX.ConnectionAdapter#registerHandler
   * @see OX.Connection#unregisterJIDHandler
   */
  unregisterHandler: function (event) {}
});
/**
 * URI namespace.
 * @namespace
 * @extends OX.Base
 */
OX.URI = OX.Base.extend(/** @lends OX.URI */{
  /**
   * Parse a string into an OX.URI.Base object.
   *
   * @param {String} uriString the URI to parse
   * @returns {OX.URI.Base} A new OX.URI.Base object
   *
   * @example
   * var uri = OX.URI.parse('xmpp:lisa@example.com');
   */
  parse: function (uriString) {
    var scheme, authority, path, query, fragment;

    // Scan for : to find scheme                    - required
    // Scan between // and / to find authority      - optional
    // Scan from end of authority to ? to find path - required
    // Scan from ? to # to find query               - optional
    // Scan from # to EOL to find fragment          - optional
    var parts = uriString.match(/^([^:]*:)(\/\/[^\/]*\/)?([^?]*)(\?[^#]*)?(#.*)?/);
    if (parts[1])
      scheme = parts[1].substr(0, parts[1].length - 1);
    if (parts[2])
      authority = parts[2].substr(2, parts[2].length - 2).substr(0, parts[2].length - 3);
    if (parts[3])
      path = parts[3];
    if (parts[4])
      query = parts[4].substr(1, parts[4].length - 1);
    if (parts[5])
      fragment = parts[5].substr(1, parts[5].length - 1);

    return OX.URI.Base.extend({scheme: scheme, authority: authority,
                               path: path, query: query, fragment: fragment});
  },

  /**
   * Convert an object into an OX.URI.Base object.
   *
   * @param {Object} object an object with these members: scheme, path, authority, query, fragment
   * @returns {OX.URI.Base} A new URI object
   *
   * @example
   * var uri = OX.URI.fromObject({scheme: 'xmpp', path: 'lisa@example.com'});
   */
  fromObject: function (object) {
    return OX.URI.Base.extend(object);
  }
});

/**
 * Traits object for URI.
 * @namespace
 * @extends OX.Base
 */
OX.URI.Base = OX.Base.extend(/** @lends OX.URI.Base# */{
  /**
   * The URI scheme.
   *
   * @default "xmpp"
   */
  scheme: 'xmpp',

  /**
   * The URI authority section.
   */
  authority: null,

  /**
   * The URI path.
   */
  path: null,

  /**
   * The URI query parameters.
   */
  query: null,

  /**
   * The URI fragment identifier.
   */
  fragment: null,

  /**
   * Return the action, if any, in the query parameters.
   *
   * @example
   * uri.action();
   *
   * @returns {String} The action of this query, or undefined if none found.
   */
  action: function () {
    if (!this.query)
      return undefined;

    var parts = this.query.split(';');
    if (parts[0] === '')
      return undefined;
    else
      return parts[0];
  },

  /**
   * Return the value, if any, for a parameter in the query
   * parameters.
   *
   * @example
   * uri.queryParam('paramName');
   *
   * @param {String} param The parameter who's value is looked up.
   * @returns {String} The value of the parameter, or undefined if not found.
   */
  queryParam: function (param) {
    if (!this.query)
      return undefined;

    var parts = this.query.split(';');
    for (var i = 1, len = parts.length; i < len; i++) {
      var kvp = parts[i].split('=');
      if (kvp[0] === param)
        return kvp[1] || '';
    }
    return undefined;
  },

  /**
   * Convert URI object to string representation.
   */
  convertToString: function () {
    var authority = this.authority ? '//' + this.authority + '/' : '',
        query     = this.query     ? '?'  + this.query           : '',
        fragment  = this.fragment  ? '#'  + this.fragment        : '';
    return this.scheme + ':' + authority + this.path + query + fragment;
  }
});
/**
 * Mixins namespace.
 * @namespace
 */
OX.Mixins = {};

/**
 * Entity Time Mixin
 *
 * @namespace
 *
 * XEP 0202: Entity Time
 * http://xmpp.org/extensions/xep-0202.html
 *
 * @requires connection A property which is an {@link OX.ConnectionAdapter} object on receiving object.
 */
OX.Mixins.EntityTime = function() {
  return /** @lends OX.Mixins.EntityTime# */ {
    getTime: function (entityURI, callbacks) {
      var iq = OX.XMPP.IQ.extend(),
          time = OX.XML.Element.extend({
            name: 'time',
            xmlns: 'urn:xmpp:time'
          });

      iq.to(entityURI.path);
      iq.type('get');
      iq.addChild(time);

      this.connection.send(iq.convertToString(), function(packet) {
        if (packet.getType() === 'error' && callbacks.onError) {
          callbacks.onError(packet);
        } else if (callbacks.onSuccess) {
          var node = packet.getNode(),
            elTZO = node.getElementsByTagName('tzo')[0],
            elUTC = node.getElementsByTagName('utc')[0];

          callbacks.onSuccess(packet, {
            tzo: elTZO && (elTZO.textContent || elTZO.text),
            utc: elUTC && (elUTC.textContent || elUTC.text)
          });
        }
      });
    }
  };
}();

/**
 * CallDialog mixin.
 *
 * @namespace
 *
 * @requires connection A property which is an {@link OX.ConnectionAdapter} object on receiving object.
 * @requires callID property on receiving object.
 * @requires fromTag property on receiving object.
 * @requires toTag property on receiving object.
 */
OX.Mixins.CallDialog = function () {
  return /** @lends OX.Mixins.CallDialog# */{
    /**
     * Transfer a call to a sip address.
     *
     * @param {String} targetURI To what SIP URI to transfer the active call.
     * @param {String} endpoint Either 'caller' or 'callee'
     * @param {Object} [callbacks] An object supplying functions for 'onSuccess', and 'onError'.
     *
     * @see http://wiki.junctionnetworks.com/docs/Active-Calls_Component#transfer
     * @example
     * call.transfer('sip:lisa@example.com', 'callee');
     */
    transfer: function (targetURI, endpoint, callbacks) {
      var iq    = OX.XMPP.IQ.extend(),
          cmd   = OX.XMPP.Command.extend(),
          xData = OX.XMPP.XDataForm.extend(),
          uri   = OX.Settings.URIs.command.transferCall;

      callbacks = callbacks || {};

      iq.to(uri.path);
      iq.type('set');
      cmd.node(uri.queryParam('node'));
      xData.type('submit');
      xData.addField('call-id',    this.callID);
      xData.addField('from-tag',   this.fromTag);
      xData.addField('to-tag',     this.toTag);
      xData.addField('target-uri', targetURI);
      xData.addField('endpoint',   endpoint);

      iq.addChild(cmd.addChild(xData));

      this.connection.send(iq.convertToString(), function (packet) {
        if (!packet)
          return;

        if (packet.getType() === 'error' && callbacks.onError) {
          callbacks.onError(packet);
        } else if (callbacks.onSuccess) {
          callbacks.onSuccess();
        }
      }, []);
    },

    /**
     * Terminate this call.
     *
     * @param {Object} [callbacks] An object supplying functions for 'onSuccess', and 'onError'.
     *
     * @see http://wiki.junctionnetworks.com/docs/Active-Calls_Component#terminate
     * @example
     * call.terminate();
     */
    terminate: function (callbacks) {
      var iq    = OX.XMPP.IQ.extend(),
          cmd   = OX.XMPP.Command.extend(),
          xData = OX.XMPP.XDataForm.extend(),
          uri   = OX.Settings.URIs.command.terminateCall;

      callbacks = callbacks || {};

      iq.to(uri.path);
      iq.type('set');
      cmd.node(uri.queryParam('node'));
      xData.type('submit');
      xData.addField('call-id',  this.callID);
      xData.addField('from-tag', this.fromTag);
      xData.addField('to-tag',   this.toTag);

      iq.addChild(cmd.addChild(xData));

      this.connection.send(iq.convertToString(), function (packet) {
        if (!packet)
          return;

        if (packet.getType() === 'error' && callbacks.onError) {
          callbacks.onError(packet);
        } else if (callbacks.onSuccess) {
          callbacks.onSuccess();
        }
      }, []);
    },

    /**
     * Cancel this call.
     *
     * @param {Object} [callbacks] An object supplying functions for 'onSuccess', and 'onError'.
     *
     * @see http://wiki.junctionnetworks.com/docs/Active-Calls_Component#cancel
     * @example
     * call.cancel();
     */
    cancel: function (callbacks) {
      var iq    = OX.XMPP.IQ.extend(),
          cmd   = OX.XMPP.Command.extend(),
          xData = OX.XMPP.XDataForm.extend(),
          uri   = OX.Settings.URIs.command.cancelCall;

      callbacks = callbacks || {};

      iq.to(uri.path);
      iq.type('set');
      cmd.node(uri.queryParam('node'));
      xData.type('submit');
      xData.addField('call-id',  this.callID);
      xData.addField('from-tag', this.fromTag);

      iq.addChild(cmd.addChild(xData));

      this.connection.send(iq.convertToString(), function (packet) {
        if (!packet)
          return;

        if (packet.getType() === 'error' && callbacks.onError) {
          callbacks.onError(packet);
        } else if (callbacks.onSuccess) {
          callbacks.onSuccess();
        }
      }, []);
    }
  };
}();

/**
 * CallLabeler mixin.
 *
 * @namespace
 * @requires connection A property which is an {@link OX.ConnectionAdapter} object on receiving object.
 * @requires callID property on receiving object.
 */
OX.Mixins.CallLabeler = function () {
  return /** @lends OX.Mixins.CallLabeler# */{
    /**
     * Label a call with a short string.
     *
     * @param {String} label A short string used to label this call.
     * @param {Object} [callbacks] An object supplying functions for 'onSuccess', and 'onError'.
     *
     * @example
     * call.label('alice');
     */
    label: function (label, callbacks) {
      var iq    = OX.XMPP.IQ.extend(),
          cmd   = OX.XMPP.Command.extend(),
          xData = OX.XMPP.XDataForm.extend(),
          uri   = OX.Settings.URIs.command.labelCall;

      callbacks = callbacks || {};

      iq.to(uri.path);
      iq.type('set');
      cmd.node(uri.queryParam('node'));
      xData.type('submit');
      xData.addField('call-id', this.callID);
      xData.addField('label',   label);

      iq.addChild(cmd.addChild(xData));

      this.connection.send(iq.convertToString(), function (packet) {
        if (!packet)
          return;

        if (packet.getType() === 'error' && callbacks.onError) {
          callbacks.onError(packet);
        } else if (callbacks.onSuccess) {
          callbacks.onSuccess();
        }
      }, []);
    }
  };
}();

/**
 * Subscribable mixin.
 *
 * @namespace
 * @requires connection A property which is an {@link OX.ConnectionAdapter} object on receiving object.
 * @requires pubSubURI The URI of the PubSub service.
 * @requires itemFromPacket A function which takes a packet argument and returns an item.
 */
OX.Mixins.Subscribable = function () {
  /**#nocode+*/
  function packetType(element) {
    switch (element.tagName) {
    case 'subscription':
      return element.getAttribute('subscription');
    case 'items':
      if (element.firstChild.tagName === 'retract')
        return 'retract';
      else
        return 'publish';
    default:
      return undefined;
    }
  }

  function convertItems(document) {
    function itemURI(itemID, node) {
      var from  = document.getAttribute('from'),
          items = document.firstChild.firstChild;

      return OX.URI.fromObject({path: from,
                                query: ';node=' + node + ';item=' + itemID});
    }
    function publishTime(element) {
      var firstChild  = element.firstChild,
          publishTime = firstChild && firstChild.getAttribute('publish-time');

      return publishTime;
    }

    /*
     * TODO: Without XPath we're taking some schema risks
     * here. Really we only want `/iq/pubsub/items/item'
     * nodes. Since we can't do that easily, just grab any `items'
     * elements and pass any immediate descendants named `item' to
     * itemFromElement.
     */
    var rc    = [],
        items = document.getElementsByTagName('items') || [];

    // Grab the first `items' node found.
    for (var i = 0, len = items.length; i < len; i++) {
      if (items[i] && items[i].childNodes) {
        var children = items[i].childNodes,
            node     = items[i].getAttribute('node'),
            item;

        for (var ii = 0, ilen = children.length; ii < ilen; ii++) {
          if (children[ii].tagName && children[ii].tagName === 'item') {
            item = this.itemFromElement(children[ii]);

            item.publishTime = publishTime(children[ii]);
            item.uri = itemURI(children[ii].getAttribute('id'),
                               node);
            rc.push(item);
          }
        }
      }
    }

    return rc;
  }

  function fireEvent(type, packet) {
    function subscriptionURI() {
      var elt    = packet.getNode(),
          from   = elt.getAttribute('from'),
          sub    = elt.firstChild.firstChild,
          node   = sub.getAttribute('node');

      return OX.URI.fromObject({path:   from, query: ';node=' + node});
    }

    function retractURI() {
      var elt    = packet.getNode(),
          from   = elt.getAttribute('from'),
          items  = elt.getElementsByTagName('items')[0],
          node   = items.getAttribute('node'),
          itemID = items.firstChild.getAttribute('id');

      return OX.URI.fromObject({path:  from,
                                query: ';node=' + node + ';item=' + itemID});
    }

    switch (type) {
    case 'subscribed':
      if (this._subscriptionHandlers.onSubscribed) {
        var subscribedURI = subscriptionURI();
        this._subscriptionHandlers.onSubscribed(subscribedURI);
      }
      break;
    case 'pending':
      if (this._subscriptionHandlers.onPending) {
        var pendingURI = subscriptionURI();
        this._subscriptionHandlers.onPending(pendingURI);
      }
      break;
    case 'none':
      if (this._subscriptionHandlers.onUnsubscribed) {
        var unsubscribedURI = subscriptionURI();
        this._subscriptionHandlers.onUnsubscribed(unsubscribedURI);
      }
      break;
    case 'publish':
      if (this._subscriptionHandlers.onPublish) {
        var items = convertItems.call(this, packet.getNode());
        for (var i = 0, len = items.length; i < len; i++)
          this._subscriptionHandlers.onPublish(items[i]);
      }
      break;
    case 'retract':
      if (this._subscriptionHandlers.onRetract) {
        var retractURI = retractURI();
        this._subscriptionHandlers.onRetract(retractURI);
      }
      break;
    }
  }

  function jidHandler(packet) {
    var event = packet.getNode().getElementsByTagName('event')[0];
    if (!event)
      return;

    fireEvent.call(this, packetType(event.firstChild), packet);
  }

  function getSubscriptionsHandler(packet, node, callbacks, origNode,
                                   redirectCount, strict) {
    callbacks     = callbacks     || {};
    redirectCount = redirectCount || 0;
    origNode      = origNode      || node;

    if (!packet)
      return;

    var finalURI = this.pubSubURI,
        reqURI   = this.pubSubURI;

    if (node) {
      finalURI = finalURI.extend({query: ';node=' + node});
    }

    if (origNode) {
      reqURI   = reqURI.extend({query: ';node=' + origNode});
    }

    if (packet.getType() == 'error' && callbacks.onError) {
      // TODO: handle getSubscriptions redirects
      callbacks.onError(reqURI, finalURI, packet);
    } else if (packet.getType() == 'result' && callbacks.onSuccess) {
      var subscriptions = [],
          subElements = packet.getNode().getElementsByTagName('subscription');
      for (var i=0; i<subElements.length; i++) {
        if (strict && this.connection.getJID() !== subElements[i].getAttribute('jid'))  continue;

        subscriptions.push({
          node: subElements[i].getAttribute('node'),
          jid: subElements[i].getAttribute('jid'),
          subscription: subElements[i].getAttribute('subscription'),
          subid: subElements[i].getAttribute('subid')
        });
      }

      callbacks.onSuccess(reqURI, finalURI, subscriptions, packet);
    }
  }

  function configureNodeHandler(packet, subscription, options, callbacks) {
    if (!packet) return;

    if (packet.getType() === 'error') {
      // TODO: handle redirects
      if (callbacks.onError) {
        callbacks.onError(packet);
      }
    } else if (packet.getType() === 'result' && callbacks.onSuccess) {
      callbacks.onSuccess(packet);
    }
  }

  function subscriptionHandler(packet, node, options, callbacks,
                               origNode, redirects) {
    callbacks = callbacks || {};
    redirects = redirects || 0;

    if (!packet)
      return;

    var finalURI = this.pubSubURI.extend({query: ';node=' + node}),
        reqURI   = this.pubSubURI.extend({query: ';node=' + (origNode || node)});
    if (packet.getType() === 'error') {
      var error = packet.getNode().getElementsByTagName('error')[0];
      if (redirects < 5 && error && error.firstChild &&
          (error.firstChild.tagName === 'redirect' ||
           error.firstChild.tagName === 'gone')) {
        var uri;
        if (window.ActiveXObject) {
          // Browser is IE
          uri = OX.URI.parse(error.firstChild.text);
        } else {
          uri = OX.URI.parse(error.firstChild.textContent);
        }
        var path    = uri.path,
            newNode = uri.queryParam('node');
        if (path && newNode) {
          doSubscribe.call(this, newNode, options, callbacks,
                           origNode, redirects + 1);
        }
      } else if (callbacks.onError) {
        callbacks.onError(reqURI, finalURI, packet);
      }
    } else {
      if (callbacks.onSuccess) {
        callbacks.onSuccess(reqURI, finalURI, packet);
      }

      var pubSub = packet.getNode().getElementsByTagName('pubsub')[0] || {},
          subscription = pubSub.firstChild;
      if (subscription && subscription.tagName === 'subscription') {
        fireEvent.call(this, packetType(subscription), packet);
      }
    }
  }

  function unsubscriptionHandler(packet, node, callbacks) {
    var uri = this.pubSubURI.extend({query: ';node=' + node});
    callbacks = callbacks || {};

    if (!packet)
      return;

    if (packet.getType() === 'error') {
      if (callbacks.onError) {
        callbacks.onError(uri, packet.getNode());
      }
    } else {
      if (callbacks.onSuccess) {
        callbacks.onSuccess(uri, packet.getNode());
      }
    }
  }

  function getItemsHandler(packet, callbacks) {
    callbacks = callbacks || {};

    if (!packet)
      return;

    if (packet.getType() === 'error') {
      if (callbacks.onError) {
        callbacks.onError(packet);
      }
    } else {
      if (callbacks.onSuccess) {
        callbacks.onSuccess(convertItems.call(this, packet.getNode()));
      }
    }
  }

  function zeroPad(spaces, value) {
    var rc = (value || '').toString();
    for (var i = spaces - rc.length; i > 0; i--) {
      rc = '0' + rc;
    }
    return rc;
  }

  var optionTransforms = {
    expire: function (direction, value) {
      switch (direction) {
      case 'fromString':
        return 'oops';
      case 'toString':
        var d  = zeroPad(2, value.getUTCDate()),
            m  = zeroPad(2, value.getUTCMonth() + 1),
            y  = zeroPad(4, value.getUTCFullYear()),
            hh = zeroPad(2, value.getUTCHours()),
            mm = zeroPad(2, value.getUTCMinutes()),
            ss = zeroPad(2, value.getUTCSeconds()),
            ms = zeroPad(4, value.getUTCMilliseconds());
        return y + '-' + m + '-' + d + 'T' + hh + ':' + mm + ':' + ss + '.' + ms + '000Z';
      default:
        return undefined;
      }
    }
  };

  function objectToOptionsForm(options) {
    var xData = OX.XMPP.XDataForm.create({type: 'submit'}),
        opts  = OX.XML.Element.extend({name: 'options'}).create({}, xData);

    xData.addField('FORM_TYPE', 'http://jabber.org/protocol/pubsub#subscribe_options');

    for (var o in options) if (options.hasOwnProperty(o)) {
      var trVal = options[o];
      if (optionTransforms[o]) {
        trVal = optionTransforms[o]('toString', trVal);
      }
      xData.addField('pubsub#' + o, trVal);
    }

    return opts;
  }

  function doConfigureNode(subscription, options, callbacks) {
    var iq = OX.XMPP.IQ.extend(),
        pubsub = OX.XMPP.PubSub.extend();

    iq.to(this.pubSubURI.path);
    iq.type('set');
    iq.addChild(pubsub);

    options = options || {};

    var opts = objectToOptionsForm.call(this, options);
    opts.attr('node', subscription.node);
    opts.attr('jid', subscription.jid);
    opts.attr('subid', subscription.subid);

    pubsub.addChild(opts);

    var that = this;
    var wrappedCb = function() { configureNodeHandler.apply(that, arguments); },
        wrappedArgs = [subscription, options, callbacks];

    this.connection.send(iq.convertToString(), wrappedCb, wrappedArgs);
  }

  function doSubscribe(node, options, callbacks, origNode, redirectCount) {
      var iq        = OX.XMPP.IQ.extend(),
          pubsub    = OX.XML.Element.extend({name:  'pubsub',
                                             xmlns: 'http://jabber.org/protocol/pubsub'}),
          subscribe = OX.XML.Element.extend({name: 'subscribe'});

      iq.to(this.pubSubURI.path);
      iq.type('set');
      subscribe.attr('node', node);
      subscribe.attr('jid', this.connection.getJID());
      pubsub.addChild(subscribe);
      if (options) {
        var opts = objectToOptionsForm.call(this, options);
        pubsub.addChild(opts);
      }
      iq.addChild(pubsub);

      var that = this;
      var cb = function () { subscriptionHandler.apply(that, arguments); };

      this.connection.send(iq.convertToString(), cb,
                           [node, options, callbacks, origNode, redirectCount]);
  }

  function doGetSubcriptions(node, callbacks, origNode, redirectCount, strict) {
    var iq = OX.XMPP.IQ.extend(),
        pub = OX.XMPP.PubSub.extend(),
        sub = OX.XML.Element.extend({name: 'subscriptions'});

    iq.to(this.pubSubURI.path);
    iq.type('get');

    if (node) sub.attr('node', node);

    pub.addChild(sub);
    iq.addChild(pub);

    var that = this;
    var wrappedCb = function() { getSubscriptionsHandler.apply(that, arguments); },
        wrappedArgs = [node, callbacks, origNode, redirectCount, strict];

    this.connection.send(iq.convertToString(), wrappedCb, wrappedArgs);
  }
  /**#nocode-*/

  return /** @lends OX.Mixins.Subscribable# */{
    init: function() {
      var tpl = OX.Mixins.Subscribable._subscriptionHandlers;
      this._subscriptionHandlers = OX.Base.extend(tpl);
    },

    /**
     * Get subscriptions on a node.
     *
     * Passing an initial <tt>node</tt> parameter retrieves subscriptions on the requested
     * node.  Otherwise a single parameter of <tt>callbacks</tt> requests all subscriptions
     * at all nodes of the pubsub service.
     *
     * @see <a href="http://xmpp.org/extensions/xep-0060.html#entity-subscriptions">XEP: 0060 - Entity Subscriptions</a>
     *
     * @param {String} [node] The node name to request subscriptions on. Omitting the node name implies all nodes
     * @param {Object} callbacks an object supplying functions for 'onSuccess' and 'onError'
     * @param {Bool} [strictJIDMatch] Only apply callbacks to subscriptions that match the exact JID as the current connection.
     * This will NOT match a bare JID to a full JID.
     *
     * @example
     * service.getSubscriptions('/', {
     *   onSuccess: function(requestedURI, finalURI, subscriptions, packet) {},
     *   onError: function(requestedURI, finalURI, packet)
     * })
     *
     * @example
     * service.getSubscriptions({
     *   onSuccess: function(requestedURI, finalURI, subscriptions, packet) {},
     *   onError: function(requestedURI, finalURI, packet)
     * })
     */
    getSubscriptions: function(node, callbacks, strictJIDMatch) {
      if (arguments.length == 1) {
        callbacks = arguments[0];
        node = undefined;
        strictJIDMatch = undefined;
      } else if (arguments.length == 2 &&
                 (arguments[0].hasOwnProperty('onSucess') || arguments[0].hasOwnProperty('onError'))) {
        callbacks = arguments[0];
        strictJIDMatch = arguments[1];
        node = undefined;
      }

      doGetSubcriptions.call(this, node, callbacks, node, 0, strictJIDMatch);
    },

    configureNode: function(subscription, options, callbacks) {
      doConfigureNode.apply(this, arguments);
    },

    /**
     * Subscribe to a nade.
     *
     * @param {String} node The node ID to subscribe to.
     * @param {Object} [options] Subscription options.
     * @param {Object} [callbacks] an object supplying functions for 'onSuccess', and 'onError'.
     *
     * @example
     * service.subscribe('/', {
     *   onSuccess: function (requestedURI, finalURI) {},
     *   onError:   function (requestedURI, finalURI) {}
     * });
     *
     * var options = {expires: new Date()};
     * service.subscribe('/', options, {
     *   onSuccess: function (requestedURI, finalURI) {},
     *   onError:   function (requestedURI, finalURI) {}
     * });
     */
    subscribe: function (node, options, callbacks) {
      if (arguments.length == 2) {
        callbacks = options;
        options   = undefined;
      }

      doSubscribe.call(this, node, options, callbacks, node, 0);
    },

    /**
     * Unsubscribe from a node.
     *
     * @param {String} node The node ID to subscribe to
     * @param {Object} [callbacks] an object supplying functions for 'onSuccess', and 'onError'
     *
     * @example
     * service.unsubscribe('/', {
     *   onSuccess: function (uri) {},
     *   onError:   function (uri) {}
     * });
     */
    unsubscribe: function (node, callbacks, item) {
 

        var iq          = OX.XMPP.IQ.extend(),
          pubsub      = OX.XML.Element.extend({name:  'pubsub',
                                               xmlns: 'http://jabber.org/protocol/pubsub'}),
          unsubscribe = OX.XML.Element.extend({name: 'unsubscribe'});

      iq.to(this.pubSubURI.path);
      iq.type('set');
      unsubscribe.attr('node', node);

      if(item.jid){

          unsubscribe.attr('jid',  item.jid);
      }else{

          unsubscribe.attr('jid',  this.connection.getJID());
      }

      if(item.sid){
          unsubscribe.attr('subid', item.sid);
      }

      iq.addChild(pubsub.addChild(unsubscribe));

      var that = this;
      var cb = function () { unsubscriptionHandler.apply(that, arguments); };

      this.connection.send(iq.convertToString(), cb, [node, callbacks]);
    },

    /**
     * Get the items on a PubSub node.
     *
     * @param {String} node The node ID to subscribe to
     * @param {Object} [callbacks] an object supplying functions for 'onSuccess', and 'onError'
     *
     * @example
     * service.getItems('/', {
     *   onSuccess: function (items) {},
     *   onError:   function (errorPacket) {}
     * });
     */
    getItems: function (node, callbacks) {
      var iq     = OX.XMPP.IQ.extend(),
          pubsub = OX.XML.Element.extend({name:  'pubsub',
                                          xmlns: 'http://jabber.org/protocol/pubsub'}),
          items  = OX.XML.Element.extend({name: 'items'});

      iq.to(this.pubSubURI.path);
      iq.type('get');
      items.attr('node', node);
      iq.addChild(pubsub.addChild(items));

      var that = this;
      var cb = function () { getItemsHandler.apply(that, arguments); };
      this.connection.send(iq.convertToString(), cb, [callbacks]);
    },

    /**
     * Registers appropriate handlers with the connection for
     * pubSubJID. This should be called after mixin.
     *
     * service.registerSubscriptionHandlers();
     */
    registerSubscriptionHandlers: function () {
      var uri = this.pubSubURI;
      var that = this;
      var handler = function () { jidHandler.apply(that, arguments); };
      this.connection.registerJIDHandler(uri.path, handler);
    },

    /**
     * Registers a handler for an event.
     *
     * Only one handler can be registered for a given event at a time.
     *
     * @param {String} event One of the strings 'onPending', 'onSubscribed', 'onUnsubscribed', 'onPublish' or 'onRetract'.
     * @param {Function} handler A function which accepts one argument, which is the packet response.
     *
     * @example
     * service.registerHandler('onPublish', function (item) {});
     */
    registerHandler: function (event, handler) {
      this._subscriptionHandlers[event] = handler;
    },

    /**
     * Unregisters an event handler.
     *
     * @param {String} event One of the strings 'onPending', 'onSubscribed', 'onUnsubscribed', 'onPublish' or 'onRetract'.
     *
     * @example
     * service.unregisterHandler('onPublish', handlerFunction);
     */
    unregisterHandler: function (event) {
    },

    /**
     * Turn a packet into an item for this service. By default, this
     * does nothing. You must override this within the object being
     * extended for useful behavior.
     */
    itemFromPacket: function (packet) {},

    /**
     * Handlers for various subscription related events.
     *
     * @private
     */
    _subscriptionHandlers: {
      /**
       * This handler is called when we get a pending subscription
       * notification.
       *
       * @param {OX.URI.Base} uri The URI of the subscription request, after redirects.
       */
      onPending: function (uri) {},

      /**
       * This handler is called when we get a completed subscription.
       *
       * @param {OX.URI.Base} uri The URI of the subscription request, after redirects.
       */
      onSubscribed: function (uri) {},

      /**
       * This handler is called when we our subscription is removed.
       *
       * @param {OX.URI.Base} uri The node we were unsubscribed from.
       */
      onUnsubscribed: function (uri) {},

      /**
       * This handler is called when an item is published.
       *
       * @param {OX.Item} item The published item.
       */
      onPublish: function (item) {},

      /**
       * This handler is called when an item is retracted.
       *
       * @param {OX.URI.Base} uri The URI of the retracted item.
       */
      onRetract: function (uri) {}
    }
  };
}();
/**
 * Item abstract object.
 *
 * Service items inherit from this one.
 *
 * @namespace
 * @extends OX.Base
 */
OX.Item = OX.Base.extend(/** @lends OX.Item# */{
  /**
   * The URI of this item.
   *
   * @type OX.URI.Base
   */
  uri: null
});
/**
 * Namespace for service mixins.
 *
 * These objects should not be used directly, but only when
 * instantiated from an {@link OX.Connection} after calling
 * {@link OX.Connection#initConnection}.
 *
 * @namespace
 *
 * @see OX.Connection
 */
OX.Services = {};

/**
 * Namespace for auth related services.
 * @namespace
 * @extends OX.Base
 * @requires connection property inherited from an {@link OX.Connection}.
 */
OX.Services.Auth = OX.Base.extend(OX.Mixins.EntityTime, /** @lends OX.Services.Auth */{

  entityTime: function(cb) {
    return this.getTime(OX.Settings.URIs.entity.auth, cb);
  },

  /**
   * Authorize a JID for a SIP address, authorized via a password. This
   * password is sent in clear text to the XMPP API, so your connection
   * should be encrypted for your own safety.
   *
   * @param {String} address The SIP address for authentication.
   * @param {String} password The web password for the SIP address.
   * @param {String} [jid] The JID to authorize for the SIP address. If unspecified, use the current JID from the underlying connection.
   * @param {Object} [callbacks] An object supplying functions for 'onSuccess', and 'onError'.
   *
   * @example
   * ox.Auth.authorizePlain('sip@example.com', 'password', 'jid@example.com', {
   *   onSuccess: function () {},
   *   onError:   function (error) {}
   * });
   */
  authorizePlain: function (address, password, jid, authForAll) {
    var iq    = OX.XMPP.IQ.extend(),
        cmd   = OX.XMPP.Command.extend(),
        xData = OX.XMPP.XDataForm.extend(),
        uri   = OX.Settings.URIs.command.authorizePlain;

    var callbacks = {};
    if (arguments.length > 0 &&
        arguments[arguments.length - 1] &&
        (arguments[arguments.length - 1].onSucess || arguments[arguments.length - 1].onError)) {
      callbacks = arguments[arguments.length - 1];

      if (authForAll == callbacks) authForAll = null;
      if (jid == callbacks)        jid = null;
      if (password == callbacks)   password = null;
      if (address == callbacks)    address = null;
    }

    iq.to(uri.path);
    iq.type('set');
    cmd.node(uri.queryParam('node'));
    xData.type('submit');
    xData.addField('sip-address', address);
    xData.addField('password', password);
    xData.addField('auth-for-all', authForAll ? 'true' : 'false');
    if (jid)
      xData.addField('jid', jid);

    iq.addChild(cmd.addChild(xData));

    this.connection.send(iq.convertToString(), function (packet) {
      if (!packet)
        return;

      if (packet.getType() === 'error' && callbacks.onError) {
        callbacks.onError(packet);
      } else if (callbacks.onSuccess) {
        callbacks.onSuccess(packet);
      }
    }, []);
  }
});

/**
 * Namespace for active-calls related services.
 * @namespace
 * @extends OX.Base
 * @extends OX.Mixins.Subscribable
 * @requires connection property inherited from an {@link OX.Connection}.
 */
OX.Services.ActiveCalls = OX.Base.extend(OX.Mixins.Subscribable, /** @lends OX.Services.ActiveCalls */ {
  /**
   * URI for this PubSub service.
   */
  pubSubURI: OX.Settings.URIs.pubSub.activeCalls,

  /**
   * Active Call Item.
   * @name OX.Services.ActiveCalls.Item
   * @namespace
   * @extends OX.Item
   * @extends OX.Mixins.CallDialog
   * @extends OX.Mixins.CallLabeler
   */
  Item: OX.Item.extend(OX.Mixins.CallDialog, OX.Mixins.CallLabeler, /** @lends OX.Services.ActiveCalls.Item# */{
    /** The current dialog state. */
    dialogState: null,

    /** The call ID of this call. */
    callID: null,

    /** The URI of the call originator. */
    fromURI: null,

    /** The URI of the call terminator. */
    toURI: null,

    /** The Address of Record for the User Agent Server. */
    toAOR: null,

    /** The tag for the originating leg of the call. */
    fromTag: null,

    /** The tag for the terminating leg of the call. */
    toTag: null,

    /** The branch tag for this pre-dialog event. */
    branch: null,

    /** The tag inserted into the call-setup-id field */
    callSetupID: null,

    isFromCallSetup: function() {
      return !!this.callSetupID;
    },

    isCreated: function() {
      return this.dialogState == 'created';
    },

    isRequested: function() {
      return this.dialogState == 'requested';
    },

    isConfirmed: function() {
      return this.dialogState == 'confirmed';
    },

    /**
     * The XMPP-API requires one of two commands to be called to end
     * a call based on whether or not the call has been answered (confirmed).
     * This is a convenience funtion to make the correct API call based
     * upon the dialog state of the current this object.
     */
    hangup: function() {
      return this.isConfirmed() ? this.terminate() : this.cancel();
    }

  }),

  /**
   * Returns an OX.Service.ActiveCalls.Item from an XML Document.
   * This method should be called once for each item to be constructed.
   * If a DOMElement contains more than one item node, only the first
   * item node will be returned as an OX.Service.ActiveCalls.Item
   *
   * @param {DOMElement} element
   * @returns {OX.Services.ActiveCalls.Item} item
   */
  itemFromElement: function (element) {
    if (!element)
      return undefined;

    var activeCallNode = element.getElementsByTagName('active-call'),
        attrs          = {connection: this.connection};

    if (!activeCallNode || !activeCallNode[0])
      return undefined;

    var childNodes = activeCallNode[0].childNodes;

    function getFirstNodeValue(node) {
      var child = node.firstChild;
      if (child && child.nodeValue == null && child.firstChild) {
        return arguments.callee(child);
      } else if (child && child.nodeValue) {
        return child.nodeValue;
      }
      return undefined;
    }

    for (var i = 0, len = childNodes.length; i < len; i++) {
      var node = childNodes[i];

      if (!node.nodeName)
        continue;

      switch (node.nodeName.toLowerCase()) {
      case 'dialog-state':
        attrs.dialogState = node.firstChild.nodeValue;
        break;
      case 'call-id':
        attrs.callID = node.firstChild.nodeValue;
        break;
      case 'to-aor':
        attrs.toAOR = node.firstChild && node.firstChild.nodeValue;
        break;
      case 'from-uri':
        attrs.fromURI = node.firstChild.nodeValue;
        break;
      case 'to-uri':
        attrs.toURI = node.firstChild.nodeValue;
        break;
      case 'from-tag':
        attrs.fromTag = node.firstChild.nodeValue;
        break;
      case 'to-tag':
        attrs.toTag = node.firstChild && node.firstChild.nodeValue;
        break;
      case 'branch':
        attrs.branch = node.firstChild && node.firstChild.nodeValue;
        break;
      case 'call-setup-id':
        attrs.callSetupID = node.firstChild && node.firstChild.nodeValue;
        break;
      }
    }

    return this.Item.extend(attrs);
  },

  /**
   * Create a new call.
   *
   * @function
   * @param {String} to the SIP address to terminate the call at
   * @param {String} from the SIP address to originate the call from
   * @param {String} callSetupID the end to end call tracking code to be used for a call setup
   * @param {Object} [cb] An object supplying callback functions for 'onSuccess', and 'onError'.
   */
  create: function (to, from, callSetupID, cb) {
    var uri   = OX.Settings.URIs.command.createCall,
        xData = OX.XMPP.XDataForm.create({type: 'submit'}),
        cmd   = OX.XMPP.Command.create({node: uri.queryParam('node')}, xData),
        iq    = OX.XMPP.IQ.create({to: uri.path, type: 'set'}, cmd);

    xData.addField('to', to);
    xData.addField('from', from);
    xData.addField('call-setup-id', callSetupID);

    cb = cb || {};

    this.connection.send(iq.convertToString(), function(packet) {
      if(!packet)
        return;

      if (packet.getType() === 'error'
          && cb.onError && cb.onError.constructor == Function) {
          cb.onError(packet);
      } else if (cb.onSuccess && cb.onSuccess.constructor == Function) {
        cb.onSuccess(packet);
      }
    }, []);
  }
});

/**
 * Namespace for user agent related services.
 * @namespace
 * @extends OX.Base
 * @extends OX.Mixins.Subscribable
 * @requires connection property inherited from an {@link OX.Connection}.
 */
OX.Services.UserAgents = OX.Base.extend(OX.Mixins.Subscribable, /** @lends OX.Services.UserAgents */{
  /**
   * URI for this PubSub service.
   */
  pubSubURI: OX.Settings.URIs.pubSub.userAgents,

  /**
   * User Agent Item.
   * @name OX.Services.UserAgents.Item
   * @namespace
   * @extends OX.Item
   */
  Item: OX.Item.extend(/** @lends OX.Services.UserAgents.Item# */{
    /** The contact of this user agent. */
    contact:  null,

    /** The registration received IP & port. */
    received: null,

    /** The user agent identifier string. */
    device:   null,

    /** The time at which the user agent registration will expire. */
    expires:  null,

    /** The time at which a user-agent dialog event started */
    time: null
  }),

  itemFromElement: function (element) {
    if (!element)
      return undefined;

    var userAgentNode = element.getElementsByTagName('user-agent'),
        attrs         = {connection: this.connection};

    if (!userAgentNode || !userAgentNode[0])
      return undefined;
    var children = userAgentNode[0].childNodes;

    for (var i = 0, len = children.length; i < len; i++) {
      var node = children[i],
          value;

      if (!node.nodeName)
        continue;

      value = (node.firstChild && node.firstChild.nodeValue) || undefined;
      switch (node.nodeName.toLowerCase()) {
      case 'contact':
        attrs.contact = value;
        break;
      case 'received':
        attrs.received = value;
        break;
      case 'device':
        attrs.device = value;
        break;
      case 'expires':
        attrs.expires = value;
        break;
      case 'time':
        attrs.time = value;
        break;
      }
    }

    return this.Item.extend(attrs);
  }
});

/**
 * Namespace for voicemail related services.
 * @namespace
 * @extends OX.Base
 * @extends OX.Mixins.Subscribable
 * @requires connection property inherited from an {@link OX.Connection}.
 */
OX.Services.Voicemail = OX.Base.extend(OX.Mixins.Subscribable, function () {
  function itemType(element) {
    if (!element)
      return undefined;
    else if (element.getElementsByTagName('voicemail').length > 0)
      return 'voicemail';
    else if (element.getElementsByTagName('labels').length > 0)
      return 'labels';
    else
      return undefined;
  }

  function voicemailItem(element) {
    if (!element)
      return undefined;

    var rc = {};
    var voicemailNode = element.getElementsByTagName('voicemail');

    if (!voicemailNode || !voicemailNode[0])
      return undefined;

    var children = voicemailNode[0].childNodes;
    for (var i = 0, len = children.length; i < len; i++) {
      var node = children[i];

      if (!node.nodeName || !node.firstChild)
        continue;

      switch (node.nodeName.toLowerCase()) {
      case 'mailbox':
        rc.mailbox = parseInt(node.firstChild.nodeValue);
        break;
      case 'caller-id':
        rc.callerID = node.firstChild.nodeValue;
        break;
      case 'created':
        rc.created = node.firstChild.nodeValue;
        break;
      case 'sipfrom':
        rc.sipfrom = node.firstChild.nodeValue;
        break;
      case 'duration':
        rc.duration = parseInt(node.firstChild.nodeValue);
        break;
      case 'labels':
        var labels = [];
        for (var j = 0, jlen = node.childNodes.length; j < jlen; j++) {
          var elt = node.childNodes[j];
          if (elt.tagName && elt.tagName == 'label')
            labels.push(elt.firstChild.nodeValue);
        }
        rc.labels = labels;
        break;
      }
    }
    return rc;
  }

  function labelItem(element) {
    if (!element)
      return undefined;

    var rc = {labels: []};
    var labelsNode = element.getElementsByTagName('labels');

    if (!labelsNode || !labelsNode[0])
      return undefined;

    var children = labelsNode[0].childNodes;
    for (var i = 0, len = children.length; i < len; i++) {
      var node = children[i];

      if (node.nodeName && node.nodeName == 'label')
        rc.labels.push(node.firstChild.nodeValue);
    }
    return rc;
  }

  return /** @lends OX.Services.Voicemail */{
    /**
     * URI for this PubSub service.
     */
    pubSubURI: OX.Settings.URIs.pubSub.voicemail,

    /**
     * Voicemail Item.
     * @name OX.Services.Voicemail.Item
     * @namespace
     * @extends OX.Item
     */
    Item: OX.Item.extend(/** @lends OX.Services.Voicemail.Item# */{
      /** The mailbox number for this voicemail. */
      mailbox:  null,

      /** The caller ID of this voicemail. */
      callerID: null,

      /** The time this voicemail was created. */
      created:  null,

      /** How long, in seconds, this voicemail is. */
      duration: null,

      /** An array of labels for this voicemail. */
      labels:   null,

      /**
       * Cache this Voicemail.
       *
       * @param {Object} [callbacks] An object supplying functions for 'onSuccess', and 'onError'.
       *
       * @see http://wiki.junctionnetworks.com/docs/Voicemail_Component#cache
       * @example
       * voicemail.cache();
       */
      cacheMessage: function (callbacks) {
        var iq    = OX.XMPP.IQ.extend(),
            cmd   = OX.XMPP.Command.extend(),
            xData = OX.XMPP.XDataForm.extend(),
            uri   = OX.Settings.URIs.command.cacheVoicemail,
            node_parts     = this.uri.queryParam('node').split('/'),
            vm_sip_address = node_parts[2] + '@' + node_parts[1],
            vm_id          = this.uri.queryParam('item');

        callbacks = callbacks || {};

        iq.to(uri.path);
        iq.type('set');
        cmd.node(uri.queryParam('node'));
        xData.type('submit');
        xData.addField('vm-sip-address', vm_sip_address);
        xData.addField('vm-id', vm_id);

        iq.addChild(cmd.addChild(xData));

        this.connection.send(iq.convertToString(), function (packet) {
          if (!packet) return;
          if (packet.getType() === 'error' && callbacks.onError && callbacks.onError.constructor == Function) {
            callbacks.onError(packet);
          } else if (callbacks.onSuccess && callbacks.onSuccess.constructor == Function) {
            callbacks.onSuccess(packet);
          }
        }, []);
      },

      /**
       * Delete this Voicemail.
       *
       * @param {Object} [callbacks] An object supplying functions for 'onSuccess', and 'onError'.
       *
       * @see http://wiki.junctionnetworks.com/docs/Voicemail_Component#delete
       * @example
       * voicemail.delete();
       */
      deleteMessage: function (callbacks) {
        var iq    = OX.XMPP.IQ.extend(),
            cmd   = OX.XMPP.Command.extend(),
            xData = OX.XMPP.XDataForm.extend(),
            uri   = OX.Settings.URIs.command.deleteVoicemail,
            node_parts     = this.uri.queryParam('node').split('/'),
            vm_sip_address = node_parts[2] + '@' + node_parts[1],
            vm_id          = this.uri.queryParam('item');

        callbacks = callbacks || {};

        iq.to(uri.path);
        iq.type('set');
        cmd.node(uri.queryParam('node'));
        xData.type('submit');
        xData.addField('vm-sip-address', vm_sip_address);
        xData.addField('vm-id', vm_id);

        iq.addChild(cmd.addChild(xData));

        this.connection.send(iq.convertToString(), function (packet) {
          if (!packet) return;
          if (packet.getType() === 'error' && callbacks.onError && callbacks.onError.constructor == Function) {
            callbacks.onError(packet);
          } else if (callbacks.onSuccess && callbacks.onSuccess.constructor == Function) {
            callbacks.onSuccess(packet);
          }
        }, []);
      }

    }),

    /**
     * Voicemail Label Item
     *
     * @name OX.Services.Voicemail.LabelItem
     * @namespace
     * @extends OX.Item
     */
    LabelItem: OX.Item.extend(/** @lends OX.Services.Voicemail.LabelItem#*/{
      /** An array of all voicemail labels. */
      labels: null
    }),

    itemFromElement: function (element) {
      var rc, item;

      switch (itemType(element)) {
      case 'voicemail':
        item = voicemailItem(element);
        if (item)
          rc = this.Item.extend(item, {connection: this.connection});
        break;
      case 'labels':
        item = labelItem(element);
        if (item)
          rc = this.LabelItem.extend(item, {connection: this.connection});
        break;
      }

      return rc;
    }
  };
}());

/**
 * Namespace for directory related services.
 * @namespace
 * @extends OX.Base
 * @extends OX.Mixins.Subscribable
 * @requires connection property inherited from an {@link OX.Connection}.
 */
OX.Services.Directories = OX.Base.extend(OX.Mixins.Subscribable, /** @lends OX.Services.Directories */{

  /**
   * URI for the PubSub directories service
   */
  pubSubURI: OX.Settings.URIs.pubSub.directories,

  AliasItem: OX.Item.extend(/** @lends OX.Service.Directories.AliasItem# */{
    sipURI: null,
    xmppURI: null,
    id: function() {
 
      return this.uri.queryParam('item');
    }
  }),

  EntityItem: OX.Item.extend(/** @lends OX.Service.Directories.EntityItem# */{
    sipURI: null,
    name: null,
    id: function() {
   
      return this.uri.queryParam('item');
    }
  }),

  itemFromElement: function(element) {
    if (!element)
      return undefined;

    var aliasNode =  element.getElementsByTagName('alias'),
        entityNode = element.getElementsByTagName('entity'),
        node       = aliasNode[0] || entityNode[0],
        attrs      = { connection: this.connection };

    if (!node)
      return undefined;

    var childNodes = node.childNodes;

    for (var i=0, len=childNodes.length; i<len; i++) {
      var childNode = childNodes[i],
          childNodeName = childNode.nodeName,
          value = (childNode && childNode.firstChild && childNode.firstChild.nodeValue) || undefined;

      if (!childNode)
        continue;

      switch (childNodeName.toLowerCase()) {
      case 'sip-uri':
        attrs.sipURI = value;
        break;
      case 'xmpp-uri':
        attrs.xmppURI = OX.URI.parse(value);
        break;
      case 'name':
        attrs.name = value;
        break;
      }
    }

    var ret = aliasNode[0] ? this.AliasItem.extend(attrs) : this.EntityItem.extend(attrs);
    return ret;
  }
});

/**
 * Namespace for preferences related services.
 * @namespace
 * @extends OX.Base
 * @extends OX.Mixins.Subscribable
 * @requires connection property inherited from an {@link OX.Connection}.
 */
OX.Services.Preferences = OX.Base.extend(OX.Mixins.Subscribable, /** @lends OX.Services.Preferences */{});

/**
 * Namespace for recent call related services.
 * @namespace
 * @extends OX.Base
 * @extends OX.Mixins.Subscribable
 * @requires connection property inherited from an {@link OX.Connection}.
 */
OX.Services.RecentCalls = OX.Base.extend(OX.Mixins.Subscribable, /** @lends OX.Services.RecentCalls */{});

/**
 * Namespace for roster related services.
 * @namespace
 * @extends OX.Base
 * @requires connection property inherited from an {@link OX.Connection}.
 */
OX.Services.Rosters = OX.Base.extend(OX.Mixins.Subscribable, /** @lends OX.Services.Rosters */{
  /**
   * Push a roster group from the Junction Networks XMPP API Rosters Component.
   * The first time this is called, a user will receive a series of roster add requests for
   * every user in his organization. The next time he requests roster information he will only
   * receive deltas; that is, add requests of any new users since his last request,
   * modify requests for any user's who have changed contact information, and
   * delete requests for any users who may have been deleted.
   *
   * @param {String} [jid] The full JID to push roster groups to; if not provided, the JID in the IQ 'from' attribute will be assumed.
   *
   * @example
   * ox.Rosters.pushRosterGroups('jid@example.com', {
   *   onSuccess: function () {},
   *   onError:   function (error) {}
   * });
   */
  pushRosterGroups: function (jid) {
    var iq    = OX.XMPP.IQ.extend(),
        cmd   = OX.XMPP.Command.extend(),
        xData = OX.XMPP.XDataForm.extend(),
        uri   = OX.Settings.URIs.command.pushRosterGroups;

    var callbacks = {};
    if (arguments.length > 0 && arguments[arguments.length - 1])
      callbacks = arguments[arguments.length - 1];

    iq.to(uri.path);
    iq.type('set');
    cmd.node(uri.queryParam('node'));
    xData.type('submit');
    if (jid)
      xData.addField('jid', jid);

    iq.addChild(cmd.addChild(xData));

    this.connection.send(iq.convertToString(), function (packet) {
      if (!packet)
        return;

      if (packet.getType() === 'error' && callbacks.onError) {
        callbacks.onError(packet);
      } else if (callbacks.onSuccess) {
        callbacks.onSuccess(packet);
      }
    }, []);
  }
});
/**
 * Connection object to use for all OXJS connections. The +initConnection+
 * {@link OX.Connection#initConnection} method MUST be called after
 * extending this object.
 *
 * @class
 * @extends OX.Base
 * @property {OX.Services.Auth} Auth#
 * @property {OX.Services.Auth} ActiveCalls#
 * @property {OX.Services.Auth} UserAgents#
 * @property {OX.Services.Auth} Voicemail#
 * @property {OX.Services.Auth} Directories#
 * @property {OX.Services.Auth} Preferences#
 * @property {OX.Services.Auth} RecentCalls#
 */
OX.Connection = OX.Base.extend(/** @lends OX.Connection# */{
  /**
   * Map of instance names to instance objects. Used during
   * initConnection().
   *
   * @see OX.Connection#initConnection
   */
  services: {
    Auth:        OX.Services.Auth,
    ActiveCalls: OX.Services.ActiveCalls,
    Directories: OX.Services.Directories,
    Preferences: OX.Services.Preferences,
    RecentCalls: OX.Services.RecentCalls,
    UserAgents:  OX.Services.UserAgents,
    Voicemail:   OX.Services.Voicemail,
    Rosters:     OX.Services.Rosters
  },

  /**
   * Map of jids to event handler functions. Used when message events
   * are received from the connection.
   *
   * @see OX.Connection#registerJIDHandler
   * @see OX.Connection#unregisterJIDHandler
   */
  jidHandlers: {},

  /**
   * Initialize the service properties.
   *
   * @example
   * var ox = OX.Connection.extend();
   * ox.initConnection();
   *
   * @return {OX.Connection}
   */
  initConnection: function () {
    if (!this.getJID() || this.getJID() == '') throw new OX.Error('missing JID');

    var serviceMap = {};

    for (var s in this.services) if (this.services.hasOwnProperty(s)) {
      var service = this.services[s];

      this[s] = service.extend({connection: this});
      if (service.pubSubURI) {
        serviceMap[service.pubSubURI] = service;
      }
    }

    // Register for incoming messages.
    var that = this;
    this.connection.registerHandler('message', function (msg) {
      var from = msg.getFrom();
      var fn = that.jidHandlers[from];
      if (fn) {
        fn(msg);
      }
    });

    return this;
  },

  /**
   * Sends an XML string to the connection adapter.
   *
   * @param {String} xml The XML String to send.
   * @param {Function} callback Called when a response to this packet is received with the first argument being the received packet.
   * @param {Array} [args] An array of arguments to be passed to callback after the packet.
   *
   * @see OX.ConnectionAdapter#send
   */
  send: function (xml, callback, args) {
    this.connection.send(xml, callback, args || []);
  },

  /**
   * Returns the JID of this connection.
   *
   * @example
   * ox.getJID();
   *
   * @returns {String} This connection's JID.
   *
   * @see OX.ConnectionAdapter#jid
   */
  getJID: function () {
    return this.connection.jid();
  },

  /**
   * Registers a message event handler for a JID. Only one
   * handler is active at a time per JID.
   *
   * @example
   * var ox = OX.Connection.extend().initConnection();
   * ox.registerJIDHandler('pubsub.active-calls.xmpp.onsip.com', function (packet) {
   *   ...
   * });
   *
   * @param {String} jid The jid who's events we listen to.
   * @param {Function} handler Function of one argument: the message packet received.
   * @return {OX.Connection} The receiver.
   *
   * @see OX.Connection#registerJIDHandler
   * @see OX.ConnectionAdapter#registerHandler
   */
  registerJIDHandler: function (jid, handler) {
    this.jidHandlers[jid] = handler;
    return this;
  },

  /**
   * Unregister the handler, if any, for a JID.
   *
   * @example
   * var ox = OX.Connection.extend().initConnection();
   * ox.unregisterJIDHandler('pubsub.active-calls.xmpp.onsip.com');
   *
   * @param {String} jid The jid who's events we listen to.
   * @return {OX.Connection} The receiver.
   *
   * @see OX.Connection#unregisterJIDHandler
   * @see OX.ConnectionAdapter#unregisterHandler
   */
  unregisterJIDHandler: function (jid) {
    delete this.jidHandlers[jid];
    return this;
  }
});
/**
 * Namespace for XML elements
 * @namespace
 */
OX.XML = {};

/**
 * A simple XML element class.
 *
 * @example
 * var newElement = OX.XML.Element.extend({name: 'foo'})
 * newElement.attr('bar', 'bam');
 * newElement.addChild(OX.XML.Element.extend({name: 'child'});
 *
 * @extends OX.Base
 * @class
 */
OX.XML.Element = OX.Base.extend(/** @lends OX.XML.Element# */{
  name: null,
  attributes: null,
  xmlns: null,
  children: null,
  text: null,

  /**
   * Get or set attributes on the receiver.
   *
   * @param {String} name The attributes name.
   * @param {String} [value] If value is supplied, the attribute will be set.
   * @returns {String} the value of the attribute.
   */
  attr: function(name,value) {
    this.attributes = this.attributes || {};
    if(value) {
      this.attributes[name] = value;
    }
    return this.attributes[name];
  },

  /**
   * Add a XML child element to the receiver.
   *
   * @param {OX.XML.Element} child The XML element to add as a child.
   * @returns {OX.XML.Element} The receiver.
   */
  addChild: function(child) {
    this.children = this.children || [];
    if(child) {
      this.children.push(child);
    }
    return this;
  },

  /**
   * Return an XML string representation of this element.
   *
   * @returns {String} This XML element as XML text.
   */
  convertToString: function() {
    var ret = "";
    var attrs = [];

    if (this.xmlns) this.attr('xmlns',this.xmlns);

    if(this.attributes) for(var name in this.attributes) {
      var val = this.attributes[name];
      if(!val) continue;

      attrs.push(name + '="' + val + '"');
    }

    ret += "<" + this.name + " _realname='" + this.name + "'";
    ret += (attrs.length > 0) ? ' ' + attrs.join(' ') : '';
    ret += ">";

    var children = this.children || [];
    for (var i = 0, len = children.length; i < len; i++) {
      ret += this.children[i].convertToString();
    }

    if(this.text) ret += this.text;

    ret += "</" + this.name + ">";

    return ret;
  }
}, /** @lends OX.XML.Element */ {

  /**
   * Convenience function for creating a new OX.XML.Element and
   * setting attrs and elements in a single function
   *
   * @param {Object} [attrs] A hash of attribute names to attribute values.
   * @param {OX.XML.Element[]} [elements] An array of OX.XML.Element to assign as children.
   * @returns {OX.XML.Element}
   */
  create: function(attrs, elements) {
    var ret = this.extend();

    if (attrs) for(var k in attrs) {
      if (attrs.hasOwnProperty(k)) {
        var v = attrs[k];
        if (!v) continue;
        ret.attr(k,v);
      }
    }

    elements = (elements && elements.addChild) ? [elements] : elements;
    if (elements && elements.length) for(var i=0,len=elements.length; i < len; i++) {
      ret.addChild(elements[i]);
    }

    return ret;
  }
});

/**
 * Namespace for XMPP XML elements.
 * @namespace
 */
OX.XMPP = {};

/**
 * Generic XMPP stanza.
 *
 * @extends OX.XML.Element
 * @class
 */
OX.XMPP.Stanza = OX.XML.Element.extend(/** @lends OX.XMPP.Stanza# */{
  to: function(val) {
    return this.attr('to', val);
  },

  from: function(val) {
    return this.attr('from', val);
  }
});

/**
 * XMPP IQ stanza.
 *
 * @extends OX.XMPP.Stanza
 * @class
 */
OX.XMPP.IQ = OX.XMPP.Stanza.extend(/** @lends OX.XMPP.IQ# */{
  name: 'iq',

  type: function(val) {
    return this.attr('type', val);
  }
});

/**
 * XMPP PubSub Element
 *
 * @extends OX.XML.Element
 * @class
 */
OX.XMPP.PubSub = OX.XML.Element.extend(/** @lends OX.XMPP.PubSub# */{
  name: 'pubsub',
  xmlns: 'http://jabber.org/protocol/pubsub'
});

/**
 * XMPP Message stanza.
 *
 * @extends OX.XMPP.Stanza
 * @class
 */
OX.XMPP.Message = OX.XMPP.Stanza.extend(/** @lends OX.XMPP.Message# */{
  name: 'message'
});

/**
 * XMPP AdHoc Command element.
 *
 * @extends OX.XML.Element
 * @class
 */
OX.XMPP.Command = OX.XML.Element.extend(/** @lends OX.XMPP.Command# */{
  name: 'command',
  xmlns: 'http://jabber.org/protocol/commands',

  node: function(val) {
    return this.attr('node', val);
  },

  action: function(val) {
    return this.attr('action', val);
  }
});

/**
 * XMPP XDataForm element.
 *
 * @extends OX.XML.Element
 * @class
 */
OX.XMPP.XDataForm = OX.XML.Element.extend(/** @lends OX.XMPP.XDataForm# */{
  name: 'x',
  xmlns: 'jabber:x:data',

  type: function(val) {
    return this.attr('type', val);
  },

  /**
   * A convenience method for adding fields and values to the
   * XDataForm. Calling this method will add an XDataField and value to
   * this XDataForm.
   *
   * @param {String} name The name of the field, as identified in the 'var' attribute.
   * @param {String} value The text to insert into the 'value' element.
   * @param {String} type XDataField type see XEP: 0004.
   * @returns {OX.XMPP.XDataForm} The receiver.
   */
  addField: function(name,value,type) {
    var f,v;
    f = OX.XML.Element.extend({name: 'field'});
    f.attr('var',name);

    if(value) {
      v = OX.XML.Element.extend({name: 'value', text: value});
      f.addChild(v);
    }

    if(type) f.attr('type',type);

    return this.addChild(f);
  }
});


/* End ------------------------------------------------------- ox.js*/

