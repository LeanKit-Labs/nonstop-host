require( "../setup" );
var config = require( "../../src/config.js" )( {
	index: {
		frequency: 100
	},
	package: {
		project: "test",
		owner: "me",
		branch: "master",
		files: "./downloads"
	},
	service: {
		host: {
			name: "test-host",
			ip: "192.168.1.100",
			port: {
				public: 9090
			}
		}
	}
} );

var registerFn = require( "../../src/registration" );
var nock = require( "nock" );

describe( "Registration", function() {
	describe( "when registering with index", function() {
		describe( "without initial connectivity", function() {
			var api, registration, register, hookCreate;
			before( function( done ) {
				api = registerFn( config );
				register = api.register();
				registration = nock( "http://localhost:4444" )
						.post( "/nonstop/host" )
						.reply( 201, {
							_origin: {
								href: "/nonstop/host",
								method: "post"
							},
							_links: {},
							status: 201,
							name: "test",
							message: "Host test added successfully"
						}, {
							"content-type": "application/json"
						} );
				hookCreate = nock( "http://localhost:4444" )
						.post( "/hook/test-host%3A9090" )
						.reply( 201, {
							_origin: {
								href: "/nonstop/host",
								method: "post"
							},
							_links: {},
							status: 201,
							id: "test-host:9090",
							message: "Webhook test-host added successfully"
						}, {
							"content-type": "application/json"
						} );

				setTimeout( function() {
					done();
				}, 5 );
			} );

			describe( "with eventual connection", function() {
				var options, response;
				before( function() {
					options = nock( "http://localhost:4444" )
						.intercept( "/api", "OPTIONS" )
						.reply( 200, { _links: {
							"host:register": {
								href: "/nonstop/host",
								method: "post"
							},
							"hook:self": {
								href: "/hook/{id}",
								method: "get",
								templated: true
							},
							"hook:add": {
								href: "/hook/{id}",
								method: "post",
								templated: true
							}
						} } );

					return register
						.then( function( result ) {
							response = result;
						} );
				} );

				it( "should make expected HTTP calls", function() {
					options.isDone();
					registration.isDone();
					hookCreate.isDone();
				} );

				it( "should resolve to the server response", function() {
					response.should.eql( {
							_origin: {
								href: "/nonstop/host",
								method: "post"
							},
							_links: {},
							status: 201,
							name: "test",
							message: "Host test added successfully"
						} );
				} );

				after( function() {
					options.done();
					registration.done();
					api.reset();
				} );
			} );
		} );

		after( function() {
			nock.cleanAll();
		} );
	} );

	describe( "when creating web hook", function() {
		describe( "without initial connectivity", function() {
			var api, hook, hookSelf, hookCreate;
			before( function( done ) {
				api = registerFn( config );
				hook = api.createHook();
				hookSelf = nock( "http://localhost:4444" )
					.get( "/hook/test-host%3A9090" )
					.reply( 404, {} );
				hookCreate = nock( "http://localhost:4444" )
					.post( "/hook/test-host%3A9090", {
						id: "test-host:9090",
						url: "http://192.168.1.100:9090/api/package",
						method: "POST",
						headers: {},
						events: [ "package.#" ]
					} )
					.reply( 201, {
						_origin: {
							href: "/nonstop/host",
							method: "post"
						},
						_links: {},
						status: 201,
						id: "test-host:9090",
						message: "Webhook test-host added successfully"
					}, {
						"content-type": "application/json"
					} );
				setTimeout( function() {
					done();
				}, 5 );
			} );

			describe( "with eventual connection", function() {
				var options, response;
				before( function() {
					options = nock( "http://localhost:4444" )
						.intercept( "/api", "OPTIONS" )
						.reply( 200, { _links: {
							"host:register": {
								href: "/nonstop/host",
								method: "post"
							},
							"hook:self": {
								href: "/hook/{id}",
								method: "get",
								templated: true
							},
							"hook:add": {
								href: "/hook/{id}",
								method: "post",
								templated: true
							}
						} } );

					return hook
						.then( function( result ) {
							response = result;
						} );
				} );

				it( "should make expected HTTP calls", function() {
					options.isDone();
					hookSelf.isDone();
					hookCreate.isDone();
				} );

				it( "should resolve to the server response", function() {
					response.should.eql( {
						_origin: {
							href: "/nonstop/host",
							method: "post"
						},
						status: 201,
						id: "test-host:9090",
						message: "Webhook test-host added successfully",
						_links: {}
					} );
				} );

				after( function() {
					options.isDone();
					hookSelf.isDone();
					hookCreate.isDone();
					api.reset();
				} );
			} );
		} );

		after( function() {
			nock.cleanAll();
		} );
	} );
} );
