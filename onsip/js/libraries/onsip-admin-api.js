var apiURI = 'https://api.onsip.com/api';

function apiAction (actionName, queryParameters, basicAuth) {
  basicAuth = basicAuth || {};
  queryParameters = queryParameters || {};
  queryParameters.Action = actionName;
  queryParameters.Output = 'json';

  var query = stringify(queryParameters);

  //Tidy way of showing what we do below
  var xhrOptions = {
    method: 'POST',
    uri: apiURI,
    body: query,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
  };

  return new Promise(function (resolve, reject) {
    var xmlhttp = new XMLHttpRequest();

    xmlhttp.onreadystatechange = function() {
      if (xmlhttp.readyState == 4) {
        if (xmlhttp.status !== 200) {
          reject("Bad Username/Password");
          return;
        }
        var x;

        try {
          x = JSON.parse(xmlhttp.responseText);
          detectAPIErrors(x);
          resolve(x.Response);
        } catch (e) {
          reject(e);
        }
      }
    };

    xmlhttp.open('POST', apiURI);

    //basicAuth is now necessary for the call assistant sessionId'd calls
    if (basicAuth.username && basicAuth.password) {
      xmlhttp.setRequestHeader("Authorization", "Basic " + btoa(basicAuth.username + ":" + basicAuth.password));
    }

    xmlhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

    xmlhttp.send(query);
  });
}

//based on querystring.stringify
var stringifyPrimitive = function(v) {
  switch (typeof v) {
  case 'string':
  return v;

  case 'boolean':
  return v ? 'true' : 'false';

  case 'number':
  return isFinite(v) ? v : '';

  default:
  return '';
  }
};

function stringify (obj) {
  var sep = '&';
  var eq = '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return Object.keys(obj).map(function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (Array.isArray(obj[k])) {
        return obj[k].map(function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
    encodeURIComponent(stringifyPrimitive(obj));
}

function tryJSONparse (maybeStringified) {
  try {
    return JSON.parse(maybeStringified);
  }
  catch (e) {
    return maybeStringified;
  }
}

// http://developer.onsip.com/admin-api/#xml-response-format
function detectAPIErrors (body) {
  var err;

  if (body.Exception) {
    err = new Error('An Exception occurred, please email it to support@onsip.com');
    err.Exception = body.Exception;
    throw err;
  }

  if (body.Response.Context.Request.IsValid !== 'true') {
    err = new Error('The Request was not valid, please see Response.Context.Request.Errors');
    err.Response = body.Response;
    throw err;
  }

  if (body.Response.Context.Action.IsCompleted !== 'true') {
    err = new Error('The Action did not complete, please see Response.Context.Action.Errors');
    err.Response = body.Response;
    throw err;
  }

  return body;
}

var apiCalls = {
  SessionCreate: function (username, password) {
    return apiAction('SessionCreate', {
      'Username': username,
      'Password': password
    });
  },
  UserAddressBrowse: function (username, password) {
    return apiAction('UserAddressBrowse', {
      'Limit': 25000
      }, {
     'username': username,
     'password': password
    });
  },
  CallSetup: function (fromAddress, toAddress) {
    return apiAction('CallSetup', {
      'FromAddress': fromAddress,
      'ToAddress': toAddress
    });
  },
  NoOp: function () {
    return apiAction('NoOp');
  }
}