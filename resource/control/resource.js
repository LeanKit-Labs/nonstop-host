var _ = require( "lodash" );
module.exports = function( host, control, config ) {
	return {
		name: "control",
		actions: {
			configure: {
				url: "/",
				method: "patch",
				handle: function( envelope ) {
					var changeSet = envelope.data;
					if ( changeSet && _.isArray( changeSet.data ) ) {
						changeSet = changeSet.data;
					}
					control.configure( changeSet );
					return {
						data: {
							index: config.index,
							package: config.filter.toHash()
						}
					};
				}
			},
			command: {
				url: "/",
				method: "put",
				handle: function( envelope ) {
					var command = envelope.data.command;
					if ( control.command( command ) ) {
						return {
							status: 202,
							data: {
								message: "Processing command - " + command
							}
						};
					}
					return {
						status: 400,
						data: {
							message: "Invalid command - " + command
						}
					};
				}
			},
			environment: {
				url: "/environment",
				method: "patch",
				handle: function( envelope ) {
					var changeSet = envelope.data;
					if ( changeSet && _.isArray( changeSet.data ) ) {
						changeSet = changeSet.data;
					}
					return {
						data: control.setEnvironment( changeSet )
					};
				}
			}
		}
	};
};
