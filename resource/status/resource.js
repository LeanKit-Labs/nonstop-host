var _ = require( "lodash" );

function getStatus( status ) {
	return {
		uptime: {
			host: status.uptime,
			service: status.serviceUptime
		},
		package: status.state,
		activity: status.activity,
		lastEvent: status.lastEvent,
		lastFailure: status.lastFailure || "N/A",
		time: {
			sinceLastActivity: status.timeSinceLastActivity,
			sinceLastEvent: status.timeSinceLastEvent
		}
	};
}

module.exports = function( host, config, status ) {
	return {
		name: "status",
		actions: {
			environment: {
				url: "/environment",
				method: "get",
				handle: function() {
					return _.reduce( process.env, function( acc, value, key ) {
						if ( !/(pass|token|secret)/ig.test( key ) ) {
							acc[ key ] = value;
						} else {
							acc[ key ] = "redacted";
						}
						return acc;
					}, {} );
				}
			},
			self: {
				url: "/",
				method: "get",
				handle: function() {
					return {
						data: getStatus( status )
					};
				}
			},
			settings: {
				url: "/settings",
				method: "get",
				handle: function() {
					return {
						data: {
							serviceHost: config.service,
							package: config.filter.toHash(),
							index: config.index
						}
					};
				}
			}
		}
	};
};
