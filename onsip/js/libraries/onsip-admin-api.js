var apiURI = 'https://api.onsip.com/api';

function apiAction (actionName, queryParameters, basicAuth) {
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

  // TODO Unicode support
  // https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_.22Unicode_Problem.22
  if (basicAuth) {
    var user = basicAuth.username;
    var pass = basicAuth.password;
    xhrOptions.headers.Authorization = 'Basic ' + btoa(user + ':' + pass);
  }

  return new Promise(function (resolve, reject) {
    var xmlhttp = new XMLHttpRequest();

    xmlhttp.onreadystatechange = function() {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
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
  UserRead: function (sessionId) {
    return apiAction('UserRead', {
      'SessionId': sessionId
    });
  },
  UserAddressBrowse: function (sessionId, userId) {
    return apiAction('UserAddressBrowse', {
      'SessionId': sessionId,
      'UserId': userId,
      'Limit': 25000
    });
  },
  CallSetup: function (fromAddress, toAddress) {
    return apiAction('CallSetup', {
      'FromAddress': fromAddress,
      'ToAddress': toAddress
    });
  }
}