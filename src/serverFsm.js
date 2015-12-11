var path = require( "path" );
var machina = require( "machina" );
var _ = require( "lodash" );

function createFsm( config, packages ) {
	var Machine = machina.Fsm.extend( {

		_raise: function( ev ) {
			return function( result ) {
				this.handle( ev, result );
			}.bind( this );
		},

		_setup: function() {
			this.newest = undefined;
			this.wait = 5000;
			if ( config && config.index && config.index.frequency ) {
				this.wait = config.index.frequency;
			}
			this.waitCeiling = this.wait + this.wait;
			this.lastWait = 0;
		},

		checkAvailable: function( available ) {
			if ( available ) {
				if ( packages.hasLatestAvailable( available.version ) ) {
					this.emit( "hasLatest", available );
					this.transition( "waiting" );
				} else {
					this.newest = available;
					this.emit( "hasNew", available );
					this.transition( "downloading" );
				}
			} else {
				this.emit( "noMatches", config.filter.toHash() );
				this.transition( "waiting" );
			}
		},

		checkForNew: function() {
			if ( this.timeout ) {
				clearTimeout( this.timeout );
			}
			this.timeout = null;
			this.handle( "check" );
		},

		download: function() {
			this.newest = packages.state.latest.available;
			this.transition( "downloading" );
		},

		initialize: function() {
			this._setup();
		},

		install: function() {
			this.newest = packages.state.latest.download;
			this.transition( "installing" );
		},

		reset: function( newConfig ) {
			if ( this.timeout ) {
				clearTimeout( this.timeout );
			}
			if ( newConfig ) {
				config = newConfig;
			}
			this._setup();
			this.transition( "checkingForNew" );
		},

		start: function() {
			this.checkForNew();
		},

		stop: function() {
			if ( this.timeout ) {
				clearTimeout( this.timeout );
			}
			this.transition( "stopped" );
		},

		initialState: "initializing",
		states: {
			initializing: {
				check: function() {
					this.transition( "checkingForNew" );
				}
			},
			checkingForNew: {
				_onEnter: function() {
					this.newest = undefined;
					this.emit( "checkingForNew", packages.state.current.installedInfo );
					packages.getAvailable()
						.then(
							this._raise( "available.done" ),
							this._raise( "available.failed" )
						);
				},
				"available.done": function( latest ) {
					this.checkAvailable( latest );
				},
				"available.failed": function( err ) {
					this.emit( "noConnection", err );
					this.transition( "failed" );
				}
			},
			downloading: {
				_onEnter: function() {
					this.emit( "downloading", this.newest );
					packages.download( this.newest.file )
						.then(
							this._raise( "download.done" ),
							this._raise( "download.failed" )
						);
				},
				"download.done": function( info ) {
					this.newest = info;
					this.emit( "downloaded", info );
					this.transition( "installing" );
				},
				"download.failed": function( err ) {
					this.emit( "download.failed", _.merge( {}, this.newest, { error: err } ) );
					this.transition( "waiting" );
				},
				check: function() {
					this.deferUntilTransition();
				}
			},
			installing: {
				_onEnter: function() {
					this.emit( "installing", this.newest );
					var downloaded = path.resolve( config.downloads, this.newest.file );
					packages.install( downloaded )
						.then(
							this._raise( "installation.done" ),
							this._raise( "installation.failed" )
						);
				},
				"installation.done": function() {
					this.emit( "installed", this.newest );
					this.transition( "waiting" );
				},
				"installation.failed": function( err ) {
					this.emit( "install.failed", _.merge( {}, this.newest, { error: err } ) );
					packages.ignoreVersion( this.newest.version );
					this.transition( "waiting" );
				},
				check: function() {
					this.deferUntilTransition();
				}
			},
			waiting: {
				_onEnter: function() {
					this.newest = undefined;
					if ( this.timeout ) {
						return;
					}
					var wait = this.wait;
					this.emit( "waitingForNew", { duration: wait } );
					this.timeout = setTimeout( this.checkForNew.bind( this ), wait );
				},
				check: function() {
					this.transition( "checkingForNew" );
				}
			},
			failed: {
				_onEnter: function() {
					this.newest = undefined;
					if ( this.timeout ) {
						return;
					}
					var wait = this.lastWait + this.wait;
					this.lastWait = wait;
					if ( wait > this.waitCeiling ) {
						wait = this.waitCeiling;
					}
					this.emit( "waitingForConnection", { duration: wait } );
					this.timeout = setTimeout( this.checkForNew.bind( this ), wait );
				},
				check: function() {
					this.transition( "checkingForNew" );
				}
			},
			stopped: {
				_onEnter: function() {
					this.emit( "server.stopped" );
				},
				check: function() {
					this.transition( "checkingForNew" );
				}
			}
		}
	} );

	return new Machine();
}

module.exports = createFsm;
