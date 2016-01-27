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
  setDefaultSettings();
  setToolTips();

  SetHelperBehavior('#options');

  $('#options').bind('submit', onSubmit);
});

function onSubmit(e) {
  var errorFields, pref = OnSIP_Preferences;

  _startTimeLoginProc = new Date().getTime();

  /**
   * Tracking
   */
  _gaq.push(['_trackEvent', 'options',
    'saveBtnClicked','Click to Save Settings', 1]);

  $('#save-options-btn').attr('disabled','disabled');

  e && e.preventDefault();

  chrome.extension.sendMessage({clearCache:true});
  chrome.extension.sendMessage({checkConnection:true, run:false});

  pref.set('onsipCredentialsGood', false);

  if ($('#input-zendesk').is(":visible")) {
    pref.set('zendeskEnabled', false);
  }
  else if ($('#input-highrise').is(":visible")) {
    pref.set('highriseEnabled', false);
  }

  /**
   * Error flags
   */
  errorFields = isOnSIPDataEntered();

  clearAlerts();

  /**
   * Proceed if no field errors
   */
  if (errorFields.length === 0) {
    /**
     * Show a validating message
     */
    $('#validatingMsg').show();

    /**
     * Get onsip user and save it in the local storage
     */
    getOnsipUser(handleOnSIPLogin());

    chrome.extension.sendMessage({checkConnection:true, run:true});
  } else {
    $('#save-options-btn').removeAttr('disabled');
    $('#errorMsg').
      text('Please fill in all fields for the OnSIP user ' +
        'and optionally 3rd party integrations.').
          clearQueue().fadeOut(150).fadeIn(300);
    showErrorFields(errorFields);
  }
}

function isOnSIPDataEntered() {
  var pref = OnSIP_Preferences,
    errorFields = [];

  /**
   * If OnSIP fields are not entered we catch the error.
   * The errors will highlight the border fields in red
   */
  if($('#fromAddress').val().length === 0 ||
    $('#fromAddress').val() == pref.defaults['fromAddress']) {
    errorFields.push($('#fromAddress'));
  }

  if($('#onsipPassword').val().length === 0) {
    errorFields.push($('#onsipPassword'));
  }
  return errorFields;
};

function getOnsipUser (callback) {
  var pref = OnSIP_Preferences, ts,
    username = $('#fromAddress').val(),
    password = $('#onsipPassword').val();

  chrome.extension.sendMessage({verifyOnSipUser:true,
    username:username, password:password},
    function (response) {
      if (callback) {
        ts = Math.round(((new Date().getTime() - _startTimeLoginProc) / 1000));
        if (isNaN(ts)) ts = 0;
        if (response.ok) {
          _gaq.push(['_trackEvent', 'options',
            'onSipLoginSuccess','OnSIP Login Success', ts]);
          callback.onSuccess();
        } else {
          _gaq.push(['_trackEvent', 'options', 'onSipLoginFailed',
           'OnSIP Login Failed', ts]);
          callback.onError();
        }
      }
    }
  );
}

function handleOnSIPLogin() {
  var pref = OnSIP_Preferences;

  /**
   * Save SIP credentials
   */
  pref.set('fromAddress', $('#fromAddress').val());
  pref.set('onsipServer', getDomain($('#fromAddress').val()));
  pref.set('onsipPassword', $('#onsipPassword').val());

  return {
    onSuccess: function() {
      SETTINGS_PG_LOG &&
        console.log('SETTINGS PG :: ' +
          'OnSIP connection succeeded, we store in local storage');
      pref.set('onsipCredentialsGood', true);
      hideAllMessages();
      if ($('#zendeskUrl') && $('#zendeskUrl').length &&
          $('#input-zendesk').is(":visible")) {
        SETTINGS_PG_LOG && console.log('SETTINGS PG :: Fork Zendesk');
        forkZendesk();
      } else if ($('#highriseUrl') && $('#highriseUrl').length &&
                 $('#input-highrise').is(":visible")) {
        SETTINGS_PG_LOG && console.log('SETTINGS PG :: Fork Highrise');
        forkHighrise();
      } else {
        $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
        $('#save-options-btn').removeAttr('disabled');
      }
    },
    onError: function() {
      var errorFields, err;

      SETTINGS_PG_LOG &&
        console.log('SETTINGS PG :: OnSIP account valid error');
      pref.set('onsipCredentialsGood', false);
      hideAllMessages();

      err = "Bad login!<br>" +
        "Get your password at " +
        "<a href='https://insta.onsip.com' target='_blank'> " +
        "https://insta.onsip.com </a>";

      $('#errorMsg').html(err).clearQueue().fadeOut(150).fadeIn(300);
      $('#save-options-btn').removeAttr('disabled');

      errorFields = [];
      errorFields.push($('#fromAddress'), $('#onsipPassword'));
      showErrorFields(errorFields);
    }
  };
};

function forkZendesk() {
  isZendeskDataEntered({
    success: function(isValid) {
      if (isValid) {
        SETTINGS_PG_LOG &&
          console.log('SETTINGS PG :: Zendesk credentials entered');
        validateZendeskCredentials(handleZendeskLogin());
      }
    },
    error: function(errors) {
      $('#errorMsg').text('Invalid Zendesk domain/url or username provided').
        clearQueue().fadeOut(150).fadeIn(300);
      $('#save-options-btn').removeAttr('disabled');
    }
  });
}

function forkHighrise() {
  isHighriseDataEntered({
    success: function(isValid) {
      /**
       * Validate provided Highrise Credentials
       */
      if (isValid) {
        SETTINGS_PG_LOG &&
          console.log('SETTINGS PG :: Highrise credentials entered');
        validateHighriseCredentials(handleHighriseLogin());
      }
    },
    error: function(errors) {
      $('#errorMsg').text('Invalid Highrise domain/url or token provided').
        clearQueue().fadeOut(150).fadeIn(300);
      $('#save-options-btn').removeAttr('disabled');
    }
  });
}

function handleZendeskLogin() {
  var preferences  = OnSIP_Preferences;
  hideAllMessages();
  return {
    onSuccess: function() {
      /**
       *  Enable Zendesk
       */
      SETTINGS_PG_LOG &&
        console.log('SETTINGS PG :: Zendesk account was verified successfully');
      preferences.set('zendeskEnabled', true);

      $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
      $('#save-options-btn').removeAttr('disabled');
    },
    onError: function() {
      var errorFields;
      SETTINGS_PG_LOG && console.log('SETTINGS PG :: Zendesk account error');
      preferences.set('zendeskEnabled', false);

      $('#errorMsg').text('Invalid Zendesk domain/url or credetials').
        clearQueue().fadeOut(150).fadeIn(300);
      $('#save-options-btn').removeAttr('disabled');

      errorFields = [];
      errorFields.push($('#zendeskUrl'),
        $('#zendeskUsr'), $('#zendeskPwd'));
      showErrorFields(errorFields);
    }
  };
};

function handleHighriseLogin() {
  var pref = OnSIP_Preferences;

  hideAllMessages();
  return {
    onSuccess: function() {
      /**
       * Enable Highrise
       */
      SETTINGS_PG_LOG &&
        console.log('SETTINGS PG :: Highrise account was verified successfully');
      pref.set('highriseEnabled', true);
      $('#savedMsg').clearQueue().fadeOut(150).fadeIn(300);
      $('#save-options-btn').removeAttr('disabled');
      _gaq.push(['_trackEvent', 'options',
        'highriseLoginSuccess','Highrise Login Success']);
    },
    onError: function() {
      var errorFields = [];
      SETTINGS_PG_LOG &&
        console.log('SETTINGS PG :: Highrise account login error');
      pref.set('highriseEnabled', false);

      $('#errorMsg').text('Invalid Highrise domain/url or token provided').
        clearQueue().fadeOut(150).fadeIn(300);
      $('#save-options-btn').removeAttr('disabled');

      errorFields.push($('#highriseUrl'), $('#highriseToken'));
      showErrorFields(errorFields);
      _gaq.push(['_trackEvent', 'options', 'highriseLoginFailed','Highrise Login Failed']);
    }
  };
};

/**
 * Validate Highrise Credentials
 */
function validateHighriseCredentials (callback){
  var pref = OnSIP_Preferences,
    url = pref.get('highriseUrl'),
    token = pref.get('highriseToken');

  SETTINGS_PG_LOG &&
    console.log('SETTINGS PG :: Sending verifyHighrise request to BG-PAGE');

  chrome.extension.sendMessage({verifyHighrise:true, highrise_url:url,
    highrise_token:token},
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

/**
 * Validate Zendesk Credentials
 */
function validateZendeskCredentials (callback) {
  var pref = OnSIP_Preferences,
    url = pref.get('zendeskUrl'),
    usr = pref.get('zendeskUsr'),
    pwd  = pref.get('zendeskPwd');

  SETTINGS_PG_LOG &&
    console.log ('SETTINGS PG :: Sending verifyZendesk request to BG-PAGE');

  chrome.extension.sendMessage({ verifyZendesk : true, zendesk_url : url,
    zendesk_usr : usr, zendesk_pwd : pwd},
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

/**
 * Check if Zendesk options were entered
 */
function isZendeskDataEntered(options) {
  var pref = OnSIP_Preferences, errorFields = [],
    zd_url = $('#zendeskUrl').val(),
    zd_user = $('#zendeskUsr').val(),
    zd_pwd = $('#zendeskPwd').val(),
    isDefaultUrl, isDefaultUsr, isEntryValid;

  zd_url = trim(zd_url);
  zd_user = trim(zd_user);
  zd_pwd = trim(zd_pwd);

  isDefaultUrl = zd_url.indexOf(pref.defaults['zendeskUrl']) > -1;
  isDefaultUsr = zd_user !== pref.defaults['zendeskUsr'];

  SETTINGS_PG_LOG &&
    console.log ('SETTINGS PG :: From input field, Zendesk URL -> ' + zd_url);
  if(zd_url.length > 0 && !isDefaultUrl) {
    if (zd_user.length == 0 || !isDefaultUsr) {
      SETTINGS_PG_LOG && console.log("SETTINGS PG :: Zendesk user is invalid");
      errorFields.push($('#zendeskUsr'));
    }
  } else if (zd_user.length > 0 && !isDefaultUsr){
    SETTINGS_PG_LOG && console.log("SETTINGS PG :: Zendesk URL is invalid");
    errorFields.push($('#zendeskUrl'));
  }

  if ((errorFields instanceof Array) && errorFields.length > 0) {
    pref.set('zendeskUrl', pref.defaults['zendeskUrl']);
    pref.set('zendeskUsr', pref.defaults['zendeskUsr']);
    pref.set('zendeskPwd', pref.defaults['zendeskPwd']);
    options.error(errorFields);
  } else {
    zd_url = formatUrl(zd_url, false);
    pref.set('zendeskUrl', zd_url);
    pref.set('zendeskUsr', zd_user);
    pref.set('zendeskPwd', zd_pwd);
    isDefaultUrl = zd_url.length > 0 && isDefaultUrl;
    isDefaultUsr = zd_user.length > 0 && isDefaultUsr;
    isEntryValid = !(isDefaultUrl && isDefaultUsr);
    options.success(isEntryValid);
  }
}

/**
 * Check if Highrise options were entered
 */
function isHighriseDataEntered(options){
  var pref = OnSIP_Preferences, errorFields = [],
    hr_url = $('#highriseUrl').val(),
    token = $('#highriseToken').val(),
    tz = $('#timezone').val(), isDefaultUrl,
    isDefaultToken, isEntryValid;

  hr_url = trim(hr_url);
  token = trim(token);

  isDefaultUrl = (hr_url.indexOf(pref.defaults['highriseUrl']) > -1);
  isDefaultToken = token === pref.defaults['highriseToken'];

  if(hr_url.length > 0 && !isDefaultUrl) {
    if (token.length === 0 || token === pref.defaults['highriseToken']) {
      errorFields.push($('#highriseToken'));
    }
  } else if (token.length > 0 && !isDefaultToken) {
    errorFields.push($('#highriseUrl'));
  }

  if ((errorFields instanceof Array) && errorFields.length > 0) {
    SETTINGS_PG_LOG &&
      console.log('SETTINGS PG :: Highrise values are invalid');
    pref.set('highriseUrl', pref.defaults['highriseUrl']);
    pref.set('highriseToken', pref.defaults['highriseToken']);
    pref.set('userTimezone', pref.defaults['userTimezone']);
    options.error();
  } else {
    SETTINGS_PG_LOG && console.log('SETTINGS PG :: Checking Highrise values');
    hr_url = formatUrl(hr_url, false);
    pref.set('highriseUrl', hr_url);
    pref.set('highriseToken', token);
    pref.set('userTimezone', tz);
    isDefaultUrl = hr_url.length > 0 && isDefaultUrl;
    isDefaultToken = token.length > 0 && isDefaultToken;
    isEntryValid = !(isDefaultUrl && isDefaultToken);
    options.success(isEntryValid);
  }
}

function clearAlerts () {
  hideAllMessages();
  removeErrors();
  $('#errorMsg').text('');
};

/**
 * Hide all messages
 */
function hideAllMessages(){
  $('#savedMsg').hide();
  $('#errorMsg').hide();
  $('#validatingMsg').hide();
}

/**
 * Make fields border red, indicating that those need to be correctly filled
 */
function showErrorFields(a){
  if(!(a instanceof Array)){
    a.css('border', '2px solid #cc0000');
    return;
  }
  for(var i = 0, len = a.length; i < len; i += 1){
    a[i].css('border', '2px solid #cc0000');
  }
}

/**
 * Remove errors from the form
 */
function removeErrors(){
  $('#options input[type="text"]').css('border', '2px solid #004A8F');
  $('#options input[type="password"]').css('border', '2px solid #004A8F');
}

function setDefaultSettings(){
  var pref = OnSIP_Preferences;

  /**
   * Open external links in new window
   */
  $('A[href^="http"]').attr('target', '_blank');

  /**
   * Initial value for OnSIP options
   */
  $('#fromAddress').val(pref.get('fromAddress'));
  $('#onsipPassword').val(pref.get('onsipPassword'));

  setZendeskSettings(pref);
  setHighriseSettings(pref);
}

/**
 * Set Highrise defaults
 */
function setHighriseSettings(pref){
  var timezoneSetting;
  $('#highriseUrl').val(pref.get('highriseUrl'));
  $('#highriseToken').val(pref.get('highriseToken'));

  timezoneSetting = pref.get('userTimezone');
  if (timezoneSetting) {
    $('#timezone').val(timezoneSetting);
  }

  $('#chk-row-zd-focus').hide();
  if (pref.get('showToUri')) {
    $('#chk-advanced-to-uri').attr('checked','checked');
  } else {
    $('#chk-advanced-to-uri').removeAttr('checked');
  }

  if (pref.get('showFromUri')) {
    $('#chk-advanced-from-uri').attr('checked','checked');
  } else {
    $('#chk-advanced-from-uri').removeAttr('checked');
  }
}


/**
 * Set Zendesk defaults
 */
function setZendeskSettings(pref){
  $('#zendeskUrl').val(pref.get('zendeskUrl'));
  $('#zendeskUsr').val(pref.get('zendeskUsr'));
  $('#zendeskPwd').val(pref.get('zendeskPwd'));

  $('#chk-row-zd-focus').show();
  if (pref.get('focusZdTab')) {
    $('#chk-advanced-focus-lotus').attr('checked','checked');
  } else {
    $('#chk-advanced-focus-lotus').removeAttr('checked');
  }
}

function SetHelperBehavior(formID){
  var img, pref = OnSIP_Preferences;
  /**
   * Behavior for a text input fields
   */
  $(formID).children('fieldset').children('input[type="text"]').each(
    function(){
      $(this).focus(
        function(){
          var v = trim($(this).val()).replace(/(http[s]?:\/\/)+/, '');
          if(v == pref.defaults[$(this).attr('name')]){
            $(this).val('');
          }
        }
      );
      $(this).blur(
        function(){
          if(trim($(this).val()).length === 0){
            $(this).val(pref.defaults[$(this).attr('name')]);
          }
        }
      );
    }
  );

  /**
   * Behaviour for password fields
   */
  $(formID).children('fieldset').children('input[type="password"]').each(
    function(){
      $(this).focus(
        function(){
          if( $(this).val() == pref.defaults[$(this).attr('name')]){
            $(this).val('');
          }
        });
      }
  );

  $('#clear-highrise').click(
    function(e) {
      $('#highriseUrl').val(pref.defaults['highriseUrl']);
      $('#highriseToken').val(pref.defaults['highriseToken']);
      $('#timezone').val("0.0");
    }
  );

  $('#clear-zendesk').click(
    function(e) {
      $('#zendeskUrl').val(pref.defaults['zendeskUrl']);
      $('#zendeskUsr').val(pref.defaults['zendeskUsr']);
      $('#zendeskPwd').val(pref.defaults['zendeskPwd']);
    }
  );

  $('#chk-advanced-to-uri').change(
    function(e) {
      pref.set('showToUri', $(this).is(':checked'));
    }
  );

  $('#chk-advanced-from-uri').change(
    function(e) {
      pref.set('showFromUri', $(this).is(':checked'));
    }
  );

  $('#chk-advanced-focus-lotus').change(
    function(e) {
      pref.set('focusZdTab', $(this).is(':checked'));
    }
  );

  $('#advanced-title').click(
    function(e) {
      $('#advanced-toggle').toggle();
    }
  );

  img = "<img src='../../images/down-arrow.png' border='0'>";

  if (pref.get("highriseEnabled")) {
    $('#select-application').html("Highrise Integration " + img);
    $('#select-highrise').parent().hide();
    $('#select-zendesk').parent().show();
    $('#input-highrise').show();
    $('#chk-row-zd-focus').hide();
  } else if(pref.get("zendeskEnabled")) {
    $('#select-application').html("Zendesk Integration " + img);
    $('#select-zendesk').parent().hide();
    $('#select-highrise').addClass("bottom-borders");
    $('#select-highrise').parent().show();
    $('#input-zendesk').show();
    $('#chk-row-zd-focus').show();
  } else {
    $('#select-application').html("Application Integrations " + img);
    $('#input-highrise').hide();
    $('#input-zendesk').hide();
    $('#chk-row-zd-focus').hide();
  }

  $('#select-highrise').click(
    function(e) {
      $('#select-application').html("Highrise Integration " + img);
      $('#chk-row-zd-focus').hide();
      $('#select-highrise').parent().hide();
      $('#select-zendesk').parent().show();
      $('#input-zendesk').hide();
      $('#input-highrise').show();
    }
  );

  $('#select-zendesk').click(
    function(e) {
      $('#select-application').html("Zendesk Integration " + img);
      $('#chk-row-zd-focus').show();
      $('#select-zendesk').parent().hide();
      $('#select-highrise').addClass("bottom-borders");
      $('#select-highrise').parent().show();
      $('#input-highrise').hide();
      $('#input-zendesk').show();
    }
  );

  $('#cssmenu li.hover').mouseover(
    function(e) {
      $('#cssmenu li.hover ul').css('display','block');
    }
  );

  $('#cssmenu li.hover').mouseout(
    function(e) {
      $('#cssmenu li.hover ul').css('display','none');
    }
  );

  $('#cssmenu li.hover ul li a').click(
    function(e) {
      $('#cssmenu li.hover ul').css('display','none');
    }
  );
}

/**
 * Set up Tooltips
 */
function setToolTips(){
  $('.tool-tip-trigger').tooltip({position: "top left"});
}
