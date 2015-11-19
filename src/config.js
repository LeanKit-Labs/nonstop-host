var _ = require( "lodash" );
var path = require( "path" );
var sysInfo = require( "./sysInfo.js" )();
var filterFn = require( "./filter.js" );
var defaultDownloadPath = path.resolve( "./downloads" );
var defaultInstallPath = path.resolve( "./installs" );

function getDefaults() {
	return {
		index: {
			host: "localhost",
			api: "/api",
			frequency: 60000,
			port: 4444,
			ssl: false,
			token: "test"
		},
		package: {
			architecture: sysInfo.arch,
			branch: undefined,
			build: undefined,
			owner: undefined,
			platform: sysInfo.platform,
			project: undefined,
			releaseOnly: false,
			version: undefined,
			files: defaultDownloadPath,
			os: {}
		},
		service: {
			name: sysInfo.name,
			host: {
				name: "localhost",
				ip: undefined
			},
			port: {
				local: 9090,
				public: 9090
			},
			failures: 1,
			tolerance: 5000,
			autoRollback: true
		},
		logging: {
			stdOut: {
				level: 3,
				bailIfDebug: true,
				topic: "#"
			},
			rollerpunk: {
				level: 0,
				logFolder: "/var/log",
				fileName: "nonstop.log",
				maxSize: 1024,
				maxLogFiles: 10,
				maxUnwritten: 100,
				maxConsecutiveReboots: 10,
				rebootInterval: 10,
				topic: "#"
			}
		},
		timeouts: {
			initializing: 15000, // 15 seconds
			downloading: 300000, // 5 minutes
			installing: 60000, // 1 minute
			loading: 5000, // 5 seconds
			prebooting: 60000, // 1 minute
			starting: 30000, // 30 seconds
			waiting: 60000 // 1 minute
		}
	};
}

function buildRootUrl( cfg ) {
	return [
		( cfg.ssl ? "https" : "http" ),
		"://",
		cfg.host,
		":",
		cfg.port,
		cfg.api
	].join( "" );
}

function buildServiceUrl( cfg ) {
	return [
		"http://",
		cfg.host,
		":",
		cfg.port.public,
		"api"
	].join( "" );
}

function buildDownloadRoot( cfg ) {
	return [
		( cfg.ssl ? "https" : "http" ),
		"://",
		cfg.host,
		":",
		cfg.port,
		cfg.packages
	].join( "" );
}

function getConfiguration( custom ) {
	var defaults = getDefaults();
	var merged = _.merge( defaults, custom );
	var cfg = require( "configya" )( {
		defaults: merged,
		file: "./bootstrap.json"
	} );

	cfg.package.osName = cfg.package.os.name || "any";
	cfg.package.osVersion = cfg.package.os.version || "any";
	return {
		apiRoot: buildRootUrl( cfg.index ),
		downloads: defaultDownloadPath,
		downloadRoot: buildDownloadRoot( cfg.index ),
		filter: filterFn( cfg.package ),
		index: cfg.index,
		installs: defaultInstallPath,
		logging: cfg.logging,
		package: cfg.package,
		service: cfg.service,
		serviceRoot: buildServiceUrl( cfg.service ),
		timeouts: cfg.timeouts
	};
}

module.exports = getConfiguration;
