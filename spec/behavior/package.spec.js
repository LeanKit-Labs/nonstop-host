require( "../setup" );
var controlFn = require( "../../src/control" );
var config = require( "../../src/config" )( {
	index: {
		frequency: 100
	},
	package: {
		project: "test",
		owner: "me",
		branch: "master",
		files: "./downloads"
	}
} );

var bootFileApi = {

};

var fsApi = {
	ensurePath: _.noop,
	getInfo: _.noop,
	getVersions: _.noop
};

var indexClientApi = {
	update: _.noop,
	client: {
		download: _.noop,
		getLatest: _.noop,
		update: _.noop
	}
};

var packApi = {
	parse: _.noop,
	unpack: _.noop
};

var pkgFn = proxyquire( "../src/packages", {
	"./bootFile": bootFileApi,
	"./fs": fsApi,
	"./indexClient": function() { return indexClientApi; },
	"nonstop-pack": packApi
} );

describe( "Packages", function() {

	describe( "when downloading a file", function() {
		var clientMock, fileName;
		before( function() {
			clientMock = sinon.mock( indexClientApi.client );
			clientMock
				.expects( "download" )
				.withArgs( fileName )
				.resolves( {} );
			var packages = pkgFn( config );
			return packages.download( fileName );
		} );

		it( "should call download on client with file name", function() {
			clientMock.verify();
		} );
	} );

	describe( "when getting available", function() {
		describe( "without ignored versions", function() {
			var clientMock;
			before( function() {
				clientMock = sinon.mock( indexClientApi.client );
				clientMock
					.expects( "getLatest" )
					.withArgs( [] )
					.resolves( [{}] );
				var packages = pkgFn( config );
				return packages.getAvailable();
			} );

			it( "should call getAvailable on client", function() {
				clientMock.verify();
			} );
		} );

		describe( "with ignored versions", function() {
			var clientMock;
			before( function() {
				var packages = pkgFn( config );
				packages.ignoreVersion( "0.1.0" );
				packages.ignoreVersion( "0.1.1" );
				clientMock = sinon.mock( indexClientApi.client );
				clientMock
					.expects( "getLatest" )
					.withArgs( [ "0.1.0", "0.1.1" ] )
					.resolves( [{}] );
				return packages.getAvailable();
			} );

			it( "should call getAvailable on client with ignored versions", function() {
				clientMock.verify();
			} );
		} );
	} );

	describe( "when getting downloaded versions", function() {
		describe( "without any downloaded versions", function() {
			var fsMock, version;
			before( function() {
				fsMock = sinon.mock( fsApi );
				fsMock
					.expects( "getVersions" )
					.withArgs( config.downloads, [] )
					.returns( [] );
				var packages = pkgFn( config );
				return packages.getDownloaded()
					.then( function( result ) {
						version = result;
					} );
			} );

			it( "should resolve to undefined", function() {
				expect( version ).to.be.undefined;
			} );

			it( "should call getAvailable on client", function() {
				fsMock.verify();
			} );
		} );

		describe( "without ignored versions", function() {
			var fsMock, version;
			before( function() {
				fsMock = sinon.mock( fsApi );
				fsMock
					.expects( "getVersions" )
					.withArgs( config.downloads, [] )
					.returns( [ { version: "0.1.0-3" }, { version: "0.1.0-1" }, { version: "0.1.0-5" } ] );
				var packages = pkgFn( config );
				return packages.getDownloaded()
					.then( function( result ) {
						version = result;
					} );
			} );

			it( "should resolve to the latest version", function() {
				version.should.eql( { version: "0.1.0-5" } );
			} );

			it( "should call getAvailable on client", function() {
				fsMock.verify();
			} );
		} );

		describe( "with ignored versions", function() {
			var fsMock, version;
			before( function() {
				var packages = pkgFn( config );
				packages.ignoreVersion( "0.1.0-5" );
				fsMock = sinon.mock( fsApi );
				fsMock
					.expects( "getVersions" )
					.withArgs( config.downloads, [ "0.1.0-5" ] )
					.returns( [ { version: "0.1.0-3" }, { version: "0.1.0-1" } ] );
				return packages.getDownloaded()
					.then( function( result ) {
						version = result;
					} );
			} );

			it( "should resolve to the latest version", function() {
				version.should.eql( { version: "0.1.0-3" } );
			} );

			it( "should call getVersions on fs", function() {
				fsMock.verify();
			} );
		} );
	} );

	describe( "when getting installed versions", function() {
		var installPath = path.join( config.installs, "test-me-master" );
		describe( "without any installed versions", function() {
			var packMock, version;
			before( function() {
				packMock = sinon.mock( packApi );
				packMock
					.expects( "getInstalled" )
					.withArgs( /.*/, installPath, [], true )
					.resolves( undefined );
				var packages = pkgFn( config );
				return packages.getInstalled()
					.then( function( result ) {
						version = result;
					} );
			} );

			it( "should resolve to undefined", function() {
				expect( version ).to.be.undefined;
			} );

			it( "should call getAvailable on client", function() {
				packMock.verify();
			} );
		} );

		describe( "without ignored versions", function() {
			var fsMock, packMock, version;
			before( function() {
				packMock = sinon.mock( packApi );
				packMock
					.expects( "getInstalled" )
					.withArgs( /.*/, installPath, [], true )
					.resolves( "0.1.0-1" );
				fsMock = sinon.mock( fsApi );
				fsMock
					.expects( "getInfo" )
					.withArgs( config, "0.1.0-1" )
					.returns( { version: "0.1.0-1" } );

				var packages = pkgFn( config );
				return packages.getInstalled()
					.then( function( result ) {
						version = result;
					} );
			} );

			it( "should resolve to the latest version", function() {
				version.should.eql( { version: "0.1.0-1" } );
			} );

			it( "should call getAvailable on client", function() {
				packMock.verify();
			} );

			it( "should call getInfo on file", function() {
				fsMock.verify();
			} );
		} );

		describe( "with ignored versions", function() {
			var fsMock, packMock, version;
			before( function() {
				var packages = pkgFn( config );
				packages.ignoreVersion( "0.1.0-3" );

				packMock = sinon.mock( packApi );
				packMock
					.expects( "getInstalled" )
					.withArgs( /.*/, installPath, [ "0.1.0-3" ], true )
					.resolves( "0.1.0-1" );
				fsMock = sinon.mock( fsApi );
				fsMock
					.expects( "getInfo" )
					.withArgs( config, "0.1.0-1" )
					.returns( { version: "0.1.0-1" } );

				return packages.getInstalled()
					.then( function( result ) {
						version = result;
					} );
			} );

			it( "should resolve to the latest version", function() {
				version.should.eql( { version: "0.1.0-1" } );
			} );

			it( "should call getAvailable on client", function() {
				packMock.verify();
			} );

			it( "should call getInfo on file", function() {
				fsMock.verify();
			} );
		} );
	} );

	describe( "when getting installation path", function() {
		var packages = pkgFn( config );
		describe( "without a version", function() {
			it( "should return expected path", function() {
				packages.getInstallPath()
					.should.eql( path.join( config.installs, "test-me-master" ) );
			} );
		} );

		describe( "with a version", function() {
			it( "should return expected path", function() {
				packages.getInstallPath( "0.2.3-4" )
					.should.eql( path.join( config.installs, "test-me-master", "0.2.3-4" ) );
			} );
		} );
	} );

	describe( "when checking if latest downloaded version is newest", function() {
		var packages;
		before( function() {
			packages = pkgFn( config );
		} );

		describe( "without latest state or available specified", function() {
			it( "should return false", function() {
				packages.hasNewerDownload().should.eql( false );
			} );
		} );

		describe( "without latest state", function() {
			it( "should return false", function() {
				packages.hasNewerDownload( "0.0.1" ).should.eql( false );
			} );
		} );

		describe( "with latest download", function() {
			before( function() {
				packages.state.latest = {
					downloadedVersion: "0.1.0"
				};
			} );

			it( "should return true if nothing is available and nothing is installed", function() {
				packages.hasNewerDownload().should.eql( true );
			} );

			it( "should return true if available is older and nothing is installed", function() {
				packages.hasNewerDownload( "0.0.1" ).should.eql( true );
			} );

			it( "should return false if available is newer and nothing is installed", function() {
				packages.hasNewerDownload( "0.1.1" ).should.eql( false );
			} );

			it( "should return true if nothing is available an older version is installed", function() {
				packages.state.latest.installedVersion = "0.0.1";
				packages.hasNewerDownload().should.eql( true );
			} );

			it( "should return false if nothing is available and newer version is installed", function() {
				packages.state.latest.installedVersion = "0.1.1";
				packages.hasNewerDownload().should.eql( false );
			} );

			it( "should return true if latest available and latest installed versions are older", function() {
				packages.state.latest.installedVersion = "0.0.1";
				packages.state.latest.availableVersion = "0.0.1";
				packages.hasNewerDownload().should.eql( true );
			} );

			it( "should return false if latest available is newer and installed version is older", function() {
				packages.state.latest.installedVersion = "0.0.1";
				packages.state.latest.availableVersion = "0.1.1";
				packages.hasNewerDownload().should.eql( false );
			} );

			after( function() {
				packages.state.latest = undefined;
			} );
		} );
	} );

	describe( "when checking if latest installed version is newest", function() {
		var packages;
		before( function() {
			packages = pkgFn( config );
		} );

		describe( "without latest state or available specified", function() {
			it( "should return false", function() {
				packages.hasLatestAvailable().should.eql( false );
			} );
		} );

		describe( "without latest state", function() {
			it( "should return false", function() {
				packages.hasLatestAvailable( "0.0.1" ).should.eql( false );
			} );
		} );

		describe( "with latest installed", function() {
			before( function() {
				packages.state.latest = {
					installedVersion: "0.1.0"
				};
			} );

			it( "should return true if nothing is available and nothing is downloaded", function() {
				packages.hasLatestAvailable().should.eql( true );
			} );

			it( "should return true if available is older and nothing is downloaded", function() {
				packages.hasLatestAvailable( "0.0.1" ).should.eql( true );
			} );

			it( "should return false if available is newer and nothing is downloaded", function() {
				packages.hasLatestAvailable( "0.1.1" ).should.eql( false );
			} );

			it( "should return true if nothing is available an older version is downloaded", function() {
				packages.state.latest.downloadedVersion = "0.0.1";
				packages.hasLatestAvailable().should.eql( true );
			} );

			it( "should return false if nothing is available and newer version is downloaded", function() {
				packages.state.latest.downloadedVersion = "0.1.1";
				packages.hasLatestAvailable().should.eql( false );
			} );

			it( "should return true if latest available and latest downloaded versions are older", function() {
				packages.state.latest.downloadedVersion = "0.0.1";
				packages.state.latest.availableVersion = "0.0.1";
				packages.hasLatestAvailable().should.eql( true );
			} );

			it( "should return false if latest available is newer and downloaded version is older", function() {
				packages.state.latest.downloadedVersion = "0.0.1";
				packages.state.latest.availableVersion = "0.1.1";
				packages.hasLatestAvailable().should.eql( false );
			} );

			after( function() {
				packages.state.latest = undefined;
			} );
		} );
	} );

	describe( "when checking for a valid download", function() {
		describe( "without any downloaded versions", function() {

			describe( "with a configured version", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.0";
					packages = pkgFn( config );
					packages.state.latest = {};
					packages.state.current = {};
				} );

				it( "should return false", function() {
					packages.hasValidDownload().should.eql( false );
				} );
			} );

			describe( "without a configured version", function() {
				var packages;
				before( function() {
					config.package.version = undefined;
					packages = pkgFn( config );
					packages.state.latest = {};
					packages.state.current = {};
				} );

				it( "should return false", function() {
					packages.hasValidDownload().should.eql( false );
				} );
			} );

			after( function() {
				config.package.version = undefined;
			} );
		} );

		describe( "with a downloaded version", function() {
			describe( "when downloaded version matches configured version", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.0";
					packages = pkgFn( config );
					packages.state.latest = { downloadedVersion: "0.1.0" };
				} );

				it( "should return true", function() {
					packages.hasValidDownload().should.eql( true );
				} );
			} );


			describe( "when the downloaded version is compatible with the configured version", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.0";
					packages = pkgFn( config );
					packages.state.latest = { downloadedVersion: "0.1.0-1" };
				} );

				it( "should return true", function() {
					packages.hasValidDownload().should.eql( true );
				} );
			} );

			describe( "when the configured version is release only and downloaded version has a build number", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.0";
					config.package.releaseOnly = true;
					packages = pkgFn( config );
					packages.state.latest = { downloadedVersion: "0.1.0-1" };
				} );

				it( "should return false", function() {
					packages.hasValidDownload().should.eql( false );
				} );

				after( function() {
					config.package.releaseOnly = false;
				} );
			} );

			describe( "when the configured and downloaded versions don't match", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.1";
					packages = pkgFn( config );
					packages.state.latest = { downloadedVersion: "0.1.0" };
				} );

				it( "should return false", function() {
					packages.hasValidDownload().should.eql( false );
				} );
			} );

			describe( "without a configured version", function() {
				var packages;
				before( function() {
					config.package.version = undefined;
					packages = pkgFn( config );
					packages.state.latest = { downloadedVersion: "0.1.0" };
				} );

				it( "should return true", function() {
					packages.hasValidDownload().should.eql( true );
				} );
			} );

			after( function() {
				config.package.version = undefined;
			} );
		} );
	} );

	describe( "when checking for a valid install", function() {
		describe( "without any installed versions", function() {

			describe( "with a configured version", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.0";
					packages = pkgFn( config );
					packages.state.latest = {};
					packages.state.current = {};
				} );

				it( "should return false", function() {
					packages.hasValidInstall().should.eql( false );
				} );
			} );

			describe( "without a configured version", function() {
				var packages;
				before( function() {
					config.package.version = undefined;
					packages = pkgFn( config );
					packages.state.latest = {};
					packages.state.current = {};
				} );

				it( "should return false", function() {
					packages.hasValidInstall().should.eql( false );
				} );
			} );

			after( function() {
				config.package.version = undefined;
			} );
		} );

		describe( "with an installed version", function() {
			describe( "when latest installed version matches configured version", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.0";
					packages = pkgFn( config );
					packages.state.current = {};
					packages.state.latest = { installedVersion: "0.1.0" };
				} );

				it( "should return true", function() {
					packages.hasValidInstall().should.eql( true );
				} );
			} );

			describe( "when current installed version matches configured version", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.0";
					packages = pkgFn( config );
					packages.state.current = { installedVersion: "0.1.0" };
					packages.state.latest = {};
				} );

				it( "should return true", function() {
					packages.hasValidInstall().should.eql( true );
				} );
			} );

			describe( "when latest installed version is compatible with the configured version", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.0";
					packages = pkgFn( config );
					packages.state.current = {};
					packages.state.latest = { installedVersion: "0.1.0-1" };
				} );

				it( "should return true", function() {
					packages.hasValidInstall().should.eql( true );
				} );
			} );

			describe( "when current installed version is compatible with the configured version", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.0";
					packages = pkgFn( config );
					packages.state.current = { installedVersion: "0.1.0-1" };
					packages.state.latest = {};
				} );

				it( "should return true", function() {
					packages.hasValidInstall().should.eql( true );
				} );
			} );

			describe( "when the configured version is release only and the latest installed version has a build number", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.0";
					config.package.releaseOnly = true;
					packages = pkgFn( config );
					packages.state.current = {};
					packages.state.latest = { installedVersion: "0.1.0-1" };
				} );

				it( "should return false", function() {
					packages.hasValidInstall().should.eql( false );
				} );

				after( function() {
					config.package.releaseOnly = false;
				} );
			} );

			describe( "when the configured version is release only and the current installed version has a build number", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.0";
					config.package.releaseOnly = true;
					packages = pkgFn( config );
					packages.state.current = { installedVersion: "0.1.0-1" };
					packages.state.latest = {};
				} );

				it( "should return false", function() {
					packages.hasValidInstall().should.eql( false );
				} );

				after( function() {
					config.package.releaseOnly = false;
				} );
			} );

			describe( "when the configured and latest installed versions don't match", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.1";
					packages = pkgFn( config );
					packages.state.current = {};
					packages.state.latest = { installedVersion: "0.1.0" };
				} );

				it( "should return false", function() {
					packages.hasValidInstall().should.eql( false );
				} );
			} );

			describe( "when the configured and current installed versions don't match", function() {
				var packages;
				before( function() {
					config.package.version = "0.1.1";
					packages = pkgFn( config );
					packages.state.current = { installedVersion: "0.1.0" };
					packages.state.latest = {};
				} );

				it( "should return false", function() {
					packages.hasValidInstall().should.eql( false );
				} );
			} );

			describe( "with latest install but no configured version", function() {
				var packages;
				before( function() {
					config.package.version = undefined;
					packages = pkgFn( config );
					packages.state.current = {};
					packages.state.latest = { installedVersion: "0.1.0" };
				} );

				it( "should return true", function() {
					packages.hasValidInstall().should.eql( true );
				} );
			} );

			describe( "with current install but no configured version", function() {
				var packages;
				before( function() {
					config.package.version = undefined;
					packages = pkgFn( config );
					packages.state.current = { installedVersion: "0.1.0" };
					packages.state.latest = {};
				} );

				it( "should return true", function() {
					packages.hasValidInstall().should.eql( true );
				} );
			} );

			after( function() {
				config.package.version = undefined;
			} );
		} );
	} );

	describe( "when getting next step", function() {
		describe( "and skipping check for new", function() {
			describe( "without a new available version", function() {
				describe( "and no installations or downloads", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a wait operation", function() {
						nextStep.should.eql( "wait" );
					} );
				} );

				describe( "and the latest installation but no downloads", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.current.installedVersion = "0.1.0-10";
						packages.state.latest.installedVersion = "0.1.0-10";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a load operation", function() {
						nextStep.should.eql( "load" );
					} );
				} );

				describe( "and the latest download but no installation", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.latest.downloadedVersion = "0.1.0-10";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a install operation", function() {
						nextStep.should.eql( "install" );
					} );
				} );

				describe( "and the latest download and an older installation", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.current.installedVersion = "0.1.0-9";
						packages.state.latest.installedVersion = "0.1.0-9";
						packages.state.latest.downloadedVersion = "0.1.0-10";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a install operation", function() {
						nextStep.should.eql( "install" );
					} );
				} );

				describe( "and the latest download and installation", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.current.installedVersion = "0.1.0-8";
						packages.state.latest.installedVersion = "0.1.0-8";
						packages.state.latest.downloadedVersion = "0.1.0-8";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a load operation", function() {
						nextStep.should.eql( "load" );
					} );
				} );

				describe( "and the latest installation and an old download (should never happen)", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.current.installedVersion = "0.1.0-9";
						packages.state.latest.installedVersion = "0.1.0-9";
						packages.state.latest.downloadedVersion = "0.1.0-8";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a load operation", function() {
						nextStep.should.eql( "load" );
					} );
				} );
			} );

			describe( "with an available version", function() {
				describe( "and no installations or downloads", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.latest.availableVersion = "0.1.0-1";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a download operation", function() {
						nextStep.should.eql( "download" );
					} );
				} );

				describe( "and an older installation but no downloads", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.latest.availableVersion = "0.1.0-11";
						packages.state.current.installedVersion = "0.1.0-10";
						packages.state.latest.installedVersion = "0.1.0-10";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a download operation", function() {
						nextStep.should.eql( "download" );
					} );
				} );

				describe( "and the latest installation but no downloads", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.latest.availableVersion = "0.1.0-10";
						packages.state.current.installedVersion = "0.1.0-10";
						packages.state.latest.installedVersion = "0.1.0-10";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a load operation", function() {
						nextStep.should.eql( "load" );
					} );
				} );

				describe( "and the latest download but no installation", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.latest.availableVersion = "0.1.0-10";
						packages.state.latest.downloadedVersion = "0.1.0-10";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a install operation", function() {
						nextStep.should.eql( "install" );
					} );
				} );

				describe( "and the latest download and an older installation", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.latest.availableVersion = "0.1.0-10";
						packages.state.current.installedVersion = "0.1.0-9";
						packages.state.latest.installedVersion = "0.1.0-9";
						packages.state.latest.downloadedVersion = "0.1.0-10";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a install operation", function() {
						nextStep.should.eql( "install" );
					} );
				} );

				describe( "and the latest download and installation", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.latest.availableVersion = "0.1.0-8";
						packages.state.current.installedVersion = "0.1.0-8";
						packages.state.latest.installedVersion = "0.1.0-8";
						packages.state.latest.downloadedVersion = "0.1.0-8";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a load operation", function() {
						nextStep.should.eql( "load" );
					} );
				} );

				describe( "and the latest installation and an old download (should never happen)", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.latest.availableVersion = "0.1.0-9";
						packages.state.current.installedVersion = "0.1.0-9";
						packages.state.latest.installedVersion = "0.1.0-9";
						packages.state.latest.downloadedVersion = "0.1.0-8";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a load operation", function() {
						nextStep.should.eql( "load" );
					} );
				} );

				describe( "and an old installation and download", function() {
					var packages, nextStep;
					before( function() {
						packages = pkgFn( config );
						packages.state.latest.availableVersion = "0.1.0-10";
						packages.state.current.installedVersion = "0.1.0-9";
						packages.state.latest.installedVersion = "0.1.0-9";
						packages.state.latest.downloadedVersion = "0.1.0-8";
						packages.getNextStep( true )
							.then( function( result ) {
								nextStep = result;
							} );
					} );

					it( "should result in a download operation", function() {
						nextStep.should.eql( "download" );
					} );
				} );
			} );
		} );
	} );

	describe( "when initializing", function() {
		describe( "with failed available check", function() {
			var packages, clientMock, packMock, fsMock, info, nextStep;
			before( function() {
				clientMock = sinon.mock( indexClientApi.client );
				clientMock.expects( "getLatest" )
					.rejects( new Error( "no connection" ) );

				packMock = sinon.mock( packApi );
				packMock.expects( "getInstalled" )
					.resolves( "0.1.0-1" );

				info = {
					owner: "me",
					project: "test",
					branch: "master",
					version: "0.1.0-1",
					slug: "01234567"
				};
				fsMock = sinon.mock( fsApi );
				fsMock.expects( "getInfo" )
					.resolves( info );

				fsMock.expects( "getVersions" )
					.returns( [ { version: "0.1.0-1" } ] );

				packages = pkgFn( config );
				return packages.initialize()
					.then( function( result ) {
						nextStep = result;
					} );
			} );

			it( "should return load operation", function() {
				nextStep.should.eql( "load" );
			} );

			it( "should call packages getInstalled", function() {
				packMock.verify();
			} );

			it( "should call fs getInfo and getVersions", function() {
				fsMock.verify();
			} );

			it( "should client getLatest", function() {
				clientMock.verify();
			} );
		} );

		describe( "with no available versions", function() {
			var packages, clientMock, packMock, fsMock, info, nextStep;
			before( function() {
				clientMock = sinon.mock( indexClientApi.client );
				clientMock.expects( "getLatest" )
					.resolves( undefined );

				packMock = sinon.mock( packApi );
				packMock.expects( "getInstalled" )
					.resolves( "0.1.0-1" );

				info = {
					owner: "me",
					project: "test",
					branch: "master",
					version: "0.1.0-1",
					slug: "01234567"
				};
				fsMock = sinon.mock( fsApi );
				fsMock.expects( "getInfo" )
					.resolves( info );

				fsMock.expects( "getVersions" )
					.returns( [ { version: "0.1.0-2" } ] );

				packages = pkgFn( config );
				return packages.initialize()
					.then( function( result ) {
						nextStep = result;
					} );
			} );

			it( "should return install operation", function() {
				nextStep.should.eql( "install" );
			} );

			it( "should call packages getInstalled", function() {
				packMock.verify();
			} );

			it( "should call fs getInfo and getVersions", function() {
				fsMock.verify();
			} );

			it( "should client getLatest", function() {
				clientMock.verify();
			} );
		} );

		describe( "with available version", function() {
			var packages, clientMock, packMock, fsMock, info, nextStep;
			before( function() {
				clientMock = sinon.mock( indexClientApi.client );
				clientMock.expects( "getLatest" )
					.resolves( { version: "0.1.0-3" } );

				packMock = sinon.mock( packApi );
				packMock.expects( "getInstalled" )
					.resolves( "0.1.0-1" );

				info = {
					owner: "me",
					project: "test",
					branch: "master",
					version: "0.1.0-1",
					slug: "01234567"
				};
				fsMock = sinon.mock( fsApi );
				fsMock.expects( "getInfo" )
					.resolves( info );

				fsMock.expects( "getVersions" )
					.returns( [ { version: "0.1.0-2" } ] );

				packages = pkgFn( config );
				return packages.initialize()
					.then( function( result ) {
						nextStep = result;
					} );
			} );

			it( "should return download operation", function() {
				nextStep.should.eql( "download" );
			} );

			it( "should call packages getInstalled", function() {
				packMock.verify();
			} );

			it( "should call fs getInfo and getVersions", function() {
				fsMock.verify();
			} );

			it( "should client getLatest", function() {
				clientMock.verify();
			} );
		} );
	} );

	describe( "when loading bootfile", function() {
		var packages;
		before( function() {
			packages = pkgFn( config );
		} );

		describe( "with invalid install path", function() {
			var fsMock;
			before( function() {
				packages.state.current.installedPath = "lol";
				fsMock = sinon.mock( fsApi );
				fsMock.expects( "exists" )
					.withArgs( "lol" )
					.returns( false );
			} );

			it( "should reject", function() {
				return packages.loadBootFile()
					.should.eventually.be.rejected;
			} );

			it( "should call fs exists", function() {
				fsMock.verify();
			} );
		} );

		describe( "with valid install path", function() {
			var fsMock, bootMock;
			before( function() {
				packages.state.current.installedPath = "/lol";
				fsMock = sinon.mock( fsApi );
				fsMock.expects( "exists" )
					.withArgs( "/lol" )
					.returns( true );
				bootMock = sinon.mock( bootFileApi );
				bootMock.expects( "get" )
					.withArgs( "/lol" )
					.resolves( {} );
			} );

			it( "should resolve", function() {
				return packages.loadBootFile()
					.should.eventually.eql( {} );
			} );

			it( "should call fs exists", function() {
				fsMock.verify();
			} );

			it( "should call bootFile get", function() {
				bootMock.verify();
			} );
		} );
	} );

	describe( "when ignoring version", function() {
		var packages;
		before( function() {
			packages = pkgFn( config );
			packages.state.latest.availableVersion = "0.1.5";
			packages.state.latest.available = { version: "0.1.5" };
			packages.ignoreVersion( "0.1.5" );
		} );

		it( "should add version to ignored versions in state", function() {
			packages.state.ignoredVersions.should.eql( [ "0.1.5" ] );
		} );

		it( "should clear latest available from state", function() {
			should.not.exist( packages.state.latest.available );
			should.not.exist( packages.state.latest.availableVersion );
		} );
	} );

	describe( "when installing", function() {
		var fsMock, packMock, packages, package, packageInfo, installPath, versionedPath, installed;
		before( function() {
			package = "test~me~master~a123b456~0.1.0~1~linux~any~any~x64.tar.gz";
			packageInfo = {
				owner: "me",
				branch: "master",
				project: "test",
				slug: "a123b456",
				version: "0.1.0-1",
				build: "1",
				platform: "linux",
				architecture: "x64"
			};

			packages = pkgFn( config );
			installPath = path.join( config.installs, "test-me-master" );
			versionedPath = path.join( installPath, "0.1.0-1" );

			packMock = sinon.mock( packApi );
			packMock.expects( "parse" )
				.withArgs( "", package )
				.returns( packageInfo );

			packMock.expects( "unpack" )
				.withArgs( package, versionedPath )
				.resolves( packageInfo );

			fsMock = sinon.mock( fsApi );
			fsMock.expects( "ensurePath" )
				.withArgs( installPath );

			return packages.install( package )
				.then( function( result ) {
					installed = result;
				} );
		} );

		it( "should have called fs ensurePath", function() {
			fsMock.verify();
		} );

		it( "should have called package parse and unpack", function() {
			packMock.verify();
		} );

		it( "should have resolved with package info", function() {
			installed.should.eql( packageInfo );
		} );
	} );

	describe( "when resetting state", function() {
		describe( "without pre-exsting state (during init)", function() {
			var packages, result, installPath;
			before( function() {
				installPath = path.join( config.installs, "test-me-master" );
				packages = pkgFn( config );
				result = packages.reset();
			} );

			it( "should revert to initial state", function() {
				result.should.eql(
					{
						owner: "me",
						branch: "master",
						project: "test",
						current: {
							status: undefined,
							installedVersion: undefined,
							installedPath: undefined,
							installationPath: installPath,
							installedInfo: undefined,
							slug: undefined
						},
						ignoredVersions: [],
						lastIndexCheck: undefined,
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
					}
				);
			} );
		} );

		describe( "with pre-existing state", function() {
			var packages, result, installPath, stamp;
			before( function() {
				stamp = Date.now();
				installPath = path.join( config.installs, "test-me-master" );
				packages = pkgFn( config );
				packages.state.lastIndexCheck = stamp;
				packages.state.ignoredVersions = [ "0.1.0-1", "0.1.0-7" ];
				packages.state.downloadedVersions = [ "0.1.0-1", "0.1.0-7", "0.1.1-1" ];
				packages.state.current.status = "busted";
				packages.state.latest.slug = ":(";
				result = packages.reset();
			} );

			it( "should revert to initial state", function() {
				packages.state.should.eql(
					{
						owner: "me",
						branch: "master",
						project: "test",
						current: {
							status: undefined,
							installedVersion: undefined,
							installedPath: undefined,
							installationPath: installPath,
							installedInfo: undefined,
							slug: undefined
						},
						ignoredVersions: [],
						lastIndexCheck: stamp,
						downloadedVersions: [ "0.1.0-1", "0.1.0-7", "0.1.1-1" ],
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
					}
				);
			} );
		} );
	} );

	describe( "when setting installed version", function() {
		describe( "when version will be the latest", function() {
			var packages, versionPath, packageInfo;
			before( function() {
				versionPath = path.join( config.installs, "test-me-master/0.1.0-5" );
				packageInfo = {
					version: "0.1.0-5",
					owner: "me",
					branch: "master",
					project: "test",
					slug: "1a2b3c4d"
				};

				packages = pkgFn( config );
				packages.state.latest = {};
				packages.state.current = {};
				packages.state.latest.installedVersion = "0.1.0-1";
				packages.setInstalled( packageInfo );
			} );

			it( "should set current installedVersion", function() {
				packages.state.current.installedVersion.should.eql( "0.1.0-5" );
			} );

			it( "should set current installedPath", function() {
				packages.state.current.installedPath.should.eql( versionPath );
			} );

			it( "should set current slug", function() {
				packages.state.current.slug.should.eql( "1a2b3c4d" );
			} );

			it( "should update latest installedVersion", function() {
				packages.state.latest.installedVersion.should.eql( "0.1.0-5" );
			} );

			it( "should update latest install", function() {
				packages.state.latest.install.should.eql( packageInfo );
			} );
		} );

		describe( "when version is not newer", function() {
			var packages, versionPath, packageInfo, latest;
			before( function() {
				versionPath = path.join( config.installs, "test-me-master/0.1.0-5" );
				packageInfo = {
					version: "0.1.0-5",
					owner: "me",
					branch: "master",
					project: "test",
					slug: "1a2b3c4d"
				};
				latest = {
					version: "0.1.0",
					owner: "me",
					branch: "master",
					project: "test",
					slug: "a1b2c3d4"
				};

				packages = pkgFn( config );
				packages.state.latest = latest;
				packages.state.current = {};
				packages.state.latest.installedVersion = "0.1.0";
				packages.state.latest.install = latest;
				packages.setInstalled( packageInfo );
			} );

			it( "should set current installedVersion", function() {
				packages.state.current.installedVersion.should.eql( "0.1.0-5" );
			} );

			it( "should set current installedPath", function() {
				packages.state.current.installedPath.should.eql( versionPath );
			} );

			it( "should set current slug", function() {
				packages.state.current.slug.should.eql( "1a2b3c4d" );
			} );

			it( "should update latest installedVersion", function() {
				packages.state.latest.installedVersion.should.eql( "0.1.0" );
			} );

			it( "should update latest install", function() {
				packages.state.latest.install.should.eql( latest );
			} );

			it( "should set latest slug", function() {
				packages.state.latest.slug.should.eql( "a1b2c3d4" );
			} );
		} );
	} );

	describe( "when setting latest download", function() {
		var packages, info;
		before( function() {
			packages = pkgFn( config );
			info = {
				owner: "me",
				project: "test",
				branch: "master",
				version: "0.1.0-3",
				slug: "11aa22bb33cc",
				fullPath: "immafile.tar.gz"
			};
			packages.setLatestDownload( info );
		} );

		it( "should update latest info ", function() {
			packages.state.latest.download.should.eql( info );
		} );

		it( "should update latest downloaded ", function() {
			packages.state.latest.downloadedFile.should.eql( "immafile.tar.gz" );
		} );

		it( "should update latest downloaded ", function() {
			packages.state.latest.downloadedVersion.should.eql( "0.1.0-3" );
		} );

		it( "should update latest downloaded ", function() {
			packages.state.latest.downloadedSlug.should.eql( "11aa22bb33cc" );
		} );
	} );

	describe( "when updating configuration", function() {
		var packages, indexMock, newConfig, merged, control;
		before( function() {
			var cloned = _.clone( config );
			control = controlFn( config, { reset: _.noop } );
			packages = pkgFn( cloned );
			newConfig = {
				package: {
					owner: "you",
					branch: "develop",
					version: "0.2.0"
				}
			};
			control.configure( [
				{ op: "change", field: "owner", value: "you" },
				{ op: "change", field: "branch", value: "develop" },
				{ op: "change", field: "version", value: "0.2.0" },
			] );
			packages.updateConfig( newConfig );
		} );

		it( "should change package state", function() {
			packages.state.owner.should.eql( "you" );
			packages.state.branch.should.eql( "develop" );
		} );
	} );
} );
