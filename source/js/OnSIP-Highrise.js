/** Highrise library for OnSIP-Click-To-Call **/

var HIGHRISE = {
    'companies': [],
    'contacts' : [],
    'base_url' : 'https://onsip.highrisehq.com/',
    'token'    : 'b96bb6e88495f36d855e9c166993386b'
};

HIGHRISE.verifyToken = function (call) {

   var xhr = new XMLHttpRequest ();
   
   xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
         if (xhr.status === 200) {
	     call.onSuccess ();
	 }else{
	     call.onError (xhr.status);
	 }
      } 
   }

   xhr.open('GET', this.base_url + 'people.xml', false, this.token, 'X');
   xhr.send();

};

HIGHRISE.postNote = function (phone_number, note) {
    var clean_phone_num = null, customer = null;
    if (companies || contacts) {
	clean_phone_number = this._normalizePhoneNumber (phone_number);
	costumer = this._findContact (clean_phone_number);
	if (costumer) {
	    // create note 
	    var note = "";
	    this._postNoteToProfile (costumer, note, null);       
	}
    }    
};

/** Find the person or company **/
HIGHRISE._findContact = function (phone_number) {

    var  i = 0, j = 0, costumer = null;
    for (i = 0; i < contacts.length; i += 1) {
        for (j = 0; j < contacts[i].phone_numbers.length; j += 1) {
	    if (contacts[i].phone_numbers[j].phone_number === phone_number) {
		costumer = contacts[i];
		costumer.type = 'people';
		return costumer;
	    }    
	}    	
    }
    
    for (i = 0; i < companies.length; i += 1) {
        for (j = 0; j < companies[i].phone_numbers.length; j += 1) {
            if (companies[i].phone_numbers[j].phone_number === phone_number) {
		costumer= companies[i];
		costumer.type = 'companies';
		return costumer;
            }
        }
    }
    
    return null;

};

/** Normalize the phone number **/ 
HIGHRISE._normalizePhoneNumber = function (phone_number) {

    var clean_phone_num = null,
        clean_phone_ext = null;


    clean_phone_ext = getPhoneExtension( phone_num );
    clean_phone_num = removeExtention ( phone_number );
    clean_phone_num = cleanPhoneNo (clean_phone_num);
    if(clean_phone_num.length === 10) {
	clean_phone_num = '1' + clean_phone_num;
    }
    if(clean_phone_ext ){
	clean_phone_num += cleanPhoneNo (clean_phone_ext);
    }
	
    return clean_phone_num;

};

HIGHRISE._postNoteToProfile = function (customer, note, call) {

    var xhr  = new XMLHttpRequest();
    var that = this;
    xhr.onreadystatechange = function () {	
	if (xhr.readyState !== 4) {
	    return false;
	}
	if (xhr.status !== 200) {
	    if (call && call.onError) {
	        call.onError (xhr.status);
	    }
	} else{
	    if (call && call.onSuccess) {
	        call.onSuccess ();
	    }
	}
	return true;
    };
        
    xhr.open ("PUT", this.base_url + customer.type + "/" + customer.id + "/notes.xml", true, this.token, 'X');    
    xhr.send (note);

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

   xhr.open ("GET", this.base_url + 'people.xml', true, this.token, 'X');
   xhr.send ();

};

                                                                                                                                                                                         
// Retrieve companies from highrise                                                                                                                                                        
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

   xhr.open ("GET", this.base_url + 'companies.xml', true, this.token, 'X');
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
	    "person_id"    : person_id,
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
	  "company_name" : company_name,
	  "company_id"   : company_id,
	  "phone_numbers": phone_numbers_list
      };
      this.companies.push (company_obj);
   }

};