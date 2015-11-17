require( "../setup" );
var filterFn = require( "../../src/filter" );

describe( "Filter", function() {
	var filter;

	before( function() {
		filter = filterFn( {
			architecture: "x64",
			branch: undefined,
			build: undefined,
			owner: undefined,
			platform: "darwin",
			project: undefined,
			releaseOnly: false,
			version: undefined,
			os: {}
		} );

		filter.owner( "me" );
		filter.branch( "master" );
		filter.project( "test" );
	} );

	it( "should produce correct hash", function() {
		filter.toHash().should.eql( {
			architecture: "x64",
			branch: "master",
			owner: "me",
			platform: "darwin",
			project: "test"
		} );
	} );

	it( "should produce correct string", function() {
		filter.toString().should.equal( "project=test&owner=me&branch=master&architecture=x64&platform=darwin" );
	} );

	describe( "after changes are made", function() {
		before( function() {
			filter.project( "test-2" );
			filter.version( "0.1.1-1" );
		} );

		it( "should produce correct hash", function() {
			filter.toHash().should.eql( {
				architecture: "x64",
				branch: "master",
				owner: "me",
				platform: "darwin",
				project: "test-2",
				version: "0.1.1-1"
			} );
		} );

		it( "should produce correct string", function() {
			filter.toString().should.equal( "project=test-2&owner=me&branch=master&version=0.1.1-1&architecture=x64&platform=darwin" );
		} );
	} );
} );
