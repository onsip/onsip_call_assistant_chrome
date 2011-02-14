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
		
	chrome.windows.getAll( {populate:true}, function(windows) {
	   for ( var w in windows ) {
	      for ( var t in windows[w].tabs ) {
	         var tabId = windows[w].tabs[t].id;
		 if (tabId) {
		    chrome.tabs.sendRequest(tabId, requestOptions);
		 }
	      }
	   }
	});
    };	

    // alias for the OnSIP_Preferences object
    var pref = OnSIP_Preferences;     	
    return {		
	init : function () {
	   var on = pref.get('enabled');	    	   
	   if (on) {
	       this.enable();
	   } else {
	       this.disable();
	   }
	},			
        enable : function () {
	   pref.set ('enabled', true);

	   var text	= pref.get('badgeOnText');
	   var color	= pref.get('badgeOnColor');
	   var icon	= pref.get('badgeOnIcon');
	   var title	= pref.get('badgeOnTitle');
	   
	   updateBadge (text, color, icon, title);
	   sendPageRequest('parseDOM');
	},    		
	disable : function () {	   	   
	   pref.set('enabled', false);
				
	   var text	= pref.get('badgeOffText');
	   var color	= pref.get('badgeOffColor');
	   var icon	= pref.get('badgeOffIcon');
	   var title	= pref.get('badgeOffTitle');
				
	   updateBadge(text, color, icon, title);
	   sendPageRequest('clearDOM');
	 },			
	 toggle : function() {
	   var ON = pref.get ('enabled');				
	   if ( ON ) {
	      this.disable();
	   } else {
	      this.enable();
	   }
	 }
    };    
};     
     
