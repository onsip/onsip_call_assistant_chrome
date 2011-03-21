/** SIP Chrome Content Page **/

var CONTENT_PG = "CONTENT-PG";
var to_domain  = null;
var _enabled   = false;

/** These selector paths will be used to trigger a background refresh of all the Highrise **/
/** customer data that is cached locally in the plug-in.  These Highrise paths are linked to **/
/** to form fields that trigger this update **/
var HQ_SELECTOR_PATH_ADD_NEW = '#page_main_column .edit .submit input[name$="commit"]';
var HQ_SELECTOR_PATH_UPDATE  = '#page_main_column #contact_and_permissions_tab .submit input[name$="commit"]';
var HQ_SELECTOR_PATH_DELETE  = '#screen_body .col .innercol .submit input[type$="submit"]';

/** Add listener for commands from the background process **/
chrome.extension.onRequest.addListener( function (request, sender, sendResponse) {
    dbg.log (CONTENT_PG, 'Coming From Background Page :: parseDOM  ' + request.parseDOM);
    alterDOM       (request);
    updateAddresses(request);
});

/** Alter DOM on page load **/
chrome.extension.sendRequest({ pageLoad : true }, function (response) {
   dbg.log (CONTENT_PG, 'SendRequest');
   alterDOM       (response);
   updateAddresses(response);
});

/** add listener for DOM changes, to parse the new nodes for phone numbers **/
/** document.addEventListener('DOMSubtreeModified', handleDomChange, true); **/

/** stupid WebKit won't trigger DOMNodeInserted on innerHTML with plain text and no HTML tags **/
document.addEventListener('DOMCharacterDataModified', handleDomChange, true);
document.addEventListener('DOMNodeInserted'         , handleDomChange, true);

/** prevent it from going into an infinite loop **/
var parsing = false;

function handleDomChange(e) {
    var ext_enabled = _enabled;
    if (ext_enabled) {
        if (parsing) {
	    return;
	}
	dbg.log (CONTENT_PG, 'Handle DOM Change - parsing ' + parsing + ' Extension enabled :: ' + ext_enabled);
	var newNodeClass = e.srcElement.className;
	if ( newNodeClass != undefined ) {
	    if (/onsip\-message\-box/.test(newNodeClass) || newNodeClass == 'onsip-click-to-call-icon') {
		return;
	    }
	}
	var targetNode = (e.relatedNode) ? e.relatedNode : e.target;
	parsing = true;
	setTimeout(function() {
	    parseDOM(targetNode);
	    parsing = false;
	}, 10);
    }
}

/** Alter the DOM **/
function alterDOM(request) {
    /** Parse DOM command **/
    dbg.log (CONTENT_PG, 'AlterDOM');
    if ( request.parseDOM ) {
	_enabled = true;
	/** These events triggered through the Highrise application would send a request **/
	/** to the background page to have the customer cache store refresh to reflect to changes made in Highrise **/
	dbg.log(CONTENT_PG, 'In alterDOM, will add Highrise triggers');
	addHighriseEvents();
	/** TODO **/
	/** Will likely need to build similar functionality for Zendesk **/

	parseDOM(document.body);
    } else if ( request.clearDOM ) {
	/** Clear DOM command **/
        _enabled = false;
	clearDOM();
	/** We don't bother to clear Highrise events **/
	/** Not at this point at least with the currently supported features **/
	/** Because even with a triggered event, the background page will not **/
	/** process the event if the plug-in is disabled **/
    }
}

function updateAddresses(request) {
    if (request.fromAddress) {
        var from_address = request.fromAddress;
	var to_domain    = getDomain (from_address);
	/** update toAddress in link href **/
	$('.onsip-click-to-call').each(function(){
            var href = this.href;
	    href = href.substr(0, href.indexOf('@') + 1);
	    href += to_domain;
	    this.href = href;
	});
    }
}

/** Remove click-to-call links and messages **/
function clearDOM () {
    dbg.log (CONTENT_PG, 'clearDOM');
    $('.onsip-message-box').remove();
    $('.onsip-click-to-call').each(function(){
        $(this).replaceWith(this.innerHTML);
    });
}

/** Parse DOM and convert phone numbers to click-to-call links **/
function parseDOM (node) {
    var invalidNodes     = ['SCRIPT', 'STYLE', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'CODE'];
    var nodeName         = node.nodeName.toUpperCase();
    var childNodesLength = node.childNodes.length;

    if ( $.inArray(nodeName, invalidNodes) > -1 || $(node).hasClass('onsip-message-box') ) {
	return 0;
    }

    for (var n = 0; n < childNodesLength; n++) {
	var found = parseDOM(node.childNodes[n]);
	if ( found > 0 ) {
	    parseDOM (node);
	    return 0;
	}
    }

    if (node.nodeType == Node.TEXT_NODE) {
	return parsePhoneNumbers(node);
    } else {
	addEvents(node);
    }
    return 0;
}

/** Replace phone numbers **/
function parsePhoneNumbers (node) {
    var isStringNumber = false;

    /** SIP address **/
    var sipAddressNumber = /sip:[a-zA-Z0-9_]+@[a-zA-Z0-9_.]+\.[a-z]{1,4}/;

    /** Eliminate the obvious cases **/
    if (!node || node.nodeValue.length < 10 ||
	node.nodeValue.search(/\d/) == -1 &&
	node.nodeValue.match(sipAddressNumber) == null) {
        return 0;
    }

    var phoneNumber                          = /((((\+|(00))[1-9]\d{0,3}[\s\-.]?)?\d{2,4}[\s\/\-.]?)|21)\d{5,9}/;
    /** Modified phoneNumberNorthAmerica reg expression to allow for no spaces phone num support (i.e. 17328829922) **/
    //var phoneNumberNorthAmerica              = /\+?(1[\s-.])?((\(\d{3}\))|(\d{3}))[\s.\-]\d{3}[\s.\-]\d{4}/;
    var phoneNumberNorthAmerica              = /\+?(1[\s-.]?)?((\(\d{3}\))|(\d{3}))[\s.\-]?\d{3}[\s.\-]?\d{4}/;

    /** Phone number with an extension **/
    var phoneNumberNorthAmericaWithExtension = /\+?(1[\s-.])?((\(\d{3}\))|(\d{3}))[\s.\-]\d{3}[\s.\-]\d{4}\s{1,5}(ext|x|ex)\s{0,3}.{0,3}\d{2,5}/;
    var phoneNumberExtension                 = /(ext|x|ex)\s{0,3}.{0,3}\d{2,5}/g;
    var phoneNumberDelimiter                 = /[\s.,;:|]/;
    var text                                 = node.nodeValue;
    var offset                               = 0;
    var number                               = "";

    /** Extension **/
    var extension                            = null;
    var found                                = false;
    var foundNorthAmerica                    = false;

    /** Find the first phone number in the text node **/
    while (!found) {
        var result = text.match(phoneNumberNorthAmerica);

        /** Handling extension **/
        var resultWithExtension = text.match(phoneNumberNorthAmericaWithExtension);
        if (resultWithExtension) {
            extension  = text.match(phoneNumberExtension);
            extension  = extension[0];
        }

        if (result == null) {
            result = text.match(sipAddressNumber);
            if (result != null) {
                isStringNumber = true;
            }
        }

        if (result) {
            foundNorthAmerica = true;
        }
        else {
            foundNorthAmerica = false;
        }

        if (!result) {
            return 0;
        }
        number = result[0];
        if (!isStringNumber) {
            var pos = result.index;
            offset += pos;

            /** Make sure we have a reasonable delimiters around our matching number **/
            if (pos && !text.substr(pos - 1, 1).match(phoneNumberDelimiter)
                || pos + number.length < text.length
                && !text.substr(pos + number.length, 1).match(phoneNumberDelimiter)) {

                offset += number.length;
                text = text.substr(pos + number.length);
                continue;
            }
        } else{
            var pos = result.index;
            offset += pos;
        }
        /** looks like we found a phone number **/
        found = true;
    }

    /** handle string address **/
    if (isStringNumber) {
        var stringNumber = number.replace(/sip:/,'');
        var spanNode     = $('<a href="onsip:'                     + stringNumber +
			     '" title="Click-to-Call '             + stringNumber +
			     '" class="onsip-click-to-call" rel="' + stringNumber +
			     '" extension="' + extension +'"></a>')[0];
    } else {
        /** wrap the phone number in a span tag **/
        var cleanNumber  = cleanPhoneNo(number);
        if (foundNorthAmerica && cleanNumber.length == 10) {
            cleanNumber = "1" + cleanNumber;
        }
        var spanNode = $('<a href="onsip:'         + cleanNumber + '@' + to_domain +
			 '" title="Click-to-Call ' + number +
			 '" class="onsip-click-to-call" rel="' + cleanNumber +
			 '" extension="' + extension + '"></a>')[0];
    }

    var range   = node.ownerDocument.createRange();

    range.setStart(node, offset);
    range.setEnd  (node, offset + number.length);

    var docfrag = range.extractContents();
    var before  = range.startContainer.splitText(range.startOffset);
    var parent  = before.parentNode;

    spanNode.appendChild(docfrag);

    parent.insertBefore(spanNode, before);

    return 1;
}

/** Highrise specific **/
/** In this function we're trying to solve a problem whereby a single **/
/** phone number is associated with several different people within an **/
/** organization.  If I click that phone number link to initiate a call **/
/** to that company, how do I identify the intended received of that phone call **/
/** This function scrapes the name of that individual from the context of the **/
/** web page so that we can link the name further into the whole call call control flow **/
/** and post the appropriate comment to the account **/
/** (i.e. Conversation with person X_FIRST, X_LAST from onsip **/
function parseHqContext(node) {
    /** Discover the name on 'https://<company>.highrisehq.com/people/<id>' **/
    var hq_people_context  = false;
    var context_name = '';
    /** Discover the name on page 'https://<company>.highrisehq.com/parties' **/
    var hq_parties_context = /highrisehq.com\/parties/.test(document.location);
    if (!hq_parties_context) {
	hq_people_context = /highrisehq.com\/people/.test(document.location);
	if (!hq_people_context){
	    hq_people_context = /highrisehq.com\/companies/.test(document.location);
	}
	if (hq_people_context) {
	    /** This jquery path selector will work to retrieve the name of the **/
	    /** person or company from the header section of the page **/
	    context_name = $('body #page_header_wrapper #subject_header_details .subject_header:first td.name h1:first');
	    if (context_name.length){
		context_name = trim(context_name.html());
	    }
	}
    }
    else if (node) {
	/** The parties pages shows contacts in the form of a list **/
	/** We can retrieve the name of the party by traversing up the DOM **/
	info_node = node.parents('.info:first');
	if (info_node.length) {
	    context_name = info_node.find('.to_person');
	    if (context_name.length) {
		context_name = trim(context_name.html());
	    }
	}
    }

    return context_name;
}

function addHighriseEvents() {
    var hq_context = /highrisehq.com\/people/.test(document.location);
    if (!hq_context){
        hq_context = /highrisehq.com\/companies/.test(document.location);
    }
    if (hq_context) {
	/** #page_main_column #contact_and_permissions_tab .submit input[name$="commit"] **/
	var path_selector = HQ_SELECTOR_PATH_UPDATE;
	if (!($(path_selector).length)) {
	    /** #page_main_column .edit .submit input[name$="commit"] **/
	    path_selector = HQ_SELECTOR_PATH_ADD_NEW;
	    if (!($(path_selector).length)){
		/** #screen_body .col .innercol .submit input[type$="submit"] **/
		path_selector = HQ_SELECTOR_PATH_DELETE;
	    }
	}
	if ($(path_selector).length && $(path_selector).attr("onClick") == undefined) {
	    $(path_selector).unbind().bind({
		click : function(e) {
		    dbg.log(CONTENT_PG, 'Submit triggered refresh Highrise data');
		    chrome.extension.sendRequest ({refreshHighrise : true}, function (response) {});
		}
	    });
	}
    }
}
/** End Highrise specific **/

function addEvents(node) {
    $('.onsip-click-to-call', node).unbind().bind({
        click     : function(e){
	    dbg.log (CONTENT_PG, 'Call Number');
	    e.preventDefault();
	    callNumber (this.innerHTML, this.rel, $(this).attr('extension'), parseHqContext($(this)));
	},
        mouseover : function() {
	    var offset, top, left;
	    var $this = $(this);
	    offset    = $this.offset();
	    top       = offset.top - 20;
	    top       = (top > 0) ? top : 0;
	    left      = offset.left - 18;
	    left      = (left > 0) ? left : 0;

	    var icon  = $('<div class="onsip-click-to-call-icon"></div>');
	    iconFile  = chrome.extension.getURL('images/icon-phone.png');
	    icon.css  ({ 'background-image' : 'url(' + iconFile + ')',
		       'top' : top + 'px', 'left' : left + 'px'}).appendTo('body').fadeIn(200);
	    $this.data('icon', icon);
	},
	 mouseout  : function() {
	    var $this  = $(this);
	    $this.data('icon').fadeOut(200, function() {
	        $(this).remove();
	    });
	}
    });
}

/** Call the given number **/
function callNumber(phone_no, clean_no, extension, name_from_context) {
    var msg = '';
    msg += 'Call number trigger ';
    msg += '[phone :  '   + phone_no  + '] - [clean no:' + clean_no + '] -';
    msg += '[extension: ' + extension + '] - [name from context page: - ' + name_from_context + ']'
    dbg.log (CONTENT_PG, msg);
    chrome.extension.sendRequest ({ setupCall : true, phone_no : clean_no, extension : extension, name_from_context : name_from_context }, function (response) {});
}