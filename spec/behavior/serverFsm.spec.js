require( "../setup" );
var fsmFn = require( "../../src/serverFsm.js" );
var config = require( "../../src/config.js" )( {
	index: {
		frequency: 100
	},
	package: {
		project: "test",
		owner: "me",
		branch: "master",
		files: "./downloads"
	}
} );

describe( "Server FSM", function() {
	var packages = {
		download: _.noop,
		getAvailable: _.noop,
		ignoreVersion: _.noop,
		install: _.noop,
		hasLatestAvailable: _.noop,
		state: {
			current: {

			}
		}
	};
	var packagesMock;

	describe( "when checking for new packages", function() {
		describe( "and no connection can be made", function() {
			var error, wait;
			before( function( done ) {
				packagesMock = sinon.mock( packages );
				packagesMock.expects( "getAvailable" )
					.rejects( new Error( "no connection" ) );
				var fsm = fsmFn( config, packages );
				var failHandle, waitHandle;

				waitHandle = fsm.on( "waitingForConnection", function( info ) {
					wait = info;
					fsm.off( waitHandle );
					process.nextTick( function() {
						fsm.stop();
					} );
					done();
				} );

				failHandle = fsm.on( "noConnection", function( err ) {
					error = err;
					fsm.off( failHandle );
				} );

				fsm.start();
			} );

			it( "should emit noConnection with error", function() {
				error.message.should.eql( "no connection" );
			} );

			it( "should move to failed state and wait for connection", function() {
				wait.should.eql( { duration: 100 } );
			} );

			it( "should have called packages getAvailable", function() {
				packagesMock.verify();
			} );

			after( function() {
				packages.state.current.installedVersion = undefined;
			} );
		} );

		describe( "and no packages are available", function() {
			var filter, wait;
			before( function( done ) {
				packagesMock = sinon.mock( packages );
				packagesMock.expects( "getAvailable" )
					.resolves( undefined );

				var fsm = fsmFn( config, packages );
				var failHandle, waitHandle;

				waitHandle = fsm.on( "waitingForNew", function( info ) {
					wait = info;
					fsm.off( waitHandle );
					process.nextTick( function() {
						fsm.stop();
					} );
					done();
				} );

				failHandle = fsm.on( "noMatches", function( info ) {
					filter = info;
					fsm.off( failHandle );
				} );

				fsm.start();
			} );

			it( "should emit noMatches with filter info", function() {
				filter.should.eql( {
					architecture: "x64",
					branch: "master",
					osName: "any",
					osVersion: "any",
					owner: "me",
					platform: "darwin",
					project: "test"
				} );
			} );

			it( "should move to waiting state and wait for next check", function() {
				wait.should.eql( { duration: 100 } );
			} );

			it( "should have called packages getAvailable", function() {
				packagesMock.verify();
			} );

			after( function() {
				packages.state.current.installedVersion = undefined;
			} );
		} );

		describe( "and no new packages are available", function() {
			var latest, wait;
			before( function( done ) {
				packagesMock = sinon.mock( packages );
				packagesMock.expects( "getAvailable" )
					.resolves( "0.1.0" );
				packagesMock.expects( "hasLatestAvailable" )
					.returns( true );

				var fsm = fsmFn( config, packages );
				var checkHandle, waitHandle;

				waitHandle = fsm.on( "waitingForNew", function( info ) {
					wait = info;
					fsm.off( waitHandle );
					process.nextTick( function() {
						fsm.stop();
					} );
					done();
				} );

				checkHandle = fsm.on( "hasLatest", function( info ) {
					latest = info;
					fsm.off( checkHandle );
				} );

				fsm.start();
			} );

			it( "should emit noMatches with filter info", function() {
				latest.should.eql( "0.1.0" );
			} );

			it( "should move to waiting state and wait for next check", function() {
				wait.should.eql( { duration: 100 } );
			} );

			it( "should have called packages getAvailable", function() {
				packagesMock.verify();
			} );

			after( function() {
				packages.state.current.installedVersion = undefined;
			} );
		} );

		describe( "and a new package is available", function() {
			var latest, download;
			before( function( done ) {
				packagesMock = sinon.mock( packages );
				packagesMock.expects( "getAvailable" )
					.resolves( "0.1.0" );
				packagesMock.expects( "hasLatestAvailable" )
					.returns( false );
				packagesMock.expects( "download" )
					.returns( when.defer() );

				var fsm = fsmFn( config, packages );
				var checkHandle, downloadHandle;

				downloadHandle = fsm.on( "downloading", function( info ) {
					download = info;
					fsm.off( downloadHandle );
					process.nextTick( function() {
						fsm.stop();
					} );
					done();
				} );

				checkHandle = fsm.on( "hasNew", function( info ) {
					latest = info;
					fsm.off( checkHandle );
				} );

				fsm.start();
			} );

			it( "should emit noMatches with filter info", function() {
				latest.should.eql( "0.1.0" );
			} );

			it( "should move to downloading state", function() {
				download.should.eql( "0.1.0" );
			} );

			it( "should have called packages getAvailable, hasLatestAvailable and download", function() {
				packagesMock.verify();
			} );

			after( function() {
				packages.state.current.installedVersion = undefined;
			} );
		} );
	} );

	describe( "when downloading a new package", function() {
		describe( "and download succeeds", function() {
			var downloading, downloaded, installing, newest;
			before( function( done ) {
				var fsm = fsmFn( config, packages );
				newest = { version: "0.1.1", file: "file.tar.gz;" };
				fsm.newest = newest;

				packagesMock = sinon.mock( packages );
				packagesMock.expects( "download" )
					.resolves( fsm.newest );
				packagesMock.expects( "install" )
					.returns( when.defer() );

				var downloadedHandle, downloadHandle, installingHandle;
				installingHandle = fsm.on( "installing", function( info ) {
					installing = info;
					fsm.off( installingHandle );
					process.nextTick( function() {
						fsm.stop();
					} );
					done();
				} );

				downloadHandle = fsm.on( "downloading", function( info ) {
					downloading = info;
					fsm.off( downloadHandle );
				} );

				downloadedHandle = fsm.on( "downloaded", function( info ) {
					downloaded = info;
					fsm.off( downloadedHandle );
				} );

				fsm.transition( "downloading" );
			} );

			it( "should emit downloading with package info", function() {
				downloading.should.eql( newest );
			} );

			it( "should emit downloaded with package info", function() {
				downloading.should.eql( newest );
			} );

			it( "should move to installing state", function() {
				installing.should.eql( newest );
			} );

			it( "should have called packages download and install", function() {
				packagesMock.verify();
			} );

			after( function() {
				packages.state.current.installedVersion = undefined;
			} );
		} );

		describe( "and download fails", function() {
			var wait, failure, newest;
			before( function( done ) {
				var fsm = fsmFn( config, packages );
				newest = { version: "0.1.1", file: "file.tar.gz;" };
				fsm.newest = newest;

				packagesMock = sinon.mock( packages );
				packagesMock.expects( "download" )
					.rejects( new Error( "download failed" ) );

				var waitHandle, failHandle;

				waitHandle = fsm.on( "waitingForNew", function( info ) {
					wait = info;
					fsm.off( waitHandle );
					process.nextTick( function() {
						fsm.stop();
					} );
					done();
				} );

				failHandle = fsm.on( "download.failed", function( err ) {
					failure = err;
					fsm.off( failHandle );
				} );

				fsm.transition( "downloading" );
			} );

			it( "should emit download failed", function() {
				failure.error.message.should.eql( "download failed" );
			} );

			it( "should move to waiting state", function() {
				wait.should.eql( { duration: 100 } );
			} );

			it( "should have called packages download", function() {
				packagesMock.verify();
			} );

			after( function() {
				packages.state.current.installedVersion = undefined;
			} );
		} );
	} );

	describe( "when installing a new package", function() {
		describe( "and install succeeds", function() {
			var installing, installed, newest;
			before( function( done ) {
				var fsm = fsmFn( config, packages );
				newest = { version: "0.1.1", file: "file.tar.gz;" };
				fsm.newest = newest;

				packagesMock = sinon.mock( packages );
				packagesMock.expects( "install" )
					.resolves( fsm.newest );

				var installedHandle, installHandle, waitingHandle;
				waitingHandle = fsm.on( "waitingForNew", function() {
					process.nextTick( function() {
						fsm.stop();
					} );
					fsm.off( waitingHandle );
					done();
				} );

				installHandle = fsm.on( "installing", function( info ) {
					installing = info;
					fsm.off( installHandle );
				} );

				installedHandle = fsm.on( "installed", function( info ) {
					installed = info;
					fsm.off( installedHandle );
				} );

				fsm.transition( "installing" );
			} );

			it( "should emit installing with package info", function() {
				installing.should.eql( newest );
			} );

			it( "should emit installed with package info", function() {
				installing.should.eql( newest );
			} );

			it( "should move to installing state", function() {
				installing.should.eql( newest );
			} );

			it( "should have called packages install and install", function() {
				packagesMock.verify();
			} );

			after( function() {
				packages.state.current.installedVersion = undefined;
			} );
		} );

		describe( "and install fails", function() {
			var installing, failure, newest, wait;
			before( function( done ) {
				var fsm = fsmFn( config, packages );
				newest = { version: "0.1.1", file: "file.tar.gz;" };
				fsm.newest = newest;

				packagesMock = sinon.mock( packages );
				packagesMock.expects( "install" )
					.rejects( new Error( "install failed" ) );

				var installedHandle, installHandle, waitingHandle;
				waitingHandle = fsm.on( "waitingForNew", function( info ) {
					process.nextTick( function() {
						fsm.stop();
					} );
					wait = info;
					fsm.off( waitingHandle );
					done();
				} );

				installHandle = fsm.on( "installing", function( info ) {
					installing = info;
					fsm.off( installHandle );
				} );

				installedHandle = fsm.on( "install.failed", function( info ) {
					failure = info;
					fsm.off( installedHandle );
				} );

				fsm.transition( "installing" );
			} );

			it( "should emit installing with package info", function() {
				installing.should.eql( newest );
			} );

			it( "should emit install failed with package info", function() {
				failure.error.message.should.eql( "install failed" );
			} );

			it( "should move to waiting state", function() {
				wait.should.eql( { duration: 100 } );
			} );

			it( "should have called packages install", function() {
				packagesMock.verify();
			} );

			after( function() {
				packages.state.current.installedVersion = undefined;
			} );
		} );
	} );
} );
