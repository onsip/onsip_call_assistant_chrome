// Global vars
var toDomain;
var fromAddress;
var enabled = false;
var callIsInProgress = false;


// Add listener for commands from the background process
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
        console.log ('OnSIP-ContentPage addListener');
	dbg.log ('OnSIP-ContentPage addListener :: parseDOM  ' + request.parseDOM);
	alterDOM (request);
	updateAddresses(request);
     // On callComplete
	if ( request.callSetupCompleted ) {
        dbg.log('APP :: callIsInProgress FALSE');
        callIsInProgress = false;
		///$('.onsip-message-box').remove();
	}
    // On callError
	if ( request.callError ) {
		showErrorMessage(request.errorMsg, request.fromAddressError);
	}

    // On Setting error
	if ( request.settingsError ) {
        dbg.log('CONTENT :: setup extension first');
        dbg.log('APP :: callIsInProgress FALSE');
        callIsInProgress = false;
		showErrorMsg(request.errorMsg);
	}

    // On incoming call
    if ( request.incomingCall ){
        dbg.log(' CONTENT :: Request Incoming Call ');
        showSetupMessage(request.incomingNumber, request.incomingName,  request.incomingCallTitle);
    }
    // On outgoing call
    if(request.outgoingCall ){
        dbg.log(' CONTENT :: Request Outgoing Call ');
        showSetupMessage(request.outgoingNumber, request.outgoingName,  ' Calling ');
    }
    
    if ( request.incomingCallRetract ) {
        dbg.log(' CONTENT :: Call Retract ---->>>>> ');
//        setTimeout(function() {$('.onsip-message-box').remove();callIsInProgress = false;}, 4500);
        $('.onsip-message-box').remove();
        dbg.log('APP :: callIsInProgress FALSE');
        callIsInProgress = false;
    }

    if ( request.incomingCallConfirmed ) {
        dbg.log(' CONTENT :: Request incomingCallConfirmed');
        dbg.log('APP :: callIsInProgress FALSE');
        callIsInProgress = false;
        ///$('.onsip-message-box').remove();
    }
});

// alter DOM on page load
chrome.extension.sendRequest({ pageLoad:true }, function (response) {
   console.log ('CHROME Content-Page ::  sendRequest');
   alterDOM(response);
   updateAddresses(response);
});

// add listener for DOM changes, to parse the new nodes for phone numbers
// document.addEventListener('DOMSubtreeModified', handleDomChange, true);

// stupid WebKit won't trigger DOMNodeInserted on innerHTML with plain text and no HTML tags
document.addEventListener('DOMCharacterDataModified', handleDomChange, true);
document.addEventListener('DOMNodeInserted'         , handleDomChange, true);

// prevent it from going into an infinite loop
var parsing = false;

function handleDomChange(e) {
    console.log ('Handle DOM Change - enabled ' + enabled + ' === ' + parsing);
    //return ;
    if (enabled) {		
        if (parsing) {
	    return;
	}	
	var newNodeClass = e.srcElement.className;		
	if ( newNodeClass != undefined ) {
	    if (/onsip\-message\-box/.test(newNodeClass) || newNodeClass == 'onsip-click-to-call-icon') {
		return;
	    }
	}
	var targetNode = (e.relatedNode) ? e.relatedNode : e.target;
	parsing = true;
	setTimeout(function(){
	       parseDOM(targetNode);
	       parsing = false;
	    }, 10);
    }
}

// alter the DOM
function alterDOM(request) {
    // parse DOM command
    console.log ('AlterDOM');
    if ( request.parseDOM ) {
	enabled = true;
	parseDOM(document.body);
    } else if ( request.clearDOM ) {
    // clear DOM command
        enabled = false;
	clearDOM();
    }
}

function updateAddresses(request) {
    if (request.fromAddress) {
        fromAddress = request.fromAddress;
	toDomain = getDomain(fromAddress);
		
	// update toAddress in link href
	$('.onsip-click-to-call').each(function(){
            var href = this.href;
	    href = href.substr(0, href.indexOf('@') + 1);
	    href += toDomain;
	    this.href = href;
	    });
    }
}

// remove click-to-call links and messages
function clearDOM() {
    console.log ('clearDOM');
    $('.onsip-message-box').remove();
    $('.onsip-click-to-call').each(function(){
        $(this).replaceWith(this.innerHTML);
    });
}

// parse DOM and convert phone numbers to click-to-call links
function parseDOM(node) {
    console.log ('CHROME :: Parsing DOM');
    var invalidNodes = ['SCRIPT', 'STYLE', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'CODE'];
    var nodeName = node.nodeName.toUpperCase();
    var childNodesLength = node.childNodes.length;
	
    if ( $.inArray(nodeName, invalidNodes) > -1 || $(node).hasClass('onsip-message-box') ) {
	return 0;
    }

    for (var n = 0; n < childNodesLength; n++) {
	var found = parseDOM(node.childNodes[n]);
	if ( found > 0 ) {
	    parseDOM(node);
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

// replace phone numbers
function parsePhoneNumbers(node) {
    var isStringNumber = false;
    // SIP adress
    var sipAddressNumber = /sip:[a-zA-Z09_]+@[a-zA-Z09_]+\.[a-z]{1,4}/;

	// Eliminate the obvious cases
    if (!node || node.nodeValue.length < 10 ||
    node.nodeValue.search(/\d/) == -1 && node.nodeValue.match(sipAddressNumber) == null) {
        return 0;
    }

    var phoneNumber = /((((\+|(00))[1-9]\d{0,3}[\s\-.]?)?\d{2,4}[\s\/\-.]?)|21)\d{5,9}/;
    var phoneNumberNorthAmerica = /\+?(1[\s-.])?((\(\d{3}\))|(\d{3}))[\s.\-]\d{3}[\s.\-]\d{4}/;
    // phone number with an extension
    var phoneNumberNorthAmericaWithExtension = /\+?(1[\s-.])?((\(\d{3}\))|(\d{3}))[\s.\-]\d{3}[\s.\-]\d{4}\s{1,5}(ext|x|ex)\s{0,3}.{0,3}\d{2,5}/;
    var phoneNumberExtension = /(ext|x|ex)\s{0,3}.{0,3}\d{2,5}/g;
    var phoneNumberDelimiter = /[\s.,;:|]/;
    
    var text = node.nodeValue;
    var offset = 0;
    var number = "";
    // extension
    var extension = null;
    var found = false;
    var foundNorthAmerica = false;
 
    // find the first phone number in the text node
    while (!found) {
        
        var result = text.match(phoneNumberNorthAmerica);

        // handling extension
        var resultWithExtension = text.match(phoneNumberNorthAmericaWithExtension);
        if(resultWithExtension){
            extension  = text.match(phoneNumberExtension);
            extension  = extension[0];
        }

        if(result == null){
            result = text.match(sipAddressNumber);
            if(result != null){
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
   
        if(!isStringNumber){
            var pos = result.index;
            offset += pos;

            // make sure we have a resonable delimiters around our matching number
            if (pos && !text.substr(pos - 1, 1).match(phoneNumberDelimiter) 
                || pos + number.length < text.length
                && !text.substr(pos + number.length, 1).match(phoneNumberDelimiter)) {
                
                offset += number.length;
                text = text.substr(pos + number.length);
                continue;
            }
        }else{
            var pos = result.index;
            offset += pos;

        }
        
        
        // looks like we found a phone number
        found = true;
    }

    // handle string address
    if(isStringNumber){
        var stringNumber = number.replace(/sip:/,'');
        var spanNode = $('<a href="onsip:' + stringNumber + '" title="Click-to-Call ' + stringNumber + '" class="onsip-click-to-call" rel="' + stringNumber + '" extension="' +extension +'"></a>')[0];
    
    }else{
        // wrap the phone number in a span tag
        var cleanNumber = cleanPhoneNo(number);

        if (foundNorthAmerica && cleanNumber.length == 10) {
            cleanNumber = "1" + cleanNumber;
        }
        var spanNode = $('<a href="onsip:' + cleanNumber + '@' + toDomain + '" title="Click-to-Call ' + number + '" class="onsip-click-to-call" rel="' + cleanNumber + '" extension="' +extension +'"></a>')[0];
    }

    var range = node.ownerDocument.createRange();

 
    range.setStart(node, offset);
    range.setEnd(node, offset + number.length);
  
    
    var docfrag = range.extractContents();
    var before = range.startContainer.splitText(range.startOffset);
    var parent = before.parentNode;
    
    spanNode.appendChild(docfrag);

    parent.insertBefore(spanNode, before);
    
    return 1;
}

function addEvents(node) {
    $('.onsip-click-to-call', node).unbind().bind({
	    click : function(e){
		dbg.log('CONTENT :: Call Number');
		e.preventDefault();
		callNumber(this.innerHTML, this.rel, $(this).attr('extension'));
	    },
	    mouseover : function() {
		        var $this = $(this);
			var offset = $this.offset();
				
			var top = offset.top - 20;
			top = (top > 0) ? top : 0;
				
			var left = offset.left - 18;
			left = (left > 0) ? left : 0;
				
			var icon = $('<div class="onsip-click-to-call-icon"></div>');
			iconFile = chrome.extension.getURL('images/icon-phone.png');
			icon.css({
		            'background-image' : 'url(' + iconFile + ')',
					 'top' : top + 'px',
				        'left' : left + 'px'
			})
			.appendTo('body')
			.fadeIn(200);
				
			$this.data('icon', icon);
		   },
	    mouseout : function() {
		       var $this = $(this);
	   	       $this.data('icon').fadeOut(200, function() {
			           $(this).remove();
		               });
		       }
    });
}

/**
 * Call the given number
 *  @param phoneNo
 *  @param cleanNo
 */
function callNumber(phoneNo, cleanNo, extension) {
    dbg.log('CONTENT :: call number signal');
    chrome.extension.sendRequest ( {setupCall : true, phoneNo : cleanNo, extension : extension }, function (response) {



    });

    //if(!callIsInProgress){
        //dbg.log('CONTENT :: call IS NOT in-progress');
//      all pages will try to setup a phone call through the background process
        //chrome.extension.sendRequest({setupCall : true, phoneNo : cleanNo, extension : extension}, function (response) {
		//    if(!response.popupDisabled){
                //if ( response.callInProgress ) {
                //    showBusyMessage();
                //} else {
                //    showSetupMessage(phoneNo, response.customerName, 'Calling ');
                //}
		//}
        //});
	//}
	//dbg.log('CONTENT :: call IS inprogress');
	//callIsInProgress = true;
}


/**
 * Show setup message
 */
function showSetupMessage(phoneNo, customerName, msg) {
    dbg.log('CONTENT :: setupMessage ');
    // take care of null name
    if(customerName == null){
        customerName = '';
    }
    if(msg == null){
        msg = '';
    }
    var call = $('.onsip-call-message');
    if (call.size() == 0) {
	$('.onsip-message-box').remove();
	call = $('<div class="onsip-message-box onsip-call-message" style="background: transparent url( '+ chrome.extension.getURL('images/pop_up_background.png')  + ' ) no-repeat "><div id="onsip-message-wrapper" > <div id="popup-message">'+ msg +'  </div> <div id="popup-name">'+ customerName + ' </div> <div id="popup-number">' + phoneNo + ' </div> <p id="close-btn-wrapper" ><a id="close-notification-btn" href="#" > <img src="'+ chrome.extension.getURL('images/pop_up_close.png')  + '"  /></a><p></div></div>');
	call.find('A').click(function(e){
		e.preventDefault();
		dbg.log('APP :: callIsInProgress FALSE');
		callIsInProgress = false;
		chrome.extension.sendRequest({setupCallCancel : true}, function (response) {});
		call.remove();
	});
	$('body').append(call);
    }
}

function showBusyMessage() {
	var msg = $('.onsip-busy-message');
	var call = $('.onsip-call-message');
	
	if (msg.size() == 0 && call.size() == 0) {
		
		$('.onsip-message-box').remove();
		
		msg = $('<div class="onsip-message-box onsip-busy-message"><div>Another phone call request is already in progress!</div></div>');
		msg.find('DIV').css('background-image', 'url(' + chrome.extension.getURL('images/i_warning.png') + ')');
		$('body').append(msg);
		
		addMessageCloseEvent(msg);
	}
		
	delayedClose(msg);
}

function showErrorMessage(msg, fromAddressError) {
	$('.onsip-message-box').remove();
	
	var DIV = '<div class="onsip-message-box onsip-call-message" style="background: transparent url( '+ chrome.extension.getURL('images/pop_up_background.png')  + ' ) no-repeat "><div id="onsip-message-wrapper" > ' + msg + '<p>';
	if (fromAddressError) {
		DIV += '<a href="#" class="onsip-edit-address">Edit telephone number address</a> ';
	}
	DIV += '<p id="close-btn-wrapper" ><a href="#" > <img src="'+ chrome.extension.getURL('images/pop_up_close.png')  + '"  /></a><p><p></div></div>';
	
	error = $(DIV);
	error.find('DIV').css('background', 'url(' + chrome.extension.getURL('images/i_error.png') + ') no-repeat');
	error.find('A').click(function(e){e.preventDefault();});
	$('body').append(error);
	
	addMessageCloseEvent(error);
	$('.onsip-edit-address').click(function(e){
		e.preventDefault();
		chrome.extension.sendRequest({openSettingsPage : true}, function (response) {});
	});
}

/**
 * Show error message
 */
function showErrorMsg(msg){
    dbg.log('CONTENT :: showErrorMsg');

    // take care of null name
    $('.onsip-message-box').remove();
	var DIV = '<div class="onsip-message-box onsip-call-message" style="background: transparent url( '+ chrome.extension.getURL('images/pop_up_background.png')  + ' ) no-repeat "><div id="onsip-message-wrapper" > ' + msg + '<p>';

    error = $(DIV);
	error.find('DIV').css('background', 'url(' + chrome.extension.getURL('images/i_error.png') + ') no-repeat');
	error.find('A').click(function(e){e.preventDefault();});
	$('body').append(error);

    addMessageCloseEvent(error);
	error.click(function(e){
		e.preventDefault();
		chrome.extension.sendRequest({openSettingsPage : true}, function (response) {});
	});
}

function addMessageCloseEvent(el) {
	el.click(function(){
		el.fadeOut(300, function(){
			el.remove()
		});
	});
	
	$(document).keyup(function(e){
		if (e.keyCode == 27) el.click();
	});
}

function delayedClose(el) {
	
	clearTimeout(el.data('to'));
	
	var to = setTimeout(function(){
		el.click();
	}, 5000);
	
	el.data('to', to);
}