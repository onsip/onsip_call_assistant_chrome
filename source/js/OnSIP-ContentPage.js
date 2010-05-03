var toDomain;
var fromAddress;
var enabled = false;


// add listener for commands from the background process
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
	alterDOM(request);
	updateAddresses(request);
	
	if ( request.callSetupCompleted ) {
		$('.onsip-message-box').remove();
	}
	
	if ( request.callError ) {
		showErrorMessage(request.errorMsg, request.fromAddressError);
	}
});

// alter DOM on page load
chrome.extension.sendRequest({pageLoad:true}, function (response) {
	alterDOM(response);
	updateAddresses(response);
});

// add listener for DOM changes, to parse the new nodes for phone numbers
//document.addEventListener('DOMSubtreeModified', handleDomChange, true);
document.addEventListener('DOMNodeInserted', handleDomChange, true);
// stupid WebKit won't trigger DOMNodeInserted on innerHTML with plain text and no HTML tags
document.addEventListener('DOMCharacterDataModified', handleDomChange, true);


// prevent it from going into an infinite loop
var parsing = false;

function handleDomChange(e) {
	//return ;
	if (enabled) {
		
		if (parsing) return;
			
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
	$('.onsip-message-box').remove();
	$('.onsip-click-to-call').each(function(){
		$(this).replaceWith(this.innerHTML);
	});
}

// parse DOM and convert phone numbers to click-to-call links
function parseDOM(node) {
	var invalidNodes = ['SCRIPT', 'STYLE', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'PRE', 'CODE'];
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
	var text = node.nodeValue;
	var newNode = text;
	var foundNumbers = [];
	var phoneNo;
	var cleanNo;
	var phoneLink;
	var expr;
	
	// eliminate the obvious cases
	if (!node || text.length < 10 || !/\d/.test(text)) {
		return 0;
	}
	
	var phoneNumber = /\+?(1[\s-.])?((\(\d{3}\))|(\d{3}))[\s.\-]\d{3}[\s.\-]\d{4}/g;
	var phoneNumberDelimiter = '([\\s\\.,;:|\\[\\]()]+)';
	
	// find all phone numbers in current string and save them in an array
	var result = text.match(phoneNumber);
	if ( $.isArray(result) ) {
		foundNumbers = result.unique();
	}
	
	// loop through the phone numbers array and replace each of them with a click-to-call link
	for ( var n = 0; n < foundNumbers.length; n++ ) {
		phoneNo		= foundNumbers[n];
		cleanNo		= cleanPhoneNo(phoneNo);
		cleanNo		= ( cleanNo.length == 11 ) ? cleanNo : '1' + cleanNo;
		phoneLink	= '<a href="onsip:' + cleanNo + '@' + toDomain + '" title="Click-to-Call ' + phoneNo + '" class="onsip-click-to-call" rel="' + cleanNo + '">' + phoneNo + '</a>';
		
		/**
		 * stupid JavaScript doesn't understand \A and \Z regexp anchors 
		 * and I'm to tired to search for a more elegant solution, 
		 * so here goes:
		 */
		
		// replace valid phone numbers in the middle of the string
		expr1		= RegExp(phoneNumberDelimiter + escapeRegExp(phoneNo) + phoneNumberDelimiter, 'g');
		newNode		= newNode.replace(expr1, '\$1' + phoneLink + '\$2');
		
		// replace valid phone numbers at the begining of the string
		expr2		= RegExp('^' + escapeRegExp(phoneNo) + phoneNumberDelimiter, 'g');
		newNode		= newNode.replace(expr2, phoneLink + '\$1');
		
		// replace valid phone numbers at the end of the string
		expr3		= RegExp(phoneNumberDelimiter + escapeRegExp(phoneNo) + '$', 'g');
		newNode		= newNode.replace(expr3, '\$1' + phoneLink);
		
		// replace valid phone numbers where they're the only characters in the string
		expr4		= RegExp('^' + escapeRegExp(phoneNo) + '$', 'g');
		newNode		= newNode.replace(expr4, phoneLink);
	}
	
	// replace text node with the new HTML nodes
	$(node).replaceWith(newNode);
	
	return foundNumbers.length;
}

function addEvents(node) {
	$('.onsip-click-to-call', node)
		.unbind()
		.bind({
			click : function(e){
				e.preventDefault();
				
				callNumber(this.innerHTML, this.rel);
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
				
				$this.data('icon')
						.fadeOut(200, function() {
							$(this).remove();
						});
			}
		});
}

function callNumber(phoneNo, cleanNo) {
	// all pages will try to setup a phone call through the background process
	chrome.extension.sendRequest({setupCall : true, phoneNo : cleanNo}, function (response) {
		if ( response.callInProgress ) {
			showBusyMessage();
		} else {
			showSetupMessage(phoneNo);
		}
	});
}

function showSetupMessage(phoneNo) {
	var call = $('.onsip-call-message');
	
	if (call.size() == 0) {
		$('.onsip-message-box').remove();
		
		call = $('<div class="onsip-message-box onsip-call-message"><div>Calling <strong>' + phoneNo + '</strong> ...<p><a href="#">CANCEL</a><p></div></div>');
		call.find('DIV').css('background-image', 'url(' + chrome.extension.getURL('images/i_calling.png') + ')');
		call.find('A').click(function(e){
			e.preventDefault();
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
	
	var DIV = '<div class="onsip-message-box onsip-error-message"><div>' + msg + '<p>';
	if (fromAddressError) {
		DIV += '<a href="#" class="onsip-edit-address">Edit telephone number address</a> ';
	}
	DIV += '<a href="#">CLOSE</a><p></div></div>';
	
	error = $(DIV);
	error.find('DIV').css('background-image', 'url(' + chrome.extension.getURL('images/i_error.png') + ')');
	error.find('A').click(function(e){ e.preventDefault(); });
	$('body').append(error);
	
	addMessageCloseEvent(error);
	$('.onsip-edit-address').click(function(e){
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
















