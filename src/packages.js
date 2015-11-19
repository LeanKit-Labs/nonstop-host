var _ = require( "lodash" );
var path = require( "path" );
var when = require( "when" );
var semver = require( "semver" );
var pack = require( "nonstop-pack" );
var bootFile = require( "./bootFile" );
var fs = require( "./fs" );
var indexClient = require( "./indexClient" );

function download( index, file ) {
	return index.client.download( file );
}

function getAvailable( state, index ) {
	return index.client.getLatest( state.ignoredVersions );
}

function getDownloaded( config, state, ignored ) {
	ignored = ignored || state.ignoredVersions;
	return when.promise( function( resolve ) {
		var versions = fs.getVersions( config.downloads, ignored );
		versions.sort( function( a, b ) {
			return semver.rcompare( a.version, b.version );
		} );
		if( versions.length ) {
			resolve( versions[ 0 ] );
		} else {
			resolve( undefined );
		}
	} );
}

function getInstalled( config, state, ignored ) {
	var installPath = getInstallPath( config );
	ignored = ignored || state.ignoredVersions;
	return pack.getInstalled( /.*/, installPath, ignored, true )
		.then(
			function( version ) {
				if( version ) {
					return fs.getInfo( config, version );
				} else {
					return undefined;
				}
			},
			function() {
				return undefined;
			}
		);
}

function getInstallPath( config, version ) {
	var filter = config.filter.toHash();
	var target = [ filter.project, filter.owner, filter.branch ].join( "-" );
	var targetPath;
	if( version ) {
		targetPath = path.join( config.installs, target, version );
	} else {
		targetPath = path.join( config.installs, target );
	}
	return targetPath;
}

function getNextStep( config, state, index, skipCheck ) {
	function onResponse( available ) {
		var validInstall = hasValidInstall( config, state );
		var validDownload = hasValidDownload( config, state );

		var latestInstalled = validInstall &&
			hasLatestInstalled( state, available );
		var newerDownload = validDownload &&
			hasNewerDownload( state, available );

		if( available && available.version ) {
			state.latest.available = available;
			state.latest.availableVersion = available.version;
		}

		if( latestInstalled ) {
			return "load";
		} else if( newerDownload ) {
			return "install";
		} else if( available ) {
			return "download";
		} else {
			return "wait";
		}
	}
	if( skipCheck ) {
		return when.resolve( onResponse( state.latest.availableVersion ) );
	} else {
		return getAvailable( state, index )
			.then( onResponse, onResponse );
	}
}

function greaterThan( v1, v2 ) {
	return semver.gt( v1 || "0.0.0", v2 || "0.0.0" );
}

function hasNewerDownload( state, available ) {
	available = available || state.latest.availableVersion;
	var downloaded = state.latest.downloadedVersion;
	var newerAvailable = greaterThan( available, downloaded );
	var newerInstall = greaterThan( state.latest.installedVersion, downloaded );
	return ( downloaded && ( !newerAvailable && !newerInstall ) ) === true;
}

function hasLatestInstalled( state, available ) {
	available = available || state.latest.availableVersion;
	var installed = state.latest.installedVersion;
	var newerAvailable = greaterThan( available, installed );
	var newerDownload = greaterThan( state.latest.downloadedVersion, installed );
	return ( installed && ( !newerAvailable && !newerDownload ) ) === true;
}

function hasValidDownload( config, state ) {
	var package = config.package;
	var version;
	if( package.version ) {
		version = _.filter( [ package.version, package.build ] ).join( "-" );
	}
	if( !_.isEmpty( version ) ) {
		return package.releaseOnly ?
			version === state.latest.downloadVersion :
			_.contains( state.latest.downloadedVersion, version );
	} else {
		return state.latest.downloadedVersion !== undefined;
	}
	return false;
}

function hasValidInstall( config, state ) {
	var package = config.package;
	var version;
	if( package.version ) {
		version = _.filter( [ package.version, package.build ] ).join( "-" );
	}
	var installedVersion = state.current.installedVersion || state.latest.installedVersion;
	if( !_.isEmpty( version ) ) {
		return package.releaseOnly ?
			version === installedVersion :
			_.contains( installedVersion, version );
	} else {
		return installedVersion !== undefined;
	}
	return false;
}

function loadBootFile( config, state ) {
	var bootPath = state.current.installedPath;
	if( fs.exists( bootPath ) ) {
		return bootFile.get( bootPath );
	} else {
		return when.reject();
	}
}

function ignoreVersion( state, version ) {
	if( state.latest.availableVersion === version ) {
		state.latest.available = undefined;
		state.latest.availableVersion = undefined;
	}
	state.ignoredVersions.push( version );
}

function initializeState( config, state, index ) {
	var promises = [];
	promises.push( getAvailable( state, index )
		.then( function( available ) {
				if( available ) {
					state.latest.available = available;
					state.latest.availableVersion = available.version;
				}
			}, function() {
				return undefined;
			} ) );
	promises.push( getInstalled( config, state )
		.then( function( installed ) {
			if( installed ) {
				setInstalled( config, state, installed );
			} else {
				state.current.installedVersion = undefined;
				state.current.installedPath = undefined;
				state.current.installationPath = undefined;
				state.current.installedInfo = undefined;
				state.current.slug = undefined;
				state.latest.install = undefined;
				state.latest.installedVersion = undefined;
				state.latest.slug = undefined;
				state.latest.installedPath = undefined;
			}
		} ) );
	promises.push( getDownloaded( config, state )
		.then( function( downloaded ) {
			if( downloaded ) {
				setLatestDownload( config, state, downloaded );
			} else {
				state.latest.download = undefined;
				state.latest.downloadedVersion = undefined;
				state.latest.downloadedFile = undefined;
			}
		} ) );
	return when.all( promises )
		.then( function() {
			return getNextStep( config, state, index, true );
		} );
}

function install( config, state, package ) {
	var info = pack.parse( "", package );
	var installPath = getInstallPath( config, info.version );
	fs.ensurePath( path.dirname( installPath ) );
	return pack.unpack( package, installPath )
		.then( function( installed ) {
			setInstalled( config, state, info );
			return installed;
		} );
}

function readInfo( config, version ) {
	return fs.getInfo( config, version );
}

function resetState( config, oldState ) {
	var filter = config.filter.toHash();
	var state = {
		owner: filter.owner,
		branch: filter.branch,
		project: filter.project,
		current: {
			status: undefined,
			installedVersion: undefined,
			installedPath: undefined,
			installationPath: getInstallPath( config ),
			installedInfo: undefined,
			slug: undefined
		},
		ignoredVersions: [],
		lastIndexCheck: oldState ? oldState.lastIndexCheck : undefined,
		downloadedVersions: [],
		latest: {
			available: undefined,
			availableVersion: undefined,
			download: undefined,
			downloadedVersion: undefined,
			downloadedFile: undefined,
			install: undefined,
			installedVersion: undefined,
			slug: undefined,
			installedPath: undefined
		}
	};
	// in order to really reset after operations
	// we need to set oldState's value back
	if( oldState ) {
		oldState.current = state.current;
		oldState.latest = state.latest;
		oldState.owner = filter.owner;
		oldState.branch = filter.branch;
		oldState.project = filter.project;
		oldState.ignoredVersions = [];
	}
	return oldState || state;
}

function setInstalled( config, state, info ) {
	var versionInstalledPath = getInstallPath( config, info.version );
	state.current.installedVersion = info.version;
	state.current.installedPath = versionInstalledPath;
	state.current.installedInfo = info;
	state.current.slug = state.current.installedInfo.slug || state.current.installedInfo.commit;
	if( greaterThan( info.version, state.latest.installedVersion ) ) {
		setLatestInstall( config, state, state.current.installedInfo );
	}
}

function setLatestDownload( config, state, info ) {
	state.latest.download = info;
	state.latest.downloadedFile = info.fullPath;
	state.latest.downloadedVersion = info.version;
	state.latest.downloadedSlug = info.slug || info.commit;
}

function setLatestInstall( config, state, info ) {
	state.latest.install = info;
	state.latest.installedPath = getInstallPath( config, info.version );
	state.latest.installedVersion = info.version;
	state.latest.slug = info.slug || info.commit;
}

function updateConfig( config, state, index ) {
	resetState( config, state );
	index.update( config );
}

module.exports = function( config ) {
	var index = indexClient( config );
	var state = resetState( config );

	return {
		download: download.bind( null, index ),
		getAvailable: getAvailable.bind( null, state, index ),
		getDownloaded: getDownloaded.bind( null, config, state ),
		getInstalled: getInstalled.bind( null, config, state ),
		getInstalledInfo: readInfo.bind( null, config ),
		getInstallPath: getInstallPath.bind( null, config ),
		getNextStep: getNextStep.bind( null, config, state, index ),
		hasLatestAvailable: hasLatestInstalled.bind( null, state ),
		hasNewerDownload: hasNewerDownload.bind( null, state ),
		hasValidInstall: hasValidInstall.bind( null, config, state ),
		hasValidDownload: hasValidDownload.bind( null, config, state ),
		ignoreVersion: ignoreVersion.bind( null, state ),
		initialize: initializeState.bind( null, config, state, index ),
		install: install.bind( null, config, state ),
		loadBootFile: loadBootFile.bind( null, config, state ),
		setInstalled: setInstalled.bind( null, config, state ),
		setLatestDownload: setLatestDownload.bind( null, config, state ),
		state: state,
		reset: resetState.bind( null, config, state ),
		updateConfig: updateConfig.bind( null, config, state, index )
	};
};
