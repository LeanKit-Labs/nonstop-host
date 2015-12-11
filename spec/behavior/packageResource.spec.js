require( "../setup" );
var packageResource = require( "../../resource/package/resource.js" );

describe( "Package Resource", function() {
	var server = { checkForNew: _.noop };
	describe( "when getting new package callback", function() {
		describe( "with matching package", function() {
			var config, serverMock, result;
			before( function() {
				config = {
					package: {
						project: "imatch"
					}
				};
				serverMock = sinon.mock( server );
				serverMock.expects( "checkForNew" ).once();
				var	envelope = { data: { project: "imatch" } };
				var handler = packageResource( {}, config, server );
				result = handler.actions.new.handle( envelope );
			} );

			it( "should call checkForNew", function() {
				serverMock.verify();
			} );

			it( "should result in a status 200", function() {
				result.should.eql( { status: 200 } );
			} );
		} );

		describe( "with mis-matched package", function() {
			var config, serverMock, result;
			before( function() {
				config = {
					package: {
						project: "lol-aint-no-such"
					}
				};
				serverMock = sinon.mock( server );
				serverMock.expects( "checkForNew" ).never();
				var	envelope = { data: { project: "imatch" } };
				var handler = packageResource( {}, config, server );
				result = handler.actions.new.handle( envelope );
			} );

			it( "should not call checkForNew", function() {
				serverMock.verify();
			} );

			it( "should result in a status 200", function() {
				result.should.eql( { status: 200 } );
			} );
		} );
	} );
} );
