var _ = require( "lodash" );
var moment = require( "moment" );
var started = moment();
var serviceStart, lastEvent, lastEventOn, activity, activityOn;
require( "moment-duration-format" );

var format = "d [days] h [hours] m [minutes] s [seconds]";
var state = {
	currentVersion: "N/A",
	state: "N/A"
};

function deepMerge( target, source, overwrite ) {
	_.each( source, function( val, key ) {
		var original = target[ key ];
		if ( _.isObject( val ) ) {
			if ( original && _.isObject( original ) ) {
				deepMerge( original, val, overwrite );
			} else {
				target[ key ] = val;
			}
		} else {
			target[ key ] = ( ( original === undefined || original === null ) || overwrite ) ? val : original;
		}
	} );
}

function getRelativeUptime( x, msg ) {
	var duration = moment.duration( moment() - ( x || moment() ) );
	if ( duration._milliseconds > 0 ) {
		if ( duration._milliseconds < 1000 ) {
			return "less than a second";
		} else {
			return duration.format( format );
		}
	}
	return msg || "0 seconds";
}

function resetTimers() {
	started = moment();
	serviceStart = undefined;
	lastEventOn = undefined;
	activityOn = undefined;
	state.lastCheck = undefined;
}

function serviceStarted( info ) {
	if ( info ) {
		serviceStart = moment();
		state.currentVersion = info.version;
	}
}

function serviceStopped() {
	serviceStart = undefined;
}

function setLastCheck() {
	state.lastCheck = state.lastCheck || {};
	state.lastCheck.successOn = moment().utc().toString();
}

function setFailedCheck() {
	state.lastCheck = state.lastCheck || {};
	state.lastCheck.failedOn = moment().utc().toString();
}

function updateStatus( info ) {
	deepMerge( state, info, true );
}

Object.defineProperty( state, "uptime", {
	get: function() {
		return getRelativeUptime( started );
	}
} );

Object.defineProperty( state, "serviceUptime", {
	get: function() {
		return getRelativeUptime( serviceStart );
	}
} );

Object.defineProperty( state, "timeSinceLastActivity", {
	get: function() {
		return getRelativeUptime( activityOn, "N/A" );
	}
} );

Object.defineProperty( state, "timeSinceLastEvent", {
	get: function() {
		return getRelativeUptime( lastEventOn, "N/A" );
	}
} );

Object.defineProperty( state, "activity", {
	get: function() {
		return activity;
	},
	set: function( x ) {
		activity = x;
		if ( x ) {
			activityOn = moment().utc();
		}
	}
} );

Object.defineProperty( state, "lastEvent", {
	get: function() {
		return lastEvent;
	},
	set: function( x ) {
		lastEvent = x;
		if ( x ) {
			lastEventOn = moment().utc();
		}
	}
} );

state.recordStart = serviceStarted;
state.recordStop = serviceStopped;
state.recordLastCheck = setLastCheck;
state.recordFailedCheck = setFailedCheck;
state.resetTimers = resetTimers;
state.update = updateStatus;

module.exports = state;
