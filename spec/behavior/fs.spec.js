require( "../setup" );
var filter = require( "../../src/filter" );

describe( "File System", function() {
	var fsMock = {
		existsSync: _.noop,
		readdirSync: _.noop,
		readFileSync: _.noop
	};
	var fs;
	before( function() {
		fs = proxyquire( "../src/fs", {
			fs: fsMock
		} );
	} );

	describe( "when getting nonstop information", function() {
		var properties = {
			project: "test",
			owner: "me",
			branch: "develop",
			version: "0.1.0"
		};
		var installPath = path.resolve( "./installs" );
		var filePath = path.resolve(
			"./installs",
			[ properties.project, properties.owner, properties.branch ].join( "-" ),
			properties.version,
			".nonstop-info.json"
		);

		describe( "when file does not exist", function() {
			var mock, config;
			before( function() {
				config = {
					filter: filter( properties ),
					installs: installPath
				};

				mock = sinon.mock( fsMock );
				mock.expects( "existsSync" )
					.withArgs( filePath )
					.returns( false );
			} );

			it( "should return version only", function() {
				fs.getInfo( config, properties.version )
					.should.eql( { version: properties.version } );
			} );

			after( function() {
				mock.verify();
			} );
		} );

		describe( "when file exists", function() {
			var mock, config;
			before( function() {
				config = {
					filter: filter( properties ),
					installs: installPath
				};

				mock = sinon.mock( fsMock );
				mock.expects( "existsSync" )
					.withArgs( filePath )
					.returns( true );

				mock.expects( "readFileSync" )
					.withArgs( filePath )
					.returns( JSON.stringify( properties ) );
			} );

			it( "should return correct information", function() {
				fs.getInfo( config, "0.1.0" )
					.should.eql( properties );
			} );

			after( function() {
				mock.verify();
			} );
		} );
	} );

	describe( "when getting downloaded versions", function() {
		var downloadPath = path.resolve( "./downloads" );

		describe( "without download folder", function() {
			var mock;
			before( function() {
				mock = sinon.mock( fsMock );
				mock.expects( "existsSync" )
					.withArgs( downloadPath )
					.returns( false );
			} );

			it( "should return an empty list", function() {
				fs.getVersions( downloadPath ).should.eql( [] );
			} );

			after( function() {
				mock.verify();
			} );
		} );

		describe( "with empty download folder", function() {
			var mock;
			before( function() {
				mock = sinon.mock( fsMock );
				mock.expects( "existsSync" )
					.withArgs( downloadPath )
					.returns( true );
				mock.expects( "readdirSync" )
					.withArgs( downloadPath )
					.returns( [] );
			} );

			it( "should return an empty list", function() {
				fs.getVersions( downloadPath ).should.eql( [] );
			} );

			after( function() {
				mock.verify();
			} );
		} );

		describe( "with downloaded files", function() {
			var mock;
			before( function() {
				mock = sinon.mock( fsMock );
				mock.expects( "existsSync" )
					.twice()
					.withArgs( downloadPath )
					.returns( true );
				mock.expects( "readdirSync" )
					.twice()
					.withArgs( downloadPath )
					.returns( [
						"proj~owner~branch~0123abcd~0.1.0~1~linux~any~any~x64.tar.gz",
						"proj~owner~branch~0124abcd~0.1.0~2~linux~any~any~x64.tar.gz",
						"proj~owner~branch~0125abcd~0.1.0~3~linux~any~any~x64.tar.gz"
					] );
			} );

			it( "should return full list", function() {
				return fs.getVersions( downloadPath ).should.partiallyEql( [
					{
						project: "proj",
						owner: "owner",
						branch: "branch",
						version: "0.1.0-1",
						build: "1",
						slug: "0123abcd",
						platform: "linux",
						osName: "any",
						osVersion: "any",
						architecture: "x64"
					},
					{
						project: "proj",
						owner: "owner",
						branch: "branch",
						version: "0.1.0-2",
						build: "2",
						slug: "0124abcd",
						platform: "linux",
						osName: "any",
						osVersion: "any",
						architecture: "x64"
					},
					{
						project: "proj",
						owner: "owner",
						branch: "branch",
						version: "0.1.0-3",
						build: "3",
						slug: "0125abcd",
						platform: "linux",
						osName: "any",
						osVersion: "any",
						architecture: "x64"
					}
				] );
			} );

			describe( "with ignored versions", function() {
				it( "should exclude ignored versions", function() {
					return fs.getVersions( downloadPath, [ "0.1.0-2" ] ).should.partiallyEql( [
						{
							project: "proj",
							owner: "owner",
							branch: "branch",
							version: "0.1.0-1",
							build: "1",
							slug: "0123abcd",
							platform: "linux",
							osName: "any",
							osVersion: "any",
							architecture: "x64"
						},
						{
							project: "proj",
							owner: "owner",
							branch: "branch",
							version: "0.1.0-3",
							build: "3",
							slug: "0125abcd",
							platform: "linux",
							osName: "any",
							osVersion: "any",
							architecture: "x64"
						}
					] );
				} );
			} );

			after( function() {
				mock.verify();
			} );
		} );
	} );
} );
