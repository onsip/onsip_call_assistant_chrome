$(function(){
    var pref = OnSIP_Preferences;    	

    /** Set initial settings **/
    setDefaultSettings();
    setToolTips();

    /** Set a field behaivior **/
    SetHelperBehavior('#options');
    
    /** Save settings **/
    $('#options').submit ( function(e) {
        $('#save-options-btn').attr('disabled','disabled');

	/** Remove default behavior **/
	e.preventDefault();
	    
	pref.set('onsipCredentialsGood', false);
	pref.set('highriseEnabled'     , false);
	pref.set('zendeskEnabled'      , false);

	$('#header-zendesk'  ).removeClass('checkmark');
	$('#header-highrise' ).removeClass('checkmark');

	/** Error flags **/	
	var error_fields = isOnSIPDataEntered ();
        
	clearAlerts();

	/** Proceed if no field Errors **/
	if ( error_fields.length === 0 ) {	    
	    /** Show a validating message **/	    
	    $('#validatingMsg').show();

	    /** Get onsip user and save it in the local storage **/
	    getOnsipUser   ( handleOnSIPLogin ());

	} else {
	    $('#save-options-btn').attr('disabled','');
	    $('#errorMsg').text('Please fill in all fields for Highrise and OnSIP.').clearQueue().fadeOut(150).fadeIn(300);
	    showErrorFields (error_fields);
	}
        
	/** Send command to all tabs to update the click-to-call links **/
	/**
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
	**/
    });
});

function isOnSIPDataEntered () {
    var pref         = OnSIP_Preferences;
    var error_fields = new Array();

    /** If OnSIP fields are not entered we catch a error **/
    if($('#fromAddress').val().length == 0 || $('#fromAddress').val() == pref.defaults['fromAddress']) {
	error_fields.push( $('#fromAddress'));
    }

    if($('#onsipPassword').val().length == 0){
	error_fields.push( $('#onsipPassword'));
    }

    return error_fields;
};

function handleOnSIPLogin () {
    var pref = OnSIP_Preferences;
                        
    /** Save SIP options **/
    pref.set('fromAddress'  , $('#fromAddress').val());
    pref.set('onsipServer'  , getDomain($('#fromAddress').val()));
    pref.set('onsipPassword', $('#onsipPassword').val());

    var obj = {
	onSuccess : function () {
	    console.log('CONTENT PG :: OnSIP connection succeeded, we store in local storage');
	    pref.set('onsipCredentialsGood', true);

	    /** Update tabs **/
	    /** updateAllTabs($('#fromAddress').val()); **/

	    var entered_highrise = isHighriseDataEntered();
	    var entered_zendesk  = isZendeskDataEntered();

	    /** Before showing success message see if Highrise is validated ok, due to asyncronus nature of js **/
	    if (entered_highrise || entered_zendesk) {
		if (entered_zendesk && !$('#input-zendesk').is(':hidden')) {
		    console.log('CONTENT PG :: Zendesk credentials entered');
		    /** Validate provided Zendesk Credentials **/
		    validateZendeskCredentials ( handleZendeskLogin () );
		}
		else if (entered_highrise && !$('#input-highrise').is(':hidden')) {
		    console.log('CONTENT PG :: Highrise credentials entered');		
		    /** Validate provided Highrise Credentials **/
		    validateHighriseCredentials( handleHighriseLogin () );
		}
	    } else {
		console.log('highrisde account info is not added');
		hideAllMessages();
		$('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
		$('#save-options-btn').attr('disabled','');
	    }	    
	},
	onError   : function () {
	    console.log('onsip account valid Error');
	    pref.set('onsipCredentialsGood', false);
	    hideAllMessages();
	    $('#errorMsg').text('Onsip credentials are invalid').clearQueue().fadeOut(150).fadeIn(300);
	    $('#save-options-btn').attr('disabled','');

	    error_fields = new Array();
	    error_fields.push($('#fromAddress'), $('#onsipPassword'));
	    showErrorFields(error_fields);
	}
    };

    return obj;
};

function handleZendeskLogin () {
    var preferences  = OnSIP_Preferences;
    hideAllMessages();
    var obj = {
        onSuccess : function() {
            console.log('CONTENT PG :: Zendesk account was verified successfully');           

            /** Set Zendesk Enabled **/
            preferences.set('zendeskEnabled', true);
            enableZendesk();

            $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
            $('#save-options-btn').attr('disabled','');
        },
        onError : function() {
            console.log('CONTENT PG :: Zendesk account error');
            preferences.set('zendeskEnabled', false);

            $('#errorMsg').text('Invalid Zendesk domain/url or credetials').clearQueue().fadeOut(150).fadeIn(300);
            $('#save-options-btn').attr('disabled','');

	    var error_fields = new Array();
	    error_fields.push($('#zendeskUrl'), $('#zendeskUser'), $('#zendeskPassword'));
            showErrorFields(error_fields);
        }
    };

    return obj;
};

function handleHighriseLogin () {
    var pref = OnSIP_Preferences;
    hideAllMessages();
    var obj  = {
        onSuccess : function() {
	    console.log('CONTENT PG :: Highrise account was verified successfully');
	    
	    /** Set Highrise Enabled **/
	    pref.set('highriseEnabled', true);
	    enableHighrise ();
	    $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
	    $('#save-options-btn').attr('disabled','');
	},
	onError : function() {
	    console.log('CONTENT PG :: Highrise account login error');
	    pref.set('highriseEnabled', false);

	    $('#errorMsg').text('Invalid Highrise domain/url or token provided').clearQueue().fadeOut(150).fadeIn(300);
	    $('#save-options-btn').attr('disabled','');

	    var error_fields = new Array();
	    error_fields.push( $('#highriseUrl'), $('#highriseToken') );
	    showErrorFields(error_fields);
	}
    };

    return obj;
};

/**
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
**/

/** Validate Highrise Credentials **/
function validateHighriseCredentials (callback){
    var pref  = OnSIP_Preferences;
    var url   = pref.get ('highriseUrl'); 
    var token = pref.get ('highriseToken');

    console.log('CONTENT PG :: Sending verifyHighrise request to BG-PAGE');   

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

/** Validate Zendesk Credentials **/
function validateZendeskCredentials (callback) {    
    var pref = OnSIP_Preferences;
    var url  = pref.get ('zendeskUrl');
    var usr  = pref.get ('zendeskUsr');
    var pwd  = pref.get ('zendeskPwd');

    console.log ('CONTENT PG :: Sending verifyZendesk request to BG-PAGE');
    
    chrome.extension.sendRequest({ verifyZendesk : true, zendesk_url : url, zendesk_usr : usr, zendesk_pwd : pwd},
        function (response) {
	    if (callback) {
		if (response.ok) {
		    callback.onSuccess();
		} else {
		    callback.onError();
		}
	    }	    
	}
    );
}
            
/** Get user info from OnSIP **/
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

/** Check if Zendesk options were entered **/
function isZendeskDataEntered (){
    /** Alias for the OnSIP_Preferences object **/
    var pref    = OnSIP_Preferences;
    var zd_url  = $('#zendeskUrl')     .val();
    var zd_user = $('#zendeskUser')    .val();
    var zd_pwd  = $('#zendeskPassword').val();

    var valid   = false;

    zd_url  = trim(zd_url);
    zd_user = trim(zd_user);
    zd_pwd  = trim(zd_pwd);
    
    console.log ('CONTENT PG :: From input field, Zendesk URL -> ' + zd_url);
    if(zd_url.length > 0 && zd_url != pref.defaults['zendeskUrl']) {
	if (zd_user.length > 0 && zd_user != pref.defaults['zendeskUser']) {
	    if (zd_pwd.length > 0) {
		valid = true;
	    }
	}
    }
    
    if (!valid) {
	pref.set('zendeskUrl', pref.defaults['zendeskUrl']);
	pref.set('zendeskUsr', pref.defaults['zendeskUsr']);
	pref.set('zendeskPwd', pref.defaults['zendeskPwd']);
    } else {
	zd_url = formatUrl (zd_url, true);
	pref.set('zendeskUrl', zd_url);
	pref.set('zendeskUsr', zd_user);
	pref.set('zendeskPwd', zd_pwd);

    }
    console.log ('CONTENT BG :: Checking Zendesk values validity ' + valid);
    return valid;
}

/** Check if Highrise options were entered **/
function isHighriseDataEntered(){
    /** Alias for the OnSIP_Preferences object **/
    var pref   = OnSIP_Preferences;
    var hr_url = $('#highriseUrl')  .val();
    var token  = $('#highriseToken').val();
    var tz     = $('#timezone')     .val();    
    var valid  = false;

    hr_url     = trim(hr_url);
    token      = trim(token);
    
    if(hr_url.length > 0 && hr_url != pref.defaults['highriseUrl']) {
        if (token.length > 0 && token != pref.defaults['highriseToken']) {
	    valid = true;
        }
    }

    if (!valid) {
        pref.set('highriseUrl'  , pref.defaults['highriseUrl'  ]);
        pref.set('highriseToken', pref.defaults['highriseToken']);
        pref.set('userTimezone' , pref.defaults['userTimezone' ]);
    } else {
	hr_url = formatUrl (hr_url, false);
	pref.set('highriseUrl'  , hr_url);
	pref.set('highriseToken', token);
	pref.set('userTimezone' , tz);
    }

    console.log ('CONTENT BG :: Checking Highrise values validity ' + valid);
    return valid;
}

function clearAlerts () {
    hideAllMessages();
    removeErrors ();
    $('#errorMsg').text('');
};

/** Hide all messages **/
function hideAllMessages(){
    $('#savedMsg').hide();
    $('#errorMsg').hide();
    $('#validatingMsg').hide();        
}

/** Make fields border red , indicating that those need to be correctly filled **/
function showErrorFields(objArray){ 
    if(!(objArray instanceof Array)){
        objArray.css('border', '2px solid #cc0000');
        return;
    }
    var i, len;
    for(i = 0, len = objArray.length; i < len; i += 1){
        objArray[i].css('border', '2px solid #cc0000');
    }
}

/** Remove errors from the form **/
function removeErrors(){
    $('#options input[type="text"]')    .css('border', '2px solid #004A8F');
    $('#options input[type="password"]').css('border', '2px solid #004A8F');
}

/** Extracted to a function for cleanness **/
function setDefaultSettings(){
    /** Alias for the OnSIP_Preferences object **/
    var pref = OnSIP_Preferences;

    /** $('#disablePopup').attr('checked', pref.get('popupDisabled')) ; **/

    /** Open external links in new window **/
    $('A[href^="http"]').attr('target', '_blank');

    /** Initial value for OnSIP options **/
    $('#fromAddress')  .val (pref.get('fromAddress') );
    $('#onsipPassword').val (pref.get('onsipPassword') );

    /** Initial value for zendesk **/
    $('#zendeskUrl')     .val (pref.get('zendeskUrl'));
    $('#zendeskUser')    .val (pref.get('zendeskUsr'));
    $('#zendeskPassword').val (pref.get('zendeskPwd'));

    /** Initial value for a highrise **/
    $('#highriseUrl')  .val (pref.get('highriseUrl')  );
    $('#highriseToken').val (pref.get('highriseToken'));

    var timezoneSetting = pref.get('userTimezone');
    if (timezoneSetting) {
        $('#timezone').val (timezoneSetting);
    }   
}

function SetHelperBehavior(formID){
    var pref = OnSIP_Preferences;
    /** Behaivior for a Text fields **/
    $(formID).children('fieldset').children('input[type="text"]').each(function(){
        $(this).focus(function(){
           if( $(this).val() == pref.defaults[$(this).attr('name')]){
                $(this).val('');
           }
        });
    });

    /** Behavior for password fields **/
    $(formID).children('fieldset').children('input[type="password"]').each(function(){
        $(this).focus(function(){
           if( $(this).val() == pref.defaults[$(this).attr('name')]){
                $(this).val('');
           }
        });
    });

    console.log ('Zendesk is enabled :: ' + pref.get('zendeskEnabled'));
    
    $('#input-zendesk'   ).hide ();
    $('#input-highrise'  ).hide ();
    if (pref && pref.get('zendeskEnabled')) {
	enableZendesk ();	
    } else if (pref && pref.get('highriseEnabled')) {
	enableHighrise();
    }

    $('#header-zendesk').click( function (e) {
	    if ($('#input-zendesk').is(':hidden')) {
		$('#input-zendesk').slideDown('slow', function() {
		     $('#input-highrise').slideUp('slow');
		});
	    } else {
		$('#input-zendesk').slideUp('slow');
	    }  	    
    });

    $('#header-highrise').click( function (e) {
	    if ($('#input-highrise').is(':hidden')) {
		$('#input-highrise').slideDown('slow', function () {
		    $('#input-zendesk').slideUp('slow');	
		});	     		
	    } else {
		$('#input-highrise').slideUp('slow');
	    }  	    
    });
}

function enableHighrise() {        
    $('#header-zendesk' ).removeClass('checkmark');
    $('#header-highrise').addClass   ('checkmark');
    $('#input-zendesk'  ).hide ();
    $('#input-highrise' ).show ();
}

function enableZendesk () {
    $('#header-highrise').removeClass('checkmark');
    $('#header-zendesk' ).addClass   ('checkmark');
    $('#input-zendesk'  ).show ();
    $('#input-highrise' ).hide ();
}

/** Set up Tooltips **/
function setToolTips(){
    $('.tool-tip-trigger').tooltip({
        position: "top left"
    });
}