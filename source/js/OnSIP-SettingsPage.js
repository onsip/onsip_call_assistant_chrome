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

                // error flag
                var error = false;
                var errorFields = new Array();
                var enableButton = false;

                // If OnSIP fields are not entered we catch a error
                if($('#fromAddress').val().length == 0 || $('#fromAddress').val() == pref.defaults['fromAddress']){
                    error = true;
                    errorFields.push( $('#fromAddress'));
                }

                if($('#onsipPassword').val().length == 0){
                    error = true;
                    errorFields.push( $('#onsipPassword'));
                }
                
                // Check for a highrise field errors
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
                
                // Proceed if no field Errors
                if(!error){
                    // Save other settings that do not need a validation
                    pref.set('popupDisabled', $('#disablePopup').is(':checked'));

                    // Show a validating message
                    hideAllMessages();
                    $('#validatingMsg').show();
                    
                    // Remove any previous error messages
                    removeErrors();
                    $('#errorMsg').text('');

                    var isOnsipValid = null;
                    var isHighriseValid = null;
                    // Set highrise disabled;
                    
                    pref.set('highriseEnabled', false);

                    // Get onsip user and save it in the local storage
                    getOnsipUser({
                        onSuccess: function(){
                            console.log('onsip account valid success');

                            // Handle initial BOSH connection
                            chrome.extension.sendRequest({setUpBoshConnection : true}, function (response) {});
                            pref.set('onsipCredentialsGood', true);

                            // Save sip options
                            pref.set('fromAddress', $('#fromAddress').val());
                            pref.set('onsipServer', getDomain($('#fromAddress').val()));
                            pref.set('onsipPassword', $('#onsipPassword').val());

                            // Update tabs
                            updateAllTabs($('#fromAddress').val());

                            // Before showing success message see if Highrise is validated ok, due to asyncronus nature of js
                            if( isHighriseDataEntered() ){
                                console.log('highrisde account info is added');
 
                                // Validate provided Credentials
                                validateHighriseCredentials( {
                                    onSuccess : function() {
                                        console.log('highrise account valid success');

                                        // Remove Errors
                                        var errorFields = new Array();
                                        errorFields.push($('#highriseUrl'), $('#highriseToken'));

                                        // Set highriseValid flag to true
                                        isHighriseValid = true;

                                        // Set Highrise Enabled
                                        pref.set('highriseEnabled', true);

                                        // save highrise options
                                        pref.set('highriseUrl', formatUrl($('#highriseUrl').val()));
                                        pref.set('highriseToken', $('#highriseToken').val());
                                        pref.set('userTimezone', $('#timezone').val());

                                        hideAllMessages();
                                        $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
                                        $('#save-options-btn').attr('disabled','');
                                    },
                                    onError : function(){
                                        console.log('highrise account valid Error');
                                        isHighriseValid = false;

                                        hideAllMessages();
                                        $('#errorMsg').text('Invalid highrise domain/url or token provided').clearQueue().fadeOut(150).fadeIn(300);
                                        $('#save-options-btn').attr('disabled','');

                                        var errorFields = new Array();
                                        errorFields.push($('#highriseUrl'), $('#highriseToken'));
                                        showErrorFields(errorFields);
                                    }
                                });
                                
                            }else{
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




                }else{
                    $('#save-options-btn').attr('disabled','');
                    removeErrors();
                    hideAllMessages();
                    $('#errorMsg').text('Please fill in all fields for Highrise and OnSIP.').clearQueue().fadeOut(150).fadeIn(300);
                    showErrorFields(errorFields);
                }
        
		// send command to all tabs to update the click-to-call links
		if (pref.get('enabled')) {
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
    console.log('*** sending a request to bg ***');
    var url = formatUrl($('#highriseUrl').val());
    //url += '/me.xml';
    var token = $('#highriseToken').val();
    
    chrome.extension.sendRequest({ verifyHighrise : true, highriseUrl : url, highriseToken : token},
        function (response) {
            console.log('response.tokenValid');
            console.log(response.tokenValid);
            if( response.tokenValid ){
                if(callback){
                    callback.onSuccess();
                }
            }else{
                if(callback){
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
    var userinfo = null;

    chrome.extension.sendRequest({ verifyOnSipUser : true, username : username, password : password},
        function (response) {
	    if (response.tokenValid){
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
    // alias for the OnSIP_Preferences object
	var pref = OnSIP_Preferences;
    if($('#highriseUrl').val() != 0 && $('#highriseUrl').val() != pref.defaults['highriseUrl']){
        return true;
    }
    if($('#highriseToken').val() != 0 && $('#highriseToken').val() != pref.defaults['highriseToken']){
        return true;
    }
    return false;
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