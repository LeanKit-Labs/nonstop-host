require( "../setup" );

var sampleEnv = {
	PASSWORD: "secret",
	user_pass: "secret",
	OTHER_SECRET: "secret",
	secret_word: "secret",
	APITOKEN: "secret",
	my_token: "secret",
	normal: "not secret"
};

describe( "Status Resource", function() {
	var statusResourceFactory = require( "../../resource/status/resource.js" );
	describe( "environment", function() {
		var result;
		before( function() {
			_.extend( process.env, sampleEnv );

			var resource = statusResourceFactory();
			result = resource.actions.environment.handle();
		} );

		it( "should redact anything containing \"pass\" regardless of case", function() {
			result.PASSWORD.should.equal( "redacted" );
			result.user_pass.should.equal( "redacted" );
		} );

		it( "should redact anything containing \"secret\" regardless of case", function() {
			result.OTHER_SECRET.should.equal( "redacted" );
			result.secret_word.should.equal( "redacted" );
		} );

		it( "should redact anything containing \"token\" regardless of case", function() {
			result.APITOKEN.should.equal( "redacted" );
			result.my_token.should.equal( "redacted" );
		} );

		it( "should return all other variables un-redacted", function() {
			result.normal.should.equal( "not secret" );
		} );

		after( function() {
			Object.keys( sampleEnv ).forEach( function( k ) {
				delete process.env[ k ];
			} );
		} );
	} );
} );
