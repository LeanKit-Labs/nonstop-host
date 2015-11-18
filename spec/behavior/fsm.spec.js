require( "../setup" );
var fsmFn = require( "../../src/fsm.js" );
var config = require( "../../src/config.js" )( {
	index: {
		frequency: 100
	},
	package: { // jshint ignore : line
		branch: "master",
		owner: "me",
		project: "test"
	}
} );

describe( "FSM", function() {
	var server = {
		start: function() {
			this.started = true;
			this.raise( "started" );
		},
		stop: function() {
		},
		reset: function() {
			this.wasReset = true;
		},
		subscriptions: {},
		clear: function() {
			this.wasReset = false;
			this.started = false;
			this.subscriptions = {};
		},
		download: function() {
			this.raise( "downloaded" );
		},
		install: function() {
			this.raise( "installed" );
		},
		on: function( topic, handle ) {
			var subscriptions = this.subscriptions[ topic ];
			subscriptions = subscriptions || [];
			subscriptions.push( handle );
			this.subscriptions[ topic ] = subscriptions;
		},
		raise: function( ev ) {
			var args = Array.prototype.slice.call( arguments, 1 );
			_.each( this.subscriptions[ ev ], function( sub ) {
				sub.apply( undefined, args );
			} );
		}
	};
	var pack = {
		getNextStep: _.noop,
		initialize: _.noop,
		loadBootFile: _.noop,
		ignoreVersion: _.noop,
		reset: _.noop,
		updateConfig: _.noop,
		state: {
			current: {},
			latest: {}
		}
	};

	var processhost = {
		started: {},
		failed: {},
		stopped: false,
		subscriptions: {},
		clear: function() {
			this.started = {};
			this.subscriptions = {};
			this.stopped = false;
		},
		on: function( topic, handle ) {
			this.subscriptions[ topic ] = handle;
		},
		fail: function( alias, err ) {
			this.failed[ alias ] = true;
			var handle = this.subscriptions[ alias + ".failed" ];
			if ( handle ) {
				handle( err );
			}
		},
		create: function( alias, cfg ) {
			this.started[ alias ] = cfg;
		},
		start: function( alias ) {
			var handle = this.subscriptions[ alias + ".started" ];
			if ( handle ) {
				handle();
			}
		},
		stop: function() {
			this.stopped = true;
		}
	};

	var fsm, packMock;

	describe( "when initializing", function() {
		describe( "when next step is wait (no downloads or installs)", function() {
			var lastState;
			before( function( done ) {
				packMock = sinon.mock( pack );
				var initialize = packMock.expects( "initialize" );
				initialize.resolves( "wait" );

				fsm = fsmFn( config, server, pack, processhost, {} );
				var waitingHandle;
				waitingHandle = fsm.on( "waiting", function() {
					// prevent the timeout in waiting from firing
					process.nextTick( function() {
						lastState = fsm.state;
						fsm.off( waitingHandle );
						fsm.stop();
						done();
					} );
				} );
			} );

			it( "should resolve to waiting state", function() {
				lastState.should.equal( "waiting" );
			} );

			it( "should call packages initialize", function() {
				packMock.verify();
			} );

			after( function() {
				packMock.restore();
			} );
		} );

		describe( "when next step is download (no downloads or installs)", function() {
			var lastState, serverMock;
			before( function( done ) {
				pack.state.current.installedVersion = "0.1.0";
				packMock = sinon.mock( pack );
				var initialize = packMock.expects( "initialize" );
				var loadBootFile = packMock.expects( "loadBootFile" );
				initialize.resolves( "download" );
				loadBootFile.returns( { then: _.noop } );

				serverMock = sinon.mock( server );
				serverMock.expects( "download" );

				fsm = fsmFn( config, server, pack, processhost, {} );
				var loadingHandle;
				loadingHandle = fsm.on( "loading", function() {
					lastState = fsm.state;
					fsm.off( loadingHandle );
					fsm.stop();
					done();
				} );

				setTimeout( function() {
					fsm.handle( "installed" );
				}, 10 );
			} );

			it( "should call server download", function() {
				serverMock.verify();
			} );

			it( "should resolve to a loading state", function() {
				lastState.should.equal( "loading" );
			} );

			it( "should call packages loadBootFile", function() {
				packMock.verify();
			} );

			after( function() {
				packMock.restore();
			} );
		} );

		describe( "when next step is install (local download, not installed yet)", function() {
			var lastState, serverMock;
			before( function( done ) {
				pack.state.current.installedVersion = "0.1.0";
				packMock = sinon.mock( pack );
				var initialize = packMock.expects( "initialize" );
				var loadBootFile = packMock.expects( "loadBootFile" );
				initialize.resolves( "install" );
				loadBootFile.returns( { then: _.noop } );

				serverMock = sinon.mock( server );
				serverMock.expects( "install" );

				var loadingHandle;
				fsm = fsmFn( config, server, pack, processhost, {} );
				loadingHandle = fsm.on( "loading", function() {
					lastState = fsm.state;
					fsm.off( loadingHandle );
					fsm.stop();
					done();
				} );

				setTimeout( function() {
					fsm.handle( "installed" );
				}, 10 );
			} );

			it( "should call server install", function() {
				serverMock.verify();
			} );

			it( "should resolve to loading state", function() {
				lastState.should.equal( "loading" );
			} );

			it( "should call packages loadBootFile", function() {
				packMock.verify();
			} );

			after( function() {
				packMock.restore();
			} );
		} );

		describe( "when next step is load (version is installed already)", function() {
			var lastState, prebooted, loaded, started, running, runner;
			var bootFile, drudgeonMock, runnerMock;

			before( function( done ) {
				bootFile = {
					preboot: {
						command: "gulp",
						arguments: [],
						path: "./"
					},
					boot: {
						command: "node",
						arguments: [ "index.js" ],
						path: "./"
					}
				};

				var installedPath = path.resolve(
					"./installs",
					[ config.package.project, config.package.owner, config.package.branch ].join( "-" ),
					"0.1.0"
				);

				pack.state = {
					current: {
						installedPath: installedPath,
						installedVersion: "0.1.0",
						installedInfo: {
							owner: "me",
							project: "test",
							branch: "master",
							version: "0.1.0",
							slug: "a1b2c3d4"
						},
						slug: "a1b2c3d4"
					},
					latest: {}
				};

				runner = { run: _.noop };
				runnerMock = sinon.mock( runner );
				runnerMock.expects( "run" )
					.resolves( {} );

				drudgeonMock = sinon.mock();
				drudgeonMock
					.withArgs( bootFile.preboot, {
						platform: config.package.platform,
						relativePath: installedPath
					} ).returns( runner );

				packMock = sinon.mock( pack );
				var initialize = packMock.expects( "initialize" );
				var loadBootFile = packMock.expects( "loadBootFile" );

				initialize.resolves( "load" );
				loadBootFile.resolves( bootFile );

				processhost.on( "hosted.started", function() {
					fsm.handle( "hosted.started" );
				} );

				fsm = fsmFn( config, server, pack, processhost, drudgeonMock );
				var loadingHandle, prebootingHandle, startingHandle, runningHandle;

				loadingHandle = fsm.on( "loading", function( loadingInfo ) {
					loaded = loadingInfo;
					fsm.off( loadingHandle );
				} );

				prebootingHandle = fsm.on( "prebooting", function( prebootInfo ) {
					prebooted = prebootInfo;
					fsm.off( prebootingHandle );
				} );

				startingHandle = fsm.on( "starting", function( startingInfo ) {
					started = startingInfo;
					fsm.off( startingHandle );
				} );

				runningHandle = fsm.on( "running", function( runningInfo ) {
					running = runningInfo;
					fsm.off( runningHandle );
					lastState = fsm.state;
					fsm.stop();
					done();
				} );
			} );

			it( "should run the preboot commands", function() {
				prebooted.version.should.equal( "0.1.0" );
			} );

			it( "should start the installed version", function() {
				started.version.should.equal( "0.1.0" );
			} );

			it( "should provide package info on event", function() {
				running.should.eql(
					{
						owner: "me",
						project: "test",
						branch: "master",
						slug: "a1b2c3d4",
						version: "0.1.0"
					}
				);
			} );

			it( "should end in running state", function() {
				lastState.should.equal( "running" );
			} );

			it( "should call packages loadBootFile", function() {
				packMock.verify();
			} );

			after( function() {
				packMock.restore();
				processhost.clear();
				server.clear();
			} );
		} );
	} );

	describe( "when loading with error loading bootfile", function() {
		var lastState, failure;
		before( function( done ) {
			pack.state = {
				current: {},
				latest: {
					install: {
						owner: "me",
						project: "test",
						branch: "master",
						version: "0.1.0",
						slug: "a1b2c3d4"
					}
				}
			};
			packMock = sinon.mock( pack );
			var initialize = packMock.expects( "initialize" );
			var loadBootFile = packMock.expects( "loadBootFile" );
			packMock.expects( "ignoreVersion" ).once();
			initialize.twice().returns( { then: _.noop } );
			loadBootFile.rejects( new Error( "Ain't no bootfile. Ain't never gonna be none." ) );
			fsm = fsmFn( config, server, pack, processhost, {} );
			fsm.transition( "loading" );
			var initializingHandle, failedHandle;
			failedHandle = fsm.on( "bootfile.error", function( details ) {
				failure = details;
				fsm.off( failedHandle );
			} );
			initializingHandle = fsm.on( "initializing", function() {
				lastState = fsm.state;
				fsm.off( initializingHandle );
				fsm.stop();
				done();
			} );
		} );

		it( "should reinitialize after failure", function() {
			lastState.should.equal( "initializing" );
		} );

		it( "should emit bootfile.error with error", function() {
			failure.should.eql( {
				owner: "me",
				project: "test",
				branch: "master",
				version: "0.1.0",
				slug: "a1b2c3d4",
				error: new Error( "Ain't no bootfile. Ain't never gonna be none." )
			} );
		} );

		it( "should call packages initialize twice and version failed once", function() {
			packMock.verify();
		} );

		after( function() {
			packMock.restore();
		} );
	} );

	describe( "when prebooting with error during preboot", function() {
		var lastState, failure, runner;
		var bootFile, drudgeonMock, runnerMock;
		before( function( done ) {
			bootFile = {
				preboot: {
					command: "gulp",
					arguments: [],
					path: "./"
				},
				boot: {
					command: "node",
					arguments: [ "index.js" ],
					path: "./"
				}
			};

			var installedPath = path.resolve(
				"./installs",
				[ config.package.project, config.package.owner, config.package.branch ].join( "-" ),
				"0.1.0"
			);

			pack.state = {
				current: {
					installedVersion: "0.1.0",
					installedPath: installedPath,
					installedInfo: {
						owner: "me",
						project: "test",
						branch: "master",
						version: "0.1.0",
						slug: "a1b2c3d4"
					}
				},
				latest: {}
			};

			packMock = sinon.mock( pack );
			var initialize = packMock.expects( "initialize" );
			var loadBootFile = packMock.expects( "loadBootFile" );
			packMock.expects( "ignoreVersion" ).once();
			initialize.twice().returns( { then: _.noop } );
			loadBootFile.resolves( bootFile );

			runner = { run: _.noop };
			runnerMock = sinon.mock( runner );
			runnerMock.expects( "run" )
				.rejects( new Error( "Preboot failed so hard. So. Hard." ) );

			drudgeonMock = sinon.mock();
			drudgeonMock
				.withArgs( bootFile.preboot, {
					platform: config.package.platform,
					relativePath: installedPath
				} ).returns( runner );

			fsm = fsmFn( config, server, pack, processhost, drudgeonMock );
			fsm.transition( "loading" );
			var initializingHandle, failedHandle;
			failedHandle = fsm.on( "preboot.error", function( details ) {
				failure = details;
				fsm.off( failedHandle );
			} );
			initializingHandle = fsm.on( "initializing", function() {
				lastState = fsm.state;
				fsm.off( initializingHandle );
				fsm.stop();
				done();
			} );
		} );

		it( "should reinitialize after failure", function() {
			lastState.should.equal( "initializing" );
		} );

		it( "should emit preboot.error with error", function() {
			failure.should.eql( {
				owner: "me",
				project: "test",
				branch: "master",
				version: "0.1.0",
				slug: "a1b2c3d4",
				error: new Error( "Preboot failed so hard. So. Hard." )
			} );
		} );

		it( "should call packages initialize twice and version failed once", function() {
			packMock.verify();
		} );

		after( function() {
			packMock.restore();
		} );
	} );

	describe( "when starting and hosted service fails", function() {
		var lastState, failure, bootFile;
		before( function( done ) {
			bootFile = {
				preboot: {
					command: "gulp",
					arguments: [],
					path: "./"
				},
				boot: {
					command: "node",
					arguments: [ "index.js" ],
					path: "./"
				}
			};

			var installedPath = path.resolve(
					"./installs",
					[ config.package.project, config.package.owner, config.package.branch ].join( "-" ),
					"0.1.0"
				);

			pack.state = {
				current: {
					installedPath: installedPath,
					installedVersion: "0.1.0",
					installedInfo: {
						owner: "me",
						project: "test",
						branch: "master",
						version: "0.1.0",
						slug: "a1b2c3d4"
					}
				},
				latest: {
					installed: {
						owner: "me",
						project: "test",
						branch: "master",
						version: "0.1.0",
						slug: "a1b2c3d4"
					}
				}
			};

			packMock = sinon.mock( pack );
			var initialize = packMock.expects( "initialize" );
			packMock.expects( "ignoreVersion" ).once();
			initialize.twice().returns( { then: _.noop } );

			fsm = fsmFn( config, server, pack, processhost, {} );
			fsm.bootFile = bootFile;
			processhost.on( "hosted.failed", function( err ) {
				fsm.handle( "hosted.failed", err );
			} );
			fsm.transition( "starting" );
			var initializingHandle, failedHandle;
			failedHandle = fsm.on( "start.error", function( details ) {
				failure = details;
				fsm.off( failedHandle );
			} );
			initializingHandle = fsm.on( "initializing", function() {
				lastState = fsm.state;
				fsm.off( initializingHandle );
				fsm.stop();
				done();
			} );
			processhost.fail( "hosted", new Error( "nope." ) );
		} );

		it( "should reinitialize after failure", function() {
			lastState.should.equal( "initializing" );
		} );

		it( "should emit bootfile.error with error", function() {
			failure.should.eql( {
				owner: "me",
				project: "test",
				branch: "master",
				version: "0.1.0",
				slug: "a1b2c3d4",
				error: new Error( "nope." )
			} );
		} );

		it( "should call packages initialize twice and version failed once", function() {
			packMock.verify();
		} );

		after( function() {
			packMock.restore();
			processhost.clear();
		} );
	} );

	describe( "when running and hosted service fails", function() {
		var lastState, failure;
		before( function( done ) {
			pack.state = {
				current: {
					installedVersion: "0.1.0",
					installedInfo: {
						owner: "me",
						project: "test",
						branch: "master",
						version: "0.1.0",
						slug: "a1b2c3d4"
					},
					slug: "abcd1234"
				},
				latest: {}
			};
			packMock = sinon.mock( pack );
			var initialize = packMock.expects( "initialize" );
			packMock.expects( "ignoreVersion" ).once();
			initialize.twice().returns( { then: _.noop } );

			fsm = fsmFn( config, server, pack, processhost, {} );
			processhost.on( "hosted.failed", function( err ) {
				fsm.handle( "hosted.failed", err );
			} );
			fsm.transition( "running" );
			var initializingHandle, failedHandle;

			failedHandle = fsm.on( "running.error", function( details ) {
				failure = details;
				fsm.off( failedHandle );
			} );

			initializingHandle = fsm.on( "initializing", function() {
				lastState = fsm.state;
				fsm.off( initializingHandle );
				process.nextTick( function() {
					fsm.stop();
					done();
				} );
			} );

			processhost.fail( "hosted", new Error( "nope." ) );
		} );

		it( "should reinitialize after failure", function() {
			lastState.should.equal( "initializing" );
		} );

		it( "should emit running.error with error", function() {
			failure.should.eql( {
				owner: "me",
				project: "test",
				branch: "master",
				version: "0.1.0",
				slug: "a1b2c3d4",
				error: new Error( "nope." )
			} );
		} );

		it( "should call packages initialize twice and version failed once", function() {
			packMock.verify();
		} );

		after( function() {
			packMock.restore();
			processhost.clear();
		} );
	} );

	describe( "when resetting", function() {
		var packagesMock;
		before( function() {
			var newConfig = {
				package: {
					version: "0.2.1"
				}
			};
			packagesMock = sinon.mock( pack );
			packagesMock.expects( "updateConfig" )
				.withArgs( newConfig );
			packagesMock.expects( "reset" );
			packagesMock.expects( "initialize" )
				.returns( { then: _.noop } );

			var fsm = fsmFn( config, server, pack, processhost, {} );
			fsm.reset( newConfig );
		} );

		it( "should stop the process host", function() {
			processhost.stopped.should.be.true;
		} );

		it( "should reconfigure and reset packages", function() {
			packagesMock.verify();
		} );

		it( "should reset the server", function() {
			server.wasReset.should.be.true;
		} );

		after( function() {
			processhost.clear();
			server.clear();
		} );
	} );

	describe( "when start is called", function() {
		var packagesMock;
		before( function() {
			packagesMock = sinon.mock( pack );
			packagesMock.expects( "initialize" )

				.returns( when.defer().promise );
			var fsm = fsmFn( config, server, pack, processhost, {} );
			fsm.start();
		} );

		it( "should start the server", function() {
			server.started.should.be.true;
		} );

		it( "should reconfigure and reset packages", function() {
			packagesMock.verify();
		} );

		after( function() {
			server.clear();
		} );
	} );
} );
