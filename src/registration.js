var halon = require( "halon" );
var request = require( "request" );
var registryClient, connection;
var when = require( "when" );
var log = require( "./log" )( "nonstop.service-host" );

function buildRootUrl( cfg ) {
	return [
		( cfg.ssl ? "https" : "http" ),
		"://",
		cfg.host,
		":",
		cfg.port,
		cfg.api
	].join( "" );
}

function checkClient( config ) {
	if ( !registryClient ) {
		var opts = {
			root: buildRootUrl( config.index ),
			adapter: halon.requestAdapter( request )
		};
		if ( config.index.token ) {
			opts.headers = {
				authorization: "Bearer " + config.index.token
			};
		}
		registryClient = halon( opts );
		connection = when.promise( function( resolve ) {
			registryClient
				.on( "ready", function( client ) {
					resolve( client );
				} )
				.on( "rejected", function( client, err ) {
					log.error( "Failed to connect to registry", err );
					setTimeout( function() {
						client.connect();
					}, config.index.frequency );
				}, true )
				.connect()
				.then( null, function() {
					// this is here to prevent obnoxious
					// potentially unahandled rejection
					// notices
				} );
		} );
	}
}

function createHook( config ) {
	var ip = config.service.host.ip || config.service.host.name;
	var port = config.service.port.public;
	var url = "/api/package";
	var id = [ config.service.host.name, port ].join( ":" );
	var fullUrl = "http://" + ip + ":" + port + url;
	checkClient( config );
	return connection
		.then( function( client ) {
			return client.hook.self( { id: id } )
				.then( function() {
					return true;
				}, function() {
					return client.hook.add( {
						id: id,
						url: fullUrl,
						method: "POST",
						headers: {},
						events: [ "package.#" ]
					} );
				} );
		} );
}

function getSettings( config ) {
	return {
		serviceHost: config.service,
		package: config.filter.toHash(),
		index: config.index
	};
}

function register( config ) {
	checkClient( config );
	return connection
		.then( function( client ) {
			return client.host.register( getSettings( config ) );
		} );
}

function reset() {
	registryClient = null;
	connection = null;
}

function notify( config, topic, message ) {
	if ( topic && message ) {
		checkClient( config );
		return connection
			.then(
				function( client ) {
					message.topic = topic;
					message.name = config.service.name;
					return client.host.notify( message );
				},
				function( err ) {
					log.warn( "Could not publish notification to the registry: %s", err.stack );
				} );
	}
}

module.exports = function( config ) {
	var api = {
		createHook: createHook.bind( undefined, config ),
		notify: notify.bind( undefined, config ),
		register: register.bind( undefined, config ),
		reset: reset
	};
	return api;
};
