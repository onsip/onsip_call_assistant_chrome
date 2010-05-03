function getDomain(address) {
	return address.substring(address.indexOf('@') + 1);
}

function cleanPhoneNo(str) {
	return str.replace(/[^\d]/g, '');
}

function escapeRegExp(str) {
	var specials = new RegExp("[.*+?|()\\[\\]{}\\\\]", "g"); // .*+?|()[]{}\
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