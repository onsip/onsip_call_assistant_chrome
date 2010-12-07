/** Highrise library for OnSIP-Click-To-Call **/

var HIGHRISE = {
    'companies': [],
    'contacts' : [],
    'ts'       : null,
    'base_url' : '',
    'token'    : '',
    'attempts' : 0,
    'refresh'  : 60000 * 45 // Refresh every 45 min
};

/** Tries to retrieve /people.xml and looks for error code 200 **/
HIGHRISE.verifyToken = function (call, highrise_url, token) {
   var xhr   = new XMLHttpRequest ();
   var ok    = false;
   var tmout = 30000; // 30 sec
 
   xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
         if (xhr.status === 200) {
	     ok = true;
	     call.onSuccess ();
	 } else {
	     call.onError (xhr.status);
	 }
      } 
   }

   this.base_url = highrise_url;
   this.token    = token;

   var a = function () {
       if (!ok) {
	   xhr.abort();
	   if (call && call.onError) {
	       call.onError('aborted');
	   }
       }
   };

   xhr.open ('GET', this.base_url + '/people.xml', false, this.token, 'X');
   setTimeout (a, tmout);
   xhr.send ();
};

HIGHRISE._createDefaultNote = function (costumer, user_tz) {
    var nt;
    var tz = getDateAndTime (getTimezoneAbbrevation (user_tz));
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
	nt = "<note><body>Conversed with " + full_name + " @ " + tz + " By OnSIP</body></note>";
    }
    return nt;
};

/** Note has the convention <note><body> {STUFF} </body></note> **/
HIGHRISE.postNote = function (costumer, user_tz) {
    var customer, note;
    if (costumer) {
	note = this._createDefaultNote (costumer, user_tz);
	if (note && note.length) {
	    this.postNoteToProfile (costumer, note); 
	}
    }    
};

/** Find the person or company by phone number **/
HIGHRISE.findContact = function (phone_number) {
    var  i, j, len, costumer;    
    /** Find people first **/
    for (i = 0, len = this.contacts.length; i < len; i += 1) {
       for (j = 0; j < this.contacts[i].phone_numbers.length; j += 1) {
          if (this.contacts[i].phone_numbers[j].phone_number === phone_number) {
	     costumer      = this.contacts[i];
	     costumer.type = 'people';
	     return costumer;
	  }    
       }    	
    }
    
    for (i = 0, len = this.companies.length; i < len; i += 1) {
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

HIGHRISE.postNoteToProfile = function (customer, note, call) {
    var xhr  = new XMLHttpRequest();
    var that = this;
    var ok   = false;
    var tmout= 60000;

    xhr.onreadystatechange = function () {	
	if (xhr.readyState !== 4) {
	    return false;
	}
	if (xhr.status !== 200) {
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

    var a = function () {
	if (!ok) {
	    xhr.abort();
	    console.log ('HIGHRISE APP :: ABORTING xhr call to GetCompanies');
	    if (call && call.onError) {
		call.onError('aborted getCompanies');
	    }
	}
    };
        
    xhr.open ("POST", this.base_url + "/" +  customer.type + "/" + customer.id + "/notes.xml", true, this.token, 'X');    
    setTimeout (a, tmout);
    xhr.send (note);
};

HIGHRISE.init     =  function (pref) {    
    this.base_url = pref.get ('highriseUrl');
    this.token    = pref.get ('highriseToken');
    this.attempts = 0;
    
    if (!(this.base_url && this.token)) {
	console.log ('HIGHRISE APP :: Init Failed ' + this.base_url + ' -- ' + this.token);
	return;
    }
    var to_func;     
    var that = this;
    console.log ('HIGHRISE APP :: Get Contacts & Company names');
    this._getContacts ({
        onSuccess : function (c) {
	    to_func       = that._recycle.bind (that); 
	    that.ts       = new Date();	
	    that.attempts = 0;
	    setTimeout  (to_func, that.refresh);
	    console.log ('HIGHRISE APP :: Got contacts @ ' + that.ts);	     
        },
        onError   : function (status) {
            console.log ('HIGHRISE APP :: Error ' + status);
        }
    });
    this._getCompanies ({
        onSuccess : function (c) {
	    that.ts = new Date();
            console.log ('HIGHRISE APP :: Got companies @ ' + that.ts);
        },
        onError   : function (status) {
            console.log ('HIGHRISE APP :: Error ' + status);
        }
    });   
};

HIGHRISE._recycle       = function () {
    var to_func, failed_to;
    var that = this;
    console.log ('HIGHRISE APP :: Recycle contacts & companies');
    this._getContacts ({
        onSuccess : function (c) {	    
	    delete that.ts;	
	    to_func       = that._recycle.bind (that);
	    that.attempts = 0;
	    setTimeout  (to_func, that.refresh);	    
	    console.log ('HIGHRISE APP :: Recycled ' + c.length + ' contacts @ ' + new Date());
	},
	onError   : function (status) {
	    that.attempts += 1;
	    if (that.attempts <= 5) {
		failed_to = 60000 * that.attempts; 
		to_func   = that._recycle.bind (that);		
                setTimeout  (to_func, failed_to);
		console.log ('HIGHRISE APP :: Failed to connect on ' + that.attempts + ' attempts, will try again');
	    } else {
		console.log ('HIGHRISE APP :: CRITICAL FAILURE, tried to connect to API more than  5 time(s)');
	    }
	    console.log ('HIGHRISE APP :: Error ' + status);
	}
    });
    this._getCompanies ({
       onSuccess : function (c) {          
	    console.log ('HIGHRISE APP :: Recycled ' + c.length + '  companies @ ' + new Date());
       },
       onError   : function (status) {
	   console.log ('HIGHRISE APP :: Error ' + status);
       }
    });    
};

HIGHRISE._getContacts = function (call) {
   var xhr  = new XMLHttpRequest();
   var that = this;
   var ok   = false;
   var tmout= 90000;

   xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) {
         return false;
      }
      if (xhr.status !== 200) {
         call.onError (xhr.status);
      } else{	  
	 ok = true;
	 that._parseContactsXML (xhr.responseText);
	 call.onSuccess         (that.contacts);
      }
      return true;
   };

   var a = function () {
       if (!ok) {
           xhr.abort();
	   console.log ('HIGHRISE APP :: ABORTING xhr call to GetContacts');
           if (call && call.onError) {
               call.onError('aborted getContacts');
           }
       }
   };

   xhr.open ("GET", this.base_url + '/people.xml', true, this.token, 'X');
   setTimeout (a, tmout);
   xhr.send ();
};

/** Retrieve companies from highrise **/
HIGHRISE._getCompanies = function (call) {   
   var xhr  = new XMLHttpRequest();
   var that = this;
   var ok   = false;
   var tmout= 90000;

   xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) {
         return false;
      }
      if (xhr.status !== 200) {
	  call.onError (xhr.status);         	  
      } else {      	
	  ok = true;
	  that._parseCompaniesXML (xhr.responseText);
	  call.onSuccess          (that.companies);
      }
      return true;
   };   

   var a = function () {
       if (!ok) {
	   xhr.abort();
	   console.log ('HIGHRISE APP :: ABORTING xhr call to GetCompanies');
	   if (call && call.onError) {
	       call.onError('aborted getCompanies');
	   }
       }
   };

   xhr.open ("GET", this.base_url + '/companies.xml', true, this.token, 'X');
   setTimeout (a, tmout);
   xhr.send ();  
};

HIGHRISE._parseContactsXML = function (xml) {
    var i, j, phone_num, first_name, last_name, pn_nodes = [],
        location, person_id, len;
    var xmlobject = (new DOMParser()).parseFromString(xml, "text/xml");
    var root_node = xmlobject.getElementsByTagName("people");
    this.contacts = [];
    if (root_node && root_node.length > 0) {
	root_node = root_node[0];
    } else {
	return;
    }  
    var person_nodes  = root_node.getElementsByTagName("person");    
    for (i = 0,   len = person_nodes.length; i < len ; i += 1) {
	person_id     = person_nodes[i].getElementsByTagName ("id")[0].firstChild.nodeValue;
	last_name     = person_nodes[i].getElementsByTagName ("last-name");
	if (last_name && last_name.length > 0 && last_name[0].firstChild) {
	    last_name = last_name[0].firstChild.nodeValue;
	} else {
	    last_name  = '';
	}
	first_name     = person_nodes[i].getElementsByTagName ("first-name");
	if (first_name && first_name.length > 0 && first_name[0].firstChild) {
	    first_name = first_name[0].firstChild.nodeValue;	   
	} else {
	    first_name = '';
	}
	pn_nodes       = person_nodes[i].getElementsByTagName ("phone-number");
	var phone_numbers_list = [];
	for (j = 0;  j < pn_nodes.length; j += 1) {
	    phone_num     = pn_nodes[j].getElementsByTagName ("number");
	    if (phone_num && phone_num.length > 0 && phone_num[0].firstChild) {
		phone_num = phone_num[0].firstChild.nodeValue;	   			   	   
		location  = pn_nodes[j].getElementsByTagName ("location");
		if (location && location.length > 0 && location[0].firstChild) {
		    location = location[0].firstChild.nodeValue;
		} else {
		    location = '';
		}	   
		phone_num  = this._normalizePhoneNumber (phone_num);
		var ph_obj = {
		    phone_number : phone_num,
		    location     : location
		};
		phone_numbers_list.push (ph_obj);
	    }
	}
	if (phone_numbers_list.length > 0) {
	    var person_obj = {
		"id"           : person_id,
		"first_name"   : first_name,
		"last_name"    : last_name,	    
		"phone_numbers": phone_numbers_list
	    };	
	    this.contacts.push (person_obj);
	}
    }
};

HIGHRISE._parseCompaniesXML = function (xml) {   
   var i, j, len, company_name, company_id, phone_num, pn_nodes = [], location;
   var xmlobject     = (new DOMParser()).parseFromString(xml, "text/xml");
   var root_node     = xmlobject.getElementsByTagName("companies");
   this.companies    = [];
   if (root_node && root_node.length > 0) {
       root_node     = root_node[0];
   } else {
       return;
   }
   var company_nodes = root_node.getElementsByTagName("company");   
   for (i = 0,   len = company_nodes.length ; i < len ; i += 1) {      
      company_id     = company_nodes[i].getElementsByTagName ("id")  [0].firstChild.nodeValue;
      company_name   = company_nodes[i].getElementsByTagName ("name");
      if (company_name && company_name.length > 0 && company_name[0].firstChild) {
	  company_name = company_name [0].firstChild.nodeValue;
	  pn_nodes     = company_nodes[i].getElementsByTagName ("phone-number");
	  var phone_numbers_list = [];
	  for (j = 0; j < pn_nodes.length; j += 1) {
	      phone_num = pn_nodes[j].getElementsByTagName ("number");
	      if (phone_num &&  phone_num.length > 0 && phone_num[0].firstChild) {
		  phone_num = phone_num[0].firstChild.nodeValue;
		  location  = pn_nodes[j].getElementsByTagName ("location");
		  if (location && location.length > 0 && location[0].firstChild) {    
		      location = location[0].firstChild.nodeValue;
		  } else {
		      location = '';
		  }
		  phone_num  = this._normalizePhoneNumber (phone_num);
		  var ph_obj = {
		      phone_number : phone_num,
		      location     : location
		  };
		  phone_numbers_list.push (ph_obj);
	      }
	  }
	  if (phone_numbers_list.length > 0) {
	      var company_obj = {
		  "id"           : company_id,
		  "company_name" : company_name,
		  "phone_numbers": phone_numbers_list
	      };
	      this.companies.push (company_obj);
	  }
      }
   }
};