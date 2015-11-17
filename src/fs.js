var _ = require( "lodash" );
var fs = require( "fs" );
var path = require( "path" );
var mkdirp = require( "mkdirp" );
var pack = require( "nonstop-pack" );
var rimraf = require( "rimraf" );
var format = require( "util" ).format;

function clearDownloads( downloads ) {
	if ( fs.existsSync( downloads ) && downloads !== "/" ) {
		return rimraf.sync( downloads );
	} else {
		throw new Error(
			format( "Invalid download path '%s'- no files were deleted.", downloads )
		);
	}
}

function removeInstall( installPath ) {
	if ( fs.existsSync( installPath ) && installPath !== "/" ) {
		return rimraf.sync( installPath );
	} else {
		throw new Error(
			format( "Invalid install path '%s'- no files were deleted.", installPath )
		);
	}
}

function getVersions( downloads, ignored ) {
	if ( fs.existsSync( downloads ) ) {
		return _.filter( _.map( fs.readdirSync( downloads ), function( pkg ) {
			var info = pack.parse( "", pkg );
			if ( !_.contains( ignored, info.version ) ) {
				return info;
			}
		} ) );
	} else {
		return [];
	}
}

function getInfo( config, version ) {
	var properties = config.filter.toHash();
	var subfolder = [ properties.project, properties.owner, properties.branch ].join( "-" );
	var infoPath = path.join( config.installs, subfolder, version, ".nonstop-info.json" );
	if ( fs.existsSync( infoPath ) ) {
		return JSON.parse( fs.readFileSync( infoPath ).toString() );
	} else {
		return { version: version };
	}
}

module.exports = {
	clearDownloads: clearDownloads,
	ensurePath: mkdirp.sync,
	exists: fs.existsSync,
	getVersions: getVersions,
	getInfo: getInfo,
	removeDirectory: rimraf.sync,
	removeInstall: removeInstall
};
