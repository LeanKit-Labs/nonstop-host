var format = require( "util" ).format;

function debug() {
	var args = Array.prototype.slice.call( arguments, 0 );
	this.entries.debug.push( format.apply( undefined, args ) );
}

function error() {
	var args = Array.prototype.slice.call( arguments, 0 );
	this.entries.error.push( format.apply( undefined, args ) );
}

function info() {
	var args = Array.prototype.slice.call( arguments, 0 );
	this.entries.info.push( format.apply( undefined, args ) );
}

function warn() {
	var args = Array.prototype.slice.call( arguments, 0 );
	this.entries.warn.push( format.apply( undefined, args ) );
}

function getLog() {
	var log = {
		entries: {
			debug: [],
			error: [],
			info: [],
			warn: []
		},
		namespace: undefined
	};

	log.debug = debug.bind( log );
	log.error = error.bind( log );
	log.info = info.bind( log );
	log.warn = warn.bind( log );

	return function( ns ) {
		log.namespace = ns;
		return log;
	};
}

module.exports = getLog;
