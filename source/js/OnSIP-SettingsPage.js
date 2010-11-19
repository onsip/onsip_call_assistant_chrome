$(function(){
    /** Alias for the OnSIP_Preferences object **/
    var pref = OnSIP_Preferences;

    /** Set initial settings **/
    setDefaultSettings();
    setToolTips();

    /** Set a field behaivior **/
    SetHelperBehaivior('#options');
    
	// Save settings
	$('#options').submit(function(e){
        $('#save-options-btn').attr('disabled','disabled');
		// Remove default behaivior
                e.preventDefault();

                /** Error flags **/
                var error        = false;
                var enableButton = false;
                var errorFields  = new Array();

		pref.set('onsipCredentialsGood', false);
                pref.set('highriseEnabled'     , false);

                /** If OnSIP fields are not entered we catch a error **/
                if($('#fromAddress').val().length == 0 || $('#fromAddress').val() == pref.defaults['fromAddress']){
                    error = true;
                    errorFields.push( $('#fromAddress'));
                }

                if($('#onsipPassword').val().length == 0){
                    error = true;
                    errorFields.push( $('#onsipPassword'));
                }
                
                /** Check for a highrise field errors **/
                if(isHighriseDataEntered()){
                    if($('#highriseUrl').val().length == 0 || $('#highriseUrl').val() == pref.defaults['highriseUrl']){
                        error = true;
                        errorFields.push( $('#highriseUrl'));
                    }
                    if($('#highriseToken').val().length == 0 || $('#highriseToken').val() == pref.defaults['highriseToken']){
                        error = true;
                        errorFields.push( $('#highriseToken'));
                    }
                }
                
                /** Proceed if no field Errors **/
                if (!error) {
                    /** Save other settings that do not need a validation **/
                    pref.set('popupDisabled', $('#disablePopup').is(':checked'));

                    /** Show a validating message **/
                    hideAllMessages();
                    $('#validatingMsg').show();
                    
                    /** Remove any previous error messages **/
                    removeErrors();
                    $('#errorMsg').text('');

                    var isHighriseValid = null;                                       
                    var isOnsipValid    = null;

		    /** Save SIP options **/
		    pref.set('fromAddress'  , $('#fromAddress').val());
		    pref.set('onsipServer'  , getDomain($('#fromAddress').val()));
		    pref.set('onsipPassword', $('#onsipPassword').val());

                    /** Get onsip user and save it in the local storage **/
                    getOnsipUser ({
                        onSuccess: function() {
                            console.log('CONTENT PG :: OnSIP connection succeeded, we store in local storage');

                            pref.set('onsipCredentialsGood', true);

                            /** Update tabs **/
                            updateAllTabs($('#fromAddress').val());

                            /** Before showing success message see if Highrise is validated ok, due to asyncronus nature of js **/
                            if (isHighriseDataEntered()) {
                                console.log('Highrise account info is added');
                                        								
                                /** Validate provided Credentials **/
                                validateHighriseCredentials( {
                                    onSuccess : function() {
                                        console.log('CONTENT PG :: Highrise account was verified successfully');

                                        /** Remove errors **/
                                        var errorFields = new Array();
                                        errorFields.push($('#highriseUrl'), $('#highriseToken'));

                                        /** Set highriseValid flag to true **/
                                        isHighriseValid = true;

                                        /** Set Highrise Enabled **/
                                        pref.set('highriseEnabled', true);
                                        
                                        hideAllMessages();
                                        $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
                                        $('#save-options-btn').attr('disabled','');
                                    },
                                    onError : function(){
                                        console.log('Highrise account valid error');
                                        isHighriseValid = false;

                                        hideAllMessages();
                                        $('#errorMsg').text('Invalid highrise domain/url or token provided').clearQueue().fadeOut(150).fadeIn(300);
                                        $('#save-options-btn').attr('disabled','');

                                        var errorFields = new Array();
                                        errorFields.push($('#highriseUrl'), $('#highriseToken'));
                                        showErrorFields(errorFields);
                                    }
                                });                                
                            } else {
                                console.log('highrisde account info is not added');
                                hideAllMessages();
                                $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
                                $('#save-options-btn').attr('disabled','');
                            }
                        },
                        onError: function() {
                            console.log('onsip account valid Error');
                            hideAllMessages();
                            $('#errorMsg').text('Onsip credentials are invalid').clearQueue().fadeOut(150).fadeIn(300);
                            $('#save-options-btn').attr('disabled','');
                                                       
                            var errorFields = new Array();
                            errorFields.push($('#fromAddress'), $('#onsipPassword'));
                            showErrorFields(errorFields);
                        }
                    });
                } else {
                    $('#save-options-btn').attr('disabled','');
                    removeErrors();
                    hideAllMessages();
                    $('#errorMsg').text('Please fill in all fields for Highrise and OnSIP.').clearQueue().fadeOut(150).fadeIn(300);
                    showErrorFields(errorFields);
                }
        
		/** Send command to all tabs to update the click-to-call links **/
		if (pref.get('enabled')) {
		    chrome.windows.getAll({populate: true}, function(windows){
		        for (var w in windows) {
		            for (var t in windows[w].tabs) {
			        var tabId = windows[w].tabs[t].id;
				if (tabId) {
				    chrome.tabs.sendRequest(tabId, { fromAddress: fromAddress });
				}
			    }
			}
		    });
		}
	});
});


function updateAllTabs(fromAddress){
    chrome.windows.getAll({populate: true}, function(windows){
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

/**
 * Validate Highrise Credentials
 * @param callback
 */
function validateHighriseCredentials(callback){
    console.log('CONTENT PG :: Sending verifyHighrise request to BG-PAGE');
    var pref  = OnSIP_Preferences;
    var url   = pref.get ('highriseUrl'); 
    var token = pref.get ('highriseToken');
    
    url = formatUrl (url);
    
    chrome.extension.sendRequest({ verifyHighrise : true, highrise_url : url, highrise_token : token},
        function (response) {
            if (response.ok) {
                if (callback) {
                    callback.onSuccess();
                }
            } else {
                if (callback) {
                    callback.onError();
                }
            }
        }
    );
}

/**
 *  Get User Info From Onsip
 *  @param callback
 */
function getOnsipUser (callback) {
    var pref     = OnSIP_Preferences;
    var username = $('#fromAddress')  .val();                                                                                                                                                 
    var password = $('#onsipPassword').val();

    chrome.extension.sendRequest({ verifyOnSipUser : true, username : username, password : password},
        function (response) {
	    if (response.ok){
		if(callback){
		    callback.onSuccess();
		}
	    } else {
		if (callback){
		    callback.onError();
		}
	    }
	}
    );
}

/**
 * Check if Highrise options were entered
 */
function isHighriseDataEntered(){
    /** Alias for the OnSIP_Preferences object **/
    var pref   = OnSIP_Preferences;
    var hr_url = $('#highriseUrl')  .val();
    var token  = $('#highriseToken').val();
    var tz     = $('#timezone').val();
    
    hr_url = trim(hr_url);
    token  = trim(token);
    
    console.log ('Highrise URL ' + $('#highriseUrl').val() + ' -- ' + $('#highriseToken').val() + ' TZ : ' + tz);
    if(hr_url.length === 0 || hr_url === pref.defaults['highriseUrl']){
	pref.set('highriseUrl'  , pref.defaults['highriseUrl'  ]);
	pref.set('highriseToken', pref.defaults['highriseToken']);
	pref.set('userTimezone' , pref.defaults['userTimezone' ]);
        return false;
    }
    if(token.length  === 0 || token === pref.defaults['highriseToken']){
	pref.set('highriseUrl'  , pref.defaults['highriseUrl'  ]);
        pref.set('highriseToken', pref.defaults['highriseToken']);
        pref.set('userTimezone' , pref.defaults['userTimezone' ]);
        return false;
    }

    hr_url = formatUrl (hr_url);
    pref.set('highriseUrl'  , hr_url);
    pref.set('highriseToken', token);
    pref.set('userTimezone' , tz);

    return true;
}

/**
 *  Hide all messages
 */
function hideAllMessages(){
    $('#savedMsg').hide();
    $('#errorMsg').hide();
    $('#validatingMsg').hide();
}

/**
 * Make fields border red , indicating that those need to be correctly filled
 */
function showErrorFields(objArray){
 
    if(!(objArray instanceof Array)){
        objArray.css('border', '2px solid #cc0000');
        return;
    }
    for(var i in objArray){
        objArray[i].css('border', '2px solid #cc0000');
    }
}

/**
 *  Remove errors from the form
 */
function removeErrors(){
    $('#options input[type="text"]').css('border', '2px solid #004A8F');
    $('#options input[type="password"]').css('border', '2px solid #004A8F');
}

// Extracted to a function for cleanness
function setDefaultSettings(){
        // alias for the OnSIP_Preferences object
        var pref = OnSIP_Preferences;
        $('#disablePopup').attr('checked', pref.get('popupDisabled')) ;
    // Open external links in new window
    $('A[href^="http"]').attr('target', '_blank');

    // Initial value for Onsip Options
    $('#fromAddress').val( pref.get('fromAddress') );
    //$('#onsipUsername').val( pref.get('onsipUsername') );
    $('#onsipPassword').val( pref.get('onsipPassword') );

    // Initial value for a highrise
    $('#highriseUrl').val( pref.get('highriseUrl') );
    $('#highriseToken').val( pref.get('highriseToken') );
    var timezoneSetting = pref.get('userTimezone');
    if(timezoneSetting){
        $('#timezone').val(timezoneSetting);
    }
}

/**
 * SetHelperBehaivior
 */
function SetHelperBehaivior(formID){
    var pref = OnSIP_Preferences;
    // Behaivior for a Text fields
    $(formID).children('fieldset').children('input[type="text"]').each(function(){
        $(this).focus(function(){
           if( $(this).val() == pref.defaults[$(this).attr('name')]){
                $(this).val('');
           }
        });
    });
    // Behaivior for password fields
    $(formID).children('fieldset').children('input[type="password"]').each(function(){
        $(this).focus(function(){
           if( $(this).val() == pref.defaults[$(this).attr('name')]){
                $(this).val('');
           }
        });
    });
}

/**
 * Set up Tooltips
 */
function setToolTips(){
    $('.tool-tip-trigger').tooltip({
        position: "top left"
    });
}