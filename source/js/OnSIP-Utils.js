var dbg = {
    log : function(mixed){
        console.log(mixed);
    }
};

// Turn off debugging when on production
//dbg.log = function(){};


/** Is provided element in array **/
function isInArray(stack, needle){
    for(elem in stack){
        if(stack[elem] == needle){
            return true;
        }
    }
    return false;
}

/** Clear request number **/
function clearRequestedNumber(){
    pref.set('requestedNumber', false);
}

function isNumberFormatted(str){
    return str.match(/@/);
}

/**
 * IsFromSipAddress
 * @return bool
 */
function isFromSipAddress (str){
    if( str.match( /onsip.com/g ) != null){
        return true;
    }
    return false;
}

/** Set Request details **/
function setRequestedDetails (item) {    
    var pref = OnSIP_Preferences;
    pref.set('requestedNumber', extractPhoneNumber(item.fromURI));
}

function isCreatedDetailsMatchRequested (item) {
    var pref         = OnSIP_Preferences;
    var numberToCall = extractPhoneNumber (item.toURI);

    if (numberToCall == pref.get('requestedNumber')) {
        return true;
    } else {
        return false;
    }
}

function getPhoneExtension (phoneNumber) {
    var extension = phoneNumber.match( /(ext|x|ex)\s{0,3}.{0,3}\d{2,5}/g );
    if (extension) {
        return extension[0] ;
    }
}

/**  
 *  Get domain from address
 *  /(ext|x|ex)\s{0,3}.{0,3}\d{2,5}/
 **/
function getDomain (address) {
    return address.substring(address.indexOf('@') + 1);
}

/** Clean phone number **/
function cleanPhoneNo (str) {
    return str.replace(/[^\d]/g, '');
}

function escapeRegExp (str) {
    var specials = new RegExp("[.*+?|()\\[\\]{}\\\\]", "g"); // .*+?|()[]{} \
    return str.replace(specials, "\\$&");
}

Array.prototype.unique = function () {
    var r = new Array();
    o:for(var i = 0, n = this.length; i < n; i++) {
	for(var x = 0, y = r.length; x < y; x++) {
	    if(r[x]==this[i]) {
		continue o;
	    }
	}		
	r[r.length] = this[i];
    }	
    return r;
}

/** Format Url **/
function formatUrl (str){
    var res = str.replace(/(http[s]?:\/\/)+/, '');
    return 'https://' + res;
}

function isArray (obj) {
    return (typeof(obj.length)=="undefined")?false:true;
}

function removeExtention (str){
    return str.replace( /(ext|x|ex)\s{0,3}.{0,3}\d{2,5}/g, '');
}

/** Get formatted current browser time and date **/
function getDateAndTime (timezone){
    if (!timezone) {
        timezone = '';
    }
    var m_names = new Array("January", "February", "March",
			    "April"  , "May"     , "June" , 
			    "July"   , "August"  , "September",
			    "October", "November", "December");
    var d         = new Date();
    var a_p       = '';
    var curr_hour = d.getHours();
    var curr_min  = d.getMinutes();

    if (curr_hour < 12) {
       a_p = "AM";
    } else {
       a_p = "PM";
    }

    if (curr_hour == 0){
        curr_hour = 12;
    }

    if (curr_hour > 12){
        curr_hour = curr_hour - 12;
    }

    curr_min = curr_min + "";

    if (curr_min.length == 1){
        curr_min = "0" + curr_min;
    }
    
    return curr_hour  + ':'   + curr_min + ' ' + 
	a_p + ' ' + timezone  + ' on '   + 
	m_names[d.getMonth()] + ' '      + 
	d.getDate(); + ', '   + d.getFullYear();
}

/** Get TimeZone Abbrevation **/
function getTimezoneAbbrevation (time) {
    var timezones = {'-12.0' : 'MST','-11.0' : 'MST','-10.0' : 'HAST','-9.0' : 'AKST',
		     '-8.0'  : 'PST','-7.0'  : 'PDT','-6.0'  : 'CST','-5.0'  : 'EST',
		     '-4.0'  : 'AST','-3.5'  : 'NST','-3.0'  : 'ADT','-2.5'  : 'NDT',
		     '-2.0'  : 'EST','-1.0'  : 'EST','1.0'   : 'CET','2.0'   : 'CEST',
		     '3.0'   : 'EEDT','3.5'  : 'HNT','4.0'   : 'EDT','4.5'   : 'EST', 
		     '5.0'   : 'EST', '5.5'  : 'EST','5.75'  : 'EST','6.0'   : 'CST',
		     '7.0'   : 'MST','8.0'   : 'EST','9.0'   : 'I'  ,'9.5'   : 'EST',
		     '10.0'  : 'AEST', '11.0': 'AEDT','12.0' : ''
    }
    return timezones[time];
}

/** Trim the input string **/
function trim(str, chars) {
    return ltrim(rtrim(str, chars), chars);
}

/** Remove spaces from left of the input **/
function ltrim(str, chars) {
    chars = chars || "\\s";
    return str.replace(new RegExp("^[" + chars + "]+", "g"), "");
}

/** Remove spaces from the Right of the string **/
function rtrim(str, chars) {
    chars = chars || "\\s";
    return str.replace(new RegExp("[" + chars + "]+$", "g"), "");
}

/** Extract phone number **/
function extractPhoneNumber(str){
    str = str.replace(/sip:/, '');

    str = str.replace(/@[a-z0-9._]+/, '');
    str = str.replace( /;\s*[a-z0-9._=]+/ ,'');
    return str;
}