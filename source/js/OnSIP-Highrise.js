/** Highrise library for OnSIP-Click-To-Call **/

var HIGHRISE = {
    'companies': [],
    'contacts' : [],
    'ts'       : null,
    'base_url' : '',
    'token'    : ''
};

HIGHRISE.verifyToken = function (call, highrise_url, token) {
   var xhr = new XMLHttpRequest ();
   
   xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
         if (xhr.status === 200) {
	     call.onSuccess ();
	 } else {
	     call.onError (xhr.status);
	 }
      } 
   }

   this.base_url = highrise_url;
   this.token    = token;

   xhr.open('GET', this.base_url + '/people.xml', false, this.token, 'X');
   xhr.send();
};

HIGHRISE.postNote = function (phone_number, note, user_tz) {
    var clean_phone_num, customer, nt, full_name;
    clean_phone_number = this._normalizePhoneNumber (phone_number);
    costumer           = this.findContact (clean_phone_number);
    if (costumer) {
	if ( costumer.first_name && costumer.last_name ) {
	    full_name = costumer.first_name + ' ' + costumer.last_name;
	    if (trim (full_name).length === 0) {
		full_name = undefined;
	    }
	}
	if ( !name && (costumer.company_name) ) {
	    full_name = costumer.company_name;
	    if (trim (full_name).length === 0) {
		full_name = undefined;
	    }
	}
	if (full_name && full_name.length > 0) {
	    this.postNoteToProfile (costumer, note); 
	}
    }    
};

/** Find the person or company by phone number **/
HIGHRISE.findContact = function (phone_number) {
    var  i, j, costumer;    
    /** Find people first **/
    for (i = 0; i < this.contacts.length; i += 1) {
       for (j = 0; j < this.contacts[i].phone_numbers.length; j += 1) {
          if (this.contacts[i].phone_numbers[j].phone_number === phone_number) {
	     costumer      = this.contacts[i];
	     costumer.type = 'people';
	     return costumer;
	  }    
       }    	
    }
    
    for (i = 0; i < this.companies.length; i += 1) {
	for (j = 0; j < this.companies[i].phone_numbers.length; j += 1) {
	    if (this.companies[i].phone_numbers[j].phone_number === phone_number) {
		costumer      = this.companies[i];
		costumer.type = 'companies';
		return costumer;
	    }
	}
    }
    return;
};

/** Normalize the phone number **/ 
HIGHRISE._normalizePhoneNumber = function (phone_number) {
    var clean_phone_num = null,
        clean_phone_ext = null;

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

HIGHRISE.postNoteToProfile = function (customer, note, call) {
    var xhr  = new XMLHttpRequest();
    var that = this;

    xhr.onreadystatechange = function () {	
	if (xhr.readyState !== 4) {
	    return false;
	}
	if (xhr.status !== 200) {
	    if (that.call && that.call.onError) {
	        that.call.onError (xhr.status);
	    }
	} else{
	    if (that.call && that.call.onSuccess) {
	        that.call.onSuccess ();
	    }
	}
	return true;
    };
        
    xhr.open ("POST", this.base_url + "/" +  customer.type + "/" + customer.id + "/notes.xml", true, this.token, 'X');    
    xhr.send (note);
};

HIGHRISE.init        =  function (pref) {
    this.base_url = pref.get ('highriseUrl');
    this.token    = pref.get ('highriseToken');

    if (!(this.base_url && this.token)) {
	console.log ('FAILED HIGHRISE INIT ' + this.base_url + ' --> ' + this.token);
	return;
    }

    console.log ('HIGHRISE INIT ' + this.base_url + ' --> ' + this.token);
    if (!(this.ts)) {
	console.log ('Time stamp is not set');
       that = this;
       this._getContacts ({
          onSuccess : function (c) {
	     that.ts = new Date();
	     console.log ('Got Contacts');
          },
          onError   : function (status) {
             console.log ('Error ' + status);
          }
       });
       this._getCompanies ({
         onSuccess : function (c) {
	    that.ts = new Date();
            console.log ('Got Companies');
         },
         onError   : function (status) {
            console.log ('Error ' + status);
         }
       });
    }
};

HIGHRISE._getContacts = function (call) {
   var xhr  = new XMLHttpRequest();
   var that = this;
   xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) {
         return false;
      }
      if (xhr.status !== 200) {
         call.onError (xhr.status);
      } else{	  
	 that._parseContactsXML (xhr.responseText);
	 call.onSuccess (that.contacts);
      }
      return true;
   };

   xhr.open ("GET", this.base_url + '/people.xml', true, this.token, 'X');
   xhr.send ();
};

                                                                                                                                                                                         
/** Retrieve companies from highrise **/                                                                                                                                                        
HIGHRISE._getCompanies = function (call) {   
   var xhr  = new XMLHttpRequest();
   var that = this;
   xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) {
         return false;
      }
      if (xhr.status !== 200) {
	  call.onError (xhr.status);         	  
      } else{      	  
	  that._parseCompaniesXML (xhr.responseText);
	  call.onSuccess (that.companies);
      }
      return true;
   };   

   xhr.open ("GET", this.base_url + '/companies.xml', true, this.token, 'X');
   xhr.send ();  
};

HIGHRISE._parseContactsXML = function (xml) {
    var xmlobject      = (new DOMParser()).parseFromString(xml, "text/xml");
    var root_node      = xmlobject.getElementsByTagName("people")[0];
    var person_nodes   = root_node.getElementsByTagName("person");
    var node_len       = person_nodes.length;
    var i = 0, first_name = null, last_name  = null, phone_number_nodes = [],
        j = 0, phone_num  = null, location   = null, person_id = null;

    this.contacts = [];
    for (i = 0 ; i < node_len ; i += 1) {
	person_id           = person_nodes[i].getElementsByTagName ("id")[0].firstChild.nodeValue;
	last_name           = person_nodes[i].getElementsByTagName ("last-name")[0].firstChild.nodeValue;
	first_name          = person_nodes[i].getElementsByTagName ("first-name")[0].firstChild.nodeValue;
	phone_number_nodes  = person_nodes[i].getElementsByTagName ("phone-number");
	var phone_numbers_list = [];
	for (j = 0; j < phone_number_nodes.length; j += 1) {
	    phone_num  = phone_number_nodes[j].getElementsByTagName ("number")  [0].firstChild.nodeValue;
	    location   = phone_number_nodes[j].getElementsByTagName ("location")[0].firstChild.nodeValue;	   
	    phone_num  = this._normalizePhoneNumber (phone_num);
	    var ph_obj = {
		phone_number : phone_num,
		location     : location
	    };
	    phone_numbers_list.push (ph_obj);
	}
	var person_obj = {
	    "id"           : person_id,
	    "first_name"   : first_name,
	    "last_name"    : last_name,	    
	    "phone_numbers": phone_numbers_list
	};
      	this.contacts.push (person_obj);
    }
};

HIGHRISE._parseCompaniesXML = function (xml) {   
   var xmlobject      = (new DOMParser()).parseFromString(xml, "text/xml");
   var root_node      = xmlobject.getElementsByTagName("companies")[0];
   var company_nodes  = root_node.getElementsByTagName("company");
   var node_len       = company_nodes.length;
   var i = 0, company_name = null, company_id = null, phone_number_nodes = [], 
       j = 0, phone_num    = null, location   = null;
   this.companies = [];
   for (i = 0 ; i < node_len ; i += 1) {      
      company_name        = company_nodes[i].getElementsByTagName ("name")[0].firstChild.nodeValue;
      company_id          = company_nodes[i].getElementsByTagName ("id")[0].firstChild.nodeValue;
      phone_number_nodes  = company_nodes[i].getElementsByTagName ("phone-number");
      var phone_numbers_list = [];
      for (j = 0; j < phone_number_nodes.length; j += 1) {
	  phone_num = phone_number_nodes[j].getElementsByTagName ("number")  [0].firstChild.nodeValue;
	  location  = phone_number_nodes[j].getElementsByTagName ("location")[0].firstChild.nodeValue;
	  phone_num  = this._normalizePhoneNumber (phone_num);
	  var ph_obj = {
	      phone_number : phone_num,
	      location     : location
	  };
	  phone_numbers_list.push (ph_obj);
      }
      var company_obj = {
	  "id"           : company_id,
	  "company_name" : company_name,
	  "phone_numbers": phone_numbers_list
      };
      this.companies.push (company_obj);
   }
};