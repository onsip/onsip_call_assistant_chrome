var OnSIP_Process = function() {

  var updateBadge = function(text, color, icon, title) {
    chrome.browserAction.setBadgeBackgroundColor ({ 'color' : color });
    chrome.browserAction.setBadgeText ({ 'text': text });
    chrome.browserAction.setTitle ({ title : title });
    chrome.browserAction.setIcon  ({ path  : icon  });
  };

  var sendPageRequest = function (request) {
    var requestOptions = {};

    switch (request) {
    case 'parseDOM' :
      requestOptions.parseDOM = true;
      break;
    case 'clearDOM' :
      requestOptions.clearDOM = true;
      break;
    }

    chrome.windows.getAll(
      {populate:true},
      function(windows) {
        for (var w in windows) {
          for (var t in windows[w].tabs) {
            var tabId = windows[w].tabs[t].id;
            if (tabId) {
              chrome.tabs.sendRequest(tabId, requestOptions);
            }
          }
        }
    });
  };

  var pref = OnSIP_Preferences;
  return {
    init : function () {
      var enabled = pref.get('enabled');
      if (enabled) {
        this.enable();
      } else {
        this.disable();
      }
    },
    enable : function () {
      var text	= pref.get('badgeOnText'),
        color = pref.get('badgeOnColor'),
        icon  = pref.get('badgeOnIcon'),
        title = pref.get('badgeOnTitle');

      pref.set ('enabled', true);

      updateBadge (text, color, icon, title);
      sendPageRequest('parseDOM');
    },
    disable : function () {
      var text	= pref.get('badgeOffText'),
        color = pref.get('badgeOffColor'),
        icon  = pref.get('badgeOffIcon'),
        title = pref.get('badgeOffTitle');

      pref.set('enabled', false);

      updateBadge(text, color, icon, title);
      sendPageRequest('clearDOM');
    },
    toggle : function() {
      var enabled = pref.get('enabled'),
        opts = chrome.extension.getURL('options/highrise/index.html');

      if (!pref.get('onsipCredentialsGood')) {
        chrome.tabs.create({url: opts});
      } else {
        if (enabled) {
          this.disable();
        } else {
          this.enable();
        }
      }
    }
  };
};

