var OnSIP_Preferences = {
	
	defaults : {
		apiUrl			: 'http://www.jnctn.com/restapi', // don't forget to edit the permissions in manifest.json
		apiAction		: 'CallSetup',
		apiTimeout		: 30000,
		
		fromAddress		: 'you@yourdomain.onsip.com',
		timeout			: 3000,
		enabled			: true,
		
		badgeOnColor	: [0, 46, 98, 100],
		badgeOffColor	: [166, 182, 200, 100],
		
		badgeOnText		: 'on',
		badgeOffText	: 'off',
		
		badgeOnTitle	: 'Click to DISABLE / Double-click to open SETTINGS',
		badgeOffTitle	: 'Click to ENABLE / Double-click to open SETTINGS',
		
		badgeOnIcon		: 'images/icon-19.png',
		badgeOffIcon	: 'images/icon-19-off.png'
	},
	
	set : function( name, value ) {
		window.localStorage[name] = JSON.stringify(value);
	},
	
	get : function( name ) {
		
		var value = window.localStorage[name];
		
		if ( value == null || value == undefined ) {
			value = this.defaults[name];
		} else {
			value = JSON.parse(value);
		}
		
		return value;
	}
	

}