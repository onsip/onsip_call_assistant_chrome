/** Highrise library for OnSIP-Click-To-Call **/

var ZENDESK = {
    'contacts' : [],
    'ts'       : null,
    'base_url' : 'http://jn.zendesk.com',
    'user'     : 'oren@junctionnetworks.com',
    'pwd'      : 'XkWHM8ZJ',
    'attempts' : 0,
    'refresh'  : 60000 * 45 // Refresh every 45 min
};

ZENDESK.verify = function (call, zendesk_url, user, pwd) {
    var xml, xmlobject, user_node, id;
    var xhr = new XMLHttpRequest ();
   
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
         if (xhr.status === 200) {
	     xml       = xhr.responseText;
	     xmlobject = (new DOMParser()).parseFromString(xml, "text/xml");
	     user_node = xmlobject.getElementsByTagName("user");
	     if (user_node && user_node.length) {
		 id = user_node[0].getElementsByTagName ("id")[0].firstChild.nodeValue;
		 console.log ("ZENDESK APP :: ID of Current User " + id);
	     }	     
	     if (!isNaN(id)) {
		 call.onSuccess ();
	     } else {
		 call.onError ();
	     }	     
	 } else {
	     call.onError (xhr.status);
	 }
      } 
   }
   
   xhr.open('GET', zendesk_url + '/users/current.xml', false, user, pwd);
   xhr.send();
};

/** Convention <ticket><priority-id>{STUFF}</priority-id><description>{STUFF}</description><requester_id>{STUFF}</requester_id></ticket> **/
ZENDESK.postNote = function (phone_number, note) {
    var clean_phone_num, customer, nt, full_name;
    clean_phone_number = this._normalizePhoneNumber (phone_number);
    costumer           = this.findContact (clean_phone_number);
    console.log ('ZENDESK APP :: Searching for costumer');
    if (costumer) {
	if (costumer.full_name) {
	    full_name = costumer.full_name;
	    if (trim (full_name).length === 0) {
		full_name = undefined;
	    }
	}	
	if (full_name && full_name.length > 0) {
	    console.log ('ZENDESK APP :: Found constumer, posting note');
	    this.postNoteToProfile (costumer, note); 
	}
    }    
};

/** Find the person or company by phone number **/
ZENDESK.findContact = function (phone_number) {
    var  i, j, len, costumer;    
    /** Find people first **/
    for (i = 0, len = this.contacts.length; i < len; i += 1) {       
	if (this.contacts[i].phone_number === phone_number) {
	     costumer      = this.contacts[i];
	     costumer.type = 'user';
	     console.log ('ZENDESK APP :: Found contact, posting note')
	     return costumer;
        }               	
    }        
    return;
};

/** Normalize the phone number **/ 
ZENDESK._normalizePhoneNumber = function (phone_number) {
    var clean_phone_num, clean_phone_ext;
    clean_phone_ext = getPhoneExtension( phone_number );
    clean_phone_num = removeExtention  ( phone_number );
    clean_phone_num = cleanPhoneNo     (clean_phone_num);
    if (clean_phone_num.length === 10) {
	clean_phone_num = '1' + clean_phone_num;
    }
    if (clean_phone_ext) {
	clean_phone_num += cleanPhoneNo (clean_phone_ext);
    }
	
    return clean_phone_num;
};

ZENDESK.postNoteToProfile = function (customer, note, call) {
    var xhr  = new XMLHttpRequest();
    var that = this;

    xhr.onreadystatechange = function () {	
	if (xhr.readyState !== 4) {
	    return false;
	}
	if (xhr.status !== 201) {
	    if (that.call && that.call.onError) {
	        that.call.onError (xhr.status);
	    }
	} else {
	    if (that.call && that.call.onSuccess) {
	        that.call.onSuccess ();
	    }
	}
	return true;
    };
  
    xhr.open ("POST", this.base_url + "/tickets.xml", true, this.user, this.pwd);    
    xhr.setRequestHeader("Content-Type", "application/xml");
    xhr.send (note);
};

ZENDESK.init        =  function (pref) {
    //this.base_url  = "http://jn.zendesk.com"; //pref.get ('highriseUrl');
    //this.user      = "oren@junctionnetworks.com";
    //this.pwd       = "XkWHM8ZJ";
    
    this.attempts = 0;
    
    if (!(this.base_url && this.user && this.pwd)) {
	console.log ('ZENDESK APP :: Init Failed ' + this.base_url);
	return;
    }
    
    var to_func;
    var that = this;
    console.log ('ZENDESK APP :: Timestamp not set ');
    this._getContacts ({
        onSuccess : function (c) {
	    to_func       = that._recycle.bind (that); 
	    that.ts       = new Date();	
	    that.attempts = 0;
	    setTimeout  (to_func, that.refresh);
	    console.log ('ZENDESK APP :: Got contacts count ' + c.length + ' @ ' + that.ts);	     
        },
        onError   : function (status) {
            console.log ('ZENDESK APP :: Error ' + status);
        }
    });
};

ZENDESK._recycle       = function () {
    var to_func, failed_to;
    var that = this;
    console.log ('ZENDESK APP :: Recycle contacts & companies');
    this._getContacts ({
        onSuccess : function (c) {	    
	    delete that.ts;	
	    to_func       = that._recycle.bind (that);
	    that.attempts = 0;
	    setTimeout  (to_func, that.refresh);	    
	    console.log ('ZENDESK APP :: Recycled ' + c.length + ' contacts @ ' + new Date());
	},
	onError   : function (status) {
	    that.attempts += 1;
	    if (that.attempts <= 5) {
		failed_to = 60000 * that.attempts; 
		to_func   = that._recycle.bind (that);		
                setTimeout  (to_func, failed_to);
		console.log ('ZENDESK APP :: Failed to connect on ' + that.attempts + ' attempts, will try again');
	    } else {
		console.log ('ZENDESK APP :: CRITICAL FAILURE, tried to connect to API more than  5 time(s)');
	    }
	    console.log ('ZENDESK APP :: Error ' + status);
	}
    });
};

ZENDESK._getContacts = function (call) {
   var xhr  = new XMLHttpRequest();
   var that = this;
   xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) {
         return false;
      }
      if (xhr.status !== 200) {
         call.onError (xhr.status);
      } else {	  
	 that._parseContactsXML (xhr.responseText);
	 call.onSuccess         (that.contacts);
      }
      return true;
   };

   xhr.open ("GET", this.base_url + '/users.xml?role=0', true, this.user, this.pwd);
   xhr.send ();
};

ZENDESK._parseContactsXML = function (xml) {
    var i, j, phone_node, phone, full_name, location, person_id;
    var xmlobject   = (new DOMParser()).parseFromString(xml, "text/xml");
    var root_node   = xmlobject.getElementsByTagName("users")[0];
    var user_nodes  = root_node.getElementsByTagName("user");
    var node_len    = user_nodes.length;
    
    this.contacts = [];
    for (i = 0 ; i < node_len ; i += 1) {
	person_id  = user_nodes[i].getElementsByTagName ("id")   [0].firstChild.nodeValue;
	full_name  = user_nodes[i].getElementsByTagName ("name") [0].firstChild.nodeValue;
	phone_node = user_nodes[i].getElementsByTagName ("phone");
	if (phone_node && phone_node.length) { 
	    console.log ("ZENDESK APP :: Phone node was found " + user_nodes[i].getElementsByTagName ("phone").length);
	    if (phone_node[0].firstChild && phone_node[0].firstChild.nodeValue) {	    
		phone      = phone_node[0].firstChild.nodeValue;
		phone_num  = this._normalizePhoneNumber (phone);
	
		var person_obj = {
		    "id"           : person_id,
		    "full_name"    : full_name,	    
		    "phone_number" : phone_num
		};

		if (phone_num) {
		    this.contacts.push (person_obj);
		}
	    }
	}
    }
};