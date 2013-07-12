var SETTINGS_PG_LOG = OnSIP_Preferences.defaults['debug_sp'];

var _gaq = _gaq || [];
_gaq.push(['_setAccount', OnSIP_Preferences.defaults['gaq']]);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

var _startTimeLoginProc;

$(function(){

  /** Set initial settings **/
  setDefaultSettings();
  setToolTips();

  /** Set a field behaviour**/
  SetHelperBehavior('#options');

  /** Save settings **/
  $('#options').bind('submit', onSubmit);

});

function onSubmit(e) {
  var pref = OnSIP_Preferences;

  _startTimeLoginProc = new Date().getTime();

  /** track save clicks **/
  _gaq.push(['_trackEvent', 'options', 'saveBtnClicked','Click to Save Settings', 1]);

  $('#save-options-btn').attr('disabled','disabled');

  /** Remove default behavior **/
  e && e.preventDefault();

  /** 0 means PERMISSION_ALLOWED **/
  if (window.webkitNotifications.checkPermission() != 0) {
    window.webkitNotifications.requestPermission();
  }

  chrome.extension.sendMessage({ clearCache : true });
  chrome.extension.sendMessage({ checkConnection : true, run : false});

  pref.set('onsipCredentialsGood', false);
  pref.set('highriseEnabled'     , false);
  pref.set('zendeskEnabled'      , false);

  /** Error flags **/
  var error_fields = isOnSIPDataEntered ();

  clearAlerts();

  /** Proceed if no field Errors **/
  if ( error_fields.length === 0 ) {
    /** Show a validating message **/
    $('#validatingMsg').show();

    /** Get onsip user and save it in the local storage **/
    getOnsipUser(handleOnSIPLogin());

    chrome.extension.sendMessage({ checkConnection : true, run : true });
  } else {
    $('#save-options-btn').removeAttr('disabled');
    $('#errorMsg').text('Please fill in all fields for OnSIP and optionally Highrise.').clearQueue().fadeOut(150).fadeIn(300);
    showErrorFields (error_fields);
  }
}

function isOnSIPDataEntered () {
  var pref = OnSIP_Preferences,
    error_fields = new Array();

  /** If OnSIP fields are not entered we catch a error **/
  if($('#fromAddress').val().length == 0 ||
    $('#fromAddress').val() == pref.defaults['fromAddress']) {
    error_fields.push( $('#fromAddress'));
  }

  if($('#onsipPassword').val().length == 0){
    error_fields.push( $('#onsipPassword'));
  }
  return error_fields;
};

/** Get user info from OnSIP **/
function getOnsipUser (callback) {
  var pref = OnSIP_Preferences,
    username = $('#fromAddress').val(),
    password = $('#onsipPassword').val();

  chrome.extension.sendMessage({verifyOnSipUser:true, username:username, password:password},
    function (response) {
      if (callback) {
        var ts = Math.round(((new Date().getTime() - _startTimeLoginProc) / 1000));
        if (isNaN(ts)) ts = 0;
        if (response.ok) {
          _gaq.push(['_trackEvent', 'options', 'onSipLoginSuccess','OnSIP Login Success', ts]);
          callback.onSuccess();
        } else {
          _gaq.push(['_trackEvent', 'options', 'onSipLoginFailed', 'OnSIP Login Failed', ts]);
          callback.onError();
        }
      }
    }
  );
}

function handleOnSIPLogin() {
  var pref = OnSIP_Preferences;

  /** Save SIP options **/
  pref.set('fromAddress', $('#fromAddress').val());
  pref.set('onsipServer', getDomain($('#fromAddress').val()));
  pref.set('onsipPassword', $('#onsipPassword').val());

  return {
    onSuccess : function () {
      SETTINGS_PG_LOG && console.log('SETTINGS PG :: OnSIP connection succeeded, we store in local storage');
      pref.set('onsipCredentialsGood', true);
      hideAllMessages();
      if ($('#zendeskUrl') && $('#zendeskUrl').length) {
        SETTINGS_PG_LOG && console.log('SETTINGS PG :: Fork Zendesk');
        forkZendesk();
      } else if ($('#highriseUrl') && $('#highriseUrl').length) {
        SETTINGS_PG_LOG && console.log('SETTINGS PG :: Fork Highrise');
        forkHighrise();
      } else {
        SETTINGS_PG_LOG && console.log('SETTINGS PG :: highrisde account info is not added');
        $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
        $('#save-options-btn').removeAttr('disabled');
      }
    },
    onError : function () {
      SETTINGS_PG_LOG && console.log('SETTINGS PG :: OnSIP account valid error');
      pref.set('onsipCredentialsGood', false);
      hideAllMessages();
      var err = "Bad login!<br>" +
        "Get your password at " +
        "<a href='https://my.onsip.com' target='_blank'> " +
        "https://my.onsip.com </a>";
      $('#errorMsg').html(err).clearQueue().fadeOut(150).fadeIn(300);
      $('#save-options-btn').removeAttr('disabled');

      error_fields = new Array();
      error_fields.push($('#fromAddress'), $('#onsipPassword'));
      showErrorFields(error_fields);
    }
  };
};

function forkZendesk() {
  var entered_zendesk  = isZendeskDataEntered();
  if ((entered_zendesk instanceof Array) && entered_zendesk.length > 0) {
    $('#errorMsg').text('Invalid Zendesk domain/url or username provided').clearQueue().fadeOut(150).fadeIn(300);
    $('#save-options-btn').removeAttr('disabled');
  } else if (entered_zendesk) {
    SETTINGS_PG_LOG && console.log('SETTINGS PG :: Zendesk credentials entered');
    validateZendeskCredentials ( handleZendeskLogin () );
  } else {
    $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
    $('#save-options-btn').removeAttr('disabled');
  }
}

function forkHighrise() {
  var entered_highrise = isHighriseDataEntered();
  if ((entered_highrise instanceof Array) && entered_highrise.length > 0) {
    $('#errorMsg').text('Invalid Highrise domain/url or token provided').clearQueue().fadeOut(150).fadeIn(300);
    $('#save-options-btn').removeAttr('disabled');
  }
  else if (entered_highrise) {
    SETTINGS_PG_LOG && console.log('SETTINGS PG :: Highrise credentials entered');
    /** Validate provided Highrise Credentials **/
    validateHighriseCredentials( handleHighriseLogin () );
  } else {
    $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
    $('#save-options-btn').removeAttr('disabled');
  }
}

function handleZendeskLogin () {
  var preferences  = OnSIP_Preferences;
  hideAllMessages();
  return {
    onSuccess : function() {
      SETTINGS_PG_LOG && console.log('SETTINGS PG :: Zendesk account was verified successfully');
      /** Set Zendesk Enabled **/
      preferences.set('zendeskEnabled', true);

      $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
      $('#save-options-btn').removeAttr('disabled');
    },
    onError : function() {
      SETTINGS_PG_LOG && console.log('SETTINGS PG :: Zendesk account error');
      preferences.set('zendeskEnabled', false);

      $('#errorMsg').text('Invalid Zendesk domain/url or credetials').clearQueue().fadeOut(150).fadeIn(300);
      $('#save-options-btn').removeAttr('disabled');

      var error_fields = new Array();
      error_fields.push($('#zendeskUrl'), $('#zendeskUser'), $('#zendeskPassword'));
      showErrorFields(error_fields);
    }
  };
};

function handleHighriseLogin () {
  var pref = OnSIP_Preferences;
  hideAllMessages();
  return {
    onSuccess : function() {
      /** Set Highrise Enabled **/
      SETTINGS_PG_LOG && console.log('SETTINGS PG :: Highrise account was verified successfully');
      pref.set('highriseEnabled', true);
      $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
      $('#save-options-btn').removeAttr('disabled');
      _gaq.push(['_trackEvent', 'options', 'highriseLoginSuccess','Highrise Login Success']);
    },
    onError : function() {
      SETTINGS_PG_LOG && console.log('SETTINGS PG :: Highrise account login error');
      pref.set('highriseEnabled', false);

      $('#errorMsg').text('Invalid Highrise domain/url or token provided').clearQueue().fadeOut(150).fadeIn(300);
      $('#save-options-btn').removeAttr('disabled');

      var error_fields = new Array();
      error_fields.push( $('#highriseUrl'), $('#highriseToken') );
      showErrorFields(error_fields);
      _gaq.push(['_trackEvent', 'options', 'highriseLoginFailed','Highrise Login Failed']);
    }
  };
};

/** Validate Highrise Credentials **/
function validateHighriseCredentials (callback){
  var pref = OnSIP_Preferences,
    url = pref.get('highriseUrl'),
    token = pref.get('highriseToken');

  SETTINGS_PG_LOG && console.log('SETTINGS PG :: Sending verifyHighrise request to BG-PAGE');

  chrome.extension.sendMessage({verifyHighrise:true, highrise_url:url, highrise_token:token},
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

/** Validate Zendesk Credentials **/
function validateZendeskCredentials (callback) {
  var pref = OnSIP_Preferences,
    url = pref.get ('zendeskUrl'),
    usr = pref.get ('zendeskUsr'),
    pwd  = pref.get ('zendeskPwd');

  SETTINGS_PG_LOG && console.log ('SETTINGS PG :: Sending verifyZendesk request to BG-PAGE');

  chrome.extension.sendMessage({ verifyZendesk : true, zendesk_url : url, zendesk_usr : usr, zendesk_pwd : pwd},
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

/** Check if Zendesk options were entered **/
function isZendeskDataEntered (){
  var pref = OnSIP_Preferences,
    zd_url = $('#zendeskUrl').val(),
    zd_user = $('#zendeskUser').val(),
    zd_pwd = $('#zendeskPassword').val(),
    error_fields = new Array();

  zd_url = trim(zd_url);
  zd_user = trim(zd_user);
  zd_pwd = trim(zd_pwd);

  SETTINGS_PG_LOG && console.log ('SETTINGS PG :: From input field, Zendesk URL -> ' + zd_url);
  if(zd_url.length > 0 && zd_url != pref.defaults['zendeskUrl']) {
    if (zd_user.length == 0 || zd_user == pref.defaults['zendeskUsr']) {
      SETTINGS_PG_LOG && console.log("SETTINGS PG :: Zendesk user is invalid");
      error_fields.push($('#zendeskUser'));
    } else {
      error_fields = false;
    }
  } else if (zd_user.length > 0 && zd_user != pref.defaults['zendeskUsr']){
    SETTINGS_PG_LOG && console.log("SETTINGS PG :: Zendesk URL is invalid");
    error_fields.push($('#zendeskUrl'));
  } else {
    error_fields = true;
  }

  if ((error_fields instanceof Array) && error_fields.length > 0) {
    pref.set('zendeskUrl', pref.defaults['zendeskUrl']);
    pref.set('zendeskUsr', pref.defaults['zendeskUsr']);
    pref.set('zendeskPwd', pref.defaults['zendeskPwd']);
    return error_fields;
  } else if (error_fields) {
    return false;
  } else {
    zd_url = formatUrl (zd_url, true);
    pref.set('zendeskUrl', zd_url);
    pref.set('zendeskUsr', zd_user);
    pref.set('zendeskPwd', zd_pwd);
    return !error_fields;
  }
}

/** Check if Highrise options were entered **/
function isHighriseDataEntered(){
  var pref = OnSIP_Preferences,
    hr_url = $('#highriseUrl').val(),
    token = $('#highriseToken').val(),
    tz = $('#timezone').val(),
    error_fields = new Array();

  hr_url = trim(hr_url);
  token = trim(token);

  if(hr_url.length > 0 && hr_url.indexOf(pref.defaults['highriseUrl']) == -1) {
    if (token.length ==  0 || token == pref.defaults['highriseToken']) {
      error_fields.push( $('#highriseToken'));
    } else {
      error_fields = false;
    }
  } else if (token.length > 0 && token != pref.defaults['highriseToken']) {
    error_fields.push( $('#highriseUrl'));
  }

  if ((error_fields instanceof Array) && error_fields.length > 0) {
    SETTINGS_PG_LOG && console.log ('SETTINGS PG :: Highrise values are invalid');
    pref.set('highriseUrl'  , pref.defaults['highriseUrl'  ]);
    pref.set('highriseToken', pref.defaults['highriseToken']);
    pref.set('userTimezone' , pref.defaults['userTimezone' ]);
    return error_fields;
  } else {
    SETTINGS_PG_LOG && console.log ('SETTINGS PG :: Checking Highrise values');
    hr_url = formatUrl (hr_url, false);
    pref.set('highriseUrl'  , hr_url);
    pref.set('highriseToken', token);
    pref.set('userTimezone' , tz);
    return !error_fields;
  }
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
  var pref = OnSIP_Preferences;

  /** Open external links in new window **/
  $('A[href^="http"]').attr('target', '_blank');

  /** Initial value for OnSIP options **/
  $('#fromAddress').val(pref.get('fromAddress') );
  $('#onsipPassword').val(pref.get('onsipPassword') );

  /** TODO: Check which of the two plug-ins are enabled **/
  setZendeskSettings(pref);

  /** TODO: Check which of the two plug-ins are enabled **/
  setHighriseSettings(pref);
}

/** Set Highrise defaults **/
function setHighriseSettings(pref){
  /** Initial value for a highrise **/
  $('#highriseUrl')  .val (pref.get('highriseUrl')  );
  $('#highriseToken').val (pref.get('highriseToken'));

  var timezoneSetting = pref.get('userTimezone');
  if (timezoneSetting) {
    $('#timezone').val (timezoneSetting);
  }

  if (pref.get('showToUri')) {
    $('#chk-show-advanced').attr('checked','checked');
  } else {
    $('#chk-show-advanced').removeAttr('checked');
  }

}

/** Set Zendesk defaults **/
function setZendeskSettings(pref){
  /** Initial value for zendesk **/
  $('#zendeskUrl')     .val (pref.get('zendeskUrl'));
  $('#zendeskUser')    .val (pref.get('zendeskUsr'));
  $('#zendeskPassword').val (pref.get('zendeskPwd'));
}

function SetHelperBehavior(formID){
  var pref = OnSIP_Preferences;
  /** Behaivior for a Text fields **/
  $(formID).children('fieldset').children('input[type="text"]').each(
    function(){
      $(this).focus(
        function(){
          if( $(this).val() == pref.defaults[$(this).attr('name')]){
            $(this).val('');
          }
        });
    });

  /** Behavior for password fields **/
  $(formID).children('fieldset').children('input[type="password"]').each(
    function(){
      $(this).focus(
        function(){
          if( $(this).val() == pref.defaults[$(this).attr('name')]){
            $(this).val('');
          }
        });
    });

  $('#clear-highrise').click (
    function (e) {
      $('#highriseUrl').val(pref.defaults['highriseUrl']);
      $('#highriseToken').val(pref.defaults['highriseToken']);
      $('#timezone').val("0.0");
    });

  $('#chk-show-advanced').change(
    function(e) {
      pref.set('showToUri', $(this).is(':checked'));
    }
  );

  $('#advanced-title').click(
    function(e) {
      $('#advanced-toggle').toggle();
    }
  );
}

/** Set up Tooltips **/
function setToolTips(){
  $('.tool-tip-trigger').tooltip({position: "top left"});
}