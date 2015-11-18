var _ = require( "lodash" );
var postal = require( "postal" );
var notifications = postal.channel( "notifications" );

var lookup = {
	platform: "package",
	architecture: "package",
	osVersion: "package",
	osName: "package",
	project: "package",
	owner: "package",
	branch: "package",
	build: "package",
	version: "package",
	releasOnly: "package",
	failures: "service",
	tolerance: "service"
};

var validCommands = [ "start", "stop", "reset" ];

function operate( state, op, field, value ) {
	switch ( op ) {
		case "change":
			state[ field ] = value;
			break;
		case "remove":
			state[ field ] = undefined;
			break;
	}
}

function change( config, sectionName, section, op ) {
	operate( section, op.op, op.field, op.value );
	if ( sectionName === "package" ) {
		if ( config.filter[ op.field ] ) {
			config.filter[ op.field ]( op.value );
		}
	}
}

function configure( config, fsm, changeSet ) {
		notifications.publish( "configuration.changed", {
			original: config,
			changes: changeSet
		} );
		_.each( changeSet, function( op ) {
			var sectionName = lookup[ op.field ];
			var section = config[ sectionName ];
			if ( section ) {
				if( op.field === "version" && op.value ) {
					var parts = op.value.split( "-" );
					if( parts.length > 1 ) {
						var versionOp = { op: op.op, field: "version", value: parts[ 0 ] };
						var buildOp = { op: op.op, field: "build", value: parts[ 1 ] };
						change( config, sectionName, section, versionOp );
						change( config, sectionName, section, buildOp );
					} else {
						change( config, sectionName, section, op );
					}
				} else {
					change( config, sectionName, section, op );
				}
			} else {
				console.log( "No configuration section found for field", op.field );
			}
		} );
		fsm.reset( config );
}

function sendCommand( config, fsm, command ) {
	if ( _.contains( validCommands, command ) ) {
		notifications.publish( "control.command", {
			command: command
		} );
		fsm[ command ]();
		return true;
	}
	return false;
}

module.exports = function( config, fsm ) {
	return {
		configure: configure.bind( undefined, config, fsm ),
		command: sendCommand.bind( undefined, config, fsm ),
	};
};
