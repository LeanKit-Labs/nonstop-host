require( "../setup" );
var config = require( "../../src/config.js" )( {
	index: {
		frequency: 100
	},
	package: { // jshint ignore : line
		branch: "master",
		owner: "me",
		project: "test"
	}
} );

describe( "Index Client", function() {
	describe( "when creating client", function() {
		var indexClient, client, newConfig, merged;
		before( function() {
			newConfig = {
					package: {
						branch: "develop"
					}
				};
			merged = _.merge( {}, config, newConfig );
			indexClient = sinon.stub();
			var clientFn = proxyquire( "../src/indexClient.js", {
				"nonstop-index-client": indexClient
			} );
			client = clientFn( config );
			client.update( merged );
		} );

		it( "should pass the correct configuration to the index lib", function() {
			indexClient.getCall( 0 ).args.should.eql( [ { index: config.index, package: config.package } ] );
		} );

		it( "should pass the correct configuration to the index lib", function() {
			indexClient.getCall( 1 ).args.should.eql( [ { index: merged.index, package: merged.package } ] );
		} );

		it( "should set client config", function() {
			client.config.should.eql( merged );
		} );
	} );
} );
