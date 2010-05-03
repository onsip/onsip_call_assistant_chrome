var OnSIP_Process = function() {
	
	var updateBadge = function(text, color, icon, title) {
		chrome.browserAction.setBadgeText({ 'text': text });
		chrome.browserAction.setBadgeBackgroundColor({ 'color' : color});
		chrome.browserAction.setIcon({path:icon});
		chrome.browserAction.setTitle({title:title});
	};
	
	var sendPageRequest = function(request) {
		var requestOptions = {};
		
		switch (request) {
			case 'parseDOM' :
				requestOptions.parseDOM = true;
				break;
			case 'clearDOM' :
				requestOptions.clearDOM = true;
				break;
		}
		
		chrome.windows.getAll({populate:true}, function(windows) {
			for ( var w in windows ) {
				for ( var t in windows[w].tabs ) {
					var tabId = windows[w].tabs[t].id;
					chrome.tabs.sendRequest(tabId, requestOptions);
				}
			}
		});
	};
	
	var pref = OnSIP_Preferences; // alias for the OnSIP_Preferences object
	
	return {
			
			init : function() {
				var ON = pref.get('enabled');
				
				if ( ON ) {
					this.enable();
				} else {
					this.disable();
				}
			},
			
			enable : function() {
				pref.set('enabled', true);
				
				var text	= pref.get('badgeOnText');
				var color	= pref.get('badgeOnColor');
				var icon	= pref.get('badgeOnIcon');
				var title	= pref.get('badgeOnTitle');
				
				updateBadge(text, color, icon, title);
				sendPageRequest('parseDOM');
			},
			
			disable : function() {
				pref.set('enabled', false);
				
				var text	= pref.get('badgeOffText');
				var color	= pref.get('badgeOffColor');
				var icon	= pref.get('badgeOffIcon');
				var title	= pref.get('badgeOffTitle');
				
				updateBadge(text, color, icon, title);
				sendPageRequest('clearDOM');
			},
			
			toggle : function() {
				var ON = pref.get('enabled');
				
				if ( ON ) {
					this.disable();
				} else {
					this.enable();
				}
			}
			
	}
			
}
