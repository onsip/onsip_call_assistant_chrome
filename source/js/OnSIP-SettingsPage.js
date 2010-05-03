$(function(){
	
	// alias for the OnSIP_Preferences object
	var pref = OnSIP_Preferences;
	
	// Open external links in new window
	$('A[href^="http"]').attr('target', '_blank');
	
	// Initial value for the fromAddress field
	var iniFromAddress = pref.get('fromAddress');
	$('#fromAddress').val(iniFromAddress);
	
	// Save settings
	$('#options').submit(function(e){
		e.preventDefault();
		var fromAddress = $('#fromAddress').val();
		pref.set('fromAddress', fromAddress);
		
		// flash message
		$('#savedMsg').clearQueue().fadeOut(150).fadeIn(300).delay(5000).fadeOut(1000);
		
		// send command to all tabs to update the click-to-call links
		if (pref.get('enabled')) {
			chrome.windows.getAll({ populate: true}, function(windows){
				for (var w in windows) {
					for (var t in windows[w].tabs) {
						var tabId = windows[w].tabs[t].id;
						chrome.tabs.sendRequest(tabId, {
							fromAddress: fromAddress
						});
					}
				}
			});
		}
	});
	
});
