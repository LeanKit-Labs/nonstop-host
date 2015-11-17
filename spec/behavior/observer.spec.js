require( "../setup" );
var moment = require( "moment" );
var logFn = require( "../mockLog" )();

function emitter() {
	return {
		subscriptions: {
		},
		on: function( topic, handler ) {
			var handlers = this.subscriptions[ topic ];
			if ( !handlers ) {
				handlers = this.subscriptions[ topic ] = [];
			}
			handlers.push( handler );
		},
		emit: function( topic ) {
			var args = Array.prototype.slice.call( arguments, 1 );
			_.each( this.subscriptions[ topic ], function( handler ) {
				handler.apply( undefined, args );
			} );
		},
		clean: function() {
			this.subscriptions = {};
		},
		handle: function() {}
	};
}

describe( "Observer", function() {
	describe( "with subscriptions", function() {
		var control = emitter();
		var processhost = emitter();
		var server = emitter();
		var status;
		var observer;
		var log;

		before( function() {
			status = require( "../../src/status" );
			log = logFn( "nonstop.service-host" );
			observer = proxyquire( "../src/observer", {
				"./log": function() {
					return log;
				},
				"./status": status
			} )( control, server, processhost );
		} );

		it( "should create subscriptions to all control event topics", function() {
			_.keys( control.subscriptions )
				.should.eql(
					[
						"bootfile.error",
						"checkingForNew",
						"checkComplete",
						"checkFailed",
						"initializing",
						"loading",
						"prebooting",
						"preboot.error",
						"running",
						"running.error",
						"starting",
						"stopped",
						"timeout",
						"waiting"
					]
				);
		} );

		it( "should create subscriptions to all host event topics", function() {
			_.keys( processhost.subscriptions )
				.should.eql(
					[
						"hosted.started",
						"hosted.crashed",
						"hosted.failed"
					]
				);
		} );

		it( "should create subscriptions to all server event and activity topics", function() {
			_.keys( server.subscriptions )
				.should.eql(
					[
						"checkingForNew",
						"downloading",
						"installing",
						"waitingForNew",
						"waitingForConnection",
						"downloaded",
						"download.failed",
						"hasLatest",
						"hasNew",
						"installed",
						"install.failed",
						"noConnection",
						"noMatches",
						"server.stopped"
					]
				);
		} );

		describe( "with emitted events", function() {
			describe( "on bootfile error", function() {
				before( function() {
					control.emit( "bootfile.error", { version: "0.0.test", error: { test: "bad thing" } } );
				} );

				it( "should update status last event", function() {
					status.lastEvent.should.eql( { failed: { bootfile: { version: "0.0.test", error: { test: "bad thing" } } } } );
				} );

				it( "should log error", function() {
					log.entries.error.should.eql( [
						"Reading bootfile for 0.0.test failed with error: {\"test\":\"bad thing\"}"
					] );
				} );

				after( function() {
					status.lastEvent = undefined;
					log.entries.error = [];
				} );
			} );

			describe( "on checkComplete", function() {
				var now;
				before( function() {
					now = moment().utc().toString();
					control.emit( "checkComplete", { version: "0.0.test" } );
				} );

				it( "should update status lastCheck", function() {
					status.lastCheck.should.eql( { successOn: now } );
				} );

				after( function() {
					status.lastCheck = undefined;
				} );
			} );

			describe( "on checkFailed", function() {
				var now;
				before( function() {
					now = moment().utc().toString();
					control.emit( "checkFailed", { version: "0.0.test" } );
				} );

				it( "should update status lastCheck", function() {
					status.lastCheck.should.eql( { failedOn: now } );
				} );

				after( function() {
					status.lastCheck = undefined;
				} );
			} );

			describe( "on checkingForNew", function() {
				before( function() {
					control.emit( "checkingForNew" );
				} );

				it( "should log to debug", function() {
					log.entries.debug.should.eql(
						[
							"Checking for new version"
						]
					);
				} );

				after( function() {
					log.entries.debug = [];
				} );
			} );

			describe( "on downloaded", function() {
				before( function() {
					server.emit( "downloaded", {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "a1b2c3d4",
						version: "0.0.test",
						file: "test.tar.gz"
					} );
				} );

				it( "should update status last event", function() {
					status.lastEvent.should.eql( {
						downloaded: {
							branch: "branch",
							owner: "owner",
							project: "project",
							slug: "a1b2c3d4",
							version: "0.0.test"
						}
					} );
				} );

				it( "should log info", function() {
					log.entries.info.should.eql( [
						"Downloaded 'test.tar.gz' successfully"
					] );
				} );

				after( function() {
					status.lastEvent = undefined;
					log.entries.info = [];
				} );
			} );

			describe( "on downloading", function() {
				before( function() {
					server.emit( "downloading", {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "a1b2c3d4",
						version: "0.0.test",
						file: "test.tar.gz"
					} );
				} );

				it( "should update status activity", function() {
					status.activity.should.eql( { downloading: {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "a1b2c3d4",
						version: "0.0.test"
					} } );
				} );

				it( "should log info", function() {
					log.entries.info.should.eql( [
						"Downloading 'test.tar.gz'"
					] );
				} );

				after( function() {
					status.activity = undefined;
					log.entries.info = [];
				} );
			} );

			describe( "on download failed", function() {
				before( function() {
					server.emit( "download.failed", { version: "0.0.test", file: "test.tar.gz", error: { badThing: "some error" } } );
				} );

				it( "should update status last event", function() {
					status.lastEvent.should.eql( { failed: { download: "0.0.test" } } );
				} );

				it( "should log error", function() {
					log.entries.error.should.eql( [
						"Download of 'test.tar.gz' failed with error: {\"badThing\":\"some error\"}"
					] );
				} );

				after( function() {
					status.activity = undefined;
					log.entries.error = [];
				} );
			} );

			describe( "on hosted crashed", function() {
				before( function() {
					processhost.emit( "hosted.crashed", { sad: ":(" } );
				} );

				it( "should update status last event", function() {
					status.lastEvent.should.eql( { crashed: { sad: ":(" } } );
				} );

				it( "should record stop", function() {
					status.serviceUptime.should.eql( "0 seconds" );
				} );

				it( "should log warning", function() {
					log.entries.warn.should.eql( [
						"Service crashed: {\"sad\":\":(\"}"
					] );
				} );

				after( function() {
					status.lastEvent = undefined;
					log.entries.warn = [];
				} );
			} );

			describe( "on hosted failed", function() {
				before( function() {
					processhost.emit( "hosted.failed", { sad: ":(" } );
				} );

				it( "should update status last event", function() {
					status.lastEvent.should.eql( { failed: { service: { sad: ":(" } } } );
				} );

				it( "should record stop", function() {
					status.serviceUptime.should.eql( "0 seconds" );
				} );

				it( "should log warning", function() {
					log.entries.error.should.eql( [
						"Service failed past allowed tolerance: {\"sad\":\":(\"}"
					] );
				} );

				after( function() {
					status.lastEvent = undefined;
					log.entries.error = [];
				} );
			} );

			describe( "on hosted started", function() {
				before( function( done ) {
					processhost.emit( "hosted.started", { yay: ":D", version: "0.0.test" } );
					setTimeout( function() {
						done();
					}, 10 );
				} );

				it( "should update status last event", function() {
					status.lastEvent.should.eql( { started: { version: "0.0.test" } } );
				} );

				it( "should record start", function() {
					status.serviceUptime.should.not.equal( "0 seconds" );
				} );

				it( "should log info", function() {
					log.entries.info.should.eql( [
						"Started service: {\"yay\":\":D\",\"version\":\"0.0.test\"}"
					] );
				} );

				after( function() {
					status.lastEvent = undefined;
					log.entries.info = [];
				} );
			} );

			describe( "on installed", function() {
				before( function() {
					server.emit( "installed", {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "a1b2c3d4",
						version: "0.0.test",
						file: "test.tar.gz"
					} );
				} );

				it( "should update status last event", function() {
					status.lastEvent.should.eql( { installed: {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "a1b2c3d4",
						version: "0.0.test"
					} } );
				} );

				it( "should log info", function() {
					log.entries.info.should.eql( [
						"Installed 'test.tar.gz' successfully"
					] );
				} );

				it( "should update status installed", function() {
					status.latestInstall.should.eql( {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "a1b2c3d4",
						version: "0.0.test"
					} );
				} );

				after( function() {
					status.lastEvent = undefined;
					log.entries.info = [];
					status.latestInstall = undefined;
				} );
			} );

			describe( "on installing", function() {
				before( function() {
					server.emit( "installing", {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "a1b2c3d4",
						version: "0.0.test",
						file: "test.tar.gz"
					} );
				} );

				it( "should update status activity", function() {
					status.activity.should.eql( { installing: {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "a1b2c3d4",
						version: "0.0.test" }
					} );
				} );

				it( "should log info", function() {
					log.entries.info.should.eql( [
						"Installing 'test.tar.gz'"
					] );
				} );

				after( function() {
					status.activity = undefined;
					log.entries.info = [];
				} );
			} );

			describe( "on install failed", function() {
				before( function() {
					server.emit( "install.failed", {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "a1b2c3d4",
						version: "0.0.test",
						file: "test.tar.gz",
						error: new Error( "bad thing" ) }
					);
				} );

				it( "should update status last event", function() {
					status.lastEvent.should.eql( { failed: {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "a1b2c3d4",
						version: "0.0.test"
					} } );
				} );

				it( "should log error", function() {
					log.entries.error.should.eql( [
						"Install of 'test.tar.gz' failed with Error: bad thing"
					] );
				} );

				after( function() {
					status.activity = undefined;
					log.entries.error = [];
				} );
			} );

			describe( "on loading", function() {
				before( function() {
					control.emit( "loading", {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "a1b2c3d4",
						version: "0.0.test",
						file: "test.tar.gz"
					} );
				} );

				it( "should update status activity", function() {
					status.activity.should.eql( { loading: {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "a1b2c3d4",
						version: "0.0.test"
					} } );
				} );

				it( "should log info", function() {
					log.entries.info.should.eql( [
						"Loading version '0.0.test'"
					] );
				} );

				after( function() {
					status.activity = undefined;
					log.entries.info = [];
				} );
			} );

			describe( "on prebooting", function() {
				before( function() {
					control.emit( "prebooting", { version: "0.0.test", file: "test.tar.gz" } );
				} );

				it( "should update status activity", function() {
					status.activity.should.eql( { prebooting: { version: "0.0.test" } } );
				} );

				it( "should log info", function() {
					log.entries.info.should.eql( [
						"Prebooting version '0.0.test'"
					] );
				} );

				after( function() {
					status.activity = undefined;
					log.entries.info = [];
				} );
			} );

			describe( "on preboot error", function() {
				before( function() {
					control.emit( "preboot.error", { version: "0.0.test", error: ";(" } );
				} );

				it( "should update last event", function() {
					status.lastEvent.should.eql( { failed: { preboot: { version: "0.0.test", error: ";(" } } } );
				} );

				it( "should log error", function() {
					log.entries.error.should.eql( [
						"Preboot for version '0.0.test' failed with error: \";(\""
					] );
				} );

				after( function() {
					status.lastEvent = undefined;
					log.entries.error = [];
				} );
			} );

			describe( "on running", function() {
				before( function() {
					control.emit( "running", {
						branch: "branch",
						owner: "owner",
						project: "project",
						version: "0.0.test",
						file: "test.tar.gz",
						slug: "abcdef123" } );
				} );

				it( "should update status activity", function() {
					status.activity.should.eql( { running: {
						branch: "branch",
						owner: "owner",
						project: "project",
						version: "0.0.test",
						slug: "abcdef123"
					} } );
				} );

				it( "should log info", function() {
					log.entries.info.should.eql( [
						"Running version '0.0.test'"
					] );
				} );

				it( "should update status running", function() {
					status.lastRun.should.eql( {
						branch: "branch",
						owner: "owner",
						project: "project",
						version: "0.0.test",
						slug: "abcdef123"
					} );
				} );

				after( function() {
					status.activity = undefined;
					status.running = undefined;
					log.entries.info = [];
				} );
			} );

			describe( "on starting", function() {
				before( function() {
					control.emit( "starting", {
						branch: "branch",
						owner: "owner",
						project: "project",
						version: "0.0.test",
						file: "test.tar.gz",
						slug: "abcdef123"
					} );
				} );

				it( "should update status activity", function() {
					status.activity.should.eql( { starting: {
						branch: "branch",
						owner: "owner",
						project: "project",
						slug: "abcdef123",
						version: "0.0.test"
					} } );
				} );

				it( "should log info", function() {
					log.entries.info.should.eql( [
						"Starting version '0.0.test'"
					] );
				} );

				after( function() {
					status.activity = undefined;
					log.entries.info = [];
				} );
			} );

			describe( "on stopped", function() {
				before( function() {
					control.emit( "stopped", { version: "0.0.test", file: "test.tar.gz", slug: "abcdef123" } );
				} );

				it( "should update status activity", function() {
					should.not.exist( status.activity );
				} );

				it( "should update status last event", function() {
					status.lastEvent.should.eql( { stopped: {} } );
				} );

				it( "should log info", function() {
					log.entries.info.should.eql( [
						"Hosted service and all activity has stopped"
					] );
				} );

				after( function() {
					status.activity = undefined;
					status.lastEvent = undefined;
					log.entries.info = [];
				} );
			} );

			describe( "on timeout", function() {
				before( function() {
					status.activity = { stuff: "and such" };
					control.emit( "timeout", {} );
				} );

				it( "should update status last event", function() {
					status.lastEvent.should.eql( { timeout: {} } );
				} );

				it( "should log warning", function() {
					log.entries.warn.should.eql( [
						"The server timed out on the previous operation ({\"stuff\":\"and such\"}). This is not good. Re-initializing control state machine."
					] );
				} );

				after( function() {
					status.activity = undefined;
					status.lastEvent = undefined;
					log.entries.info = [];
				} );
			} );

			describe( "on waiting", function() {
				before( function() {
					control.emit( "waiting", {} );
				} );

				it( "should update status activity", function() {
					status.activity.should.eql( { waiting: {} } );
				} );

				it( "should log debug", function() {
					log.entries.debug.should.eql( [
						"Waiting"
					] );
				} );

				after( function() {
					status.activity = undefined;
					log.entries.debug = [];
				} );
			} );

			describe( "on waiting for new", function() {
				before( function() {
					server.emit( "waitingForNew", { duration: 100 } );
				} );

				it( "should log debug", function() {
					log.entries.debug.should.eql( [
						"Checking for new in 100 ms"
					] );
				} );

				after( function() {
					log.entries.debug = [];
				} );
			} );

			describe( "on waiting for connection", function() {
				before( function() {
					server.emit( "waitingForConnection", { duration: 100 } );
				} );

				it( "should log debug", function() {
					log.entries.debug.should.eql( [
						"Retrying connection to index in 100 ms"
					] );
				} );

				after( function() {
					log.entries.debug = [];
				} );
			} );
		} );
	} );
} );
