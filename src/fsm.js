var path = require( "path" );
var _ = require( "lodash" );
var machina = require( "machina" );

function createFsm( config, server, packages, processhost, drudgeon ) {
	var Machine = machina.Fsm.extend( {

		_raise: function( ev ) {
			return function( result ) {
				this.handle( ev, result );
			}.bind( this );
		},

		clearFailsafe: function() {
			if ( this.failsafe ) {
				clearTimeout( this.failsafe );
			}
		},

		initialize: function() {
		},

		onFailSafe: function() {
			// The time limit (5 mins default) has elapsed since our last server
			// event during a download, install or start
			// procedure. Time to re-init.
			this.emit( "timeout" );
			this.transition( "initializing" );
		},

		onServiceFailure: function() {
			packages.ignoreVersion( packages.state.current.installedVersion );
			this.transition( "initializing" );
		},

		reset: function( newConfig ) {
			processhost.stop();
			packages.updateConfig( newConfig );
			packages.reset();
			server.reset();
			this.emit( "reconfigured", config.filter.toHash() );
			this.transition( "initializing" );
		},

		setFailsafe: function( time ) {
			this.clearFailsafe();
			this.failsafe = setTimeout( this.onFailSafe.bind( this ), time );
		},

		start: function() {
			server.start();
			this.emit( "configured", config.filter.toHash() );
			this.transition( "initializing" );
		},

		startProcess: function() {
			var set = this.bootFile.boot;
			var process = {
				command: set.command,
				args: set.arguments,
				cwd: path.resolve( packages.state.current.installedPath, set.path ),
				stdio: "inherit",
				restartLimit: config.service.failures,
				restartWindow: config.service.tolerance
			};
			processhost.start( "hosted", process );
		},

		stop: function() {
			if ( this.timeout ) {
				clearTimeout( this.timeout );
			}
			server.stop();
			processhost.stop();
			this.transition( "stopped" );
		},

		initialState: "initializing",
		states: {
			initializing: {
				_onEnter: function() {
					this.setFailsafe( config.timeouts.initializing );
					this.emit( "initializing", packages.state.current.installedInfo );
					packages.initialize()
						.then( this.handle.bind( this ) );
				},
				download: function() {
					server.download();
					this.transition( "downloading", packages.state.latest.available );
				},
				downloaded: function() {
					this.deferUntilTransition();
					this.transition( "downloading", packages.state.latest.available );
				},
				install: function() {
					server.install();
					this.transition( "installing", packages.state.latest.download );
				},
				installed: function() {
					this.deferUntilTransition();
					this.transition( "installing", packages.state.latest.download );
				},
				load: function() {
					this.transition( "loading", packages.state.latest.install );
				},
				wait: function() {
					// if we hit wait during initialize its because
					// we have no packages downloaded or installed
					// and the server provided us with no downloads
					this.transition( "waiting", packages.state.current.installedInfo );
				}
			},
			downloading: {
				_onEnter: function() {
					this.setFailsafe( config.timeouts.downloading );
				},
				downloaded: function() {
					this.transition( "installing" );
				},
				installed: function() {
					this.transition( "loading" );
				}
			},
			installing: {
				_onEnter: function() {
					this.setFailsafe( config.timeouts.installing );
				},
				installed: function() {
					this.transition( "loading" );
				}
			},
			loading: {
				_onEnter: function() {
					this.setFailsafe( config.timeouts.loading );
					this.emit( "loading", packages.state.latest.install );
					packages.loadBootFile()
						.then(
							this._raise( "bootfile.loaded" ),
							this._raise( "bootfile.failed" )
						);
				},
				"bootfile.loaded": function( file ) {
					this.bootFile = file;
					if ( file.preboot ) {
						this.transition( "prebooting" );
					} else {
						this.transition( "starting" );
					}
				},
				"bootfile.failed": function( err ) {
					var error = _.merge( {}, packages.state.latest.install, { error: err } );
					this.emit( "bootfile.error", error );
					this.onServiceFailure();
				},
				installed: function() {
					this.deferUntilTransition( "running" );
				}
			},
			prebooting: {
				_onEnter: function() {
					this.setFailsafe( config.timeouts.prebooting );
					this.emit( "prebooting", { version: packages.state.current.installedVersion } );
					var prebootConfig = {
						platform: config.package.platform,
						relativePath: packages.state.current.installedPath
					};
					drudgeon( this.bootFile.preboot, prebootConfig )
						.run().then(
							this._raise( "preboot.done" ),
							this._raise( "preboot.failed" )
						);
				},
				"preboot.done": function() {
					this.transition( "starting" );
				},
				"preboot.failed": function( err ) {
					this.emit( "preboot.error", { version: packages.state.current.installedVersion, error: err } );
					this.onServiceFailure();
				},
				installed: function() {
					this.deferUntilTransition( "running" );
				}
			},
			starting: {
				_onEnter: function() {
					this.setFailsafe( config.timeouts.starting );
					this.emit( "starting", packages.state.current.installedInfo );
					this.startProcess();
				},
				installed: function() {
					this.deferUntilTransition( "running" );
				},
				"hosted.started": function() {
					this.transition( "running" );
				},
				"hosted.failed": function( err ) {
					var error = _.merge( {}, packages.state.current.installedInfo, { error: err } );
					this.emit( "start.error", error );
					this.onServiceFailure( err );
				}
			},
			running: {
				_onEnter: function() {
					var current = packages.state.current;
					this.emit( "running", packages.state.current.installedInfo );
					this.clearFailsafe();
				},
				installed: function() {
					this.transition( "loading" );
				},
				"hosted.failed": function( err ) {
					var error = _.merge( {}, packages.state.current.installedInfo, { error: err } );
					this.emit( "running.error", error );
					this.onServiceFailure( err );
				}
			},
			stopped: {
				_onEnter: function() {
					this.clearFailsafe();
					this.emit( "stopped", packages.state.current.installedInfo );
				}
			},
			waiting: {
				_onEnter: function() {
					this.setFailsafe( config.timeouts.waiting );
					this.emit( "waiting" );
					server.start();
					// this is done to prevent getting into a tight loop
					// where this module and packages would constantly
					// read and re-read the file system looking for
					// unavailable or irrelevant downloads/installs
					this.timeout = setTimeout( function() {
						packages.getNextStep( true )
							.then( function( op ) {
								this.clearFailsafe();
								this.handle( op );
							}.bind( this ) );
					}.bind( this ), config.index.frequency );
				},
				download: function() {
					server.download();
					this.transition( "downloading" );
				},
				downloaded: function() {
					this.transition( "installing" );
				},
				install: function() {
					server.install();
					this.transition( "installing" );
				},
				installed: function() {
					this.transition( "loading" );
				},
				load: function() {
					this.transition( "loading" );
				},
				wait: function() {
					this.transition( "waiting" );
				}
			}
		}
	} );

	return new Machine();
}

module.exports = createFsm;
