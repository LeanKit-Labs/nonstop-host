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
	tolerance: "service",
	autoRollback: "service"
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
				if ( op.field === "version" && op.value ) {
					var parts = op.value.split( "-" );
					if ( parts.length > 1 ) {
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
	process.env.PACKAGE_OWNER = config.package.owner;
	process.env.PACKAGE_BRANCH = config.package.branch;
	process.env.PACKAGE_PROJECT = config.package.project;
	process.env.PACKAGE_VERSION = config.package.version;
	process.env.PACKAGE_BUILD = config.package.build;
	process.env.PACKAGE__RELEASE_ONLY = config.package.releaseOnly;
	process.env.SERVICE_TOLERANCE = config.service.tolerance;
	process.env.SERVICE_FAILURES = config.service.failures;
	process.env.SERVICE__AUTO_ROLLBACK = config.service.autoRollback;
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

function setEnvironment( config, changeSet ) {
	return _.reduce( changeSet, function( acc, op ) {
		if( op.op === "change" ) {
			process.env[ op.variable ] = op.value;
			acc[ op.variable ] = op.value;
		} else if( op.op === "remove" ) {
			delete process.env[ op.variable ];
			acc.removed = acc.removed || [];
			acc.removed.push( op.variable );
		}
		return acc;
	}, {} );
}

module.exports = function( config, fsm ) {
	return {
		configure: configure.bind( undefined, config, fsm ),
		command: sendCommand.bind( undefined, config, fsm ),
		setEnvironment: setEnvironment.bind( undefined, config )
	};
};
