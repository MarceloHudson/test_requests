/*
 *
 *  A simplified node version of our link health checker:
 *  Makes a HEAD request first. If any failure is encountered it then makes a GET request. Also provides ability (-m flag)
 *  to automatically handle SSL CN mismatches if it's just a case of a missing/needed 'www.'
 *
 */

var request = require( 'request' );
const commandLineArgs = require( 'command-line-args' )
const optionDefinitions = [ {

    name: 'timeout',
    alias: 't',
    type: Number,
    defaultOption: 10000
  },
  {
    name: 'url',
    alias: 'u',
    type: String,
    defaultOption: null,
    multiple: false
  },
  {
    name: 'redirects',
    alias: 'r',
    type: Number,
    defaultOption: 5
  },
  {
    name: 'mismatch',
    alias: 'm',
    type: Boolean
  }
];
const options = commandLineArgs( optionDefinitions )
var timeout = options.timeout || '10000'; //ms - will cover both connection_timeouts and http_timeouts. differentiated in the request
var follow_redirects = options.redirects;
var url = options.url;
var req_options = {};
var check_mismatch = options.mismatch;

if ( !url ) {
  console.log( 'Exiting as no url was given. Remember -u http://urltotest.com' );
  process.exit( 1 );
}

var multi_url = Array.isArray( url ); //for multiple URLs later on

req_options = {

  uri: url,
  maxRedirects: follow_redirects,
  timeout: timeout,
  method: 'HEAD',
  time: true

};

//get started
console.log( '\n######################## Trying to make a meaningful connection with ' + url + ' ############################\n' );
console.log( 'Results:\n' );
make_request( req_options, 'HEAD', true );



function make_request( req_options, method, retry ) {

  request( req_options, function ( error, response, body ) {
    console.log( '\t' + method + ' Request:\n' );

    if ( error ) {

      if ( error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT' ) {

        if ( error.connect === true ) {
          console.log( '\t\tConnection timeout occured - couldn\'t establish connection to target in under ' + timeout + 'ms\n' );

          if ( retry ) {
            make_request( req_options, 'GET', false )
          }
          else {
            process.exit( 1 );
          }
        }
        else {
          console.log( '\t\thttp/read timeout occured - URL didn\'t respond in under ' + timeout + 'ms\n' );

          if ( retry ) {
            make_request( req_options, 'GET', false )
          }
          else {
            process.exit( 1 );
          }
        }
      }
      else if ( error.code === 'ENOTFOUND' ) {
        console.log( '\t\tSite could not be found :(\n' );

        if ( retry ) {
          make_request( req_options, 'GET', false )
        }
        else {
          process.exit( 1 );
        }

      }
      else if ( error.reason ) {

        if ( check_mismatch ) {
          check_ssl_mismatch( req_options[ 'uri' ], error.host, error.reason, function ( err, result ) {

            if ( !result ) {
              console.log( '\t\tStatus code 0' );
              console.log( '\t\t' + error.reason );
              req_options[ 'method' ] = 'GET';

              if ( retry ) {
                make_request( req_options, 'GET', false );
              }
            }
            else {
              console.log( '\t\tFixed basic SSL CN mismatch: ' + result );
              req_options[ 'uri' ] = 'https://' + result;
              make_request( req_options, 'HEAD', true );
            }
          } );
        }
        else {
          console.log( '\t\tStatus code 0' );
          console.log( '\t\t' + error.reason );
          req_options[ 'method' ] = 'GET';

          if ( retry ) {
            make_request( req_options, 'GET', false );
          }
        }
      }
      else {
        console.log( '\t\tRequest failed: ' + JSON.stringify( error ) );
      }
    }
    else {
      console.log( '\t\tStatus code returned:         ' + response.statusCode );
      console.log( '\t\tTotal response time:          ' + response.elapsedTime );

      if ( response.statusCode != 200 && retry ) {
        req_options[ 'method' ] = 'GET';
        make_request( req_options, 'GET', false );

      }
    }
    console.log( '\n' );
  } );
}

/*
 *  Checks for cases where SSL errors are occuring due to a simple common name mismatch
 *  (e.g www.url.com used but not in cert's altnames, but url.com is).
 *
 *  TL;DR - tries to gracefully handle www.url.com -> url.com and vice versa where appropriate
 *
 *  Returns:  correct url for retry or null
 */
function check_ssl_mismatch( uri, hostname, reason, callback ) {
  var alt_names = reason.split( 'DNS:' );
  var www_start = false;
  var www_rx = /www./g;
  hostname = hostname.slice( 0, -1 ); //removes the trailing .

  if ( alt_names.length == 0 ) {
    return callback( null, null );
  }

  www_start = www_rx.test( hostname );

  if ( www_start ) {
    hostname = hostname.split( 'www.' )[ 1 ];

    for ( var i = 1; i < alt_names.length; i++ ) {

      if ( alt_names[ i ] == hostname ) {
        uri = uri.split( 'www.' )[ 1 ];
        return callback( null, uri );
      }
    }
  }
  else {
    hostname = 'www.' + hostname;

    for ( var i = 1; i < alt_names.length; i++ ) {

      if ( alt_names[ i ] == hostname ) {
        uri = 'www.' + url;
        return callback( null, uri );
      }
    }
  }
  return callback( null, null );
}
