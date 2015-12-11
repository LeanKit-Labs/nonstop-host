// an attempt to consolidate the various event streams
// and clarify how events from each affects other subsystems

var _ = require( "lodash" );
var state = require( "./status" );
var log = require( "./log" )( "nonstop.service-host" );
var postal = require( "postal" );
var eventChannel = postal.channel( "notifications" );

var controlEvents = [
	"bootfile.error",
	"checkingForNew",
	"checkComplete",
	"checkFailed",
	"configured",
	"initializing",
	"loading",
	"prebooting",
	"preboot.error",
	"reconfigured",
	"running",
	"running.error",
	"starting",
	"stopped",
	"timeout",
	"waiting"
];

var hostEvents = [
	"hosted.started",
	"hosted.crashed",
	"hosted.failed"
];

var serverActivities = [
	"checkingForNew",
	"downloading",
	"installing",
	"waitingForNew",
	"waitingForConnection"
];

var serverEvents = [
	"downloaded",
	"download.failed",
	"hasLatest",
	"hasNew",
	"installed",
	"install.failed",
	"noConnection",
	"noMatches",
	"server.stopped"
];

var notifications = {
	"bootfile.error": function( info ) {
		state.lastEvent = { failed: { bootfile: info } };
		log.error( "Reading bootfile for %s failed with error: %j", info.version, info.error );
	},
	checkComplete: function( info ) {
		state.recordLastCheck( info );
	},
	checkFailed: function( info ) {
		state.recordFailedCheck( info );
	},
	checkingForNew: function() {
		log.debug( "Checking for new version" );
	},
	configured: function( info ) {
		state.update( {
			state: {
				project: info.project,
				owner: info.owner,
				branch: info.branch,
				version: info.version || "Any",
				releaseOnly: info.releaseOnly
			}
		} );
	},
	downloaded: function( info ) {
		var summary = summarize( info );
		state.lastEvent = { downloaded: summary };
		log.info( "Downloaded '%s' successfully", info.file );
	},
	downloading: function( info ) {
		var summary = summarize( info );
		state.activity = { downloading: summary };
		log.info( "Downloading '%s'", info.file );
	},
	"download.failed": function( info ) {
		state.lastEvent = { failed: { download: info } };
		log.error( "Download of '%s' failed with %s", info.file, info.error );
	},
	hasLatest: function() {
		log.info( "Latest available version is already installed" );
	},
	hasNew: function( info ) {
		log.info( "New package found: %j", info );
	},
	"hosted.crashed": function( info ) {
		state.recordStop();
		state.lastEvent = { crashed: summarize( info ) };
		log.warn( "Service crashed: %j", info );
	},
	"hosted.failed": function( info ) {
		state.recordStop();
		state.lastEvent = { failed: { service: info } };
		log.error( "Service failed past allowed tolerance: %j", info );
	},
	"hosted.started": function( info ) {
		var summary = summarize( info );
		state.recordStart( info );
		state.lastEvent = { started: summary };
		log.info( "Started service: %j", info );
	},
	installed: function( info ) {
		var summary = summarize( info );
		state.lastEvent = { installed: summary };
		state.latestInstall = summary;
		log.info( "Installed '%s' successfully", info.file );
	},
	installing: function( info ) {
		var summary = summarize( info );
		state.activity = { installing: summary };
		log.info( "Installing '%s'", info.file );
	},
	"install.failed": function( info ) {
		var summary = summarize( info );
		state.lastEvent = { failed: { install: summary } };
		log.error( "Install of '%s' failed with %s", info.file, info.error );
	},
	initializing: function( info ) {
		state.activity = { initializing: summarize( info ) };
		log.debug( "Initializing" );
	},
	loading: function( info ) {
		var summary = summarize( info );
		state.activity = { loading: summary };
		log.info( "Loading version '%s'", info.version );
	},
	noConnection: function( info ) {
		log.error( "Connection to index failed with %s:\n%s", info.message, info.stack );
	},
	noMatches: function( info ) {
		log.warn( "No matching packages found with the criteria: %j", info );
	},
	prebooting: function( info ) {
		state.activity = { prebooting: { version: info.version } };
		log.info( "Prebooting version '%s'", info.version );
	},
	"preboot.error": function( info ) {
		state.lastEvent = { failed: { preboot: info } };
		log.error( "Preboot for version '%s' failed with %s", info.version, info.error );
	},
	reconfigured: function( info ) {
		state.update( {
			state: {
				project: info.project,
				owner: info.owner,
				branch: info.branch,
				version: info.version || "Any",
				releaseOnly: info.releaseOnly
			}
		} );
	},
	running: function( info ) {
		var summary = summarize( info );
		state.activity = { running: summary };
		state.lastRun = summary;
		log.info( "Running version '%s'", info.version );
	},
	"running.error": function( info ) {
		var summary = summarize( info );
		state.lastEvent = { error: { running: info } };
		state.update( {
			lastFailure: summary
		} );
		log.error( "Running version '%s' failed with '%s'", info.version, info.error );
	},
	"server.stopped": function() {
		log.info( "Checks for updates have been stopped" );
	},
	starting: function( info ) {
		var summary = summarize( info );
		state.activity = { starting: summary };
		log.info( "Starting version '%s'", info.version );
	},
	stopped: function() {
		state.activity = undefined;
		state.recordStop();
		state.lastEvent = { stopped: {} };
		log.info( "Hosted service and all activity has stopped" );
	},
	timeout: function() {
		state.lastEvent = { timeout: {} };
		log.warn( "The server timed out on the previous operation (%j). This is not good. Re-initializing control state machine.", state.activity );
	},
	waiting: function() {
		state.activity = { waiting: {} };
		log.debug( "Waiting" );
	},
	waitingForNew: function( info ) {
		log.debug( "Checking for new in %s ms", info.duration );
	},
	waitingForConnection: function( info ) {
		log.debug( "Retrying connection to index in %s ms", info.duration );
	}
};

function notify( topic, info ) {
	var fn = notifications[ topic ];
	if ( fn ) {
		eventChannel.publish( topic, info );
		fn( info );
	}
}

function handleEvent( topic, control, processhost, server, packages, info ) {
	if ( !info || !info.version ) {
		info = _.merge( {}, info, packages.state.current.installedInfo );
	}
	notify( topic, info );
	control.handle( topic, info );
}

function summarize( info ) {
	if ( info ) {
		return {
			branch: info.branch,
			owner: info.owner,
			project: info.project,
			slug: info.slug,
			version: info.version
		};
	}
	return {};
}

function updateActivity( topic, control, processhost, server, packages, info ) {
	if ( !info || !info.version ) {
		info = _.merge( {}, info, packages.state.current.installedInfo );
	}
	notify( topic, info );
	control.handle( topic, info );
}

function updateStatus( topic, info ) {
	notify( topic, info );
}

function setupSubscriptions( control, server, processhost, packages ) {
	_.each( serverActivities, function( topic ) {
		server.on( topic, updateActivity.bind( null, topic, control, processhost, server, packages ) );
	} );

	_.each( serverEvents, function( topic ) {
		server.on( topic, handleEvent.bind( null, topic, control, processhost, server, packages ) );
	} );

	_.each( hostEvents, function( topic ) {
		processhost.on( topic, handleEvent.bind( null, topic, control, processhost, server, packages ) );
	} );

	_.each( controlEvents, function( topic ) {
		control.on( topic, updateStatus.bind( null, topic ) );
	} );
}

function create( control, server, processhost, packages ) {
	setupSubscriptions( control, server, processhost, packages );
}

module.exports = create;
