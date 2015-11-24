var configFn = require( "./config" );
var drudgeon = require( "drudgeon" );
var fount = require( "fount" );
var autohost = require( "autohost" );
var hyped = require( "hyped" )();
var fs = require( "./fs" );
var path = require( "path" );
var fsm = require( "./fsm" );
var packagesFn = require( "./packages" );
var serverFn = require( "./serverFsm" );
var controlFn = require( "./control" );
var registryFn = require( "./registration" );
var postal = require( "postal" );
var notifications = postal.channel( "notifications" );
var observe = require( "./observer" );

module.exports = function( customConfig ) {
	var status = require( "./status" );
	var config = configFn( customConfig );

	require( "./log" )( {
		adapters: config.logging
	} );

	var packages = packagesFn( config, fs );
	var processhost = require( "processhost" )();
	var server = serverFn( config, packages );
	var registry = registryFn( config );

	registry.register();
	registry.createHook();

	notifications.subscribe( "#", function( msg, env ) {
		if ( msg && env.topic ) {
			var message = {
				topic: env.topic,
				event: msg,
				host: config.service,
				config: config.package
			};
			registry.notify( env.topic, message );
		}
	} );

	var main = fsm( config, server, packages, processhost, drudgeon, fs );
	var control = controlFn( config, main );
	fount.register( "fsm", main );
	fount.register( "control", control );
	fount.register( "status", status );
	fount.register( "config", config );
	fount.register( "packages", packages );
	fount.register( "server", server );
	observe( main, server, processhost, packages );
	server.start();

	var host = hyped.createHost( autohost, {
		port: config.service.port.local,
		fount: fount,
		noSession: true,
		resources: path.resolve( __dirname, "../resource" )
	}, function() {
		host.start();
	} );
	return main;
};
